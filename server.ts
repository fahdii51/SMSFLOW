import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { db, hashPassword } from './server/db';
import { providerApiCall, mailApiCall, shortenUrl, extractStockCount, isKeyConfigured, getOtpApiKey, getVsimproApiKey } from './server/external-apis';
import crypto from 'crypto';

interface CountryConfig {
  name: string;
  countryId: string | number;
  maxPrice: number;
  minPrice?: number;
  sell: number;
  provider: 'smsbower' | 'vsimpro';
  providerId?: string | number;
}

// Initialize express app
const app = express();
export { app };
export default app;
const PORT = 3000;

// Enable CORS for public endpoints and JSON parsing
app.use(cors({ origin: '*' }));
app.use(express.json());

// Persistent active user sessions (token -> userId backed by MongoDB / Local-JSON database)
const sessions = {
  get: (token: string): string | undefined => db.getSessionUser(token),
  set: (token: string, userId: string): void => db.setSession(token, userId),
  delete: (token: string): void => db.deleteSession(token)
};

// Helper to get authorization header
function getAuthUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  const userId = sessions.get(token);
  if (!userId) return null;
  
  const users = db.getUsers();
  return users.find(u => u.id === userId) || null;
}

// Auth Middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Please log in first" });
  }
  (req as any).user = user;
  next();
}

// Admin Auth Middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" });
  }
  (req as any).user = user;
  next();
}

// Logger helper for tracking audit logs
function logActivity(action: string, details: string, req?: Request) {
  const user = req ? getAuthUser(req) : null;
  db.addLog(action, details, user?.id, user?.email);
}

// ==========================================
// AUTH ENDPOINTS
// ==========================================

// Register
app.post('/auth/register', (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "Email, password, and full name are required" });
    }

    const existing = db.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: "EMAIL_EXISTS", message: "An account with this email already exists" });
    }

    const now = new Date().toISOString();
    const userId = 'u-' + crypto.randomBytes(4).toString('hex');

    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      full_name,
      role: 'user' as const,
      password_hash: hashPassword(password),
      is_verified: true,
      created_at: now,
      updated_at: now
    };

    db.addUser(newUser);

    // Seed empty wallet
    db.getWalletByUserId(userId);

    // Generate session token immediately for seamless automatic login on registration
    const token = 'tok-' + crypto.randomBytes(16).toString('hex');
    sessions.set(token, userId);

    db.addLog("USER_REGISTER", `Registered new user ${email} (automatically verified).`, userId, email);

    res.json({ 
      success: true, 
      message: "Account created successfully!", 
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
        is_verified: true
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// Verify OTP
app.post('/auth/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "Email and OTP are required" });
    }

    const user = db.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
    }

    if (user.otp_code !== otp) {
      return res.status(400).json({ error: "INVALID_OTP", message: "The OTP code is incorrect" });
    }

    // Mark as verified
    db.updateUser(user.id, { is_verified: true, otp_code: undefined });

    // Generate session token
    const token = 'tok-' + crypto.randomBytes(16).toString('hex');
    sessions.set(token, user.id);

    db.addLog("USER_VERIFIED", `Verified account for ${email}`, user.id, email);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_verified: true
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// Login
app.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "Email and password are required" });
    }

    const user = db.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(400).json({ error: "INVALID_CREDENTIALS", message: "Incorrect email or password" });
    }

    if (user.password_hash !== hashPassword(password)) {
      return res.status(400).json({ error: "INVALID_CREDENTIALS", message: "Incorrect email or password" });
    }

    if (!user.is_verified) {
      // Re-trigger OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      db.updateUser(user.id, { otp_code: otp });
      console.log(`[SMSFLOW LOGIN OTP RE-TRIGGER] Email: ${email}, OTP: ${otp}`);
      return res.status(403).json({ 
        error: "UNVERIFIED", 
        message: "Account is not verified. OTP sent to your email.",
        dev_otp: otp 
      });
    }

    // Standard session tokens or map keys for mock accounts
    let token = '';
    if (user.id === 'admin-1') token = 'admin-token';
    else if (user.id === 'client-1') token = 'client-token';
    else token = 'tok-' + crypto.randomBytes(16).toString('hex');

    sessions.set(token, user.id);
    db.addLog("USER_LOGIN", `Logged in ${user.email}`, user.id, user.email);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_verified: true
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// Simulated Google OAuth login proxy
app.post('/auth/google', (req, res) => {
  try {
    const { email, name, id_token } = req.body;
    if (!email) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "Google account email is required" });
    }

    let user = db.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    const now = new Date().toISOString();

    if (!user) {
      // Auto register user if they join via OAuth
      const userId = 'u-' + crypto.randomBytes(4).toString('hex');
      user = {
        id: userId,
        email: email.toLowerCase(),
        full_name: name || email.split('@')[0],
        role: 'user',
        password_hash: hashPassword(crypto.randomBytes(10).toString('hex')), // random password hash
        is_verified: true,
        created_at: now,
        updated_at: now
      };
      db.addUser(user);
      db.getWalletByUserId(userId);
      db.addLog("USER_GOOGLE_REGISTER", `Registered and logged in via Google: ${email}`, userId, email);
    } else {
      db.addLog("USER_GOOGLE_LOGIN", `Logged in via Google: ${email}`, user.id, email);
    }

    const token = 'tok-' + crypto.randomBytes(16).toString('hex');
    sessions.set(token, user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_verified: true
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// Forgot password
app.post('/auth/forgot-password', (req, res) => {
  // Always return success to protect privacy
  const { email } = req.body;
  if (email) {
    console.log(`[FORGOT PASSWORD] Password reset link requested for ${email}`);
    db.addLog("FORGOT_PASSWORD", `Requested password reset for ${email}`);
  }
  res.json({ success: true, message: "If your email is registered, you will receive a reset link shortly." });
});

// Reset password
app.post('/auth/reset-password', (req, res) => {
  try {
    const { token, password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "New password is required" });
    }
    // Simple simulated token lookup or apply to client-1 as demo
    const testUser = db.getUsers().find(u => u.email === "client@smsflow.com");
    if (testUser) {
      db.updateUser(testUser.id, { password_hash: hashPassword(password) });
      db.addLog("PASSWORD_RESET", "Password reset successfully completed for demo account", testUser.id, testUser.email);
    }
    res.json({ success: true, message: "Password has been reset successfully." });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// Me (getCurrentUser)
app.get('/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Not logged in" });
  }
  const wallet = db.getWalletByUserId(user.id);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_verified: user.is_verified
    },
    wallet: {
      balance: wallet.balance
    }
  });
});

// Logout
app.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    sessions.delete(token);
  }
  res.json({ success: true });
});

// ==========================================
// CORE NUMBER & OTP FLOW ENDPOINTS
// ==========================================

