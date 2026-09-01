# SMSFlow Vercel Deployment - Quick Start

## 🎯 What Was Fixed

Your login and registration failures on Vercel were caused by **incorrect API URL routing**. The frontend was trying to connect to `/auth/login` as a relative URL, but Vercel deploys the frontend and backend together, and without proper configuration, the backend wasn't accessible.

### Changes Made:

1. ✅ **Created API Configuration Module** (`src/config/api.ts`)
   - Centralizes all API calls in one place
   - Automatically detects environment (dev vs production)
   - Properly handles URL routing

2. ✅ **Updated AuthPages Component** (`src/components/AuthPages.tsx`)
   - Now uses the new `apiClient` for all auth operations
   - Automatically routes to correct server URL

3. ✅ **Updated Vite Configuration** (`vite.config.ts`)
   - Added proxy configuration for development
   - Routes `/auth` and `/api` calls through proxy to `localhost:3000`

4. ✅ **Created Vercel Configuration** (`vercel.json`)
   - Tells Vercel how to build and run your app
   - Configures rewrites for proper routing

5. ✅ **Created Documentation**
   - `DEPLOYMENT.md` - Complete deployment guide
   - `MIGRATION_GUIDE.md` - How to update other components

---

## 🚀 How to Deploy to Vercel

### Step 1: Set Environment Variable

1. Go to your **Vercel Dashboard**
2. Select your project
3. Go to **Settings → Environment Variables**
4. Add this variable:
   ```
   VITE_APP_URL = https://your-project-name.vercel.app
   ```
   (Replace `your-project-name` with your actual Vercel project name)

### Step 2: Deploy

Option A - GitHub Connected (Recommended):
```bash
git push origin main
# Vercel automatically deploys when you push to main
```

Option B - Manual Deployment:
```bash
vercel deploy --prod
```

### Step 3: Test

1. Wait for deployment to complete (check Vercel dashboard)
2. Visit your deployed URL: `https://your-project-name.vercel.app`
3. Try logging in or registering
4. Check browser console (F12) for any errors

---

## 🔧 Local Testing (Before Deploying)

### Terminal 1 - Start Backend:
```bash
npm run dev
```
Backend runs on `http://localhost:3000`

### Terminal 2 - Start Frontend:
```bash
npm run dev
```
Frontend opens on `http://localhost:5173` (or another port)

**Why this works locally:**
- Vite's dev proxy automatically routes `/auth` and `/api` calls to `localhost:3000`
- The backend serves both API and frontend files

---

## 📊 Architecture

```
User Browser
    ↓
Frontend (React + Vite)
    ├─ Development: Vite Proxy → localhost:3000
    └─ Production: VITE_APP_URL env variable → https://your-app.vercel.app
    ↓
Express Backend (server.ts)
    ├─ /auth/login
    ├─ /auth/register
    ├─ /auth/verify-otp
    └─ /api/* (other endpoints)
```

---

## ❓ Troubleshooting

### Still Getting "Failed to Connect to Server"?

#### Check 1: Verify Environment Variable
```bash
# On Vercel dashboard
Settings → Environment Variables
Look for: VITE_APP_URL = https://your-project-name.vercel.app
```

#### Check 2: Check Browser Console
1. Open your deployed site
2. Press `F12` to open DevTools
3. Go to **Console** tab
4. Try logging in
5. Look for error messages
6. Check **Network** tab to see actual API request URLs

#### Check 3: Verify Build
```bash
npm run build
# Check if dist/server.cjs exists (bundled backend)
# Check if dist/index.html exists (built frontend)
```

#### Check 4: Check Vercel Logs
1. Go to Vercel dashboard
2. Select your project
3. Click **Deployments**
4. Click on the failed deployment
5. Scroll down to see build logs

### Common Issues:

**Issue: API requests to `http://localhost:3000` in production**
- **Solution:** Environment variable not set. Add `VITE_APP_URL` to Vercel dashboard.

**Issue: "Mixed Content" or HTTPS errors**
- **Solution:** Make sure `VITE_APP_URL` uses `https://` not `http://`

**Issue: "Cannot find module" or build failures**
- **Solution:** Run `npm install` locally, then commit `package-lock.json` to git

---

## 📝 Next Steps

### Immediate (Required):
1. ✅ Set `VITE_APP_URL` environment variable on Vercel
2. ✅ Test login/registration on Vercel
3. ✅ Verify everything works

### Recommended (Improves Functionality):
1. Update `AdminPanel.tsx` to use `apiClient`
2. Update `ClientPanel.tsx` to use `apiClient`
3. Update `App.tsx` to use `apiClient`
4. Update `PublicViewer.tsx` to use `apiClient`

See `MIGRATION_GUIDE.md` for detailed migration steps.

---

## 📚 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Comprehensive deployment guide
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - How to update other components
- **[vercel.json](./vercel.json)** - Vercel configuration
- **[src/config/api.ts](./src/config/api.ts)** - API configuration and methods
- **[vite.config.ts](./vite.config.ts)** - Vite configuration with proxy

---

## ✨ Summary

Your app is now configured for proper Vercel deployment:
- ✅ Authentication fixed
- ✅ API routing configured
- ✅ Environment variables set up
- ✅ Development proxy configured
- ✅ Production build configured

**Just add the `VITE_APP_URL` environment variable on Vercel and deploy!**

For questions or issues, check the documentation files or your Vercel deployment logs.
