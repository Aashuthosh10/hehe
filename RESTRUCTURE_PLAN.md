# Restructure Plan - Clara AI Receptionist System

**Generated:** 2025-01-25  
**Goal:** Organize codebase into frontend/backend separation while maintaining 100% functionality

---

## 📐 STRUCTURE OVERVIEW

```
new-clara/
├── frontend/                    # All client-side code
│   ├── public/                  # Static HTML/CSS/JS
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── script.js
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json             # Frontend dependencies
├── backend/                     # All server-side code
│   ├── src/
│   │   ├── server.js           # Main entry point
│   │   ├── models/             # Mongoose models
│   │   ├── routes/             # Express routes
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Auth, etc.
│   │   ├── config/             # Configuration
│   │   └── scripts/            # Utility scripts
│   ├── .env                    # Backend environment
│   └── package.json            # Backend dependencies
├── maliciopus-files/           # Quarantine
│   ├── duplicates/
│   ├── deprecated/
│   ├── testing/
│   ├── backups/
│   └── old-docs/
├── REPO_MAP.md
├── RISK_REPORT.md
├── RESTRUCTURE_PLAN.md
├── MIGRATION_LOG.md
└── CHECKLIST.md
```

---

## 🔄 DETAILED FILE MOVES

### FRONTEND MOVES

#### Current: `/public/` → New: `/frontend/public/`
```
public/index.html                    → frontend/public/index.html
public/script.js                     → frontend/public/script.js
public/styles.css                    → frontend/public/styles.css
public/clara-reception.html          → frontend/public/clara-reception.html
public/client-interface.html         → frontend/public/client-interface.html
public/college-demo.html             → frontend/public/college-demo.html
public/staff-login.html              → frontend/public/staff-login.html
public/staff-dashboard.html          → frontend/public/staff-dashboard.html
public/staff-interface.html          → frontend/public/staff-interface.html
public/staff-neon.html               → frontend/public/staff-neon.html
public/staff-neon.css                → frontend/public/staff-neon.css
public/staff-neon.js                 → frontend/public/staff-neon.js
public/staff.html                    → frontend/public/staff.html
public/staff-script.js               → frontend/public/staff-script.js
public/staff-styles.css              → frontend/public/staff-styles.css
public/register.html                 → frontend/public/register.html
public/register-script.js            → frontend/public/register-script.js
public/register-styles.css           → frontend/public/register-styles.css
public/test-routes.html              → frontend/public/test-routes.html
public/test-call-client.html         → frontend/public/test-call-client.html
public/test-session-call.html        → frontend/public/test-session-call.html
public/timetable-container.html      → frontend/public/timetable-container.html
public/n8n-test.html                 → frontend/public/n8n-test.html
public/components/*                  → frontend/public/components/*
public/hooks/*                       → frontend/public/hooks/*
public/utils/*                       → frontend/public/utils/*
```

#### Create `/frontend/package.json`
Simple package.json to install frontend dev dependencies (Vite, etc. if needed)

---

### BACKEND MOVES

#### Models: `/models/` → `/backend/src/models/`
```
models/User.js                       → backend/src/models/User.js
models/Staff.js                      → backend/src/models/Staff.js
models/Appointment.js                → backend/src/models/Appointment.js
models/Conversation.js               → backend/src/models/Conversation.js
models/Call.js                       → backend/src/models/Call.js
models/Session.js                    → backend/src/models/Session.js
models/StaffTimetable.js             → backend/src/models/StaffTimetable.js
models/Timetable.js                  → backend/src/models/Timetable.js
models/ClassTimetable.js             → backend/src/models/ClassTimetable.js
```

#### Routes: `/routes/` → `/backend/src/routes/`
```
routes/appointments.js               → backend/src/routes/appointments.js
routes/calls.js                      → backend/src/routes/calls.js
routes/college.js                    → backend/src/routes/college.js
routes/n8n.js                        → backend/src/routes/n8n.js
routes/sessions.js                   → backend/src/routes/sessions.js
routes/timetable.js                  → backend/src/routes/timetable.js
```

#### Services: `/services/` → `/backend/src/services/`
```
services/claraAI.js                  → backend/src/services/claraAI.js
services/collegeAI.js                → backend/src/services/collegeAI.js
services/dailyService.js             → backend/src/services/dailyService.js
services/n8nService.js               → backend/src/services/n8nService.js
services/timetableQueryHandler.js    → backend/src/services/timetableQueryHandler.js
services/timetableService.js         → backend/src/services/timetableService.js
```

