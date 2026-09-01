# Deployment Guide - SMSFlow on Vercel

This guide explains how to fix login/registration issues when deploying SMSFlow to Vercel.

## The Problem

On Vercel, the frontend and backend are deployed together, but they need to know how to communicate. By default, the frontend tries to connect to `/auth/login` which is a relative URL that won't work if:
- The backend server isn't running on the same domain
- There's a mismatch between development and production configurations

## The Solution

The application has been updated with proper environment configuration. Here's what was fixed:

### 1. **API Configuration File** (`src/config/api.ts`)
   - Created a centralized API client that handles URL routing
   - In development: Vite proxy routes requests to `localhost:3000`
   - In production: Uses the `VITE_APP_URL` environment variable

### 2. **Updated Components** 
   - All authentication components now use the `apiClient` configuration
   - Automatically switches between development and production modes

### 3. **Vite Configuration Updates** (`vite.config.ts`)
   - Added proxy configuration for `/auth` and `/api` routes
   - Development requests route through proxy → `localhost:3000`
   - Production requests use configured `VITE_APP_URL`

### 4. **Vercel Configuration** (`vercel.json`)
   - Configured build and output settings
   - Set up rewrites for API routes

## Deployment Steps

### Step 1: Set Environment Variables on Vercel

1. Go to your Vercel project settings
2. Navigate to **Settings → Environment Variables**
3. Add the following variable:
   ```
   VITE_APP_URL=https://your-project.vercel.app
   ```
   (Replace `your-project` with your actual Vercel project name)

### Step 2: Ensure Correct Build Configuration

Verify your project has these build settings:
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Start Command:** `npm start`

(These should be auto-detected from `package.json` and `vercel.json`)

### Step 3: Deploy

```bash
vercel deploy --prod
```

Or push to your connected Git repository to trigger automatic deployment.

## Local Development

For local testing:

1. **Terminal 1 - Start Backend:**
   ```bash
   npm run dev
   ```
   This starts the Express server on `http://localhost:3000`

2. **Terminal 2 - Start Frontend (with Vite):**
   ```bash
   npm run dev
   ```
   Vite will automatically proxy API calls to the backend

The frontend will be available at `http://localhost:5173` (or another port if 5173 is busy).

## Troubleshooting

### Still Getting "Failed to Connect to Server"

1. **Check Environment Variable:**
   - Verify `VITE_APP_URL` is set correctly in Vercel dashboard
   - It should be your full Vercel domain: `https://your-app.vercel.app`

2. **Check Browser Console:**
   - Open DevTools (F12) → Console
   - Look for the exact error message
   - Check Network tab to see where requests are going

3. **Verify Backend is Running:**
   - The Express backend in `server.ts` must be running
   - Check that the build successfully bundled the server: `dist/server.cjs` should exist

4. **CORS Issues:**
   - Check that CORS is properly configured in `server.ts`
   - The server accepts requests from any origin (`*`)

### Building Locally

To test the production build locally:

```bash
npm run build
npm start
```

Then visit `http://localhost:3000` (or whatever port is configured).

## Architecture Overview

```
Frontend (React/Vite)
    ↓
API Calls via apiClient
    ├─ Development: Vite Proxy (localhost:3000)
    └─ Production: VITE_APP_URL Environment Variable
    ↓
Express Backend (server.ts)
    ├─ /auth/login
    ├─ /auth/register
    ├─ /auth/verify-otp
    └─ ... other endpoints
```

## Additional Notes

- The `apiClient` in `src/config/api.ts` provides typed, centralized API methods
- Environment variables use the `VITE_` prefix for frontend access
- Backend and frontend are bundled together and deployed as one
- The server can be deployed to Vercel's serverless infrastructure

For more help, check the browser console for specific error messages and the Vercel deployment logs.
