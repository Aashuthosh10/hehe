# 🚀 Render Deployment Guide - Clara AI Reception System

## Why Render Over Vercel?

Your CLARA AI project **requires** a persistent server environment for these critical features:

✅ **Socket.IO Real-time Communication** - Doesn't work on serverless  
✅ **WebRTC Video Calling** - Needs persistent WebSocket connections  
✅ **In-Memory State Management** - Current sessions, calls, staff tracking  
✅ **Long-running AI Processing** - Gemini API calls can take time  
✅ **Live Staff Availability** - Real-time status updates  

**Vercel is serverless** - your WebSocket features WILL NOT work there.

---

## 🎯 Quick Start (5 Minutes)

### Step 1: Get Environment Variables Ready

Before deploying, gather these values:

#### 1️⃣ GEMINI_API_KEY (Required for AI)
```
Visit: https://aistudio.google.com/
Click: Get API Key → Create API Key
Copy: Your API key
```

#### 2️⃣ MONGODB_URI (Optional but Recommended)
```
Visit: https://www.mongodb.com/atlas
Sign up: Free account
Create: Free cluster
Connect: Copy connection string
Replace: <password> with your actual password
```

**Important:** In MongoDB Atlas Network Access:
- Click "Add IP Address"
- Add `0.0.0.0/0` (allow all IPs)

#### 3️⃣ JWT_SECRET (Required for Authentication)
```bash
# Run in your terminal:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the generated random string

---

### Step 2: Deploy to Render

#### Option A: GitHub Integration (Recommended)

1. **Your code is already on GitHub** ✅
   - Repository: `https://github.com/Aashuthosh10/hehe.git`

