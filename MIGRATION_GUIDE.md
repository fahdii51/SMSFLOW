# API Migration Guide - Using apiClient

This guide shows how to update your components to use the new `apiClient` for proper Vercel deployment.

## What Changed

Previously, components used relative URLs with `fetch()`:
```typescript
const res = await fetch('/api/client/wallet', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

Now, use the centralized `apiClient`:
```typescript
const res = await apiClient.getClientWallet(token);
```

## Benefits

✅ Automatic environment detection (dev vs production)  
✅ Proper URL handling for Vercel deployments  
✅ Consistent error handling  
✅ Type-safe API methods  
✅ Single point of configuration  

## Migration Steps

### Step 1: Import apiClient

```typescript
import { apiClient } from '../config/api';
```

### Step 2: Replace API Calls

#### Before (AuthPages - Already Fixed)
```typescript
const res = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

#### After (AuthPages - Already Fixed)
```typescript
const res = await apiClient.login(email, password);
```

---

## Component Update Examples

### App.tsx - Wallet API

**Before:**
```typescript
const res = await fetch('/api/client/wallet', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

**After:**
```typescript
const res = await apiClient.getClientWallet(token);
```

---

### AdminPanel.tsx - Multiple Endpoints

#### Dashboard
```typescript
// Before
const res = await fetch('/api/admin/dashboard', { 
  headers: { 'Authorization': `Bearer ${token}` } 
});

// After
const res = await apiClient.getAdminDashboard(token);
```

#### Clients List
```typescript
// Before
const res = await fetch('/api/admin/clients', { 
  headers: { 'Authorization': `Bearer ${token}` } 
});

// After
const res = await apiClient.getAdminClients(token);
```

#### Settings
```typescript
// Before
const res = await fetch('/api/admin/settings', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});

// After
const res = await apiClient.getAdminSettings(token);
```

#### Update Settings
```typescript
// Before
const res = await fetch('/api/admin/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(bodyData)
});

// After
const res = await apiClient.updateAdminSettings(token, bodyData);
```

#### Adjust Balance
```typescript
// Before
const res = await fetch('/api/admin/adjust-balance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(bodyData)
});

// After
const res = await apiClient.adjustBalance(token, bodyData);
```

#### Delete Activation
```typescript
// Before
const res = await fetch(`/api/admin/delete-activation/${id}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});

// After
const res = await apiClient.deleteActivation(token, id);
```

---

### ClientPanel.tsx - Client Operations

#### Get Activations
```typescript
// Before
const res = await fetch('/api/client/activations', { 
  headers: { 'Authorization': `Bearer ${token}` } 
});

// After
const res = await apiClient.getClientActivations(token);
```

#### Check Status
```typescript
// Before
await fetch('/api/check-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(statusData)
});

// After
await apiClient.checkStatus(token, statusData);
```

#### Check Mail Status
```typescript
// Before
await fetch('/api/check-mail-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(mailData)
});

// After
await apiClient.checkMailStatus(token, mailData);
```

#### Expire Activations
```typescript
// Before
fetch('/api/expire-activations', { method: 'POST' });

// After
apiClient.expireActivations();
```

---

### PublicViewer.tsx - OTP Lookup

```typescript
// Before
const res = await fetch('/api/otp-by-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
});

// After
const res = await apiClient.getOtpByToken(token);
```

---

## Complete API Method Reference

### Authentication
- `apiClient.login(email, password)`
- `apiClient.register(email, password, fullName)`
- `apiClient.verifyOtp(email, otp)`
- `apiClient.forgotPassword(email)`
- `apiClient.resetPassword(email, otp, newPassword)`
- `apiClient.googleAuth(email, name, idToken)`

### Client
- `apiClient.getClientWallet(token)`
- `apiClient.getClientActivations(token)`
- `apiClient.getMailActivations(token)`
- `apiClient.getClientTransactions(token)`
- `apiClient.getFacebookIds(token)`
- `apiClient.getClientDeposits(token)`
- `apiClient.checkStatus(token, data)`
- `apiClient.checkMailStatus(token, data)`
- `apiClient.expireActivations()`

### Admin
- `apiClient.getAdminDashboard(token)`
- `apiClient.getAdminClients(token)`
- `apiClient.getServices()`
- `apiClient.getAdminDeposits(token)`
- `apiClient.getAdminFbIds(token)`
- `apiClient.getAdminLogs(token)`
- `apiClient.getAdminSettings(token)`
- `apiClient.updateAdminSettings(token, data)`
- `apiClient.adjustBalance(token, data)`
- `apiClient.toggleService(token, data)`
- `apiClient.updateFbIds(token, data)`
- `apiClient.deleteActivation(token, id)`

### Public
- `apiClient.getOtpByToken(token)`

### Generic
- `apiClient.fetch(path, options)` - For custom endpoints

## Adding New Endpoints

To add new API endpoints to `apiClient`:

```typescript
// In src/config/api.ts
export const apiClient = {
  // ... existing methods ...
  
  // New custom endpoint
  customEndpoint: async (token: string, customData: any) => {
    return fetchApi('/api/custom-endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(customData)
    });
  }
};
```

Then use it in your component:
```typescript
const res = await apiClient.customEndpoint(token, data);
```

## Testing

### Local Development
```bash
npm run dev
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
# Vite proxy automatically routes /api and /auth to backend
```

### Production Build
```bash
npm run build
npm start
# Opens on http://localhost:3000
# Uses dist/server.cjs (bundled server)
```

## Troubleshooting

### URLs Not Resolving Correctly

Check that `VITE_APP_URL` is set in your Vercel environment variables:
```
VITE_APP_URL=https://your-app.vercel.app
```

### Mixed HTTP/HTTPS Issues

If you get mixed content errors:
- Ensure `VITE_APP_URL` uses `https://` in production
- Check browser console for exact error URLs

### Localhost Still Trying to Connect in Prod

- Verify `import.meta.env.PROD` is true in production build
- Check that environment variables are correctly injected
- Confirm build command runs `npm run build`

## Priority: Update These First

For the most critical fixes (login/registration issues):
1. ✅ **AuthPages.tsx** - Already updated
2. AdminPanel.tsx - Next priority
3. ClientPanel.tsx - Important for user functionality
4. App.tsx - Important for wallet display
5. PublicViewer.tsx - For public endpoints

## Questions?

If you encounter any issues:
1. Check browser DevTools Console for errors
2. Check Network tab to see actual API request URLs
3. Verify environment variables in Vercel dashboard
4. Check Vercel deployment logs for build errors
