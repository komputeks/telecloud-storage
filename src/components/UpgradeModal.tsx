'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Phone, Sparkles, CreditCard } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: Props) {
  const { refreshUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'input' | 'polling' | 'success' | 'failed'>('input');
  const [error, setError] = useState('');
  const [transRef, setTransRef] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setError('');
      setPhone('');
      setTransRef('');
      pollCount.current = 0;
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [isOpen]);

  const initiatePay = async () => {
    if (!phone.trim()) { setError('Enter your M-Pesa phone number'); return; }
    setError('');
    setStep('polling');

    try {
      const res = await fetch('/api/payments/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      setTransRef(data.transaction_reference);
      pollCount.current = 0;

      // Start polling
      pollRef.current = setInterval(async () => {
        pollCount.current++;
        if (pollCount.current > 30) { // 60 seconds max
          if (pollRef.current) clearInterval(pollRef.current);
          setStep('failed');
          setError('Payment timed out. If you paid, contact support.');
          return;
        }
        try {
          const sr = await fetch(`/api/payments/status?reference=${data.transaction_reference}`);
          const sd = await sr.json();
          if (sd.status === 'success') {
            if (pollRef.current) clearInterval(pollRef.current);
            setStep('success');
            await refreshUser();
          } else if (sd.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setStep('failed');
            setError(sd.message || 'Payment failed');
          }
        } catch { /* continue polling */ }
      }, 2000);
    } catch (err) {
      setStep('failed');
      setError(err instanceof Error ? err.message : 'Payment failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl animate-fadeIn" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          {step === 'input' && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Upgrade to Premium</h2>
                <p className="text-sm text-[var(--muted)] mt-1">Unlimited storage for only <span className="text-[#22c55e] font-bold">KES 100</span></p>
              </div>

              <div className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {['Unlimited storage', 'Your own private Telegram bot', 'Full S3 API access', 'Priority support'].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-[var(--foreground)]">
                      <CheckCircle className="w-4 h-4 text-[#22c55e] flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>

                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="M-Pesa phone (e.g. 0712345678)"
                    className="w-full pl-10 pr-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:border-[#6366f1]"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 text-xs text-[#ef4444]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}

                <button
                  onClick={initiatePay}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white font-semibold rounded-xl transition-all"
                >
                  <CreditCard className="w-5 h-5" /> Pay KES 100 via M-Pesa
                </button>
                <p className="text-[10px] text-[var(--muted)] text-center">Powered by Lipia Online</p>
              </div>
            </>
          )}

          {step === 'polling' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-[#6366f1] animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">Check Your Phone</h3>
              <p className="text-sm text-[var(--muted)]">Enter your M-Pesa PIN to complete the payment</p>
              <p className="text-xs text-[var(--muted)] mt-4">Waiting for confirmation...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#22c55e]/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-[#22c55e]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">Payment Successful! 🎉</h3>
              <p className="text-sm text-[var(--muted)] mb-4">Your account has been upgraded to Premium</p>
              <button onClick={onClose} className="px-6 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl text-sm font-medium transition-colors">
                Get Started
              </button>
            </div>
          )}

          {step === 'failed' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#ef4444]/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-[#ef4444]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">Payment Failed</h3>
              <p className="text-sm text-[var(--muted)] mb-4">{error || 'Something went wrong'}</p>
              <button onClick={() => { setStep('input'); setError(''); }} className="px-6 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl text-sm font-medium transition-colors">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
