const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const f0 = (v) => nf0.format(Math.round(v || 0));
export const f1 = (v) => nf1.format(v || 0);
export const f2 = (v) => nf2.format(v || 0);
export const money = (v) => `${f0(v)} ₸`;
export const pct = (v) => `${f1((v || 0) * 100)}%`;
export const signedPct = (v) => `${v > 0 ? '−' : '+'}${f1(Math.abs(v) * 100)}%`;
export const dt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const sum = (a) => a.reduce((x, y) => x + y, 0);
export const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
export const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
