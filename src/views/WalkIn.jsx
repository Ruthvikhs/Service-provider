import { useState, useEffect, useCallback } from 'react';
import { blockSlotForWalkIn, createManualBooking, getAvailability, unblockSlot } from '../api';
import { fmtDate, slotLabel, useToast } from '../utils';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function slotOptions(provider) {
  const type = provider.meta?.booking_type;
  if (type === 'session_based') {
    return [
      { value: 'morning', label: 'Morning session' },
      { value: 'evening', label: 'Evening session' },
    ];
  }
  return [{ value: 'full_day', label: 'Full Day' }];
}

export default function WalkIn({ provider }) {
  const [date,       setDate]       = useState(todayISO());
  const [slot,       setSlot]       = useState(slotOptions(provider)[0]?.value || 'full_day');
  const [custName,   setCustName]   = useState('');
  const [guests,     setGuests]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [blocks,     setBlocks]     = useState([]);   // availability blocks with reason:'booking'
  const [loadBlocks, setLoadBlocks] = useState(true);
  const { show: toast, Toast }      = useToast();

  const loadWalkIns = useCallback(async () => {
    setLoadBlocks(true);
    try {
      // Only fetch upcoming
      const from = new Date().toISOString().split('T')[0];
      const res  = await getAvailability(provider._id, { from });
      const walkInBlocks = (res.data || []).filter(b => b.reason === 'booking');
      setBlocks(walkInBlocks);
    } catch { /* silent */ }
    finally { setLoadBlocks(false); }
  }, [provider._id]);

  useEffect(() => { loadWalkIns(); }, [loadWalkIns]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) { toast('Please pick a date.', 'error'); return; }

    setLoading(true);
    try {
      // Primary: attempt POST /bookings/manual (needs backend implementation)
      // Falls back to availability block which works with current backend.
      let used = 'manual';
      try {
        await createManualBooking({
          provider_id:  provider._id,
          service_type: provider.type,
          slot: { date, session: slot },
          guests_count: guests ? Number(guests) : undefined,
          requirements: { notes: [custName && `Customer: ${custName}`, notes].filter(Boolean).join(' — ') || undefined },
          source: 'manual',
        });
      } catch (manualErr) {
        if (manualErr.status === 404) {
          // Endpoint not yet implemented — fall back to availability block
          used = 'availability';
          await blockSlotForWalkIn(provider._id, {
            date,
            slot,
            reason: 'booking',
          });
        } else {
          throw manualErr;
        }
      }

      toast(
        used === 'manual'
          ? 'Walk-in booking registered. Slot is now blocked for online customers.'
          : 'Slot blocked. (Walk-in booking endpoint coming soon — availability block used as interim.)',
        'success',
      );

      // Reset form
      setDate(todayISO());
      setSlot(slotOptions(provider)[0]?.value || 'full_day');
      setCustName('');
      setGuests('');
      setNotes('');

      loadWalkIns();
    } catch (err) {
      toast(err.message || 'Failed to register booking.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (blockId) => {
    try {
      await unblockSlot(blockId);
      setBlocks(prev => prev.filter(b => b._id !== blockId));
      toast('Walk-in removed. Slot is now available for online booking.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to remove.', 'error');
    }
  };

  const slots = slotOptions(provider);

  return (
    <div>
      {Toast}

      <div className="mm-banner info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} style={{flexShrink:0,marginTop:1}}>
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>
        </svg>
        <div>
          Register a physical walk-in customer here. Once logged, that slot becomes
          unavailable for online bookings, preventing double-booking.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left: form ── */}
        <div className="mm-section">
          <div className="mm-section-head">
            <div className="mm-section-title">Log walk-in booking</div>
          </div>
          <div className="mm-section-body">
            <form onSubmit={handleSubmit}>
              <div className="mm-form-group">
                <label className="mm-label">Date <span>*</span></label>
                <input
                  type="date"
                  className="mm-input"
                  value={date}
                  min={todayISO()}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              <div className="mm-form-group">
                <label className="mm-label">Session <span>*</span></label>
                <select
                  className="mm-input mm-select"
                  value={slot}
                  onChange={e => setSlot(e.target.value)}
                >
                  {slots.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="mm-divider" />

              <div className="mm-form-group">
                <label className="mm-label">Customer name <span style={{color:'var(--mm-t3)',fontWeight:400}}>(optional)</span></label>
                <input
                  type="text"
                  className="mm-input"
                  placeholder="e.g. Priya Sharma"
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                />
              </div>

              <div className="mm-form-group">
                <label className="mm-label">Guests <span style={{color:'var(--mm-t3)',fontWeight:400}}>(optional)</span></label>
                <input
                  type="number"
                  className="mm-input"
                  placeholder="Number of guests"
                  value={guests}
                  onChange={e => setGuests(e.target.value)}
                  min="0"
                />
              </div>

              <div className="mm-form-group" style={{ marginBottom: 0 }}>
                <label className="mm-label">Notes <span style={{color:'var(--mm-t3)',fontWeight:400}}>(optional)</span></label>
                <textarea
                  className="mm-input mm-textarea"
                  placeholder="Any requirements or notes…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  type="submit"
                  className="mm-btn mm-btn-primary"
                  style={{ width: '100%' }}
                  disabled={loading}
                >
                  {loading ? <span className="mm-spin" /> : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16}>
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  )}
                  {loading ? 'Registering…' : 'Register walk-in'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Right: existing walk-ins ── */}
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
            Upcoming walk-ins
          </div>

          {loadBlocks ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="mm-spin" />
            </div>
          ) : blocks.length === 0 ? (
            <div className="mm-empty" style={{ padding: '36px 20px' }}>
              <div className="mm-empty-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={26} height={26} style={{color:'var(--mm-t3)'}}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              <div className="mm-empty-title">No walk-ins yet</div>
              <div className="mm-empty-sub">Logged walk-ins will appear here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {blocks.map(block => (
                <div key={block._id} className="mm-req" style={{ padding: '14px 18px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                      {fmtDate(block.date)}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--mm-t2)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="mm-badge mm-badge-busy" style={{ fontSize: 11 }}>
                        <span className="mm-bdot" />{slotLabel(block.slot)}
                      </span>
                      <span style={{ color: 'var(--mm-t3)' }}>Walk-in booked</span>
                    </div>
                  </div>
                  <button
                    className="mm-btn mm-btn-ghost mm-btn-sm"
                    style={{ fontSize: 12, color: 'var(--mm-red)' }}
                    onClick={() => handleRemove(block._id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
