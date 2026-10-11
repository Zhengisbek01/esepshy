import { RES, RK, CUR, MONTH_KEYS, OSI_RATE, HEAT_NORM_M2, ISSUE_TYPES } from '../data/constants.js';
import { hash, sum, f0, f1, pct } from './format.js';

const r2 = (x) => Math.round(x * 100) / 100;

/* ---------- billing ---------- */
export function normQty(a, r, m) {
  const s = RES[r].season[m];
  if (r === 'el') return (70 + a.occ * 42) * s;
  if (r === 'water') return a.occ * 4.2 * s;
  if (r === 'gas') return (12 + a.occ * 10) * s;
  return a.area * HEAT_NORM_M2 * s;
}
export function lineCalc(a, r, m, tariff) {
  if (!a.has[r]) return null;
  const qty = a.smart[r] ? a.cons[r][m] : r2(normQty(a, r, m));
  return { qty, tariff, sum: r2(qty * tariff), basis: a.smart[r] ? 'meter' : 'norm' };
}
export function approvedTariff(s, r, m = CUR) {
  const key = MONTH_KEYS[m] || '2099-12';
  const list = s.tariffs[r].filter((t) => t.from <= key);
  return (list[list.length - 1] || s.tariffs[r][0]).value;
}
export function lineFor(s, a, r, m) {
  if (!a.has[r]) return null;
  if (m === CUR) return s.charges[a.id].lines[r] || null;
  return lineCalc(a, r, m, approvedTariff(s, r, m));
}
export function osiRate(s, a) { return s.osiRates[s.buildings[a.bld].osi]?.rate ?? OSI_RATE; }
export function billFor(s, a, m) {
  const lines = RK.filter((r) => a.has[r]).map((r) => ({ res: r, ...lineFor(s, a, r, m) }));
  const rate = osiRate(s, a);
  const osi = { rate, area: a.area, sum: r2(a.area * rate) };
  const extra = m === CUR ? s.charges[a.id].extra : [];
  const total = r2(sum(lines.map((l) => l.sum || 0)) + osi.sum + sum(extra.map((e) => e.sum)));
  return { m, lines, osi, extra, total, vat: r2((total * 12) / 112) };
}
export const billedPeriod = (s) => (s.period.status === 'released' ? CUR : CUR - 1);
export function toPay(s, a) {
  if (s.period.status !== 'released') return Math.max(0, a.debt);
  return Math.max(0, Math.round(a.debt + billFor(s, a, CUR).total - a.paidCur));
}
export const addr = (s, a) => `${s.buildings[a.bld].name}, кв. ${a.apt}`;

/* ---------- caching ---------- */
const caches = new WeakMap();
function cached(s, key, fn) {
  let c = caches.get(s);
  if (!c) { c = {}; caches.set(s, c); }
  if (!(key in c)) c[key] = fn();
  return c[key];
}
export function invalidate(s) { caches.delete(s); }
export function byBld(s) {
  return cached(s, 'byBld', () => { const m = s.buildings.map(() => []); s.accounts.forEach((a) => m[a.bld].push(a)); return m; });
}
export function accIndex(s) { return cached(s, 'accIndex', () => new Map(s.accounts.map((a) => [a.id, a]))); }

