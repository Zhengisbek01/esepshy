import { RES, RK, CUR, ORGS, USERS, OSI_RATE } from './constants.js';
import { normQty, lineCalc } from '../lib/engine.js';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Айдос', 'Айгуль', 'Бахыт', 'Динара', 'Ерлан', 'Жанна', 'Кайрат', 'Лаура', 'Мурат', 'Назира', 'Олжас', 'Раушан', 'Серик', 'Томирис', 'Улан', 'Фатима', 'Галина', 'Игорь', 'Елена', 'Сергей', 'Асхат', 'Камила', 'Нурлан', 'Әсел'];
const LAST = ['Абдрахманов', 'Байжанов', 'Ахметов', 'Сулейменов', 'Касымов', 'Жумабаев', 'Омаров', 'Нургалиев', 'Исаев', 'Ким', 'Петров', 'Ибраев', 'Садыков', 'Тулегенов', 'Есенов', 'Мусин'];
const FEM = new Set(['Айгуль', 'Динара', 'Жанна', 'Лаура', 'Назира', 'Раушан', 'Томирис', 'Фатима', 'Галина', 'Елена', 'Камила', 'Әсел']);

export function generate(seed = 20261011) {
  const R = mulberry32(seed);
  const rnd = (a, b) => a + R() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const r2 = (x) => Math.round(x * 100) / 100;

  const tariffs = {};
  for (const r of RK) tariffs[r] = [{ value: RES[r].tariff, from: '2025-10', order: `Приказ № ${ri(10, 90)}-ОД от 01.09.2025 (демо)`, at: '2025-09-01T09:00:00.000Z', by: 'система' }];

  const buildings = [];
  const accounts = [];
  let seq = 200140;
  const base = { el: (a) => 60 + a.occ * 38, heat: (a) => a.area * 0.017, water: (a) => a.occ * 3.1, gas: (a) => 8 + a.occ * 7 };

  for (let b = 0; b < 12; b++) {
    const hasGas = b % 3 !== 0;
    const bld = { id: b, name: `мкр Самал-2, д. ${b + 1}`, short: `Дом ${b + 1}`, hasGas, osi: b < 6 ? 'osi1' : 'osi2', tech: {}, leak: {}, floors: ri(5, 12), year: ri(1978, 2012) };
    const n = ri(38, 58);
    for (let i = 0; i < n; i++) {
      seq += ri(1, 3);
      const fn = FIRST[Math.floor(R() * FIRST.length)];
      let ln = LAST[Math.floor(R() * LAST.length)];
      if (FEM.has(fn) && !ln.endsWith('Ким')) ln = ln.endsWith('ов') || ln.endsWith('ев') || ln.endsWith('ин') ? `${ln}а` : ln;
      const a = {
        id: String(seq), bld: b, apt: i + 1, occ: ri(1, 5), area: ri(36, 98),
        owner: `${ln} ${fn}`, iin: String(ri(60, 99)) + String(ri(1, 12)).padStart(2, '0') + String(ri(1, 28)).padStart(2, '0') + String(ri(100000, 999999)),
        phone: `+7 70${ri(0, 8)} ${ri(100, 999)} ${ri(10, 99)} ${ri(10, 99)}`,
        has: { el: true, heat: true, water: true, gas: hasGas }, smart: {}, cons: {}, meterIdx: {},
      };
      a.registryArea = a.area;
      a.smart = { el: R() < 0.6, heat: R() < 0.45, water: R() < 0.55, gas: hasGas && R() < 0.42 };
      for (const r of RK) {
        if (!a.has[r]) continue;
        a.cons[r] = RES[r].season.map((s) => r2(Math.max(0, base[r](a) * s * (1 + 0.11 * gauss()))));
      }
      bld.n = n;
      accounts.push(a);
    }
    for (const r of RK) {
      bld.tech[r] = r2(rnd(0.022, 0.055) * 1000) / 1000;
      const has = r !== 'gas' || hasGas;
      bld.leak[r] = has && R() < 0.4 ? { pct: r2(rnd(0.07, 0.19) * 1000) / 1000, start: R() < 0.8 ? 0 : ri(9, 10), resolved: false } : null;
    }
    buildings.push(bld);
  }

  // owners with two apartments share an IIN
  for (let k = 0; k < 14; k++) {
    const a = accounts[k * 7], b2 = accounts[accounts.length - 1 - k * 9];
    b2.iin = a.iin; b2.owner = a.owner; b2.phone = a.phone;
  }

  const pick = (f) => { const c = accounts.filter(f); return c[Math.floor(R() * c.length)]; };
  // apartment-level events in the current month
  const used = new Set();
  for (let k = 0; k < 7; k++) {
    const r = k % 2 ? 'water' : 'el';
    const a = pick((x) => x.smart[r] && !used.has(x.id)); used.add(a.id);
    a.cons[r][CUR] = r2(a.cons[r][CUR] * rnd(2.7, 4.2));
  }
  for (let k = 0; k < 4; k++) {
    const a = pick((x) => x.smart.el && x.occ >= 2 && !used.has(x.id)); used.add(a.id);
    a.cons.el[CUR] = r2(rnd(0, 0.6)); a.cons.el[CUR - 1] = r2(rnd(0, 0.8));
  }

  // meter indexes for smart meters
  for (const a of accounts) {
    for (const r of RK) {
      if (!a.smart[r]) continue;
      const start = ri(800, 9000) * (r === 'heat' ? 0.01 : 1);
      const prev = r2(start + a.cons[r].slice(0, CUR).reduce((x, y) => x + y, 0));
      a.meterIdx[r] = { prev, cur: r2(prev + a.cons[r][CUR]) };
    }
  }

  // payment history and arrears (months 0..10)
  const billTotal = (a, m) => RK.reduce((s, r) => { const l = lineCalc(a, r, m, RES[r].tariff); return s + (l ? l.sum : 0); }, 0) + a.area * OSI_RATE;
  for (const a of accounts) {
    const u = R();
    a.overdue = u < 0.7 ? 0 : u < 0.85 ? 1 : u < 0.93 ? ri(2, 3) : ri(4, 9);
    a.onlineP = Math.min(0.92, 0.18 + R() * 0.6);
    a.late = a.overdue ? ri(1, 6) : R() < 0.25 ? ri(1, 3) : 0;
    a.pay = Array.from({ length: CUR + 1 }, (_, m) => {
      if (m === CUR) return 'none';
      if (m > CUR - 1 - a.overdue) return 'none';
      return R() < Math.min(0.95, a.onlineP + m * 0.012) ? 'online' : 'kassa';
    });
    a.debt = 0;
    for (let m = CUR - a.overdue; m <= CUR - 1; m++) a.debt += billTotal(a, m);
    a.debt = Math.round(a.debt);
    a.paidCur = 0;
  }

  // current-period charges as uploaded by suppliers
  const charges = {};
  for (const a of accounts) {
    const lines = {};
    for (const r of RK) {
      if (!a.has[r]) continue;
      const qty = a.smart[r] ? a.cons[r][CUR] : r2(normQty(a, r, CUR));
      lines[r] = { qty, tariff: RES[r].tariff, sum: r2(qty * RES[r].tariff), basis: a.smart[r] ? 'meter' : 'norm' };
    }
    charges[a.id] = { lines, extra: [] };
  }

  const injected = new Set(used);
  const pickI = (f) => { const a = pick((x) => f(x) && !injected.has(x.id)); injected.add(a.id); return a; };
  for (let k = 0; k < 5; k++) {
    const a = pickI((x) => x.smart.water);
    const q = r2(normQty(a, 'water', CUR));
    charges[a.id].lines.water = { qty: q, tariff: RES.water.tariff, sum: r2(q * RES.water.tariff), basis: 'norm' };
  }
  for (let k = 0; k < 3; k++) {
    const a = pickI(() => true);
    const l = charges[a.id].lines.el; l.tariff = 27.9; l.sum = r2(l.qty * 27.9);
  }
  for (let k = 0; k < 3; k++) {
    const a = pickI(() => true);
    charges[a.id].extra.push({ name: 'Прочие услуги: водоотведение', org: a.bld < 6 ? 'osi1' : 'osi2', sum: r2(a.cons.water[CUR] * 58) });
  }
  for (let k = 0; k < 2; k++) {
    const a = pickI((x) => x.smart.gas);
    a.meterIdx.gas.cur = r2(a.meterIdx.gas.prev - ri(18, 60));
  }
  const unallocated = [];
  for (let k = 0; k < 3; k++) {
    const a = pickI((x) => x.overdue === 0);
    const amt = Math.round(billTotal(a, CUR - 1));
    a.pay[CUR - 1] = 'none'; a.overdue = 1; a.debt = amt;
    unallocated.push({ id: `pay-${k + 1}`, amount: amt, date: '2026-09-14', bank: 'Банк-агент (демо)', purpose: `Оплата ЖКУ, ЛС ${a.id}`, acc: a.id, status: 'pending' });
  }
  for (let k = 0; k < 2; k++) {
    const a = pickI(() => true);
    a.registryArea = a.area - ri(4, 11);
  }

  const now = '2026-10-11T08:00:00.000Z';
  const uploads = RK.map((r) => {
    const cnt = accounts.filter((a) => a.has[r]).length;
    return { id: `up-${r}`, org: RES[r].org, res: r, period: '2026-09', file: `${r}_2026-09.xlsx`, at: '2026-10-05T10:00:00.000Z', by: USERS.find((u) => u.org === RES[r].org && u.role === 'supplier').name, total: cnt, accepted: cnt, rejected: 0, notFound: 0, errors: [] };
  });

  return {
    version: 3,
    seed,
    period: { cur: CUR, status: 'checking', releasedAt: null },
    buildings, accounts, charges, unallocated, tariffs,
    osiRates: { osi1: { rate: OSI_RATE, next: null }, osi2: { rate: OSI_RATE, next: null } },
    odpu: {},
    decisions: {}, corrections: [],
    anomalyState: {}, visits: [], requests: [],
    complaints: [], readings: {}, payments: [],
    debtActions: [], installments: {},
    uploads,
    templates: [
      { id: 'reminder', name: 'Напоминание о долге', text: 'Здравствуйте, {ФИО}! По лицевому счёту {ЛС} ({адрес}) задолженность {сумма}. Оплатить можно онлайн в Esepshy или в банке. Если уже оплатили, не обращайте внимания.' },
      { id: 'installment', name: 'Предложение рассрочки', text: '{ФИО}, по ЛС {ЛС} долг {сумма}. Можем оформить рассрочку на 3 или 6 месяцев без пени. Ответьте на это сообщение или позвоните в ЕРЦ.' },
      { id: 'osi', name: 'Напоминание от ОСИ', text: 'Уважаемый собственник кв. {кв}! Просим погасить задолженность {сумма} по ЛС {ЛС}. Совет дома.' },
    ],
    meterTypes: [
      { id: 'el-smart', res: 'el', name: 'Электросчётчик с дистанционной передачей', interval: '16 лет' },
      { id: 'water-smart', res: 'water', name: 'Счётчик воды с радиомодулем', interval: '6 лет' },
      { id: 'heat-smart', res: 'heat', name: 'Квартирный теплосчётчик', interval: '4 года' },
      { id: 'gas-smart', res: 'gas', name: 'Газовый счётчик с телеметрией', interval: '8 лет' },
    ],
    integrations: [
      { id: 'bank', name: 'Банк-агент: приём платежей', mode: 'API', status: 'ok', last: now, errors: 0 },
      { id: 'egov', name: 'eGov: вход жителей', mode: 'тестовый режим', status: 'test', last: now, errors: 0 },
      { id: 'el', name: 'ЭнергоСбыт: начисления', mode: 'API', status: 'ok', last: '2026-10-05T10:00:00.000Z', errors: 0 },
      { id: 'water', name: 'Водоканал: начисления', mode: 'файл Excel', status: 'ok', last: '2026-10-05T10:00:00.000Z', errors: 0 },
      { id: 'heat', name: 'Теплосети: начисления', mode: 'файл Excel', status: 'ok', last: '2026-10-05T10:00:00.000Z', errors: 0 },
      { id: 'gas', name: 'ГазСервис: начисления', mode: 'файл CSV', status: 'ok', last: '2026-10-05T10:00:00.000Z', errors: 0 },
      { id: 'sms', name: 'Шлюз WhatsApp/SMS', mode: 'API', status: 'ok', last: now, errors: 0 },
    ],
    orgs: ORGS.map((o) => ({ ...o })),
    users: USERS.map((u) => ({ ...u, active: true })),
    messages: [],
    audit: [
      { id: 'a-0', at: '2026-10-05T10:00:00.000Z', user: 'система', role: 'system', action: 'Загрузка начислений', object: 'Период 2026-09', details: 'Начисления 4 поставщиков приняты' },
      { id: 'a-1', at: '2026-10-05T10:05:00.000Z', user: 'система', role: 'system', action: 'ИИ-сверка', object: 'Период 2026-09', details: 'Сверка запущена автоматически' },
    ],
  };
}
