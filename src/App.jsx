import React, { useEffect, useState } from 'react';
import { useStore } from './store.jsx';
import { ROLES } from './data/constants.js';
import { openIssues, openAnomalies } from './lib/engine.js';
import Login, { Gauge, ChangePassword } from './pages/Login.jsx';
import { Modal } from './ui.jsx';
import { IDLE_MS } from './lib/auth.js';
import * as Res from './pages/Resident.jsx';
import * as Sup from './pages/Supplier.jsx';
import * as Osi from './pages/Osi.jsx';
import * as Insp from './pages/Inspector.jsx';
import * as Op from './pages/Operator.jsx';
import * as Debt from './pages/Debt.jsx';
import * as Head from './pages/Head.jsx';
import * as Adm from './pages/Admin.jsx';
import * as Ak from './pages/Akimat.jsx';
import * as Au from './pages/Auditor.jsx';

const NAV = {
  resident: [
    ['bill', 'Квитанция', 'Ж-2', Res.Bill], ['readings', 'Показания', 'Ж-3', Res.Readings], ['pay', 'Оплата', 'Ж-4', Res.Pay],
    ['disputes', 'Обращения', 'Ж-5', Res.Disputes], ['history', 'История', 'Ж-6', Res.History],
  ],
  supplier: [
    ['uploads', 'Загрузка начислений', 'П-1', Sup.Uploads], ['tariffs', 'Тарифы', 'П-2', Sup.Tariffs],
    ['corrections', 'Корректировки', 'П-3', Sup.Corrections, (s, u) => s.corrections.filter((c) => c.org === u.org && c.status === 'pending').length],
    ['anomalies', 'Аномалии учёта', 'П-4', Sup.Anomalies, (s, u) => openAnomalies(s).filter((a) => a.res === s.orgs.find((o) => o.id === u.org)?.res && a.status === 'open').length],
    ['requests', 'Заявки на устранение', 'И-3', Sup.Requests, (s, u) => s.requests.filter((r) => r.to === u.org && r.status === 'new').length],
  ],
  osi: [
    ['houses', 'Мои дома', 'О-3', Osi.Houses], ['odpu', 'Общедомовые счётчики', 'О-2', Osi.Odpu], ['fees', 'Взносы ОСИ', 'О-1', Osi.Fees],
    ['debtors', 'Должники', 'О-4', Osi.Debtors], ['requests', 'Заявки на устранение', 'И-3', Sup.Requests, (s, u) => s.requests.filter((r) => r.to === u.org && r.status === 'new').length],
  ],
  inspector: [['visits', 'Мои выезды', 'И-1', Insp.Visits, (s, u) => s.visits.filter((v) => v.inspector === u.id && v.status === 'assigned').length]],
  operator: [
    ['queue', 'Очередь сверки', 'Оп-1', Op.Queue, (s) => openIssues(s).length],
    ['objections', 'Возражения поставщиков', 'П-3', Op.Objections, (s) => s.corrections.filter((c) => c.status === 'disputed').length],
    ['complaints', 'Жалобы жителей', 'Оп-3', Op.Complaints, (s) => s.complaints.filter((c) => c.status === 'open').length],
    ['release', 'Выпуск квитанций', 'Оп-4', Op.Release],
  ],
  debt: [['work', 'Работа с должниками', 'Д-1…3', Debt.Work], ['report', 'Результаты', 'Д-4', Debt.Report]],
  head: [['cycle', 'Расчётный цикл', 'Р-1', Head.Cycle], ['kpi', 'KPI пилота', 'Р-2', Head.KpiPage], ['team', 'Нагрузка операторов', 'Р-3', Head.Team]],
  admin: [['users', 'Организации и пользователи', 'А-1, А-2', Adm.Users], ['dicts', 'Справочники', 'А-3', Adm.Dicts], ['integrations', 'Интеграции', 'А-4', Adm.Integrations]],
  akimat: [['summary', 'Сводка пилота', 'Ак-1, Ак-4', Ak.Summary], ['houses', 'Дома', 'Ак-2', Ak.Houses], ['report', 'Отчёт для акима', 'Ак-3', Ak.Report]],
  auditor: [['journal', 'Журнал действий', 'Ау-1', Au.Journal], ['trace', 'Цепочка корректировки', 'Ау-2', Au.Trace]],
};

function useHashPage(def) {
  const read = () => location.hash.replace(/^#\/?/, '') || def;
  const [p, setP] = useState(read);
  useEffect(() => { const h = () => setP(read()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); });
  const go = (x) => { location.hash = `/${x}`; setP(x); window.scrollTo(0, 0); };
  return [p, go];
}

export default function App() {
  const { user, state, session, logout, touch, reset, roleName } = useStore();
  const items = user ? NAV[user.role] : [];
  const [page, go] = useHashPage(items[0]?.[0] || '');
  const [pwd, setPwd] = useState(false);
  useEffect(() => {
    if (!session) return undefined;
    const ev = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    ev.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const t = setInterval(() => { if (Date.now() - session.last > IDLE_MS) logout('Сессия завершена после 30 минут бездействия'); }, 15000);
    return () => { ev.forEach((e) => window.removeEventListener(e, touch)); clearInterval(t); };
  });
  if (!user) return <Login />;
  if (user.mustChange) return <ChangePassword forced />;
  const cur = items.find((i) => i[0] === page) || items[0];
  const Comp = cur[3];
  const org = state.orgs.find((o) => o.id === user.org);
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><div className="brand-mark"><Gauge /></div><div><b>Esepshy</b><small>ЕРЦ ЖКХ · мкр «Самал-2»</small></div></div>
        <div className="who"><b>{user.name}</b><span>{roleName(user.role)}</span>{org && <span>{org.name}</span>}</div>
        <nav className="nav" aria-label="Разделы">
          {items.map(([k, label, code, , badge]) => {
            const n = badge ? badge(state, user) : 0;
            return (
              <button key={k} type="button" aria-current={cur[0] === k ? 'page' : undefined} onClick={() => go(k)}>
                <span>{label}</span>{n > 0 ? <span className="pill bad">{n}</span> : <span className="code">{code}</span>}
              </button>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className="testbar">Тестовая версия · демо-данные</div>
          {user.role !== 'resident' && <button type="button" onClick={() => setPwd(true)}>Сменить пароль</button>}
          <button type="button" onClick={() => { logout(); location.hash = ''; }}>Выйти</button>
          <button type="button" onClick={() => { if (window.confirm('Сбросить все изменения и вернуть демо-данные к исходным?')) reset(); }}>Сбросить демо</button>
        </div>
      </aside>
      <main><Comp go={go} key={`${user.id}-${cur[0]}`} /></main>
      {pwd && <Modal title="Смена пароля" onClose={() => setPwd(false)}><ChangePassword onDone={() => setPwd(false)} /></Modal>}
    </div>
  );
}

export const ROLE_LIST = ROLES;