2. **Sign up on Render**
   - Go to [render.com](https://render.com)
   - Click "Get Started for Free"
   - Sign up with your **GitHub account**

3. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect GitHub if prompted
   - Select repository: `hehe`
   - Click "Connect"

4. **Configure Service**
   ```
   Name: clara-ai-reception
   Environment: Node
   Branch: master
   Build Command: npm install
   Start Command: npm start
   Plan: Free (or Starter $7/month for always-on)
   ```

5. **Add Environment Variables**
   Click "Advanced" → "Add Environment Variable" for each:
   
   **Required:**
   ```
   NODE_ENV = production
   GEMINI_API_KEY = your_gemini_api_key_here
   MONGODB_URI = mongodb+srv://user:pass@cluster.mongodb.net/clara_db
   JWT_SECRET = your_jwt_secret_here
   JWT_EXPIRES_IN = 24h
   ```
   
6. **Deploy**
   - Click "Create Web Service"
   - Wait ~2-5 minutes for first build
   - Your app will be live! 🎉

#### Option B: Render Blueprint (Even Faster)

Your `render.yaml` file is already configured! Just:

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will auto-detect `render.yaml`
5. Add environment variables when prompted
6. Deploy!

---

## 🔗 Your Live URLs

After deployment, access:

- **Main App:** `https://clara-ai-reception.onrender.com`
- **Health Check:** `https://clara-ai-reception.onrender.com/api/health`
- **Staff Login:** `https://clara-ai-reception.onrender.com/staff-login`
- **Staff Dashboard:** `https://clara-ai-reception.onrender.com/staff-dashboard`

---

## 💰 Pricing Plans

### Free Tier (For Testing)
```
✅ 500 build minutes/month
✅ 750 hours runtime/month  
❌ Sleeps after 15 minutes inactive
❌ 512 MB RAM
⚠️ First request after sleep takes ~30 seconds
```

### Starter Plan ($7/month) - **RECOMMENDED**
```
✅ Always-on (no sleep!)
✅ 512 MB RAM
✅ 100 GB bandwidth/month
✅ Priority support
✅ Perfect for production
```

**When to Upgrade:**
- When you need 24/7 availability
- When users complain about slow starts
- When you're ready for production

---

## 🐛 Troubleshooting

### Build Fails

**Problem:** Deployment fails during build
```
Solution:
1. Check Render build logs
2. Ensure all dependencies are in package.json
3. Verify Node.js version compatibility
```

### App "Sleeps" (Free Tier)

**Problem:** First request after sleep takes 30+ seconds
```
Solution:
- This is normal for free tier
- Upgrade to Starter ($7/month) for always-on
- Or: Make a request every 10 minutes to keep it awake
```

### MongoDB Connection Errors

**Problem:** Can't connect to database
```
Solutions:
1. Verify MONGODB_URI is correct
2. Check MongoDB Atlas → Network Access
   Add IP: 0.0.0.0/0 (allow all)
3. Verify username/password in connection string
4. Check MongoDB Atlas logs for connection attempts
```

### Socket.IO Not Working

**Problem:** Real-time features don't work
```
Solutions:
1. Check Render logs for WebSocket errors
2. Verify NODE_ENV is set to "production"
3. Check CORS settings in server.js
4. Clear browser cache and hard refresh
```

### Microphone Not Working

**Problem:** Speech recognition doesn't work
```
Solutions:
1. Grant microphone permission in browser
2. Use Chrome, Edge, or Safari (best support)
3. Check HTTPS is working (Render provides SSL)
4. Open browser console for error messages
5. Verify SpeechRecognition API is supported
```

### AI Responses Are Slow

**Problem:** Gemini AI calls take too long
```
Solutions:
1. Check Gemini API quota limits
2. Review Render logs for API errors
3. Consider upgrading Render plan for more resources
4. Verify GEMINI_API_KEY is valid
```

---

## 📊 Monitoring

### View Logs
```
Dashboard → clara-ai-reception → Logs
```

### Check Metrics
```
Dashboard → clara-ai-reception → Metrics
- CPU Usage
- Memory Usage
- Request Count
- Response Times
```

### Health Check
```
Visit: https://clara-ai-reception.onrender.com/api/health
Expected Response: 
{
  "status": "OK",
  "timestamp": "...",
  "connectedUsers": 0
}
```

---

## 🔒 Custom Domain (Optional)

Want to use your own domain instead of `.onrender.com`?

1. **Buy a domain** (Namecheap, GoDaddy, etc.)
2. **Add to Render:**
   - Dashboard → Your Service → Settings
   - Custom Domains → Add
   - Enter your domain
3. **Update DNS:**
   Render will provide DNS records to add
4. **Wait:** SSL certificate auto-provisioned (free!)

---

## 🔄 Continuous Deployment

**Auto-deploy is ON by default:**
- Push to `master` branch → Auto-deploys
- Push to `development` → Creates preview deployment
- Rollback anytime from Render dashboard

---

## 🆚 Render vs Vercel for Your App

| Feature | Vercel (Serverless) | Render (Persistent) |
|---------|-------------------|-------------------|
| Socket.IO | ❌ Won't Work | ✅ Perfect |
| WebRTC | ❌ Not Reliable | ✅ Reliable |
| 24/7 Availability | ✅ | ✅ (Paid) |
| Free Tier | ✅ | ✅ |
| Always-On | ✅ | ❌ (Free) |
| Pricing | $$ | $ |
| Easy Setup | ✅ | ✅ |

**Winner for CLARA AI: RENDER** 🏆

---

## 📝 Environment Variables Summary

Copy-paste checklist:

```
□ NODE_ENV = production
□ GEMINI_API_KEY = [from Google AI Studio]
□ MONGODB_URI = [from MongoDB Atlas]
□ JWT_SECRET = [generate with Node crypto]
□ JWT_EXPIRES_IN = 24h
□ N8N_WEBHOOK_URL = [optional]
□ N8N_API_KEY = [optional]
□ DAILY_API_KEY = [optional]
□ DAILY_DOMAIN = [optional]
```

---

## 🎓 Next Steps

1. ✅ Deploy to Render (this guide!)
2. ✅ Test all features (chat, video, staff login)
3. ⬜ Monitor performance in first week
4. ⬜ Upgrade to Starter plan when ready for production
5. ⬜ Add custom domain (optional)
6. ⬜ Set up monitoring/alerts

---

## 🆘 Need Help?

- **Render Docs:** [render.com/docs](https://render.com/docs)
- **Render Status:** [status.render.com](https://status.render.com)
- **Your Repo:** [github.com/Aashuthosh10/hehe](https://github.com/Aashuthosh10/hehe)

---

## ✨ Success!

Your CLARA AI Reception System is now live on Render with full WebSocket support! 🎉

**Share your deployment URL with the team:**
`https://clara-ai-reception.onrender.com`

