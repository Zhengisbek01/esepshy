import React, { useEffect, useState } from 'react';
import { RES } from './data/constants.js';
import { f0, f1 } from './lib/format.js';

export const Page = ({ title, lead, actions, children }) => (
  <section className="page">
    <div className="page-head">
      <div><h1>{title}</h1>{lead && <p>{lead}</p>}</div>
      {actions && <div className="btns">{actions}</div>}
    </div>
    {children}
  </section>
);
export const Card = ({ title, aside, children, className = '' }) => (
  <div className={`card ${className}`}>
    {(title || aside) && <div className="card-h">{title && <h3>{title}</h3>}{aside && <div className="card-aside">{aside}</div>}</div>}
    {children}
  </div>
);
export const Grid = ({ min = 280, children, gap }) => <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap }}>{children}</div>;
export const Pill = ({ kind = 'neutral', children }) => <span className={`pill ${kind}`}>{children}</span>;
export const Tag = ({ children, tone }) => <span className={`tag ${tone || ''}`}>{children}</span>;
export const Btn = ({ kind, small, children, ...p }) => <button type="button" className={`btn ${kind || ''} ${small ? 'sm' : ''}`} {...p}>{children}</button>;
export const Dot = ({ res }) => <i className="dot" style={{ background: RES[res]?.color || 'var(--muted)' }} aria-hidden="true" />;
export const ResName = ({ res }) => <span className="resname"><Dot res={res} />{RES[res].short}</span>;

export const Stats = ({ items }) => (
  <div className="stats">{items.map((it, i) => (
    <div key={i}><span className="v" style={it.color ? { color: it.color } : undefined}>{it.v}</span><span className="l">{it.l}</span></div>
  ))}</div>
);

export function Kpi({ title, value, unit, progress, target, ok, foot, right, status }) {
  return (
    <div className="kpi">
      <div className="kpi-top"><span className="eyebrow">{title}</span>{status !== false && ok != null && <Pill kind={ok ? 'ok' : 'warn'}>{ok ? 'в цели' : 'ниже цели'}</Pill>}</div>
      <div className="kpi-val">{value}{unit && <small>{unit}</small>}</div>
      {progress != null && <div className="meter"><i style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} />{target != null && <b style={{ left: `${target * 100}%` }} />}</div>}
      {(foot || right) && <div className="kpi-foot"><span>{foot}</span><span>{right}</span></div>}
    </div>
  );
}

