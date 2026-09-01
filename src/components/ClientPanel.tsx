import React, { useState, useEffect, useRef } from 'react';
import { playBeepSound } from '../utils/audio';
import { 
  Smartphone, Mail, ShieldAlert, History, Landmark, Settings, 
  Copy, RefreshCw, Clock, CheckCircle2, AlertCircle, 
  ChevronRight, Phone, Send, Info, Plus, HelpCircle, ArrowRightLeft, 
  Upload, Check 
} from 'lucide-react';

interface ClientPanelProps {
  token: string;
  user: any;
  wallet: any;
  fetchWallet: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  clientTab: string;
  setClientTab: (tab: string) => void;
  globalSettings: any;
}

async function parseJsonResponse(res: Response): Promise<{ ok: boolean; message?: string; data?: any }> {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return { ok: res.ok, message: data.message || data.error, data };
  } catch (e) {
    if (res.status === 502 || res.status === 504) {
      return { 
        ok: false, 
        message: "The SMS or temporary email verification service is currently busy or temporarily unavailable. Please try again shortly or contact support." 
      };
    }
    return { 
      ok: false, 
      message: res.status >= 400 
        ? `Request failed with status ${res.status}.` 
        : `Connection or payload error: ${text.substring(0, 100)}` 
    };
  }
}

