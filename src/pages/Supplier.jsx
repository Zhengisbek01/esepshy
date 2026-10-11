import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { RES, MONTH_KEYS, ISSUE_TYPES, ANOMALY_KINDS, VISIT_RESULTS } from '../data/constants.js';
import { approvedTariff, anomalies, addr, accIndex } from '../lib/engine.js';
import { f0, f1, f2, money, dt, uid } from '../lib/format.js';
import { exportXlsx, readTable, downloadBlob } from '../lib/files.js';
import { Page, Card, Btn, Pill, Table, Modal, Field, Note, Stats, Tag, Chips, Grid } from '../ui.jsx';
import { AnStatus, BalanceChart } from './Shared.jsx';

const useOrg = () => { const { state, user } = useStore(); return state.orgs.find((o) => o.id === user.org); };
const BASIS = { meter: 'счётчик', norm: 'норматив', reading: 'показания' };
const BASIS_IN = { 'счётчик': 'meter', 'норматив': 'norm', 'показания': 'reading', meter: 'meter', norm: 'norm', reading: 'reading' };

function pickCol(row, names) {
  const keys = Object.keys(row);
  for (const n of names) { const k = keys.find((x) => x.trim().toLowerCase() === n); if (k) return row[k]; }
  return undefined;
}
const num = (v) => (typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.')));

export function Uploads() {
  const { state, act, toast } = useStore();
  const org = useOrg();
  const r = org.res;
  const [report, setReport] = useState(null);
  const [drag, setDrag] = useState(false);
  const released = state.period.status === 'released';
  const mine = state.uploads.filter((u) => u.org === org.id);

  const template = () => {
    const rows = state.accounts.filter((a) => a.has[r]).map((a) => {
      const l = state.charges[a.id].lines[r];
      return { 'ЛС': a.id, 'Адрес': addr(state, a), 'Услуга': RES[r].name, 'Период': '2026-09', 'Объём': l.qty, 'Тариф': l.tariff, 'Сумма': l.sum, 'Основание': BASIS[l.basis] };
    });
    exportXlsx(`esepshy_${r}_2026-09.xlsx`, { 'Начисления': rows });
  };

  const handle = async (file) => {
    if (!file) return;
    if (released) { toast('Период сентябрь 2026 закрыт: квитанции уже выпущены', 'err'); return; }
    let rows;
    try { rows = await readTable(file); } catch (e) { toast('Не удалось прочитать файл. Нужен .xlsx или .csv по шаблону.', 'err'); return; }
    const idx = accIndex(state);
    const ok = [], errors = [];
    let notFound = 0;
    rows.forEach((row, i) => {
      const line = i + 2;
      const id = String(pickCol(row, ['лс', 'лицевой счёт', 'лицевой счет']) ?? '').trim();
      const period = String(pickCol(row, ['период']) ?? '').trim();
      const qty = num(pickCol(row, ['объём', 'объем']));
      const tariff = num(pickCol(row, ['тариф']));
      const total = num(pickCol(row, ['сумма']));
      const basis = BASIS_IN[String(pickCol(row, ['основание']) ?? 'счётчик').trim().toLowerCase()] || 'meter';
      const a = idx.get(id);
      if (!id) { errors.push({ line, id, msg: 'Не указан лицевой счёт' }); return; }
      if (!a) { notFound++; errors.push({ line, id, msg: 'Лицевой счёт не найден в реестре ЕРЦ' }); return; }
      if (!a.has[r]) { errors.push({ line, id, msg: `Услуга «${RES[r].name}» не подключена к этому ЛС` }); return; }
      if (period !== '2026-09') { errors.push({ line, id, msg: `Период ${period || 'пусто'} не совпадает с расчётным 2026-09` }); return; }
      if ([qty, tariff, total].some((v) => Number.isNaN(v))) { errors.push({ line, id, msg: 'Объём, тариф или сумма не числом' }); return; }
      if (Math.abs(total - qty * tariff) > 1) { errors.push({ line, id, msg: `Сумма ${f2(total)} ≠ объём × тариф (${f2(qty * tariff)})` }); return; }
      ok.push({ id, qty, tariff, sum: Math.round(total * 100) / 100, basis });
    });
    const rec = { id: uid('up'), org: org.id, res: r, period: '2026-09', file: file.name, at: new Date().toISOString(), total: rows.length, accepted: ok.length, rejected: errors.length - notFound, notFound, errors: errors.slice(0, 200) };
    act('Загрузка начислений', `${RES[r].name}, период 2026-09`, `Файл ${file.name}: принято ${ok.length}, отклонено ${rec.rejected}, не найдено ${notFound}`, (d) => {
      ok.forEach((x) => { d.charges[x.id].lines[r] = { qty: x.qty, tariff: x.tariff, sum: x.sum, basis: x.basis }; });
      rec.by = d.users.find((u) => u.org === org.id && u.role === 'supplier')?.name;
      d.uploads.unshift(rec);
      const it = d.integrations.find((x) => x.id === r); if (it) { it.last = rec.at; it.errors = errors.length; it.status = errors.length ? 'warn' : 'ok'; }
    });
    setReport(rec);
    toast(`Принято ${ok.length} строк. ИИ-сверка пересчитана.`);
  };

  return (
    <Page title="Загрузка начислений" lead={`${RES[r].name}: файл Excel или CSV по шаблону. Строки с ошибкой не попадают в квитанции, остальные сразу проходят ИИ-сверку.`}
      actions={<Btn onClick={template}>Скачать шаблон с текущими начислениями</Btn>}>
      <div className={`drop ${drag ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}>
        <b>Перетащите файл начислений за сентябрь 2026</b>
        <span className="small muted">Колонки: ЛС, Период, Объём, Тариф, Сумма, Основание (счётчик / норматив / показания)</span>
        <label className="btn pri">Выбрать файл<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { handle(e.target.files[0]); e.target.value = ''; }} /></label>
        {released && <Pill kind="warn">Период закрыт, загрузка недоступна</Pill>}
      </div>
      <Table keyOf={(u) => u.id} cols={[
        { h: 'Дата', r: (u) => dt(u.at) }, { h: 'Файл', r: (u) => <span className="mono small">{u.file}</span> }, { h: 'Загрузил', r: (u) => u.by || '—' },
        { h: 'Строк', num: true, r: (u) => f0(u.total) }, { h: 'Принято', num: true, r: (u) => f0(u.accepted) },
        { h: 'Ошибки', num: true, r: (u) => (u.rejected + u.notFound ? <Pill kind="bad">{u.rejected + u.notFound}</Pill> : <Pill kind="ok">0</Pill>) },
        { h: '', r: (u) => (u.errors.length ? <Btn small onClick={() => setReport(u)}>Отчёт</Btn> : null) },
      ]} rows={mine} />
      {report && (
        <Modal title={`Отчёт о загрузке: ${report.file}`} onClose={() => setReport(null)} wide>
          <Stats items={[{ v: f0(report.total), l: 'строк в файле' }, { v: f0(report.accepted), l: 'принято' }, { v: f0(report.rejected), l: 'отклонено' }, { v: f0(report.notFound), l: 'ЛС не найден' }]} />
          {report.errors.length > 0 && (
            <>
              <Table keyOf={(e) => `${e.line}-${e.msg}`} cols={[{ h: 'Строка', num: true, r: (e) => e.line }, { h: 'ЛС', r: (e) => <span className="mono">{e.id || '—'}</span> }, { h: 'Ошибка', r: (e) => e.msg }]} rows={report.errors.slice(0, 50)} />
              <div className="btns"><Btn onClick={() => downloadBlob(`errors_${report.file}.csv`, '﻿Строка;ЛС;Ошибка\n' + report.errors.map((e) => `${e.line};${e.id};${e.msg}`).join('\n'), 'text/csv;charset=utf-8')}>Скачать ошибки (CSV)</Btn></div>
            </>
          )}
        </Modal>
      )}
    </Page>
  );
}

export function Tariffs() {
  const { state, act, toast } = useStore();
  const org = useOrg();
  const r = org.res;
  const [val, setVal] = useState('');
  const [from, setFrom] = useState('2026-10');
  const [order, setOrder] = useState('');
  const [err, setErr] = useState('');
  const list = [...state.tariffs[r]].reverse();
  const save = () => {
    const v = Number(val.replace(',', '.'));
    if (!v || v <= 0) { setErr('Введите тариф больше нуля.'); return; }
    if (order.trim().length < 3) { setErr('Укажите основание: номер и дату приказа.'); return; }
    act('Новый тариф', RES[r].name, `${f2(v)} ₸ за ${RES[r].unit} с ${from}, ${order}`, (d) => { d.tariffs[r].push({ value: v, from, order, at: new Date().toISOString(), by: state.users.find((u) => u.org === org.id && u.role === 'supplier')?.name }); d.tariffs[r].sort((a, b) => a.from.localeCompare(b.from)); });
    setVal(''); setOrder(''); toast('Тариф сохранён и виден руководителю ЕРЦ в журнале');
  };
  return (
    <Page title="Тарифы" lead="Новый тариф применяется только к периодам с даты начала. Сентябрь 2026 уже начислен, поэтому ближайшая дата — октябрь.">
      <Grid min={320}>
        <Card title="Действующий тариф">
          <Stats items={[{ v: `${f2(approvedTariff(state, r))} ₸`, l: `за ${RES[r].unit}, сентябрь 2026` }]} />
        </Card>
        <Card title="Внести новый тариф">
          <div className="form">
            <div className="row">
              <Field label={`Тариф, ₸ за ${RES[r].unit}`}><input inputMode="decimal" value={val} onChange={(e) => { setVal(e.target.value); setErr(''); }} /></Field>
              <Field label="Действует с"><select value={from} onChange={(e) => setFrom(e.target.value)}>{['2026-10', '2026-11', '2026-12', '2027-01'].map((m) => <option key={m}>{m}</option>)}</select></Field>
            </div>
            <Field label="Основание" error={err}><input value={order} onChange={(e) => { setOrder(e.target.value); setErr(''); }} placeholder="Приказ № 45-ОД от 20.09.2026" /></Field>
            <div className="btns"><Btn kind="pri" onClick={save}>Сохранить тариф</Btn></div>
          </div>
        </Card>
      </Grid>
      <Table keyOf={(t) => t.from + t.value} cols={[
        { h: 'Действует с', r: (t) => <span className="mono">{t.from}</span> }, { h: 'Тариф', num: true, r: (t) => `${f2(t.value)} ₸` },
        { h: 'Основание', r: (t) => t.order }, { h: 'Внесён', r: (t) => `${dt(t.at)} · ${t.by}` },
        { h: '', r: (t) => (t.from > MONTH_KEYS[11] ? <Pill kind="info">будущий</Pill> : null) },
      ]} rows={list} />
    </Page>
  );
}

export function Corrections() {
  const { state, user, act, toast } = useStore();
  const [f, setF] = useState('pending');
  const [obj, setObj] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const mine = state.corrections.filter((c) => c.org === user.org);
  const list = mine.filter((c) => f === 'all' || c.status === f);
  const ST = { pending: ['warn', 'ждёт ответа'], accepted: ['ok', 'принята'], disputed: ['bad', 'возражение'], upheld: ['neutral', 'оставлена ЕРЦ'], reverted: ['info', 'отменена ЕРЦ'] };
  const accept = (c) => { act('Корректировка принята поставщиком', `ЛС ${c.acc}`, `${ISSUE_TYPES[c.type].label}, ${money(c.amount)}`, (d) => { const x = d.corrections.find((y) => y.id === c.id); x.status = 'accepted'; x.answeredAt = new Date().toISOString(); x.answeredBy = user.name; }); toast('Корректировка принята к учёту'); };
  const dispute = () => {
    if (text.trim().length < 10) { setErr('Опишите основание возражения (не короче 10 символов).'); return; }
    act('Возражение поставщика', `ЛС ${obj.acc}`, text, (d) => { const x = d.corrections.find((y) => y.id === obj.id); x.status = 'disputed'; x.objection = text; x.answeredAt = new Date().toISOString(); x.answeredBy = user.name; });
    setObj(null); setText(''); toast('Возражение отправлено оператору ЕРЦ');
  };
  return (
    <Page title="Корректировки ЕРЦ" lead="Оператор ЕРЦ исправил начисления по вашему ресурсу. Примите корректировку к учёту или подайте возражение с основанием.">
      <Chips value={f} onChange={setF} items={[['pending', 'Ждут ответа', mine.filter((c) => c.status === 'pending').length], ['disputed', 'Возражения', mine.filter((c) => c.status === 'disputed').length], ['accepted', 'Приняты', mine.filter((c) => c.status === 'accepted').length], ['all', 'Все', mine.length]]} />
      <Table keyOf={(c) => c.id} empty="Корректировок в этом статусе нет" cols={[
        { h: 'Дата', r: (c) => dt(c.at) },
        { h: 'ЛС', r: (c) => <><span className="mono">{c.acc}</span><span className="sub">{c.address}</span></> },
        { h: 'Основание', r: (c) => <><Tag>{ISSUE_TYPES[c.type].label}</Tag><span className="sub desc">{c.text}</span></> },
        { h: 'Сумма', num: true, r: (c) => money(c.amount) },
        { h: 'Оператор', r: (c) => c.by },
        { h: 'Статус', r: (c) => <><Pill kind={ST[c.status][0]}>{ST[c.status][1]}</Pill>{c.objection && <span className="sub desc">{c.objection}</span>}</> },
        { h: '', r: (c) => (c.status === 'pending' ? <div className="btns"><Btn small kind="pri" onClick={() => accept(c)}>Принять</Btn><Btn small onClick={() => { setObj(c); setErr(''); }}>Возразить</Btn></div> : null) },
      ]} rows={list} />
      {obj && (
        <Modal title={`Возражение по ЛС ${obj.acc}`} onClose={() => setObj(null)}>
          <p className="small" style={{ margin: 0 }}>{obj.text}</p>
          <Field label="Основание возражения" error={err}><textarea value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="Например: счётчик не прошёл поверку, показания недействительны" /></Field>
          <div className="btns"><Btn kind="pri" onClick={dispute}>Отправить возражение</Btn></div>
        </Modal>
      )}
    </Page>
  );
}

export function Anomalies() {
  const { state, user, act, toast } = useStore();
  const org = useOrg();
  const r = org.res;
  const [f, setF] = useState('active');
  const [assign, setAssign] = useState(null);
  const [insp, setInsp] = useState('');
  const [view, setView] = useState(null);
  const all = anomalies(state).filter((x) => x.res === r);
  const list = all.filter((x) => (f === 'active' ? x.status !== 'closed' : f === 'closed' ? x.status === 'closed' : true)).sort((a, b) => b.dmg - a.dmg);
  const inspectors = state.users.filter((u) => u.role === 'inspector' && u.active && (u.org === org.id || u.org === 'erc'));
  const snapOf = (x) => ({ key: x.key, kind: x.kind, res: x.res, bld: x.bld, acc: x.acc, text: x.text, dmg: x.dmg });
  const doAssign = () => {
    const ins = inspectors.find((u) => u.id === insp);
    if (!ins) return;
    const vid = uid('v');
    act('Назначен выезд', ANOMALY_KINDS[assign.kind], `${state.buildings[assign.bld].name}${assign.acc ? `, ЛС ${assign.acc}` : ''} → ${ins.name}`, (d) => {
      d.visits.unshift({ id: vid, anomalyKey: assign.key, org: org.id, inspector: ins.id, status: 'assigned', at: new Date().toISOString(), snap: snapOf(assign) });
      d.anomalyState[assign.key] = { status: 'assigned', visitId: vid, snap: snapOf(assign) };
    });
    setAssign(null); toast(`Выезд назначен: ${ins.name}`);
  };
  const close = (x) => {
    const v = state.visits.find((y) => y.id === x.visitId);
    act('Аномалия закрыта', ANOMALY_KINDS[x.kind], `${state.buildings[x.bld].name}: ${v ? VISIT_RESULTS[v.result] : 'без выезда'}`, (d) => {
      const st = d.anomalyState[x.key] || { snap: snapOf(x) };
      d.anomalyState[x.key] = { ...st, status: 'closed', closedAt: new Date().toISOString(), closedBy: user.name };
      if (x.kind === 'balance' && v && (v.result === 'leak' || v.result === 'bypass')) d.buildings[x.bld].leak[x.res] && (d.buildings[x.bld].leak[x.res].resolved = true);
    });
    setView(null);
    toast(x.kind === 'balance' ? 'Аномалия закрыта, потери дома пересчитаны' : 'Аномалия закрыта');
  };
  return (
    <Page title="Аномалии учёта" lead={`${RES[r].name}: небаланс домов и подозрительный расход в квартирах за сентябрь. Назначьте выезд, получите результат и закройте аномалию.`}>
      <Stats items={[
        { v: all.filter((x) => x.status === 'open').length, l: 'новых' }, { v: all.filter((x) => x.status === 'assigned').length, l: 'на выезде' },
        { v: all.filter((x) => x.status === 'checked').length, l: 'проверено, ждут закрытия' }, { v: money(all.filter((x) => x.status !== 'closed').reduce((s, x) => s + x.dmg, 0)), l: 'оценка ущерба в месяц' },
      ]} />
      <Chips value={f} onChange={setF} items={[['active', 'В работе', all.filter((x) => x.status !== 'closed').length], ['closed', 'Закрытые', all.filter((x) => x.status === 'closed').length], ['all', 'Все', all.length]]} />
      <Table keyOf={(x) => x.key} cols={[
        { h: 'Объект', r: (x) => <>{state.buildings[x.bld].name}{x.acc && <span className="sub">кв. {state.accounts.find((a) => a.id === x.acc).apt} · ЛС {x.acc}</span>}</> },
        { h: 'Тип', r: (x) => <Tag>{ANOMALY_KINDS[x.kind]}</Tag> },
        { h: 'Описание', r: (x) => <span className="desc">{x.text}</span> },
        { h: 'Ущерб/мес', num: true, r: (x) => money(x.dmg) },
        { h: 'Статус', r: (x) => <AnStatus x={x} /> },
        { h: '', r: (x) => (x.status === 'open' ? <Btn small kind="pri" onClick={() => { setAssign(x); setInsp(inspectors[0]?.id || ''); }}>Назначить выезд</Btn>
          : x.status === 'checked' ? <Btn small kind="pri" onClick={() => setView(x)}>Результат</Btn>
          : x.status === 'assigned' ? <span className="small muted">{state.users.find((u) => u.id === state.visits.find((v) => v.id === x.visitId)?.inspector)?.name}</span> : null) },
      ]} rows={list} />
      {assign && (
        <Modal title="Назначить выезд" onClose={() => setAssign(null)}>
          <p className="small" style={{ margin: 0 }}>{state.buildings[assign.bld].name}{assign.acc ? `, кв. ${state.accounts.find((a) => a.id === assign.acc).apt}` : ''}. {assign.text}</p>
          {assign.kind === 'balance' && <BalanceChart state={state} b={state.buildings[assign.bld]} res={assign.res} />}
          <Field label="Инспектор"><select value={insp} onChange={(e) => setInsp(e.target.value)}>{inspectors.map((u) => <option key={u.id} value={u.id}>{u.name} · {state.orgs.find((o) => o.id === u.org).name}</option>)}</select></Field>
          <div className="btns"><Btn kind="pri" onClick={doAssign}>Назначить</Btn></div>
        </Modal>
      )}
      {view && (() => { const v = state.visits.find((y) => y.id === view.visitId); return (
        <Modal title="Результат проверки" onClose={() => setView(null)}>
          <Stats items={[{ v: VISIT_RESULTS[v.result], l: 'результат' }, { v: f1(v.reading), l: 'показание на месте' }, { v: state.users.find((u) => u.id === v.inspector)?.name, l: dt(v.doneAt) }]} />
          {v.comment && <p className="small" style={{ margin: 0 }}>{v.comment}</p>}
          {v.photo && <img src={v.photo} alt="Фото счётчика с выезда" style={{ maxWidth: '100%', borderRadius: 8 }} />}
          <Note>{view.kind === 'balance' && (v.result === 'leak' || v.result === 'bypass') ? 'После закрытия утечка считается устранённой, потери дома пересчитаются.' : 'Закройте аномалию, если вопрос решён.'}</Note>
          <div className="btns"><Btn kind="pri" onClick={() => close(view)}>Закрыть аномалию</Btn></div>
        </Modal>
      ); })()}
    </Page>
  );
}

export function Requests() {
  const { state, user, act, toast } = useStore();
  const list = state.requests.filter((q) => q.to === user.org);
  const ST = { new: ['bad', 'новая'], work: ['warn', 'в работе'], done: ['ok', 'выполнена'] };
  const move = (q, status) => { act('Заявка на устранение', state.buildings[q.bld].name, `Статус: ${ST[status][1]}`, (d) => { const x = d.requests.find((y) => y.id === q.id); x.status = status; x[`${status}At`] = new Date().toISOString(); }); toast(`Заявка: ${ST[status][1]}`); };
  return (
    <Page title="Заявки на устранение" lead="Заявки создают инспекторы после выезда, если нашли утечку или неисправность.">
      <Table keyOf={(q) => q.id} empty="Заявок нет" cols={[
        { h: 'Дата', r: (q) => dt(q.at) },
        { h: 'Объект', r: (q) => <>{state.buildings[q.bld].name}{q.apt && <span className="sub">кв. {q.apt}</span>}</> },
        { h: 'Ресурс', r: (q) => RES[q.res].short },
        { h: 'Описание', r: (q) => <span className="desc">{q.text}<span className="sub">Инспектор: {q.by}</span></span> },
        { h: 'Статус', r: (q) => <Pill kind={ST[q.status][0]}>{ST[q.status][1]}</Pill> },
        { h: '', r: (q) => (q.status === 'new' ? <Btn small kind="pri" onClick={() => move(q, 'work')}>Взять в работу</Btn> : q.status === 'work' ? <Btn small kind="pri" onClick={() => move(q, 'done')}>Выполнено</Btn> : null) },
      ]} rows={list} />
    </Page>
  );
}
