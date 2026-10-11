import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { RES, RK, CUR } from '../data/constants.js';
import { bldStats, input, metered, score, segment, addr } from '../lib/engine.js';
import { f0, f1, pct, money, dt, uid } from '../lib/format.js';
import { Page, Card, Btn, Pill, Table, Modal, Field, Note, Stats, Seg, Grid } from '../ui.jsx';
import { HouseCard, fq } from './Shared.jsx';
import { SEG } from '../data/constants.js';

const useHouses = () => { const { state, user } = useStore(); const org = state.orgs.find((o) => o.id === user.org); return [org, state.buildings.filter((b) => org.blds.includes(b.id))]; };

export function Houses() {
  const { state } = useStore();
  const [, houses] = useHouses();
  const [sel, setSel] = useState(houses[0].id);
  return (
    <Page title="Мои дома" lead="Потери по ресурсам, доля умных счётчиков, аномалии и оплаты по каждому дому. Данные совпадают со сводкой ЕРЦ.">
      <Table keyOf={(b) => b.id} onRow={(b) => setSel(b.id)} rowClass={(b) => (b.id === sel ? 'sel' : '')} cols={[
        { h: 'Дом', r: (b) => b.name },
        { h: 'Квартир', num: true, r: (b) => bldStats(state, b).n },
        { h: 'Оплатили за август', num: true, r: (b) => pct(bldStats(state, b).paid) },
        { h: 'Долг', num: true, r: (b) => money(bldStats(state, b).debt) },
        { h: 'Макс. потери', r: (b) => { const st = bldStats(state, b); const worst = Object.entries(st.res).sort((x, y) => y[1].loss - x[1].loss)[0]; return <Pill kind={worst[1].loss > RES[worst[0]].thr ? 'bad' : 'ok'}>{RES[worst[0]].short}: {pct(worst[1].loss)}</Pill>; } },
      ]} rows={houses} />
      <HouseCard state={state} b={state.buildings[sel]} pii />
    </Page>
  );
}

export function Odpu() {
  const { state, act, toast } = useStore();
  const [, houses] = useHouses();
  const [vals, setVals] = useState({});
  const save = (b, r) => {
    const v = Number(String(vals[`${b.id}-${r}`] || '').replace(',', '.'));
    if (!v || v <= 0) { toast('Введите показание ввода больше нуля', 'err'); return; }
    act('Показания ОДПУ', b.name, `${RES[r].name}: ${fq(r, v)} ${RES[r].unit} за сентябрь`, (d) => { d.odpu[b.id] = d.odpu[b.id] || {}; d.odpu[b.id][r] = v; });
    setVals({ ...vals, [`${b.id}-${r}`]: '' });
    toast('Баланс дома пересчитан');
  };
  const rows = houses.flatMap((b) => RK.filter((r) => (r !== 'gas' || b.hasGas) && RES[r].season[CUR] > 0).map((r) => ({ b, r })));
  return (
    <Page title="Общедомовые счётчики" lead="Расход ввода за сентябрь по общедомовым приборам учёта. Данные приходят автоматически; если прибор не на связи, внесите показание вручную.">
      <Table keyOf={(x) => `${x.b.id}-${x.r}`} cols={[
        { h: 'Дом', r: (x) => x.b.name },
        { h: 'Ресурс', r: (x) => <span className="resname"><i className="dot" style={{ background: RES[x.r].color }} />{RES[x.r].name}</span> },
        { h: 'Сумма квартир', num: true, r: (x) => fq(x.r, metered(state, x.b, x.r, CUR)) },
        { h: 'Ввод (ОДПУ)', num: true, r: (x) => <>{fq(x.r, input(state, x.b, x.r, CUR))}<span className="sub">{state.odpu[x.b.id]?.[x.r] != null ? 'внесено вручную' : 'автоматически'}</span></> },
        { h: 'Потери', num: true, r: (x) => { const i = input(state, x.b, x.r, CUR), m = metered(state, x.b, x.r, CUR); const l = i ? (i - m) / i : 0; return <Pill kind={l > RES[x.r].thr ? 'bad' : 'ok'}>{pct(l)}</Pill>; } },
        { h: 'Внести вручную', r: (x) => <div className="btns"><input aria-label="Показание ввода" inputMode="decimal" style={{ width: 110 }} value={vals[`${x.b.id}-${x.r}`] || ''} onChange={(e) => setVals({ ...vals, [`${x.b.id}-${x.r}`]: e.target.value })} /><Btn small onClick={() => save(x.b, x.r)}>Сохранить</Btn></div> },
      ]} rows={rows} />
    </Page>
  );
}

