import React, { useState, useEffect } from 'react';
import PublicViewer from './components/PublicViewer';
import AuthPages from './components/AuthPages';
import ClientPanel from './components/ClientPanel';
import AdminPanel from './components/AdminPanel';
import { testFirestoreConnection } from './firebase';

import { 
  Home, Smartphone, Landmark, History, MoreHorizontal, 
  ShieldCheck, Users, Sliders, Settings, LogOut, Mail, 
  HelpCircle, ChevronLeft, RefreshCw, Layers 
} from 'lucide-react';

export default function App() {
  // Check for public secure OTP token parameter
  const urlParams = new URLSearchParams(window.location.search);
  const publicToken = urlParams.get('token');

  if (publicToken) {
    return <PublicViewer token={publicToken} />;
  }

  // Session & Authentication
  const [token, setToken] = useState<string | null>(localStorage.getItem('smsflow_token'));
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('smsflow_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Client Wallet Balance
  const [wallet, setWallet] = useState<any>({ balance: 0 });

  // View Navigation Tabs
  const [clientTab, setClientTab] = useState('dashboard');
  const [adminTab, setAdminTab] = useState('admin-dashboard');
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Bottom Sheet Controls
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  // Custom Toast State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Settings
  const [globalSettings, setGlobalSettings] = useState<any>({
    gmailPrice: 15,
    gmailMailPrice: 20,
    depositMethods: [],
    contactInfo: {}
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const fetchWallet = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/client/wallet', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setWallet(d);
      }
    } catch (e) {
      console.error("Wallet check failed:", e);
    }
  };

  const fetchGlobalSettings = async () => {
    try {
      const res = await fetch('/api/settings/public');
      if (res.ok) {
        const d = await res.json();
        setGlobalSettings(d);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    testFirestoreConnection();
  }, []);

  useEffect(() => {
    if (token) {
      fetchWallet();
      fetchGlobalSettings();
      // If user is admin, auto toggle to Admin Panel initially
      if (user && user.role === 'admin') {
        setIsAdminMode(true);
      }
    }
  }, [token]);

  const handleLoginSuccess = (newToken: string, newUser: any) => {
    localStorage.setItem('smsflow_token', newToken);
    localStorage.setItem('smsflow_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    if (newUser.role === 'admin') {
      setIsAdminMode(true);
    } else {
      setIsAdminMode(false);
      setClientTab('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('smsflow_token');
    localStorage.removeItem('smsflow_user');
    setToken(null);
    setUser(null);
    setIsAdminMode(false);
    setShowMoreSheet(false);
    showToast("Logged out of panel", "success");
  };

  // Render Guest Login/Registration screen if unauthenticated
  if (!token || !user) {
    return (
      <div className="bg-black text-white min-h-screen">
        <AuthPages onLoginSuccess={handleLoginSuccess} showToast={showToast} />
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-pop-up">
            <div className={`px-4 py-2.5 rounded-xl border shadow-2xl text-xs font-semibold ${
              toast.type === 'success' 
                ? 'bg-purple-950/40 border-purple-500/30 text-purple-200' 
                : 'bg-red-950/40 border-red-500/30 text-red-200'
            }`}>
              {toast.msg}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex justify-center selection:bg-purple-500/30">
      
      {/* Mobile-First Frame wrapper */}
      <div className="w-full max-w-[448px] min-h-screen bg-black text-white flex flex-col relative border-x border-zinc-900 shadow-2xl overflow-x-hidden">
        
        {/* Sticky Header Top Bar */}
        <header className="sticky top-0 z-30 bg-black/85 backdrop-blur-md border-b border-zinc-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Context Back button if not in dashboards */}
            {!isAdminMode && clientTab !== 'dashboard' && (
              <button 
                onClick={() => setClientTab('dashboard')} 
                className="p-1 -ml-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {isAdminMode && adminTab !== 'admin-dashboard' && (
              <button 
                onClick={() => setAdminTab('admin-dashboard')} 
                className="p-1 -ml-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <span className="font-display font-bold text-sm tracking-tight flex items-center gap-1">
              SMSFlow Panel
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Switch Button for Admins */}
            {user.role === 'admin' && (
              <button
                onClick={() => {
                  setIsAdminMode(!isAdminMode);
                  setShowMoreSheet(false);
                  showToast(isAdminMode ? "Switched to Customer Panel" : "Switched to Administrator View", "success");
                }}
                className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-bold text-purple-400 hover:text-white flex items-center gap-1 transition-all"
              >
                <Layers className="w-3.5 h-3.5" />
                {isAdminMode ? 'View Client' : 'View Admin'}
              </button>
            )}

            {/* Quick Balance Button */}
            {!isAdminMode ? (
              <button
                onClick={fetchWallet}
                className="py-1 px-2.5 bg-green-950/30 hover:bg-green-950/50 border border-green-500/20 text-green-400 text-xs rounded-full font-bold flex items-center gap-1 transition-all"
              >
                <RefreshCw className="w-3 h-3 animate-spin-hover" />
                Rs. {wallet?.balance?.toFixed(0) || "0"}
              </button>
            ) : (
              <span className="py-1 px-2.5 bg-purple-950/40 border border-purple-500/25 text-purple-300 text-[10px] uppercase font-bold rounded-full">
                Admin Secure Mode
              </span>
            )}
          </div>
        </header>

        {/* Primary Page Canvas */}
        <main className="flex-1 px-4 pt-5 pb-24">
          {isAdminMode ? (
            <AdminPanel 
              token={token} 
              showToast={showToast} 
              adminTab={adminTab} 
              onLogout={handleLogout} 
            />
          ) : (
            <ClientPanel 
              token={token} 
              user={user} 
              wallet={wallet} 
              fetchWallet={fetchWallet} 
              showToast={showToast} 
              clientTab={clientTab} 
              setClientTab={setClientTab}
              globalSettings={globalSettings}
            />
          )}

          {/* All Rights Reserved & Branding Footer */}
          <div className="mt-8 mb-6 text-center text-[10px] text-zinc-600 border-t border-zinc-900 pt-4 px-2 space-y-1">
            <p className="font-medium">SMSFlow Panel © {new Date().getFullYear()}</p>
            <p className="tracking-wide">All rights reserved to Fahdii</p>
          </div>
        </main>

        {/* Floating WhatsApp contact button */}
        <div className="fixed bottom-20 right-[max(16px,calc((100vw-448px)/2+16px))] z-50 pointer-events-none md:right-[calc((100%-448px)/2+16px)]">
          <a
            href="https://wa.me/923093601043"
            target="_blank"
            rel="noopener noreferrer"
            title="Contact Support on WhatsApp"
            className="pointer-events-auto flex items-center justify-center p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-xl border border-emerald-500/30 transition-all duration-300 transform hover:scale-110 select-none shadow-emerald-950/20 hover:shadow-emerald-500/20"
          >
            <svg 
              className="w-5 h-5 fill-current animate-pulse-subtle" 
              viewBox="0 0 24 24"
            >
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.665.989 3.3.15 5.336.15 5.548 0 10.064-4.512 10.068-10.058.002-2.686-1.043-5.21-2.945-7.113C16.945 3.031 14.425 1.988 11.74 1.988c-5.55 0-10.067 4.51-10.071 10.057-.001 1.895.5 3.734 1.451 5.387L2.164 21.72l4.483-1.176c1.648.905 3.486 1.384 5.337 1.385h.005l.001-.001zM18.06 14.85c-.328-.164-1.944-.96-2.247-1.07-.302-.11-.522-.164-.742.164-.22.329-.85.11-1.042.329-.192.22-.384.246-.712.082-.328-.164-1.386-.51-2.639-1.627-.975-.87-1.633-1.946-1.825-2.274-.192-.33-.02-.507.144-.671.148-.148.33-.384.494-.575.164-.192.22-.329.329-.548.11-.22.054-.411-.027-.575-.082-.164-.742-1.787-1.015-2.443-.267-.641-.539-.553-.742-.564-.192-.01-.411-.012-.63-.012s-.576.082-.877.411c-.3.329-1.152 1.123-1.152 2.738 0 1.616 1.178 3.178 1.342 3.4 1.152 1.547 2.304 2.877 4.542 3.734.532.204 1.077.34 1.62.43.541.09 1.041.037 1.433-.021.437-.066 1.944-.795 2.219-1.564.275-.77.275-1.43.192-1.564-.083-.135-.302-.218-.63-.383z"/>
            </svg>
          </a>
        </div>

        {/* Fixed Custom Bottom Navigation Dock */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[448px] bg-black/85 backdrop-blur-md border-t border-zinc-900 py-2.5 px-4 z-40 grid grid-cols-5 gap-1 text-center justify-around">
          
          {isAdminMode ? (
            /* Admin bottom items */
            <>
              <button
                onClick={() => { setAdminTab('admin-dashboard'); setShowMoreSheet(false); }}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${adminTab === 'admin-dashboard' && !showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Home className="w-5 h-5" />
                KPIs
              </button>

              <button
                onClick={() => { setAdminTab('admin-clients'); setShowMoreSheet(false); }}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${adminTab === 'admin-clients' && !showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Users className="w-5 h-5" />
                Clients
              </button>

              <button
                onClick={() => { setAdminTab('admin-services'); setShowMoreSheet(false); }}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${adminTab === 'admin-services' && !showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Sliders className="w-5 h-5" />
                Services
              </button>

              <button
                onClick={() => { setAdminTab('admin-settings'); setShowMoreSheet(false); }}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${adminTab === 'admin-settings' && !showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>

              <button
                onClick={() => setShowMoreSheet(!showMoreSheet)}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <MoreHorizontal className="w-5 h-5" />
                More
              </button>
            </>
          ) : (
            /* Client bottom items */
            <>
              <button
                onClick={() => { setClientTab('dashboard'); setShowMoreSheet(false); }}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${clientTab === 'dashboard' && !showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Home className="w-5 h-5" />
                Home
              </button>

              <button
                onClick={() => { setClientTab('numbers'); setShowMoreSheet(false); }}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${clientTab === 'numbers' && !showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Smartphone className="w-5 h-5" />
                SMS OTP
              </button>

              <button
                onClick={() => { setClientTab('deposit'); setShowMoreSheet(false); }}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${clientTab === 'deposit' && !showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Landmark className="w-5 h-5" />
                Deposit
              </button>

              <button
                onClick={() => { setClientTab('transactions'); setShowMoreSheet(false); }}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${clientTab === 'transactions' && !showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <History className="w-5 h-5" />
                Ledger
              </button>

              <button
                onClick={() => setShowMoreSheet(!showMoreSheet)}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${showMoreSheet ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <MoreHorizontal className="w-5 h-5" />
                More
              </button>
            </>
          )}
        </nav>

        {/* More Actions Bottom Sheet */}
        {showMoreSheet && (
          <div className="fixed inset-0 z-40 bg-black/80 flex items-end justify-center p-0 animate-fade-in" onClick={() => setShowMoreSheet(false)}>
            <div 
              className="w-full max-w-[448px] bg-zinc-950 border-t border-zinc-800 rounded-t-2xl p-5 space-y-4 shadow-2xl relative animate-slide-up pb-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative notch line */}
              <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-2"></div>
              
              <h3 className="text-sm font-bold text-zinc-300">User Hub Actions</h3>
              
              {isAdminMode ? (
                /* Admin Sheet Actions */
                <div className="grid grid-cols-2 gap-3 pb-4">
                  <button
                    onClick={() => { setAdminTab('admin-deposits'); setShowMoreSheet(false); }}
                    className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-purple-400 text-left rounded-xl space-y-1 transition-colors"
                  >
                    <Landmark className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold">Deposits Approval</h4>
                    <p className="text-[10px] text-zinc-500">Manage manual credits</p>
                  </button>

                  <button
                    onClick={() => { setAdminTab('admin-fb-ids'); setShowMoreSheet(false); }}
                    className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-purple-400 text-left rounded-xl space-y-1 transition-colors"
                  >
                    <Smartphone className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold">Facebook ID Stock</h4>
                    <p className="text-[10px] text-zinc-500">Bulk upload UID inventory</p>
                  </button>

                  <button
                    onClick={() => { setAdminTab('admin-logs'); setShowMoreSheet(false); }}
                    className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-purple-400 text-left rounded-xl space-y-1 transition-colors"
                  >
                    <History className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold">System Audit Logs</h4>
                    <p className="text-[10px] text-zinc-500">Track server-side logs</p>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="p-3 bg-red-950/10 border border-red-950 hover:border-red-700 hover:text-red-400 text-left rounded-xl space-y-1 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <h4 className="text-xs font-bold">Logout Session</h4>
                    <p className="text-[10px] text-red-400/70">Clear credentials securely</p>
                  </button>
                </div>
              ) : (
                /* Client Sheet Actions */
                <div className="grid grid-cols-2 gap-3 pb-4">
                  <button
                    onClick={() => { setClientTab('gmails'); setShowMoreSheet(false); }}
                    className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-purple-400 text-left rounded-xl space-y-1 transition-colors"
                  >
                    <Mail className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold">Temp Gmail</h4>
                    <p className="text-[10px] text-zinc-500">Buy Google inbox session</p>
                  </button>

                  <button
                    onClick={() => { setClientTab('fb-ids'); setShowMoreSheet(false); }}
                    className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-purple-400 text-left rounded-xl space-y-1 transition-colors"
                  >
                    <Smartphone className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold">Facebook shop</h4>
                    <p className="text-[10px] text-zinc-500">Ready login UIDs</p>
                  </button>

                  <button
                    onClick={() => { setClientTab('settings'); setShowMoreSheet(false); }}
                    className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-purple-400 text-left rounded-xl space-y-1 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4 text-purple-400" />
                    <h4 className="text-xs font-bold">Help & Profile</h4>
                    <p className="text-[10px] text-zinc-500">WhatsApp & Telegram</p>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="p-3 bg-red-950/10 border border-red-950 hover:border-red-700 hover:text-red-400 text-left rounded-xl space-y-1 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <h4 className="text-xs font-bold">Logout Session</h4>
                    <p className="text-[10px] text-red-400/70">Clear credentials securely</p>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic global Toast Banner notifier */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-pop-up">
            <div className={`px-4 py-2.5 rounded-xl border shadow-2xl text-xs font-semibold ${
              toast.type === 'success' 
                ? 'bg-purple-950/40 border-purple-500/30 text-purple-200' 
                : 'bg-red-950/40 border-red-500/30 text-red-200'
            }`}>
              {toast.msg}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
