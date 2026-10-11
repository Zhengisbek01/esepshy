import React from 'react';
import { RES, RK, MONTHS, MONTHS_SHORT, CUR, ANOMALY_KINDS } from '../data/constants.js';
import { kpis, billFor, bldStats, anomalies, addr, activeMonths, input, metered } from '../lib/engine.js';
import { f0, f1, f2, pct, money } from '../lib/format.js';
import { Kpi, Grid, Card, LineChart, PairBars, Pill, Table, Tag, Dot, Stats } from '../ui.jsx';

export function KpiBoard({ state }) {
  const k = kpis(state);
  return (
    <>
      <Grid min={260}>
        <Kpi title="Платежи онлайн" value={f1(k.online * 100)} unit="%" progress={k.online} target={0.7} ok={k.online >= 0.7} foot={`год назад ${pct(k.onlineBase)}`} right="цель ≥ 70%" />
        <Kpi title="Ошибки на 1 000 счетов" value={f1(k.err)} progress={Math.min(1, k.err / 40)} target={5 / 40} ok={k.err <= 5} foot={`${k.openIssues} открытых расхождений`} right="цель ≤ 5" />
        <Kpi title="Начислено за сентябрь" value={f1(k.billed / 1e6)} unit="млн ₸" status={false} foot="в т.ч. НДС 12%" right={`${state.accounts.length} квитанций`} />
      </Grid>
      <Grid min={240}>
        {RK.map((r) => {
          const s = k.res[r], R0 = RES[r];
          const okS = s.smart >= R0.smartT, okL = s.red >= R0.lossT;
          return (
            <div className="kpi" key={r}>
              <div className="kpi-top"><span className="resname" style={{ fontWeight: 600 }}><Dot res={r} />{R0.short}</span><Pill kind={okS && okL ? 'ok' : 'warn'}>{okS && okL ? 'в цели' : okS || okL ? '1 из 2' : 'ниже цели'}</Pill></div>
              <div className="row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div><div className="small muted">Умные счётчики</div><div className="mono" style={{ fontSize: '1.15rem', fontWeight: 600 }}>{pct(s.smart)}</div><div className="small muted">цель {pct(R0.smartT)}</div></div>
                <div><div className="small muted">Потери к базе</div><div className="mono" style={{ fontSize: '1.15rem', fontWeight: 600, color: okL ? 'var(--good)' : s.red < -0.02 ? 'var(--bad)' : 'var(--ink)' }}>{s.red >= 0 ? '−' : '+'}{f1(Math.abs(s.red) * 100)}%</div><div className="small muted">цель −{f0(R0.lossT * 100)}%</div></div>
              </div>
              <div className="meter"><i style={{ width: `${s.smart * 100}%`, background: R0.color }} /><b style={{ left: `${R0.smartT * 100}%` }} /></div>
            </div>
          );
        })}
      </Grid>
      <Grid min={420}>
        <Card title="Доля онлайн-платежей по месяцам" aside={<span className="legend"><span><i className="dot" style={{ background: 'var(--accent)' }} />факт</span><span>пунктир — цель 70%</span></span>}>
          <LineChart labels={MONTHS_SHORT} series={[{ values: k.onlineTrend, color: 'var(--accent)', area: true, end: pct(k.online) }]} target={0.7} yMax={1} yFmt={(v) => `${f0(v * 100)}%`} />
        </Card>
        <Card title="Потери ресурса: база и текущий квартал" aside={<span className="legend"><span><i className="dot" style={{ background: 'var(--muted)', opacity: 0.4 }} />база</span><span><i className="dot" style={{ background: 'var(--accent)' }} />сейчас</span></span>}>
          <PairBars groups={RK.map((r) => ({ label: RES[r].short, a: k.res[r].baseL, b: k.res[r].curL, color: RES[r].color }))} />
        </Card>
      </Grid>
    </>
  );
}

