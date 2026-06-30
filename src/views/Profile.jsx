import { useState } from 'react';
import { updateProvider } from '../api';
import { fmtINR, pricingUnitLabel, serviceLabel, useToast } from '../utils';

// Convert HH:MM → minutes from midnight
function toMins(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
// Convert minutes from midnight → HH:MM
function fromMins(mins) {
  if (mins == null) return '';
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ── Service icon ──────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const icons = {
    party_hall: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>
      </svg>
    ),
    marriage_hall: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
        <path d="M12 2l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z"/><path d="M5 22v-6a7 7 0 0 1 14 0v6"/>
      </svg>
    ),
    catering: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM6 1v3M10 1v3M14 1v3"/>
      </svg>
    ),
    decoration: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
        <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z"/>
      </svg>
    ),
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--mm-gold-t)', color: 'var(--mm-gold-d)',
      borderRadius: 20, padding: '4px 12px', fontSize: 12.5, fontWeight: 600 }}>
      {icons[type]}
      {serviceLabel(type)}
    </span>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, sub, children }) {
  return (
    <div className="mm-section">
      <div className="mm-section-head">
        <div>
          <div className="mm-section-title">{title}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--mm-t3)', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      <div className="mm-section-body">{children}</div>
    </div>
  );
}

// ── Main Profile view ─────────────────────────────────────────────────────────
export default function Profile({ provider, onUpdate }) {
  const { show: toast, Toast } = useToast();

  // ── Business info
  const [name,        setName]        = useState(provider.name || '');
  const [description, setDescription] = useState(provider.description || '');

  // ── Location
  const [city, setCity] = useState(provider.location?.city || '');
  const [area, setArea] = useState(provider.location?.area || '');

  // ── Pricing
  const [basePrice,   setBasePrice]   = useState(String(provider.pricing?.base_price ?? ''));
  const [capacityMin, setCapacityMin] = useState(String(provider.capacity?.min ?? ''));
  const [capacityMax, setCapacityMax] = useState(String(provider.capacity?.max ?? ''));
  const pricingUnit = provider.pricing?.unit || 'per_day';

  // ── Timings (session_based only)
  const sessions      = provider.meta?.sessions;
  const bookingType   = provider.meta?.booking_type || 'full_day';
  const isSessionBased = bookingType === 'session_based';

  const [mornStart, setMornStart] = useState(fromMins(sessions?.morning?.start) || '06:00');
  const [mornEnd,   setMornEnd]   = useState(fromMins(sessions?.morning?.end)   || '13:00');
  const [eveStart,  setEveStart]  = useState(fromMins(sessions?.evening?.start) || '16:00');
  const [eveEnd,    setEveEnd]    = useState(fromMins(sessions?.evening?.end)   || '22:00');

  // ── Photos
  const [photoURLs, setPhotoURLs] = useState(
    provider.media?.length
      ? provider.media.map(m => m.url)
      : ['']
  );

  // ── Active status
  const [isActive, setIsActive] = useState(provider.is_active ?? true);

  // ── Save
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim())  { toast('Business name cannot be empty.', 'error'); return; }
    if (!city.trim())  { toast('City cannot be empty.', 'error'); return; }
    if (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
      toast('Please enter a valid base price.', 'error');
      return;
    }

    setSaving(true);
    try {
      const meta = {
        ...provider.meta,
        booking_type: bookingType,
        ...(isSessionBased ? {
          sessions: {
            morning: { start: toMins(mornStart), end: toMins(mornEnd) },
            evening: { start: toMins(eveStart),  end: toMins(eveEnd)  },
          },
        } : {}),
      };

      const validURLs = photoURLs.filter(u => u.trim());
      const media     = validURLs.map(url => ({ url: url.trim(), type: 'photo' }));

      const body = {
        name: name.trim(),
        description: description.trim() || '',
        location: { city: city.trim(), area: area.trim() || '' },
        pricing: {
          base_price: Number(basePrice),
          unit:       pricingUnit,
          currency:   provider.pricing?.currency || 'INR',
        },
        capacity: (capacityMin || capacityMax) ? {
          min: capacityMin ? Number(capacityMin) : undefined,
          max: capacityMax ? Number(capacityMax) : undefined,
        } : {},
        meta,
        media,
        is_active: isActive,
      };

      const res = await updateProvider(provider._id, body);
      onUpdate(res.data);
      toast('Profile updated successfully.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isHall = provider.type === 'party_hall' || provider.type === 'marriage_hall';

  return (
    <div>
      {Toast}

      {/* ── Header strip ── */}
      <div style={{
        background: 'var(--mm-surface)',
        border: '1px solid var(--mm-border)',
        borderRadius: 'var(--mm-radius)',
        padding: '20px 24px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: 'var(--mm-shadow)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, flexShrink: 0,
          background: 'linear-gradient(135deg,#9C2A3E,#8E2236 60%,#6F162A)',
          boxShadow: '0 4px 14px rgba(142,34,54,.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 24, color: '#fff',
        }}>
          {(provider.name || 'V').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {provider.name}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <TypeBadge type={provider.type} />
            <span style={{ fontSize: 12.5, color: 'var(--mm-t3)' }}>
              {provider.location?.city}{provider.location?.area ? `, ${provider.location.area}` : ''}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--mm-t3)' }}>·</span>
            <span style={{ fontSize: 12.5, color: 'var(--mm-t3)' }}>
              {fmtINR(provider.pricing?.base_price)} {pricingUnitLabel(pricingUnit)}
            </span>
          </div>
        </div>
        {/* Active toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button
            className={`mm-toggle ${isActive ? 'on' : ''}`}
            onClick={() => setIsActive(v => !v)}
            aria-label="Toggle active status"
          />
          <span style={{ fontSize: 11, color: isActive ? 'var(--mm-green)' : 'var(--mm-t3)', fontWeight: 600 }}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Business Info */}
          <Section title="Business Info" sub="Your listing name and description">
            <div className="mm-form-group">
              <label className="mm-label">Business name <span>*</span></label>
              <input
                type="text"
                className="mm-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Royal Marriage Hall"
              />
            </div>
            <div className="mm-form-group" style={{ marginBottom: 0 }}>
              <label className="mm-label">Description
                <span style={{ color: 'var(--mm-t3)', fontWeight: 400 }}> (optional)</span>
              </label>
              <textarea
                className="mm-input mm-textarea"
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Tell customers what makes you stand out…"
              />
            </div>
          </Section>

          {/* Location */}
          <Section title="Location" sub="Where customers will find you">
            <div className="mm-form-group">
              <label className="mm-label">City <span>*</span></label>
              <input
                type="text"
                className="mm-input"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Bengaluru"
              />
            </div>
            <div className="mm-form-group" style={{ marginBottom: 0 }}>
              <label className="mm-label">Area / Locality
                <span style={{ color: 'var(--mm-t3)', fontWeight: 400 }}> (optional)</span>
              </label>
              <input
                type="text"
                className="mm-input"
                value={area}
                onChange={e => setArea(e.target.value)}
                placeholder="e.g. Koramangala"
              />
            </div>
          </Section>

          {/* Timings */}
          <Section
            title="Booking Timings"
            sub={isSessionBased ? 'Session windows shown to customers' : 'Full-day bookings — one booking per day'}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--mm-surface-2)', border: '1px solid var(--mm-border)',
              borderRadius: 10, padding: '12px 14px', marginBottom: isSessionBased ? 16 : 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} style={{ color: 'var(--mm-t3)', flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              <div style={{ fontSize: 13, color: 'var(--mm-t2)' }}>
                <strong>{isSessionBased ? 'Session-based' : 'Full-day'}</strong> booking mode
                <span style={{ fontSize: 11, color: 'var(--mm-t3)', marginLeft: 8 }}>
                  set during onboarding — contact support to change
                </span>
              </div>
            </div>

            {isSessionBased && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mm-t3)', marginBottom: 12 }}>
                  Morning Session
                </div>
                <div className="mm-row-2" style={{ marginBottom: 14 }}>
                  <div className="mm-form-group" style={{ marginBottom: 0 }}>
                    <label className="mm-label">Start time</label>
                    <input type="time" className="mm-input" value={mornStart} onChange={e => setMornStart(e.target.value)} />
                  </div>
                  <div className="mm-form-group" style={{ marginBottom: 0 }}>
                    <label className="mm-label">End time</label>
                    <input type="time" className="mm-input" value={mornEnd} onChange={e => setMornEnd(e.target.value)} />
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mm-t3)', marginBottom: 12 }}>
                  Evening Session
                </div>
                <div className="mm-row-2">
                  <div className="mm-form-group" style={{ marginBottom: 0 }}>
                    <label className="mm-label">Start time</label>
                    <input type="time" className="mm-input" value={eveStart} onChange={e => setEveStart(e.target.value)} />
                  </div>
                  <div className="mm-form-group" style={{ marginBottom: 0 }}>
                    <label className="mm-label">End time</label>
                    <input type="time" className="mm-input" value={eveEnd} onChange={e => setEveEnd(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </Section>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Pricing */}
          <Section title="Pricing" sub="Shown on your listing to customers">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--mm-gold-t)', border: '1px solid rgba(201,162,39,.25)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15} style={{ color: 'var(--mm-gold-d)', flexShrink: 0 }}>
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--mm-gold-d)' }}>
                Pricing unit: <strong>{pricingUnitLabel(pricingUnit)}</strong> — set at onboarding
              </span>
            </div>

            <div className="mm-form-group" style={{ marginBottom: isHall ? 16 : 0 }}>
              <label className="mm-label">
                Base price (₹) — {pricingUnitLabel(pricingUnit)} <span>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--mm-t2)',
                }}>₹</span>
                <input
                  type="number"
                  className="mm-input"
                  style={{ paddingLeft: 30 }}
                  value={basePrice}
                  onChange={e => setBasePrice(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
            </div>

            {isHall && (
              <>
                <div className="mm-divider" />
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--mm-t2)' }}>
                  Guest capacity <span style={{ fontWeight: 400, color: 'var(--mm-t3)' }}>(optional)</span>
                </div>
                <div className="mm-row-2">
                  <div className="mm-form-group" style={{ marginBottom: 0 }}>
                    <label className="mm-label">Minimum guests</label>
                    <input
                      type="number"
                      className="mm-input"
                      placeholder="e.g. 50"
                      value={capacityMin}
                      onChange={e => setCapacityMin(e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="mm-form-group" style={{ marginBottom: 0 }}>
                    <label className="mm-label">Maximum guests</label>
                    <input
                      type="number"
                      className="mm-input"
                      placeholder="e.g. 500"
                      value={capacityMax}
                      onChange={e => setCapacityMax(e.target.value)}
                      min="0"
                    />
                  </div>
                </div>
              </>
            )}
          </Section>

          {/* Photos */}
          <Section title="Photos" sub="Listings with photos get more bookings">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {photoURLs.map((url, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="url"
                    className="mm-input"
                    placeholder={`Photo URL ${i + 1}`}
                    value={url}
                    onChange={e => {
                      const next = [...photoURLs];
                      next[i] = e.target.value;
                      setPhotoURLs(next);
                    }}
                  />
                  {photoURLs.length > 1 && (
                    <button
                      onClick={() => setPhotoURLs(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        width: 38, height: 38, borderRadius: 9,
                        background: 'var(--mm-red-t)', color: 'var(--mm-red)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}>
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setPhotoURLs(prev => [...prev, ''])}
              className="mm-btn mm-btn-ghost"
              style={{ width: '100%', marginTop: 10, fontSize: 13 }}
            >
              + Add another photo
            </button>

            {photoURLs.some(u => u.trim()) && (
              <div className="mm-photo-grid">
                {photoURLs.filter(u => u.trim()).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="mm-photo-thumb"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Listing status */}
          <div className="mm-section">
            <div className="mm-section-head">
              <div className="mm-section-title">Listing status</div>
            </div>
            <div className="mm-section-body">
              <div className="mm-toggle-row">
                <div className="mm-toggle-info">
                  <div className="mm-toggle-label">
                    {isActive ? 'Accepting bookings' : 'Not accepting bookings'}
                  </div>
                  <div className="mm-toggle-sub">
                    {isActive
                      ? 'Your listing is visible and customers can send requests'
                      : 'Your listing is hidden — no new requests will come in'}
                  </div>
                </div>
                <button
                  className={`mm-toggle ${isActive ? 'on' : ''}`}
                  onClick={() => setIsActive(v => !v)}
                  aria-label="Toggle listing active status"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save bar ── */}
      <div style={{
        marginTop: 24,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 12,
        padding: '16px 0',
        borderTop: '1px solid var(--mm-border)',
      }}>
        <button
          className="mm-btn mm-btn-ghost"
          onClick={() => {
            // Reset to last saved state
            setName(provider.name || '');
            setDescription(provider.description || '');
            setCity(provider.location?.city || '');
            setArea(provider.location?.area || '');
            setBasePrice(String(provider.pricing?.base_price ?? ''));
            setCapacityMin(String(provider.capacity?.min ?? ''));
            setCapacityMax(String(provider.capacity?.max ?? ''));
            setIsActive(provider.is_active ?? true);
            setPhotoURLs(provider.media?.length ? provider.media.map(m => m.url) : ['']);
            toast('Changes discarded.', 'info');
          }}
        >
          Discard changes
        </button>
        <button
          className="mm-btn mm-btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 140 }}
        >
          {saving ? <span className="mm-spin" /> : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <path d="M17 21v-8H7v8M7 3v5h8"/>
            </svg>
          )}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
