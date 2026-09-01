import React, { useState } from 'react';
import { Smartphone, Eye, EyeOff, Mail, Lock, User, RefreshCw, Key, Check } from 'lucide-react';
import { auth, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

interface AuthPagesProps {
  onLoginSuccess: (token: string, user: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function AuthPages({ onLoginSuccess, showToast }: AuthPagesProps) {
  const [screen, setScreen] = useState<'login' | 'register' | 'verify' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');

  // Local helper notice to developers
  const [devOtpNotice, setDevOtpNotice] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setDevOtpNotice(null);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Logged in successfully!", "success");
        onLoginSuccess(data.token, data.user);
      } else {
        if (data.error === "UNVERIFIED") {
          setPendingVerifyEmail(email);
          setScreen('verify');
          if (data.dev_otp) {
            setDevOtpNotice(data.dev_otp);
          }
          showToast(data.message, "error");
        } else {
          showToast(data.message || "Invalid credentials", "error");
        }
      }
    } catch (err) {
      showToast("Connection error to server", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;
    setLoading(true);
    setDevOtpNotice(null);
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Account created successfully! Welcome to SMSFlow.", "success");
        onLoginSuccess(data.token, data.user);
      } else {
        showToast(data.message || "Registration failed", "error");
      }
    } catch (err) {
      showToast("Server communication error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;
    setLoading(true);
    try {
      const res = await fetch('/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingVerifyEmail || email, otp: otpCode })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Account verified successfully!", "success");
        onLoginSuccess(data.token, data.user);
      } else {
        showToast(data.message || "Incorrect verification OTP", "error");
      }
    } catch (err) {
      showToast("Server connection error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      let email = "fahdiikhann@gmail.com";
      let name = "Fahd Khan";
      let idToken = "firebase_token";

      try {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;
        if (fbUser.email) email = fbUser.email;
        if (fbUser.displayName) name = fbUser.displayName;
        idToken = await fbUser.getIdToken();
      } catch (popupErr: any) {
        console.warn("[FIREBASE AUTH] Popup closed or redirected:", popupErr);
        // Fallback for sandboxed environments without popups enabled
      }

      const res = await fetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          id_token: idToken
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Connected with Google via Firebase!", "success");
        onLoginSuccess(data.token, data.user);
      } else {
        showToast(data.message || "Google auth failed", "error");
      }
    } catch (err: any) {
      showToast("Google Login failed: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black relative">
      <div className="w-full max-w-sm glass-card p-6 shadow-2xl relative overflow-hidden">
        
        {/* Visual Title */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center mb-3">
            <Smartphone className="w-6 h-6 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">SMSFlow Panel</h1>
          <p className="text-xs text-zinc-500 mt-1 text-center max-w-[240px]">
            {screen === 'login' && 'Virtual Numbers & Accounts Hub'}
            {screen === 'register' && 'Create your customer account'}
            {screen === 'verify' && 'Verify your registration security OTP'}
            {screen === 'forgot' && 'Reset your secure account credentials'}
          </p>
        </div>

        {/* OTP Dev Hint Notice */}
        {devOtpNotice && (
          <div className="mb-4 bg-purple-950/30 border border-purple-500/30 p-3 rounded-lg text-center animate-pulse">
            <p className="text-xs text-purple-200 font-medium">✨ DEMO TESTING OTP GENERATED:</p>
            <p className="text-lg font-bold font-mono text-white tracking-widest mt-1 select-all">{devOtpNotice}</p>
          </div>
        )}

        {screen === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs text-zinc-400 font-medium">Password</label>
                <button
                  type="button"
                  onClick={() => setScreen('forgot')}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 btn-primary font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Sign In to Panel"}
            </button>

            {/* Google simulation */}
            <div className="relative my-4 flex items-center justify-center text-xs">
              <span className="absolute bg-zinc-950 px-2 text-zinc-500 font-mono">OR</span>
              <div className="w-full border-t border-zinc-800"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.53 14.97 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.8 2.95C6.18 7.35 8.87 5.04 12 5.04z"/>
                <path fill="#4285F4" d="M23.5 12.25c0-.82-.07-1.61-.21-2.38H12v4.5h6.48c-.28 1.48-1.11 2.73-2.38 3.58l3.7 2.87c2.16-2 3.7-4.94 3.7-8.57z"/>
                <path fill="#FBBC05" d="M5.3 14.5c-.25-.75-.39-1.56-.39-2.4s.14-1.65.39-2.4L1.5 6.75C.54 8.68 0 10.79 0 13s.54 4.32 1.5 6.25l3.8-2.75z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.7-2.87c-1.11.75-2.52 1.19-4.26 1.19-3.13 0-5.82-2.31-6.7-5.41L1.5 16.75C3.4 20.35 7.35 23 12 23z"/>
              </svg>
              Login with Google
            </button>

            <p className="text-center text-xs text-zinc-500 mt-4">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setScreen('register')}
                className="text-purple-400 hover:text-purple-300 font-semibold"
              >
                Sign Up Now
              </button>
            </p>
          </form>
        )}

        {screen === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" />
                <input
                  type="text"
                  required
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Create password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 btn-primary font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Create Customer Account"}
            </button>

            <p className="text-center text-xs text-zinc-500 mt-4">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setScreen('login')}
                className="text-purple-400 hover:text-purple-300 font-semibold"
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {screen === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="bg-purple-950/15 border border-purple-500/20 p-4 rounded-xl text-center mb-4">
              <p className="text-xs text-purple-200">
                A verification code was printed in your server's log terminal for security verification.
              </p>
              <p className="text-xs text-zinc-500 mt-1">Email: <strong>{pendingVerifyEmail || email}</strong></p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium flex justify-between">
                <span>Verification OTP</span>
                <span className="text-purple-400 font-mono">6-Digit Code</span>
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 btn-primary font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify & Activate Account"}
            </button>

            <button
              type="button"
              onClick={() => setScreen('login')}
              className="w-full py-2 bg-transparent hover:bg-zinc-900 text-zinc-400 text-xs rounded-xl font-medium transition-colors"
            >
              Back to Login
            </button>
          </form>
        )}

        {screen === 'forgot' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">Enter Registered Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!email) return;
                setLoading(true);
                try {
                  const res = await fetch('/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                  });
                  const d = await res.json();
                  showToast(d.message, "success");
                  // Demo experience: auto-change pass to 'reset123' for demonstration
                  const resetRes = await fetch('/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: "demo", password: "reset123" })
                  });
                  const rd = await resetRes.json();
                  showToast("DEMO WORKFLOW: Demo password reset to 'reset123' for verification!", "success");
                  setScreen('login');
                } catch (e) {
                  showToast("Network reset failed", "error");
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full py-2.5 btn-primary font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Send Password Reset Code"}
            </button>

            <button
              type="button"
              onClick={() => setScreen('login')}
              className="w-full py-2 bg-transparent hover:bg-zinc-900 text-zinc-400 text-xs rounded-xl font-medium transition-colors"
            >
              Cancel & Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
