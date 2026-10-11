import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { RES, RK } from '../data/constants.js';
import { kpis, KPI_TARGETS, bldStats, openAnomalies } from '../lib/engine.js';
import { pct, money, f0 } from '../lib/format.js';
import { exportXlsx, printHtml } from '../lib/files.js';
import { Page, Card, Btn, Pill, Table, Seg, Note, Stats } from '../ui.jsx';
import { KpiBoard, HouseCard } from './Shared.jsx';

export function Summary() {
  const { state } = useStore();
  const k = kpis(state);
  return (
    <Page title="Сводка пилота Esepshy" lead="Мкр «Самал-2»: 12 домов. Данные по домам и районам, без ФИО и номеров лицевых счетов.">
      <KpiBoard state={state} />
      <Card title="До пилота и сейчас">
        <Table keyOf={(t) => t.id} cols={[
          { h: 'Показатель', r: (t) => t.name }, { h: 'База', num: true, r: (t) => t.base(k) }, { h: 'Сейчас', num: true, r: (t) => t.val(k) },
          { h: 'Цель', num: true, r: (t) => t.goal }, { h: 'Статус', r: (t) => <Pill kind={t.ok(k) ? 'ok' : 'warn'}>{t.ok(k) ? 'в цели' : 'ниже цели'}</Pill> },
        ]} rows={KPI_TARGETS} />
        <Note>База потерь — октябрь–декабрь 2025 (для отопления — начало сезона), текущее значение — последний квартал. Охват умными счётчиками растёт по мере установки, база равна текущему охвату на старте пилота.</Note>
      </Card>
    </Page>
  );
}

export function Houses() {
  const { state } = useStore();
  const [sort, setSort] = useState('loss');
  const [sel, setSel] = useState(null);
  const an = openAnomalies(state);
  const worst = (b) => { const st = bldStats(state, b); return Math.max(...Object.entries(st.res).map(([r, v]) => v.loss / RES[r].thr)); };
  const rows = [...state.buildings].sort((a, b) => sort === 'loss' ? worst(b) - worst(a) : sort === 'debt' ? bldStats(state, b).debt - bldStats(state, a).debt : bldStats(state, a).paid - bldStats(state, b).paid);
  if (sel != null) return <Page title="Карточка дома" actions={<Btn onClick={() => setSel(null)}>← Все дома</Btn>}><HouseCard state={state} b={state.buildings[sel]} pii={false} /></Page>;
  return (
    <Page title="Дома пилота" lead="Сортируйте по потерям, долгу или доле оплат и откройте карточку дома. Персональные данные жителей не показываются.">
      <Seg value={sort} onChange={setSort} items={[['loss', 'По потерям'], ['debt', 'По долгу'], ['paid', 'По доле оплат']]} />
      <Table keyOf={(b) => b.id} onRow={(b) => setSel(b.id)} cols={[
        { h: 'Дом', r: (b) => b.name },
        ...RK.map((r) => ({ h: RES[r].short, num: true, r: (b) => { const v = bldStats(state, b).res[r]; return v ? <Pill kind={v.loss > RES[r].thr ? 'bad' : 'ok'}>{pct(v.loss)}</Pill> : '—'; } })),
        { h: 'Оплатили', num: true, r: (b) => pct(bldStats(state, b).paid) },
        { h: 'Долг', num: true, r: (b) => money(bldStats(state, b).debt) },
        { h: 'Аномалий', num: true, r: (b) => an.filter((x) => x.bld === b.id).length },
      ]} rows={rows} />
    </Page>
  );
}

export function Report() {
  const { state, act } = useStore();
  const k = kpis(state);
  const houses = state.buildings.map((b) => { const st = bldStats(state, b); return { b, st }; });
  const excel = () => {
    exportXlsx('esepshy_otchet_akimat_2026-09.xlsx', {
      'KPI': KPI_TARGETS.map((t) => ({ 'Показатель': t.name, 'База': t.base(k), 'Сейчас': t.val(k), 'Цель': t.goal, 'Статус': t.ok(k) ? 'в цели' : 'ниже цели' })),
      'Дома': houses.map(({ b, st }) => ({ 'Дом': b.name, 'Квартир': st.n, 'Оплатили, %': +(st.paid * 100).toFixed(1), 'Долг, ₸': Math.round(st.debt), ...Object.fromEntries(Object.entries(st.res).map(([r, v]) => [`Потери ${RES[r].short}, %`, +(v.loss * 100).toFixed(1)])) })),
    });
    act('Выгрузка отчёта', 'Отчёт для акима', 'Excel, сентябрь 2026');
  };
  const pdf = () => {
    const html = `<h1>Пилот Esepshy · отчёт за сентябрь 2026</h1><p class="muted">Мкр «Самал-2», 12 домов, ${state.accounts.length} лицевых счетов. Сформировано ${new Date().toLocaleString('ru-RU')}. Демо-данные.</p>
      <h2>Показатели пилота</h2><table><tr><th>Показатель</th><th>База</th><th>Сейчас</th><th>Цель</th><th>Статус</th></tr>${KPI_TARGETS.map((t) => `<tr><td>${t.name}</td><td class="r">${t.base(k)}</td><td class="r">${t.val(k)}</td><td class="r">${t.goal}</td><td>${t.ok(k) ? 'в цели' : 'ниже цели'}</td></tr>`).join('')}</table>
      <h2>Дома</h2><table><tr><th>Дом</th><th>Оплатили</th><th>Долг</th>${RK.map((r) => `<th>Потери: ${RES[r].short}</th>`).join('')}</tr>${houses.map(({ b, st }) => `<tr><td>${b.name}</td><td class="r">${pct(st.paid)}</td><td class="r">${money(st.debt)}</td>${RK.map((r) => `<td class="r">${st.res[r] ? pct(st.res[r].loss) : '—'}</td>`).join('')}</tr>`).join('')}</table>
      <p class="muted">Персональные данные жителей в отчёт не включаются.</p>`;
    printHtml('Отчёт Esepshy', html);
    act('Выгрузка отчёта', 'Отчёт для акима', 'PDF, сентябрь 2026');
  };
  return (
    <Page title="Отчёт для акима" lead="Отчёт формируется из данных платформы за минуты, без ручной сводки.">
      <Card title="Сентябрь 2026">
        <Stats items={[{ v: pct(k.online), l: 'онлайн-платежи' }, { v: f0(k.err), l: 'ошибок на 1 000 счетов' }, { v: money(k.debt), l: 'задолженность' }, { v: money(RK.reduce((s, r) => s + k.res[r].lossMoney, 0)), l: 'потери ресурсов в месяц' }]} />
        <div className="btns" style={{ marginTop: 14 }}><Btn kind="pri" onClick={excel}>Скачать Excel</Btn><Btn onClick={pdf}>Сохранить PDF</Btn></div>
        <Note>Для PDF откроется окно печати: выберите «Сохранить как PDF».</Note>
      </Card>
    </Page>
  );
}