export default function ClientPanel({
  token, user, wallet, fetchWallet, showToast, clientTab, setClientTab, globalSettings
}: ClientPanelProps) {
  
  // Stocks & Countries
  const [stockData, setStockData] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  // Activations
  const [activations, setActivations] = useState<any[]>([]);
  const [mailActivations, setMailActivations] = useState<any[]>([]);
  const [fbIdStock, setFbIdStock] = useState(0);
  const [boughtFbIds, setBoughtFbIds] = useState<any[]>([]);
  
  // Gmail Shop
  const [mailStock, setMailStock] = useState<any>({ available: true, count: 0 });

  // Buy FB
  const [fbQty, setFbQty] = useState('1');

  // Deposits
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('');
  const [depositTid, setDepositTid] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedMethodIdx, setCopiedMethodIdx] = useState<number | null>(null);

  // Ledger / Txns
  const [transactions, setTransactions] = useState<any[]>([]);

  // Refs for tracking old activation code receipts (to play receive sound)
  const previousCodesRef = useRef<Record<string, string>>({});
  const previousMailCodesRef = useRef<Record<string, string>>({});

  const [refreshingStock, setRefreshingStock] = useState(false);

  // Fetch stocks & lists
  async function fetchStock(forceRefresh = false) {
    if (forceRefresh) setRefreshingStock(true);
    try {
      const res = await fetch(`/api/stock${forceRefresh ? '?refresh=true' : ''}`);
      const d = await res.json();
      if (res.ok) {
        setStockData(d);
        if (d.countries && d.countries.length > 0) {
          if (!selectedCountry) {
            setSelectedCountry(d.countries[0]);
          } else {
            // Keep selected country updated with latest stock
            const updated = d.countries.find((c: any) => c.name === selectedCountry.name);
            if (updated) setSelectedCountry(updated);
          }
        }
        setFbIdStock(d.fbIdStock || 0);
        if (forceRefresh) {
          showToast("Live stock counts updated from provider!", "success");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (forceRefresh) setRefreshingStock(false);
    }
  }

  async function fetchActivations() {
    try {
      const res = await fetch('/api/client/activations', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) {
        // Sound check: if status turned to code_received and had no code before
        d.forEach((act: any) => {
          const oldCode = previousCodesRef.current[act.activation_id];
          if (act.status === 'code_received' && act.otp_code && !oldCode) {
            playBeepSound('otp');
            showToast("SMS verification code received!", "success");
          }
          if (act.otp_code) {
            previousCodesRef.current[act.activation_id] = act.otp_code;
          }
        });
        setActivations(d);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchMailActivations() {
    try {
      const res = await fetch('/api/client/mail-activations', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) {
        d.forEach((act: any) => {
          const oldCode = previousMailCodesRef.current[act.mail_id];
          if (act.status === 'code_received' && act.code && !oldCode) {
            playBeepSound('otp');
            showToast("Temp email code received!", "success");
          }
          if (act.code) {
            previousMailCodesRef.current[act.mail_id] = act.code;
          }
        });
        setMailActivations(d);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const [refreshingMailStock, setRefreshingMailStock] = useState(false);

  async function fetchMailStock(forceRefresh = false) {
    if (forceRefresh) setRefreshingMailStock(true);
    try {
      const res = await fetch(`/api/mail-stock${forceRefresh ? '?refresh=true' : ''}`);
      const d = await res.json();
      if (res.ok) {
        setMailStock(d);
        if (forceRefresh) {
          showToast(d.available ? `Mail stock available: ${d.count || 'In Stock'}` : "Temp Gmail accounts are currently Out of Stock.", d.available ? "success" : "error");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (forceRefresh) setRefreshingMailStock(false);
    }
  }

  async function fetchClientData() {
    fetchWallet();
    fetchStock();
    fetchMailStock();
    fetchActivations();
    fetchMailActivations();
    
    // Fetch ledger txns
    try {
      const res = await fetch('/api/client/transactions', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setTransactions(d);
    } catch (e) { console.error(e); }

    // Fetch bought FB ids
    try {
      const res = await fetch('/api/client/facebook-ids', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setBoughtFbIds(d);
    } catch (e) { console.error(e); }

    // Fetch deposit requests
    try {
      const res = await fetch('/api/client/deposits', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) setDepositRequests(d);
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    fetchClientData();
    // Auto clear expired numbers regularly
    fetch('/api/expire-activations', { method: 'POST' }).catch(() => {});
  }, [clientTab]);

  // Dynamic status pollers while viewing active numbers / gmails
  useEffect(() => {
    const activePolling = setInterval(() => {
      // Check if there are waiting items
      const hasWaitingAct = activations.some(a => a.status === 'waiting');
      const hasWaitingMail = mailActivations.some(m => m.status === 'waiting');
      
      if (hasWaitingAct) {
        activations.filter(a => a.status === 'waiting').forEach(async (act) => {
          try {
            await fetch('/api/check-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ activationId: act.activation_id })
            });
          } catch (e) {}
        });
        fetchActivations();
        fetchWallet();
      }

      if (hasWaitingMail) {
        mailActivations.filter(m => m.status === 'waiting').forEach(async (mail) => {
          try {
            await fetch('/api/check-mail-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ mailId: mail.mail_id })
            });
          } catch (e) {}
        });
        fetchMailActivations();
        fetchWallet();
      }
    }, 5000);

    return () => clearInterval(activePolling);
  }, [activations, mailActivations]);

  const copyToClipboard = (text: string, entityLabel: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${entityLabel} copied!`, "success");
  };

  // BUY NUMBER ACTION
  const handleGetNumber = async () => {
    if (!selectedCountry) {
      showToast("Please select a country option first", "error");
      return;
    }
    setLoadingAction(true);
    try {
      const res = await fetch('/api/get-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          service: 'fb', // Facebook-only service
          country: selectedCountry.name
        })
      });
      const parsed = await parseJsonResponse(res);
      if (parsed.ok) {
        playBeepSound('purchase');
        // Urdu Toast Notice as requested
        showToast("Naya OTP aane tak wait karein.", "success");
        fetchClientData();
      } else {
        showToast(parsed.message || "Purchase failed", "error");
      }
    } catch (e) {
      showToast("API connection error", "error");
    } finally {
      setLoadingAction(false);
    }
  };

  // CONTROL ACTIVATION STATUS
  const handleSetActivationStatus = async (activationId: string, status: number) => {
    try {
      const res = await fetch('/api/set-activation-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activationId, status })
      });
      const d = await res.json();
      if (res.ok) {
        showToast(status === 8 ? "Number cancelled & refunded" : status === 3 ? "OTP Reset. Requesting another..." : "Activation completed!", "success");
        fetchClientData();
      } else {
        showToast(d.message || "Failed to update status", "error");
      }
    } catch (e) {
      showToast("Server communication error", "error");
    }
  };

  // BUY GMAIL ACTION
  const handleGetMail = async () => {
    setLoadingAction(true);
    try {
      const res = await fetch('/api/get-mail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      const parsed = await parseJsonResponse(res);
      if (parsed.ok) {
        setMailStock({ available: true, count: 50 });
        playBeepSound('purchase');
        showToast("Temp Gmail account loaded! Waiting for OTP code.", "success");
        fetchClientData();
      } else {
        const isOutOfStock = (parsed as any).outOfStock || (parsed.message && parsed.message.toLowerCase().includes('out of stock')) || (parsed.message && parsed.message.toLowerCase().includes('no mails yet'));
        if (isOutOfStock) {
          setMailStock({ available: false, count: 0 });
          showToast("Currently Out of Stock. Please try again shortly.", "error");
        } else {
          showToast(parsed.message || "Failed to acquire temporary Gmail. Please try again.", "error");
        }
      }
    } catch (e) {
      showToast("API error buying mail", "error");
    } finally {
      setLoadingAction(false);
    }
  };

  // CONTROL GMAIL STATUS
  const handleSetMailStatus = async (mailId: string, status: number) => {
    try {
      const res = await fetch('/api/set-mail-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mailId, status })
      });
      const d = await res.json();
      if (res.ok) {
        showToast(status === 2 ? "Gmail session cancelled & refunded" : status === 5 ? "Reset. Waiting next OTP..." : "Completed Gmail session!", "success");
        fetchClientData();
      } else {
        showToast(d.message || "Failed to update mail", "error");
      }
    } catch (e) {
      showToast("Connection failed", "error");
    }
  };

  // BUY FACEBOOK IDS
  const handleBuyFbIds = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(fbQty);
    if (isNaN(qty) || qty <= 0 || qty > 50) return;

    setLoadingAction(true);
    try {
      const res = await fetch('/api/buy-facebook-ids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quantity: qty })
      });
      const parsed = await parseJsonResponse(res);
      if (parsed.ok) {
        playBeepSound('purchase');
        showToast(`Successfully purchased ${qty} FB accounts!`, "success");
        setFbQty('1');
        fetchClientData();
      } else {
        showToast(parsed.message || "Purchase failed", "error");
      }
    } catch (e) {
      showToast("Failed to buy FB IDs", "error");
    } finally {
      setLoadingAction(false);
    }
  };

  // SUBMIT DEPOSIT REQUEST
  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || !depositMethod || !depositTid) return;
    if (Number(depositAmount) < 50) {
      showToast("Minimum deposit amount is 50 PKR", "error");
      return;
    }

    setLoadingAction(true);
    try {
      const res = await fetch('/api/deposit-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Number(depositAmount),
          method: depositMethod,
          txn_id: depositTid,
          screenshot_url: screenshotUrl
        })
      });
      if (res.ok) {
        showToast("Deposit request submitted successfully! Pending approval.", "success");
        setDepositAmount('');
        setDepositMethod('');
        setDepositTid('');
        setScreenshotUrl('');
        fetchClientData();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || "Failed to submit deposit", "error");
      }
    } catch (e) {
      showToast("Deposit error", "error");
    } finally {
      setLoadingAction(false);
    }
  };

  // Simulated screenshot upload via Drag & Drop or Browse
  const handleScreenshotDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      simulateScreenshotUpload(file);
    }
  };

  const handleScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      simulateScreenshotUpload(e.target.files[0]);
    }
  };

  const simulateScreenshotUpload = (file: File) => {
    showToast(`Uploading screenshot: ${file.name}...`, "success");
    // Generate simulated URL path
    setTimeout(() => {
      setScreenshotUrl("https://smsflow.panel/screenshots/" + Math.random().toString(36).substring(7) + ".jpg");
      showToast("Screenshot uploaded successfully!", "success");
    }, 1200);
  };

  // Flags image helper to automatically fetch flags for any country
  function renderFlag(countryName: string) {
    const name = countryName.toLowerCase().trim();
    
    // Custom mapping for quick resolution of common names
    const dict: { [key: string]: string } = {
      'usa': 'us',
      'united states': 'us',
      'america': 'us',
      'yemen': 'ye',
      'ghana': 'gh',
      'saudi': 'sa',
      'arabia': 'sa',
      'indonesia': 'id',
      'georgia': 'ge',
      'sudan': 'sd',
      'mali': 'ml',
      'colombia': 'co',
      'brazil': 'br',
      'poland': 'pl',
      'uk': 'gb',
      'united kingdom': 'gb',
      'england': 'gb',
      'pakistan': 'pk',
      'india': 'in',
      'bangladesh': 'bd',
      'russia': 'ru',
      'ukraine': 'ua',
      'canada': 'ca',
      'australia': 'au',
      'germany': 'de',
      'france': 'fr',
      'turkey': 'tr',
      'china': 'cn',
      'spain': 'es',
      'italy': 'it',
      'netherlands': 'nl',
      'sweden': 'se',
      'norway': 'no',
      'denmark': 'dk',
      'finland': 'fi',
      'switzerland': 'ch',
      'austria': 'at',
      'belgium': 'be',
      'portugal': 'pt',
      'greece': 'gr',
      'egypt': 'eg',
      'south africa': 'za',
      'nigeria': 'ng',
      'kenya': 'ke',
      'morocco': 'ma',
      'vietnam': 'vn',
      'thailand': 'th',
      'philippines': 'ph',
      'malaysia': 'my',
      'singapore': 'sg',
      'japan': 'jp',
      'south korea': 'kr',
      'mexico': 'mx',
      'argentina': 'ar',
      'chile': 'cl',
      'peru': 'pe',
      'venezuela': 've',
      'new zealand': 'nz',
      'iraq': 'iq',
      'iran': 'ir',
      'syria': 'sy',
      'lebanon': 'lb',
      'jordan': 'jo',
      'uae': 'ae',
      'united arab emirates': 'ae',
      'qatar': 'qa',
      'kuwait': 'kw',
      'oman': 'om',
      'bahrain': 'bh',
      'kazakhstan': 'kz',
      'uzbekistan': 'uz',
      'kyrgyzstan': 'kg',
      'tajikistan': 'tj',
      'turkmenistan': 'tm',
      'afghanistan': 'af',
      'nepal': 'np',
      'sri lanka': 'lk',
      'myanmar': 'mm',
      'cambodia': 'kh',
      'laos': 'la',
    };

    let code: string | null = null;
    for (const [key, val] of Object.entries(dict)) {
      if (name.includes(key)) {
        code = val;
        break;
      }
    }

    // Dynamic extraction: if country name has a 2-letter word or is exactly 2 letters
    if (!code) {
      const words = name.split(/\s+/);
      for (const w of words) {
        if (w.length === 2 && /^[a-z]{2}$/.test(w)) {
          code = w;
          break;
        }
      }
    }

    if (code) {
      return (
        <img 
          src={`https://flagcdn.com/w40/${code}.png`} 
          alt={countryName} 
          className="w-5 h-3.5 object-cover rounded-sm inline-block mr-1 align-middle border border-zinc-800"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }

    return <span className="text-sm select-none mr-1 align-middle">🌐</span>;
  }

  // Render payment methods with real fintech branding and styled logo badges
  function renderPaymentLogo(methodName: string) {
    const norm = methodName.toLowerCase();
    if (norm.includes('easypaisa') || norm.includes('easy paisa')) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-lg text-emerald-400">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-black font-extrabold text-[9px] flex items-center justify-center tracking-tighter shadow-sm select-none">ep</div>
          <span className="text-[10px] font-bold tracking-tight uppercase">EasyPaisa</span>
        </div>
      );
    }
    if (norm.includes('jazzcash') || norm.includes('jazz cash')) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-950/40 border border-amber-500/20 rounded-lg text-amber-400">
          <div className="w-5 h-5 rounded-full bg-amber-500 text-black font-extrabold text-[9px] flex items-center justify-center tracking-tighter shadow-sm select-none">jc</div>
          <span className="text-[10px] font-bold tracking-tight uppercase">JazzCash</span>
        </div>
      );
    }
    if (norm.includes('nayapay') || norm.includes('naya pay')) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-950/40 border border-orange-500/20 rounded-lg text-orange-400">
          <div className="w-5 h-5 rounded-full bg-orange-500 text-black font-extrabold text-[9px] flex items-center justify-center tracking-tighter shadow-sm select-none">np</div>
          <span className="text-[10px] font-bold tracking-tight uppercase">NayaPay</span>
        </div>
      );
    }
    if (norm.includes('sadapay') || norm.includes('sada pay')) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-teal-950/40 border border-teal-500/20 rounded-lg text-teal-400">
          <div className="w-5 h-5 rounded-full bg-teal-500 text-black font-extrabold text-[9px] flex items-center justify-center tracking-tighter shadow-sm select-none">sp</div>
          <span className="text-[10px] font-bold tracking-tight uppercase">SadaPay</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-950/40 border border-purple-500/20 rounded-lg text-purple-300">
        <div className="w-5 h-5 rounded-full bg-purple-500 text-black font-extrabold text-[9px] flex items-center justify-center tracking-tighter shadow-sm select-none">BK</div>
        <span className="text-[10px] font-bold tracking-tight uppercase">{methodName}</span>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 text-white">

      {/* Tab: Dashboard */}
      {clientTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Welcome Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Assalam-o-Alaikum</p>
              <h2 className="text-xl font-bold font-display text-white mt-0.5">
                Hi, {user.full_name} ✨
              </h2>
            </div>
            <div className="w-9 h-9 rounded-full bg-purple-950/40 border border-purple-500/30 flex items-center justify-center font-display text-xs font-bold text-purple-300">
              {user.full_name.substring(0, 1).toUpperCase()}
            </div>
          </div>

          {/* Balance card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-5 rounded-2xl flex flex-col shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none"></div>
            <p className="text-xs text-zinc-500 font-medium">Your Account Capital Wallet</p>
            <p className="text-3xl font-bold font-display text-white mt-1">
              Rs. {wallet?.balance?.toFixed(2) || "0.00"}
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setClientTab('deposit')}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-600/15"
              >
                Fund Wallet (Min 50)
              </button>
              <button
                onClick={() => setClientTab('numbers')}
                className="flex-1 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-xl transition-all hover:bg-zinc-800"
              >
                Buy SMS Numbers
              </button>
            </div>
          </div>

          {/* Service Links Grid */}
          <div className="space-y-2.5">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Service Portals</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setClientTab('numbers')}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 p-3.5 rounded-xl text-left space-y-1.5 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-950/30 border border-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-black transition-colors">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-zinc-200">Virtual SMS numbers</h4>
                <p className="text-[10px] text-zinc-500 font-light leading-tight">Instant verification phone lines</p>
              </button>

              <button
                onClick={() => setClientTab('gmails')}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 p-3.5 rounded-xl text-left space-y-1.5 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-950/30 border border-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-black transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-zinc-200">Temp Gmail accounts</h4>
                <p className="text-[10px] text-zinc-500 font-light leading-tight">Get ready Google inboxes</p>
              </button>

              <button
                onClick={() => setClientTab('fb-ids')}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 p-3.5 rounded-xl text-left space-y-1.5 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-950/30 border border-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-black transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-zinc-200">Facebook shop</h4>
                <p className="text-[10px] text-zinc-500 font-light leading-tight">Bulk UID logins, Rs.32 each</p>
              </button>

              <button
                onClick={() => setClientTab('transactions')}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 p-3.5 rounded-xl text-left space-y-1.5 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-950/30 border border-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-black transition-colors">
                  <History className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-zinc-200">Wallet ledger</h4>
                <p className="text-[10px] text-zinc-500 font-light leading-tight">View balance credits/debits</p>
              </button>
            </div>
          </div>

          {/* Quick Active Orders View */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Live Active Orders</h3>
              <button onClick={() => setClientTab('numbers')} className="text-[10px] text-purple-400 font-semibold flex items-center gap-0.5">
                Manage All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {activations.filter(a => a.status === 'waiting' || a.status === 'code_received').length === 0 && 
               mailActivations.filter(m => m.status === 'waiting' || m.status === 'code_received').length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl text-center text-xs text-zinc-600">
                  No active OTP sessions running. Select a country or service to begin!
                </div>
              ) : (
                <>
                  {/* SMS Activations */}
                  {activations.filter(a => a.status === 'waiting' || a.status === 'code_received').slice(0, 3).map((act) => (
                    <div key={act.id} className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="font-mono text-zinc-200">{act.phone_number}</p>
                          <button
                            onClick={() => copyToClipboard(act.phone_number || '', "Phone Number")}
                            className="p-0.5 text-zinc-500 hover:text-white rounded transition-colors cursor-pointer"
                            title="Copy Phone Number"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[10px] text-zinc-500">SMS Verification Line ({act.service_name})</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${act.status === 'code_received' ? 'bg-purple-950/40 text-purple-300 animate-pulse' : 'bg-yellow-950/40 text-yellow-500'}`}>
                        {act.status === 'code_received' ? 'Code Received!' : 'Waiting'}
                      </span>
                    </div>
                  ))}
                  
                  {/* Temp Mails */}
                  {mailActivations.filter(m => m.status === 'waiting' || m.status === 'code_received').slice(0, 2).map((mail) => (
                    <div key={mail.id} className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="font-mono text-zinc-200">{mail.mail_address}</p>
                          <button
                            onClick={() => copyToClipboard(mail.mail_address, "Gmail Address")}
                            className="p-0.5 text-zinc-500 hover:text-white rounded transition-colors cursor-pointer"
                            title="Copy Email Address"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[10px] text-zinc-500">Temp Gmail Account</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${mail.status === 'code_received' ? 'bg-purple-950/40 text-purple-300 animate-pulse' : 'bg-yellow-950/40 text-yellow-500'}`}>
                        {mail.status === 'code_received' ? 'Code Received!' : 'Waiting'}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Numbers Page */}
      {clientTab === 'numbers' && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold font-display text-purple-400">Buy SMS Verification Numbers</h2>

          {/* Country list cards */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Select Country Option</h3>
              <button
                type="button"
                onClick={() => fetchStock(true)}
                disabled={refreshingStock}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingStock ? 'animate-spin' : ''}`} />
                <span>{refreshingStock ? 'Checking Real Stock...' : 'Refresh Stock'}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {stockData?.countries?.map((c: any) => {
                const stockCount = typeof c.stock === 'number' ? c.stock : 0;
                const isOutOfStock = stockCount <= 0;
                return (
                  <button
                    key={c.name}
                    onClick={() => setSelectedCountry(c)}
                    className={`p-3 text-left rounded-xl border transition-all text-xs flex justify-between items-center cursor-pointer ${
                      selectedCountry?.name === c.name 
                        ? 'bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-950/20' 
                        : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold flex items-center gap-1.5 text-zinc-200">
                        <span>{renderFlag(c.name)}</span>
                        {c.name}
                      </p>
                      <p className="text-[10px] flex items-center gap-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${!isOutOfStock ? 'bg-green-400' : 'bg-red-400'}`}></span>
                        <span className={!isOutOfStock ? 'text-zinc-400 font-mono font-medium' : 'text-red-400 font-medium'}>
                          {!isOutOfStock ? `${stockCount} available` : 'Out of stock'}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400 text-xs">Rs. {c.sell}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Facebook Service Info */}
          {selectedCountry && (
            <div className="bg-zinc-950 border border-purple-900/30 p-4 rounded-xl space-y-3 relative overflow-hidden">
              <div className="flex justify-between items-center pb-2.5 border-b border-zinc-900">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <span className="font-bold font-display text-sm">f</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">Facebook SMS Service</h4>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-500">Purchase cost</p>
                  <p className="text-sm font-bold text-green-400">Rs. {selectedCountry.sell}</p>
                </div>
              </div>



              <button
                onClick={handleGetNumber}
                disabled={loadingAction}
                className="w-full py-2.5 btn-primary font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loadingAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Buy Virtual SMS Number"}
              </button>
            </div>
          )}

          {/* Live numbers status cards */}
          <div className="space-y-3">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Active SMS Channels</h3>
            
            <div className="space-y-3">
              {activations.length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-xl text-center text-xs text-zinc-600">
                  No previous activations found.
                </div>
              ) : (
                activations.map((act) => {
                  // Calculate remaining time for 20-min limit
                  const ageMs = Date.now() - new Date(act.created_at).getTime();
                  const remainingSec = Math.max(0, Math.floor((20 * 60 * 1000 - ageMs) / 1000));
                  const minutes = Math.floor(remainingSec / 60);
                  const seconds = remainingSec % 60;
                  const isRedTimer = minutes < 1;

                  return (
                    <div key={act.id} className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3.5 relative overflow-hidden">
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{act.service_name} Verification Line</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-lg font-mono font-semibold tracking-wide text-purple-200 select-all">{act.phone_number}</p>
                            <button
                              onClick={() => copyToClipboard(act.phone_number || '', "Phone Number")}
                              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded transition-colors cursor-pointer"
                              title="Copy Phone Number"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          act.status === 'completed' ? 'bg-green-950/40 text-green-400 border border-green-500/10' :
                          act.status === 'code_received' ? 'bg-purple-950/40 text-purple-300 animate-pulse border border-purple-500/10' :
                          act.status === 'cancelled' ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' :
                          'bg-yellow-950/40 text-yellow-500 animate-pulse border border-yellow-500/10'
                        }`}>
                          {act.status}
                        </span>
                      </div>

                      {/* Display OTP received */}
                      {act.status === 'code_received' && act.otp_code && (
                        <div className="bg-green-950/10 border border-green-500/20 p-3.5 rounded-xl flex items-center justify-between animate-pop-up">
                          <div>
                            <p className="text-[10px] text-green-400 font-semibold uppercase">SMS Verification Code</p>
                            <p className="text-2xl font-bold tracking-wider text-white font-display mt-0.5">{act.otp_code}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(act.otp_code || '', "OTP Code")}
                            className="p-2 bg-green-500 hover:bg-green-400 text-black rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Timer & Status */}
                      <div className="flex items-center justify-between bg-zinc-900/30 p-2 rounded-lg border border-zinc-900 text-xs">
                        {act.status === 'waiting' && (
                          <span className={`font-mono font-medium flex items-center gap-1 ${isRedTimer ? 'text-red-400 animate-pulse' : 'text-zinc-400'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {minutes}:{seconds < 10 ? '0' : ''}{seconds} left
                          </span>
                        )}
                        {act.status !== 'waiting' && <span className="text-zinc-600">Ended</span>}
                      </div>

                      {/* Control buttons */}
                      {act.status !== 'completed' && act.status !== 'cancelled' && (
                        <div className="flex gap-2 pt-1 border-t border-zinc-900 items-center justify-between">
                          {act.status === 'waiting' && !act.otp_code && !act.otp_received && (
                            <button
                              onClick={() => handleSetActivationStatus(act.activation_id, 8)}
                              className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                            >
                              Cancel & Refund
                            </button>
                          )}
                          {act.status === 'waiting' && (act.otp_code || act.otp_received) && (
                            <span className="text-[9px] text-zinc-500 italic py-1">Non-refundable (OTP Received)</span>
                          )}
                          {act.status === 'code_received' && (
                            <>
                              <button
                                onClick={() => handleSetActivationStatus(act.activation_id, 3)}
                                className="flex-1 py-1.5 bg-purple-950/30 text-purple-400 hover:bg-purple-900/30 border border-purple-500/10 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                              >
                                Try Another Code
                              </button>
                              <button
                                onClick={() => handleSetActivationStatus(act.activation_id, 6)}
                                className="flex-1 py-1.5 bg-green-950/40 text-green-400 hover:bg-green-900/30 border border-green-500/10 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
                              >
                                Mark Completed
                              </button>
                            </>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Gmails Page */}
      {clientTab === 'gmails' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display text-purple-400 font-display">Temp Gmail accounts</h2>
            <button
              onClick={() => fetchMailStock(true)}
              disabled={refreshingMailStock}
              className="px-2.5 py-1 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh stock status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingMailStock ? 'animate-spin text-purple-400' : ''}`} />
              <span>{refreshingMailStock ? 'Checking...' : 'Refresh Stock'}</span>
            </button>
          </div>

          <div className={`bg-zinc-950 border p-5 rounded-2xl space-y-4 transition-colors ${
            !mailStock.available ? 'border-red-900/40 bg-gradient-to-b from-zinc-950 to-red-950/10' : 'border-zinc-900'
          }`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">Temp Gmail inbox</h3>
                <p className="text-xs text-zinc-500 mt-1">Get immediate temporary inboxes to verify accounts.</p>
              </div>
              <div className="text-right flex flex-col items-end">
                {mailStock.available ? (
                  <span className="px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    In Stock
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider bg-red-950/80 text-red-400 border border-red-500/40 flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    Out of Stock
                  </span>
                )}
                {mailStock.available && typeof mailStock.count !== 'undefined' && mailStock.count > 0 && (
                  <p className="text-[10px] text-zinc-500 mt-1 font-mono">{mailStock.count} in stock</p>
                )}
                <p className="text-sm font-bold text-green-400 mt-1 font-mono">Rs. {globalSettings.gmailMailPrice}</p>
              </div>
            </div>

            {!mailStock.available && (
              <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-xs text-red-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-red-200">Currently Out of Stock</p>
                  <p className="text-[11px] text-red-300/90 leading-relaxed">
                    Temp Gmail accounts is waqt stock mein nahi hain. Jaise hi naye accounts available honge, status automatically <strong>In Stock</strong> ho jayega.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleGetMail}
              disabled={loadingAction}
              className={`w-full py-2.5 font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                !mailStock.available
                  ? 'bg-zinc-900 hover:bg-zinc-850 text-red-300 border border-red-900/50 hover:border-red-500/50 shadow-sm'
                  : 'btn-primary'
              }`}
            >
              {loadingAction ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : !mailStock.available ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span>Out of Stock (Click to Re-check)</span>
                </>
              ) : (
                "Get Temp Gmail Address"
              )}
            </button>
          </div>

          {/* Active mails */}
          <div className="space-y-3">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Active Gmail Sessions</h3>
            
            <div className="space-y-3">
              {mailActivations.length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-xl text-center text-xs text-zinc-600">
                  No active temp email inboxes.
                </div>
              ) : (
                mailActivations.map((mail) => {
                  const ageMs = Date.now() - new Date(mail.created_at).getTime();
                  const remainingSec = Math.max(0, Math.floor((20 * 60 * 1000 - ageMs) / 1000));
                  const minutes = Math.floor(remainingSec / 60);
                  const seconds = remainingSec % 60;
                  const isRedTimer = minutes < 1;

                  return (
                    <div key={mail.id} className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Gmail Address</p>
                          <p className="font-mono text-sm font-semibold tracking-wide text-purple-200 select-all mt-0.5">{mail.mail_address}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(mail.mail_address, "Gmail Address")}
                          className="p-1.5 bg-zinc-900 text-zinc-400 hover:text-white rounded transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex justify-between items-center bg-zinc-900/30 border border-zinc-900 p-2 rounded-lg text-xs">
                        {mail.status === 'waiting' ? (
                          <span className={`font-mono font-medium flex items-center gap-1 ${isRedTimer ? 'text-red-400 animate-pulse' : 'text-zinc-400'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {minutes}:{seconds < 10 ? '0' : ''}{seconds} left
                          </span>
                        ) : (
                          <span className="text-zinc-500">Created: {new Date(mail.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          mail.status === 'completed' ? 'bg-green-950/40 text-green-400 border border-green-500/10' :
                          mail.status === 'code_received' ? 'bg-purple-950/40 text-purple-300 border border-purple-500/10' :
                          mail.status === 'cancelled' ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-yellow-950/40 text-yellow-500'
                        }`}>
                          {mail.status}
                        </span>
                      </div>

                    {/* Code display */}
                    {mail.status === 'code_received' && mail.code && (
                      <div className="bg-green-950/10 border border-green-500/20 p-3 rounded-lg flex justify-between items-center text-xs animate-pop-up">
                        <div>
                          <p className="text-[10px] text-green-400">Received OTP Code</p>
                          <p className="text-xl font-bold text-white font-display mt-0.5">{mail.code}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(mail.code || '', "Gmail OTP")}
                          className="p-2 bg-green-500 text-black rounded-lg hover:bg-green-400 transition-all cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Mails controller */}
                    {mail.status !== 'completed' && mail.status !== 'cancelled' && (
                      <div className="flex gap-2 pt-1 border-t border-zinc-900 items-center justify-between">
                        {mail.status === 'waiting' && !mail.code && !mail.otp_received && (
                          <button
                            onClick={() => handleSetMailStatus(mail.mail_id, 2)}
                            className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 text-[10px] font-semibold rounded-lg cursor-pointer"
                          >
                            Cancel Inbox
                          </button>
                        )}
                        {mail.status === 'waiting' && (mail.code || mail.otp_received) && (
                          <span className="text-[9px] text-zinc-500 italic py-1">Non-refundable (Code Received)</span>
                        )}
                        {mail.status === 'code_received' && (
                          <>
                            <button
                              onClick={() => handleSetMailStatus(mail.mail_id, 5)}
                              className="flex-1 py-1.5 bg-purple-950/30 text-purple-400 border border-purple-500/10 text-[10px] font-semibold rounded-lg cursor-pointer"
                            >
                              Wait Next Code
                            </button>
                            <button
                              onClick={() => handleSetMailStatus(mail.mail_id, 3)}
                              className="flex-1 py-1.5 bg-green-950/40 text-green-400 border border-green-500/10 text-[10px] font-semibold rounded-lg cursor-pointer"
                            >
                              Mark Complete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Buy FB accounts */}
      {clientTab === 'fb-ids' && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold font-display text-purple-400 font-display">Facebook accounts (UID)</h2>

          <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
              <div>
                <h3 className="text-sm font-semibold text-zinc-200">Facebook UID log-ins</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Pre-seeded premium UID/Password pairs.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-500">In Stock</p>
                <p className="text-base font-bold text-purple-400">{fbIdStock} available</p>
              </div>
            </div>

            <form onSubmit={handleBuyFbIds} className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs text-zinc-400">Purchase quantity (max 50)</label>
                <span className="font-bold text-green-400 text-xs">Rs. {Number(fbQty || 0) * 32} PKR</span>
              </div>
              
              <input
                type="number"
                min={1}
                max={50}
                required
                value={fbQty}
                onChange={(e) => setFbQty(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-white"
                placeholder="Enter quantity"
              />

              <button
                type="submit"
                disabled={loadingAction || fbIdStock < Number(fbQty || 0)}
                className="w-full py-2.5 btn-primary font-bold text-sm rounded-xl cursor-pointer"
              >
                {loadingAction ? "Buying accounts..." : `Buy ${fbQty} Facebook UID pairs`}
              </button>
            </form>
          </div>

          {/* History bought pairs */}
          <div className="space-y-3">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Your purchased FB accounts ({boughtFbIds.length})</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {boughtFbIds.length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl text-center text-xs text-zinc-600">
                  No accounts purchased yet.
                </div>
              ) : (
                boughtFbIds.map((item) => (
                  <div key={item.id} className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-mono text-zinc-200 font-semibold">{item.uid}</p>
                      <p className="text-[10px] text-zinc-500">Password: <strong className="text-purple-300 font-mono">{item.password}</strong></p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(`${item.uid} | ${item.password}`, "Account Credentials")}
                      className="p-2 bg-zinc-900 hover:text-white border border-zinc-800 text-zinc-400 rounded-lg transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Deposit */}
      {clientTab === 'deposit' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-zinc-900 pb-4">
            <div>
              <h2 className="text-xl font-bold font-display text-white tracking-tight flex items-center gap-2">
                <span className="h-5 w-1 bg-purple-500 rounded-full inline-block"></span>
                Fund Capital Wallet
              </h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Deposit PKR using secure payment accounts to instantly reload your activation balance.</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-900 text-zinc-400 font-mono w-fit">
              <span>Min. Deposit:</span>
              <span className="text-purple-400 font-bold">50 PKR</span>
            </div>
          </div>

          {/* Interactive Steps Guide */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-zinc-950 border border-zinc-900 p-3.5 rounded-xl flex gap-3 items-start relative overflow-hidden">
              <span className="absolute top-1 right-2 text-3xl font-display font-extrabold text-zinc-900/50 pointer-events-none select-none">1</span>
              <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400 shrink-0">
                <Copy className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-zinc-200">Copy Details</h4>
                <p className="text-[10px] text-zinc-500 leading-relaxed">Choose a wallet/bank below and copy its account information.</p>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-3.5 rounded-xl flex gap-3 items-start relative overflow-hidden">
              <span className="absolute top-1 right-2 text-3xl font-display font-extrabold text-zinc-900/50 pointer-events-none select-none">2</span>
              <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400 shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-zinc-200">Transfer Funds</h4>
                <p className="text-[10px] text-zinc-500 leading-relaxed">Send the exact PKR amount using your preferred mobile wallet app.</p>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 p-3.5 rounded-xl flex gap-3 items-start relative overflow-hidden">
              <span className="absolute top-1 right-2 text-3xl font-display font-extrabold text-zinc-900/50 pointer-events-none select-none">3</span>
              <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400 shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-zinc-200">Upload Receipt</h4>
                <p className="text-[10px] text-zinc-500 leading-relaxed">Submit the Transaction ID (TID) along with the proof screenshot.</p>
              </div>
            </div>
          </div>

          {/* Payment instructions */}
          <div className="space-y-3">
            <h3 className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-purple-500" />
              Available Deposit Channels
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {globalSettings.depositMethods && globalSettings.depositMethods.length > 0 ? (
                globalSettings.depositMethods.map((m: any, idx: number) => (
                  <div 
                    key={idx} 
                    className="bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all rounded-xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group shadow-lg"
                  >
                    {/* Corner shine */}
                    <div className="absolute top-0 right-0 w-12 h-12 bg-purple-500/5 rounded-bl-full pointer-events-none group-hover:bg-purple-500/10 transition-all"></div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        {renderPaymentLogo(m.name)}
                        <div className="p-1 bg-zinc-900 rounded-md text-zinc-500 group-hover:text-purple-400 transition-colors">
                          <Landmark className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <p className="text-xs text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap font-sans min-h-[48px]">
                        {m.instructions}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(m.instructions);
                        setCopiedMethodIdx(idx);
                        showToast(`${m.name} details copied!`, "success");
                        setTimeout(() => setCopiedMethodIdx(null), 2000);
                      }}
                      className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        copiedMethodIdx === idx
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800/80 hover:text-white"
                      }`}
                    >
                      {copiedMethodIdx === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-400 animate-scale" />
                          Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Payment Details
                        </>
                      )}
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full bg-zinc-950 border border-zinc-900 p-6 rounded-xl text-center text-xs text-zinc-500">
                  No payment channels configured. Please contact support or administrator.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Request Form */}
            <form onSubmit={handleSubmitDeposit} className="lg:col-span-7 bg-zinc-950 border border-zinc-900 p-5 rounded-xl space-y-4 shadow-xl">
              <div>
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-purple-500" />
                  Submit Payment Verification Form
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Please send money first to any of the accounts above, then submit this form.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Payment Channel / Method</label>
                <select
                  required
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
                >
                  <option value="" className="bg-zinc-950">Select channel...</option>
                  {globalSettings.depositMethods && globalSettings.depositMethods.length > 0 ? (
                    globalSettings.depositMethods.map((m: any) => (
                      <option key={m.name} value={m.name} className="bg-zinc-950">{m.name} (PKR)</option>
                    ))
                  ) : (
                    <>
                      <option value="EasyPaisa" className="bg-zinc-950">EasyPaisa (PKR)</option>
                      <option value="JazzCash" className="bg-zinc-950">JazzCash (PKR)</option>
                      <option value="HBL Bank" className="bg-zinc-950">HBL Bank Transfer</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">PKR Amount (min 50)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-zinc-500 text-xs font-bold font-mono">Rs.</span>
                    <input
                      type="number"
                      min={50}
                      required
                      placeholder="e.g. 1000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800/80 rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Transaction ID (TID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 80017165"
                    value={depositTid}
                    onChange={(e) => setDepositTid(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800/80 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Drag and Drop Screenshot upload */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Screenshot Proof (Optional but Recommended)</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleScreenshotDrop}
                  className={`border border-dashed rounded-xl p-5 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                    screenshotUrl 
                      ? 'border-green-500/40 bg-green-950/5' 
                      : isDragging 
                        ? 'border-purple-500 bg-purple-950/10' 
                        : 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700'
                  }`}
                >
                  {screenshotUrl ? (
                    <div className="flex flex-col items-center">
                      <div className="p-2 bg-green-500/10 rounded-full text-green-400 mb-2">
                        <Check className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-green-400 font-bold">Proof Screenshot Uploaded!</p>
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5 max-w-[280px] font-mono">{screenshotUrl}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="p-2 bg-purple-500/10 rounded-full text-purple-400 mb-2 animate-pulse">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-zinc-300 font-semibold">Drag & drop receipt image or browse</p>
                      <p className="text-[10px] text-zinc-500 mt-1">Supports JPEG, PNG, screenshot captures</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotFileChange}
                        className="hidden"
                        id="screenshot-file"
                      />
                      <label
                        htmlFor="screenshot-file"
                        className="px-3 py-1.5 bg-zinc-900 text-purple-400 text-[10px] font-bold rounded-lg mt-3 cursor-pointer border border-zinc-800 hover:text-white transition-colors"
                      >
                        Browse Device Files
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingAction}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 text-white font-bold text-xs rounded-lg transition-all cursor-pointer uppercase tracking-wider shadow-lg shadow-purple-950/30"
              >
                {loadingAction ? "Submitting Request..." : "Submit Verification Request"}
              </button>
            </form>

            {/* Deposit request logs */}
            <div className="lg:col-span-5 space-y-4">
              <div className="border-b border-zinc-900 pb-2">
                <h3 className="text-xs text-zinc-400 uppercase tracking-wider font-bold font-display">Deposit Request History</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Track status of your capital wallet funding requests.</p>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {depositRequests.length === 0 ? (
                  <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-xl text-center text-xs text-zinc-600 italic">
                    No previous deposit requests found
                  </div>
                ) : (
                  depositRequests.map((req) => (
                    <div key={req.id} className="bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all p-3.5 rounded-xl flex justify-between items-center text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm">Rs. {req.amount}</span>
                          <span className="text-[10px] text-zinc-500">• {req.method}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-mono">TID: <span className="text-zinc-300 font-semibold">{req.txn_id}</span></p>
                        <p className="text-[9px] text-zinc-500 font-mono">
                          {new Date(req.created_at || Date.now()).toLocaleDateString()} {new Date(req.created_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                        req.status === 'approved' ? 'bg-green-950/50 text-green-400 border border-green-500/20' :
                        req.status === 'rejected' ? 'bg-red-950/50 text-red-400 border border-red-500/20' :
                        'bg-purple-950/50 text-purple-300 border border-purple-500/20 animate-pulse'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab: Wallet Ledger / ClientTransactions */}
      {clientTab === 'transactions' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold font-display text-purple-400 font-display">Wallet Transaction Ledger</h2>
          
          <div className="space-y-2.5">
            {transactions.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-xl text-center text-xs text-zinc-600">
                No credit/debit records found in history
              </div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="bg-zinc-950 border border-zinc-900 p-3.5 rounded-xl flex justify-between items-center text-xs relative overflow-hidden">
                  {/* Ledger indicator color stripe */}
                  <div className={`absolute top-0 bottom-0 left-0 w-1 ${tx.type === 'credit' ? 'bg-green-500' : 'bg-red-500'}`}></div>

                  <div className="pl-2 space-y-0.5">
                    <h4 className="font-bold text-zinc-200">{tx.description}</h4>
                    <p className="text-[10px] text-zinc-500 font-mono">ID: {tx.txn_id || tx.id} • {new Date(tx.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.type === 'credit' ? '+' : '-'} Rs. {tx.amount}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Settings / Support */}
      {clientTab === 'settings' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold font-display text-purple-400 font-display">Support & Preferences</h2>

          {/* Profile details */}
          <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl space-y-3">
            <h3 className="text-xs text-zinc-400 font-bold uppercase">Client Account Identity</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-900">
                <span className="text-zinc-500">Name</span>
                <span className="text-zinc-200 font-semibold">{user.full_name}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-zinc-900">
                <span className="text-zinc-500">Email</span>
                <span className="text-zinc-200 font-semibold">{user.email}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-zinc-500">Authority Role</span>
                <span className="text-purple-400 font-bold uppercase text-[10px] bg-purple-950/40 border border-purple-500/20 px-2 py-0.5 rounded">
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {/* Contact settings info */}
          <div className="bg-zinc-950 border border-purple-900/20 p-4 rounded-xl space-y-3">
            <h3 className="text-xs text-purple-400 font-bold uppercase">Customer Support Centre</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">Having balance loading issues or API delays? Connect with our Pakistani support staff immediately:</p>
            
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <a
                href={`https://wa.me/${globalSettings.contactInfo?.whatsapp?.replace(/\s+/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-green-400 text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                WhatsApp Help
              </a>
              <a
                href={`https://t.me/${globalSettings.contactInfo?.telegram?.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-blue-400 text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                Telegram Help
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
