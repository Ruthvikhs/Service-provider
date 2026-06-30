import { useState, useEffect, useCallback } from 'react';
import { getAvailability, blockSlot, unblockSlot } from '../api';
import { slotLabel, useToast } from '../utils';

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function todayStr() { return new Date().toISOString().split('T')[0]; }

export default function Calendar({ provider }) {
  const today   = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);  // 'YYYY-MM-DD'
  const [modal,    setModal]    = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockSlotVal, setBlockSlotVal]     = useState('full_day');
  const [blockReasonVal, setBlockReasonVal] = useState('personal');
  const { show: toast, Toast } = useToast();

  // Load blocks for +/- 1 month around current view
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = isoDate(year, month - 1, 1);
      const to   = isoDate(year, month + 1, 31);
      const res  = await getAvailability(provider._id, { from, to });
      setBlocks(res.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [provider._id, year, month]);

  useEffect(() => { load(); }, [load]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  // Prev month filler
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, thisMonth: false, past: true });
  }
  // Current month
  const todayFull = todayStr();
  for (let d = 1; d <= daysInMonth; d++) {
    const iso  = isoDate(year, month, d);
    const past = iso < todayFull;
    cells.push({ day: d, thisMonth: true, past, iso });
  }
  // Next month filler
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, thisMonth: false, past: false });
  }

  // Block lookup by ISO date
  const blockMap = {};
  blocks.forEach(b => {
    const iso = b.date?.split('T')[0];
    if (!iso) return;
    if (!blockMap[iso]) blockMap[iso] = [];
    blockMap[iso].push(b);
  });

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleCellClick = (cell) => {
    if (!cell.thisMonth || cell.past) return;
    setSelected(cell.iso);
    setModal(true);
  };

  const handleAddBlock = async () => {
    if (!selected) return;
    setBlocking(true);
    try {
      const res = await blockSlot(provider._id, {
        date:   selected,
        slot:   blockSlotVal,
        reason: blockReasonVal,
      });
      setBlocks(prev => [...prev, res.data]);
      toast('Date blocked successfully.', 'success');
      setModal(false);
    } catch (err) {
      toast(err.message || 'Failed to block date.', 'error');
    } finally {
      setBlocking(false);
    }
  };

  const handleRemoveBlock = async (blockId) => {
    try {
      await unblockSlot(blockId);
      setBlocks(prev => prev.filter(b => b._id !== blockId));
      toast('Block removed — date is available again.', 'success');
    } catch (err) {
      toast(err.message || 'Failed to remove block.', 'error');
    }
  };

  const selectedBlocks = selected ? (blockMap[selected] || []) : [];

  const REASON_LABELS = {
    maintenance: 'Maintenance / cleaning',
    personal:    'Personal / closed',
    booking:     'Walk-in booking',
  };

  const slotOptions = provider.meta?.booking_type === 'session_based'
    ? [
        { value: 'morning',  label: 'Morning session' },
        { value: 'evening',  label: 'Evening session' },
        { value: 'full_day', label: 'Full Day (both)' },
      ]
    : [{ value: 'full_day', label: 'Full Day' }];

  return (
    <div>
      {Toast}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Calendar panel ── */}
        <div className="mm-section">
          <div className="mm-section-head">
            <div className="mm-cal-nav" style={{ width: '100%' }}>
              <button
                className="mm-btn mm-btn-ghost mm-btn-sm"
                onClick={prevMonth}
                style={{ padding: '6px 12px' }}
              >←</button>
              <div className="mm-cal-month">{MONTHS[month]} {year}</div>
              <button
                className="mm-btn mm-btn-ghost mm-btn-sm"
                onClick={nextMonth}
                style={{ padding: '6px 12px' }}
              >→</button>
            </div>
          </div>

          <div className="mm-section-body" style={{ paddingTop: 12 }}>
            <div className="mm-cal-grid">
              {DAYS.map(d => (
                <div key={d} className="mm-cal-day-name">{d}</div>
              ))}
              {cells.map((cell, i) => {
                const cellBlocks   = cell.iso ? (blockMap[cell.iso] || []) : [];
                const hasFullBlock = cellBlocks.some(b => b.slot === 'full_day');
                const hasMorn      = cellBlocks.some(b => b.slot === 'morning');
                const hasEve       = cellBlocks.some(b => b.slot === 'evening');
                const isToday      = cell.iso === todayFull;
                const isSelected   = cell.iso === selected;

                let cls = 'mm-cal-cell';
                if (!cell.thisMonth) cls += ' other-month';
                if (cell.past)       cls += ' past';
                if (isToday)         cls += ' today';
                if (hasFullBlock)    cls += ' full-block';
                else if (hasMorn || hasEve) cls += ' partial-block';
                if (isSelected && !cell.past && cell.thisMonth)  {
                  // highlight selected
                }

                return (
                  <div
                    key={i}
                    className={cls}
                    style={{
                      outline: isSelected && cell.thisMonth ? '2px solid var(--mm-maroon)' : 'none',
                      outlineOffset: -1,
                    }}
                    onClick={() => handleCellClick(cell)}
                  >
                    {cell.day}
                    {cellBlocks.length > 0 && provider.meta?.booking_type === 'session_based' && (
                      <div className="cal-dot">
                        {hasMorn && <span style={{ background: 'var(--mm-amber)' }} title="Morning blocked" />}
                        {hasEve  && <span style={{ background: 'var(--mm-red)'   }} title="Evening blocked" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12, color: 'var(--mm-t2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--mm-red-t)', border: '1px solid var(--mm-red)', display: 'inline-block' }} />
                Blocked
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--mm-amber-t)', border: '1px solid var(--mm-amber)', display: 'inline-block' }} />
                Partially blocked
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--mm-green-t)', border: '1px solid var(--mm-green)', display: 'inline-block' }} />
                Available
              </span>
            </div>
          </div>
        </div>

        {/* ── Right panel: selected date ── */}
        <div>
          {selected ? (
            <div className="mm-section">
              <div className="mm-section-head">
                <div>
                  <div className="mm-section-title">
                    {new Date(selected + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--mm-t3)', marginTop: 2 }}>
                    {selectedBlocks.length === 0 ? 'Available' : `${selectedBlocks.length} block(s)`}
                  </div>
                </div>
              </div>
              <div className="mm-section-body">
                {/* Existing blocks for this date */}
                {selectedBlocks.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mm-t3)', marginBottom: 8 }}>
                      Current blocks
                    </div>
                    {selectedBlocks.map(b => (
                      <div key={b._id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px', borderRadius: 9,
                        background: 'var(--mm-red-t)', marginBottom: 6,
                        border: '1px solid rgba(166,48,59,.15)',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mm-red)' }}>
                            {slotLabel(b.slot)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--mm-t3)' }}>
                            {REASON_LABELS[b.reason] || b.reason}
                          </div>
                        </div>
                        <button
                          className="mm-btn mm-btn-ghost mm-btn-sm"
                          style={{ fontSize: 11, color: 'var(--mm-red)', padding: '5px 10px' }}
                          onClick={() => handleRemoveBlock(b._id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="mm-divider" />
                  </div>
                )}

                {/* Add new block */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mm-t3)', marginBottom: 10 }}>
                    Block this date
                  </div>

                  <div className="mm-form-group">
                    <label className="mm-label">Session</label>
                    <select className="mm-input mm-select" value={blockSlotVal} onChange={e => setBlockSlotVal(e.target.value)}>
                      {slotOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>

                  <div className="mm-form-group" style={{ marginBottom: 0 }}>
                    <label className="mm-label">Reason</label>
                    <select className="mm-input mm-select" value={blockReasonVal} onChange={e => setBlockReasonVal(e.target.value)}>
                      <option value="personal">Personal / closed</option>
                      <option value="maintenance">Maintenance / cleaning</option>
                    </select>
                  </div>

                  <button
                    className="mm-btn mm-btn-danger"
                    style={{ width: '100%', marginTop: 14 }}
                    onClick={handleAddBlock}
                    disabled={blocking}
                  >
                    {blocking ? <span className="mm-spin" /> : null}
                    Block date
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mm-empty" style={{ padding: '32px 20px' }}>
              <div className="mm-empty-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={24} height={24} style={{color:'var(--mm-t3)'}}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              </div>
              <div className="mm-empty-title">Pick a date</div>
              <div className="mm-empty-sub">Click any date to block it or view existing blocks.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