// GET-NUMBER (Purchase Flow)
app.post('/api/get-number', requireAuth, async (req, res) => {
  const user = (req as any).user;
  let { service, country: countryName } = req.body;
  
  if (!service) service = 'fb';
  // Map 'go' (Google/Gmail) to 'fb'
  const targetServiceCode = service === 'go' ? 'fb' : service;

  try {
    // Get country configs from setting
    const countriesJson = db.getSettingValue('countries', '[]');
    const countries: CountryConfig[] = JSON.parse(countriesJson);
    
    const country = countries.find(c => c.name.toLowerCase() === String(countryName || '').toLowerCase());
    if (!country) {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND", message: `Country configuration for '${countryName}' not found` });
    }

    // Determine selling price
    let sellingPrice = country.sell;
    if (service === 'go') {
      const gmailPriceSetting = Number(db.getSettingValue('gmail_price', '15'));
      sellingPrice = gmailPriceSetting;
    }

    // Check client balance
    const wallet = db.getWalletByUserId(user.id);
    if (wallet.balance < sellingPrice) {
      return res.status(400).json({ 
        error: "INSUFFICIENT_BALANCE", 
        message: `Your balance (${wallet.balance} PKR) is insufficient to buy this number (${sellingPrice} PKR)` 
      });
    }

    // 6-times retry loop
    let activationId = '';
    let phoneNumber = '';
    let costUsd = country.provider === 'smsbower' ? country.maxPrice : 0;
    let purchaseSuccess = false;
    let lastError = 'No response from API';

    console.log(`[PURCHASE FLOW] Initiating purchase. Country: ${country.name}, Service: ${targetServiceCode}, Provider: ${country.provider}`);

    for (let attempt = 1; attempt <= 6; attempt++) {
      console.log(`[PURCHASE ATTEMPT ${attempt}/6]`);
      try {
        const action = 'getNumber';
        const params: Record<string, any> = {
          service: targetServiceCode,
          country: country.countryId,
        };

        if (country.provider === 'smsbower') {
          params.maxPrice = country.maxPrice;
          if (country.providerId) {
            params.providerIds = country.providerId;
          }
        }

        const rawResponse = await providerApiCall(country.provider, action, params);
        const apiResponse = rawResponse ? rawResponse.trim() : '';
        const apiResponseUpper = apiResponse.toUpperCase();

        // Parse Response
        if (apiResponseUpper.startsWith('ACCESS_NUMBER:')) {
          const parts = apiResponse.split(':');
          activationId = parts[1] ? parts[1].trim() : '';
          phoneNumber = parts[2] ? parts[2].trim() : '';
          
          // Cost parsing if available
          if (parts[3]) {
            const cost = Number(parts[3].trim());
            if (!isNaN(cost)) {
              if (country.provider === 'smsbower') {
                costUsd = cost;
              } else {
                costUsd = cost / 280; // approximate conversions for reporting
              }
            }
          }
          
          purchaseSuccess = true;
          break;
        } else if (apiResponse.startsWith('{') || apiResponse.startsWith('[')) {
          const json = JSON.parse(apiResponse);
          if (json.activationId) {
            activationId = String(json.activationId).trim();
            phoneNumber = String(json.phoneNumber).trim();
            if (json.activationCost) {
              const cost = Number(json.activationCost);
              if (country.provider === 'smsbower') costUsd = cost;
              else costUsd = cost / 280;
            }
            purchaseSuccess = true;
            break;
          } else if (json.errorCode) {
            lastError = json.errorCode;
          }
        } else {
          lastError = apiResponse;
          // Break immediately on non-retryable known errors
          if (
            apiResponseUpper.includes('NO_NUMBERS') ||
            apiResponseUpper.includes('NO_BALANCE') ||
            apiResponseUpper.includes('BAD_KEY') ||
            apiResponseUpper.includes('BAD_ACTION') ||
            apiResponseUpper.includes('BAD_SERVICE') ||
            apiResponseUpper.includes('ERROR_SQL') ||
            apiResponseUpper.includes('WRONG_KEY')
          ) {
            console.log(`[PURCHASE FLOW] Non-retryable error received: ${apiResponse}. Breaking loop.`);
            break;
          }
        }
      } catch (e: any) {
        lastError = e.message;
      }

      // Wait 1.5 seconds between retries if not the last attempt
      if (attempt < 6) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!purchaseSuccess) {
      return res.status(502).json({ 
        error: "PROVIDER_API_FAILED", 
        message: `External API failed to provide a number. Error: ${lastError}` 
      });
    }

    // Success! Deduct balance
    db.adjustWalletBalance(user.id, -sellingPrice);

    // Create unique share token for public view
    const token = crypto.randomBytes(6).toString('hex'); // 12-char string

    // Shorten URL via l8.nu
    const prefix = db.getSettingValue('short_link_prefix', 'fb');
    const keyword = `${prefix}${phoneNumber.replace(/\D/g, '')}`.substring(0, 30);
    const publicBaseUrl = db.getSettingValue('public_otp_url', 'https://smsflow.panel/otp-viewer');
    const longUrl = `${publicBaseUrl}?token=${token}`;
    
    let shortUrl = '';
    try {
      shortUrl = await shortenUrl(longUrl, keyword);
    } catch (e) {
      console.error("[SHORTENER EXCEPTION] Failed, using fallback link:", e);
      shortUrl = longUrl;
    }

    // Save Activation
    const activation = db.addActivation({
      service: targetServiceCode,
      service_name: service === 'go' ? 'Gmail' : 'Facebook',
      activation_id: activationId,
      phone_number: phoneNumber,
      cost_usd: costUsd,
      selling_price: sellingPrice,
      status: 'waiting',
      provider: country.provider,
      token,
      short_url: shortUrl,
      created_by_id: user.id
    });

    // Record Debit Txn
    db.addTransaction({
      user_id: user.id,
      amount: sellingPrice,
      type: 'debit',
      description: `Bought ${service === 'go' ? 'Gmail' : 'Facebook'} Virtual Number (${country.name}): ${phoneNumber}`,
      txn_id: `ACT-${activationId}`
    });

    db.addLog("NUMBER_PURCHASE", `Bought virtual number ${phoneNumber} for ${sellingPrice} PKR (ID: ${activationId})`, user.id, user.email);

    res.json(activation);
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// CHECK STATUS
app.post('/api/check-status', requireAuth, async (req, res) => {
  const { activationId } = req.body;
  if (!activationId) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "activationId is required" });
  }

  try {
    const act = db.getActivations().find(a => a.activation_id === activationId || a.id === activationId);
    if (!act) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Activation record not found" });
    }

    // If already completed or cancelled, return cached
    if (act.status === 'completed' || act.status === 'cancelled') {
      return res.json(act);
    }

    // Call provider API to check status
    const responseText = await providerApiCall(act.provider, 'getStatus', { id: act.activation_id });

    if (responseText.startsWith('STATUS_OK:')) {
      const code = responseText.split(':')[1];
      const updated = db.updateActivation(act.activation_id, {
        status: 'code_received',
        otp_code: code,
        otp_received: true
      });
      db.addLog("OTP_RECEIVED", `OTP received for ${act.phone_number}: ${code}`, act.created_by_id);
      return res.json(updated);
    } else if (responseText === 'STATUS_CANCEL') {
      // Refund balance
      db.adjustWalletBalance(act.created_by_id, act.selling_price);
      db.addTransaction({
        user_id: act.created_by_id,
        amount: act.selling_price,
        type: 'credit',
        description: `Refund (Provider Cancelled) for ${act.service_name} Virtual Number: ${act.phone_number}`,
        txn_id: `REF-${act.activation_id}`
      });

      const updated = db.updateActivation(act.activation_id, { status: 'cancelled' });
      db.addLog("OTP_REFUND", `Provider cancelled number ${act.phone_number}. Wallet refunded.`, act.created_by_id);
      return res.json(updated);
    }

    res.json(act);
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// SET ACTIVATION STATUS (Client controls)
app.post('/api/set-activation-status', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { activationId, status } = req.body; // status values: 3 (retry/another), 6 (complete), 8 (cancel)
  
  if (!activationId || !status) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "activationId and status are required" });
  }

  try {
    const act = db.getActivations().find(a => a.activation_id === activationId || a.id === activationId);
    if (!act) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Activation not found" });
    }

    // Enforce owner check
    if (act.created_by_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
    }

    const ageSec = (Date.now() - new Date(act.created_at).getTime()) / 1000;

    if (status === 8) {
      // Cancel status
      if (act.status === 'code_received' || act.otp_received === true) {
        return res.status(400).json({ error: "INVALID_OPERATION", message: "Cannot cancel or refund after OTP code has been received" });
      }
      
      // Cancel request to provider
      await providerApiCall(act.provider, 'setStatus', { id: act.activation_id, status: 8 });

      // Refund
      db.adjustWalletBalance(act.created_by_id, act.selling_price);
      db.addTransaction({
        user_id: act.created_by_id,
        amount: act.selling_price,
        type: 'credit',
        description: `Refund (Client Cancelled) for virtual number: ${act.phone_number}`,
        txn_id: `REF-C-${act.activation_id}`
      });

      const updated = db.updateActivation(act.activation_id, { status: 'cancelled' });
      db.addLog("NUMBER_CANCEL", `Client cancelled number ${act.phone_number}. Balance refunded.`, user.id);
      return res.json(updated);
    } 
    
    if (status === 3) {
      // Another code request
      if (act.status !== 'code_received') {
        return res.status(400).json({ error: "INVALID_OPERATION", message: "You can only request another code after an initial OTP is received" });
      }

      await providerApiCall(act.provider, 'setStatus', { id: act.activation_id, status: 3 });
      
      const updated = db.updateActivation(act.activation_id, {
        status: 'waiting',
        otp_code: undefined
      });
      db.addLog("NUMBER_RETRY", `Client requested another OTP code for ${act.phone_number}`, user.id);
      return res.json(updated);
    }

    if (status === 6) {
      // Complete activation
      await providerApiCall(act.provider, 'setStatus', { id: act.activation_id, status: 6 });
      
      const updated = db.updateActivation(act.activation_id, { status: 'completed' });
      db.addLog("NUMBER_COMPLETE", `Activation marked completed for ${act.phone_number}`, user.id);
      return res.json(updated);
    }

    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid status instruction" });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// In-memory stock cache with 15-second TTL