export function Table({ cols, rows, empty = 'Нет записей', onRow, rowClass, keyOf }) {
  return (
    <div className="tbl">
      <table>
        <thead><tr>{cols.map((c, i) => <th key={i} className={c.num ? 'n' : ''} style={c.w ? { width: c.w } : undefined}>{c.h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className="muted empty">{empty}</td></tr>}
          {rows.map((r, i) => (
            <tr key={keyOf ? keyOf(r) : i} className={`${onRow ? 'click' : ''} ${rowClass ? rowClass(r) : ''}`} onClick={onRow ? () => onRow(r) : undefined}>
              {cols.map((c, j) => <td key={j} className={c.num ? 'n' : ''}>{c.r(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Chips({ items, value, onChange }) {
  return (
    <div className="chips">{items.map(([k, l, c]) => (
      <button key={k} type="button" className="chip" aria-pressed={value === k} onClick={() => onChange(k)}>{l}{c != null && <span className="c">{c}</span>}</button>
    ))}</div>
  );
}
export function Seg({ items, value, onChange }) {
  return (
    <div className="seg">{items.map(([k, l]) => (
      <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>
    ))}</div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h"><h3>{title}</h3><button type="button" className="x" onClick={onClose} aria-label="Закрыть">×</button></div>
        {children}
      </div>
    </div>
  );
}
export const Field = ({ label, hint, error, children }) => (
  <label className="field"><span className="field-l">{label}</span>{children}{hint && !error && <span className="field-h">{hint}</span>}{error && <span className="field-e">{error}</span>}</label>
);
export const Note = ({ children }) => <p className="note">{children}</p>;
export const Conf = ({ v }) => <span className="conf"><i style={{ '--w': `${v * 100}%` }} />{f0(v * 100)}%</span>;
export const Empty = ({ title, text, action }) => <div className="emptybox"><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>;

export function useLocal(key, init) {
  const [v, setV] = useState(() => { try { const x = localStorage.getItem(key); return x != null ? JSON.parse(x) : init; } catch (e) { return init; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } }, [key, v]);
  return [v, setV];
}

/* ---------- charts ---------- */
export function LineChart({ labels, series, target, yMax, yFmt = (v) => f0(v), h = 230 }) {
  const W = 640, H = h, L = 52, Rr = 16, T = 14, B = 28, iw = W - L - Rr, ih = H - T - B;
  const max = (yMax ?? Math.max(...series.flatMap((s) => s.values)) * 1.12) || 1;
  const x = (i) => L + (iw * i) / Math.max(1, labels.length - 1);
  const y = (v) => T + ih * (1 - v / max);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <g className="grid">{[0, 1, 2, 3, 4].map((k) => { const v = (max * k) / 4; return <g key={k}><line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{yFmt(v)}</text></g>; })}</g>
      {labels.map((l, i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{l}</text>)}
      {target != null && <g><line className="tgt" x1={L} x2={W - Rr} y1={y(target)} y2={y(target)} /><text x={W - Rr} y={y(target) - 6} textAnchor="end" className="tgt-l">цель {yFmt(target)}</text></g>}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => [x(i), y(v)]);
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
        const [lx, ly] = pts[pts.length - 1];
        return (
          <g key={si}>
            {s.area && <path d={`${d} L${x(pts.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={s.color} opacity="0.12" />}
            <path d={d} fill="none" stroke={s.color} strokeWidth={s.w || 2.4} strokeLinejoin="round" strokeDasharray={s.dash ? '5 4' : undefined} />
            {s.end && <g><circle cx={lx} cy={ly} r="4.5" fill={s.color} /><text x={lx - 8} y={ly - 10} textAnchor="end" className="strong">{s.end}</text></g>}
          </g>
        );
      })}
    </svg>
  );
}

export function PairBars({ groups, fmt = (v) => f1(v * 100) }) {
  const W = 640, H = 240, L = 46, Rr = 10, T = 22, B = 30, iw = W - L - Rr, ih = H - T - B;
  const max = Math.max(0.01, ...groups.flatMap((g) => [g.a, g.b])) * 1.2;
  const y = (v) => T + ih * (1 - v / max), gw = iw / groups.length, bw = Math.min(46, gw * 0.3);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <g className="grid">{[0, 1, 2, 3, 4].map((k) => { const v = (max * k) / 4; return <g key={k}><line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{fmt(v)}</text></g>; })}</g>
      {groups.map((g, i) => {
        const cx = L + gw * i + gw / 2;
        return (
          <g key={i}>
            <rect x={cx - bw - 3} y={y(g.a)} width={bw} height={y(0) - y(g.a)} rx="3" fill="var(--muted)" opacity=".35" />
            <rect x={cx + 3} y={y(g.b)} width={bw} height={y(0) - y(g.b)} rx="3" fill={g.color} />
            <text x={cx + 3 + bw / 2} y={y(g.b) - 6} textAnchor="middle" className="strong">{fmt(g.b)}</text>
            <text x={cx} y={H - 8} textAnchor="middle" className="lbl">{g.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Hist({ values, bins = 10, maxV = 100 }) {
  const counts = Array(bins).fill(0);
  values.forEach((v) => counts[Math.min(bins - 1, Math.floor((v / maxV) * bins))]++);
  const W = 640, H = 220, L = 36, Rr = 8, T = 18, B = 28, iw = W - L - Rr, ih = H - T - B;
  const max = Math.max(1, ...counts) * 1.15, y = (v) => T + ih * (1 - v / max), bw = iw / bins;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <g className="grid">{[0, 1, 2, 3].map((k) => { const v = (max * k) / 3; return <g key={k}><line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{f0(v)}</text></g>; })}</g>
      {counts.map((c, i) => {
        const col = i >= 6 ? 'var(--bad)' : i >= 3 ? 'var(--warn)' : 'var(--good)';
        return (
          <g key={i}>
            <rect x={L + i * bw + 3} y={y(c)} width={bw - 6} height={y(0) - y(c)} rx="3" fill={col} opacity=".85" />
            {c > 0 && <text x={L + i * bw + bw / 2} y={y(c) - 5} textAnchor="middle" className="strong">{c}</text>}
            <text x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle">{i * 10}–{i * 10 + 9}</text>
          </g>
        );
      })}
    </svg>
  );
}