/* ---------- metering and losses ---------- */
export function activeMonths(r) { return MONTH_KEYS.map((_, m) => m).filter((m) => RES[r].season[m] > 0); }
export function windows(r) { const am = activeMonths(r); return { base: am.slice(0, 3), cur: am.slice(-3) }; }
export function metered(s, b, r, m) { return sum(byBld(s)[b.id].map((a) => (a.cons[r] ? a.cons[r][m] : 0))); }
export function input(s, b, r, m) {
  if (m === CUR && s.odpu[b.id] && s.odpu[b.id][r] != null) return s.odpu[b.id][r];
  const met = metered(s, b, r, m);
  if (!met) return 0;
  const L = b.leak[r];
  const leakOn = L && m >= L.start && !(L.resolved && windows(r).cur.includes(m));
  return met * (1 + b.tech[r] + (leakOn ? L.pct : 0));
}
export function lossOver(s, r, ms, blds = s.buildings) {
  let inp = 0, met = 0;
  for (const b of blds) {
    if (r === 'gas' && !b.hasGas) continue;
    for (const m of ms) { inp += input(s, b, r, m); met += metered(s, b, r, m); }
  }
  return inp ? (inp - met) / inp : 0;
}
export function resStats(s, r) {
  return cached(s, `res-${r}`, () => {
    const w = windows(r);
    const baseL = lossOver(s, r, w.base), curL = lossOver(s, r, w.cur);
    const acc = s.accounts.filter((a) => a.has[r]);
    const smart = acc.filter((a) => a.smart[r]).length / acc.length;
    const blds = s.buildings.filter((b) => r !== 'gas' || b.hasGas);
    const lossMoney = (sum(blds.map((b) => sum(w.cur.map((m) => input(s, b, r, m) - metered(s, b, r, m))))) / 3) * RES[r].tariff;
    return { baseL, curL, red: baseL ? (baseL - curL) / baseL : 0, smart, w, lossMoney };
  });
}
export function bldStats(s, b) {
  return cached(s, `bld-${b.id}`, () => {
    const accs = byBld(s)[b.id];
    const res = {};
    for (const r of RK) {
      if (r === 'gas' && !b.hasGas) continue;
      const w = windows(r);
      res[r] = {
        loss: lossOver(s, r, w.cur, [b]),
        input: sum(w.cur.map((m) => input(s, b, r, m))) / 3,
        met: sum(w.cur.map((m) => metered(s, b, r, m))) / 3,
        smart: accs.filter((a) => a.smart[r]).length / accs.length,
      };
    }
    const paid = accs.filter((a) => a.pay[CUR - 1] !== 'none').length / accs.length;
    const debt = sum(accs.map((a) => a.debt));
    const debtors = accs.filter((a) => a.debt > 0).length;
    return { res, paid, debt, debtors, n: accs.length };
  });
}

/* ---------- anomalies ---------- */
export function anomalies(s) {
  return cached(s, 'anomalies', () => {
    const found = [];
    for (const b of s.buildings) for (const r of RK) {
      if (r === 'gas' && !b.hasGas) continue;
      const w = windows(r);
      const L = lossOver(s, r, w.cur, [b]);
      if (L > RES[r].thr) {
        const vol = sum(w.cur.map((m) => input(s, b, r, m) - metered(s, b, r, m) * (1 + b.tech[r]))) / w.cur.length;
        found.push({ key: `bal:${b.id}:${r}`, kind: 'balance', res: r, bld: b.id, acc: null,
          text: `Потери ${pct(L)} при технологической норме до ${pct(b.tech[r])}. Возможна утечка на вводе или несанкционированный отбор.`, dmg: Math.max(0, vol * RES[r].tariff) });
      }
    }
    for (const a of s.accounts) for (const r of ['el', 'water']) {
      if (!a.smart[r]) continue;
      const hist = a.cons[r].slice(CUR - 6, CUR), mean = sum(hist) / 6;
      const sd = Math.sqrt(sum(hist.map((x) => (x - mean) ** 2)) / 6) || 1;
      const x = a.cons[r][CUR];
      if ((x - mean) / sd > 3 && x > 1.8 * mean) found.push({ key: `spike:${a.id}:${r}`, kind: 'spike', res: r, bld: a.bld, acc: a.id,
        text: r === 'water' ? `Расход ${f1(x)} м³ при среднем ${f1(mean)} м³. Вероятна утечка в квартире.` : `Потребление ${f0(x)} кВт·ч при среднем ${f0(mean)} кВт·ч. Проверить оборудование или счётчик.`,
        dmg: (x - mean) * RES[r].tariff });
    }
    for (const a of s.accounts) {
      if (!a.smart.el || a.occ < 2) continue;
      if (a.cons.el[CUR] < 1 && a.cons.el[CUR - 1] < 1) {
        const exp = sum(a.cons.el.slice(CUR - 8, CUR - 2)) / 6;
        found.push({ key: `zero:${a.id}:el`, kind: 'zero', res: 'el', bld: a.bld, acc: a.id, text: `Нулевое потребление 2 месяца при ${a.occ} проживающих. Признак обхода счётчика.`, dmg: exp * RES.el.tariff });
      }
    }
    const keys = new Set(found.map((x) => x.key));
    const list = found.map((x) => ({ ...x, ...(s.anomalyState[x.key] || { status: 'open' }) }));
    for (const [k, st] of Object.entries(s.anomalyState)) if (!keys.has(k) && st.snap) list.push({ ...st.snap, ...st, key: k });
    return list;
  });
}
export const openAnomalies = (s) => anomalies(s).filter((x) => x.status !== 'closed');

