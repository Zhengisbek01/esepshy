import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { SEG, MONTHS } from '../data/constants.js';
import { score, segment, addr, billFor } from '../lib/engine.js';
import { f0, money, dt, uid } from '../lib/format.js';
import { printHtml } from '../lib/files.js';
import { Page, Card, Btn, Pill, Table, Modal, Field, Note, Stats, Chips, Grid, Hist } from '../ui.jsx';

const fill = (t, s, a) => t.replace('{ФИО}', a.owner).replace('{ЛС}', a.id).replace('{адрес}', addr(s, a)).replace('{сумма}', money(a.debt)).replace('{кв}', a.apt);

export function Work() {
  const { state, user, act, toast } = useStore();
  const [seg, setSeg] = useState('low');
  const [inst, setInst] = useState(null);
  const [months, setMonths] = useState(3);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const debtors = useMemo(() => state.accounts.filter((a) => a.debt > 0).map((a) => ({ a, s: score(a) })), [state.accounts]);
  const list = debtors.filter((x) => seg === 'all' || segment(x.s) === seg).sort((x, y) => y.s - x.s);
  const by = (k) => debtors.filter((x) => segment(x.s) === k);
  const last = (a) => state.debtActions.find((x) => x.acc === a.id);
  const tpl = state.templates.find((t) => t.id === 'reminder');

  const bulk = () => {
    const targets = by('low').filter((x) => !state.installments[x.a.id]);
    act('Рассылка напоминаний', SEG.low.name, `${targets.length} должникам по шаблону «${tpl.name}»`, (d) => {
      const at = new Date().toISOString();
      targets.forEach(({ a }) => {
        const ok = !a.phone.endsWith('00');
        d.messages.unshift({ id: uid('m'), acc: a.id, channel: 'WhatsApp', template: tpl.id, text: fill(tpl.text, d, a), at, by: user.name, status: ok ? 'доставлено' : 'не доставлено' });
        d.debtActions.unshift({ id: uid('da'), acc: a.id, type: 'reminder', at, by: user.name, delivered: ok });
      });
    });
    toast(`Напоминания отправлены: ${targets.length}`);
  };
  const saveInst = () => {
    if (!consent) { setErr('Нужно подтверждённое согласие жителя.'); return; }
    const monthly = Math.ceil(inst.debt / months);
    act('Рассрочка', `ЛС ${inst.id}`, `${months} мес. по ${money(monthly)}`, (d) => {
      d.installments[inst.id] = { months, monthly, total: inst.debt, start: '2026-10', paid: 0, at: new Date().toISOString(), by: user.name };
      d.debtActions.unshift({ id: uid('da'), acc: inst.id, type: 'installment', at: new Date().toISOString(), by: user.name, months, monthly });
    });
    setInst(null); toast('Рассрочка оформлена, график появится в квитанциях');
  };
  const claim = (a) => {
    const rows = [];
    for (let m = 11 - a.overdue; m <= 10; m++) rows.push(`<tr><td>${MONTHS[m]}</td><td class="r">${f0(billFor(state, a, m).total)} ₸</td></tr>`);
    const html = `<p class="muted">ЕРЦ «Самал» (демо) · Esepshy · ${new Date().toLocaleDateString('ru-RU')}</p>
      <h1>Досудебная претензия</h1>
      <p><b>Кому:</b> ${a.owner}, ${addr(state, a)}<br><b>Лицевой счёт:</b> ${a.id}</p>
      <p>По состоянию на ${new Date().toLocaleDateString('ru-RU')} по лицевому счёту числится задолженность за коммунальные услуги в размере <b>${f0(a.debt)} ₸</b> за ${a.overdue} мес.</p>
      <h2>Расчёт задолженности по периодам</h2><table><tr><th>Период</th><th>Начислено</th></tr>${rows.join('')}<tr><th>Итого долг</th><th class="r">${f0(a.debt)} ₸</th></tr></table>
      <p>Просим погасить задолженность в течение 30 календарных дней с даты получения претензии. При неоплате ЕРЦ вправе обратиться в суд в порядке, предусмотренном законодательством Республики Казахстан.</p>
      <p>Оплатить можно онлайн в Esepshy, в банке или кассе ЕРЦ. Возможна рассрочка.</p>
      <p class="muted">Документ сформирован в тестовой версии на демо-данных. Текст претензии подлежит проверке юристом.</p>`;
    if (!printHtml(`Претензия ЛС ${a.id}`, html)) { toast('Браузер заблокировал окно печати. Разрешите всплывающие окна.', 'err'); return; }
    act('Досудебная претензия', `ЛС ${a.id}`, `Долг ${money(a.debt)} за ${a.overdue} мес.`, (d) => { d.debtActions.unshift({ id: uid('da'), acc: a.id, type: 'claim', at: new Date().toISOString(), by: user.name }); });
  };
  const LABEL = { reminder: 'напоминание', installment: 'рассрочка', claim: 'претензия' };
  return (
    <Page title="Работа с должниками" lead="Модель задолженности оценивает риск неплатежа по каждому ЛС: глубина долга, просрочки за год, канал оплаты и сумма. Для каждого сегмента своё действие.">
      <Grid min={240}>
        {Object.entries(SEG).map(([k, v]) => (
          <div className="kpi" key={k}>
            <div className="kpi-top"><Pill kind={v.cls}>{v.name}</Pill><span className="mono">{by(k).length}</span></div>
            <div className="kpi-val" style={{ fontSize: '1.3rem' }}>{money(by(k).reduce((s, x) => s + x.a.debt, 0))}</div>
            <div className="kpi-foot"><span>{v.act}</span></div>
          </div>
        ))}
      </Grid>
      <div className="btns" style={{ justifyContent: 'space-between' }}>
        <Chips value={seg} onChange={setSeg} items={[['low', SEG.low.name, by('low').length], ['mid', SEG.mid.name, by('mid').length], ['high', SEG.high.name, by('high').length], ['all', 'Все', debtors.length]]} />
        {seg === 'low' && <Btn kind="pri" onClick={bulk}>Отправить напоминания сегменту</Btn>}
      </div>
      <Table keyOf={(x) => x.a.id} cols={[
        { h: 'ЛС / адрес', r: (x) => <><span className="mono">{x.a.id}</span><span className="sub">{addr(state, x.a)} · {x.a.owner}</span></> },
        { h: 'Долг', num: true, r: (x) => money(x.a.debt) }, { h: 'Мес.', num: true, r: (x) => x.a.overdue }, { h: 'Просрочки за год', num: true, r: (x) => x.a.late },
        { h: 'Риск', num: true, r: (x) => <Pill kind={SEG[segment(x.s)].cls}>{x.s}</Pill> },
        { h: 'Последнее действие', r: (x) => { const l = last(x.a); const i = state.installments[x.a.id]; return i ? <Pill kind="info">рассрочка {i.months} мес.</Pill> : l ? <span className="small">{LABEL[l.type]}{l.delivered === false ? ' (не доставлено)' : ''}<span className="sub">{dt(l.at)}</span></span> : '—'; } },
        { h: '', r: (x) => (
          <div className="btns">
            {segment(x.s) === 'mid' && !state.installments[x.a.id] && <Btn small kind="pri" onClick={() => { setInst(x.a); setMonths(3); setConsent(false); setErr(''); }}>Рассрочка</Btn>}
            {segment(x.s) === 'high' && <Btn small kind="pri" onClick={() => claim(x.a)}>Претензия</Btn>}
          </div>
        ) },
      ]} rows={list} />
      {inst && (
        <Modal title={`Рассрочка по ЛС ${inst.id}`} onClose={() => setInst(null)}>
          <p className="small" style={{ margin: 0 }}>{inst.owner} · {addr(state, inst)} · долг {money(inst.debt)}</p>
          <div className="radio-list">{[3, 6].map((m) => <label key={m}><input type="radio" checked={months === m} onChange={() => setMonths(m)} /> {m} месяцев по {money(Math.ceil(inst.debt / m))}</label>)}</div>
          <label className="btns small"><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(''); }} /> Житель согласен с графиком (звонок или заявление)</label>
          {err && <span className="field-e">{err}</span>}
          <Note>Платежи по графику учитываются отдельно. При пропуске платежа ЛС возвращается в очередь.</Note>
          <div className="btns"><Btn kind="pri" onClick={saveInst}>Оформить</Btn></div>
        </Modal>
      )}
    </Page>
  );
}

