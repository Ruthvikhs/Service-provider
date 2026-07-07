import { useState, useRef } from 'react';
import { createProvider }   from '../api';
import { pricingUnitFor }   from '../utils';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcPartyHall = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>
  </svg>
);
const IcMarriage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z"/>
    <path d="M5 22v-6a7 7 0 0 1 14 0v6"/>
  </svg>
);
const IcCatering = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM6 1v3M10 1v3M14 1v3"/>
  </svg>
);
const IcDeco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z"/>
  </svg>
);
const IcCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const SERVICE_TYPES = [
  { id: 'party_hall',    label: 'Party Hall',     sub: 'Birthday, corporate, social events',  Icon: IcPartyHall },
  { id: 'marriage_hall', label: 'Marriage Hall',   sub: 'Weddings, receptions, sangeet',       Icon: IcMarriage  },
  { id: 'catering',      label: 'Catering',        sub: 'Food service, menu packages',         Icon: IcCatering  },
  { id: 'decoration',    label: 'Decoration',      sub: 'Floral, lighting, stage setup',       Icon: IcDeco      },
];

// Convert HH:MM string → minutes from midnight
function toMins(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
// Convert minutes from midnight → HH:MM string
function fromMins(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

const STEP_LABELS = ['Service', 'Timings', 'Pricing', 'Location', 'Photos'];

export default function Onboarding({ user, onComplete }) {
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // ── Step 1 state
  const [serviceType, setServiceType] = useState('');

  // ── Step 2 state
  const [bookingType, setBookingType]   = useState(''); // 'full_day' | 'session_based'
  const [mornStart,   setMornStart]     = useState('06:00');
  const [mornEnd,     setMornEnd]       = useState('13:00');
  const [eveStart,    setEveStart]      = useState('16:00');
  const [eveEnd,      setEveEnd]        = useState('22:00');

  // ── Step 3 state
  const [basePrice,   setBasePrice]     = useState('');
  const [capacityMin, setCapacityMin]   = useState('');
  const [capacityMax, setCapacityMax]   = useState('');

  // ── Step 4 state — location
  const [bizName,     setBizName]     = useState('');
  const [description, setDescription] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [area,        setArea]        = useState('');
  const [city,        setCity]        = useState('');
  const [stateName,   setStateName]   = useState('');
  const [pincode,     setPincode]     = useState('');
  const [coords,      setCoords]      = useState(null); // { lat, lng } — required
  const [gpsLoading,  setGpsLoading]  = useState(false);
  const [gpsError,    setGpsError]    = useState('');

  // ── Step 5 state
  const [photoFiles, setPhotoFiles]     = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [photoURLs,   setPhotoURLs]     = useState(['']);
  const fileRef = useRef(null);

  const goNext = () => setStep(s => s + 1);
  const goBack = () => { setError(''); setStep(s => s - 1); };

  // ── GPS detect + reverse geocode ─────────────────────────────────────────────
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Your browser does not support location access.');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
            { headers: { 'User-Agent': 'MaduveMane/1.0 (venue-booking-app)' } }
          );
          const data = await res.json();
          const a    = data.address || {};
          const street = [a.house_number, a.road].filter(Boolean).join(', ');
          setAddressLine(street || '');
          setArea(a.neighbourhood || a.suburb || a.quarter || '');
          setCity(a.city || a.town || a.village || a.county || '');
          setStateName(a.state || '');
          setPincode(a.postcode || '');
        } catch {
          setGpsError('Location detected but could not fetch address — please fill in manually.');
        }
        setCoords({ lat, lng });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1 /* PERMISSION_DENIED */) {
          setGpsError('Location access was denied. Please allow location access in your browser settings and try again.');
        } else {
          setGpsError('Could not detect location. Please try again or fill in the address manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // ── Step validators
  const validateStep = () => {
    setError('');
    if (step === 0 && !serviceType) { setError('Please select the service you provide.'); return false; }
    if (step === 1 && !bookingType) { setError('Please select a booking type.'); return false; }
    if (step === 2) {
      if (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
        setError('Please enter a valid price.'); return false;
      }
    }
    if (step === 3) {
      if (!bizName.trim()) { setError('Please enter your business name.'); return false; }
      if (!city.trim())    { setError('Please enter your city.'); return false; }
      if (!coords)         { setError('Please detect your location using the GPS button above — this is required to list your venue.'); return false; }
    }
    return true;
  };

  const handleNext = () => { if (validateStep()) goNext(); };

  // ── Photo handling
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setPhotoFiles(prev => [...prev, ...files]);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (i) => {
    setPhotoFiles(prev => prev.filter((_, j) => j !== i));
    setPhotoPreviews(prev => prev.filter((_, j) => j !== i));
  };

  // ── Final submit
  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const unit = pricingUnitFor(serviceType);
      const meta = {
        booking_type: bookingType,
        ...(bookingType === 'session_based' ? {
          sessions: {
            morning: { start: toMins(mornStart), end: toMins(mornEnd) },
            evening: { start: toMins(eveStart),  end: toMins(eveEnd)  },
          },
        } : {}),
      };

      const validURLs = photoURLs.filter(u => u.trim());
      const media = validURLs.map(url => ({ url: url.trim(), type: 'photo' }));

      const body = {
        owner_id:    user._id,
        name:        bizName.trim(),
        description: description.trim() || undefined,
        type:        serviceType,
        location: {
          city: city.trim(),
          area: area.trim() || undefined,
          geo: coords
            ? { type: 'Point', coordinates: [coords.lng, coords.lat] }
            : undefined,
        },
        pricing: {
          base_price: Number(basePrice),
          unit,
          currency:   'INR',
        },
        capacity: (capacityMin || capacityMax) ? {
          min: capacityMin ? Number(capacityMin) : undefined,
          max: capacityMax ? Number(capacityMax) : undefined,
        } : undefined,
        meta,
        media,
        is_active: true,
      };

      const res = await createProvider(body);
      onComplete(res.data);
    } catch (err) {
      setError(err.message || 'Failed to create your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pricingUnit = pricingUnitFor(serviceType);
  const pricingHint = {
    per_day:   'Total amount charged for the full day booking',
    per_plate: 'Price per person / per plate served',
    per_event: 'Flat rate for the entire event decoration setup',
  }[pricingUnit] || '';

  return (
    <div className="mm-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div style={{
        background: 'var(--mm-surface)',
        border: '1px solid var(--mm-border)',
        borderRadius: 20,
        boxShadow: 'var(--mm-shadow-lg)',
        width: '100%',
        maxWidth: 620,
        padding: '36px 40px 32px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div className="mm-logo" style={{ width: 38, height: 38, fontSize: 18, borderRadius: 10, flexShrink: 0 }}>M</div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700 }}>Set up your profile</div>
            <div style={{ fontSize: 12, color: 'var(--mm-t3)', marginTop: 1 }}>
              Hi {user?.name || 'there'} — just a few steps to go live
            </div>
          </div>
        </div>

        {/* Step progress */}
        <div className="mm-steps" style={{ marginBottom: 32 }}>
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="mm-step">
              <div className={`mm-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`}
                style={{ cursor: i < step ? 'pointer' : 'default' }}
                onClick={() => i < step && setStep(i)}
              >
                {i < step ? <IcCheck /> : i + 1}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`mm-step-line ${i < step ? 'done' : ''}`} />
              )}
            </div>
          ))}
        </div>

        <div style={{ minHeight: 320 }}>

          {/* ── STEP 0: Service type ── */}
          {step === 0 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                  What service do you provide?
                </div>
                <div style={{ fontSize: 13, color: 'var(--mm-t2)' }}>
                  Each vendor account is tied to one service type.
                </div>
              </div>
              <div className="mm-option-grid">
                {SERVICE_TYPES.map(({ id, label, sub, Icon }) => (
                  <button
                    key={id}
                    className={`mm-option-card ${serviceType === id ? 'selected' : ''}`}
                    onClick={() => setServiceType(id)}
                  >
                    <div className="oc-check"><IcCheck /></div>
                    <div className="oc-icon"><Icon /></div>
                    <div className="oc-title">{label}</div>
                    <div className="oc-sub">{sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 1: Timings ── */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                  How do you take bookings?
                </div>
                <div style={{ fontSize: 13, color: 'var(--mm-t2)' }}>
                  This determines how customers can book your {
                    SERVICE_TYPES.find(s => s.id === serviceType)?.label || 'service'
                  }.
                </div>
              </div>

              {/* Full day option */}
              <button
                className={`mm-option-card ${bookingType === 'full_day' ? 'selected' : ''}`}
                style={{ width: '100%', marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16, padding: '18px 20px' }}
                onClick={() => setBookingType('full_day')}
              >
                <div className="oc-check"><IcCheck /></div>
                <div className="oc-icon" style={{ flexShrink: 0, margin: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={22} height={22}>
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="oc-title">Full Day</div>
                  <div className="oc-sub">Customers book the entire day — one booking per day</div>
                </div>
              </button>

              {/* Session based option */}
              <button
                className={`mm-option-card ${bookingType === 'session_based' ? 'selected' : ''}`}
                style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 16, padding: '18px 20px' }}
                onClick={() => setBookingType('session_based')}
              >
                <div className="oc-check"><IcCheck /></div>
                <div className="oc-icon" style={{ flexShrink: 0, margin: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={22} height={22}>
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                    <path d="M8 2v4M16 2v4"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="oc-title">Session Based</div>
                  <div className="oc-sub">Split into morning and evening slots — two bookings per day possible</div>
                </div>
              </button>

              {/* Session time pickers — show only when session_based */}
              {bookingType === 'session_based' && (
                <div style={{
                  background: 'var(--mm-surface-2)',
                  border: '1px solid var(--mm-border)',
                  borderRadius: 12,
                  padding: '18px 20px',
                  marginTop: 16,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mm-t3)', marginBottom: 16 }}>
                    Session Windows
                  </div>
                  <div className="mm-row-2" style={{ marginBottom: 14 }}>
                    <div className="mm-form-group" style={{ marginBottom: 0 }}>
                      <label className="mm-label">Morning start</label>
                      <input type="time" className="mm-input" value={mornStart} onChange={e => setMornStart(e.target.value)} />
                    </div>
                    <div className="mm-form-group" style={{ marginBottom: 0 }}>
                      <label className="mm-label">Morning end</label>
                      <input type="time" className="mm-input" value={mornEnd} onChange={e => setMornEnd(e.target.value)} />
                    </div>
                  </div>
                  <div className="mm-row-2">
                    <div className="mm-form-group" style={{ marginBottom: 0 }}>
                      <label className="mm-label">Evening start</label>
                      <input type="time" className="mm-input" value={eveStart} onChange={e => setEveStart(e.target.value)} />
                    </div>
                    <div className="mm-form-group" style={{ marginBottom: 0 }}>
                      <label className="mm-label">Evening end</label>
                      <input type="time" className="mm-input" value={eveEnd} onChange={e => setEveEnd(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Pricing ── */}
          {step === 2 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                  What are your rates?
                </div>
                <div style={{ fontSize: 13, color: 'var(--mm-t2)' }}>
                  This is shown to customers when they browse your listing.
                </div>
              </div>

              <div className="mm-form-group">
                <label className="mm-label">
                  Base price (₹) — <span style={{ color: 'var(--mm-t3)', fontWeight: 400 }}>{pricingUnit.replace('_', ' ')}</span>
                  <span>*</span>
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
                    placeholder="0"
                    value={basePrice}
                    onChange={e => setBasePrice(e.target.value)}
                    min="0"
                    step="100"
                  />
                </div>
                {pricingHint && <div className="mm-input-hint">{pricingHint}</div>}
              </div>

              {(serviceType === 'party_hall' || serviceType === 'marriage_hall') && (
                <div>
                  <div className="mm-divider" />
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--mm-t2)' }}>
                    Guest capacity <span style={{ fontWeight: 400, color: 'var(--mm-t3)' }}>(optional)</span>
                  </div>
                  <div className="mm-row-2">
                    <div className="mm-form-group" style={{ marginBottom: 0 }}>
                      <label className="mm-label">Minimum guests</label>
                      <input type="number" className="mm-input" placeholder="e.g. 50"
                        value={capacityMin} onChange={e => setCapacityMin(e.target.value)} min="0" />
                    </div>
                    <div className="mm-form-group" style={{ marginBottom: 0 }}>
                      <label className="mm-label">Maximum guests</label>
                      <input type="number" className="mm-input" placeholder="e.g. 500"
                        value={capacityMax} onChange={e => setCapacityMax(e.target.value)} min="0" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Location ── */}
          {step === 3 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                  Where are you based?
                </div>
                <div style={{ fontSize: 13, color: 'var(--mm-t2)' }}>
                  We need your exact location to show customers where you are.
                </div>
              </div>

              <div className="mm-form-group">
                <label className="mm-label">Business name <span>*</span></label>
                <input type="text" className="mm-input" placeholder="e.g. Royal Marriage Hall"
                  value={bizName} onChange={e => setBizName(e.target.value)} />
              </div>

              <div className="mm-form-group">
                <label className="mm-label">Short description <span style={{ color: 'var(--mm-t3)', fontWeight: 400 }}>(optional)</span></label>
                <textarea className="mm-input mm-textarea"
                  placeholder="Tell customers what makes you special…"
                  value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>

              {/* GPS button */}
              <div style={{
                background: coords ? 'rgba(74,157,97,.07)' : 'var(--mm-surface-2)',
                border: `1px solid ${coords ? 'rgba(74,157,97,.3)' : 'var(--mm-border)'}`,
                borderRadius: 12, padding: '16px 18px', marginBottom: 18,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--mm-t3)', marginBottom: 10 }}>
                  Venue GPS location <span style={{ color: 'var(--mm-red)', fontWeight: 700 }}>*</span>
                </div>

                {coords ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(74,157,97,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--mm-green)" strokeWidth="2.5" width={15} height={15}>
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mm-green)' }}>Location detected</div>
                        <div style={{ fontSize: 11, color: 'var(--mm-t3)', marginTop: 1 }}>
                          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={detectLocation}
                      className="mm-btn mm-btn-ghost"
                      style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }}
                      disabled={gpsLoading}
                    >
                      Re-detect
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={detectLocation}
                    className="mm-btn mm-btn-primary"
                    style={{ width: '100%', gap: 8, padding: '12px' }}
                    disabled={gpsLoading}
                  >
                    {gpsLoading ? <span className="mm-spin" /> : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16}>
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20"/>
                      </svg>
                    )}
                    {gpsLoading ? 'Detecting location…' : 'Detect my location'}
                  </button>
                )}

                {gpsError && (
                  <div style={{ fontSize: 12, color: 'var(--mm-red)', marginTop: 10, fontWeight: 500 }}>
                    {gpsError}
                  </div>
                )}
              </div>

              {/* Full address fields — shown always, auto-filled by GPS */}
              <div className="mm-form-group">
                <label className="mm-label">Street address</label>
                <input type="text" className="mm-input"
                  placeholder="e.g. 12, MG Road"
                  value={addressLine} onChange={e => setAddressLine(e.target.value)} />
              </div>

              <div className="mm-row-2">
                <div className="mm-form-group">
                  <label className="mm-label">Area / Locality</label>
                  <input type="text" className="mm-input" placeholder="e.g. Koramangala"
                    value={area} onChange={e => setArea(e.target.value)} />
                </div>
                <div className="mm-form-group">
                  <label className="mm-label">City <span>*</span></label>
                  <input type="text" className="mm-input" placeholder="e.g. Bengaluru"
                    value={city} onChange={e => setCity(e.target.value)} />
                </div>
              </div>

              <div className="mm-row-2">
                <div className="mm-form-group" style={{ marginBottom: 0 }}>
                  <label className="mm-label">State</label>
                  <input type="text" className="mm-input" placeholder="e.g. Karnataka"
                    value={stateName} onChange={e => setStateName(e.target.value)} />
                </div>
                <div className="mm-form-group" style={{ marginBottom: 0 }}>
                  <label className="mm-label">Pincode</label>
                  <input type="text" className="mm-input" placeholder="e.g. 560034"
                    value={pincode} onChange={e => setPincode(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Photos ── */}
          {step === 4 && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                  Add photos <span style={{ fontWeight: 400, fontSize: 16, color: 'var(--mm-t3)' }}>(optional)</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--mm-t2)' }}>
                  Listings with photos get significantly more bookings.
                </div>
              </div>

              <div className="mm-banner info" style={{ marginBottom: 20 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
                <div>
                  Add your photos by URL below, or skip for now and add them later from your profile.
                  Direct file upload requires a media storage service.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                          width: 40, height: 40, borderRadius: 9, background: 'var(--mm-red-t)',
                          color: 'var(--mm-red)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16}>
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
                style={{ marginTop: 12, width: '100%' }}
              >
                + Add another photo URL
              </button>

              {photoURLs.some(u => u.trim()) && (
                <div className="mm-photo-grid">
                  {photoURLs.filter(u => u.trim()).map((url, i) => (
                    <img key={i} src={url} alt="" className="mm-photo-thumb"
                      onError={e => e.target.style.display = 'none'} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--mm-red-t)', color: 'var(--mm-red)',
            border: '1px solid rgba(166,48,59,.2)',
            borderRadius: 10, padding: '11px 14px', fontSize: 13,
            marginTop: 16, fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {/* Footer nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
          <button
            className="mm-btn mm-btn-ghost"
            onClick={goBack}
            disabled={step === 0}
            style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            ← Back
          </button>

          <div style={{ fontSize: 12, color: 'var(--mm-t3)' }}>
            {step + 1} of {STEP_LABELS.length}
          </div>

          {step < STEP_LABELS.length - 1 ? (
            <button className="mm-btn mm-btn-primary" onClick={handleNext}>
              Continue →
            </button>
          ) : (
            <button
              className="mm-btn mm-btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <span className="mm-spin" /> : null}
              {loading ? 'Creating profile…' : 'Go live →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}