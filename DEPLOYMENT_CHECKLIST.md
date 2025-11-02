# 🚀 CLARA AI Deployment Checklist

## ✅ Quick Reference

### For Production (Recommended): **Render**
- Best for: Socket.IO, WebRTC, Real-time features
- Setup: 5 minutes
- Cost: Free → $7/month
- Guide: See `docs/RENDER_DEPLOYMENT.md`

### For Testing Only: Vercel (Limited)
- ⚠️ **Socket.IO will NOT work**
- ⚠️ **Microphone may not work**
- ⚠️ **WebRTC will fail**
- Setup: See `docs/VERCEL_DEPLOYMENT.md`

---

## 🎯 Render Deployment (5 Minutes)

### Prerequisites Needed:
1. ✅ GitHub repository: `Aashuthosh10/hehe.git`
2. ✅ Gemini API key: [Get here](https://aistudio.google.com/)
3. ✅ MongoDB Atlas URI (optional): [Get here](https://mongodb.com/atlas)
4. ✅ JWT Secret: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Quick Steps:

1. **Go to** [render.com](https://render.com) → Sign up with GitHub
2. **Click** "New +" → "Blueprint" 
3. **Connect** your GitHub repository `hehe`
4. **Add environment variables:**
   ```
   GEMINI_API_KEY = your_key_here
   MONGODB_URI = mongodb+srv://...
   JWT_SECRET = generated_secret
   JWT_EXPIRES_IN = 24h
   ```
5. **Deploy** and wait ~2 minutes
6. **Done!** Your app is live with WebSocket support

**Full Guide:** `docs/RENDER_DEPLOYMENT.md`

---

## 📋 What's Been Fixed

✅ **render.yaml** - Blueprint for one-click deployment  
✅ **RENDER_DEPLOYMENT.md** - Complete deployment guide  
✅ **server.js** - Fixed startup logic for Render  
✅ **Repository organized** - All docs in /docs folder  

---

## 🆘 Troubleshooting

### Microphone Not Working?
→ **Use Render, not Vercel.** WebSocket features don't work on serverless.

### Socket.IO Not Connecting?
→ You're on Vercel. Move to Render.

### Build Fails on Render?
→ Check logs. Usually a missing environment variable.

---

## 📞 Support

- **Render Guide:** `docs/RENDER_DEPLOYMENT.md`
- **Vercel Guide:** `docs/VERCEL_DEPLOYMENT.md` (limited support)
- **Your Repo:** https://github.com/Aashuthosh10/hehe

---

## ✨ Next Steps

1. Deploy to Render using the guide above
2. Test all features (chat, video, mic, staff login)
3. Upgrade to $7/month Starter plan for 24/7 availability
4. Add custom domain if needed

**Your deployment URL will be:** `https://clara-ai-reception.onrender.com`

