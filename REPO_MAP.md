# Repository Map - Clara AI Receptionist System

**Generated:** 2025-01-25  
**Stack:** Express.js + Socket.IO + MongoDB + Vanilla HTML/CSS/JS

---

## 📋 FEATURE INVENTORY

### 1. AI Receptionist (Clara)
- **Files:** `services/claraAI.js`, `geminiApi.js`, `public/index.html`, `public/script.js`
- **Description:** Core AI chatbot using Google Gemini for natural conversations
- **API:** `chat-message` (socket), `/api/chat` (REST)
- **Dependencies:** Gemini AI API, Socket.IO

### 2. Staff Management
- **Files:** `models/Staff.js`, `models/StaffTimetable.js`, `staff-profiles.js`
- **Routes:** `routes/timetable.js`, `routes/sessions.js`
- **API:** 
  - `GET /api/staff/available`
  - `GET /api/staff/list`
  - `GET /api/staff/status/:staffId`
  - `POST /api/staff/call-request`
- **Dependencies:** MongoDB, Socket.IO

### 3. Video Calling (WebRTC)
- **Files:** `public/components/SessionVideoCall.js`, `public/components/VideoCallContainer.js`, `models/Call.js`, `routes/calls.js`
- **Components:** WebRTC peer-to-peer video/audio
- **Socket Events:** `video-call-request`, `accept-call`, `reject-call`, `ice-candidate`
- **Dependencies:** Socket.IO, WebRTC API

### 4. Appointment System
- **Files:** `models/Appointment.js`, `routes/appointments.js`
- **API:** 
  - `POST /api/appointments`
  - `GET /api/appointments/staff/:staffId`
  - `PUT /api/appointments/:id/decision`
- **Features:** QR code generation, approval workflow
- **Dependencies:** MongoDB, QRCode library

### 5. College Information System
- **Files:** `services/collegeAI.js`, `config/college.js`, `routes/college.js`, `public/college-demo.html`
- **API:** `POST /api/college/ask`
- **Description:** Dedicated AI for college-specific queries (admissions, fees, departments)
- **Dependencies:** Gemini AI, college config data

### 6. Timetable Management
- **Files:** `services/timetableService.js`, `services/timetableQueryHandler.js`, `models/ClassTimetable.js`, `routes/timetable.js`
- **API:** `GET /api/timetable/query`
- **Description:** Natural language timetable queries
- **Dependencies:** MongoDB

### 7. Authentication & Authorization
- **Files:** `middleware/auth.js`, `models/User.js`
- **Features:** JWT-based auth for staff, bcrypt password hashing
- **API:** `POST /api/auth/login`, `POST /api/auth/register`
- **Dependencies:** JWT, bcryptjs

### 8. n8n Integration
- **Files:** `services/n8nService.js`, `routes/n8n.js`, `public/n8n-test.html`
- **API:** `POST /api/n8n/webhook`, `GET /api/n8n/test`
- **Description:** External automation workflow integration
- **Dependencies:** Axios, n8n webhook

### 9. Conversation History
- **Files:** `models/Conversation.js`
- **Description:** Persistent chat history storage
- **Dependencies:** MongoDB

### 10. Session Management
- **Files:** `models/Session.js`, `routes/sessions.js`
- **Description:** WebRTC session tracking
- **Dependencies:** MongoDB, Socket.IO

---

## 🔗 DEPENDENCY GRAPH

### Frontend → Backend
```
Frontend HTML/JS
  ↓
  ├─ Socket.IO Client → Backend Socket.IO Server
  ├─ REST API Calls → Express Routes
  └─ Static Assets → Express Static Middleware
```

### Backend Dependencies
```
Express Server
  ↓
  ├─ Socket.IO → Real-time communication
  ├─ MongoDB → Data persistence
  ├─ Gemini AI → Natural language processing
  ├─ JWT → Authentication
  └─ WebRTC → Peer-to-peer video
```

### External Services
- Google Gemini API (AI processing)
- MongoDB Atlas/Local (database)
- n8n (automation workflows)
- Socket.IO (WebSocket management)

---

## 🏗️ CURRENT FRAMEWORKS & ARCHITECTURE

### Frontend Stack
- **Type:** Vanilla JavaScript (no build step)
- **HTML:** Multiple static pages in `/public`
- **CSS:** Vanilla CSS in `/public/*.css`
- **JS:** Vanilla ES6+ in `/public/*.js`
- **Components:** React components embedded in some HTML files (via CDN)
- **Build:** None (served directly)
- **Entry Points:** `index.html`, `client-interface.html`, `staff-interface.html`, etc.

### Backend Stack
- **Framework:** Express.js 4.18.2
- **Language:** Node.js (CommonJS)
- **Real-time:** Socket.IO 4.7.4
- **Database:** MongoDB 8.0.0
- **ORM:** Mongoose 8.0.0
- **Entry Point:** `server.js` (port 3000)

### Deployment
- **Platform:** Vercel
- **Config:** `vercel.json` with `@vercel/node`
- **Static Serving:** Express static middleware

---

## 📍 ENTRY POINTS

### Backend Entry
- **File:** `server.js`
- **Script:** `npm start` → `node server.js`
- **Port:** 3000 (env: `PORT`)

