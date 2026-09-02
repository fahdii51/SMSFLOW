/**
 * API Configuration
 * Determines the base URL for API calls based on environment
 */

export const getApiBaseUrl = (): string => {
  // Always use relative paths. On Vercel, vercel.json rewrites `/auth/*` and
  // `/api/*` to the serverless function on the SAME origin, so relative paths
  // work identically in local dev, preview, and production.
  //
  // Using an absolute VITE_APP_URL here caused cross-origin requests: if that
  // value was stale, used the wrong scheme/domain, or pointed at a protected
  // deployment, the browser `fetch` threw before any response and surfaced as
  // "Connection error to server" on sign in / sign up. Relative paths are
  // immune to that entire class of failure.
  return '';
};

/**
 * Helper function to build absolute URLs
 */
const buildUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return path;
  }
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return cleanBase + cleanPath;
};

/**
 * Helper function for fetch requests with proper URL handling
 */
const fetchApi = async (path: string, options?: RequestInit) => {
  const url = buildUrl(path);
  return fetch(url, options);
};

export const apiClient = {
  // ==========================================
  // AUTH ENDPOINTS
  // ==========================================
  
  login: async (email: string, password: string) => {
    return fetchApi('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
  },

  register: async (email: string, password: string, fullName: string) => {
    return fetchApi('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName })
    });
  },

  verifyOtp: async (email: string, otp: string) => {
    return fetchApi('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
  },

  forgotPassword: async (email: string) => {
    return fetchApi('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    return fetchApi('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, new_password: newPassword })
    });
  },

  googleAuth: async (email: string, name: string, idToken: string) => {
    return fetchApi('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, id_token: idToken })
    });
  },

  // ==========================================
  // CLIENT ENDPOINTS
  // ==========================================
  
  getClientWallet: async (token: string) => {
    return fetchApi('/api/client/wallet', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getClientActivations: async (token: string) => {
    return fetchApi('/api/client/activations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getMailActivations: async (token: string) => {
    return fetchApi('/api/client/mail-activations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getClientTransactions: async (token: string) => {
    return fetchApi('/api/client/transactions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getFacebookIds: async (token: string) => {
    return fetchApi('/api/client/facebook-ids', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getClientDeposits: async (token: string) => {
    return fetchApi('/api/client/deposits', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  expireActivations: async () => {
    return fetchApi('/api/expire-activations', { method: 'POST' });
  },

  checkStatus: async (token: string, body: any) => {
    return fetchApi('/api/check-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  },

  checkMailStatus: async (token: string, body: any) => {
    return fetchApi('/api/check-mail-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  },

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================
  
  getAdminDashboard: async (token: string) => {
    return fetchApi('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getAdminClients: async (token: string) => {
    return fetchApi('/api/admin/clients', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getServices: async () => {
    return fetchApi('/api/services');
  },

  getAdminDeposits: async (token: string) => {
    return fetchApi('/api/admin/deposits', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getAdminFbIds: async (token: string) => {
    return fetchApi('/api/admin/fb-ids', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getAdminLogs: async (token: string) => {
    return fetchApi('/api/admin/logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  getAdminSettings: async (token: string) => {
    return fetchApi('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  updateAdminSettings: async (token: string, body: any) => {
    return fetchApi('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  },

  adjustBalance: async (token: string, body: any) => {
    return fetchApi('/api/admin/adjust-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  },

  toggleService: async (token: string, body: any) => {
    return fetchApi('/api/admin/toggle-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  },

  updateFbIds: async (token: string, body: any) => {
    return fetchApi('/api/admin/fb-ids', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  },

  deleteActivation: async (token: string, id: string) => {
    return fetchApi(`/api/admin/delete-activation/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  },

  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================
  
  getOtpByToken: async (token: string) => {
    return fetchApi('/api/otp-by-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  },

  // Generic fetch helper for any endpoint
  fetch: fetchApi,
};

export default apiClient;