/* ---------- AI reconciliation ---------- */
const CONF = { norm: [0.9, 0.98], tariff: [0.93, 0.99], dup: [0.86, 0.95], rev: [0.55, 0.9], pay: [0.88, 0.97], area: [0.6, 0.9] };
export function issueOrg(s, type, a, res) {
  if (type === 'dup') return s.buildings[a.bld].osi;
  if (type === 'pay') return 'erc';
  if (type === 'area') return 'heat';
  return RES[res].org;
}
export function issues(s) {
  return cached(s, 'issues', () => {
    const found = [];
    const add = (type, a, res, text, amount) => {
      const key = `${type}:${a.id}:${res || ''}`;
      const [lo, hi] = CONF[type];
      found.push({ key, type, acc: a.id, res, org: issueOrg(s, type, a, res), text, amount: Math.round(Math.abs(amount)), conf: lo + hash(key) * (hi - lo) });
    };
    const idx = accIndex(s);
    for (const a of s.accounts) {
      const ch = s.charges[a.id];
      for (const r of RK) {
        const l = ch.lines[r];
        if (!l) continue;
        if (a.smart[r] && l.basis === 'norm' && Math.abs(l.qty - a.cons[r][CUR]) > 0.05) {
          add('norm', a, r, `Есть умный счётчик (${RES[r].short.toLowerCase()}), показания за сентябрь ${f1(a.cons[r][CUR])} ${RES[r].unit}. Начислено по нормативу ${f1(l.qty)} ${RES[r].unit} на ${a.occ} чел.`, (l.qty - a.cons[r][CUR]) * l.tariff);
        }
        const ap = approvedTariff(s, r, CUR);
        if (Math.abs(l.tariff - ap) > 0.001) add('tariff', a, r, `Применён тариф ${f1(l.tariff)} ₸ вместо утверждённого ${f1(ap)} ₸ за ${RES[r].unit}, объём ${f1(l.qty)}.`, (l.tariff - ap) * l.qty);
        const mi = a.meterIdx[r];
        if (mi && mi.cur < mi.prev) add('rev', a, r, `Показание ${f0(mi.cur)} меньше предыдущего ${f0(mi.prev)} ${RES[r].unit}. Вероятна ошибка ввода, начисление нужно приостановить.`, l.sum);
      }
      for (const e of ch.extra) {
        if (/водоотвед/i.test(e.name) && ch.lines.water) add('dup', a, 'water', `Водоотведение выставлено Водоканалом и повторно ОСИ в строке «${e.name}».`, e.sum);
      }
      if (a.area !== a.registryArea) {
        const d = a.area - a.registryArea;
        add('area', a, 'heat', `Площадь в ЛС ${a.area} м², в реестре недвижимости ${a.registryArea} м². Отопление и взносы ОСИ начислены на лишние ${d} м².`, d * (osiRate(s, a) + HEAT_NORM_M2 * approvedTariff(s, 'heat') * 0.35));
      }
    }
    for (const p of s.unallocated) {
      if (p.status !== 'pending') continue;
      const a = idx.get(p.acc);
      if (a) add('pay', a, null, `Платёж ${f0(p.amount)} ₸ от ${p.date.split('-').reverse().join('.')} (${p.bank}) поступил на транзитный счёт, но не разнесён на ЛС. Долг завышен.`, p.amount);
    }
    const keys = new Set(found.map((x) => x.key));
    const list = found.map((x) => {
      const d = s.decisions[x.key];
      return d ? { ...x, status: d.status, decidedBy: d.by, decidedAt: d.at, reason: d.reason } : { ...x, status: 'open' };
    });
    for (const [k, d] of Object.entries(s.decisions)) if (!keys.has(k)) list.push({ ...d.snap, key: k, status: d.status, decidedBy: d.by, decidedAt: d.at, reason: d.reason });
    return list.sort((x, y) => (x.status === 'open' ? 0 : 1) - (y.status === 'open' ? 0 : 1) || y.conf - x.conf || y.amount - x.amount);
  });
}
export const openIssues = (s) => issues(s).filter((i) => i.status === 'open');
export const errPer1000 = (s) => (openIssues(s).length / s.accounts.length) * 1000;
export const issueLabel = (t) => ISSUE_TYPES[t]?.label || t;