#### Middleware: `/middleware/` → `/backend/src/middleware/`
```
middleware/auth.js                   → backend/src/middleware/auth.js
```

#### Config: `/config/` → `/backend/src/config/`
```
config/college.js                    → backend/src/config/college.js
```

#### Main Server Files
```
server.js                            → backend/src/server.js
geminiApi.js                         → backend/src/geminiApi.js
staff-profiles.js                    → backend/src/staff-profiles.js
```

#### Scripts: `/scripts/` → `/backend/scripts/`
```
scripts/populate-staff.js            → backend/scripts/populate-staff.js
scripts/populate-staff-complete.js   → backend/scripts/populate-staff-complete.js
```

#### Backend Config
```
.env                                 → backend/.env
.env.backup                          → backend/.env.backup
env-template.txt                     → backend/env-template.txt
```

#### Deploy Config
```
vercel.json                          → backend/vercel.json (update paths)
```

---

### QUARANTINE MOVES (maliciopus-files)

#### `/maliciopus-files/duplicates/`
```
AI_RECEPTIONIST_README - Copy.md     → maliciopus-files/duplicates/
AI_RECEPTIONIST_README - Copy - Copy.md → maliciopus-files/duplicates/
README - Copy.md                     → maliciopus-files/duplicates/
```

#### `/maliciopus-files/deprecated/`
```
server-enhanced.js                   → maliciopus-files/deprecated/
```

#### `/maliciopus-files/testing/`
```
quick-test.js                        → maliciopus-files/testing/
test-complete-system.js              → maliciopus-files/testing/
test-conversation.js                 → maliciopus-files/testing/
test-http.js                         → maliciopus-files/testing/
test-integration.js                  → maliciopus-files/testing/
test-staff-connection.js             → maliciopus-files/testing/
demo-timetable.js                    → maliciopus-files/testing/
```

#### `/maliciopus-files/platform-specific/`
```
start.bat                            → maliciopus-files/platform-specific/
```

#### `/maliciopus-files/utility/`
```
setup.js                             → maliciopus-files/utility/
```

#### `/maliciopus-files/documentation/`
```
DEMO_INSTRUCTIONS.md                 → maliciopus-files/documentation/
```

---

### REMAINING FILES (Root)

```
REPO_MAP.md                          # Keep in root
RISK_REPORT.md                       # Keep in root
RESTRUCTURE_PLAN.md                  # This file
MIGRATION_LOG.md                     # Will be created
CHECKLIST.md                         # Will be created
README.md                            # Main readme
.gitignore                           # Keep in root
package.json                         # Root package.json for workspace management
package-lock.json                    # Root package-lock.json
AI_RECEPTIONIST_README.md            # Active documentation
COMPLETE_SETUP_GUIDE.md              # Active documentation
COMPLETE_SYSTEM_README.md            # Active documentation
STAFF_CONNECTION_README.md           # Active documentation
STAFF_SETUP_README.md                # Active documentation
TIMETABLE_README.md                  # Active documentation
VIDEO_CALL_README.md                 # Active documentation
N8N_INTEGRATION.md                   # Active documentation
VERCEL_DEPLOYMENT.md                 # Active documentation
VERCEL_ENV_SETUP.md                  # Active documentation
TODO.md                              # Keep for task tracking
demo-timetable-queries.md            # Documentation
manual-test-guide.md                 # Documentation
ENHANCED_STAFF_INTERFACE.md          # Documentation
FINAL_STATUS.md                      # May move to quarantine later
```

---

## 🔧 CONFIGURATION CHANGES

### Backend Config Updates

#### `/backend/src/server.js`
**Changes needed:**
1. Update static file serving path:
   ```javascript
   // OLD:
   app.use(express.static('public'));
   
   // NEW:
   app.use(express.static(path.join(__dirname, '../frontend/public')));
   ```

2. Update import paths:
   ```javascript
   // OLD:
   const User = require('./models/User');
   const ClaraAI = require('./services/claraAI');
   
   // NEW:
   const User = require('./models/User');
   const ClaraAI = require('./services/claraAI');
   // Paths stay relative within /backend/src/
   ```

3. Update route file serving (sendFile calls):
   ```javascript
   // OLD:
   res.sendFile(path.join(__dirname, 'public', 'index.html'));
   
   // NEW:
   res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
   ```