### Frontend Entry Points
1. **Main Reception:** `http://localhost:3000/` → `public/index.html`
2. **Client Interface:** `http://localhost:3000/client-interface` → N/A (not routed)
3. **Staff Login:** `http://localhost:3000/staff-login` → `public/staff-login.html`
4. **Staff Dashboard:** `http://localhost:3000/staff-dashboard` → `public/staff-neon.html`
5. **College Demo:** `http://localhost:3000/college-demo` → `public/college-demo.html`
6. **Registration:** `http://localhost:3000/register` → `public/register.html`

---

## 🔧 BUILD SCRIPTS & COMMANDS

### Current Scripts (`package.json`)
```json
{
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

### Missing Scripts
- No frontend build script (vanilla HTML served directly)
- No test scripts
- No lint scripts

---

## 🗂️ ROUTING TOPOLOGY

### Root Routes (`server.js`)
```
/ → public/index.html
/staff-login → public/staff-login.html
/staff-dashboard → public/staff-neon.html
/college-demo → public/college-demo.html
/register → public/register.html
/test-routes → public/test-routes.html
/n8n-test → public/n8n-test.html
```

### API Routes
```
POST /api/staff/call-request
GET  /api/staff/status/:staffId
GET  /api/staff/available
GET  /api/staff/list
GET  /api/health
POST /api/college/ask
POST /api/timetable/query
POST /api/appointments
GET  /api/appointments/staff/:staffId
PUT  /api/appointments/:id/decision
POST /api/calls/waiting
GET  /api/calls/my-calls
POST /api/n8n/webhook
GET  /api/n8n/test
```

### Socket.IO Events (Client → Server)
```
chat-message
accept-call
reject-call
video-call-request
store-appointment
join-staff
staff-availability-update
add-timetable-entry
```

### Socket.IO Events (Server → Client)
```
ai-response
video-call-request
video-call-accepted
video-call-rejected
appointment-confirmed
call-ended
incoming-call-request
staff-list-updated
```

---

## ⚠️ KNOWN PROBLEMS

### Build/Runtime Issues
1. **No frontend build step** - Risk of serving large JS files in production
2. **Mixed React/Vanilla** - Some HTML uses React via CDN
3. **Duplicate server files** - `server.js` and `server-enhanced.js` coexist
4. **No TypeScript** - Error-prone without type checking

### Environment Issues
1. **Single .env** - Needs splitting for frontend/backend
2. **Missing env validation** - Could fail silently

### Dependencies Issues
1. **Development dependencies** - No ESLint/Prettier
2. **Security** - Some outdated packages
3. **Build artifacts** - `node_modules` committed? (need to check .gitignore)

### Code Quality Issues
1. **No linting** - Inconsistent code style
2. **Large server.js** - 2160 lines, needs modularization
3. **Hardcoded values** - Some configuration in code vs env

---

## 📦 ENVIRONMENT FILES

### Current
- `.env` (actual, in .gitignore)
- `.env.backup` (backup copy)
- `env-template.txt` (template)

### Variables Required
```
PORT=3000
MONGODB_URI=mongodb://...
JWT_SECRET=...
JWT_EXPIRES_IN=24h
GEMINI_API_KEY=...
N8N_WEBHOOK_URL=...
N8N_API_KEY=...
DAILY_API_KEY=...
DAILY_DOMAIN=...
DEMO_STAFF_EMAIL=...
DEMO_STAFF_PASSWORD=...
BCRYPT_ROUNDS=12
```

---

## 📝 SCRIPT FILES (Utility/Test)

### Test Scripts
- `test-complete-system.js`
- `test-conversation.js`
- `test-http.js`
- `test-integration.js`
- `test-staff-connection.js`
- `quick-test.js`

### Setup Scripts
- `setup.js`
- `scripts/populate-staff.js`
- `scripts/populate-staff-complete.js`

### Demo Utilities
- `demo-timetable.js`
- `demo-timetable-queries.md`

### Other
- `server-enhanced.js` (alternative server, possibly unused)
- `start.bat` (Windows start script)

---

## 🔒 SECURITY CONCERNS

1. **CORS:** `origin: "*"` - too permissive
2. **Helmet:** CSP disabled for inline scripts
3. **Rate limiting:** 1000 req/min - too high
4. **Secrets:** May be in env files, need audit
5. **Auth:** JWT secret needs to be rotated

---

## 📊 FILE STATISTICS

- **Total JavaScript files:** ~50
- **Total HTML files:** ~15
- **Total CSS files:** ~5
- **Routes:** 8 route files
- **Services:** 6 service files
- **Models:** 9 Mongoose models
- **Documentation:** 15+ markdown files

---

## 🎯 ARCHITECTURAL PATTERNS

### MVC-like Structure
- **Models:** `/models` (Mongoose schemas)
- **Views:** `/public` (HTML/CSS/JS)
- **Controllers:** `/routes` + `server.js` (Express routes + Socket handlers)

### Service Layer
- `/services` contains business logic (AI, college, timetable, n8n)

### Static Assets
- All client assets in `/public` served by Express static middleware

---

## 🚀 DEPLOYMENT STRATEGY

### Current
- Single Express server serves everything
- Static files + API + Socket.IO on port 3000
- Vercel serverless with `@vercel/node`

### Issues
- No separation of concerns
- Can't scale frontend/backend independently
- Socket.IO may not work well in serverless

---

**END OF REPO MAP**

