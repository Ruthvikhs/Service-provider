import { useState } from 'react';
import Bookings    from '../views/Bookings';
import WalkIn      from '../views/WalkIn';
import Calendar    from '../views/Calendar';
import Profile     from '../views/Profile';
import { serviceLabel } from '../utils';

// ── Nav icons ─────────────────────────────────────────────────────────────────
const IcBookings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
  </svg>
);
const IcWalkIn = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);
const IcProfile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7h-9M14 17H5M17 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
  </svg>
);
const IcLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
);

const VIEWS = [
  { id: 'bookings', label: 'Booking Requests', Icon: IcBookings },
  { id: 'walkin',   label: 'Walk-in Booking',  Icon: IcWalkIn   },
  { id: 'calendar', label: 'Availability',      Icon: IcCalendar },
  { id: 'profile',  label: 'My Profile',        Icon: IcProfile  },
];

const VIEW_META = {
  bookings: { eyebrow: 'Vendor Portal',    title: 'Booking Requests' },
  walkin:   { eyebrow: 'Vendor Portal',    title: 'Walk-in Booking'  },
  calendar: { eyebrow: 'Vendor Portal',    title: 'Availability'     },
  profile:  { eyebrow: 'Vendor Portal',    title: 'My Profile'       },
};

export default function Portal({ user, provider, onLogout, onProviderUpdate }) {
  const [view,           setView]           = useState('bookings');
  const [pendingCount,   setPendingCount]   = useState(0);

  const meta = VIEW_META[view];
  const initials = (provider.name || 'V').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="mm-app">
      <div className="mm-shell">

        {/* ── Sidebar ── */}
        <aside className="mm-sidebar">
          <div className="mm-brand">
            <div className="mm-logo">M</div>
            <div>
              <div className="mm-brand-name">Maduve Mane</div>
              <div className="mm-brand-sub">Vendor Portal</div>
            </div>
          </div>

          <div className="mm-nav-label">Bookings</div>
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`mm-nav ${view === id ? 'on' : ''}`}
              onClick={() => setView(id)}
            >
              <Icon />
              {label}
              {id === 'bookings' && pendingCount > 0 && (
                <span className="mm-nav-count">{pendingCount}</span>
              )}
            </button>
          ))}

          <div className="mm-side-spacer" />

          {/* Logout */}
          <button
            className="mm-nav"
            onClick={onLogout}
            style={{ marginBottom: 10, color: 'var(--mm-red)' }}
          >
            <IcLogout />
            Sign out
          </button>

          {/* User block */}
          <div className="mm-user">
            <div className="mm-avatar">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div className="mm-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {provider.name}
              </div>
              <div className="mm-user-role">
                {serviceLabel(provider.type)} · {provider.location?.city}
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="mm-main">
          <header className="mm-header">
            <div>
              <div className="mm-eyebrow">{meta.eyebrow}</div>
              <h1 className="mm-title">{meta.title}</h1>
            </div>
          </header>

          <div className="mm-body">
            {view === 'bookings' && (
              <Bookings
                provider={provider}
                onPendingCount={setPendingCount}
              />
            )}
            {view === 'walkin' && (
              <WalkIn provider={provider} />
            )}
            {view === 'calendar' && (
              <Calendar provider={provider} />
            )}
            {view === 'profile' && (
              <Profile
                provider={provider}
                onUpdate={onProviderUpdate}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
