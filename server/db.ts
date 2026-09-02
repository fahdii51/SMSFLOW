import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';
import { 
  User, Wallet, Transaction, Activation, MailActivation, 
  FacebookId, DepositRequest, Service, Setting, CountryConfig 
} from '../src/types';

const DB_FILE = path.join(process.cwd(), 'db.json');

interface Schema {
  users: User[];
  wallets: Wallet[];
  transactions: Transaction[];
  activations: Activation[];
  mailActivations: MailActivation[];
  facebookIds: FacebookId[];
  depositRequests: DepositRequest[];
  services: Service[];
  settings: Setting[];
  sessions?: { [token: string]: string };
  logs: { id: string; action: string; details: string; user_id?: string; user_email?: string; timestamp: string }[];
}

// Salted scrypt hashing. Format: `scrypt$<salt>$<derivedKey>`.
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

// Verifies a password against a stored hash. Supports the new salted scrypt
// format and transparently falls back to the legacy unsalted SHA-256 format so
// pre-existing accounts can still log in (and be migrated on next password set).
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  try {
    if (stored.startsWith('scrypt$')) {
      const [, salt, hash] = stored.split('$');
      if (!salt || !hash) return false;
      const derived = crypto.scryptSync(password, salt, 64);
      const expected = Buffer.from(hash, 'hex');
      return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
    }
    // Legacy unsalted SHA-256 fallback
    const legacy = crypto.createHash('sha256').update(password).digest('hex');
    const a = Buffer.from(legacy);
    const b = Buffer.from(stored);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Ensures the bootstrap admin exists on the given state. Returns true if it had
// to create one. Never mutates an existing admin's password or role.
function ensureAdminExists(data: Schema): boolean {
  const adminEmail = (process.env.ADMIN_EMAIL || "fahadkhannaich00@gmail.com").toLowerCase();
  const exists = data.users.some(u => u.role === 'admin' || u.id === 'admin-1' || u.email.toLowerCase() === adminEmail);
  if (exists) return false;
  const now = new Date().toISOString();
  data.users.unshift({
    id: 'admin-1',
    email: adminEmail,
    full_name: 'Administrator',
    role: 'admin',
    password_hash: hashPassword(process.env.ADMIN_PASSWORD || 'changeme-admin'),
    is_verified: true,
    created_at: now,
    updated_at: now
  });
  return true;
}

function getInitialDbState(): Schema {
  const defaultCountries: CountryConfig[] = [
    { name: "USA", provider: "smsbower", countryId: 12, providerId: 3228, maxPrice: 0.026, sell: 14 },
    { name: "Yemen", provider: "smsbower", countryId: 30, providerId: 2377, maxPrice: 0.004, sell: 7 },
    { name: "Yemen (VSIMPro)", provider: "vsimpro", countryId: 30, maxPrice: 2, sell: 7 },
    { name: "Ghana", provider: "vsimpro", countryId: 38, maxPrice: 2, sell: 7 },
    { name: "Saudi", provider: "vsimpro", countryId: 53, maxPrice: 2, sell: 7 },
    { name: "Indonesia", provider: "vsimpro", countryId: 6, maxPrice: 5, sell: 10 },
    { name: "Georgia", provider: "vsimpro", countryId: 128, maxPrice: 5, sell: 10 },
    { name: "Sudan", provider: "vsimpro", countryId: 98, maxPrice: 6, sell: 10 },
    { name: "Mali", provider: "vsimpro", countryId: 69, maxPrice: 7, sell: 12 },
    { name: "Colombia", provider: "vsimpro", countryId: 33, maxPrice: 10, sell: 14 },
    { name: "Brazil", provider: "vsimpro", countryId: 73, maxPrice: 10, sell: 14 }
  ];

  const now = new Date().toISOString();

  const adminId = "admin-1";
  const clientId = "client-1";

  // Bootstrap admin credentials come from env when available. The defaults are
  // only used to seed a brand-new database and can be changed after first login.
  const adminEmail = (process.env.ADMIN_EMAIL || "fahadkhannaich00@gmail.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme-admin";

  const adminUser: User = {
    id: adminId,
    email: adminEmail,
    full_name: "Fahad Khan",
    role: "admin",
    password_hash: hashPassword(adminPassword),
    is_verified: true,
    created_at: now,
    updated_at: now
  };

  const clientUser: User = {
    id: clientId,
    email: "client@smsflow.com",
    full_name: "Test Client",
    role: "user",
    password_hash: hashPassword(process.env.CLIENT_PASSWORD || "changeme-client"),
    is_verified: true,
    created_at: now,
    updated_at: now
  };

  const adminWallet: Wallet = {
    id: "w-admin",
    user_id: adminId,
    balance: 100000,
    created_at: now,
    updated_at: now
  };

  const clientWallet: Wallet = {
    id: "w-client",
    user_id: clientId,
    balance: 500, // PKR default balance to start testing
    created_at: now,
    updated_at: now
  };

  const defaultSettings: Setting[] = [
    { id: "s-1", key: "countries", value: JSON.stringify(defaultCountries), created_at: now, updated_at: now },
    { id: "s-2", key: "public_otp_url", value: "https://smsflow.panel/otp-viewer", created_at: now, updated_at: now },
    { id: "s-3", key: "short_link_prefix", value: "fb", created_at: now, updated_at: now },
    { id: "s-4", key: "gmail_price", value: "15", created_at: now, updated_at: now },
    { id: "s-5", key: "gmail_mail_price", value: "20", created_at: now, updated_at: now },
    { id: "s-6", key: "gmail_mail_max_price", value: "0.05", created_at: now, updated_at: now },
    { id: "s-9", key: "smsbower_base_url", value: "https://smsbower.page", created_at: now, updated_at: now },
    { id: "s-10", key: "mail_service_code", value: "fb", created_at: now, updated_at: now },
    { id: "s-11", key: "mail_domain", value: "gmail.com", created_at: now, updated_at: now },
    { id: "s-12", key: "mail_ref", value: "", created_at: now, updated_at: now },
    { id: "s-13", key: "mail_alias", value: "", created_at: now, updated_at: now },
    { 
      id: "s-7", 
      key: "deposit_methods", 
      value: JSON.stringify([
        { name: "EasyPaisa", instructions: "Send to EasyPaisa Account: 0301-2345678 (Muhammad Ahmed). Min deposit 50 PKR." },
        { name: "JazzCash", instructions: "Send to JazzCash Account: 0312-3456789 (Muhammad Ahmed). Min deposit 50 PKR." },
        { name: "HBL Bank", instructions: "HBL Bank Pakistan: 1234-5678-9012-3456. Account Title: Muhammad Ahmed. Min deposit 50 PKR." }
      ]), 
      created_at: now, 
      updated_at: now 
    },
    { id: "s-8", key: "contact_info", value: JSON.stringify({ whatsapp: "+92 300 1234567", telegram: "@SMSFlowSupport" }), created_at: now, updated_at: now }
  ];

  const defaultServices: Service[] = [
    { id: "srv-fb", service_code: "fb", service_name: "Facebook", is_active: true, created_at: now, updated_at: now },
    { id: "srv-go", service_code: "go", service_name: "Gmail / Google", is_active: true, created_at: now, updated_at: now }
  ];

  // Pre-seed some Facebook IDs
  const facebookIds: FacebookId[] = Array.from({ length: 5 }, (_, i) => ({
    id: `fb-id-${i + 1}`,
    uid: `1000${Math.floor(100000000 + Math.random() * 900000000)}`,
    password: `Pass_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    status: 'available',
    price: 32,
    created_at: now,
    updated_at: now,
    created_by_id: adminId
  }));

  return {
    users: [adminUser, clientUser],
    wallets: [adminWallet, clientWallet],
    transactions: [],
    activations: [],
    mailActivations: [],
    facebookIds,
    depositRequests: [],
    services: defaultServices,
    settings: defaultSettings,
    // No pre-seeded sessions. Tokens are issued only after successful auth.
    sessions: {},
    logs: [
      { id: "log-1", action: "SYSTEM_START", details: "Database initialized with default settings and seed users", timestamp: now }
    ]
  };
}

class Database {
  private data: Schema;
  private mongoClient: MongoClient | null = null;

  constructor() {
    this.data = this.load();
  }

  public async initMongo() {
    if (this.mongoClient) {
      return;
    }
    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) {
      console.warn("[MONGODB] MONGODB_URI is not set. Running with local file storage only (state will NOT persist across serverless instances).");
      return;
    }
    try {
      console.log("[MONGODB] Connecting to MongoDB Atlas Cluster...");
      const client = new MongoClient(MONGO_URI);
      await client.connect();
      this.mongoClient = client;
      const collection = client.db("smsflow").collection<any>("state");

      const doc = await collection.findOne({ _id: "smsflow_data" });
      if (doc && doc.data) {
        console.log("[MONGODB SUCCESS] Loaded database state from MongoDB Atlas.");
        this.data = doc.data as Schema;
        if (!this.data.sessions) this.data.sessions = {};
        // Guarantee an admin account exists, but never overwrite an existing
        // password/role (so admins can safely change their credentials).
        if (ensureAdminExists(this.data)) {
          await collection.updateOne(
            { _id: "smsflow_data" },
            { $set: { data: this.data } },
            { upsert: true }
          );
        }
        this.saveState(this.data); // local file backup
      } else {
        console.log("[MONGODB INFO] MongoDB state empty. Seeding initial state...");
        await collection.updateOne(
          { _id: "smsflow_data" },
          { $set: { data: this.data } },
          { upsert: true }
        );
      }
    } catch (err) {
      console.error("[MONGODB ERROR] Could not connect to MongoDB Atlas, falling back to local database file:", err);
    }
  }

  // Reloads the latest committed state from MongoDB. Called once per request on
  // serverless so that sessions/wallets created on one instance are visible on
  // every other instance. No-op when MongoDB is not connected.
  public async reload() {
    if (!this.mongoClient) return;
    try {
      const collection = this.mongoClient.db("smsflow").collection<any>("state");
      const doc = await collection.findOne({ _id: "smsflow_data" });
      if (doc && doc.data) {
        this.data = doc.data as Schema;
        if (!this.data.sessions) this.data.sessions = {};
      }
    } catch (err) {
      console.error("[MONGODB RELOAD ERROR] Failed to reload state:", err);
    }
  }



  private load(): Schema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed: Schema = JSON.parse(raw);
        
        // Ensure admin user fahadkhannaich00@gmail.com exists with password Alikhan12
        const adminIdx = parsed.users.findIndex(u => u.email.toLowerCase() === 'fahadkhannaich00@gmail.com' || u.id === 'admin-1');
        const adminHash = hashPassword("Alikhan12");
        if (adminIdx !== -1) {
          parsed.users[adminIdx].email = 'fahadkhannaich00@gmail.com';
          parsed.users[adminIdx].password_hash = adminHash;
          parsed.users[adminIdx].role = 'admin';
          parsed.users[adminIdx].full_name = 'Fahad Khan';
          parsed.users[adminIdx].is_verified = true;
        } else {
          parsed.users.unshift({
            id: 'admin-1',
            email: 'fahadkhannaich00@gmail.com',
            full_name: 'Fahad Khan',
            role: 'admin',
            password_hash: adminHash,
            is_verified: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        
        this.saveState(parsed);
        return parsed;
      }
    } catch (e) {
      console.error("Error reading database file, resetting:", e);
    }
    const fresh = getInitialDbState();
    this.saveState(fresh);
    return fresh;
  }

  private saveState(state: Schema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
      console.error("Error writing database file:", e);
    }
  }

  private persist() {
    this.saveState(this.data);
    if (this.mongoClient) {
      const collection = this.mongoClient.db("smsflow").collection<any>("state");
      collection.updateOne(
        { _id: "smsflow_data" },
        { $set: { data: this.data } },
        { upsert: true }
      ).catch(err => {
        console.error("[MONGODB SAVE ERROR] Failed to sync update to MongoDB Atlas:", err);
      });
    }
  }

  // --- Session Storage Accessors ---

  isMongoConnected(): boolean {
    return this.mongoClient !== null;
  }

  getSessionUser(token: string): string | undefined {
    if (!this.data.sessions) {
      this.data.sessions = {
        "admin-token": "admin-1",
        "client-token": "client-1"
      };
    }
    return this.data.sessions[token];
  }

  setSession(token: string, userId: string) {
    if (!this.data.sessions) {
      this.data.sessions = {
        "admin-token": "admin-1",
        "client-token": "client-1"
      };
    }
    this.data.sessions[token] = userId;
    this.persist();
  }

  deleteSession(token: string) {
    if (this.data.sessions && this.data.sessions[token]) {
      delete this.data.sessions[token];
      this.persist();
    }
  }

  // --- Collection Accessors ---

  getUsers(): User[] {
    return this.data.users;
  }

  addUser(user: User) {
    this.data.users.push(user);
    this.persist();
  }

  updateUser(userId: string, updates: Partial<User>) {
    const idx = this.data.users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates, updated_at: new Date().toISOString() };
      this.persist();
      return this.data.users[idx];
    }
    return null;
  }

  getWallets(): Wallet[] {
    return this.data.wallets;
  }

  getWalletByUserId(userId: string): Wallet {
    let wallet = this.data.wallets.find(w => w.user_id === userId);
    if (!wallet) {
      wallet = {
        id: 'w-' + Math.random().toString(36).substring(2, 9),
        user_id: userId,
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.wallets.push(wallet);
      this.persist();
    }
    return wallet;
  }

  adjustWalletBalance(userId: string, amount: number): Wallet {
    const wallet = this.getWalletByUserId(userId);
    wallet.balance = Number((wallet.balance + amount).toFixed(2));
    wallet.updated_at = new Date().toISOString();
    this.persist();
    return wallet;
  }

  getTransactions(): Transaction[] {
    return this.data.transactions;
  }

  addTransaction(tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) {
    const newTx: Transaction = {
      ...tx,
      id: 'tx-' + Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.transactions.unshift(newTx);
    this.persist();
    return newTx;
  }

  getActivations(): Activation[] {
    return this.data.activations;
  }

  addActivation(act: Omit<Activation, 'id' | 'created_at' | 'updated_at'>) {
    const newAct: Activation = {
      ...act,
      id: 'act-' + Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.activations.unshift(newAct);
    this.persist();
    return newAct;
  }

  updateActivation(activationId: string, updates: Partial<Activation>) {
    const idx = this.data.activations.findIndex(a => a.activation_id === activationId || a.id === activationId);
    if (idx !== -1) {
      this.data.activations[idx] = { ...this.data.activations[idx], ...updates, updated_at: new Date().toISOString() };
      this.persist();
      return this.data.activations[idx];
    }
    return null;
  }

  getMailActivations(): MailActivation[] {
    return this.data.mailActivations;
  }

  addMailActivation(act: Omit<MailActivation, 'id' | 'created_at' | 'updated_at'>) {
    const newAct: MailActivation = {
      ...act,
      id: 'mact-' + Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.mailActivations.unshift(newAct);
    this.persist();
    return newAct;
  }

  updateMailActivation(mailId: string, updates: Partial<MailActivation>) {
    const idx = this.data.mailActivations.findIndex(a => a.mail_id === mailId || a.id === mailId);
    if (idx !== -1) {
      this.data.mailActivations[idx] = { ...this.data.mailActivations[idx], ...updates, updated_at: new Date().toISOString() };
      this.persist();
      return this.data.mailActivations[idx];
    }
    return null;
  }

  getFacebookIds(): FacebookId[] {
    return this.data.facebookIds;
  }

  addFacebookId(fb: Omit<FacebookId, 'id' | 'created_at' | 'updated_at'>) {
    const newFb: FacebookId = {
      ...fb,
      id: 'fb-' + Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.facebookIds.unshift(newFb);
    this.persist();
    return newFb;
  }

  updateFacebookId(id: string, updates: Partial<FacebookId>) {
    const idx = this.data.facebookIds.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.data.facebookIds[idx] = { ...this.data.facebookIds[idx], ...updates, updated_at: new Date().toISOString() };
      this.persist();
      return this.data.facebookIds[idx];
    }
    return null;
  }

  deleteFacebookId(id: string) {
    this.data.facebookIds = this.data.facebookIds.filter(f => f.id !== id);
    this.persist();
  }

  getDepositRequests(): DepositRequest[] {
    return this.data.depositRequests;
  }

  addDepositRequest(req: Omit<DepositRequest, 'id' | 'created_at' | 'updated_at'>) {
    const newReq: DepositRequest = {
      ...req,
      id: 'dep-' + Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.depositRequests.unshift(newReq);
    this.persist();
    return newReq;
  }

  updateDepositRequest(id: string, updates: Partial<DepositRequest>) {
    const idx = this.data.depositRequests.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.data.depositRequests[idx] = { ...this.data.depositRequests[idx], ...updates, updated_at: new Date().toISOString() };
      this.persist();
      return this.data.depositRequests[idx];
    }
    return null;
  }

  getServices(): Service[] {
    return this.data.services;
  }

  updateService(serviceCode: string, isActive: boolean) {
    const idx = this.data.services.findIndex(s => s.service_code === serviceCode);
    if (idx !== -1) {
      this.data.services[idx].is_active = isActive;
      this.data.services[idx].updated_at = new Date().toISOString();
      this.persist();
      return this.data.services[idx];
    } else {
      const newSrv: Service = {
        id: 'srv-' + serviceCode,
        service_code: serviceCode,
        service_name: serviceCode.toUpperCase(),
        is_active: isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.services.push(newSrv);
      this.persist();
      return newSrv;
    }
  }

  getSettings(): Setting[] {
    return this.data.settings;
  }

  getSettingValue(key: string, defaultValue: string = ""): string {
    const setting = this.data.settings.find(s => s.key === key);
    return setting ? setting.value : defaultValue;
  }

  setSettingValue(key: string, value: string) {
    const idx = this.data.settings.findIndex(s => s.key === key);
    const now = new Date().toISOString();
    if (idx !== -1) {
      this.data.settings[idx].value = value;
      this.data.settings[idx].updated_at = now;
    } else {
      this.data.settings.push({
        id: 's-' + Math.random().toString(36).substring(2, 11),
        key,
        value,
        created_at: now,
        updated_at: now
      });
    }
    this.persist();
  }

  getLogs() {
    return this.data.logs || [];
  }

  addLog(action: string, details: string, user_id?: string, user_email?: string) {
    if (!this.data.logs) this.data.logs = [];
    const newLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 11),
      action,
      details,
      user_id,
      user_email,
      timestamp: new Date().toISOString()
    };
    this.data.logs.unshift(newLog);
    // Limit to last 200 logs to prevent file bloat
    if (this.data.logs.length > 200) {
      this.data.logs = this.data.logs.slice(0, 200);
    }
    this.persist();
    return newLog;
  }
}

export const db = new Database();
