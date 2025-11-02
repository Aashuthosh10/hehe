const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Staff = require('./models/Staff');
const StaffTimetable = require('./models/StaffTimetable');
const Appointment = require('./models/Appointment');
const Conversation = require('./models/Conversation');
const Call = require('./models/Call');
const Session = require('./models/Session');

// Import services
const ClaraAI = require('./services/claraAI');

// Import Gemini AI
const { queryGemini } = require('./geminiApi');

// Import College AI
const CollegeAI = require('./services/collegeAI');
const collegeRoutes = require('./routes/college');

// Import Timetable Query Handler
const TimetableQueryHandler = require('./services/timetableQueryHandler');

// Import n8n Integration
const n8nRoutes = require('./routes/n8n');
const N8nService = require('./services/n8nService');

// Import Timetable routes
const timetableRoutes = require('./routes/timetable');

// Import new routes
const callRoutes = require('./routes/calls');
const appointmentRoutes = require('./routes/appointments');
const sessionRoutes = require('./routes/sessions');

// Import staff profiles for demo/staff login support
const staffProfiles = require('./staff-profiles.js');

// Initialize College AI
const collegeAI = new CollegeAI();

// Initialize Timetable Query Handler
const timetableQueryHandler = new TimetableQueryHandler();

// Initialize n8n Service
const n8nService = new N8nService();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Helper to check DB connectivity
const isDbConnected = () => mongoose.connection.readyState === 1;

// Helper function to detect college-related queries
const isCollegeQuery = (message) => {
  const collegeKeywords = [
    'admission', 'apply', 'enroll', 'join', 'fee', 'cost', 'price', 'tuition',
    'department', 'course', 'branch', 'cse', 'mechanical', 'civil', 'ece', 'ise',
    'faculty', 'teacher', 'professor', 'placement', 'job', 'career', 'salary',
    'event', 'fest', 'seminar', 'workshop', 'contact', 'phone', 'email',
    'sai vidya', 'engineering', 'college', 'university', 'institute'
  ];
  
  const lowerMessage = message.toLowerCase();
  return collegeKeywords.some(keyword => lowerMessage.includes(keyword));
};

// Helper function to detect timetable-related queries
const isTimetableQuery = (message) => {
  const timetableKeywords = [
    'schedule', 'timetable', 'class', 'free', 'available', 'busy', 'teaching',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    'room', 'lab', 'office hours', 'when does', 'what classes',
    'mr.', 'mrs.', 'ms.', 'dr.', 'prof.'
  ];
  
  const lowerMessage = message.toLowerCase();
  return timetableKeywords.some(keyword => lowerMessage.includes(keyword));
};

// Security middleware
// Relax CSP for inline scripts used by the static HTML pages
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes - Define these BEFORE static middleware
app.post('/api/staff/call-request', async (req, res) => {
  try {
    const { staffId, clientName, purpose, clientSocketId } = req.body;
    
    console.log('📞 Direct call request received:', { staffId, clientName, purpose });
    
    // Find staff member
    const staffProfile = staffProfiles.find(s => s.shortName === staffId);
    if (!staffProfile) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    // Check if staff is online
    const staffSocketId = staffSessions.get(staffId);
    
    if (staffSocketId) {
      // Staff is online - send immediate notification
      const callRequest = {
        callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        clientName,
        purpose: purpose || 'General inquiry',
        timestamp: new Date(),
        type: 'video-call'
      };
      
      io.to(staffSocketId).emit('incoming-call-request', callRequest);
      
      console.log(`✅ Call request sent to online staff: ${staffProfile.name}`);
      res.json({ 
        success: true, 
        message: `Call request sent to ${staffProfile.name}`,
        callId: callRequest.callId
      });
    } else {
      // Staff is offline - queue the request
      if (!pendingStaffCalls.has(staffId)) {
        pendingStaffCalls.set(staffId, []);
      }
      
      const queuedCall = {
        callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        clientName,
        purpose: purpose || 'General inquiry',
        timestamp: new Date(),
        type: 'video-call'
      };
      
      pendingStaffCalls.get(staffId).push(queuedCall);
      
      console.log(`⏳ Call request queued for offline staff: ${staffProfile.name}`);
      res.json({ 
        success: true, 
        message: `Call request queued for ${staffProfile.name}. They will be notified when they come online.`,
        callId: queuedCall.callId
      });
    }
  } catch (error) {
    console.error('❌ Error processing call request:', error);
    res.status(500).json({ error: 'Failed to process call request' });
  }
});

app.get('/api/staff/status/:staffId', (req, res) => {
  const { staffId } = req.params;
  const isOnline = staffSessions.has(staffId);
  
  res.json({ 
    staffId, 
    isOnline, 
    lastSeen: isOnline ? new Date() : null 
  });
});

// Static middleware - AFTER API routes
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// Prevent favicon 404 noise
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Rate limiting (relaxed for local development to avoid 429 during testing)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,          // allow many requests during local testing
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// MongoDB Connection - only connect if MongoDB URI is provided
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.log('⚠️  Running in demo mode without database');
  });
} else {
  console.log('⚠️  MongoDB URI not provided - running in demo mode without database');
}

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo_secret');
    if (isDbConnected()) {
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      req.user = user;
    } else {
      // Demo mode: attach a minimal user
      req.user = { _id: decoded.userId, role: 'staff', name: 'Demo Staff' };
    }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Clara character prompt
const CLARA_PROMPT = `You are Clara, a friendly and professional AI receptionist. Your personality is:

1. Be warm, welcoming, and genuinely helpful
2. Use friendly, conversational language (not overly formal)
3. Answer any question asked - be informative and helpful
4. Show genuine interest in helping visitors
5. Be empathetic and understanding
6. Have a cheerful and positive attitude
7. Adapt your responses to be more casual and friendly when appropriate
8. Don't be robotic - be human-like and engaging

Always respond as Clara, maintaining your friendly receptionist personality. Be helpful, answer questions naturally, and make visitors feel welcome.`;

/**
 * Generate chatbot response using Gemini AI only
 */
async function generateResponse(message, conversationId) {
  try {
    // Get conversation history when DB is available
    let messages = [];
    if (isDbConnected()) {
      const conversation = await Conversation.findOne({ sessionId: conversationId });
      messages = conversation ? conversation.messages.slice(-10) : [];
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Use Gemini AI
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      try {
        console.log('🤖 Using Gemini AI for response generation...');
        const response = await queryGemini(message, messages);
        return response;
      } catch (geminiError) {
        console.error('❌ Gemini AI error:', geminiError.message);
        console.log('⚠️  Falling back to demo responses...');
      }
    }

    // Fallback to demo responses
    console.log('⚠️  Using demo mode responses (no valid Gemini API key configured)');
    const fallbackResponses = [
      "Hi there! I'm Clara, your friendly AI receptionist! How can I help you today? 😊",
      "Welcome! I'm so glad you're here. What can I do for you?",
      "Hey there! I'm Clara and I'm here to help. What's on your mind?",
      "Hello! I'm your AI receptionist Clara. I'd love to assist you with anything you need!",
      "Welcome! I'm Clara and I'm excited to help you today. What brings you here?"
    ];
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  } catch (error) {
    console.error('❌ Error generating response:', error?.response?.data || error.message);
    return 'I apologize, but I\'m experiencing some technical difficulties. Please try again in a moment.';
  }
}

