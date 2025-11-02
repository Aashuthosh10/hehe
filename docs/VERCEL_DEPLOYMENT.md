# Vercel Deployment Guide

This guide will help you deploy the CLARA AI Reception System to Vercel.

## ⚠️ Important Notes

1. **Socket.IO Limitations**: This app uses Socket.IO for real-time features (chat, video calls). While Vercel supports WebSockets, some features may have limitations in serverless environments.

2. **Environment Variables Required**: You need to configure environment variables in Vercel for the app to function properly.

3. **MongoDB**: You'll need a MongoDB Atlas account for database connections.

## 🚀 Deployment Steps

### 1. Push Your Code to GitHub

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin master
```

### 2. Import Project to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository `Aashuthosh10/hehe`
4. Vercel will auto-detect the project settings

### 3. Configure Environment Variables

In your Vercel project settings, add these environment variables:

#### Required for AI Features:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

#### Required for Database:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/clara_db
```

#### Required for Authentication:
```
JWT_SECRET=your_secure_random_secret_key_here
JWT_EXPIRES_IN=24h
```

#### Optional (for n8n integration):
```
N8N_WEBHOOK_URL=your_n8n_webhook_url
N8N_API_KEY=your_n8n_api_key
```

#### Optional (for Daily.co video calls):
```
DAILY_API_KEY=your_daily_api_key
DAILY_DOMAIN=your_daily_domain
```

### 4. Deploy

Click "Deploy" and wait for the build to complete.

## 🔧 Testing After Deployment

After deployment, test these URLs:

- **Main Interface**: `https://your-project.vercel.app/`
- **Staff Login**: `https://your-project.vercel.app/staff-login`
- **Staff Dashboard**: `https://your-project.vercel.app/staff-dashboard`
- **College Demo**: `https://your-project.vercel.app/college-demo`
- **Health Check**: `https://your-project.vercel.app/api/health`

## 🐛 Troubleshooting

### "Cannot GET /" Error
- ✅ Fixed by adding root route in server.js

### MongoDB Connection Errors
- Make sure your MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- Verify your MONGODB_URI is correct
- The app will run in demo mode if MongoDB is not configured

### Socket.IO Issues
- Some real-time features may not work perfectly on serverless
- Consider using a dedicated server for production with heavy WebSocket usage

### API Errors
- Check that GEMINI_API_KEY is set correctly
- Check Vercel function logs for detailed error messages

## 📝 Additional Configuration

### Custom Domain
1. Go to Vercel Project Settings > Domains
2. Add your custom domain
3. Configure DNS as instructed

### Environment-Specific Variables
You can set different values for:
- Production
- Preview
- Development

## 🎯 Production Recommendations

For a production deployment, consider:

1. **Database**: Use MongoDB Atlas with proper security settings
2. **CDN**: Vercel automatically handles static file serving
3. **Monitoring**: Add error tracking (Sentry, etc.)
4. **Rate Limiting**: Already configured in the app
5. **WebSocket Server**: For heavy real-time usage, consider a dedicated Socket.IO server

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review application logs in Vercel dashboard
3. Test locally first with same environment variables
4. Check MongoDB Atlas connection logs