let stockCache: { data: any; timestamp: number } | null = null;

// GET STOCK (Client looks up prices & stocks)
app.get('/api/stock', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();

    if (!forceRefresh && stockCache && (now - stockCache.timestamp < 15000)) {
      return res.json(stockCache.data);
    }

    const countriesJson = db.getSettingValue('countries', '[]');
    const countries: CountryConfig[] = JSON.parse(countriesJson);
    const publicOtpUrl = db.getSettingValue('public_otp_url', '');
    const availableFbIds = db.getFacebookIds().filter(f => f.status === 'available').length;

    // Fetch batch prices from providers (SMSBower & VSIMPRO)
    let bowerPrices: any = null;
    let bowerStatus: any = null;
    let vsimproPrices: any = null;

    try {
      const bowerRes = await providerApiCall('smsbower', 'getPrices', { service: 'fb' });
      bowerPrices = bowerRes;
    } catch (e) {
      console.warn('[STOCK] Error getting bower prices:', e);
    }

    // If getPrices was empty or error, try getNumbersStatus as fallback
    if (!bowerPrices || bowerPrices.includes('ERROR') || bowerPrices.includes('BAD_KEY')) {
      try {
        bowerStatus = await providerApiCall('smsbower', 'getNumbersStatus', {});
      } catch (e) {}
    }

    // Check if any country uses vsimpro
    const hasVsimpro = countries.some(c => c.provider === 'vsimpro');
    if (hasVsimpro) {
      try {
        vsimproPrices = await providerApiCall('vsimpro', 'getPrices', { service: 'fb' });
      } catch (e) {
        console.warn('[STOCK] Error getting vsimpro prices:', e);
      }
    }

    const isBowerConfigured = isKeyConfigured(getOtpApiKey());
    const isVsimproConfigured = isKeyConfigured(getVsimproApiKey());

    const countriesWithStock = await Promise.all(countries.map(async (c) => {
      const provider = c.provider || 'smsbower';
      const isConfigured = provider === 'smsbower' ? isBowerConfigured : isVsimproConfigured;
      
      let stock: number | null = null;
      const targetPayload = provider === 'smsbower' ? bowerPrices : vsimproPrices;
      
      // 1. Try batch payload extraction
      if (targetPayload) {
        stock = extractStockCount(targetPayload, c.countryId, 'fb', c.providerId, c.maxPrice);
      }

      // 2. If null and bowerStatus available
      if (stock === null && provider === 'smsbower' && bowerStatus) {
        stock = extractStockCount(bowerStatus, c.countryId, 'fb', c.providerId, c.maxPrice);
      }

      // 3. If still null and key is configured, try direct per-country query with providerId
      if (stock === null && isConfigured) {
        try {
          const directParams: Record<string, any> = { service: 'fb', country: c.countryId };
          if (c.providerId) {
            directParams.providerIds = c.providerId;
            directParams.provider = c.providerId;
          }
          const directRes = await providerApiCall(provider, 'getPrices', directParams);
          stock = extractStockCount(directRes, c.countryId, 'fb', c.providerId, c.maxPrice);
        } catch (e) {}
      }

      // 4. Final fallback assignment:
      // If key is configured, real count is used (or 0 if no numbers available for that specific provider ID)
      // If sandbox simulation mode, assign realistic mock count
      let finalCount = 0;
      if (typeof stock === 'number') {
        finalCount = stock;
      } else if (!isConfigured) {
        // Deterministic simulation stock per country id and provider id
        const seed = Number(c.countryId) * 17 + Number(c.providerId || 0) * 13 + 29;
        finalCount = Math.max(12, seed % 135);
      } else {
        finalCount = 0; // Real API connected, but 0 stock returned by provider for this providerId
      }

      return {
        ...c,
        stock: finalCount
      };
    }));

    const totalStock = countriesWithStock.reduce((acc, curr) => acc + (curr.stock || 0), 0);

    const responseData = {
      fbIdStock: availableFbIds,
      numberStock: totalStock,
      countries: countriesWithStock,
      publicOtpUrl,
      lastUpdated: new Date().toISOString(),
      isSandbox: !isBowerConfigured && !isVsimproConfigured
    };

    stockCache = {
      data: responseData,
      timestamp: now
    };

    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// PUBLIC OTP BY TOKEN (CORS enabled, completely public standalone viewer)
app.post('/api/otp-by-token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "Token is required" });
  }

  try {
    const act = db.getActivations().find(a => a.token === token);
    if (!act) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Verification link is invalid or expired" });
    }

    // If waiting, poll provider to see if code arrived
    if (act.status === 'waiting') {
      try {
        const responseText = await providerApiCall(act.provider, 'getStatus', { id: act.activation_id });
        if (responseText.startsWith('STATUS_OK:')) {
          const code = responseText.split(':')[1];
          const updated = db.updateActivation(act.activation_id, {
            status: 'code_received',
            otp_code: code,
            otp_received: true
          });
          db.addLog("PUBLIC_OTP_RECEIVED", `OTP fetched via public token for ${act.phone_number}: ${code}`, act.created_by_id);
          return res.json({
            phone_number: updated?.phone_number,
            service_name: updated?.service_name,
            created_date: updated?.created_at,
            status: updated?.status,
            otp_code: updated?.otp_code
          });
        } else if (responseText === 'STATUS_CANCEL') {
          // Refund
          db.adjustWalletBalance(act.created_by_id, act.selling_price);
          db.addTransaction({
            user_id: act.created_by_id,
            amount: act.selling_price,
            type: 'credit',
            description: `Refund (Provider Cancelled) for ${act.service_name} Virtual Number: ${act.phone_number}`,
            txn_id: `REF-${act.activation_id}`
          });
          const updated = db.updateActivation(act.activation_id, { status: 'cancelled' });
          return res.json({
            phone_number: updated?.phone_number,
            service_name: updated?.service_name,
            created_date: updated?.created_at,
            status: updated?.status,
            otp_code: undefined
          });
        }
      } catch (e) {
        // Fail silently and return cached status
      }
    }

    res.json({
      phone_number: act.phone_number,
      service_name: act.service_name,
      created_date: act.created_at,
      status: act.status,
      otp_code: act.otp_code
    });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// WEBHOOK
app.post('/api/otp-webhook', async (req, res) => {
  const { activationId, code } = req.body;
  if (!activationId || !code) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "activationId and code are required" });
  }

  try {
    const act = db.getActivations().find(a => a.activation_id === activationId);
    if (act && act.status === 'waiting') {
      db.updateActivation(act.activation_id, {
        status: 'code_received',
        otp_code: code,
        otp_received: true
      });
      db.addLog("WEBHOOK_OTP", `OTP received via webhook for ${act.phone_number}: ${code}`, act.created_by_id);
      return res.json({ success: true });
    }
    res.json({ success: false, message: "Activation not in waiting state or not found" });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// EXPIRE ACTIVATIONS (Auto clean up older than 20 min)
app.post('/api/expire-activations', async (req, res) => {
  try {
    const now = Date.now();
    const limitMs = 20 * 60 * 1000; // 20 minutes
    
    // 1. Clean up SMS activations
    const waitingActs = db.getActivations().filter(a => a.status === 'waiting');
    let expiredCount = 0;

    for (const act of waitingActs) {
      const ageMs = now - new Date(act.created_at).getTime();
      if (ageMs > limitMs) {
        // Expired! Cancel at provider
        try {
          await providerApiCall(act.provider, 'setStatus', { id: act.activation_id, status: 8 });
        } catch (e) {
          // Continue anyway
        }

        // Refund client balance
        db.adjustWalletBalance(act.created_by_id, act.selling_price);
        
        // Record Credit Txn
        db.addTransaction({
          user_id: act.created_by_id,
          amount: act.selling_price,
          type: 'credit',
          description: `Auto-refund (Expired >20 min) for number: ${act.phone_number}`,
          txn_id: `AUTO-REF-${act.activation_id}`
        });

        db.updateActivation(act.activation_id, { status: 'cancelled' });
        db.addLog("NUMBER_AUTO_EXPIRE", `Auto-refunded expired number ${act.phone_number} (ID: ${act.activation_id})`, act.created_by_id);
        expiredCount++;
      }
    }

    // 2. Clean up Gmail activations
    const waitingMails = db.getMailActivations().filter(m => m.status === 'waiting');
    let expiredMailCount = 0;

    for (const mail of waitingMails) {
      const ageMs = now - new Date(mail.created_at).getTime();
      if (ageMs > limitMs) {
        // Expired! Cancel at provider
        try {
          await mailApiCall('setStatus', { id: mail.mail_id, status: 2 });
        } catch (e) {
          // Continue anyway
        }

        // Refund client balance
        db.adjustWalletBalance(mail.created_by_id, mail.selling_price);

        // Record Credit Txn
        db.addTransaction({
          user_id: mail.created_by_id,
          amount: mail.selling_price,
          type: 'credit',
          description: `Auto-refund (Expired >20 min) for Temp Gmail: ${mail.mail_address}`,
          txn_id: `AUTO-REF-M-${mail.mail_id}`
        });

        db.updateMailActivation(mail.mail_id, { status: 'cancelled' });
        db.addLog("MAIL_AUTO_EXPIRE", `Auto-refunded expired Gmail ${mail.mail_address} (ID: ${mail.mail_id})`, mail.created_by_id);
        expiredMailCount++;
      }
    }

    res.json({ success: true, expired_count: expiredCount, expired_mail_count: expiredMailCount });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// ==========================================
// GMAIL (TEMP MAIL) FLOW ENDPOINTS
// ==========================================

// Global mail stock tracking
let cachedMailStock = { available: true, count: 0, lastChecked: 0, statusText: 'In Stock' };

// GET-MAIL
app.post('/api/get-mail', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const configuredService = db.getSettingValue('mail_service_code', 'fb') || 'fb';
  const configuredDomain = db.getSettingValue('mail_domain', 'gmail.com') || 'gmail.com';
  const configuredRef = db.getSettingValue('mail_ref', '');
  const configuredAlias = db.getSettingValue('mail_alias', '');

  const { 
    service = configuredService, 
    domain = configuredDomain,
    ref = configuredRef,
    alias = configuredAlias
  } = req.body;

  try {
    const maxPrice = Number(db.getSettingValue('gmail_mail_max_price', '0.05'));
    const sellingPrice = Number(db.getSettingValue('gmail_mail_price', '20'));

    // Check client balance
    const wallet = db.getWalletByUserId(user.id);
    if (wallet.balance < sellingPrice) {
      return res.status(400).json({ 
        error: "INSUFFICIENT_BALANCE", 
        message: `Your balance (${wallet.balance} PKR) is insufficient to buy this temp Gmail (${sellingPrice} PKR)` 
      });
    }

    // Call SMSBOWER Mail API (e.g. https://smsbower.page/api/mail/getActivation?api_key=...&service=$SERVICE&domain=$DOMAIN&ref=$ref&alias=$alias)
    let response = await mailApiCall('getActivation', { 
      service, 
      domain, 
      maxPrice: maxPrice > 0 ? maxPrice : undefined,
      ref,
      alias
    });

    // If maxPrice restriction resulted in 'No mails yet' or status 0, retry once without maxPrice restriction
    if ((!response || response.status === 0 || !response.mailId) && maxPrice > 0) {
      console.log(`[MAIL RETRY] Retrying getActivation without maxPrice constraint...`);
      const retryResp = await mailApiCall('getActivation', { 
        service, 
        domain, 
        ref, 
        alias 
      });
      if (retryResp && (retryResp.status === 1 || retryResp.mailId)) {
        response = retryResp;
      }
    }
    
    // Response check: support both status=1, mailId, mail_id or id
    const isSuccess = response && (String(response.status) === '1' || response.status === 1 || response.status === true || response.success === true);
    const mailIdVal = response?.mailId || response?.mail_id || response?.id;

    if (isSuccess && mailIdVal) {
      cachedMailStock = { available: true, count: 50, lastChecked: Date.now(), statusText: 'In Stock' };
      // Success! Deduct balance
      db.adjustWalletBalance(user.id, -sellingPrice);
      const emailAddress = response.mail || response.mailAddress || response.email || 'simulated@gmail.com';

      const token = crypto.randomBytes(6).toString('hex');

      const mailAct = db.addMailActivation({
        service,
        service_name: "Facebook Temp Gmail",
        mail_id: String(mailIdVal),
        mail_address: emailAddress,
        domain,
        cost_usd: maxPrice,
        selling_price: sellingPrice,
        status: 'waiting',
        token,
        created_by_id: user.id
      });

      // Debit Transaction
      db.addTransaction({
        user_id: user.id,
        amount: sellingPrice,
        type: 'debit',
        description: `Bought Facebook Temp Gmail: ${emailAddress}`,
        txn_id: `MAIL-${mailIdVal}`
      });

      db.addLog("MAIL_PURCHASE", `Bought temp Gmail ${emailAddress} (ID: ${mailIdVal})`, user.id, user.email);
      return res.json(mailAct);
    } else {
      cachedMailStock = { available: false, count: 0, lastChecked: Date.now(), statusText: 'Out of Stock' };
      const rawError = response?.error || response?.message || "No mails yet";
      let friendlyError = "Currently Out of Stock. Temporary Gmail accounts are unavailable right now, please try again shortly.";
      if (!String(rawError).toLowerCase().includes('no mails yet') && !String(rawError).toLowerCase().includes('no_numbers')) {
        friendlyError = typeof rawError === 'string' ? rawError : "Currently Out of Stock. Please try again shortly.";
      }
      return res.status(502).json({ 
        error: "OUT_OF_STOCK", 
        outOfStock: true, 
        message: friendlyError
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// CHECK MAIL STATUS
app.post('/api/check-mail-status', requireAuth, async (req, res) => {
  const { mailId } = req.body;
  if (!mailId) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "mailId is required" });
  }

  try {
    const act = db.getMailActivations().find(a => a.mail_id === mailId || a.id === mailId);
    if (!act) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Temp email activation not found" });
    }

    if (act.status === 'completed' || act.status === 'cancelled') {
      return res.json(act);
    }

    // Call SMSBOWER Mail getCode API
    const response = await mailApiCall('getCode', { mailId: act.mail_id });

    // Response structure: {status: 1, code: "1234"} or waiting
    if (response && response.status === 1 && response.code) {
      const updated = db.updateMailActivation(act.mail_id, {
        status: 'code_received',
        code: response.code,
        otp_received: true
      });
      db.addLog("MAIL_OTP_RECEIVED", `Mail OTP received for ${act.mail_address}: ${response.code}`, act.created_by_id);
      return res.json(updated);
    }

    res.json(act);
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// SET MAIL STATUS
app.post('/api/set-mail-status', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { mailId, status } = req.body; // status: 2 = cancel/refund, 3 = complete, 5 = wait next code
  
  if (!mailId || !status) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "mailId and status are required" });
  }

  try {
    const act = db.getMailActivations().find(a => a.mail_id === mailId || a.id === mailId);
    if (!act) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Activation record not found" });
    }

    if (act.created_by_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
    }

    if (status === 2) {
      // Cancel + refund
      if (act.status === 'code_received' || act.otp_received === true) {
        return res.status(400).json({ error: "INVALID_OPERATION", message: "Cannot cancel or refund after email code has been received" });
      }

      await mailApiCall('setStatus', { id: act.mail_id, status: 2 });
      
      // Refund
      db.adjustWalletBalance(act.created_by_id, act.selling_price);
      db.addTransaction({
        user_id: act.created_by_id,
        amount: act.selling_price,
        type: 'credit',
        description: `Refund (Client Cancelled) for Temp Gmail: ${act.mail_address}`,
        txn_id: `REF-M-${act.mail_id}`
      });

      const updated = db.updateMailActivation(act.mail_id, { status: 'cancelled' });
      db.addLog("MAIL_CANCEL", `Client cancelled temp Gmail ${act.mail_address}`, user.id);
      return res.json(updated);
    }

    if (status === 3) {
      // Complete
      await mailApiCall('setStatus', { id: act.mail_id, status: 3 });
      const updated = db.updateMailActivation(act.mail_id, { status: 'completed' });
      db.addLog("MAIL_COMPLETE", `Client completed Gmail session for ${act.mail_address}`, user.id);
      return res.json(updated);
    }

    if (status === 5) {
      // Wait next code
      if (act.status !== 'code_received') {
        return res.status(400).json({ error: "INVALID_OPERATION", message: "Can only wait next code after receiving first OTP" });
      }

      await mailApiCall('setStatus', { id: act.mail_id, status: 5 });
      const updated = db.updateMailActivation(act.mail_id, {
        status: 'waiting',
        code: undefined
      });
      db.addLog("MAIL_WAIT_NEXT", `Requested next OTP code for temp Gmail: ${act.mail_address}`, user.id);
      return res.json(updated);
    }

    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid mail status" });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// GET MAIL STOCK
app.get('/api/mail-stock', async (req, res) => {
  try {
    const isForced = req.query.refresh === 'true';
    
    // If cached within 2 minutes and marked out of stock (unless force refresh requested), return cached out-of-stock
    if (!isForced && cachedMailStock.lastChecked > 0 && (Date.now() - cachedMailStock.lastChecked < 120000)) {
      return res.json({ 
        available: cachedMailStock.available, 
        count: cachedMailStock.count,
        statusText: cachedMailStock.available ? 'In Stock' : 'Out of Stock'
      });
    }

    let available = true;
    let count = 0;
    try {
      const response = await mailApiCall('getMailServicesList');
      if (response && response.services && Array.isArray(response.services)) {
        const configuredService = db.getSettingValue('mail_service_code', 'fb') || 'fb';
        const targetService = response.services.find((s: any) => s.code === configuredService || s.code === 'fb');
        if (targetService) {
          count = Number(targetService.count || 0);
          available = count > 0;
        } else {
          available = response.services.length > 0;
          count = available ? 50 : 0;
        }
      } else if (response && response.status === 0) {
        available = false;
        count = 0;
      }
    } catch (e) {
      // If error or unconfigured, respect previous known stock
      available = cachedMailStock.lastChecked > 0 ? cachedMailStock.available : true;
      count = available ? 25 : 0;
    }

    cachedMailStock = { 
      available, 
      count, 
      lastChecked: Date.now(),
      statusText: available ? 'In Stock' : 'Out of Stock'
    };

    res.json({ available, count, statusText: available ? 'In Stock' : 'Out of Stock' });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// ==========================================
// FACEBOOK IDS PURCHASE ENDPOINTS
// ==========================================

// BUY FACEBOOK IDS
app.post('/api/buy-facebook-ids', requireAuth, (req, res) => {
  const user = (req as any).user;
  const { quantity } = req.body;
  const qty = Number(quantity);

  if (isNaN(qty) || qty <= 0 || qty > 50) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "Quantity must be between 1 and 50" });
  }

  try {
    const pricePerId = 32; // Default 32 PKR
    const totalCost = qty * pricePerId;

    // Check balance
    const wallet = db.getWalletByUserId(user.id);
    if (wallet.balance < totalCost) {
      return res.status(400).json({ 
        error: "INSUFFICIENT_BALANCE", 
        message: `Your balance (${wallet.balance} PKR) is insufficient to buy ${qty} FB IDs (${totalCost} PKR)` 
      });
    }

    // Fetch available accounts
    const available = db.getFacebookIds().filter(f => f.status === 'available');
    if (available.length < qty) {
      return res.status(400).json({ 
        error: "OUT_OF_STOCK", 
        message: `Only ${available.length} Facebook IDs are currently in stock` 
      });
    }

    // Process Purchase
    const purchasedIds = available.slice(0, qty);
    const now = new Date().toISOString();

    purchasedIds.forEach(fb => {
      db.updateFacebookId(fb.id, {
        status: 'sold',
        sold_to_id: user.id,
        sold_date: now,
        price: pricePerId
      });
    });

    // Deduct Balance
    db.adjustWalletBalance(user.id, -totalCost);

    // Record Debit Transaction
    db.addTransaction({
      user_id: user.id,
      amount: totalCost,
      type: 'debit',
      description: `Purchased ${qty} Facebook Accounts (UID/Pass)`,
      txn_id: `FB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    });

    db.addLog("FB_IDS_PURCHASE", `Bought ${qty} Facebook IDs for ${totalCost} PKR`, user.id, user.email);

    res.json({
      success: true,
      purchased: purchasedIds.map(f => ({ uid: f.uid, password: f.password }))
    });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// ==========================================
// DEPOSITS FLOW ENDPOINTS
// ==========================================

// DEPOSIT REQUEST (Submit Request)
app.post('/api/deposit-request', requireAuth, (req, res) => {
  const user = (req as any).user;
  const { amount, method, txn_id, screenshot_url } = req.body;
  const amt = Number(amount);

  if (isNaN(amt) || amt < 50) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "Minimum deposit amount is 50 PKR" });
  }

  if (!method || !txn_id) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "Payment method and Transaction ID (TID) are required" });
  }

  try {
    const deposit = db.addDepositRequest({
      user_id: user.id,
      amount: amt,
      method,
      txn_id,
      screenshot_url: screenshot_url || "",
      status: 'pending',
      created_by_id: user.id
    });

    db.addLog("DEPOSIT_REQUEST", `Submitted deposit request of ${amt} PKR via ${method} (TID: ${txn_id})`, user.id, user.email);
    res.json(deposit);
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// HANDLE DEPOSIT (Admin Approve/Reject)
app.post('/api/handle-deposit', requireAdmin, (req, res) => {
  const { id, action } = req.body; // action: 'approve' or 'reject'
  if (!id || !action) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "Request ID and action are required" });
  }

  try {
    const dep = db.getDepositRequests().find(d => d.id === id);
    if (!dep) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Deposit request not found" });
    }

    if (dep.status !== 'pending') {
      return res.status(400).json({ error: "ALREADY_PROCESSED", message: "This deposit request has already been processed" });
    }

    if (action === 'approve') {
      // Update deposit request
      db.updateDepositRequest(id, { status: 'approved' });

      // Add balance to client wallet
      db.adjustWalletBalance(dep.user_id, dep.amount);

      // Record Credit Transaction
      db.addTransaction({
        user_id: dep.user_id,
        amount: dep.amount,
        type: 'credit',
        description: `Funded Wallet via Admin Approval (${dep.method})`,
        txn_id: dep.txn_id,
        payment_method: dep.method
      });

      const client = db.getUsers().find(u => u.id === dep.user_id);
      db.addLog("DEPOSIT_APPROVE", `Approved ${dep.amount} PKR for client ${client?.email || dep.user_id}`, (req as any).user.id);
      return res.json({ success: true, message: "Deposit approved. Balance credited." });
    } else if (action === 'reject') {
      db.updateDepositRequest(id, { status: 'rejected' });
      db.addLog("DEPOSIT_REJECT", `Rejected deposit request of ${dep.amount} PKR`, (req as any).user.id);
      return res.json({ success: true, message: "Deposit request rejected" });
    }

    res.status(400).json({ error: "BAD_REQUEST", message: "Invalid action instruction" });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// ==========================================
// ADMIN DASHBOARD & MANAGE ENDPOINTS
// ==========================================

// GET ADMIN DASHBOARD
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const users = db.getUsers().filter(u => u.role !== 'admin');
    const totalClients = users.length;

    const activations = db.getActivations();
    const totalActivations = activations.length;

    // Revenue: sum of selling_prices of all non-cancelled/non-refunded debit transactions
    const txs = db.getTransactions();
    const debitTxs = txs.filter(t => t.type === 'debit');
    const creditTxs = txs.filter(t => t.type === 'credit' && t.description.toLowerCase().includes('refund'));
    
    const revenue = debitTxs.reduce((sum, t) => sum + t.amount, 0) - creditTxs.reduce((sum, t) => sum + t.amount, 0);

    // Get Provider Balance
    let providerBalanceUsd = 0.00;
    try {
      const response = await providerApiCall('smsbower', 'getBalance');
      // Format: ACCESS_BALANCE:123.45 or JSON
      if (response.startsWith('ACCESS_BALANCE:')) {
        providerBalanceUsd = Number(response.split(':')[1]) || 0;
      }
    } catch (e) {
      providerBalanceUsd = 4.25; // fallback representation
    }

    // Combine recent 10 activations with client names
    const clients = db.getUsers();
    const recentActivations = activations.slice(0, 10).map(act => {
      const client = clients.find(u => u.id === act.created_by_id);
      return {
        ...act,
        clientName: client ? client.full_name : "Unknown Client"
      };
    });

    res.json({
      totalClients,
      totalActivations,
      revenue: Math.max(0, revenue),
      providerBalanceUsd,
      providerBalancePkr: providerBalanceUsd * 280,
      recentActivations,
      isMongoConnected: db.isMongoConnected()
    });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// GET DATABASE CONNECTION STATUS
app.get('/api/admin/db-status', requireAdmin, (req, res) => {
  res.json({
    connected: db.isMongoConnected(),
    source: db.isMongoConnected() ? "MongoDB Atlas" : "Local db.json (Backup)"
  });
});

// GET ADMIN CLIENTS LIST
app.get('/api/admin/clients', requireAdmin, (req, res) => {
  try {
    const users = db.getUsers().filter(u => u.role !== 'admin');
    const clientList = users.map(user => {
      const wallet = db.getWalletByUserId(user.id);
      return {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        balance: wallet.balance,
        created_at: user.created_at
      };
    });
    res.json(clientList);
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// ADJUST BALANCE
app.post('/api/admin/adjust-balance', requireAdmin, (req, res) => {
  const { userId, amount, description } = req.body;
  const amt = Number(amount);

  if (!userId || isNaN(amt)) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "userId and amount (number) are required" });
  }

  try {
    const user = db.getUsers().find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
    }

    const wallet = db.adjustWalletBalance(userId, amt);
    
    // Log credit or debit txn
    db.addTransaction({
      user_id: userId,
      amount: Math.abs(amt),
      type: amt >= 0 ? 'credit' : 'debit',
      description: description || `Admin Manual Balance Adjustment`,
      txn_id: `ADJ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    });

    db.addLog("BALANCE_ADJUST", `Admin manually adjusted balance of ${user.email} by ${amt} PKR. New: ${wallet.balance}`, (req as any).user.id);

    res.json({ success: true, balance: wallet.balance });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// SYNC SERVICES list
app.post('/api/admin/sync-services', requireAdmin, (req, res) => {
  try {
    // Simply seed default active services list to ensure they are clean
    db.updateService('fb', true);
    db.updateService('go', true);
    
    db.addLog("SERVICES_SYNC", "Synchronized services with provider configurations", (req as any).user.id);
    res.json({ success: true, services: db.getServices() });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// TOGGLE SERVICE
app.post('/api/admin/toggle-service', requireAdmin, (req, res) => {
  const { serviceCode, isActive } = req.body;
  if (!serviceCode) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "serviceCode is required" });
  }

  try {
    db.updateService(serviceCode, Boolean(isActive));
    db.addLog("SERVICE_TOGGLE", `Toggled service ${serviceCode} to ${isActive}`, (req as any).user.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// UPDATE SETTINGS rows
app.post('/api/admin/update-settings', requireAdmin, (req, res) => {
  const settings = req.body; // expects key-value dictionary e.g. { countries: "...", public_otp_url: "..." }
  
  try {
    Object.keys(settings).forEach(key => {
      let val = settings[key];
      if (typeof val === 'object') {
        val = JSON.stringify(val);
      }
      db.setSettingValue(key, String(val));
    });

    db.addLog("SETTINGS_UPDATE", `Updated settings keys: ${Object.keys(settings).join(', ')}`, (req as any).user.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// DISCOVER COUNTRIES (<10 PKR)
app.post('/api/admin/discover-countries', requireAdmin, async (req, res) => {
  try {
    const now = new Date().toISOString();
    // We scan SMSBOWER price list for Facebook 'fb' service
    // Scan cheap countries, convert to PKR, and auto add them
    let discovered: CountryConfig[] = [];

    // Attempt to discover from SMSBOWER
    try {
      const bowerPrices = await providerApiCall('smsbower', 'getPrices', { service: 'fb' });
      if (bowerPrices.startsWith('{')) {
        const parsed = JSON.parse(bowerPrices);
        // Loop through countryId keys
        Object.keys(parsed).forEach(countryIdStr => {
          const countryData = parsed[countryIdStr];
          if (countryData && countryData['fb']) {
            const costUsd = Number(countryData['fb'].cost);
            const costPkr = costUsd * 280; // approximate USD conversion
            
            if (costPkr < 10) {
              const countryId = Number(countryIdStr);
              // Simple mapped country names for a couple ids or generic
              let name = `Country #${countryId}`;
              if (countryId === 12) name = "USA";
              else if (countryId === 30) name = "Yemen";
              else if (countryId === 15) name = "Poland";
              else if (countryId === 16) name = "United Kingdom";
              else if (countryId === 38) name = "Ghana";
              
              discovered.push({
                name,
                provider: 'smsbower',
                countryId,
                providerId: 3228, // sample provider ID
                maxPrice: costUsd,
                sell: Math.ceil(costPkr + 5) // cost + 5 PKR profit
              });
            }
          }
        });
      }
    } catch (e) {
      console.warn("Could not fetch discovery list from SMSBOWER API, using mock discovered countries:", e);
    }

    // Add pre-seeded discovered list if API failed or returned empty
    if (discovered.length === 0) {
      discovered = [
        { name: "Poland", provider: "smsbower", countryId: 15, providerId: 3228, maxPrice: 0.015, sell: 9 },
        { name: "UK", provider: "smsbower", countryId: 16, providerId: 3228, maxPrice: 0.018, sell: 10 },
        { name: "Yemen Auto", provider: "smsbower", countryId: 30, providerId: 2377, maxPrice: 0.004, sell: 6 }
      ];
    }

    // Merge with current countries
    const currentJson = db.getSettingValue('countries', '[]');
    const currentCountries: CountryConfig[] = JSON.parse(currentJson);
    
    discovered.forEach(disc => {
      // Check if country already exists
      const exists = currentCountries.some(c => c.name.toLowerCase() === disc.name.toLowerCase() && c.provider === disc.provider);
      if (!exists) {
        currentCountries.push(disc);
      }
    });

    db.setSettingValue('countries', JSON.stringify(currentCountries));
    db.addLog("COUNTRIES_DISCOVER", `Discovered and added cheap country configurations. Total now: ${currentCountries.length}`, (req as any).user.id);

    res.json({ success: true, count: discovered.length, countries: currentCountries });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// GET AUDIT LOGS
app.get('/api/admin/logs', requireAdmin, (req, res) => {
  res.json(db.getLogs());
});

// GET SERVICES (Public read/Admin write)
app.get('/api/services', (req, res) => {
  res.json(db.getServices());
});

// ==========================================
// CLIENT HISTORY / PRIVATE RECORDS ENDPOINTS
// ==========================================

// Get client wallet info
app.get('/api/client/wallet', requireAuth, (req, res) => {
  try {
    const user = (req as any).user;
    const wallet = db.getWalletByUserId(user.id);
    res.json(wallet);
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// Client wallet activations
app.get('/api/client/activations', requireAuth, (req, res) => {
  const user = (req as any).user;
  const list = db.getActivations().filter(a => a.created_by_id === user.id);
  res.json(list);
});

// Client mail activations
app.get('/api/client/mail-activations', requireAuth, (req, res) => {
  const user = (req as any).user;
  const list = db.getMailActivations().filter(a => a.created_by_id === user.id);
  res.json(list);
});

// Client bought Facebook IDs
app.get('/api/client/facebook-ids', requireAuth, (req, res) => {
  const user = (req as any).user;
  const list = db.getFacebookIds().filter(f => f.sold_to_id === user.id);
  res.json(list);
});

// Client transactions
app.get('/api/client/transactions', requireAuth, (req, res) => {
  const user = (req as any).user;
  const list = db.getTransactions().filter(t => t.user_id === user.id);
  res.json(list);
});

// Client deposit requests
app.get('/api/client/deposits', requireAuth, (req, res) => {
  const user = (req as any).user;
  const list = db.getDepositRequests().filter(d => d.user_id === user.id);
  res.json(list);
});

// Get settings public values
app.get('/api/settings/public', (req, res) => {
  try {
    const contactInfo = JSON.parse(db.getSettingValue('contact_info', '{}'));
    const depositMethods = JSON.parse(db.getSettingValue('deposit_methods', '[]'));
    const gmailPrice = Number(db.getSettingValue('gmail_price', '15'));
    const gmailMailPrice = Number(db.getSettingValue('gmail_mail_price', '20'));
    const publicOtpUrl = db.getSettingValue('public_otp_url', '');
    const countries = JSON.parse(db.getSettingValue('countries', '[]'));

    res.json({
      contactInfo,
      depositMethods,
      gmailPrice,
      gmailMailPrice,
      publicOtpUrl,
      countries
    });
  } catch (e: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: e.message });
  }
});

// Full Admin Settings Read
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const countries = JSON.parse(db.getSettingValue('countries', '[]'));
    const contactInfo = JSON.parse(db.getSettingValue('contact_info', '{}'));
    const depositMethods = JSON.parse(db.getSettingValue('deposit_methods', '[]'));
    const gmailPrice = Number(db.getSettingValue('gmail_price', '15'));
    const gmailMailPrice = Number(db.getSettingValue('gmail_mail_price', '20'));
    const gmailMailMaxPrice = Number(db.getSettingValue('gmail_mail_max_price', '0.05'));
    const publicOtpUrl = db.getSettingValue('public_otp_url', '');
    const otpApiKey = db.getSettingValue('otp_api_key', process.env.OTP_API_KEY || '');
    const vsimproApiKey = db.getSettingValue('vsimpro_api_key', process.env.VSIMPRO_API_KEY || '');
    const smsbowerBaseUrl = db.getSettingValue('smsbower_base_url', 'https://smsbower.page');
    const mailServiceCode = db.getSettingValue('mail_service_code', 'fb');
    const mailDomain = db.getSettingValue('mail_domain', 'gmail.com');
    const mailRef = db.getSettingValue('mail_ref', '');
    const mailAlias = db.getSettingValue('mail_alias', '');

    res.json({
      countries,
      contactInfo,
      depositMethods,
      gmailPrice,
      gmailMailPrice,
      gmailMailMaxPrice,
      publicOtpUrl,
      otpApiKey,
      vsimproApiKey,
      smsbowerBaseUrl,
      mailServiceCode,
      mailDomain,
      mailRef,
      mailAlias
    });
  } catch (e: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: e.message });
  }
});

// Admin Live API & Real Stock Diagnostics Tool
app.post('/api/admin/test-api', requireAdmin, async (req, res) => {
  try {
    const { provider = 'smsbower', apiKey, baseUrl } = req.body;
    const testKey = (apiKey && typeof apiKey === 'string' && apiKey.trim()) 
      ? apiKey.trim() 
      : (provider === 'smsbower' ? getOtpApiKey() : getVsimproApiKey());
    
    const isConfigured = isKeyConfigured(testKey);

    const startTime = Date.now();
    
    // 1. Test getBalance
    let balanceRes = '';
    try {
      balanceRes = await providerApiCall(provider, 'getBalance', {});
    } catch (e: any) {
      balanceRes = `ERROR: ${e.message}`;
    }

    // 2. Test getPrices for fb service
    let pricesRes = '';
    try {
      pricesRes = await providerApiCall(provider, 'getPrices', { service: 'fb' });
    } catch (e: any) {
      pricesRes = `ERROR: ${e.message}`;
    }

    // 3. Test getNumbersStatus
    let statusRes = '';
    try {
      statusRes = await providerApiCall(provider, 'getNumbersStatus', {});
    } catch (e: any) {
      statusRes = `ERROR: ${e.message}`;
    }

    const latency = Date.now() - startTime;
    
    // Extract stock for configured countries
    const stockMap: Record<string, number> = {};
    const countriesJson = db.getSettingValue('countries', '[]');
    const countries: CountryConfig[] = JSON.parse(countriesJson);

    countries.forEach(c => {
      if ((c.provider || 'smsbower') === provider) {
        const stock = extractStockCount(pricesRes, c.countryId, 'fb', c.providerId, c.maxPrice) 
          ?? extractStockCount(statusRes, c.countryId, 'fb', c.providerId, c.maxPrice)
          ?? (isConfigured ? 0 : Math.max(10, (Number(c.countryId) * 17 + 29) % 135));
        stockMap[`${c.name} (ID: ${c.countryId}${c.providerId ? `, Prov: ${c.providerId}` : ''})`] = stock;
      }
    });

    res.json({
      success: true,
      provider,
      isConfigured,
      latencyMs: latency,
      balanceRaw: balanceRes,
      pricesPreview: pricesRes.substring(0, 1000),
      statusPreview: statusRes.substring(0, 1000),
      detectedStock: stockMap,
      allCountriesCount: countries.length
    });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});


// ==========================================
// ADMIN WORK WITH INVENTORY AND DEPOSITS
// ==========================================

// List all deposit requests for Admin
app.get('/api/admin/deposits', requireAdmin, (req, res) => {
  const list = db.getDepositRequests();
  // Attach user details
  const users = db.getUsers();
  const detailed = list.map(d => {
    const client = users.find(u => u.id === d.user_id);
    return {
      ...d,
      clientEmail: client ? client.email : "Unknown Client",
      clientName: client ? client.full_name : "Unknown"
    };
  });
  res.json(detailed);
});

// Manage Facebook IDs Inventory for Admin
app.get('/api/admin/fb-ids', requireAdmin, (req, res) => {
  const list = db.getFacebookIds();
  const users = db.getUsers();
  const detailed = list.map(f => {
    const client = f.sold_to_id ? users.find(u => u.id === f.sold_to_id) : null;
    return {
      ...f,
      clientEmail: client ? client.email : undefined
    };
  });
  res.json(detailed);
});

// Add multiple FB IDs to inventory
app.post('/api/admin/fb-ids', requireAdmin, (req, res) => {
  const admin = (req as any).user;
  const { accounts } = req.body; // Array of { uid, password }
  
  if (!accounts || !Array.isArray(accounts)) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "Accounts array is required" });
  }

  try {
    let added = 0;
    accounts.forEach(acc => {
      if (acc.uid && acc.password) {
        db.addFacebookId({
          uid: acc.uid,
          password: acc.password,
          status: 'available',
          price: 32,
          created_by_id: admin.id
        });
        added++;
      }
    });

    db.addLog("INVENTORY_ADD_FB", `Added ${added} Facebook accounts to inventory`, admin.id);
    res.json({ success: true, count: added });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});

// Delete an FB ID from inventory
app.delete('/api/admin/fb-ids/:id', requireAdmin, (req, res) => {
  const admin = (req as any).user;
  const { id } = req.params;

  try {
    db.deleteFacebookId(id);
    db.addLog("INVENTORY_DEL_FB", `Deleted Facebook ID entry: ${id}`, admin.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "SERVER_ERROR", message: error.message });
  }
});


// ==========================================
// VITE DEV SERVER & PRODUCTION ROUTING SETUP
// ==========================================

async function startServer() {
  // Connect to MongoDB and fetch latest state before handling any request
  try {
    await db.initMongo();
  } catch (err) {
    console.error("[SERVER] MongoDB initialization failed, fallback to local file DB:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    // Development mode with Vite HMR Middleware
    if (!process.env.VERCEL) {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[SERVER] Vite dev server middleware mounted");
    }
  } else {
    // Production Mode: Serve Compiled Frontend Assets
    if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log("[SERVER] Production static handler mounted serving dist/");
    }
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[SERVER] SMSFlow Panel backend running on http://localhost:${PORT}`);
    });
  }
}

if (require.main === module) {
  startServer();
}
