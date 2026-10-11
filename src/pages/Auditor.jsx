import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { ROLES, RES, ISSUE_TYPES } from '../data/constants.js';
import { issues, billFor } from '../lib/engine.js';
import { money, dt, f0 } from '../lib/format.js';
import { exportXlsx } from '../lib/files.js';
import { Page, Card, Btn, Table, Field, Tag, Pill, Empty } from '../ui.jsx';

export function Journal() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');
  const actions = useMemo(() => [...new Set(state.audit.map((a) => a.action))].sort(), [state.audit]);
  const list = state.audit.filter((a) => (!role || a.role === role) && (!action || a.action === action) && (!q || `${a.user} ${a.object} ${a.details}`.toLowerCase().includes(q.toLowerCase())));
  const exp = () => exportXlsx('esepshy_journal.xlsx', { 'Журнал': list.map((a) => ({ 'Время': dt(a.at), 'Пользователь': a.user, 'Роль': ROLES[a.role]?.name || a.role, 'Действие': a.action, 'Объект': a.object, 'Подробности': a.details })) });
  return (
    <Page title="Журнал действий" lead="Каждое изменение начислений, тарифов, ролей и доступа. Журнал нельзя изменить из интерфейса." actions={<Btn onClick={exp}>Выгрузить в Excel</Btn>}>
      <div className="row">
        <Field label="Поиск"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ЛС, пользователь, объект" /></Field>
        <Field label="Роль"><select value={role} onChange={(e) => setRole(e.target.value)}><option value="">Все роли</option>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}<option value="system">Система</option></select></Field>
        <Field label="Действие"><select value={action} onChange={(e) => setAction(e.target.value)}><option value="">Все действия</option>{actions.map((a) => <option key={a}>{a}</option>)}</select></Field>
      </div>
      <Table keyOf={(a) => a.id} cols={[
        { h: 'Время', r: (a) => <span className="mono small">{dt(a.at)}</span> },
        { h: 'Пользователь', r: (a) => <>{a.user}<span className="sub">{ROLES[a.role]?.name || 'система'}</span></> },
        { h: 'Действие', r: (a) => <Tag>{a.action}</Tag> }, { h: 'Объект', r: (a) => a.object },
        { h: 'Подробности', r: (a) => <span className="desc">{a.details}</span> },
      ]} rows={list.slice(0, 300)} />
      {list.length > 300 && <p className="small muted">Показаны 300 последних записей из {list.length}. Полный список — в выгрузке.</p>}
    </Page>
  );
}

export function Trace() {
  const { state } = useStore();
  const decided = issues(state).filter((i) => i.status !== 'open');
  const [sel, setSel] = useState(decided[0]?.key);
  const it = decided.find((i) => i.key === sel);
  if (!decided.length) return <Page title="Цепочка корректировки"><Empty title="Решённых расхождений пока нет" text="Цепочка появится после первого решения оператора в очереди сверки." /></Page>;
  const corr = it && state.corrections.find((c) => c.key === it.key);
  const a = it && state.accounts.find((x) => x.id === it.acc);
  const line = it && it.res && state.charges[a.id].lines[it.res];
  const steps = it ? [
    { t: 'Находка модели', d: `${ISSUE_TYPES[it.type].label}: ${it.text}`, at: '2026-10-05T10:05:00.000Z', on: true },
    { t: 'Решение оператора', d: it.status === 'fixed' ? `Скорректировано на ${money(it.amount)}` : `Отклонено: ${it.reason}`, at: it.decidedAt, who: it.decidedBy, on: true },
    corr ? { t: 'Ответ поставщика', d: corr.status === 'pending' ? 'Ждёт ответа' : corr.status === 'accepted' ? 'Принято к учёту' : `Возражение: ${corr.objection}`, at: corr.answeredAt, who: corr.answeredBy, on: corr.status !== 'pending' } : null,
    corr && (corr.status === 'upheld' || corr.status === 'reverted') ? { t: 'Решение по возражению', d: corr.status === 'upheld' ? 'Корректировка оставлена' : 'Корректировка отменена', at: corr.resolvedAt, who: corr.resolvedBy, on: true } : null,
    { t: 'Итог в квитанции', d: line ? `${RES[it.res].name}: ${f0(line.qty)} ${RES[it.res].unit} × ${line.tariff} ₸ = ${money(line.sum)}; квитанция ${money(billFor(state, a, 11).total)}` : `Квитанция ${money(billFor(state, a, 11).total)}, долг ${money(a.debt)}`, on: true },
  ].filter(Boolean) : [];
  return (
    <Page title="Цепочка корректировки" lead="Выберите корректировку, чтобы увидеть путь от находки модели до итоговой суммы в квитанции.">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
        <Table keyOf={(i) => i.key} onRow={(i) => setSel(i.key)} rowClass={(i) => (i.key === sel ? 'sel' : '')} cols={[
          { h: 'ЛС', r: (i) => <span className="mono">{i.acc}</span> }, { h: 'Тип', r: (i) => <Tag>{ISSUE_TYPES[i.type].short}</Tag> },
          { h: 'Решение', r: (i) => <Pill kind={i.status === 'fixed' ? 'ok' : 'neutral'}>{i.status === 'fixed' ? 'исправлено' : 'отклонено'}</Pill> }, { h: 'Сумма', num: true, r: (i) => money(i.amount) },
        ]} rows={decided} />
        {it && (
          <Card title={`ЛС ${it.acc}`} aside={state.buildings[a.bld].name}>
            <div className="timeline">{steps.map((s, i) => (
              <div className="tl-item" key={i}><span className={`tl-dot ${s.on ? '' : 'off'}`} /><div><b>{s.t}</b><div className="small">{s.d}</div>{(s.at || s.who) && <div className="small muted">{s.who ? `${s.who} · ` : ''}{dt(s.at)}</div>}</div></div>
            ))}</div>
          </Card>
        )}
      </div>
    </Page>
  );
}