/* fixes: mutate draft state, return data to undo */
export function applyFix(s, it) {
  const a = s.accounts.find((x) => x.id === it.acc);
  const ch = s.charges[a.id];
  if (it.type === 'norm') { const before = { ...ch.lines[it.res] }; const q = a.cons[it.res][CUR]; ch.lines[it.res] = { ...before, qty: q, basis: 'meter', sum: r2(q * before.tariff) }; return { before }; }
  if (it.type === 'tariff') { const before = { ...ch.lines[it.res] }; const t = approvedTariff(s, it.res); ch.lines[it.res] = { ...before, tariff: t, sum: r2(before.qty * t) }; return { before }; }
  if (it.type === 'dup') { const i = ch.extra.findIndex((e) => /водоотвед/i.test(e.name)); const before = ch.extra[i]; ch.extra.splice(i, 1); return { before }; }
  if (it.type === 'rev') { const mi = a.meterIdx[it.res]; const before = mi.cur; mi.cur = r2(mi.prev + a.cons[it.res][CUR]); return { before }; }
  if (it.type === 'area') { const before = a.area; a.area = a.registryArea; return { before }; }
  if (it.type === 'pay') {
    const p = s.unallocated.find((x) => x.acc === a.id && x.status === 'pending');
    const before = { debt: a.debt, overdue: a.overdue, pay: a.pay[CUR - 1] };
    p.status = 'allocated'; a.debt = Math.max(0, a.debt - p.amount); a.overdue = Math.max(0, a.overdue - 1); a.pay[CUR - 1] = 'bank';
    return { before, payId: p.id };
  }
  return {};
}
export function undoFix(s, d) {
  const a = s.accounts.find((x) => x.id === d.snap.acc);
  const ch = s.charges[a.id];
  const u = d.undo || {};
  if (d.snap.type === 'norm' || d.snap.type === 'tariff') ch.lines[d.snap.res] = u.before;
  if (d.snap.type === 'dup') ch.extra.push(u.before);
  if (d.snap.type === 'rev') a.meterIdx[d.snap.res].cur = u.before;
  if (d.snap.type === 'area') a.area = u.before;
  if (d.snap.type === 'pay') { const p = s.unallocated.find((x) => x.id === u.payId); p.status = 'pending'; Object.assign(a, { debt: u.before.debt, overdue: u.before.overdue }); a.pay[CUR - 1] = u.before.pay; }
}

/* ---------- debt model ---------- */
export function score(a) {
  if (a.debt <= 0) return 0;
  const z = -2.7 + 0.82 * a.overdue + 0.38 * a.late - 1.3 * a.onlineP + Math.min(a.debt / 120000, 2) * 0.7;
  return Math.round(100 / (1 + Math.exp(-z)));
}
export const segment = (sc) => (sc >= 60 ? 'high' : sc >= 30 ? 'mid' : 'low');

/* ---------- KPI ---------- */
export function onlineShare(s, ms) {
  let on = 0, all = 0;
  for (const a of s.accounts) for (const m of ms) { const p = a.pay[m]; if (p === 'none') continue; all++; if (p === 'online') on++; }
  return all ? on / all : 0;
}
export function kpis(s) {
  return cached(s, 'kpis', () => {
    const online = onlineShare(s, [CUR - 1, CUR]);
    const res = {};
    for (const r of RK) res[r] = resStats(s, r);
    return {
      online, onlineBase: onlineShare(s, [0]),
      onlineTrend: MONTH_KEYS.map((_, m) => (m === CUR ? online : onlineShare(s, [m]))),
      err: errPer1000(s), openIssues: openIssues(s).length, res,
      billed: sum(s.accounts.map((a) => billFor(s, a, CUR).total)),
      debt: sum(s.accounts.map((a) => a.debt)),
      debtors: s.accounts.filter((a) => a.debt > 0).length,
    };
  });
}
export const KPI_TARGETS = [
  { id: 'online', name: 'Платежи онлайн', goal: '≥ 70%', ok: (k) => k.online >= 0.7, val: (k) => pct(k.online), base: (k) => pct(k.onlineBase) },
  { id: 'err', name: 'Ошибки на 1 000 счетов', goal: '≤ 5', ok: (k) => k.err <= 5, val: (k) => f1(k.err), base: () => '31,1' },
  ...RK.map((r) => ({ id: `smart-${r}`, name: `Умные счётчики: ${RES[r].short.toLowerCase()}`, goal: `${f0(RES[r].smartT * 100)}%`, ok: (k) => k.res[r].smart >= RES[r].smartT, val: (k) => pct(k.res[r].smart), base: (k) => pct(k.res[r].smart) })),
  ...RK.map((r) => ({ id: `loss-${r}`, name: `Потери: ${RES[r].short.toLowerCase()}`, goal: `−${f0(RES[r].lossT * 100)}%`, ok: (k) => k.res[r].red >= RES[r].lossT, val: (k) => pct(k.res[r].curL), base: (k) => pct(k.res[r].baseL) })),
];
