import React, { useState, useEffect } from 'react';
import { 
  Users, Smartphone, DollarSign, ListFilter, ShieldCheck, 
  Settings, Database, RefreshCw, Check, X, PlusCircle, Trash2, 
  HelpCircle, Eye, Sliders, Globe, Search, AlertCircle, Key, Activity,
  CreditCard, Pencil
} from 'lucide-react';

interface AdminPanelProps {
  token: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  adminTab: string;
  onLogout: () => void;
}

export default function AdminPanel({ token, showToast, adminTab, onLogout }: AdminPanelProps) {
  const [stats, setStats] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [fbIds, setFbIds] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    countries: '[]',
    public_otp_url: '',
    short_link_prefix: '',
    gmail_price: '15',
    gmail_mail_price: '20',
    gmail_mail_max_price: '0.05',
    mail_service_code: 'fb',
    mail_domain: 'gmail.com',
    mail_ref: '',
    mail_alias: '',
    deposit_methods: '[]',
    contact_info: '{}'
  });

  const [loading, setLoading] = useState(false);

  // Modals / Inputs
  const [adjustingClient, setAdjustingClient] = useState<any | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');
  
  const [bulkFbInput, setBulkFbInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiTestResults, setApiTestResults] = useState<any>(null);

  // Manual Country Form State
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryId, setNewCountryId] = useState('');
  const [newProviderId, setNewProviderId] = useState('');
  const [newProvider, setNewProvider] = useState<'smsbower' | 'vsimpro'>('smsbower');
  const [newMaxPrice, setNewMaxPrice] = useState('');
  const [newMinPrice, setNewMinPrice] = useState('');
  const [newSell, setNewSell] = useState('');

  // Manual Deposit Method Form State
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodInstructions, setNewMethodInstructions] = useState('');
  const [editingMethodIndex, setEditingMethodIndex] = useState<number | null>(null);

  // Fetch functions
  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setStats(d);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchClients() {
    try {
      const res = await fetch('/api/admin/clients', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setClients(d);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchServices() {
    try {
      const res = await fetch('/api/services');
      const d = await res.json();
      if (res.ok) setServices(d);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchDeposits() {
    try {
      const res = await fetch('/api/admin/deposits', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setDeposits(d);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchFbIds() {
    try {
      const res = await fetch('/api/admin/fb-ids', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setFbIds(d);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch('/api/admin/logs', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setLogs(d);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        setSettings({
          countries: d.countries ? JSON.stringify(d.countries, null, 2) : '[]',
          public_otp_url: d.publicOtpUrl || '',
          short_link_prefix: 'fb',
          gmail_price: String(d.gmailPrice || '15'),
          gmail_mail_price: String(d.gmailMailPrice || '20'),
          gmail_mail_max_price: String(d.gmailMailMaxPrice || '0.05'),
          mail_service_code: d.mailServiceCode || 'fb',
          mail_domain: d.mailDomain || 'gmail.com',
          mail_ref: d.mailRef || '',
          mail_alias: d.mailAlias || '',
          deposit_methods: d.depositMethods ? JSON.stringify(d.depositMethods, null, 2) : '[]',
          contact_info: d.contactInfo ? JSON.stringify(d.contactInfo, null, 2) : '{}',
          otp_api_key: d.otpApiKey || '',
          vsimpro_api_key: d.vsimproApiKey || '',
          smsbower_base_url: d.smsbowerBaseUrl || 'https://smsbower.page'
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (adminTab === 'admin-dashboard') fetchStats();
    if (adminTab === 'admin-clients') fetchClients();
    if (adminTab === 'admin-services') fetchServices();
    if (adminTab === 'admin-deposits') fetchDeposits();
    if (adminTab === 'admin-fb-ids') fetchFbIds();
    if (adminTab === 'admin-settings') fetchSettings();
    if (adminTab === 'admin-logs') fetchLogs();
  }, [adminTab]);

  // Adjust Balance Action
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingClient || !adjustAmount) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/adjust-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: adjustingClient.id,
          amount: Number(adjustAmount),
          description: adjustDesc || 'Admin Adjustment'
        })
      });
      if (res.ok) {
        showToast("Balance adjusted successfully!", "success");
        setAdjustingClient(null);
        setAdjustAmount('');
        setAdjustDesc('');
        fetchClients();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || "Adjustment failed", "error");
      }
    } catch (e) {
      showToast("Server error adjusting balance", "error");
    } finally {
      setLoading(false);
    }
  };

  // Toggle service active status
  const handleToggleService = async (serviceCode: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/toggle-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ serviceCode, isActive: !currentStatus })
      });
      if (res.ok) {
        showToast("Service toggled successfully", "success");
        fetchServices();
      }
    } catch (e) {
      showToast("Failed to toggle service", "error");
    }
  };

  // Bulk FB Accounts add
  const handleBulkFbAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFbInput.trim()) return;

    setLoading(true);
    try {
      // Split by newlines, parse "uid,password" or "uid|password"
      const lines = bulkFbInput.split('\n');
      const accounts: any[] = [];
      lines.forEach(line => {
        const parts = line.includes(',') ? line.split(',') : line.split('|');
        if (parts[0] && parts[1]) {
          accounts.push({
            uid: parts[0].trim(),
            password: parts[1].trim()
          });
        }
      });

      if (accounts.length === 0) {
        showToast("Could not parse any accounts. Format: uid,password", "error");
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/fb-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ accounts })
      });

      if (res.ok) {
        const r = await res.json();
        showToast(`Successfully uploaded ${r.count} accounts to stock!`, "success");
        setBulkFbInput('');
        fetchFbIds();
      } else {
        showToast("Upload failed", "error");
      }
    } catch (e) {
      showToast("Server upload error", "error");
    } finally {
      setLoading(false);
    }
  };

  // Delete FB ID
  const handleDeleteFbId = async (id: string) => {
    if (!confirm("Delete this FB account from stock?")) return;
    try {
      const res = await fetch(`/api/admin/fb-ids/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast("Account removed from stock", "success");
        fetchFbIds();
      }
    } catch (e) {
      showToast("Failed to delete", "error");
    }
  };

  // Handle Deposit Request
  const handleDepositRequest = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/handle-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, action })
      });
      const d = await res.json();
      if (res.ok) {
        showToast(d.message || "Deposit request processed", "success");
        fetchDeposits();
      } else {
        showToast(d.message || "Processing failed", "error");
      }
    } catch (e) {
      showToast("Failed to process request", "error");
    }
  };

  // Update Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      // Clean and map setting payload
      const payload: Record<string, any> = {};
      Object.keys(settings).forEach(k => {
        payload[k] = settings[k];
      });

      const res = await fetch('/api/admin/update-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("Global settings updated successfully!", "success");
        fetchSettings();
      } else {
        showToast("Failed to save settings", "error");
      }
    } catch (e) {
      showToast("Error updating settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Discover cheap countries
  const handleDiscoverCountries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/discover-countries', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        showToast(`Discovered ${d.count} cheap country options! Added to settings.`, "success");
        fetchSettings();
      } else {
        showToast("Discovery call failed", "error");
      }
    } catch (e) {
      showToast("Failed to call discover-countries", "error");
    } finally {
      setLoading(false);
    }
  };

  // Live Provider API & Stock Diagnostic Test
  const handleTestApi = async (provider: 'smsbower' | 'vsimpro' = 'smsbower') => {
    setTestingApi(true);
    setApiTestResults(null);
    try {
      const res = await fetch('/api/admin/test-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider,
          apiKey: provider === 'smsbower' ? settings.otp_api_key : settings.vsimpro_api_key,
          baseUrl: settings.smsbower_base_url
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setApiTestResults(data);
        if (data.isConfigured) {
          showToast(`API Test Success! Provider responded in ${data.latencyMs}ms. Real stock verified.`, "success");
        } else {
          showToast("Running in Sandbox Simulation mode (No live key set)", "success");
        }
      } else {
        showToast(data.message || "API test failed", "error");
      }
    } catch (e: any) {
      showToast("Failed to run API test: " + e.message, "error");
    } finally {
      setTestingApi(false);
    }
  };

  // Add a country manually
  const handleAddCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountryName || !newCountryId || !newMaxPrice || !newSell) {
      showToast("Please fill all required fields (Name, Country ID, Max Price, Selling Price)", "error");
      return;
    }

    let currentCountries: any[] = [];
    try {
      currentCountries = JSON.parse(settings.countries || '[]');
    } catch (err) {
      currentCountries = [];
    }

    const cleanedName = newCountryName.trim();
    // Check if duplicate country name or id on same provider
    const duplicate = currentCountries.find(c => 
      c.name.toLowerCase() === cleanedName.toLowerCase() && c.provider === newProvider
    );
    if (duplicate) {
      showToast(`Country '${cleanedName}' on '${newProvider}' already exists!`, "error");
      return;
    }

    const countryObj: any = {
      name: cleanedName,
      provider: newProvider,
      countryId: Number(newCountryId),
      maxPrice: Number(newMaxPrice),
      sell: Number(newSell)
    };

    if (newProviderId) {
      countryObj.providerId = Number(newProviderId);
    }
    if (newMinPrice) {
      countryObj.minPrice = Number(newMinPrice);
    }

    const updated = [...currentCountries, countryObj];
    const updatedJson = JSON.stringify(updated, null, 2);

    const newSettings = { ...settings, countries: updatedJson };
    setSettings(newSettings);

    // Auto save to server
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/update-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        showToast(`Country '${cleanedName}' successfully added and settings auto-saved!`, "success");
        // Reset form
        setNewCountryName('');
        setNewCountryId('');
        setNewProviderId('');
        setNewMaxPrice('');
        setNewMinPrice('');
        setNewSell('');
      } else {
        showToast("Failed to save country settings", "error");
      }
    } catch (err) {
      showToast("Error saving manual country config", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Delete a country manually
  const handleDeleteCountry = async (indexToDelete: number) => {
    let currentCountries: any[] = [];
    try {
      currentCountries = JSON.parse(settings.countries || '[]');
    } catch (err) {
      currentCountries = [];
    }

    const countryToDelete = currentCountries[indexToDelete];
    const updated = currentCountries.filter((_, idx) => idx !== indexToDelete);
    const updatedJson = JSON.stringify(updated, null, 2);

    const newSettings = { ...settings, countries: updatedJson };
    setSettings(newSettings);

    // Auto save to server
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/update-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        showToast(`Country '${countryToDelete?.name || ""}' deleted and settings saved!`, "success");
      } else {
        showToast("Failed to auto-save settings", "error");
      }
    } catch (err) {
      showToast("Error updating settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Add or edit a deposit method
  const handleAddDepositMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethodName.trim() || !newMethodInstructions.trim()) {
      showToast("Please enter both Method Name and Instructions", "error");
      return;
    }

    let currentMethods: any[] = [];
    try {
      currentMethods = JSON.parse(settings.deposit_methods || '[]');
    } catch (err) {
      currentMethods = [];
    }

    const methodObj = {
      name: newMethodName.trim(),
      instructions: newMethodInstructions.trim()
    };

    let updated: any[] = [];
    if (editingMethodIndex !== null && editingMethodIndex >= 0) {
      updated = [...currentMethods];
      updated[editingMethodIndex] = methodObj;
    } else {
      updated = [...currentMethods, methodObj];
    }

    const updatedJson = JSON.stringify(updated, null, 2);
    const newSettings = { ...settings, deposit_methods: updatedJson };
    setSettings(newSettings);

    // Auto save to server
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/update-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        showToast(editingMethodIndex !== null ? "Deposit method updated and saved!" : "New deposit method added and saved!", "success");
        setNewMethodName('');
        setNewMethodInstructions('');
        setEditingMethodIndex(null);
      } else {
        showToast("Failed to save deposit method", "error");
      }
    } catch (err) {
      showToast("Error saving deposit method", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Delete a deposit method
  const handleDeleteDepositMethod = async (indexToDelete: number) => {
    let currentMethods: any[] = [];
    try {
      currentMethods = JSON.parse(settings.deposit_methods || '[]');
    } catch (err) {
      currentMethods = [];
    }

    const methodToDelete = currentMethods[indexToDelete];
    const updated = currentMethods.filter((_, idx) => idx !== indexToDelete);
    const updatedJson = JSON.stringify(updated, null, 2);

    const newSettings = { ...settings, deposit_methods: updatedJson };
    setSettings(newSettings);

    // Auto save to server
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/update-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        showToast(`Deposit method '${methodToDelete?.name || ""}' deleted successfully!`, "success");
        if (editingMethodIndex === indexToDelete) {
          setNewMethodName('');
          setNewMethodInstructions('');
          setEditingMethodIndex(null);
        }
      } else {
        showToast("Failed to auto-save settings", "error");
      }
    } catch (err) {
      showToast("Error updating settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="w-full pb-20">
      
      {/* Tab: Admin Dashboard */}
      {adminTab === 'admin-dashboard' && stats && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-display flex items-center gap-1.5 text-purple-400">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
              Admin KPIs
            </h2>
            <button onClick={fetchStats} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:text-purple-400 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Database Connection Status Banner */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            stats.isMongoConnected 
              ? 'bg-emerald-950/20 border-emerald-500/10 text-emerald-400' 
              : 'bg-amber-950/20 border-amber-500/10 text-amber-400'
          }`}>
            <div className="flex items-center gap-3">
              <div className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  stats.isMongoConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  stats.isMongoConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}></span>
              </div>
              <div className="space-y-0.5">
                <p className="font-bold flex items-center gap-1.5">
                  {stats.isMongoConnected ? 'MongoDB Atlas Connected' : 'MongoDB Offline (Local Backup Active)'}
                </p>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  {stats.isMongoConnected 
                    ? 'All user data and sessions are persistently synced in real-time to MongoDB Atlas Cluster0.' 
                    : 'Temporary session fall-back is active. Re-connecting to your primary Atlas database in the background...'}
                </p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              stats.isMongoConnected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
            }`}>
              {stats.isMongoConnected ? 'Persistent' : 'Transient Backup'}
            </span>
          </div>

          {/* Core Metrics Cards Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl">
              <div className="flex justify-between items-center">
                <p className="text-xs text-zinc-500 font-medium">Total Clients</p>
                <Users className="w-4 h-4 text-purple-400/70" />
              </div>
              <p className="text-2xl font-bold font-display text-white mt-1.5">{stats.totalClients}</p>
              <p className="text-[10px] text-zinc-600 mt-1">Invited/Google Registered</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl">
              <div className="flex justify-between items-center">
                <p className="text-xs text-zinc-500 font-medium">Revenue (PKR)</p>
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-2xl font-bold font-display text-green-400 mt-1.5">
                Rs. {stats.revenue}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">Deduct - refund sum</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl">
              <div className="flex justify-between items-center">
                <p className="text-xs text-zinc-500 font-medium">SMSBOWER Balance</p>
                <Database className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold font-display text-amber-400 mt-1.5">
                ${stats.providerBalanceUsd?.toFixed(2)}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">~ Rs. {stats.providerBalancePkr?.toFixed(0)}</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl">
              <div className="flex justify-between items-center">
                <p className="text-xs text-zinc-500 font-medium">Total OTPs sold</p>
                <Smartphone className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-2xl font-bold font-display text-white mt-1.5">{stats.totalActivations}</p>
              <p className="text-[10px] text-zinc-600 mt-1">Numbers purchased</p>
            </div>
          </div>

          {/* Recent Activity Log Feed */}
          <div className="space-y-3">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Recent Activation Feed</h3>
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl divide-y divide-zinc-900 overflow-hidden">
              {stats.recentActivations?.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-600">No activations recorded yet</div>
              ) : (
                stats.recentActivations?.map((act: any) => (
                  <div key={act.id} className="p-3 text-xs flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-zinc-200">{act.phone_number}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Client: <span className="text-purple-400">{act.clientName}</span> • Service: {act.service_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                        act.status === 'completed' ? 'bg-green-950/40 text-green-400 border border-green-500/10' :
                        act.status === 'code_received' ? 'bg-purple-950/40 text-purple-300 border border-purple-500/10' :
                        act.status === 'cancelled' ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' :
                        'bg-yellow-950/40 text-yellow-500 border border-yellow-500/10'
                      }`}>
                        {act.status}
                      </span>
                      <p className="text-[10px] text-zinc-600 mt-1">Rs. {act.selling_price}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Admin Clients */}
      {adminTab === 'admin-clients' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-display text-purple-400">Client Accounts & Wallets</h2>
          
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden divide-y divide-zinc-900">
            {clients.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-600">No client users registered yet</div>
            ) : (
              clients.map((client) => (
                <div key={client.id} className="p-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{client.full_name}</h3>
                    <p className="text-xs text-zinc-500">{client.email}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">Joined: {new Date(client.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1.5">
                    <p className="text-sm font-bold text-green-400">Rs. {client.balance}</p>
                    <button
                      onClick={() => setAdjustingClient(client)}
                      className="px-2 py-1 bg-purple-950/40 text-purple-400 border border-purple-500/20 text-[10px] rounded hover:bg-purple-900/40 transition-all cursor-pointer"
                    >
                      Adjust Balance
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Adjust Balance Dialog */}
          {adjustingClient && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl w-full max-w-sm space-y-4 animate-pop-up">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                  <h3 className="font-bold text-base text-white">Adjust Balance</h3>
                  <button onClick={() => setAdjustingClient(null)} className="text-zinc-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-xs text-zinc-400">
                  Modifying balance for <strong className="text-white">{adjustingClient.full_name}</strong> ({adjustingClient.email}). Current: <strong className="text-green-400">Rs. {adjustingClient.balance}</strong>
                </p>

                <form onSubmit={handleAdjustBalance} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Amount (PKR) - Use negative value to deduct</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 500 or -200"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Reason / Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Received cash payment"
                      value={adjustDesc}
                      onChange={(e) => setAdjustDesc(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setAdjustingClient(null)}
                      className="px-4 py-2 bg-zinc-900 text-zinc-400 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 btn-primary rounded-xl text-xs font-semibold"
                    >
                      {loading ? "Processing..." : "Confirm Adjustment"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Admin Services */}
      {adminTab === 'admin-services' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-display text-purple-400">Sync & Toggle Services</h2>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/admin/sync-services', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (res.ok) {
                    showToast("Services synced with providers", "success");
                    fetchServices();
                  }
                } catch (e) {
                  showToast("Sync failed", "error");
                }
              }}
              className="flex items-center gap-1 py-1.5 px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-purple-300 hover:text-purple-200 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Services
            </button>
          </div>

          <p className="text-xs text-zinc-500">Enable or disable specific services for the resale portal:</p>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden divide-y divide-zinc-900">
            {services.map((srv) => (
              <div key={srv.service_code} className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-white">{srv.service_name}</h3>
                  <p className="text-xs text-zinc-600 font-mono">Service code: {srv.service_code}</p>
                </div>
                <div>
                  <button
                    onClick={() => handleToggleService(srv.service_code, srv.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      srv.is_active 
                        ? 'bg-purple-950/40 text-purple-300 border border-purple-500/30' 
                        : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                    }`}
                  >
                    {srv.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Admin Deposits */}
      {adminTab === 'admin-deposits' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-display text-purple-400 font-display">Deposit Approvals</h2>
          <div className="space-y-3">
            {deposits.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-xl text-center text-xs text-zinc-600">No deposit requests submitted</div>
            ) : (
              deposits.map((dep) => (
                <div key={dep.id} className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-200">{dep.clientName}</h3>
                      <p className="text-[11px] text-zinc-500">{dep.clientEmail}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      dep.status === 'approved' ? 'bg-green-950/40 text-green-400 border border-green-500/15' :
                      dep.status === 'rejected' ? 'bg-red-950/40 text-red-400 border border-red-500/15' :
                      'bg-purple-950/40 text-purple-300 border border-purple-500/15 animate-pulse'
                    }`}>
                      {dep.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-zinc-900/30 p-2.5 rounded-lg border border-zinc-900 text-xs">
                    <div>
                      <p className="text-[10px] text-zinc-500">Amount</p>
                      <p className="font-bold text-green-400 mt-0.5">Rs. {dep.amount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500">Method</p>
                      <p className="font-semibold text-zinc-300 mt-0.5">{dep.method}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500">TID / Trx ID</p>
                      <p className="font-mono text-purple-300 mt-0.5">{dep.txn_id}</p>
                    </div>
                  </div>

                  {dep.screenshot_url && (
                    <div className="border border-zinc-900 p-2 rounded-lg bg-zinc-950 flex items-center justify-between">
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-purple-400" />
                        Screenshot provided
                      </p>
                      <a
                        href={dep.screenshot_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] bg-zinc-900 text-purple-400 hover:text-white px-2 py-1 rounded border border-zinc-800 font-semibold"
                      >
                        View Screenshot
                      </a>
                    </div>
                  )}

                  {dep.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleDepositRequest(dep.id, 'reject')}
                        className="flex-1 py-1.5 bg-red-950/40 text-red-400 hover:bg-red-900/30 border border-red-500/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject / Decline
                      </button>
                      <button
                        onClick={() => handleDepositRequest(dep.id, 'approve')}
                        className="flex-1 py-1.5 bg-green-950/40 text-green-400 hover:bg-green-900/30 border border-green-500/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve & Credit
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Admin Facebook IDs Shop */}
      {adminTab === 'admin-fb-ids' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-display text-purple-400">FB ID Account Inventory</h2>
          
          <form onSubmit={handleBulkFbAdd} className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
            <h3 className="text-xs text-zinc-400 font-bold flex items-center gap-1">
              <PlusCircle className="w-4 h-4 text-purple-500" />
              Bulk Add Facebook Accounts to Stock
            </h3>
            <p className="text-[11px] text-zinc-500">Enter accounts as <strong>UID,Password</strong> (one account per line):</p>
            <textarea
              required
              rows={4}
              placeholder="10007625121,MyPassWord123&#10;10008627110,AnotherPassWord99"
              value={bulkFbInput}
              onChange={(e) => setBulkFbInput(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 btn-primary rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              {loading ? "Adding accounts..." : "Upload to Inventory"}
            </button>
          </form>

          {/* Table display */}
          <div className="space-y-2">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Accounts in Stock ({fbIds.length})</h3>
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl divide-y divide-zinc-900 max-h-96 overflow-y-auto">
              {fbIds.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-600">No FB IDs in stock. Upload some above!</div>
              ) : (
                fbIds.map((item) => (
                  <div key={item.id} className="p-3 text-xs flex justify-between items-center">
                    <div>
                      <p className="font-mono text-zinc-200">{item.uid}</p>
                      <p className="text-[10px] text-zinc-500">Pass: {item.password}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        item.status === 'sold' ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-green-950/40 text-green-400 border border-green-500/10'
                      }`}>
                        {item.status} {item.status === 'sold' ? `to ${item.clientEmail || 'Client'}` : ''}
                      </span>
                      <button
                        onClick={() => handleDeleteFbId(item.id)}
                        className="p-1.5 bg-zinc-900 hover:text-red-400 border border-zinc-800 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Admin Settings */}
      {adminTab === 'admin-settings' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-display text-purple-400">Settings Config</h2>
            <button
              onClick={handleDiscoverCountries}
              disabled={loading}
              className="px-3 py-1.5 bg-purple-950/40 text-purple-300 hover:text-purple-200 border border-purple-500/20 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 animate-pulse" />
              Discover Cheap (&lt;10 PKR)
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 mt-1">Configure pricing variables, public verification viewer, and payment details.</p>

          <div className="space-y-4">
            {/* Provider API Keys & Real Stock Diagnostics */}
            <div className="bg-zinc-950 border border-purple-900/40 p-4 rounded-xl space-y-4 shadow-lg shadow-purple-950/20">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-purple-300 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-purple-400" />
                    SMS Provider API Keys & Live Stock Diagnostics
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Manage your live API credentials and test real numbers stock directly from SMSBower/VSimPro.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestApi('smsbower')}
                    disabled={testingApi}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-purple-600/20"
                  >
                    {testingApi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                    Test Live Real Stock
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-semibold flex items-center justify-between">
                    <span>SMSBower API Key (Primary)</span>
                    <span className="text-[9px] text-purple-400 font-mono">handler_api.php</span>
                  </label>
                  <input
                    type="password"
                    value={settings.otp_api_key || ''}
                    onChange={(e) => setSettings({ ...settings, otp_api_key: e.target.value })}
                    placeholder="Enter your live SMSBower API Key"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-semibold flex items-center justify-between">
                    <span>VSIMPro API Key (Optional)</span>
                    <span className="text-[9px] text-purple-400 font-mono">vsimpro.com</span>
                  </label>
                  <input
                    type="password"
                    value={settings.vsimpro_api_key || ''}
                    onChange={(e) => setSettings({ ...settings, vsimpro_api_key: e.target.value })}
                    placeholder="Enter your VSIMPro API Key"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold">SMSBower Base URL Domain</label>
                <input
                  type="text"
                  value={settings.smsbower_base_url || 'https://smsbower.page'}
                  onChange={(e) => setSettings({ ...settings, smsbower_base_url: e.target.value })}
                  placeholder="https://smsbower.page"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono"
                />
              </div>

              {/* Live Test Diagnostic Output */}
              {apiTestResults && (
                <div className="mt-3 p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${apiTestResults.isConfigured ? 'bg-green-400 animate-ping' : 'bg-yellow-400'}`}></span>
                      <span className="font-bold text-zinc-200 uppercase">
                        {apiTestResults.isConfigured ? 'Real Provider Live Connected' : 'Sandbox Simulation Mode'}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">({apiTestResults.latencyMs}ms)</span>
                    </div>
                    <div className="font-mono text-xs text-green-400 font-bold">
                      {apiTestResults.balanceRaw}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Live Real Stock per Country (Facebook 'fb' Service):</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                      {Object.entries(apiTestResults.detectedStock || {}).map(([cName, count]: [string, any]) => (
                        <div key={cName} className="p-2 bg-zinc-950 border border-zinc-800/80 rounded-lg flex justify-between items-center">
                          <span className="text-[11px] text-zinc-300 truncate max-w-[130px]">{cName}</span>
                          <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${Number(count) > 0 ? 'bg-green-950/60 text-green-400 border border-green-500/20' : 'bg-zinc-900 text-zinc-500'}`}>
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SMSBower Temp Mail / Email Activation API Configuration */}
            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                <div>
                  <h3 className="text-xs text-purple-400 font-bold uppercase tracking-wider">SMSBower Mail API & Temp Gmail Configuration</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Configures the mail activation endpoint (<code className="text-zinc-400">/api/mail/getActivation</code>)</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 font-mono border border-purple-800/40">
                  smsbower.page
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-semibold flex items-center justify-between">
                    <span>Service Code</span>
                    <span className="text-[9px] text-zinc-500 font-mono">service</span>
                  </label>
                  <input
                    type="text"
                    value={settings.mail_service_code || 'fb'}
                    onChange={(e) => setSettings({ ...settings, mail_service_code: e.target.value })}
                    placeholder="fb"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-semibold flex items-center justify-between">
                    <span>Mail Domain</span>
                    <span className="text-[9px] text-zinc-500 font-mono">domain</span>
                  </label>
                  <input
                    type="text"
                    value={settings.mail_domain || 'gmail.com'}
                    onChange={(e) => setSettings({ ...settings, mail_domain: e.target.value })}
                    placeholder="gmail.com"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-semibold flex items-center justify-between">
                    <span>Ref Code (Optional)</span>
                    <span className="text-[9px] text-zinc-500 font-mono">ref</span>
                  </label>
                  <input
                    type="text"
                    value={settings.mail_ref || ''}
                    onChange={(e) => setSettings({ ...settings, mail_ref: e.target.value })}
                    placeholder="e.g. ref123"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-400 font-semibold flex items-center justify-between">
                    <span>Alias (Optional)</span>
                    <span className="text-[9px] text-zinc-500 font-mono">alias</span>
                  </label>
                  <input
                    type="text"
                    value={settings.mail_alias || ''}
                    onChange={(e) => setSettings({ ...settings, mail_alias: e.target.value })}
                    placeholder="e.g. alias1"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-xl text-[11px] font-mono text-zinc-400 overflow-x-auto whitespace-nowrap">
                <span className="text-zinc-500">Live Endpoint Call: </span>
                <span className="text-purple-300">{(settings.smsbower_base_url || 'https://smsbower.page').replace(/\/+$/, '')}</span>
                <span className="text-zinc-200">/api/mail/getActivation?api_key=***&service=</span>
                <span className="text-emerald-400 font-bold">{settings.mail_service_code || 'fb'}</span>
                <span className="text-zinc-200">&domain=</span>
                <span className="text-emerald-400 font-bold">{settings.mail_domain || 'gmail.com'}</span>
                {settings.mail_ref && <span className="text-zinc-300">&ref={settings.mail_ref}</span>}
                {settings.mail_alias && <span className="text-zinc-300">&alias={settings.mail_alias}</span>}
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
              <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Prices (PKR)</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-500">Gmail Number Price</label>
                  <input
                    type="number"
                    value={settings.gmail_price}
                    onChange={(e) => setSettings({ ...settings, gmail_price: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-500">Temp Gmail Inbox Price</label>
                  <input
                    type="number"
                    value={settings.gmail_mail_price}
                    onChange={(e) => setSettings({ ...settings, gmail_mail_price: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
              <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Short URLs & Links</h3>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-500">Public OTP Viewer Domain Path</label>
                  <input
                    type="text"
                    value={settings.public_otp_url}
                    onChange={(e) => setSettings({ ...settings, public_otp_url: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white font-mono"
                    placeholder="https://smsflow.panel/otp-viewer"
                  />
                </div>
              </div>
            </div>

            {/* Manual Country Manager Interface */}
            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-4">
              <div className="border-b border-zinc-900 pb-2">
                <h3 className="text-sm font-semibold text-purple-400">Manual Country Configurator</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Quickly add or delete service country settings instead of editing raw JSON.</p>
              </div>

              {/* Grid: Form and Current List */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Add Country Form */}
                <form onSubmit={handleAddCountry} className="lg:col-span-5 space-y-3 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/40">
                  <h4 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                    <PlusCircle className="w-3.5 h-3.5 text-purple-400" />
                    Add New Country
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-semibold">Name *</label>
                      <input
                        type="text"
                        value={newCountryName}
                        onChange={(e) => setNewCountryName(e.target.value)}
                        placeholder="e.g. Russia"
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-semibold">Country ID *</label>
                      <input
                        type="number"
                        value={newCountryId}
                        onChange={(e) => setNewCountryId(e.target.value)}
                        placeholder="e.g. 0"
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-semibold font-semibold">Provider *</label>
                      <select
                        value={newProvider}
                        onChange={(e: any) => setNewProvider(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="smsbower">SMSBower</option>
                        <option value="vsimpro">VSIMPro</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-semibold font-semibold">Provider ID (Opt)</label>
                      <input
                        type="number"
                        value={newProviderId}
                        onChange={(e) => setNewProviderId(e.target.value)}
                        placeholder="e.g. 3228"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-semibold">
                        Buy Rate ({newProvider === 'smsbower' ? 'USD' : 'PKR'}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={newMaxPrice}
                        onChange={(e) => setNewMaxPrice(e.target.value)}
                        placeholder={newProvider === 'smsbower' ? "e.g. 0.12" : "e.g. 8.5"}
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-semibold">Sell Rate (PKR) *</label>
                      <input
                        type="number"
                        step="any"
                        value={newSell}
                        onChange={(e) => setNewSell(e.target.value)}
                        placeholder="e.g. 45"
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {savingSettings ? "Saving..." : "Add & Auto-Save"}
                  </button>
                </form>

                {/* Country List / Manager */}
                <div className="lg:col-span-7 bg-zinc-900/10 rounded-lg border border-zinc-900 overflow-hidden flex flex-col max-h-[300px]">
                  <div className="bg-zinc-900/60 p-2 border-b border-zinc-800/40 flex justify-between items-center">
                    <h4 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-zinc-400" />
                      Configured Countries
                    </h4>
                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                      {(() => {
                        try { return JSON.parse(settings.countries || '[]').length; } catch { return 0; }
                      })()} Total
                    </span>
                  </div>

                  <div className="overflow-y-auto divide-y divide-zinc-900">
                    {(() => {
                      let list = [];
                      try {
                        list = JSON.parse(settings.countries || '[]');
                      } catch (e) {}

                      if (list.length === 0) {
                        return (
                          <div className="p-8 text-center text-xs text-zinc-600 italic">
                            No countries configured. Add your first country or click 'Discover Cheap'.
                          </div>
                        );
                      }

                      return list.map((c: any, idx: number) => (
                        <div key={idx} className="p-2.5 flex justify-between items-center text-xs hover:bg-zinc-900/30 transition-all">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-200">{c.name}</span>
                              <span className="text-[9px] uppercase font-bold px-1 py-0.2 bg-purple-950 text-purple-400 rounded border border-purple-500/10">
                                {c.provider}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono space-x-2">
                              <span>ID: {c.countryId}</span>
                              {c.providerId && <span>PID: {c.providerId}</span>}
                              <span>Buy: {c.maxPrice} {c.provider === 'smsbower' ? 'USD' : 'PKR'}</span>
                              <span className="text-green-400">Sell: {c.sell} PKR</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${c.name}?`)) {
                                handleDeleteCountry(idx);
                              }
                            }}
                            className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                            title="Delete Country"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

              </div>
            </div>

            {/* Manual Deposit Method Configurator Interface */}
            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-4">
              <div className="border-b border-zinc-900 pb-2">
                <h3 className="text-sm font-semibold text-purple-400">Easy PKR Deposit Configurator</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Add, edit, or delete deposit payment methods (EasyPaisa, JazzCash, Nayapay, Bank Transfer, etc.) shown to your clients.</p>
              </div>

              {/* Grid: Form and Current List */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Add / Edit Method Form */}
                <form onSubmit={handleAddDepositMethod} className="lg:col-span-5 space-y-3 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/40">
                  <h4 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                    <PlusCircle className="w-3.5 h-3.5 text-purple-400" />
                    {editingMethodIndex !== null ? "Edit Deposit Method" : "Add New Deposit Method"}
                  </h4>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-semibold">Method Name *</label>
                    <input
                      type="text"
                      value={newMethodName}
                      onChange={(e) => setNewMethodName(e.target.value)}
                      placeholder="e.g. EasyPaisa, JazzCash, HBL Bank, etc."
                      required
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-semibold">Instructions / Account Details *</label>
                    <textarea
                      rows={4}
                      value={newMethodInstructions}
                      onChange={(e) => setNewMethodInstructions(e.target.value)}
                      placeholder="e.g. Send to EasyPaisa Account: 0300-1234567 (Muhammad Ahmed). Min deposit 50 PKR. Send screenshot of TID."
                      required
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none font-sans"
                    />
                  </div>

                  <div className="flex gap-2">
                    {editingMethodIndex !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewMethodName('');
                          setNewMethodInstructions('');
                          setEditingMethodIndex(null);
                        }}
                        className="w-1/2 py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className={`py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1 ${editingMethodIndex !== null ? 'w-1/2' : 'w-full'}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {savingSettings ? "Saving..." : (editingMethodIndex !== null ? "Update Method" : "Add Method")}
                    </button>
                  </div>
                </form>

                {/* Deposit Methods List */}
                <div className="lg:col-span-7 bg-zinc-900/10 rounded-lg border border-zinc-900 overflow-hidden flex flex-col max-h-[300px]">
                  <div className="bg-zinc-900/60 p-2 border-b border-zinc-800/40 flex justify-between items-center">
                    <h4 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
                      Current Deposit Methods
                    </h4>
                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                      {(() => {
                        try { return JSON.parse(settings.deposit_methods || '[]').length; } catch { return 0; }
                      })()} Total
                    </span>
                  </div>

                  <div className="overflow-y-auto divide-y divide-zinc-900">
                    {(() => {
                      let list = [];
                      try {
                        list = JSON.parse(settings.deposit_methods || '[]');
                      } catch (e) {}

                      if (list.length === 0) {
                        return (
                          <div className="p-8 text-center text-xs text-zinc-600 italic">
                            No deposit methods configured yet. Add your first payment method.
                          </div>
                        );
                      }

                      return list.map((m: any, idx: number) => (
                        <div key={idx} className="p-2.5 flex justify-between items-start text-xs hover:bg-zinc-900/30 transition-all">
                          <div className="space-y-1 flex-1 pr-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-purple-400 text-xs">{m.name}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed break-words">
                              {m.instructions}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setNewMethodName(m.name);
                                setNewMethodInstructions(m.instructions);
                                setEditingMethodIndex(idx);
                              }}
                              className="p-1.5 text-zinc-500 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-all cursor-pointer"
                              title="Edit Method"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${m.name}?`)) {
                                  handleDeleteDepositMethod(idx);
                                }
                              }}
                              className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                              title="Delete Method"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
              <h3 className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Default Countries JSON Config</h3>
              <p className="text-[10px] text-zinc-500">Defines flags, max USD prices, and PKR selling values.</p>
              <textarea
                rows={8}
                value={settings.countries}
                onChange={(e) => setSettings({ ...settings, countries: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-purple-200"
              />
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full py-2.5 btn-primary rounded-xl font-semibold text-sm cursor-pointer"
            >
              {savingSettings ? "Saving Settings..." : "Save Configuration Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Admin Audit Logs */}
      {adminTab === 'admin-logs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold font-display text-purple-400">System Activity Audit Logs</h2>
            <button onClick={fetchLogs} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl divide-y divide-zinc-900 max-h-[420px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-600">No activity logged yet</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-3 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-purple-400 uppercase tracking-wider text-[10px]">{log.action}</span>
                    <span className="text-[10px] text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">{log.details}</p>
                  {log.user_email && (
                    <p className="text-[10px] text-zinc-500">By: {log.user_email}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