export function BillView({ state, acc, m, onDispute }) {
  const b = billFor(state, acc, m);
  const orgName = (id) => state.orgs.find((o) => o.id === id)?.name || '';
  const basisTag = (l) => l.basis === 'meter' ? <Tag tone="accent">умный счётчик</Tag> : l.basis === 'reading' ? <Tag tone="accent">ваши показания</Tag> : <Tag>норматив</Tag>;
  return (
    <div className="receipt">
      <div className="r-head">
        <div><h2 style={{ fontSize: '1.05rem' }}>Единая квитанция</h2><div className="small muted">Бірыңғай төлем құжаты · {MONTHS[m]}</div></div>
        <dl className="r-meta"><dt>Лицевой счёт</dt><dd>{acc.id}</dd><dt>Адрес</dt><dd>{addr(state, acc)}</dd><dt>Площадь / жильцов</dt><dd>{acc.area} м² / {acc.occ}</dd></dl>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Услуга</th><th>Основание</th><th className="n">Объём</th><th className="n">Тариф, ₸</th><th className="n">Сумма, ₸</th>{onDispute && <th />}</tr></thead>
          <tbody>
            {b.lines.map((l) => (
              <tr key={l.res}>
                <td>{RES[l.res].name}<span className="sub">{orgName(RES[l.res].org)}</span></td>
                <td>{l.qty ? basisTag(l) : '—'}</td>
                <td className="n">{l.qty ? `${RES[l.res].dig === 2 ? f2(l.qty) : f1(l.qty)} ${RES[l.res].unit}` : '—'}</td>
                <td className="n">{f2(l.tariff)}</td>
                <td className="n">{f0(l.sum)}</td>
                {onDispute && <td><button type="button" className="btn ghost sm" onClick={() => onDispute(l.res)}>Не согласен</button></td>}
              </tr>
            ))}
            <tr><td>Взносы ОСИ<span className="sub">{orgName(state.buildings[acc.bld].osi)}</span></td><td><Tag>по площади</Tag></td><td className="n">{acc.area} м²</td><td className="n">{f2(b.osi.rate)}</td><td className="n">{f0(b.osi.sum)}</td>{onDispute && <td><button type="button" className="btn ghost sm" onClick={() => onDispute('osi')}>Не согласен</button></td>}</tr>
            {b.extra.map((e, i) => <tr key={i}><td>{e.name}<span className="sub">{orgName(e.org)}</span></td><td><Tag>прочее</Tag></td><td className="n">—</td><td className="n">—</td><td className="n">{f0(e.sum)}</td>{onDispute && <td><button type="button" className="btn ghost sm" onClick={() => onDispute('osi')}>Не согласен</button></td>}</tr>)}
            <tr><td colSpan={4}><b>Начислено за {MONTHS[m]}</b></td><td className="n"><b>{f0(b.total)}</b></td>{onDispute && <td />}</tr>
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>В т.ч. НДС 12%: {money(b.vat)}. Тарифы демонстрационные.</p>
    </div>
  );
}

export function HouseCard({ state, b, pii }) {
  const st = bldStats(state, b);
  const an = anomalies(state).filter((x) => x.bld === b.id && x.status !== 'closed');
  return (
    <div className="page" style={{ gap: 14 }}>
      <Card title={b.name} aside={`${st.n} квартир · ${b.floors} этажей · ${b.year} г.`}>
        <Stats items={[
          { v: pct(st.paid), l: 'оплатили за август' },
          { v: st.debtors, l: 'должников' },
          { v: money(st.debt), l: 'долг дома' },
          { v: an.length, l: 'открытых аномалий' },
        ]} />
      </Card>
      <Table keyOf={(r) => r} cols={[
        { h: 'Ресурс', r: (r) => <span className="resname"><Dot res={r} />{RES[r].name}</span> },
        { h: 'Ввод в дом', num: true, r: (r) => `${fq(r, st.res[r].input)} ${RES[r].unit}` },
        { h: 'Сумма квартир', num: true, r: (r) => fq(r, st.res[r].met) },
        { h: 'Потери', num: true, r: (r) => <Pill kind={st.res[r].loss > RES[r].thr ? 'bad' : 'ok'}>{pct(st.res[r].loss)}</Pill> },
        { h: 'Умные', num: true, r: (r) => pct(st.res[r].smart) },
      ]} rows={Object.keys(st.res)} />
      <BalanceChart state={state} b={b} />
      {an.length > 0 && (
        <Table keyOf={(x) => x.key} cols={[
          { h: 'Тип', r: (x) => <><Tag>{ANOMALY_KINDS[x.kind]}</Tag><span className="sub">{RES[x.res].short}</span></> },
          { h: 'Объект', r: (x) => (x.acc ? (pii ? `кв. ${state.accounts.find((a) => a.id === x.acc).apt}` : 'квартира') : 'дом') },
          { h: 'Описание', r: (x) => <span className="desc">{x.text}</span> },
          { h: 'Статус', r: (x) => <AnStatus x={x} /> },
        ]} rows={an} />
      )}
    </div>
  );
}
export const fq = (r, v) => (RES[r].dig === 2 ? f2(v) : RES[r].dig === 1 ? f1(v) : f0(v));

export function BalanceChart({ state, b, res }) {
  const r = res || 'water';
  const am = activeMonths(r);
  return (
    <Card title={`Баланс дома: ${RES[r].short.toLowerCase()}, ${RES[r].unit} в месяц`} aside={<span className="legend"><span><i className="dot" style={{ background: RES[r].color }} />ввод в дом</span><span>пунктир — сумма квартир</span></span>}>
      <LineChart labels={am.map((m) => MONTHS_SHORT[m])} series={[
        { values: am.map((m) => metered(state, b, r, m)), color: 'var(--muted)', w: 2, dash: true },
        { values: am.map((m) => input(state, b, r, m)), color: RES[r].color, area: true },
      ]} yFmt={(v) => fq(r, v)} h={200} />
    </Card>
  );
}

export const AnStatus = ({ x }) => {
  const m = { open: ['bad', 'новая'], assigned: ['warn', 'выезд назначен'], checked: ['info', 'проверено'], closed: ['ok', 'закрыта'] }[x.status] || ['neutral', x.status];
  return <Pill kind={m[0]}>{m[1]}</Pill>;
};

export function AccPicker({ state, ids, value, onChange }) {
  if (ids.length < 2) return null;
  return (
    <div className="seg">{ids.map((id) => { const a = state.accounts.find((x) => x.id === id); return <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>{state.buildings[a.bld].short}, кв. {a.apt}</button>; })}</div>
  );
}

export const CUR_LABEL = MONTHS[CUR];
