import { useState } from 'react';
import LoginPage     from './pages/Login';
import Onboarding    from './pages/Onboarding';
import Portal        from './pages/Portal';
import { decodeJWT } from './utils';
import { getProviderByOwner } from './api';
import './index.css';

function loadFromStorage(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export default function App() {
  const [token,    setToken]    = useState(() => localStorage.getItem('mm_token'));
  const [user,     setUser]     = useState(() => {
    const t = localStorage.getItem('mm_token');
    return t ? decodeJWT(t) : null;
  });
  const [provider, setProvider] = useState(() => loadFromStorage('mm_provider'));
  const [checking, setChecking] = useState(false);

  const handleLogin = async (responseData) => {
    const tk  = responseData.token || responseData.data?.token;
    const usr = responseData.user  || responseData.data?.user || decodeJWT(tk);
    localStorage.setItem('mm_token', tk);
    setToken(tk);
    setUser(usr);

    // After login, check if this vendor already has a provider profile so
    // returning vendors go straight to Portal instead of Onboarding.
    setChecking(true);
    try {
      const res      = await getProviderByOwner(usr._id);
      const existing = Array.isArray(res.data) ? res.data[0] : res.data;
      if (existing?._id) {
        localStorage.setItem('mm_provider', JSON.stringify(existing));
        setProvider(existing);
      }
    } catch {
      // No provider yet — Onboarding will handle it
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mm_token');
    localStorage.removeItem('mm_provider');
    setToken(null);
    setUser(null);
    setProvider(null);
  };

  const saveProvider = (prov) => {
    localStorage.setItem('mm_provider', JSON.stringify(prov));
    setProvider(prov);
  };

  // Not logged in
  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Checking for existing provider right after login
  if (checking) {
    return (
      <div className="mm-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="mm-spin" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <div style={{ marginTop: 16, fontSize: 13, color: 'var(--mm-t3)' }}>Loading your profile…</div>
        </div>
      </div>
    );
  }

  // Logged in but no provider profile yet → onboarding
  if (!provider) {
    return <Onboarding user={user} onComplete={saveProvider} />;
  }

  // Fully set up
  return (
    <Portal
      user={user}
      provider={provider}
      onLogout={handleLogout}
      onProviderUpdate={saveProvider}
    />
  );
}