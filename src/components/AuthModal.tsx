'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { X, Mail, Lock, User, Loader2, Eye, EyeOff, Phone, ChevronRight, CheckCircle, AlertCircle, CreditCard, Sparkles, ArrowLeft } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'credentials' | 'profile' | 'complete' | 'reset';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [payStep, setPayStep] = useState<'idle' | 'polling' | 'success' | 'failed'>('idle');
  const [payError, setPayError] = useState('');
  const [transRef, setTransRef] = useState('');

  const { login, register, refreshUser } = useAuth();

  useEffect(() => {
    if (!isOpen) {
      setStep('credentials');
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      setError('');
      setShowPassword(false);
      setIsExistingUser(false);
      setPayStep('idle');
      setPayError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Step 1: Check credentials
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Try login first (existing user)
      const loginResult = await login(email, password);
      if (!loginResult.error) {
        // Existing user, check if upgraded
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user?.is_upgraded || data.user?.name) {
            // Already upgraded or has profile, skip step 2
            onClose();
            return;
          }
        }
        setIsExistingUser(true);
        onClose(); // Login successful, close
        return;
      }

      // Not existing user or wrong password
      if (loginResult.error === 'Invalid email or password') {
        // Could be new user or wrong password — try to check if email exists
        // If login fails, assume new user for registration flow
        setIsExistingUser(false);
        setStep('profile');
      } else {
        setError(loginResult.error || 'Login failed');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Complete profile & optionally pay
  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Register the user
      const result = await register(email, password, name || email.split('@')[0]);
      if (result.error) {
        // If already registered, try login
        if (result.error.includes('already registered')) {
          const loginResult = await login(email, password);
          if (loginResult.error) {
            setError(loginResult.error);
            setLoading(false);
            return;
          }
        } else {
          setError(result.error);
          setLoading(false);
          return;
        }
      }

      // Save phone if provided
      if (phone.trim()) {
        try {
          await fetch('/api/user/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone.trim() }),
          });
        } catch { /* non-critical */ }
      }

      // User is now registered & logged in
      onClose();
    } catch {
      setError('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Payment
  const handlePayment = async () => {
    if (!phone.trim()) { setPayError('Enter your M-Pesa phone number'); return; }
    if (!/^0[17]\d{8}$/.test(phone)) { setPayError('Enter a valid Safaricom number (10 digits, starting 07 or 01)'); return; }
    setPayError('');
    setPayStep('polling');

    try {
      const res = await fetch('/api/payments/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      setTransRef(data.transaction_reference);
      let count = 0;
      const poll = setInterval(async () => {
        count++;
        if (count > 30) { clearInterval(poll); setPayStep('failed'); setPayError('Payment timed out'); return; }
        try {
          const sr = await fetch(`/api/payments/status?reference=${data.transaction_reference}`);
          const sd = await sr.json();
          if (sd.status === 'success') { clearInterval(poll); setPayStep('success'); await refreshUser(); }
          else if (sd.status === 'failed') { clearInterval(poll); setPayStep('failed'); setPayError(sd.message || 'Payment failed'); }
        } catch { /* continue */ }
      }, 2000);
    } catch (err) {
      setPayStep('failed');
      setPayError(err instanceof Error ? err.message : 'Payment failed');
    }
  };

  const skipPayment = async () => {
    // If user hasn't been registered yet, register as free user
    if (!isExistingUser) {
      setLoading(true);
      try {
        const result = await register(email, password, name || email.split('@')[0]);
        if (result.error && !result.error.includes('already registered')) {
          // Try login if already registered
          const loginResult = await login(email, password);
          if (loginResult.error) {
            setError(loginResult.error);
            setLoading(false);
            return;
          }
        }
        // Save phone if provided
        if (phone.trim()) {
          try {
            await fetch('/api/user/settings', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: phone.trim() }),
            });
          } catch { /* non-critical */ }
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#111118] border border-[#27272a] rounded-2xl shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            {step === 'profile' && (
              <button onClick={() => setStep('credentials')} className="p-1 rounded-lg hover:bg-[#1e1e2e]">
                <ArrowLeft className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <h2 className="text-xl font-bold text-white">
              {step === 'credentials' ? 'Sign In' : step === 'profile' ? 'Complete Profile' : 'Welcome!'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#1e1e2e] transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-5 pt-4">
          <div className={`flex-1 h-1 rounded-full ${step === 'credentials' ? 'bg-[#6366f1]' : 'bg-[#6366f1]'}`} />
          <div className={`flex-1 h-1 rounded-full ${step === 'profile' || step === 'complete' ? 'bg-[#6366f1]' : 'bg-[#27272a]'}`} />
        </div>

        <div className="p-5">
          {/* Step 1: Credentials */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <p className="text-sm text-gray-400 mb-4">Enter your email and password. New users will be guided to create an account.</p>

              {/* Google Sign In */}
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/api/auth/google';
                }}
                className="w-full flex items-center justify-center gap-3 py-3 bg-[#1e1e2e] hover:bg-[#27272a] border border-[#27272a] rounded-xl text-white font-medium transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#27272a]" />
                <span className="text-xs text-gray-500">or email</span>
                <div className="flex-1 h-px bg-[#27272a]" />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full pl-10 pr-4 py-3 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1] transition-colors" />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  className="w-full pl-10 pr-12 py-3 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1] transition-colors" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Checking...</> : <>Continue <ChevronRight className="w-4 h-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => setStep('reset' as Step)}
                className="w-full text-center text-sm text-gray-400 hover:text-[#6366f1] transition-colors mt-2"
              >
                Forgot password?
              </button>
            </form>
          )}

          {/* Step 2: Profile + Payment */}
          {step === 'profile' && payStep === 'idle' && (
            <form onSubmit={handleProfile} className="space-y-4">
              <p className="text-sm text-gray-400 mb-2">Create your account. Phone & payment are optional — you can upgrade later.</p>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full pl-10 pr-4 py-3 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1]" />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input type="tel" placeholder="Safaricom phone (07XX or 01XX)" value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                    setPhone(val);
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1]" />
                {phone && !/^0[17]\d{8}$/.test(phone) && (
                  <p className="text-xs text-red-400 mt-1 ml-1">Must be 10 digits starting with 07 or 01</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}

              {/* Upgrade option */}
              <div className="p-4 bg-gradient-to-br from-[#6366f1]/10 to-[#8b5cf6]/5 border border-[#6366f1]/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[#6366f1]" />
                  <span className="text-sm font-semibold text-white">Upgrade to Premium — KES 100</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">Unlimited storage with your own Telegram bot</p>
                {phone.trim() && /^0[17]\d{8}$/.test(phone) && (
                  <button type="button" onClick={handlePayment}
                    className="w-full py-2.5 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4" /> Pay KES 100 via M-Pesa
                  </button>
                )}
                {(!phone.trim() || !/^0[17]\d{8}$/.test(phone)) && (
                  <p className="text-xs text-gray-500 italic">Enter a valid Safaricom phone number to enable payment</p>
                )}
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={loading}
                  className="flex-1 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Free Account'}
                </button>
              </div>
            </form>
          )}

          {/* Payment polling */}
          {step === 'profile' && payStep === 'polling' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-[#6366f1] animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Check Your Phone</h3>
              <p className="text-sm text-gray-400">Enter your M-Pesa PIN to complete the payment</p>
              <p className="text-xs text-gray-500 mt-4">Waiting for confirmation...</p>
            </div>
          )}

          {step === 'profile' && payStep === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#22c55e]/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-[#22c55e]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Payment Successful! 🎉</h3>
              <p className="text-sm text-gray-400 mb-4">Your account has been upgraded to Premium</p>
              <button onClick={onClose} className="px-6 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl text-sm font-medium">
                Get Started
              </button>
            </div>
          )}

          {/* Reset password */}
          {step === 'reset' as Step && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 mb-2">Enter your email to receive a password reset link.</p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full pl-10 pr-4 py-3 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1]" />
              </div>
              {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
              {payError && <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm"><CheckCircle className="w-4 h-4 flex-shrink-0" />{payError}</div>}
              <button
                type="button"
                disabled={loading || !email}
                onClick={async () => {
                  setError(''); setPayError(''); setLoading(true);
                  try {
                    const res = await fetch('/api/auth/reset-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email }),
                    });
                    const data = await res.json();
                    if (res.ok) setPayError('Reset link sent! Check your email.');
                    else setError(data.error || 'Failed to send reset link');
                  } catch { setError('Failed to send reset link'); }
                  setLoading(false);
                }}
                className="w-full py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
              </button>
              <button onClick={() => { setStep('credentials'); setError(''); setPayError(''); }} className="w-full text-center text-sm text-gray-400 hover:text-white">
                Back to Sign In
              </button>
            </div>
          )}

          {step === 'profile' && payStep === 'failed' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Payment Failed</h3>
              <p className="text-sm text-gray-400 mb-4">{payError}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setPayStep('idle')} className="px-4 py-2 bg-[#1e1e2e] text-white rounded-xl text-sm">Try Again</button>
                <button onClick={skipPayment} disabled={loading} className="px-4 py-2 bg-[#6366f1] text-white rounded-xl text-sm disabled:opacity-50 flex items-center gap-2">
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Continue Free
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
