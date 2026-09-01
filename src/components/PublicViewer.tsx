import React, { useState, useEffect } from 'react';
import { playBeepSound } from '../utils/audio';
import { Copy, RefreshCw, Smartphone, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface PublicViewerProps {
  token: string;
}

export default function PublicViewer({ token }: PublicViewerProps) {
  const [data, setData] = useState<{
    phone_number: string;
    service_name: string;
    created_date: string;
    status: string;
    otp_code?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function checkOtp() {
    try {
      const res = await fetch('/api/otp-by-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const json = await res.json();
      if (res.ok) {
        // Sound check: if new code arrived
        if (data && data.status === 'waiting' && json.status === 'code_received' && json.otp_code) {
          playBeepSound('otp');
        }
        setData(json);
        setError(null);
      } else {
        setError(json.message || "Invalid or expired link");
      }
    } catch (err: any) {
      console.error(err);
      // Don't break UI on transient network failure
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkOtp();
    const interval = setInterval(() => {
      checkOtp();
    }, 4000);
    return () => clearInterval(interval);
  }, [token, data?.status]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black text-white">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-4" />
        <p className="text-zinc-400 font-display">Loading public secure receiver...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black text-white">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex flex-col items-center text-center mb-6 border-b border-zinc-800 pb-5">
          <div className="w-12 h-12 bg-purple-950/40 border border-purple-500/20 rounded-full flex items-center justify-center mb-3">
            <Smartphone className="w-6 h-6 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold font-display text-white">SMSFlow Public OTP</h2>
          <p className="text-xs text-zinc-500 mt-1">Standalone Secure Verification Page</p>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
            <p className="text-red-400 font-medium mb-1">Link Expired or Invalid</p>
            <p className="text-xs text-zinc-500 max-w-xs">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Phone Number Box */}
            <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80 flex justify-between items-center">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Virtual Phone Number</p>
                <p className="text-lg font-semibold font-mono tracking-wide text-purple-200 mt-0.5">{data.phone_number}</p>
              </div>
              <button 
                onClick={() => copyToClipboard(data.phone_number)}
                className="p-2.5 bg-zinc-800/80 text-zinc-400 hover:text-white rounded-lg transition-colors border border-zinc-700/50"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Service & Date Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50">
                <p className="text-xs text-zinc-500">Service Required</p>
                <p className="text-sm font-semibold text-zinc-200 mt-0.5">{data.service_name}</p>
              </div>
              <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/50">
                <p className="text-xs text-zinc-500">Created At</p>
                <p className="text-sm font-semibold text-zinc-200 mt-0.5">
                  {new Date(data.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-full bg-zinc-900 border border-zinc-800 w-fit mx-auto">
              <div className={`w-2 h-2 rounded-full ${data.status === 'code_received' ? 'bg-green-500' : data.status === 'cancelled' ? 'bg-red-500' : 'bg-purple-500 animate-pulse'}`}></div>
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                {data.status === 'code_received' ? 'OTP Received' : data.status === 'cancelled' ? 'Cancelled / Expired' : 'Waiting for OTP Code'}
              </span>
            </div>

            {/* Code Display */}
            {data.status === 'waiting' && (
              <div className="bg-purple-950/20 border border-purple-500/20 p-6 rounded-xl flex flex-col items-center text-center">
                <Clock className="w-8 h-8 text-purple-400 animate-pulse mb-2" />
                <p className="text-xs text-purple-200 font-medium">Waiting for SMS to arrive...</p>
                <p className="text-[11px] text-zinc-500 mt-1">Please trigger the SMS from Facebook verification screen now.</p>
                <span className="text-xs bg-purple-950/40 text-purple-300 border border-purple-500/10 py-1 px-3 rounded-md mt-3 animate-pulse font-medium">
                  Naya OTP aane tak wait karein.
                </span>
              </div>
            )}

            {data.status === 'cancelled' && (
              <div className="bg-red-950/10 border border-red-500/15 p-6 rounded-xl flex flex-col items-center text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-xs text-red-300 font-medium">This activation has expired or was cancelled.</p>
              </div>
            )}

            {data.status === 'code_received' && data.otp_code && (
              <div className="bg-green-950/10 border border-green-500/20 p-6 rounded-xl flex flex-col items-center text-center animate-pop-up">
                <CheckCircle2 className="w-8 h-8 text-green-400 mb-2" />
                <p className="text-xs text-green-400 font-semibold tracking-wider uppercase">Verification OTP Code</p>
                <p className="text-4xl font-bold font-display tracking-widest text-white my-3 select-all bg-zinc-900 py-2.5 px-6 rounded-lg border border-zinc-800">
                  {data.otp_code}
                </p>
                <button
                  onClick={() => copyToClipboard(data.otp_code || '')}
                  className="flex items-center gap-1.5 py-2 px-4 bg-green-500 text-black font-semibold text-xs rounded-lg hover:bg-green-400 active:scale-95 transition-all shadow-lg shadow-green-500/10"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
            )}
          </div>
        ) : null}

        <div className="text-center mt-6 text-[11px] text-zinc-600 border-t border-zinc-900 pt-4">
          Powered by <strong className="text-purple-400">SMSFlow Network</strong>. Secured link to preserve privacy.
        </div>
      </div>
    </div>
  );
}
