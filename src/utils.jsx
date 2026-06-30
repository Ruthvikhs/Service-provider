import { useState, useCallback, useEffect } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const show = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  const Toast = toast ? (
    <div className={`mm-toast ${toast.type}`}>
      {toast.type === 'success' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16,color:'#2B7A3B',flexShrink:0}}>
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      )}
      {toast.type === 'error' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16,color:'#A6303B',flexShrink:0}}>
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
        </svg>
      )}
      {toast.message}
    </div>
  ) : null;

  return { show, Toast };
}

export function decodeJWT(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

export function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function fmtINR(n) {
  if (!n && n !== 0) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
}

export function slotLabel(s) {
  return { full_day: 'Full Day', morning: 'Morning', evening: 'Evening' }[s] || s;
}

export function serviceLabel(type) {
  return {
    party_hall:    'Party Hall',
    marriage_hall: 'Marriage Hall',
    catering:      'Catering',
    decoration:    'Decoration',
  }[type] || type;
}

export function pricingUnitFor(type) {
  if (type === 'catering')   return 'per_plate';
  if (type === 'decoration') return 'per_event';
  return 'per_day';
}

export function pricingUnitLabel(unit) {
  return {
    per_day:   'per day',
    per_event: 'per event',
    per_plate: 'per plate',
    per_hour:  'per hour',
  }[unit] || unit;
}
