import { useState, useEffect, useCallback } from 'react';
import { getProviderBookings, respondToBooking } from '../api';
import { fmtDate, fmtINR, slotLabel, useToast } from '../utils';

// ── Countdown timer ───────────────────────────────────────────────────────────
function Countdown({ dueBy }) {
  const [secs, setSecs] = useState(() => {
    const diff = Math.floor((new Date(dueBy) - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  if (secs <= 0) return (
    <span className="mm-clock urgent">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      Expired
    </span>
  );

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const label = `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const urgent = secs < 600;

  return (
    <span className={`mm-clock ${urgent ? 'urgent' : ''}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      {label}
    </span>
  );
}

// ── Service icon ──────────────────────────────────────────────────────────────
function ServiceIcon({ type }) {
  const icons = {
    catering: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22,color:'var(--mm-gold-d)'}}>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM6 1v3M10 1v3M14 1v3"/>
      </svg>
    ),
    decoration: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22,color:'var(--mm-gold-d)'}}>
        <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z"/>
      </svg>
    ),
  };
  const fallback = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22,color:'var(--mm-gold-d)'}}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>
    </svg>
  );
  return icons[type] || fallback;
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function DetailModal({ booking, provider, onClose, onDecision }) {
  const [loading,  setLoading]  = useState(false);
  const [note,     setNote]     = useState('');
  const { show: toast, Toast }  = useToast();

  if (!booking) return null;

  const isPending  = booking.status === 'pending';
  const isAccepted = booking.status === 'confirmed';

  const decide = async (decision) => {
    setLoading(true);
    try {
      await respondToBooking(booking._id, decision, note);
      onDecision(booking._id, decision);
      onClose();
    } catch (err) {
      toast(err.message || 'Action failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {Toast}
      <div className="mm-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="mm-modal">
          <div className="mm-modal-head">
            <div className="mm-modal-ic">
              <ServiceIcon type={provider.type} />
            </div>
            <div>
              <div className="mm-modal-title">{booking.service_type}</div>
              <div className="mm-modal-sub">#{booking._id?.slice(-6).toUpperCase()} · {fmtDate(booking.created_at)}</div>
            </div>
            <button className="mm-modal-x" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="mm-modal-body">
            <div className="mm-detail-row">
              <span className="mm-detail-k">Date</span>
              <span className="mm-detail-v">{fmtDate(booking.slot?.date)}</span>
            </div>
            <div className="mm-detail-row">
              <span className="mm-detail-k">Session</span>
              <span className="mm-detail-v">{slotLabel(booking.slot?.session)}</span>
            </div>
            {booking.guests_count > 0 && (
              <div className="mm-detail-row">
                <span className="mm-detail-k">Guests</span>
                <span className="mm-detail-v">{booking.guests_count.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="mm-detail-row">
              <span className="mm-detail-k">Quoted amount</span>
              <span className="mm-detail-v price">{fmtINR(booking.price_quoted)}</span>
            </div>
            <div className="mm-detail-row">
              <span className="mm-detail-k">Linked to event</span>
              <span className="mm-detail-v">{booking.event_id ? 'Yes' : 'Standalone'}</span>
            </div>
            {booking.status === 'confirmed' && booking.payment_due_by && (
              <div className="mm-detail-row">
                <span className="mm-detail-k">Payment window</span>
                <span className="mm-detail-v"><Countdown dueBy={booking.payment_due_by} /></span>
              </div>
            )}
            {booking.provider_response?.note && (
              <div className="mm-detail-row">
                <span className="mm-detail-k">Your note</span>
                <span className="mm-detail-v">{booking.provider_response.note}</span>
              </div>
            )}

            {booking.requirements?.notes && (
              <div className="mm-req-note">
                <div className="mm-req-note-lbl">Customer requirements</div>
                <div className="mm-req-note-txt">{booking.requirements.notes}</div>
              </div>
            )}
            {booking.requirements?.extras?.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {booking.requirements.extras.map((e, i) => (
                  <span key={i} className="mm-badge mm-badge-gold">{e}</span>
                ))}
              </div>
            )}

            {/* Note field for provider response */}
            {isPending && (
              <div className="mm-form-group" style={{ marginTop: 16, marginBottom: 0 }}>
                <label className="mm-label">Add a note (optional)</label>
                <textarea
                  className="mm-input mm-textarea"
                  placeholder="Any message for the customer…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  style={{ minHeight: 64 }}
                />
              </div>
            )}
          </div>

          <div className="mm-modal-foot">
            {isPending ? (
              <>
                <button
                  className="mm-btn mm-btn-outline mm-btn-reject"
                  onClick={() => decide('rejected')}
                  disabled={loading}
                >
                  {loading ? <span className="mm-spin" /> : null}
                  Reject request
                </button>
                <button
                  className="mm-btn mm-btn-primary"
                  onClick={() => decide('accepted')}
                  disabled={loading}
                >
                  {loading ? <span className="mm-spin" /> : null}
                  Accept request
                </button>
              </>
            ) : (
              <button className="mm-btn mm-btn-ghost" onClick={onClose}>Close</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, provider, tab, onView, onQuickDecide }) {
  const [deciding, setDeciding] = useState(null); // 'accepted' | 'rejected'

  const quickDecide = async (decision) => {
    setDeciding(decision);
    try {
      await respondToBooking(booking._id, decision);
      onQuickDecide(booking._id, decision);
    } catch (err) {
      console.error(err);
    } finally {
      setDeciding(null);
    }
  };

  const badgeForTab = {
    pending:  <span className="mm-badge mm-badge-gold"><span className="mm-bdot" />New request</span>,
    accepted: <span className="mm-badge mm-badge-avail"><span className="mm-bdot" />Accepted</span>,
    rejected: <span className="mm-badge mm-badge-busy"><span className="mm-bdot" />Rejected</span>,
    paid:     <span className="mm-badge mm-badge-brand"><span className="mm-bdot" />Paid</span>,
  }[tab];

  return (
    <div className="mm-req" style={{ opacity: tab === 'rejected' ? .75 : 1 }}>
      <div className="mm-req-ic" style={tab === 'rejected' ? { background: 'var(--mm-s2)' } : {}}>
        <ServiceIcon type={provider.type} />
      </div>

      <div className="mm-req-main">
        <div className="mm-req-top">
          <span className="mm-req-svc">{booking.service_type}</span>
          {badgeForTab}
          {booking.event_id && (
            <span className="mm-badge mm-badge-brand">Part of an event</span>
          )}
        </div>
        <div className="mm-req-meta">
          <span>{fmtDate(booking.slot?.date)}</span>
          <span className="mm-req-dot" />
          <span>{slotLabel(booking.slot?.session)}</span>
          {booking.guests_count > 0 && (
            <>
              <span className="mm-req-dot" />
              <span>{booking.guests_count.toLocaleString('en-IN')} guests</span>
            </>
          )}
        </div>
      </div>

      <div className="mm-req-side">
        <span className="mm-req-price" style={tab === 'rejected' ? { color: 'var(--mm-t3)' } : {}}>
          {fmtINR(booking.price_quoted)}
        </span>
        <span className="mm-req-price-lbl">
          {tab === 'accepted' ? 'Awaiting advance' : tab === 'rejected' ? 'Declined' : tab === 'paid' ? 'Paid' : 'Quoted'}
        </span>
      </div>

      <div className="mm-req-actions">
        {tab === 'accepted' && booking.payment_due_by && (
          <Countdown dueBy={booking.payment_due_by} />
        )}

        <button className="mm-btn mm-btn-ghost mm-btn-sm" onClick={() => onView(booking)}>
          Details
        </button>

        {tab === 'pending' && (
          <>
            <button
              className="mm-btn mm-btn-outline mm-btn-reject mm-btn-sm"
              onClick={() => quickDecide('rejected')}
              disabled={deciding !== null}
            >
              {deciding === 'rejected' ? <span className="mm-spin" style={{width:12,height:12}} /> : null}
              Reject
            </button>
            <button
              className="mm-btn mm-btn-primary mm-btn-sm"
              onClick={() => quickDecide('accepted')}
              disabled={deciding !== null}
            >
              {deciding === 'accepted' ? <span className="mm-spin" style={{width:12,height:12}} /> : null}
              Accept
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Bookings view ────────────────────────────────────────────────────────
const TABS = ['pending', 'accepted', 'rejected', 'paid'];
const TAB_LABELS = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', paid: 'Paid' };

export default function Bookings({ provider, onPendingCount }) {
  const [tab,      setTab]      = useState('pending');
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [modal,    setModal]    = useState(null); // booking object
  const { show: toast, Toast }  = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getProviderBookings(provider._id);
      setBookings(res.data || []);
      const pending = (res.data || []).filter(b => b.status === 'pending').length;
      onPendingCount(pending);
    } catch (err) {
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [provider._id]);

  useEffect(() => { load(); }, [load]);

  const handleDecision = (bookingId, decision) => {
    setBookings(prev => prev.map(b =>
      b._id === bookingId
        ? { ...b, status: decision === 'accepted' ? 'confirmed' : 'cancelled',
            provider_response: { decision, responded_at: new Date() } }
        : b
    ));
    const newPending = bookings.filter(b => b._id !== bookingId && b.status === 'pending').length;
    onPendingCount(newPending);
    toast(decision === 'accepted' ? 'Booking accepted! Customer has 2 hours to pay.' : 'Booking rejected.', decision === 'accepted' ? 'success' : 'info');
  };

  // Map status to tabs
  const tabMap = {
    pending:   b => b.status === 'pending',
    accepted:  b => b.status === 'confirmed',
    rejected:  b => b.status === 'cancelled' && b.provider_response?.decision === 'rejected',
    paid:      b => b.status === 'paid',
  };

  const filtered = bookings.filter(tabMap[tab] || (() => false));

  const counts = {};
  TABS.forEach(t => { counts[t] = bookings.filter(tabMap[t] || (() => false)).length; });

  return (
    <div>
      {Toast}

      {/* Backend note */}
      <div className="mm-banner warn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
        <div>
          <strong>Backend note:</strong> The bookings service currently returns only bookings created by the logged-in user.
          A provider-view query (filtering by <code>provider_id</code> across all users) is needed in <code>getAllBookings</code>.
          Once added, this view will show all inbound requests automatically.
        </div>
      </div>

      {/* Stats */}
      <div className="mm-stats">
        <div className="mm-stat">
          <div className="mm-stat-val">{counts.pending}</div>
          <div className="mm-stat-lbl">Pending requests</div>
        </div>
        <div className="mm-stat">
          <div className="mm-stat-val">{counts.accepted}</div>
          <div className="mm-stat-lbl">Accepted today</div>
        </div>
        <div className="mm-stat">
          <div className="mm-stat-val">{counts.paid}</div>
          <div className="mm-stat-lbl">Confirmed & paid</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mm-tabs">
        {TABS.map(t => (
          <button key={t} className={`mm-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
            <span className="mm-tab-pill">{counts[t]}</span>
          </button>
        ))}
        <button className="mm-btn mm-btn-ghost mm-btn-sm" style={{ marginLeft: 'auto', marginBottom: 4 }} onClick={load}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}>
            <path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M22 13a10 10 0 1 1-2.6-6.4L21.5 8"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <span className="mm-spin mm-spin-lg" />
        </div>
      ) : error ? (
        <div className="mm-banner" style={{ background: 'var(--mm-red-t)', color: 'var(--mm-red)', border: '1px solid rgba(166,48,59,.2)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mm-empty">
          <div className="mm-empty-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={26} height={26} style={{color:'var(--mm-t3)'}}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
            </svg>
          </div>
          <div className="mm-empty-title">No {TAB_LABELS[tab].toLowerCase()} bookings</div>
          <div className="mm-empty-sub">
            {tab === 'pending'
              ? 'New requests from customers will show up here.'
              : `Bookings you've ${tab} will appear here.`}
          </div>
        </div>
      ) : (
        <div className="mm-reqs">
          {filtered.map(b => (
            <BookingCard
              key={b._id}
              booking={b}
              provider={provider}
              tab={tab}
              onView={setModal}
              onQuickDecide={handleDecision}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {modal && (
        <DetailModal
          booking={modal}
          provider={provider}
          onClose={() => setModal(null)}
          onDecision={handleDecision}
        />
      )}
    </div>
  );
}
