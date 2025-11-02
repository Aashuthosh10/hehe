# Vercel Environment Variables Setup - QUICK GUIDE

## ⚡ CRITICAL: Add these environment variables in Vercel NOW

To make Clara AI work fully on Vercel, you MUST add these environment variables:

### Step 1: Go to Vercel Dashboard
1. Visit https://vercel.com
2. Select your project: `hehe`
3. Go to **Settings** → **Environment Variables**

### Step 2: Add REQUIRED Variables

Add these variables one by one:

#### 1. GEMINI_API_KEY (REQUIRED for AI Chat)
```
Name: GEMINI_API_KEY
Value: [Your actual Gemini API key from Google AI Studio]
```

**How to get Gemini API Key:**
1. Go to https://aistudio.google.com/
2. Sign in with your Google account
3. Click "Get API Key" in the left sidebar
4. Create a new API key
5. Copy the key and paste it as the value

#### 2. MONGODB_URI (Optional but Recommended)
```
Name: MONGODB_URI
Value: mongodb+srv://username:password@cluster.mongodb.net/clara_db
```

**How to get MongoDB URI:**
1. Go to https://www.mongodb.com/atlas
2. Create a free account
3. Create a free cluster
4. Click "Connect" → "Connect your application"
5. Copy the connection string
6. Replace `<password>` with your database password

#### 3. JWT_SECRET (Required for Authentication)
```
Name: JWT_SECRET
Value: [Any random string, at least 32 characters long]
```

**How to generate:**
```bash
# Run this command in terminal:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Save and Redeploy

1. **Click "Save"** for each environment variable
2. Go to **Deployments** tab
3. Click the **3 dots** on the latest deployment
4. Click **Redeploy**
5. Wait for deployment to complete

### Step 4: Test

Visit your Vercel URL and try chatting with Clara. It should now work fully!

## 🔑 Summary of Minimum Required Variables

For **BASIC functionality** (AI chat works):
- `GEMINI_API_KEY` ✅ CRITICAL

For **FULL functionality** (AI chat + database features):
- `GEMINI_API_KEY` ✅ CRITICAL
- `MONGODB_URI` ✅ RECOMMENDED  
- `JWT_SECRET` ✅ REQUIRED for staff login

## 🚫 What Happens Without Variables?

- ❌ **No GEMINI_API_KEY**: AI chat will fail, error messages will appear
- ❌ **No MONGODB_URI**: App works but conversation history won't be saved
- ❌ **No JWT_SECRET**: Staff authentication features won't work

## ✅ Quick Copy-Paste Checklist

Copy each variable name, paste in Vercel, add the value:

- [ ] GEMINI_API_KEY
- [ ] MONGODB_URI (optional)
- [ ] JWT_SECRET

## 🆘 Still Not Working?

1. Check Vercel deployment logs for errors
2. Make sure you clicked "Redeploy" after adding variables
3. Clear your browser cache and reload
4. Check that variable names are EXACTLY as shown (case-sensitive)

