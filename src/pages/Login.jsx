import { useState } from 'react';
import { registerVendor, requestOtp, verifyOtp } from '../api';

function normalizePhone(raw) {
  return raw.trim().replace(/\s+/g, '');
}

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [step, setStep] = useState(1);         // 1 = enter details, 2 = enter OTP

  // Step 1 fields
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Step 2 fields
  const [code, setCode] = useState('');

  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [info,       setInfo]       = useState('');
  const [phoneError, setPhoneError] = useState('');

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (digits.length > 10) {
      setPhoneError("Phone number can't be more than 10 digits.");
      setPhone(digits.slice(0, 10));
    } else {
      setPhoneError('');
      setPhone(digits);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setStep(1);
    setError('');
    setInfo('');
    setCode('');
  };

  // ── Step 1: create account (if signing up) + send OTP ──
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    const p = normalizePhone(phone);
    if (!p) { setError('Please enter your phone number.'); return; }
    if (p.length !== 10) { setError('Phone number must be exactly 10 digits.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Please enter your name.'); return; }

    setLoading(true);
    try {
      if (mode === 'signup') {
        try {
          // Lock in role: 'vendor' before any OTP exists for this phone.
          await registerVendor({ name: name.trim(), phone: p, email: email.trim() || undefined });
        } catch (err) {
          if (err.status === 409) {
            // Phone already has an account — fine, just sign them in via OTP.
            setInfo('This phone is already registered — sending a code to sign you in.');
          } else {
            throw err;
          }
        }
      }

      await requestOtp(p, email.trim() || undefined);
      setStep(2);
      if (!info) setInfo(`Code sent. In development, check the users-service server console for the OTP (no SMS provider is configured).`);
    } catch (err) {
      setError(err.errors?.[0] || err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ──
  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (!code.trim()) { setError('Please enter the code.'); return; }

    setLoading(true);
    try {
      const data = await verifyOtp(normalizePhone(phone), code.trim());
      onLogin(data);
    } catch (err) {
      setError(err.message || 'Incorrect or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      await requestOtp(normalizePhone(phone), email.trim() || undefined);
      setInfo('A new code has been sent.');
    } catch (err) {
      setError(err.message || 'Could not resend code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mm-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div style={{
        background: 'var(--mm-surface)',
        border: '1px solid var(--mm-border)',
        borderRadius: 20,
        boxShadow: 'var(--mm-shadow-lg)',
        padding: '40px 40px 36px',
        width: '100%',
        maxWidth: 420,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 16,
            background: 'linear-gradient(135deg, #9C2A3E, #8E2236 60%, #6F162A)',
            boxShadow: '0 6px 18px rgba(142,34,54,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 26, color: '#fff',
            margin: '0 auto 14px',
          }}>M</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700 }}>Maduve Mane</div>
          <div style={{ fontSize: 12, color: 'var(--mm-t3)', marginTop: 3, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            Vendor Portal
          </div>
        </div>

        {step === 1 && (
          <>
            {/* Mode switcher */}
            <div style={{ display: 'flex', background: 'var(--mm-s2)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: mode === 'signin' ? 'var(--mm-surface)' : 'transparent',
                  color: mode === 'signin' ? 'var(--mm-t1)' : 'var(--mm-t3)',
                  boxShadow: mode === 'signin' ? 'var(--mm-shadow)' : 'none',
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  background: mode === 'signup' ? 'var(--mm-surface)' : 'transparent',
                  color: mode === 'signup' ? 'var(--mm-t1)' : 'var(--mm-t3)',
                  boxShadow: mode === 'signup' ? 'var(--mm-shadow)' : 'none',
                }}
              >
                New vendor — Sign up
              </button>
            </div>

            <form onSubmit={handleSendOtp}>
              {mode === 'signup' && (
                <div className="mm-form-group">
                  <label className="mm-label">Your name <span>*</span></label>
                  <input
                    type="text"
                    className="mm-input"
                    placeholder="e.g. Priya Sharma"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="mm-form-group">
                <label className="mm-label">Phone number <span>*</span></label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className="mm-input"
                  placeholder="9876543210"
                  value={phone}
                  onChange={handlePhoneChange}
                  autoComplete="tel"
                />
                {phoneError && (
                  <div style={{ fontSize: 12, color: 'var(--mm-red)', marginTop: 4, fontWeight: 500 }}>
                    {phoneError}
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <div className="mm-form-group" style={{ marginBottom: 24 }}>
                  <label className="mm-label">Email <span style={{ color: 'var(--mm-t3)', fontWeight: 400 }}>(optional)</span></label>
                  <input
                    type="email"
                    className="mm-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              )}

              {error && (
                <div style={{
                  background: 'var(--mm-red-t)', color: 'var(--mm-red)',
                  border: '1px solid rgba(166,48,59,.2)', borderRadius: 10,
                  padding: '11px 14px', fontSize: 13, marginBottom: 16, fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="mm-btn mm-btn-primary"
                style={{ width: '100%', padding: '13px', fontSize: 14, marginTop: mode === 'signin' ? 8 : 0 }}
                disabled={loading}
              >
                {loading ? <span className="mm-spin" /> : null}
                {loading ? 'Sending code…' : 'Send OTP'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <form onSubmit={handleVerify}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--mm-t2)' }}>
                Enter the code sent to <strong>{normalizePhone(phone)}</strong>
              </div>
            </div>

            {info && (
              <div style={{
                background: 'var(--mm-gold-t)', color: 'var(--mm-gold-d)',
                border: '1px solid rgba(201,162,39,.25)', borderRadius: 10,
                padding: '11px 14px', fontSize: 12.5, marginBottom: 16, lineHeight: 1.5,
              }}>
                {info}
              </div>
            )}

            <div className="mm-form-group" style={{ marginBottom: 20 }}>
              <label className="mm-label">6-digit code <span>*</span></label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="mm-input"
                placeholder="••••••"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                style={{ letterSpacing: '0.3em', fontSize: 18, textAlign: 'center', fontWeight: 700 }}
                autoFocus
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--mm-red-t)', color: 'var(--mm-red)',
                border: '1px solid rgba(166,48,59,.2)', borderRadius: 10,
                padding: '11px 14px', fontSize: 13, marginBottom: 16, fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="mm-btn mm-btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: 14 }}
              disabled={loading}
            >
              {loading ? <span className="mm-spin" /> : null}
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <a
                onClick={() => { setStep(1); setError(''); setInfo(''); setCode(''); }}
                style={{ fontSize: 12.5, color: 'var(--mm-t3)', cursor: 'pointer', fontWeight: 600 }}
              >
                ← Change number
              </a>
              <a
                onClick={handleResend}
                style={{ fontSize: 12.5, color: 'var(--mm-maroon)', cursor: 'pointer', fontWeight: 600 }}
              >
                Resend code
              </a>
            </div>
          </form>
        )}

        {step === 1 && (
          <p style={{ fontSize: 12, color: 'var(--mm-t3)', textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
            {mode === 'signin' ? (
              <>New here? <a onClick={() => switchMode('signup')} style={{ color: 'var(--mm-maroon)', fontWeight: 600, cursor: 'pointer' }}>Create a vendor account</a></>
            ) : (
              <>Already registered? <a onClick={() => switchMode('signin')} style={{ color: 'var(--mm-maroon)', fontWeight: 600, cursor: 'pointer' }}>Sign in instead</a></>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
