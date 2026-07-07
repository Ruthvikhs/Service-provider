// ── Base ─────────────────────────────────────────────────────────────────────
const PROVIDERS = import.meta.env.VITE_PROVIDERS_URL || 'http://localhost:3005';
const BOOKINGS  = import.meta.env.VITE_BOOKINGS_URL  || 'http://localhost:3004';
const AUTH      = import.meta.env.VITE_AUTH_URL      || 'http://localhost:3001';

function token()   {
  console.log(localStorage.getItem('mm_token'));  
  return localStorage.getItem('mm_token'); }
function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` };
}

async function req(url, opts = {}) {
  const res  = await fetch(url, { ...opts, headers: { ...headers(), ...opts.headers } });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.status  = res.status;
    err.errors  = data.errors;
    err.data    = data;
    throw err;
  }
  return data;
}

// ── Auth (phone + OTP) ────────────────────────────────────────────────────────
function authReq(path, body) {
  return fetch(`${AUTH}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw Object.assign(new Error(d.message || 'Request failed'), d);
    return d;
  });
}

export const registerVendor = ({ name, phone, email }) =>
  fetch(`${AUTH}/users`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, phone, email, role: 'vendor' }),
  }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw Object.assign(new Error(d.message || 'Sign up failed'), d);
    return d;
  });

export const requestOtp = (phone, email) =>
  authReq('/auth/request-otp', { phone, email });

export const verifyOtp = (phone, code) =>
  authReq('/auth/verify-otp', { phone, code });

// ── Providers ─────────────────────────────────────────────────────────────────
export const createProvider = body =>
  req(`${PROVIDERS}/providers`, { method: 'POST', body: JSON.stringify(body) });

export const getProvider = id =>
  req(`${PROVIDERS}/providers/${id}`);

// Fetch the provider that belongs to a given user — used on login to skip
// Onboarding for returning vendors.
export const getProviderByOwner = ownerId =>
  req(`${PROVIDERS}/providers?owner_id=${ownerId}`);

export const updateProvider = (id, body) =>
  req(`${PROVIDERS}/providers/${id}`, { method: 'PUT', body: JSON.stringify(body) });

// ── Availability ──────────────────────────────────────────────────────────────
export const getAvailability = (providerId, { from, to } = {}) => {
  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to)   p.set('to',   to);
  return req(`${PROVIDERS}/providers/${providerId}/availability?${p}`);
};

export const blockSlot = (providerId, body) =>
  req(`${PROVIDERS}/providers/${providerId}/availability`, {
    method: 'POST',
    body:   JSON.stringify(body),
  });

export const unblockSlot = id =>
  req(`${PROVIDERS}/availability/${id}`, { method: 'DELETE' });

// ── Bookings ──────────────────────────────────────────────────────────────────
export const getProviderBookings = (providerId, status) => {
  const p = new URLSearchParams();
  if (providerId) p.set('providerId', providerId);
  if (status)     p.set('status',     status);
  return req(`${BOOKINGS}/bookings?${p}`);
};

export const getBookingById = id =>
  req(`${BOOKINGS}/bookings/${id}`);

export const respondToBooking = (bookingId, decision, note = '') =>
  req(`${BOOKINGS}/bookings/${bookingId}/provider-response`, {
    method: 'POST',
    body:   JSON.stringify({ decision, note }),
  });

export const createManualBooking = body =>
  req(`${BOOKINGS}/bookings/manual`, { method: 'POST', body: JSON.stringify(body) });

export const blockSlotForWalkIn = (providerId, body) =>
  req(`${PROVIDERS}/providers/${providerId}/availability`, {
    method: 'POST',
    body:   JSON.stringify({ ...body, reason: 'booking' }),
  });