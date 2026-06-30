import { useState } from 'react';
import LoginPage     from './pages/Login';
import Onboarding    from './pages/Onboarding';
import Portal        from './pages/Portal';
import { decodeJWT } from './utils';
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

  const handleLogin = (responseData) => {
    // responseData shape depends on your auth service.
    // Expects: { token, user } or { data: { token, user } }
    const tk   = responseData.token || responseData.data?.token;
    const usr  = responseData.user  || responseData.data?.user || decodeJWT(tk);
    localStorage.setItem('mm_token', tk);
    setToken(tk);
    setUser(usr);
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