export function Report() {
  const { state } = useStore();
  const debtors = state.accounts.filter((a) => a.debt > 0).map((a) => ({ a, s: score(a) }));
  const acted = new Set(state.debtActions.map((x) => x.acc));
  const paidByActed = state.payments.filter((p) => acted.has(p.acc)).reduce((s, p) => s + p.amount, 0);
  const rows = Object.keys(SEG).map((k) => {
    const g = debtors.filter((x) => segment(x.s) === k);
    return { k, n: g.length, debt: g.reduce((s, x) => s + x.a.debt, 0), exp: g.reduce((s, x) => s + x.a.debt * (1 - x.s / 100), 0), actions: state.debtActions.filter((d) => g.some((x) => x.a.id === d.acc)).length };
  });
  const cnt = (t) => state.debtActions.filter((d) => d.type === t).length;
  return (
    <Page title="Результаты работы с долгами" lead="Ожидаемый сбор за 90 дней — оценка модели: долг, умноженный на вероятность оплаты. Фактический сбор — платежи должников после действий ЕРЦ.">
      <Card><Stats items={[
        { v: money(rows.reduce((s, r) => s + r.exp, 0)), l: 'ожидаемый сбор за 90 дней' },
        { v: money(paidByActed), l: 'собрано после действий' },
        { v: cnt('reminder'), l: 'напоминаний' }, { v: cnt('installment'), l: 'рассрочек' }, { v: cnt('claim'), l: 'претензий' },
      ]} /></Card>
      <Grid min={420}>
        <Card title="Должники по баллу риска"><Hist values={debtors.map((x) => x.s)} /></Card>
        <Table keyOf={(r) => r.k} cols={[
          { h: 'Сегмент', r: (r) => <Pill kind={SEG[r.k].cls}>{SEG[r.k].name}</Pill> }, { h: 'ЛС', num: true, r: (r) => r.n },
          { h: 'Долг', num: true, r: (r) => money(r.debt) }, { h: 'Ожидаемо за 90 дней', num: true, r: (r) => money(r.exp) }, { h: 'Действий', num: true, r: (r) => r.actions },
        ]} rows={rows} />
      </Grid>
    </Page>
  );
}
