import { useCallback, useEffect, useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { BuilderHome } from './components/BuilderHome';
import { api } from './lib/api';

type User = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const handleUserUpdated = useCallback((next: User) => setUser(next), []);

  const loadSession = async () => {
    try {
      const data = await api<{ user: User; modelTier: string }>('/api/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-zinc-500 text-sm font-medium">
        Loading RextFlex Ai...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white text-zinc-900 selection:bg-blue-100 selection:text-blue-900 font-sans antialiased">
        <LoginPage onLoginSuccess={setUser} />
      </div>
    );
  }

  const signOut = async () => {
    try {
      localStorage.removeItem('rextflex_auth_token');
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-blue-100 selection:text-blue-900 font-sans antialiased">
      <BuilderHome
        userEmail={user.email}
        initialUserName={user.name}
        initialAvatarUrl={user.image || undefined}
        onSignOut={signOut}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
}
