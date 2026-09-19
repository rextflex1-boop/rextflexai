import React, { useState } from 'react';
import { GoogleIcon } from './GoogleIcon';
import { Mail, ArrowRight, Sparkles, ShieldCheck, Lock, KeyRound } from 'lucide-react';
import { authClient } from '../lib/auth-client';

type User = { id: string; email: string; name: string; image?: string | null };

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [loginToast, setLoginToast] = useState<string | null>(null);

  const showError = (message: string) => {
    setLoginToast(message);
    window.setTimeout(() => setLoginToast(null), 3500);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLoginToast('Google sign-in open ho raha hai...');
    try {
      await authClient.signIn.social({ provider: 'google', callbackURL: window.location.origin });
    } catch (error: any) {
      setIsLoading(false);
      showError(error?.message || 'Google sign-in is not configured.');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showError('Email aur password dono enter karo.');
      return;
    }
    if (password.length < 8) {
      showError('Password kam se kam 8 characters ka hona chahiye.');
      return;
    }

    setIsLoading(true);
    try {
      const result = mode === 'signup'
        ? await authClient.signUp.email({
            email: email.trim(),
            password,
            name: name.trim() || email.split('@')[0],
          })
        : await authClient.signIn.email({ email: email.trim(), password, rememberMe: true });

      if (result.error) throw new Error(result.error.message || 'Authentication failed.');
      const token = (result as any)?.data?.token;
      if (token) {
        localStorage.setItem('rextflex_auth_token', token);
      }
      const sessionResponse = await fetch('/api/me', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const sessionData = await sessionResponse.json();
      if (!sessionResponse.ok || !sessionData?.user) throw new Error(sessionData?.error || 'The account session could not be loaded.');
      onLoginSuccess(sessionData.user as User);
    } catch (error: any) {
      showError(error?.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-between select-none relative overflow-hidden font-sans">
      <div className="absolute top-[-12%] left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-blue-50/50 via-amber-50/30 to-transparent blur-3xl pointer-events-none -z-10" />

      <header className="pt-12 pb-6 text-center px-4">
        <div className="inline-flex items-center justify-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Next-Gen Intelligence</span>
        </div>
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-black drop-shadow-xs">RextFlex Ai</h1>
        <p className="mt-2.5 text-sm sm:text-base text-zinc-500 max-w-md mx-auto font-medium">Welcome to the future of AI Search & Creative Intelligence</p>
      </header>

      <main className="w-full max-w-md mx-auto px-4 sm:px-6 flex-1 flex flex-col justify-center py-6">
        {loginToast && (
          <div className="mb-5 p-3 rounded-2xl bg-zinc-900 text-white text-xs font-medium flex items-center justify-center gap-2 shadow-lg animate-fade-in text-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{loginToast}</span>
          </div>
        )}

        <div className="space-y-6">
          <div className="relative group">
            <div className="relative p-[3px] rounded-full overflow-hidden shadow-lg transition-transform duration-200">
              <div className="absolute inset-[-150%] animate-rainbow-spin" style={{ background: 'conic-gradient(from 0deg, #ff0000, #ff7a00, #ffff00, #00e676, #00b0ff, #2979ff, #651fff, #ff0000)' }} />
              <div className="absolute inset-0 blur-md opacity-40 animate-rainbow-spin pointer-events-none" style={{ background: 'conic-gradient(from 0deg, #ff0000, #ff7a00, #ffff00, #00e676, #00b0ff, #2979ff, #651fff, #ff0000)' }} />
              <button id="google-login-btn" type="button" onClick={handleGoogleLogin} disabled={isLoading} className="relative z-10 w-full h-14 px-6 rounded-full btn-3d-white flex items-center justify-center gap-3.5 cursor-pointer font-semibold text-zinc-800 text-base">
                <div className="w-6 h-6 flex items-center justify-center shrink-0"><GoogleIcon className="w-5 h-5" /></div>
                <span className="tracking-tight">{isLoading ? 'Connecting...' : 'Continue with Google'}</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-zinc-200 w-full" />
            <span className="bg-white px-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Or with email</span>
            <div className="border-t border-zinc-200 w-full" />
          </div>

          {mode === 'signup' && (
            <div className="relative p-[3px] rounded-full overflow-hidden shadow-md">
              <div className="relative z-10 w-full h-14 px-5 rounded-full input-3d flex items-center gap-3 bg-white">
                <Sparkles className="w-5 h-5 text-zinc-400 shrink-0" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full h-full bg-transparent text-zinc-900 text-sm sm:text-base font-medium placeholder:text-zinc-400 focus:outline-hidden" />
              </div>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="relative">
              <div className="relative p-[3px] rounded-full overflow-hidden shadow-md">
                <div className="relative z-10 w-full h-14 px-5 rounded-full input-3d flex items-center gap-3 bg-white">
                  <Mail className="w-5 h-5 text-zinc-400 shrink-0" />
                  <input id="email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="w-full h-full bg-transparent text-zinc-900 text-sm sm:text-base font-medium placeholder:text-zinc-400 focus:outline-hidden" />
                </div>
              </div>
            </div>

            <div className="relative p-[3px] rounded-full overflow-hidden shadow-md">
              <div className="relative z-10 w-full h-14 px-5 rounded-full input-3d flex items-center gap-3 bg-white">
                <KeyRound className="w-5 h-5 text-zinc-400 shrink-0" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" className="w-full h-full bg-transparent text-zinc-900 text-sm sm:text-base font-medium placeholder:text-zinc-400 focus:outline-hidden" />
              </div>
            </div>

            <button id="submit-login-btn" type="submit" disabled={isLoading} className="w-full h-14 px-6 rounded-full btn-3d-black flex items-center justify-center gap-2.5 font-bold text-base cursor-pointer uppercase tracking-wider">
              <span>{isLoading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Login'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center -mt-2">
            <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline">
              {mode === 'login' ? 'New here? Create a real account' : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-zinc-400 px-4 border-t border-zinc-100">
        <div className="flex items-center justify-center gap-4 mb-1">
          <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />Secure Encrypted Login</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-zinc-400" />RextFlex Ai 2026</span>
        </div>
        <p className="text-[11px] text-zinc-400">Powered by Silicon • Titan • Apex Intelligence</p>
      </footer>
    </div>
  );
};
