// ── Base ─────────────────────────────────────────────────────────────────────
const PROVIDERS = import.meta.env.VITE_PROVIDERS_URL || 'http://localhost:3003';
const BOOKINGS  = import.meta.env.VITE_BOOKINGS_URL  || 'http://localhost:3004';
const AUTH      = import.meta.env.VITE_AUTH_URL       || 'http://localhost:3001';

function token()   { return localStorage.getItem('mm_token'); }
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

// ── Auth (phone + OTP — users-service has no password login) ──────────────────
function authReq(path, body) {
  return fetch(`${AUTH}${path}`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include', // lets the mandap_auth cookie be set, if useful
    body:        JSON.stringify(body),
  }).then(async r => {
    const d = await r.json();
    if (!r.ok) throw Object.assign(new Error(d.message || 'Request failed'), d);
    return d;
  });
}

/**
 * Registers a brand-new vendor account on users-service.
 * Hits POST /users with role forced to 'vendor'. There's no password —
 * auth happens entirely via phone OTP afterwards (see requestOtp/verifyOtp).
 * If the phone is already registered, the backend returns 409 — the caller
 * can usually just proceed straight to requestOtp in that case.
 */
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

/**
 * Sends an OTP to the given phone. If the phone has no account yet, the
 * backend auto-creates one with role 'user' — so for vendors, always call
 * registerVendor() first to lock in role: 'vendor' before requesting an OTP.
 * In dev (no SMS provider configured), the code is logged to the
 * users-service server console, not actually texted.
 */
export const requestOtp = (phone, email) =>
  authReq('/auth/request-otp', { phone, email });

/**
 * Verifies the OTP and returns { token, user }. This is the only place
 * a real JWT is issued.
 */
export const verifyOtp = (phone, code) =>
  authReq('/auth/verify-otp', { phone, code });

// ── Providers ─────────────────────────────────────────────────────────────────
export const createProvider = body =>
  req(`${PROVIDERS}/providers`, { method: 'POST', body: JSON.stringify(body) });

export const getProvider = id =>
  req(`${PROVIDERS}/providers/${id}`);

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
/**
 * Fetches bookings for the provider's portal view.
 * NOTE: the bookings-service currently scopes GET /bookings to booked_by = user._id.
 * A future backend update (adding provider-view query support) is needed for
 * full functionality. Once updated, pass providerId to filter by provider.
 */
export const getProviderBookings = (providerId, status) => {
  const p = new URLSearchParams();
  if (providerId) p.set('providerId', providerId);
  if (status)     p.set('status',     status);
  return req(`${BOOKINGS}/bookings?${p}`);
};

export const getBookingById = id =>
  req(`${BOOKINGS}/bookings/${id}`);

/**
 * Provider accept/reject a pending booking.
 * Requires role 'vendor' in the JWT.
 * Backend checks: booking.provider_id === req.user._id
 * So your JWT _id must equal the provider document's _id.
 */
export const respondToBooking = (bookingId, decision, note = '') =>
  req(`${BOOKINGS}/bookings/${bookingId}/provider-response`, {
    method: 'POST',
    body:   JSON.stringify({ decision, note }),
  });

/**
 * Creates a walk-in / manual booking.
 * Requires POST /bookings/manual on the bookings-service (to be implemented).
 * When done, backend should create a Booking with source:'manual', status:'confirmed'
 * so the slot is blocked for online customers via the existing conflict check.
 *
 * INTERIM FALLBACK: blockSlotForWalkIn below uses the availability service.
 */
export const createManualBooking = body =>
  req(`${BOOKINGS}/bookings/manual`, { method: 'POST', body: JSON.stringify(body) });

/**
 * Interim: block a slot via service-providers availability.
 * This does NOT block online bookings (which check the Booking collection).
 * Use only until POST /bookings/manual is implemented.
 */
export const blockSlotForWalkIn = (providerId, body) =>
  req(`${PROVIDERS}/providers/${providerId}/availability`, {
    method: 'POST',
    body:   JSON.stringify({ ...body, reason: 'booking' }),
  });