export function Fees() {
  const { state, user, act, toast } = useStore();
  const [org, houses] = useHouses();
  const cfg = state.osiRates[org.id];
  const [rate, setRate] = useState('');
  const [err, setErr] = useState('');
  const area = state.accounts.filter((a) => org.blds.includes(a.bld)).reduce((s, a) => s + a.area, 0);
  const save = () => {
    const v = Number(rate.replace(',', '.'));
    if (!v || v <= 0 || v > 500) { setErr('Ставка от 1 до 500 ₸ за м².'); return; }
    act('Ставка взносов ОСИ', org.name, `${f1(v)} ₸/м² с 2026-10`, (d) => { d.osiRates[org.id].next = { rate: v, from: '2026-10', at: new Date().toISOString(), by: user.name }; });
    setRate(''); toast('Новая ставка появится в квитанциях за октябрь');
  };
  return (
    <Page title="Взносы ОСИ" lead="Ставка взноса за м² добавляется строкой «Взносы ОСИ» в квитанции домов. Изменение действует со следующего расчётного периода.">
      <Grid min={320}>
        <Card title="Текущая ставка">
          <Stats items={[{ v: `${f1(cfg.rate)} ₸/м²`, l: 'сентябрь 2026' }, { v: money(cfg.rate * area), l: `начислено по ${houses.length} домам` }]} />
          {cfg.next && <Note>С {cfg.next.from}: {f1(cfg.next.rate)} ₸/м² · установил {cfg.next.by}, {dt(cfg.next.at)}</Note>}
        </Card>
        <Card title="Изменить ставку">
          <div className="form">
            <Field label="Новая ставка, ₸ за м²" error={err} hint="Применится с октября 2026"><input inputMode="decimal" value={rate} onChange={(e) => { setRate(e.target.value); setErr(''); }} /></Field>
            <div className="btns"><Btn kind="pri" onClick={save}>Сохранить</Btn></div>
          </div>
        </Card>
      </Grid>
    </Page>
  );
}

export function Debtors() {
  const { state, user, act, toast } = useStore();
  const [org] = useHouses();
  const [seg, setSeg] = useState('all');
  const [send, setSend] = useState(null);
  const tpl = state.templates.find((t) => t.id === 'osi');
  const list = state.accounts.filter((a) => org.blds.includes(a.bld) && a.debt > 0).map((a) => ({ a, s: score(a) }))
    .filter((x) => seg === 'all' || segment(x.s) === seg).sort((x, y) => y.a.debt - x.a.debt);
  const textFor = (a) => tpl.text.replace('{кв}', a.apt).replace('{сумма}', money(a.debt)).replace('{ЛС}', a.id);
  const doSend = (a) => {
    act('Напоминание от ОСИ', `ЛС ${a.id}`, `Шаблон «${tpl.name}»`, (d) => {
      d.messages.unshift({ id: uid('m'), acc: a.id, channel: 'WhatsApp', template: tpl.id, text: textFor(a), at: new Date().toISOString(), by: user.name, status: 'доставлено' });
      d.debtActions.unshift({ id: uid('da'), acc: a.id, type: 'reminder', at: new Date().toISOString(), by: user.name, src: 'osi' });
    });
    setSend(null); toast('Напоминание отправлено');
  };
  const last = (a) => state.debtActions.find((x) => x.acc === a.id);
  return (
    <Page title="Должники домов" lead="Напоминания отправляются только по утверждённому шаблону. Каждая отправка записывается в журнал.">
      <Seg value={seg} onChange={setSeg} items={[['all', 'Все'], ['low', SEG.low.name], ['mid', SEG.mid.name], ['high', SEG.high.name]]} />
      <Table keyOf={(x) => x.a.id} cols={[
        { h: 'Квартира', r: (x) => <>{addr(state, x.a)}<span className="sub">ЛС {x.a.id} · {x.a.owner}</span></> },
        { h: 'Долг', num: true, r: (x) => money(x.a.debt) }, { h: 'Месяцев', num: true, r: (x) => x.a.overdue },
        { h: 'Сегмент', r: (x) => <Pill kind={SEG[segment(x.s)].cls}>{SEG[segment(x.s)].name}</Pill> },
        { h: 'Последнее действие', r: (x) => { const l = last(x.a); return l ? <span className="small">{l.type === 'reminder' ? 'напоминание' : l.type === 'installment' ? 'рассрочка' : 'претензия'} · {dt(l.at)}</span> : '—'; } },
        { h: '', r: (x) => <Btn small onClick={() => setSend(x.a)}>Напомнить</Btn> },
      ]} rows={list} />
      {send && <Modal title="Напоминание собственнику" onClose={() => setSend(null)}><p style={{ margin: 0 }} className="small">{textFor(send)}</p><Note>Канал: WhatsApp, номер из лицевого счёта. Текст нельзя изменить — только утверждённый шаблон.</Note><div className="btns"><Btn kind="pri" onClick={() => doSend(send)}>Отправить</Btn></div></Modal>}
    </Page>
  );
}
