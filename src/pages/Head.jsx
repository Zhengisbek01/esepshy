import React from 'react';
import { useStore } from '../store.jsx';
import { RES, RK } from '../data/constants.js';
import { issues, openIssues, kpis, KPI_TARGETS } from '../lib/engine.js';
import { f0, f1, money, dt, pct } from '../lib/format.js';
import { exportXlsx } from '../lib/files.js';
import { Page, Card, Btn, Pill, Table, Stats } from '../ui.jsx';
import { KpiBoard } from './Shared.jsx';

export function Cycle({ go }) {
  const { state } = useStore();
  const all = issues(state), open = openIssues(state);
  const released = state.period.status === 'released';
  const paidNow = state.accounts.filter((a) => a.pay[11] !== 'none').length;
  const steps = [
    { t: 'Загрузка начислений', d: `${RK.filter((r) => state.uploads.some((u) => u.res === r && u.period === '2026-09')).length} из 4 поставщиков`, done: true },
    { t: 'ИИ-сверка', d: `${all.length} расхождений найдено`, done: true },
    { t: 'Решения оператора', d: open.length ? `${open.length} открыто` : 'всё разобрано', done: open.length === 0, now: open.length > 0 },
    { t: 'Выпуск квитанций', d: released ? dt(state.period.releasedAt) : 'ожидает', done: released, now: !released && open.length === 0 },
    { t: 'Оплаты за сентябрь', d: `${paidNow} из ${state.accounts.length}`, done: false, now: released },
  ];
  return (
    <Page title="Расчётный цикл · сентябрь 2026" lead="Где сейчас период: кто загрузил данные, сколько расхождений открыто, выпущены ли квитанции.">
      <div className="steps">{steps.map((s, i) => <div key={i} className={`step ${s.done ? 'done' : s.now ? 'now' : ''}`}><span className="eyebrow">Шаг {i + 1}</span><b>{s.t}</b><span className="small">{s.d}</span></div>)}</div>
      <Card title="Загрузка начислений поставщиками">
        <Table keyOf={(r) => r} cols={[
          { h: 'Поставщик', r: (r) => state.orgs.find((o) => o.id === RES[r].org).name },
          { h: 'Последняя загрузка', r: (r) => { const u = state.uploads.find((x) => x.res === r); return u ? `${dt(u.at)} · ${u.file}` : '—'; } },
          { h: 'Принято', num: true, r: (r) => f0(state.uploads.find((x) => x.res === r)?.accepted || 0) },
          { h: 'Открытых расхождений', num: true, r: (r) => { const n = open.filter((i) => i.res === r || (r === 'heat' && i.type === 'area')).length; return n ? <Pill kind="warn">{n}</Pill> : <Pill kind="ok">0</Pill>; } },
          { h: 'Статус', r: (r) => (state.uploads.some((u) => u.res === r && u.period === '2026-09') ? <Pill kind="ok">загружено</Pill> : <Pill kind="bad">нет данных</Pill>) },
        ]} rows={RK} />
      </Card>
      <Card title="Последние изменения тарифов">
        <Table keyOf={(t) => t.r + t.from} empty="Изменений нет" cols={[{ h: 'Ресурс', r: (t) => RES[t.r].name }, { h: 'Тариф', num: true, r: (t) => `${f1(t.value)} ₸` }, { h: 'С', r: (t) => t.from }, { h: 'Основание', r: (t) => t.order }, { h: 'Внёс', r: (t) => `${t.by} · ${dt(t.at)}` }]}
          rows={RK.flatMap((r) => state.tariffs[r].slice(1).map((t) => ({ ...t, r })))} />
      </Card>
      <div className="btns"><Btn onClick={() => go('kpi')}>Открыть KPI пилота</Btn></div>
    </Page>
  );
}

export function KpiPage() {
  const { state } = useStore();
  const k = kpis(state);
  const exp = () => exportXlsx('esepshy_kpi_2026-09.xlsx', {
    'KPI': KPI_TARGETS.map((t) => ({ 'Показатель': t.name, 'База': t.base(k), 'Сейчас': t.val(k), 'Цель': t.goal, 'Статус': t.ok(k) ? 'в цели' : 'ниже цели' })),
    'Потери': RK.map((r) => ({ 'Ресурс': RES[r].name, 'База, %': +(k.res[r].baseL * 100).toFixed(2), 'Сейчас, %': +(k.res[r].curL * 100).toFixed(2), 'Потери в месяц, ₸': Math.round(k.res[r].lossMoney) })),
  });
  return (
    <Page title="KPI пилота" lead="Показатели из задач акимата против целей. Значения пересчитываются после каждого решения операторов, поставщиков и инспекторов." actions={<Btn onClick={exp}>Выгрузить в Excel</Btn>}>
      <KpiBoard state={state} />
    </Page>
  );
}

export function Team() {
  const { state } = useStore();
  const ops = state.users.filter((u) => u.role === 'operator');
  const decs = Object.values(state.decisions);
  const detected = new Date('2026-10-05T10:05:00Z').getTime();
  const rows = ops.map((u) => {
    const mine = decs.filter((d) => d.userId === u.id);
    const hrs = mine.length ? mine.reduce((s, d) => s + (new Date(d.at).getTime() - detected), 0) / mine.length / 36e5 : 0;
    return { u, fixed: mine.filter((d) => d.status === 'fixed').length, fp: mine.filter((d) => d.status === 'false').length, sum: mine.filter((d) => d.status === 'fixed').reduce((s, d) => s + d.snap.amount, 0), compl: state.complaints.filter((c) => c.by === u.name).length, hrs };
  });
  return (
    <Page title="Нагрузка операторов" lead="Сколько расхождений и обращений разобрал каждый оператор и как быстро от момента сверки.">
      <Card><Stats items={[{ v: openIssues(state).length, l: 'в очереди' }, { v: state.complaints.filter((c) => c.status === 'open').length, l: 'обращений ждут ответа' }, { v: state.corrections.filter((c) => c.status === 'disputed').length, l: 'возражений поставщиков' }]} /></Card>
      <Table keyOf={(r) => r.u.id} cols={[
        { h: 'Оператор', r: (r) => r.u.name }, { h: 'Исправлено', num: true, r: (r) => r.fixed }, { h: 'Отклонено', num: true, r: (r) => r.fp },
        { h: 'Сумма корректировок', num: true, r: (r) => money(r.sum) }, { h: 'Ответов жителям', num: true, r: (r) => r.compl },
        { h: 'Среднее время решения', num: true, r: (r) => (r.fixed + r.fp ? `${f1(r.hrs / 24)} дн.` : '—') },
      ]} rows={rows} />
    </Page>
  );
}