#### `/backend/vercel.json`
**Update paths:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/public/(.*)",
      "dest": "../../frontend/public/$1"
    },
    {
      "src": "/(.*)",
      "dest": "src/server.js"
    }
  ]
}
```

#### `/backend/package.json`
**Create new package.json:**
```json
{
  "name": "clara-backend",
  "version": "1.0.0",
  "description": "Backend server for Clara AI Receptionist",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "setup": "node scripts/populate-staff.js"
  },
  "dependencies": {
    "@daily-co/daily-js": "^0.82.0",
    "axios": "^1.4.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.0.0",
    "multer": "^1.4.5-lts.1",
    "qrcode": "^1.5.3",
    "socket.io": "^4.7.4",
    "socket.io-client": "^4.8.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### Frontend Config Updates

#### `/frontend/package.json`
**Create minimal package.json:**
```json
{
  "name": "clara-frontend",
  "version": "1.0.0",
  "description": "Frontend for Clara AI Receptionist",
  "scripts": {
    "serve": "npx serve public -l 3000",
    "dev": "npx live-server public --port=3000"
  },
  "devDependencies": {
    "live-server": "^1.2.2"
  }
}
```

**Note:** Frontend is vanilla HTML/JS, so no build step needed for now.

### Root Config Updates

#### Root `package.json` (Workspace Manager)
**Create or update:**
```json
{
  "name": "clara-ai-receptionist-workspace",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "install:all": "npm install && cd backend && npm install && cd ../frontend && npm install",
    "start:backend": "cd backend && npm start",
    "start:frontend": "cd frontend && npm serve",
    "dev": "concurrently \"npm run start:backend\" \"npm run start:frontend\""
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

---

## 🔗 ROUTING STRATEGY

### Development Mode

**Option 1: Separate Ports (Recommended)**
- Backend: `http://localhost:3000` (Express + Socket.IO)
- Frontend: `http://localhost:3001` (Static files)
- Frontend calls backend API via `http://localhost:3000`

**Socket.IO Connection:**
```javascript
// In frontend/public/script.js
const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling'],
  reconnection: true
});
```

**Option 2: Single Port (Current)**
- Everything: `http://localhost:3000`
- Express serves static files from `/frontend/public`
- No changes to frontend code needed

### Production (Vercel)

**Current deployment:**
- Backend runs on Vercel with `@vercel/node`
- Static files served via Express static middleware
- Keep this approach for simplicity

**Future:**
- Split frontend/backend to separate Vercel projects
- Use Vercel deployments for frontend
- Use Vercel serverless functions for backend

---

## 🔐 ENVIRONMENT VARIABLES

### Backend `.env` (`/backend/.env`)
```env
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

### Frontend `.env.local` (If needed in future)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 🧪 TESTING STRATEGY

### Local Development

**Backend:**
```bash
cd backend
npm install
npm run dev  # Runs nodemon
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev  # Runs live-server
```

**Both:**
```bash
# From root
npm run dev  # Runs both concurrently
```

### Production Build

**Currently:** No build step (vanilla HTML/JS)

**If adding build tools later:**
- Frontend: Vite/Webpack for bundling
- Backend: No build needed (Node.js runs directly)

---

## 🚨 BREAKING CHANGES TO AVOID

1. **Don't change:** API routes, Socket.IO events, database schemas
2. **Don't delete:** Any production code
3. **Don't rename:** Routes, API endpoints
4. **Do test:** All features after moves

---

## 📋 IMPORT PATH UPDATES

### Within Backend (`/backend/src/`)

All imports stay the same because relative paths don't change:
```javascript
// These all work as-is
const User = require('./models/User');
const ClaraAI = require('./services/claraAI');
const auth = require('./middleware/auth');
```

### Root-Level Imports

Files that import from backend:
- None currently (everything is self-contained)

---

## 🎯 VALIDATION CHECKLIST

After restructure:
- [ ] Backend starts without errors
- [ ] Frontend serves correctly
- [ ] Socket.IO connects
- [ ] All API routes respond
- [ ] Static files load (CSS, JS)
- [ ] No 404s in console
- [ ] MongoDB connects
- [ ] Authentication works
- [ ] Video calls work
- [ ] QR codes generate
- [ ] No duplicate files in wrong places

---

## 📦 DEPENDENCY MANAGEMENT

### Current State
- Single `node_modules` in root
- Shared dependencies

### New State
- Backend has own `node_modules`
- Frontend has own `node_modules` (if adding tools)
- Root can manage both via workspace scripts

---

**END OF RESTRUCTURE PLAN**