// Enhanced in-memory storage for WebRTC calls and staff management
const connectedUsers = new Map(); // socketId -> user
const waitingCalls = new Map(); // socketId -> call
const activeCalls = new Map(); // callId -> call session
// Map staff identifiers to socket ids. Keys can be DB _id or shortName (ACS, LDN, etc.)
const staffSessions = new Map(); // staffKey -> socketId
const videoCallRequests = new Map(); // requestId -> video call request
const pendingVideoCalls = new Map(); // staffId -> pending video call requests
const pendingStaffCalls = new Map(); // staffId -> pending start-conversation call requests

// Note: Removed hardcoded demo staff injection to ensure only real staff (from staff-profiles.js) appear

const clientSessions = new Map(); // socketId -> client session

// Initialize Clara AI
const claraAI = new ClaraAI();

// In-memory storage for demo mode
const demoUsers = new Map();
const demoConversations = new Map();
const demoCalls = new Map();

// QR Code generation utility
const generateQRCode = (data) => {
  // Simple QR code generation for demo purposes
  // In production, you'd use a proper QR code library
  return {
    data: data,
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Enhanced staff login with session management
  socket.on('staff-login', async (data) => {
    try {
      const { email, password } = data;
      let user = null;

      // 1) Try DB user first (when DB is connected)
      if (isDbConnected()) {
        const dbUser = await User.findOne({ email, role: 'staff' });
        if (dbUser && await bcrypt.compare(password, dbUser.password)) {
          dbUser.isAvailable = true;
          dbUser.lastActive = new Date();
          await dbUser.save();
          user = dbUser;
        }
      }

      // 2) Fallback to staff-profiles.js (plain credentials)
      if (!user) {
        const profile = staffProfiles.find(s => s.email.toLowerCase() === String(email || '').toLowerCase());
        if (profile && profile.password === password) {
          user = {
            _id: profile.shortName,
            name: profile.name,
            role: 'staff',
            department: profile.department,
            isAvailable: true,
            lastActive: new Date(),
            email: profile.email
          };
        }
      }

      // 3) Final fallback to demo env credentials
      if (!user && !isDbConnected()) {
        const demoEmail = process.env.DEMO_STAFF_EMAIL || 'staff@demo.com';
        const demoPassword = process.env.DEMO_STAFF_PASSWORD || 'demo123';
        if (email === demoEmail && password === demoPassword) {
          user = {
            _id: `staff_${Date.now()}`,
            name: 'Demo Staff',
            role: 'staff',
            department: 'Support',
            isAvailable: true,
            lastActive: new Date(),
            email: demoEmail
          };
        }
      }

      // If still no user, fail the login
      if (!user) {
        socket.emit('login-error', { message: 'Invalid credentials' });
        return;
      }

      // Store user connection and staff session
      connectedUsers.set(socket.id, user);
      // Map by database id
      staffSessions.set(user._id.toString(), socket.id);
      // Also map by shortName (e.g., 'ACS') so UI using short codes can target correctly
      try {
        const profile = staffProfiles.find(p =>
          (p.email && user.email && p.email.toLowerCase() === String(user.email).toLowerCase()) ||
          (p.name && user.name && p.name.toLowerCase() === String(user.name).toLowerCase())
        );
        if (profile && profile.shortName) {
          staffSessions.set(String(profile.shortName), socket.id);
        }
      } catch (_) {}

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'demo_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      socket.emit('staff-login-success', { 
        staff: { id: user._id, name: user.name, department: user.department, email: user.email }
      });

      // Send user login activity to n8n webhook
      try {
        await n8nService.processUserActivity({
          userId: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          action: 'login'
        });
      } catch (n8nError) {
        console.error('❌ n8n user activity processing error:', n8nError.message);
        // Don't fail the main flow if n8n is down
      }
      
      // Notify about waiting calls
      if (isDbConnected()) {
        const waitingCallCount = await Call.countDocuments({ status: 'waiting' });
        socket.emit('waiting-calls', { count: waitingCallCount });
      } else {
        socket.emit('waiting-calls', { count: waitingCalls.size });
      }

      // Check for pending video call requests
      const pendingRequests = pendingVideoCalls.get(user._id.toString()) || [];
      if (pendingRequests.length > 0) {
        socket.emit('pending-video-calls', { requests: pendingRequests });
      }

      // Deliver any queued start-conversation calls for this staff (when they were offline)
      const queuedCalls = pendingStaffCalls.get(user._id.toString()) || [];
      if (queuedCalls.length > 0) {
        queuedCalls.forEach(c => {
          socket.emit('new-call-request', c);
        });
        pendingStaffCalls.set(user._id.toString(), []);
      }

      // Emit available staff list to all clients
      io.emit('staff-list-updated', { 
        staff: Array.from(staffSessions.keys()).map(staffId => {
          const staffUser = connectedUsers.get(staffSessions.get(staffId));
          return { id: staffId, name: staffUser.name, department: staffUser.department };
        })
      });
    } catch (error) {
      socket.emit('login-error', { message: 'Login failed' });
    }
  });

  // Enhanced client conversation start with staff selection
  socket.on('start-conversation', async (data) => {
    try {
      const { name, email, purpose, selectedStaffId } = data;
      
      // Validate staff selection
      if (!selectedStaffId) {
        socket.emit('conversation-error', { message: 'Please select a staff member to connect with' });
        return;
      }

      // Resolve staff socket if online (may be undefined if offline)
      const staffSocketId = staffSessions.get(selectedStaffId);
      // Resolve staff profile from static list (supports offline flow)
      const staffProfile = staffProfiles.find(
        (s) => String(s.shortName).toLowerCase() === String(selectedStaffId).toLowerCase()
      );

      const staffUser = staffSocketId ? connectedUsers.get(staffSocketId) : null;
      
      // Check if MongoDB is connected
      if (mongoose.connection.readyState === 1) {
        // Use MongoDB
        let user = await User.findOne({ email });
        if (!user) {
          user = new User({
            name,
            email,
            password: await bcrypt.hash(Math.random().toString(), 10),
            role: 'client'
          });
          await user.save();
        }

        // Create conversation
        const sessionId = socket.id;
        const conversation = new Conversation({
          userId: user._id,
          sessionId,
          messages: [{
            sender: 'system',
            content: `New conversation started by ${name} with staff ${(staffUser?.name || staffProfile?.name || 'Staff')} - Initial context: ${purpose}`,
            messageType: 'system'
          }]
        });
        await conversation.save();

        // Resolve staff DB user id (selectedStaffId may be a socket/session id or shortName)
        let staffDbUserId = null;
        try {
          staffDbUserId = new mongoose.Types.ObjectId(selectedStaffId);
        } catch (_) {
          staffDbUserId = null;
        }

        if (!staffDbUserId) {
          // Try to find staff by email or name
          let staffDbUser = null;
          const candidateEmail = staffUser?.email || staffProfile?.email || `${selectedStaffId}@staff.local`;
          const candidateName = staffUser?.name || staffProfile?.name || `${selectedStaffId}`;

          if (candidateEmail) {
            staffDbUser = await User.findOne({ email: candidateEmail, role: 'staff' });
          }
          if (!staffDbUser && candidateName) {
            staffDbUser = await User.findOne({ name: candidateName, role: 'staff' });
          }
          if (!staffDbUser) {
            staffDbUser = new User({
              name: candidateName,
              email: candidateEmail,
              password: await bcrypt.hash(Math.random().toString(), 10),
              role: 'staff',
              department: staffUser?.department || staffProfile?.department || 'General',
              isAvailable: true
            });
            await staffDbUser.save();
          }
          staffDbUserId = staffDbUser._id;
        }

        // Create call request with staff assignment
        const call = new Call({
          clientId: user._id,
          staffId: staffDbUserId,
          purpose: purpose || "General conversation and assistance",
          status: 'waiting'
        });
        await call.save();

        // Send call data to n8n webhook
        try {
          await n8nService.processCall(call);
        } catch (n8nError) {
          console.error('❌ n8n call processing error:', n8nError.message);
          // Don't fail the main flow if n8n is down
        }

        waitingCalls.set(socket.id, call);
        connectedUsers.set(socket.id, user);
        clientSessions.set(user._id.toString(), socket.id);

        // Notify selected staff if online, else queue for when they log in
        if (staffSocketId) {
          io.to(staffSocketId).emit('new-call-request', {
            callId: call._id,
            clientName: name,
            purpose,
            timestamp: new Date()
          });
        } else {
          const k = staffDbUserId.toString();
          if (!pendingStaffCalls.has(k)) pendingStaffCalls.set(k, []);
          pendingStaffCalls.get(k).push({
            callId: call._id,
            clientName: name,
            purpose,
            timestamp: new Date()
          });
        }

        socket.emit('conversation-started', { 
          sessionId, 
          callId: call._id,
          name: name,
          purpose: purpose,
          staffName: (staffUser?.name || staffProfile?.name || 'Staff'),
          staffDepartment: (staffUser?.department || staffProfile?.department || 'General'),
          selectedStaffId: selectedStaffId
        });
      } else {
        // Use in-memory storage for demo mode
        const sessionId = socket.id;
        const userId = `demo_${Date.now()}`;
        
        // Create demo user
        const demoUser = {
          _id: userId,
          name,
          email,
          role: 'client'
        };
        demoUsers.set(userId, demoUser);
        
        // Create demo conversation
        const demoConversation = {
          sessionId,
          userId,
          messages: [{
            sender: 'system',
            content: `New conversation started by ${name} with staff ${(staffUser?.name || staffProfile?.name || 'Staff')} - Purpose: ${purpose}`,
            messageType: 'system'
          }]
        };
        demoConversations.set(sessionId, demoConversation);
        
        // Create demo call
        const demoCall = {
          _id: `call_${Date.now()}`,
          clientId: userId,
          staffId: selectedStaffId,
          purpose,
          status: 'waiting',
          createdAt: new Date()
        };
        
        // Send demo call data to n8n webhook
        try {
          await n8nService.processCall(demoCall);
        } catch (n8nError) {
          console.error('❌ n8n demo call processing error:', n8nError.message);
          // Don't fail the main flow if n8n is down
        }
        
        demoCalls.set(sessionId, demoCall);
        connectedUsers.set(socket.id, demoUser);
        clientSessions.set(userId, socket.id);
        
        // Notify selected staff about new call (or queue if offline)
        if (staffSocketId) {
          io.to(staffSocketId).emit('new-call-request', {
            callId: demoCall._id,
            clientName: name,
            purpose,
            timestamp: new Date()
          });
        } else {
          const k = selectedStaffId.toString();
          if (!pendingStaffCalls.has(k)) pendingStaffCalls.set(k, []);
          pendingStaffCalls.get(k).push({
            callId: demoCall._id,
            clientName: name,
            purpose,
            timestamp: new Date()
          });
        }

        socket.emit('conversation-started', { 
          sessionId, 
          callId: demoCall._id,
          name: name,
          purpose: purpose,
          staffName: (staffUser?.name || staffProfile?.name || 'Staff'),
          staffDepartment: (staffUser?.department || staffProfile?.department || 'General'),
          selectedStaffId: selectedStaffId
        });
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      socket.emit('conversation-error', { message: 'Failed to start conversation: ' + error.message });
    }
  });

  // Enhanced staff call acceptance
  socket.on('accept-call', async (data) => {
    try {
      const { callId } = data;
      const staffUser = connectedUsers.get(socket.id);
      
      if (!staffUser || staffUser.role !== 'staff') {
        socket.emit('call-error', { message: 'Unauthorized: Staff access required' });
        return;
      }

      let clientSocketId = null;
      let selectedCall = null;

      if (isDbConnected()) {
        const call = await Call.findById(callId);
        if (!call || call.status !== 'waiting') {
          socket.emit('call-error', { message: 'Call not found or already processed' });
          return;
        }

        // Verify staff is assigned to this call
        if (call.staffId.toString() !== staffUser._id.toString()) {
          socket.emit('call-error', { message: 'You are not assigned to this call' });
          return;
        }

        call.status = 'in-progress';
        call.startTime = new Date();
        await call.save();

        // Send call acceptance data to n8n webhook
        try {
          await n8nService.processCall(call);
        } catch (n8nError) {
          console.error('❌ n8n call acceptance processing error:', n8nError.message);
          // Don't fail the main flow if n8n is down
        }

        // Find client socket
        clientSocketId = clientSessions.get(call.clientId.toString());
        selectedCall = call;
      } else {
        // Demo mode
        const entry = Array.from(waitingCalls.entries()).find(([id, c]) => c._id === callId);
        if (!entry) {
          socket.emit('call-error', { message: 'Call not found' });
          return;
        }
        
        clientSocketId = entry[0];
        const call = entry[1];
        
        // Verify staff is assigned to this call
        if (call.staffId !== staffUser._id.toString()) {
          socket.emit('call-error', { message: 'You are not assigned to this call' });
          return;
        }
        
        call.status = 'in-progress';
        call.startTime = new Date();
        
        // Send demo call acceptance data to n8n webhook
        try {
          await n8nService.processCall(call);
        } catch (n8nError) {
          console.error('❌ n8n demo call acceptance processing error:', n8nError.message);
          // Don't fail the main flow if n8n is down
        }
        
        waitingCalls.set(clientSocketId, call);
        selectedCall = call;
      }

      if (clientSocketId) {
        // Move call to active calls
        activeCalls.set(callId, {
          callId,
          clientSocketId,
          staffSocketId: socket.id,
          startTime: new Date(),
          status: 'in-progress'
        });

        // Remove from waiting calls
        waitingCalls.delete(clientSocketId);

        // Notify client
        io.to(clientSocketId).emit('call-accepted', {
          staffName: staffUser.name,
          staffDepartment: staffUser.department,
          callId: callId
        });

        // Notify staff
        socket.emit('call-started', { 
          callId, 
          clientId: selectedCall.clientId,
          clientName: selectedCall.clientName || 'Client'
        });

        // Emit updated waiting calls count
        io.emit('waiting-calls-updated', { 
          count: waitingCalls.size 
        });
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      socket.emit('call-error', { message: 'Failed to accept call: ' + error.message });
    }
  });

  // Enhanced WebRTC signaling with call session validation
  socket.on('offer', (data) => {
    const { target, offer, callId } = data;
    
    // Validate call session
    const callSession = activeCalls.get(callId);
    if (!callSession) {
      socket.emit('signaling-error', { message: 'Invalid call session' });
      return;
    }

    // Verify sender is part of the call
    if (socket.id !== callSession.clientSocketId && socket.id !== callSession.staffSocketId) {
      socket.emit('signaling-error', { message: 'Unauthorized signaling attempt' });
      return;
    }

    // Forward offer to the other participant
    const targetSocketId = socket.id === callSession.clientSocketId ? 
      callSession.staffSocketId : callSession.clientSocketId;
    
    io.to(targetSocketId).emit('offer', { 
      offer, 
      from: socket.id,
      callId 
    });
  });

  socket.on('answer', (data) => {
    const { target, answer, callId } = data;
    
    // Validate call session
    const callSession = activeCalls.get(callId);
    if (!callSession) {
      socket.emit('signaling-error', { message: 'Invalid call session' });
      return;
    }

    // Verify sender is part of the call
    if (socket.id !== callSession.clientSocketId && socket.id !== callSession.staffSocketId) {
      socket.emit('signaling-error', { message: 'Unauthorized signaling attempt' });
      return;
    }

    // Forward answer to the other participant
    const targetSocketId = socket.id === callSession.clientSocketId ? 
      callSession.staffSocketId : callSession.clientSocketId;
    
    io.to(targetSocketId).emit('answer', { 
      answer, 
      from: socket.id,
      callId 
    });
  });

  socket.on('ice-candidate', (data) => {
    const { target, candidate, callId } = data;
    
    // Validate call session
    const callSession = activeCalls.get(callId);
    if (!callSession) {
      socket.emit('signaling-error', { message: 'Invalid call session' });
      return;
    }

    // Verify sender is part of the call
    if (socket.id !== callSession.clientSocketId && socket.id !== callSession.staffSocketId) {
      socket.emit('signaling-error', { message: 'Unauthorized signaling attempt' });
      return;
    }

    // Forward ICE candidate to the other participant
    const targetSocketId = socket.id === callSession.clientSocketId ? 
      callSession.staffSocketId : callSession.clientSocketId;
    
    io.to(targetSocketId).emit('ice-candidate', { 
      candidate, 
      from: socket.id,
      callId 
    });
  });

  // Enhanced call end handling
  socket.on('end-call', async (data) => {
    try {
      const { callId, reason } = data;
      const user = connectedUsers.get(socket.id);
      
      if (!user) {
        socket.emit('call-error', { message: 'User not authenticated' });
        return;
      }

      const callSession = activeCalls.get(callId);
      if (!callSession) {
        socket.emit('call-error', { message: 'Call session not found' });
        return;
      }

      // Verify user is part of the call
      if (socket.id !== callSession.clientSocketId && socket.id !== callSession.staffSocketId) {
        socket.emit('call-error', { message: 'Unauthorized call end attempt' });
        return;
      }

      // Notify both participants
      const otherSocketId = socket.id === callSession.clientSocketId ? 
        callSession.staffSocketId : callSession.clientSocketId;
      
      io.to(otherSocketId).emit('call-ended', { 
        callId, 
        reason: reason || 'Call ended by other participant',
        endedBy: user.name
      });

      socket.emit('call-ended', { 
        callId, 
        reason: reason || 'Call ended',
        endedBy: user.name
      });

      // Generate QR code for the completed call
      const qrCodeData = {
        callId: callId,
        participants: {
          client: callSession.clientSocketId,
          staff: callSession.staffSocketId
        },
        duration: callSession.startTime ? Math.floor((new Date() - callSession.startTime) / 1000) : 0,
        endTime: new Date(),
        purpose: 'Video call completion'
      };

      const qrCode = generateQRCode(JSON.stringify(qrCodeData));

      // Send QR code to client interface
      io.to(callSession.clientSocketId).emit('call-completed-qr', {
        callId,
        qrCode,
        message: 'Call completed! Here is your QR code:'
      });

      // Reset Clara AI to full mode
      claraAI.resetDemoMode();

      // Notify client that Clara is back to full AI mode
      io.to(callSession.clientSocketId).emit('clara-ai-reset', {
        message: `🎉 Call completed! Clara is now back to full AI mode. You can ask me anything!`
      });

      // Clean up call session
      activeCalls.delete(callId);

      // Update call status in database if available
      if (isDbConnected()) {
        try {
          const call = await Call.findById(callId);
          if (call) {
            call.status = 'completed';
            call.endTime = new Date();
            call.duration = Math.floor((call.endTime - call.startTime) / 1000);
            await call.save();
          }
        } catch (dbError) {
          console.error('Error updating call status:', dbError);
        }
      }

    } catch (error) {
      console.error('Error ending call:', error);
      socket.emit('call-error', { message: 'Failed to end call: ' + error.message });
    }
  });

  // Call decision
  socket.on('call-decision', async (data) => {
    try {
      const { callId, decision, notes } = data;
      const staffUser = connectedUsers.get(socket.id);
      
      if (!staffUser || staffUser.role !== 'staff') {
        return;
      }
      if (isDbConnected()) {
        const call = await Call.findById(callId);
        if (!call || call.staffId.toString() !== staffUser._id.toString()) {
          return;
        }

        call.status = 'completed';
        call.endTime = new Date();
        call.decision = decision;
        call.notes = notes;
        call.duration = Math.floor((call.endTime - call.startTime) / 1000);
        await call.save();

        // Send call completion data to n8n webhook
        try {
          await n8nService.processCall(call);
        } catch (n8nError) {
          console.error('❌ n8n call completion processing error:', n8nError.message);
          // Don't fail the main flow if n8n is down
        }

        // Notify client
        const clientSocketId = Array.from(connectedUsers.entries())
          .find(([id, user]) => user._id.toString() === call.clientId.toString())?.[0];

        if (clientSocketId) {
          io.to(clientSocketId).emit('call-completed', { decision, notes });
        }

        socket.emit('decision-saved', { callId, decision });
      } else {
        // Demo mode: update in-memory call
        const clientSocketId = Array.from(waitingCalls.keys()).find(() => false); // no-op to satisfy linter; not used here
        // Just notify staff and client (if we can find by matching connectedUsers client)
        const demoClientEntry = Array.from(connectedUsers.entries()).find(([id, user]) => user.role === 'client');
        if (demoClientEntry) {
          io.to(demoClientEntry[0]).emit('call-completed', { decision, notes });
        }
        socket.emit('decision-saved', { callId, decision });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to save decision' });
    }
  });

  // Handle video call request from Clara AI
  socket.on('video-call-request', async (data) => {
    try {
      const { staffName, staffEmail, staffDepartment, clientName, clientSocketId } = data;
      
      console.log('🎥 Video call request received:', { staffName, staffEmail, staffDepartment, clientName });
      
      // Find staff member
      let staffId = null;
      let staffSocketId = null;
      
      // Check in staff profiles first - more flexible matching
      const staffProfile = staffProfiles.find(s => {
        try {
          // Exact name match
          if (staffName && s.name.toLowerCase() === staffName.toLowerCase()) return true;
          
          // Partial name match (e.g., "Nagashree" matches "Dr. Nagashree N")
          if (staffName && s.name.toLowerCase().includes(staffName.toLowerCase())) return true;
          
          // Email match
          if (staffEmail && s.email && s.email.toLowerCase() === staffEmail.toLowerCase()) return true;
          
          // Short name match (e.g., "NN" matches "Dr. Nagashree N")
          if (staffName && s.shortName && s.shortName.toLowerCase() === staffName.toLowerCase()) return true;
          
          return false;
        } catch (_) {
          return false;
        }
      });
      
      if (staffProfile) {
        staffId = staffProfile.shortName;
        staffSocketId = staffSessions.get(staffId);
        console.log('✅ Staff found:', { staffId, staffName: staffProfile.name, isOnline: !!staffSocketId });
      } else {
        console.log('❌ Staff not found in profiles. Available:', staffProfiles.map(s => ({ name: s.name, email: s.email, shortName: s.shortName })));
      }
      
      if (!staffId) {
        socket.emit('video-call-error', { message: 'Staff member not found' });
        return;
      }
      
      // If staff is offline, queue the request for when they log in
      if (!staffSocketId) {
        // Create video call request
        const requestId = `vcr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const videoCallRequest = {
          requestId,
          staffId,
          staffName,
          staffDepartment,
          clientName,
          clientSocketId,
          status: 'pending',
          requestTime: new Date(),
          accepted: false
        };
        
        videoCallRequests.set(requestId, videoCallRequest);
        
        // Add to pending requests for the staff member
        if (!pendingVideoCalls.has(staffId)) {
          pendingVideoCalls.set(staffId, []);
        }
        pendingVideoCalls.get(staffId).push(videoCallRequest);
        
        // Notify client that request was queued
        socket.emit('video-call-request-sent', {
          requestId,
          staffName,
          message: `Video call request queued for ${staffName}. They will be notified when they come online.`
        });
        
        return;
      }
      
      // Staff is online, create and send request immediately
      const requestId = `vcr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const videoCallRequest = {
        requestId,
        staffId,
        staffName,
        staffDepartment,
        clientName,
        clientSocketId,
        status: 'pending',
        requestTime: new Date(),
        accepted: false
      };
      
      videoCallRequests.set(requestId, videoCallRequest);
      
      // Add to pending requests for the staff member
      if (!pendingVideoCalls.has(staffId)) {
        pendingVideoCalls.set(staffId, []);
      }
      pendingVideoCalls.get(staffId).push(videoCallRequest);
      
      // Notify staff member with ringing sound
      io.to(staffSocketId).emit('video-call-request', {
        ...videoCallRequest,
        ringSound: true,
        message: `🎥 Incoming video call request from ${clientName}`,
        callerName: clientName,
        purpose: 'Video call request'
      });
      
      // Notify client that request was sent
      socket.emit('video-call-request-sent', {
        requestId,
        staffName,
        message: `Video call request sent to ${staffName}. Waiting for response...`
      });
      
    } catch (error) {
      console.error('Error handling video call request:', error);
      socket.emit('video-call-error', { message: 'Failed to send video call request' });
    }
  });

  // Handle staff response to video call request
  socket.on('video-call-response', async (data) => {
    try {
      const { requestId, accepted, staffId } = data;
      
      const videoCallRequest = videoCallRequests.get(requestId);
      if (!videoCallRequest) {
        socket.emit('video-call-error', { message: 'Video call request not found' });
        return;
      }
      
      if (accepted) {
        // Staff accepted the call
        videoCallRequest.status = 'accepted';
        videoCallRequest.accepted = true;
        videoCallRequest.acceptedTime = new Date();
        
        // Notify client
        io.to(videoCallRequest.clientSocketId).emit('video-call-accepted', {
          requestId,
          staffName: videoCallRequest.staffName,
          message: `🎉 ${videoCallRequest.staffName} accepted your video call request!`
        });
        
        // Notify staff
        socket.emit('video-call-accepted-staff', {
          requestId,
          clientName: videoCallRequest.clientName,
          message: `Video call accepted with ${videoCallRequest.clientName}`
        });
        
        // Initialize WebRTC connection
        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        activeCalls.set(callId, {
          callId,
          clientSocketId: videoCallRequest.clientSocketId,
          staffSocketId: socket.id,
          startTime: new Date(),
          status: 'connecting',
          videoCallRequest: requestId
        });
        
        // Emit call started events
        io.to(videoCallRequest.clientSocketId).emit('call-started', { callId });
        socket.emit('call-started', { callId });
        
      } else {
        // Staff rejected the call
        videoCallRequest.status = 'rejected';
        videoCallRequest.rejectedTime = new Date();
        
        // Notify client
        io.to(videoCallRequest.clientSocketId).emit('video-call-rejected', {
          requestId,
          staffName: videoCallRequest.staffName,
          message: `❌ ${videoCallRequest.staffName} is not available for video calls right now.`
        });
        
        // Reset Clara AI to full mode
        claraAI.resetDemoMode();
        
        // Notify client that Clara is back to full AI mode
        io.to(videoCallRequest.clientSocketId).emit('clara-ai-reset', {
          message: `Clara is now back to full AI mode. You can ask me anything!`
        });
      }
      
      // Remove from pending requests
      const pendingRequests = pendingVideoCalls.get(staffId) || [];
      const updatedRequests = pendingRequests.filter(req => req.requestId !== requestId);
      pendingVideoCalls.set(staffId, updatedRequests);
      
    } catch (error) {
      console.error('Error handling video call response:', error);
      socket.emit('video-call-error', { message: 'Failed to process video call response' });
    }
  });

  // Chat messages (allow chat without prior auth; create transient session if needed)
  socket.on('chat-message', async (data) => {
    try {
      const { sessionId, message } = data;
      let user = connectedUsers.get(socket.id);
      
      if (!user) {
        const transientUser = { _id: `visitor_${socket.id}`, role: 'client', name: 'Visitor' };
        connectedUsers.set(socket.id, transientUser);
        user = transientUser;
      }

      // Save user message when DB is available
      let conversation = null;
      if (isDbConnected() && sessionId) {
        conversation = await Conversation.findOne({ sessionId });
        if (conversation) {
          conversation.messages.push({
            sender: 'user',
            content: message,
            messageType: 'text'
          });
          await conversation.save();
        }
      }

      // Generate AI response using appropriate AI service
      let aiResponse;
      let responseData = {};
      
      // Check if this is a timetable-related query
      if (isTimetableQuery(message)) {
        try {
          console.log('📅 Processing timetable query...');
          aiResponse = await timetableQueryHandler.processTimetableQuery(message);
        } catch (error) {
          console.error('Timetable query error, falling back to Gemini:', error);
          aiResponse = await generateResponse(message, sessionId);
        }
      }
      // Check if this is a college-related query
      else if (isCollegeQuery(message)) {
        try {
          aiResponse = await collegeAI.processQuery(message, sessionId);
        } catch (error) {
          console.error('College AI error, falling back to Gemini:', error);
          aiResponse = await generateResponse(message, sessionId);
        }
      } else {
        // Use Clara AI for general queries
        const claraResponse = await claraAI.processQuery(message, sessionId, user._id);
        aiResponse = claraResponse.response;
        responseData = claraResponse;
      }
      
      // Save AI response
      if (conversation) {
        conversation.messages.push({
          sender: 'clara',
          content: aiResponse,
          messageType: 'text'
        });
        await conversation.save();
      }

      // Send conversation data to n8n webhook
      try {
        if (conversation) {
          await n8nService.processConversation({
            sessionId: conversation.sessionId,
            userId: conversation.userId,
            messages: conversation.messages
          });
        }
      } catch (n8nError) {
        console.error('❌ n8n conversation processing error:', n8nError.message);
        // Don't fail the main flow if n8n is down
      }

      // Send response with additional data
      socket.emit('ai-response', { 
        response: aiResponse,
        ...responseData
      });

      // Auto-trigger video call request when Clara uses the standard phrase
      try {
        const triggerPattern = /I am going to start a video call with\s+(.+?)\./i;
        const match = typeof aiResponse === 'string' && aiResponse.match(triggerPattern);
        if (match && match[1]) {
          const mentionedStaffName = match[1].trim();

          // Find staff profile by name match (case-insensitive, partial allowed)
          const staffProfile = staffProfiles.find(s =>
            s.name.toLowerCase() === mentionedStaffName.toLowerCase() ||
            s.name.toLowerCase().includes(mentionedStaffName.toLowerCase())
          );

          if (staffProfile) {
            const staffId = staffProfile.shortName;
            const staffSocketId = staffSessions.get(staffId);

            if (staffSocketId) {
              const requestId = `vcr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const clientName = user?.name || 'Visitor';

              const videoCallRequest = {
                requestId,
                staffId,
                staffName: staffProfile.name,
                staffDepartment: staffProfile.department,
                clientName,
                clientSocketId: socket.id,
                status: 'pending',
                requestTime: new Date(),
                accepted: false
              };

              videoCallRequests.set(requestId, videoCallRequest);
              if (!pendingVideoCalls.has(staffId)) pendingVideoCalls.set(staffId, []);
              pendingVideoCalls.get(staffId).push(videoCallRequest);

              // Notify the specific staff dashboard with ringing alert
              io.to(staffSocketId).emit('video-call-request', {
                ...videoCallRequest,
                ringSound: true,
                message: `🎥 Incoming video call request from ${clientName}`
              });

              // Notify client that request was sent
              socket.emit('video-call-request-sent', {
                requestId,
                staffName: staffProfile.name,
                message: `Video call request sent to ${staffProfile.name}. Waiting for response...`
              });
            }
          }
        }
      } catch (_) {
        // Non-fatal; ignore trigger parsing errors
      }

      // If this was a video call request that was accepted, initiate the call process
      if (responseData.isVideoCallAccepted && responseData.staffInfo) {
        // Send video call request to staff
        socket.emit('initiate-video-call', {
          staffName: responseData.staffInfo.name,
          staffEmail: responseData.staffInfo.email,
          staffDepartment: responseData.staffInfo.department,
          clientName: user.name,
          clientSocketId: socket.id
        });
      }

    } catch (error) {
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  // New call system events
  socket.on('call_initiated', (data) => {
    console.log('Call initiated:', data);
    // Broadcast to all staff members
    io.emit('call_initiated', data);
  });

  socket.on('call_accepted', (data) => {
    console.log('Call accepted:', data);
    // Broadcast to all clients
    io.emit('call_accepted', data);
  });

  socket.on('call_declined', (data) => {
    console.log('Call declined:', data);
    // Broadcast to all clients
    io.emit('call_declined', data);
  });

  socket.on('call_ended', (data) => {
    console.log('Call ended:', data);
    // Broadcast to all clients
    io.emit('call_ended', data);
  });

  // WebRTC signaling events
  socket.on('call_offer', (data) => {
    console.log('Call offer received:', data);
    io.emit('call_offer', data);
  });

  socket.on('call_answer', (data) => {
    console.log('Call answer received:', data);
    io.emit('call_answer', data);
  });

  socket.on('ice_candidate', (data) => {
    console.log('ICE candidate received:', data);
    io.emit('ice_candidate', data);
  });


  // Enhanced disconnect handling with session cleanup
  socket.on('disconnect', async () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      if (user.role === 'staff') {
        // Remove from staff sessions by both keys
        staffSessions.delete(user._id.toString());
        try {
          const profile = staffProfiles.find(p => (p.email && user.email && p.email.toLowerCase() === String(user.email).toLowerCase()) || (p.name && user.name && p.name.toLowerCase() === String(user.name).toLowerCase()));
          if (profile && profile.shortName) staffSessions.delete(String(profile.shortName));
        } catch (_) {}
        
        if (isDbConnected() && typeof user.save === 'function') {
          try {
            user.isAvailable = false;
            user.lastActive = new Date();
            await user.save();
          } catch (_) {}
        }

        // Emit updated staff list
        io.emit('staff-list-updated', { 
          staff: Array.from(staffSessions.keys()).map(staffId => {
            const staffUser = connectedUsers.get(staffSessions.get(staffId));
            return { id: staffId, name: staffUser.name, department: staffUser.department };
          })
        });
      } else {
        // Remove from client sessions
        clientSessions.delete(user._id.toString());
      }
      
      connectedUsers.delete(socket.id);
    }
    
    // Clean up waiting calls
    const call = waitingCalls.get(socket.id);
    if (call) {
      if (isDbConnected() && typeof call.save === 'function') {
        try {
          call.status = 'rejected';
          await call.save();
        } catch (_) {}
      }
      waitingCalls.delete(socket.id);
      
      // Emit updated waiting calls count
      io.emit('waiting-calls-updated', { 
        count: waitingCalls.size 
      });
    }

    // Clean up active calls
    for (const [callId, callSession] of activeCalls.entries()) {
      if (callSession.clientSocketId === socket.id || callSession.staffSocketId === socket.id) {
        const otherSocketId = callSession.clientSocketId === socket.id ? 
          callSession.staffSocketId : callSession.clientSocketId;
        
        if (otherSocketId) {
          io.to(otherSocketId).emit('call-ended', { 
            callId, 
            reason: 'Other participant disconnected',
            endedBy: 'System'
          });
        }
        
        activeCalls.delete(callId);
        break;
      }
    }

    console.log('User disconnected:', socket.id);
  });

  // Session Management Events
  socket.on('create_session', async (data) => {
    try {
      const { sessionId, clientId, staffId, purpose } = data;
      
      // Verify session exists in database
      const session = await Session.findOne({ sessionId });
      if (!session) {
        socket.emit('session_error', { message: 'Session not found' });
        return;
      }

      // Both client and staff join the session room
      socket.join(sessionId);
      
      // Notify both participants about successful session creation
      io.to(sessionId).emit('session_created', {
        sessionId,
        clientId,
        staffId,
        clientName: session.metadata.clientName,
        staffName: session.metadata.staffName,
        purpose: session.metadata.purpose
      });

      console.log(`Session ${sessionId} created - Client: ${clientId}, Staff: ${staffId}`);
    } catch (error) {
      console.error('Error creating session:', error);
      socket.emit('session_error', { message: 'Failed to create session' });
    }
  });

  socket.on('join_session', async (data) => {
    try {
      const { sessionId } = data;
      
      // Verify session exists and user has permission
      const session = await Session.findOne({ sessionId });
      if (!session) {
        socket.emit('session_error', { message: 'Session not found' });
        return;
      }

      const user = connectedUsers.get(socket.id);
      if (!user) {
        socket.emit('session_error', { message: 'User not authenticated' });
        return;
      }

      // Check if user is part of this session
      const isClient = user.role === 'user' && session.clientId.toString() === user._id.toString();
      const isStaff = user.role === 'staff' && session.staffId === user._id;
      
      if (!isClient && !isStaff) {
        socket.emit('session_error', { message: 'Not authorized to join this session' });
        return;
      }

      // Join the session room
      socket.join(sessionId);
      
      // Update session activity
      await session.updateActivity();

      socket.emit('session_joined', {
        sessionId,
        clientName: session.metadata.clientName,
        staffName: session.metadata.staffName,
        purpose: session.metadata.purpose
      });

      console.log(`User ${user.name} joined session ${sessionId}`);
    } catch (error) {
      console.error('Error joining session:', error);
      socket.emit('session_error', { message: 'Failed to join session' });
    }
  });

  socket.on('leave_session', async (data) => {
    try {
      const { sessionId } = data;
      
      socket.leave(sessionId);
      socket.emit('session_left', { sessionId });
      
      console.log(`User left session ${sessionId}`);
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  });

  socket.on('session_message', async (data) => {
    try {
      const { sessionId, message, messageType = 'text' } = data;
      
      // Verify session exists and user has permission
      const session = await Session.findOne({ sessionId });
      if (!session) {
        socket.emit('session_error', { message: 'Session not found' });
        return;
      }

      const user = connectedUsers.get(socket.id);
      if (!user) {
        socket.emit('session_error', { message: 'User not authenticated' });
        return;
      }

      // Check if user is part of this session
      const isClient = user.role === 'user' && session.clientId.toString() === user._id.toString();
      const isStaff = user.role === 'staff' && session.staffId === user._id;
      
      if (!isClient && !isStaff) {
        socket.emit('session_error', { message: 'Not authorized to send messages in this session' });
        return;
      }

      // Update session activity and message count
      await session.updateActivity();
      await session.incrementMessageCount();

      // Broadcast message to all users in the session room
      io.to(sessionId).emit('session_message_received', {
        sessionId,
        message,
        messageType,
        senderId: user._id,
        senderName: user.name,
        senderRole: user.role,
        timestamp: new Date()
      });

      console.log(`Message sent in session ${sessionId} by ${user.name}`);
    } catch (error) {
      console.error('Error sending session message:', error);
      socket.emit('session_error', { message: 'Failed to send message' });
    }
  });

  // Global call_initiated event (for Call Updates container)
  socket.on('call_initiated', async (data) => {
    try {
      const { staffId, clientName, callType = 'video' } = data;
      
      // Find the target staff member
      const targetSocketId = staffSessions.get(staffId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_initiated', {
          sessionId: data.sessionId || 'global-call',
          staffId: staffId,
          clientId: data.clientId || 'unknown',
          clientName: clientName || 'Unknown Client',
          callType: callType,
          callerId: data.callerId || 'unknown',
          callerName: data.callerName || 'Unknown',
          callerRole: data.callerRole || 'user'
        });
        console.log(`Call initiated for staff ${staffId}`);
      } else {
        console.log(`Staff ${staffId} not found or offline`);
      }
    } catch (error) {
      console.error('Error handling global call_initiated:', error);
    }
  });

  socket.on('session_call_initiated', async (data) => {
    try {
      const { sessionId, callType = 'video' } = data;
      
      // Verify session exists and user has permission
      const session = await Session.findOne({ sessionId });
      if (!session) {
        socket.emit('session_error', { message: 'Session not found' });
        return;
      }

      const user = connectedUsers.get(socket.id);
      if (!user) {
        socket.emit('session_error', { message: 'User not authenticated' });
        return;
      }

      // Check if user is part of this session
      const isClient = user.role === 'user' && session.clientId.toString() === user._id.toString();
      const isStaff = user.role === 'staff' && session.staffId === user._id;
      
      if (!isClient && !isStaff) {
        socket.emit('session_error', { message: 'Not authorized to initiate calls in this session' });
        return;
      }

      // Update session activity and call count
      await session.updateActivity();
      await session.incrementCallCount();

      // Only notify the other participant (not the caller)
      const targetRole = user.role === 'user' ? 'staff' : 'user';
      const targetSocketId = targetRole === 'staff' ? 
        staffSessions.get(session.staffId) : 
        clientSessions.get(session.clientId.toString());

      if (targetSocketId) {
        // Emit session-specific notification
        io.to(targetSocketId).emit('session_call_notification', {
          sessionId,
          callType,
          callerId: user._id,
          callerName: user.name,
          callerRole: user.role
        });

        // Also emit global call_initiated event for Call Updates container
        io.to(targetSocketId).emit('call_initiated', {
          sessionId,
          staffId: session.staffId,
          clientId: session.clientId,
          clientName: session.metadata.clientName,
          callType,
          callerId: user._id,
          callerName: user.name,
          callerRole: user.role
        });
      }

      console.log(`Call initiated in session ${sessionId} by ${user.name}`);
    } catch (error) {
      console.error('Error initiating session call:', error);
      socket.emit('session_error', { message: 'Failed to initiate call' });
    }
  });

  // Global call_accepted event
  socket.on('call_accepted', async (data) => {
    try {
      const { sessionId, staffId } = data;
      
      // Notify all participants in the session room
      io.to(sessionId).emit('call_accepted', {
        sessionId,
        staffId,
        acceptedBy: connectedUsers.get(socket.id)?.name || 'Unknown'
      });

      console.log(`Call accepted for session ${sessionId}`);
    } catch (error) {
      console.error('Error accepting call:', error);
    }
  });

  socket.on('session_call_accepted', async (data) => {
    try {
      const { sessionId, callId } = data;
      
      // Notify all participants in the session room
      io.to(sessionId).emit('session_call_accepted', {
        sessionId,
        callId,
        acceptedBy: connectedUsers.get(socket.id)?.name || 'Unknown'
      });

      console.log(`Call accepted in session ${sessionId}`);
    } catch (error) {
      console.error('Error accepting session call:', error);
      socket.emit('session_error', { message: 'Failed to accept call' });
    }
  });

  socket.on('session_call_declined', async (data) => {
    try {
      const { sessionId, callId } = data;
      
      // Notify all participants in the session room
      io.to(sessionId).emit('session_call_declined', {
        sessionId,
        callId,
        declinedBy: connectedUsers.get(socket.id)?.name || 'Unknown'
      });

      console.log(`Call declined in session ${sessionId}`);
    } catch (error) {
      console.error('Error declining session call:', error);
      socket.emit('session_error', { message: 'Failed to decline call' });
    }
  });

  // Global call_ended event
  socket.on('call_ended', async (data) => {
    try {
      const { sessionId } = data;
      
      // Notify all participants in the session room
      io.to(sessionId).emit('call_ended', {
        sessionId,
        endedBy: connectedUsers.get(socket.id)?.name || 'Unknown'
      });

      console.log(`Call ended for session ${sessionId}`);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  });

  socket.on('session_call_ended', async (data) => {
    try {
      const { sessionId, callId } = data;
      
      // Notify all participants in the session room
      io.to(sessionId).emit('session_call_ended', {
        sessionId,
        callId,
        endedBy: connectedUsers.get(socket.id)?.name || 'Unknown'
      });

      console.log(`Call ended in session ${sessionId}`);
    } catch (error) {
      console.error('Error ending session call:', error);
      socket.emit('session_error', { message: 'Failed to end call' });
    }
  });

  socket.on('session_ended', async (data) => {
    try {
      const { sessionId } = data;
      
      // Verify session exists and user has permission
      const session = await Session.findOne({ sessionId });
      if (!session) {
        socket.emit('session_error', { message: 'Session not found' });
        return;
      }

      const user = connectedUsers.get(socket.id);
      if (!user) {
        socket.emit('session_error', { message: 'User not authenticated' });
        return;
      }

      // Check if user is part of this session
      const isClient = user.role === 'user' && session.clientId.toString() === user._id.toString();
      const isStaff = user.role === 'staff' && session.staffId === user._id;
      
      if (!isClient && !isStaff) {
        socket.emit('session_error', { message: 'Not authorized to end this session' });
        return;
      }

      // End the session in database
      await session.endSession();

      // Notify all participants in the session room
      io.to(sessionId).emit('session_ended', {
        sessionId,
        endedBy: user.name
      });

      // Remove all users from the session room
      const room = io.sockets.adapter.rooms.get(sessionId);
      if (room) {
        for (const socketId of room) {
          io.sockets.sockets.get(socketId)?.leave(sessionId);
        }
      }

      console.log(`Session ${sessionId} ended by ${user.name}`);
    } catch (error) {
      console.error('Error ending session:', error);
      socket.emit('session_error', { message: 'Failed to end session' });
    }
  });
});

// API Routes

// College AI routes
app.use('/api/college', collegeRoutes);

// n8n Integration routes
app.use('/api/n8n', n8nRoutes);

// Timetable routes
app.use('/api/timetable', timetableRoutes);

// Call management routes
app.use('/api/calls', callRoutes);

// Appointment management routes
app.use('/api/appointments', appointmentRoutes);
app.use('/api/sessions', sessionRoutes);

// Staff login using staff-profiles.js data (for staff interface)
app.post('/api/staff/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = staffProfiles.find(s => s.email.toLowerCase() === String(email || '').toLowerCase());
    if (!staff || staff.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        staffId: staff.shortName,
        name: staff.name,
        department: staff.department,
        email: staff.email,
        shortName: staff.shortName,
        subjects: staff.subjects
      },
      process.env.JWT_SECRET || 'demo_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      staff: {
        _id: staff.shortName,
        name: staff.name,
        email: staff.email,
        department: staff.department,
        designation: staff.name.includes('Prof.') ? 'Professor' : 'Assistant Professor',
        shortName: staff.shortName,
        subjects: staff.subjects
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// API routes moved to top of file to avoid static middleware conflicts

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    
    // Check if MongoDB is connected
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not available. Please try again later.' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      department
    });
    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'demo_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if MongoDB is connected
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not available. Please try again later.' });
    }
    
    const user = await User.findOne({ email });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'demo_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

// Protected routes
app.get('/api/calls/waiting', authenticateToken, async (req, res) => {
  try {
    if (isDbConnected()) {
      const calls = await Call.find({ status: 'waiting' })
        .populate('clientId', 'name email')
        .sort({ createdAt: 1 });
      res.json(calls);
    } else {
      res.json(Array.from(demoCalls.values()));
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch waiting calls' });
  }
});

app.get('/api/calls/my-calls', authenticateToken, async (req, res) => {
  try {
    if (isDbConnected()) {
      const calls = await Call.find({ staffId: req.user._id })
        .populate('clientId', 'name email')
        .sort({ createdAt: -1 });
      res.json(calls);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

// Upcoming appointments for the logged-in staff (if not already present)
app.get('/api/appointments/upcoming', authenticateToken, async (req, res) => {
  try {
    if (isDbConnected()) {
      const items = await Appointment.findUpcoming(req.user._id, 10);
      res.json(items);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upcoming appointments' });
  }
});

app.get('/api/staff/available', async (req, res) => {
  try {
    // Always return actively connected staff derived from current sessions
    const staff = Array.from(staffSessions.keys()).map((staffId) => {
      const socketId = staffSessions.get(staffId);
      const user = connectedUsers.get(socketId);
      return {
        _id: staffId,
        name: user?.name || 'Staff',
        department: user?.department || 'General',
        lastActive: user?.lastActive || new Date()
      };
    });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch available staff' });
  }
});

// Static staff directory from staff-profiles.js
app.get('/api/staff/list', (req, res) => {
  try {
    const list = staffProfiles.map(s => ({
      _id: s.shortName,
      name: s.name,
      email: s.email,
      department: s.department,
      shortName: s.shortName,
      subjects: s.subjects
    }));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff list' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'index.html'));
});

// Staff interface routes
app.get('/staff', (req, res) => {
  // Redirect to the canonical staff login page to avoid confusion
  res.redirect('/staff-login');
});

app.get('/staff-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'staff-login.html'));
});

app.get('/staff-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'staff-neon.html'));
});

// Video call functionality is now integrated into main interfaces

// Staff registration route
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'register.html'));
});

// College demo route
app.get('/college-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'college-demo.html'));
});

// n8n test route
app.get('/n8n-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'n8n-test.html'));
});

app.get('/test-routes', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public', 'test-routes.html'));
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Clara AI Reception System',
    connectedUsers: connectedUsers.size,
    waitingCalls: waitingCalls.size,
    databaseStatus: isDbConnected() ? 'connected' : 'disconnected'
  };

  // Send health data to n8n webhook
  try {
    await n8nService.sendHealthData(healthData);
  } catch (n8nError) {
    console.error('❌ n8n health data processing error:', n8nError.message);
    // Don't fail the main flow if n8n is down
  }

  res.json(healthData);
});

// Start server (only if not in serverless environment like Vercel)
if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`🚀 Clara AI Reception System running on port ${PORT}`);
    console.log(`📱 Client Interface: http://localhost:${PORT}`);
    console.log(`👥 Staff Login: http://localhost:${PORT}/staff-login`);
    console.log(`📊 Staff Dashboard: http://localhost:${PORT}/staff-dashboard`);
    console.log(`🎥 Video Call: Integrated into main interfaces`);
    console.log(`🎓 College Demo: http://localhost:${PORT}/college-demo`);
    console.log(`🔗 n8n Test Page: http://localhost:${PORT}/n8n-test`);
    console.log(`🧪 Route Test Page: http://localhost:${PORT}/test-routes`);
    console.log(`🔧 API health check: http://localhost:${PORT}/api/health`);
    console.log(`🏫 College AI API: http://localhost:${PORT}/api/college/ask`);
    console.log(`🔗 n8n Integration API: http://localhost:${PORT}/api/n8n`);
    console.log(`🧪 n8n Test endpoint: http://localhost:${PORT}/api/n8n/test`);
    
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    
    if (GEMINI_KEY && GEMINI_KEY !== 'your_gemini_api_key_here') {
      console.log(`🤖 Full AI mode enabled with Gemini AI`);
    } else {
      console.log(`⚠️  Note: Running in demo mode. Set GEMINI_API_KEY in .env for full AI functionality.`);
    }
  });
}

// Export both app and server for Vercel
module.exports = app;
module.exports.server = server;