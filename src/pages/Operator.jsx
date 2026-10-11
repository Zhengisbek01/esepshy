import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { RES, RK, ISSUE_TYPES } from '../data/constants.js';
import { issues, openIssues, errPer1000, applyFix, undoFix, addr, billFor, kpis } from '../lib/engine.js';
import { f0, f1, money, dt, uid } from '../lib/format.js';
import { Page, Card, Btn, Pill, Table, Modal, Field, Note, Stats, Tag, Chips, Conf, Empty } from '../ui.jsx';
import { BillView } from './Shared.jsx';

const FALSE_REASONS = ['Начисление верное, модель ошиблась', 'Счётчик не прошёл поверку', 'Площадь подтверждена техпаспортом', 'Платёж относится к другому ЛС', 'Другое'];

export function useFix() {
  const { state, user, act, toast } = useStore();
  return (it, silent) => {
    const a = state.accounts.find((x) => x.id === it.acc);
    act('Корректировка начисления', `ЛС ${it.acc}`, `${ISSUE_TYPES[it.type].label}, ${money(it.amount)}`, (d) => {
      const live = issues(d).find((x) => x.key === it.key && x.status === 'open');
      if (!live) return false;
      const snap = { type: it.type, acc: it.acc, res: it.res, org: it.org, text: it.text, amount: it.amount, conf: it.conf };
      const undo = applyFix(d, live);
      const at = new Date().toISOString();
      d.decisions[it.key] = { status: 'fixed', by: user.name, userId: user.id, at, snap, undo };
      if (it.org !== 'erc') d.corrections.unshift({ id: uid('cr'), key: it.key, type: it.type, acc: it.acc, address: addr(d, a), res: it.res, org: it.org, text: it.text, amount: it.amount, by: user.name, at, status: 'pending' });
    });
    if (!silent) toast(`Корректировка по ЛС ${it.acc} отправлена ${it.org === 'erc' ? 'в учёт' : 'поставщику'}`);
  };
}

export function Queue() {
  const { state, user, act, toast } = useStore();
  const fix = useFix();
  const [f, setF] = useState('open');
  const [fp, setFp] = useState(null);
  const [reason, setReason] = useState(FALSE_REASONS[0]);
  const [view, setView] = useState(null);
  const all = issues(state);
  const list = all.filter((i) => (f === 'open' ? i.status === 'open' : f === 'done' ? i.status !== 'open' : i.type === f && i.status === 'open'));
  const fixed = all.filter((i) => i.status === 'fixed');
  const counts = {}; openIssues(state).forEach((i) => { counts[i.type] = (counts[i.type] || 0) + 1; });
  const markFalse = () => {
    act('Ложное срабатывание', `ЛС ${fp.acc}`, `${ISSUE_TYPES[fp.type].label}: ${reason}`, (d) => {
      d.decisions[fp.key] = { status: 'false', by: user.name, userId: user.id, at: new Date().toISOString(), reason, snap: { type: fp.type, acc: fp.acc, res: fp.res, org: fp.org, text: fp.text, amount: fp.amount, conf: fp.conf } };
    });
    setFp(null); toast('Отмечено как ложное. Случай ушёл в выборку для дообучения модели');
  };
  return (
    <Page title="Очередь ИИ-сверки" lead="Модель сверяет начисления поставщиков с показаниями, утверждёнными тарифами, реестром недвижимости и банковскими платежами. Решение по каждому расхождению — за оператором.">
      <Card>
        <Stats items={[
          { v: openIssues(state).length, l: 'открыто' },
          { v: f1(errPer1000(state)), l: 'ошибок на 1 000 счетов (цель ≤ 5)', color: errPer1000(state) <= 5 ? 'var(--good)' : 'var(--warn)' },
          { v: money(fixed.reduce((s, i) => s + i.amount, 0)), l: 'скорректировано' },
          { v: all.filter((i) => i.status === 'false').length, l: 'ложных срабатываний' },
          { v: state.accounts.length, l: 'квитанций проверено' },
        ]} />
      </Card>
      <Chips value={f} onChange={setF} items={[['open', 'Все открытые', openIssues(state).length], ...Object.entries(ISSUE_TYPES).filter(([k]) => k !== 'upload').map(([k, v]) => [k, v.label, counts[k] || 0]), ['done', 'Решённые', all.length - openIssues(state).length]]} />
      <Table keyOf={(i) => i.key} rowClass={(i) => (i.status !== 'open' ? 'done' : '')} empty={f === 'open' ? 'Открытых расхождений нет. Можно выпускать квитанции.' : 'Нет записей'} cols={[
        { h: 'ЛС / адрес', r: (i) => { const a = state.accounts.find((x) => x.id === i.acc); return <><button type="button" className="btn ghost sm mono" onClick={() => setView(a)}>{i.acc}</button><span className="sub">{addr(state, a)}</span></>; } },
        { h: 'Тип', r: (i) => <><Tag>{ISSUE_TYPES[i.type].label}</Tag><span className="sub">{state.orgs.find((o) => o.id === i.org)?.name}</span></> },
        { h: 'Что нашла модель', r: (i) => <span className="desc">{i.text}</span> },
        { h: 'Сумма', num: true, r: (i) => money(i.amount) },
        { h: 'Уверенность', r: (i) => <Conf v={i.conf} /> },
        { h: 'Решение', r: (i) => (i.status === 'open' ? <div className="btns"><Btn small kind="pri" onClick={() => fix(i)}>Скорректировать</Btn><Btn small onClick={() => { setFp(i); setReason(FALSE_REASONS[0]); }}>Ложное</Btn></div>
          : <><Pill kind={i.status === 'fixed' ? 'ok' : 'neutral'}>{i.status === 'fixed' ? 'исправлено' : 'отклонено'}</Pill><span className="sub">{i.decidedBy} · {dt(i.decidedAt)}{i.reason ? ` · ${i.reason}` : ''}</span></>) },
      ]} rows={list} />
      {fp && (
        <Modal title="Ложное срабатывание" onClose={() => setFp(null)}>
          <p className="small" style={{ margin: 0 }}>{fp.text}</p>
          <div className="radio-list">{FALSE_REASONS.map((r) => <label key={r}><input type="radio" name="fr" checked={reason === r} onChange={() => setReason(r)} /> {r}</label>)}</div>
          <Note>Отклонённые случаи не входят в показатель ошибок и попадают в выборку для дообучения модели.</Note>
          <div className="btns"><Btn kind="pri" onClick={markFalse}>Отклонить расхождение</Btn></div>
        </Modal>
      )}
      {view && <Modal title={`ЛС ${view.id} · ${view.owner}`} onClose={() => setView(null)} wide><BillView state={state} acc={view} m={11} /></Modal>}
    </Page>
  );
}

export function Objections() {
  const { state, user, act, toast } = useStore();
  const list = state.corrections.filter((c) => c.status === 'disputed' || c.status === 'upheld' || c.status === 'reverted');
  const uphold = (c) => { act('Возражение отклонено', `ЛС ${c.acc}`, 'Корректировка оставлена в силе', (d) => { const x = d.corrections.find((y) => y.id === c.id); x.status = 'upheld'; x.resolvedBy = user.name; x.resolvedAt = new Date().toISOString(); }); toast('Корректировка оставлена в силе'); };
  const revert = (c) => {
    act('Корректировка отменена', `ЛС ${c.acc}`, `По возражению поставщика: ${c.objection}`, (d) => {
      const dec = d.decisions[c.key];
      if (dec && dec.status === 'fixed') { undoFix(d, dec); d.decisions[c.key] = { ...dec, status: 'false', reason: 'Отменена по возражению поставщика', at: new Date().toISOString(), by: user.name }; }
      const x = d.corrections.find((y) => y.id === c.id); x.status = 'reverted'; x.resolvedBy = user.name; x.resolvedAt = new Date().toISOString();
    });
    toast('Корректировка отменена, начисление восстановлено');
  };
  return (
    <Page title="Возражения поставщиков" lead="Поставщик не согласился с корректировкой. Оставьте её в силе или отмените — начисление вернётся к исходному.">
      <Table keyOf={(c) => c.id} empty="Возражений нет" cols={[
        { h: 'ЛС', r: (c) => <><span className="mono">{c.acc}</span><span className="sub">{c.address}</span></> },
        { h: 'Корректировка', r: (c) => <><Tag>{ISSUE_TYPES[c.type].label}</Tag><span className="sub desc">{c.text}</span><span className="sub">{money(c.amount)} · {c.by}</span></> },
        { h: 'Возражение', r: (c) => <span className="desc">{c.objection}<span className="sub">{state.orgs.find((o) => o.id === c.org)?.name} · {c.answeredBy}</span></span> },
        { h: '', r: (c) => (c.status === 'disputed' ? <div className="btns"><Btn small kind="pri" onClick={() => uphold(c)}>Оставить</Btn><Btn small kind="danger" onClick={() => revert(c)}>Отменить</Btn></div> : <Pill kind={c.status === 'upheld' ? 'neutral' : 'info'}>{c.status === 'upheld' ? 'оставлена' : 'отменена'}</Pill>) },
      ]} rows={list} />
    </Page>
  );
}

export function Complaints() {
  const { state, user, act, toast } = useStore();
  const fix = useFix();
  const [f, setF] = useState('open');
  const [ans, setAns] = useState(null);
  const [outcome, setOutcome] = useState('fixed');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const list = state.complaints.filter((c) => (f === 'open' ? c.status === 'open' : c.status !== 'open'));
  const related = (c) => openIssues(state).filter((i) => i.acc === c.acc && (c.res === 'osi' ? ['dup', 'area'].includes(i.type) : i.res === c.res || i.type === 'pay'));
  const age = (c) => Math.floor((Date.now() - new Date(c.at).getTime()) / 864e5);
  const answer = () => {
    if (text.trim().length < 10) { setErr('Ответ жителю — не короче 10 символов.'); return; }
    act('Ответ на обращение', `ЛС ${ans.acc}`, `${outcome === 'fixed' ? 'Исправлено' : 'Отказано'}: ${text}`, (d) => { const x = d.complaints.find((y) => y.id === ans.id); Object.assign(x, { status: 'answered', outcome, answer: text, by: user.name, answeredAt: new Date().toISOString() }); });
    setAns(null); setText(''); toast('Ответ отправлен жителю');
  };
  return (
    <Page title="Жалобы жителей" lead="Обращения из кнопки «Не согласен» в квитанции. Срок ответа — 5 рабочих дней.">
      <Chips value={f} onChange={setF} items={[['open', 'Ждут ответа', state.complaints.filter((c) => c.status === 'open').length], ['answered', 'Отвечены', state.complaints.filter((c) => c.status !== 'open').length]]} />
      {list.length === 0 ? <Empty title={f === 'open' ? 'Новых обращений нет' : 'Отвеченных обращений нет'} text="Войдите как житель и нажмите «Не согласен» в квитанции, чтобы увидеть сценарий целиком." /> : (
        <Table keyOf={(c) => c.id} cols={[
          { h: 'Дата', r: (c) => <>{dt(c.at)}{c.status === 'open' && <span className="sub">{age(c) >= 5 ? <Pill kind="bad">срок истёк</Pill> : `${5 - age(c)} дн. на ответ`}</span>}</> },
          { h: 'ЛС', r: (c) => { const a = state.accounts.find((x) => x.id === c.acc); return <><span className="mono">{c.acc}</span><span className="sub">{addr(state, a)}</span></>; } },
          { h: 'Строка и причина', r: (c) => <span className="desc"><b>{c.res === 'osi' ? 'Взносы ОСИ / прочее' : RES[c.res].name}</b>: {c.reasonText}{c.text && <span className="sub">«{c.text}»</span>}</span> },
          { h: 'Фото', r: (c) => (c.photo ? <img src={c.photo} alt="Фото от жителя" className="thumb" /> : '—') },
          { h: 'Модель нашла', r: (c) => { const r = related(c); return r.length ? r.map((i) => <div key={i.key}><Tag tone="accent">{ISSUE_TYPES[i.type].short}</Tag> <span className="small">{money(i.amount)}</span></div>) : <span className="small muted">совпадений нет</span>; } },
          { h: '', r: (c) => (c.status === 'open' ? <Btn small kind="pri" onClick={() => { setAns(c); setOutcome(related(c).length ? 'fixed' : 'denied'); setText(''); setErr(''); }}>Ответить</Btn> : <><Pill kind={c.outcome === 'fixed' ? 'ok' : 'neutral'}>{c.outcome === 'fixed' ? 'исправлено' : 'отказано'}</Pill><span className="sub desc">{c.answer}</span></>) },
        ]} rows={list} />
      )}
      {ans && (
        <Modal title={`Ответ по ЛС ${ans.acc}`} onClose={() => setAns(null)} wide>
          {related(ans).length > 0 && (
            <Card title="Расхождения модели по этому ЛС">
              {related(ans).map((i) => <div key={i.key} className="btns" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span className="small desc">{i.text}</span><Btn small kind="pri" onClick={() => fix(i)}>Скорректировать {money(i.amount)}</Btn></div>)}
            </Card>
          )}
          <div className="radio-list"><label><input type="radio" checked={outcome === 'fixed'} onChange={() => setOutcome('fixed')} /> Начисление исправлено</label><label><input type="radio" checked={outcome === 'denied'} onChange={() => setOutcome('denied')} /> Отказать с объяснением</label></div>
          <Field label="Ответ жителю" error={err}><textarea value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder={outcome === 'fixed' ? 'Начисление пересчитано по показаниям счётчика, разница учтена в квитанции.' : 'Начисление верное: ...'} /></Field>
          <div className="btns"><Btn kind="pri" onClick={answer}>Отправить ответ</Btn></div>
        </Modal>
      )}
    </Page>
  );
}

export function Release() {
  const { state, user, act, toast } = useStore();
  const open = openIssues(state);
  const critical = open.filter((i) => i.conf >= 0.8);
  const uploaded = RK.map((r) => ({ r, up: state.uploads.find((u) => u.res === r && u.period === '2026-09') }));
  const allUp = uploaded.every((x) => x.up);
  const released = state.period.status === 'released';
  const total = state.accounts.reduce((s, a) => s + billFor(state, a, 11).total, 0);
  const ready = allUp && critical.length === 0;
  const release = () => {
    act('Выпуск квитанций', 'Период 2026-09', `${state.accounts.length} квитанций на ${money(total)}; открыто ${open.length} некритичных расхождений`, (d) => { d.period.status = 'released'; d.period.releasedAt = new Date().toISOString(); d.period.releasedBy = user.name; });
    toast('Квитанции за сентябрь выпущены и доступны жителям');
  };
  return (
    <Page title="Выпуск квитанций" lead="Квитанции уходят жителям только после сверки: пока есть открытые расхождения с уверенностью модели от 80%, выпуск закрыт.">
      <div className="steps">
        <div className={`step ${allUp ? 'done' : 'now'}`}><span className="eyebrow">Шаг 1</span><b>Начисления загружены</b><span className="small">{uploaded.filter((x) => x.up).length} из 4 поставщиков</span></div>
        <div className={`step ${critical.length ? 'now' : 'done'}`}><span className="eyebrow">Шаг 2</span><b>Критичные расхождения</b><span className="small">{critical.length ? `${critical.length} открыто` : 'нет'}</span></div>
        <div className={`step ${released ? 'done' : ready ? 'now' : ''}`}><span className="eyebrow">Шаг 3</span><b>Выпуск</b><span className="small">{released ? dt(state.period.releasedAt) : ready ? 'можно выпускать' : 'ожидает'}</span></div>
      </div>
      <Card>
        <Stats items={[{ v: state.accounts.length, l: 'квитанций' }, { v: money(total), l: 'начислено за сентябрь' }, { v: open.length, l: 'открытых расхождений' }, { v: critical.length, l: 'из них критичных', color: critical.length ? 'var(--bad)' : 'var(--good)' }]} />
        <div className="btns" style={{ marginTop: 14 }}>
          {released ? <Pill kind="ok">Квитанции выпущены {dt(state.period.releasedAt)} · {state.period.releasedBy}</Pill> : <Btn kind="pri" onClick={release} disabled={!ready}>Выпустить квитанции за сентябрь</Btn>}
          {!released && !ready && <span className="small muted">Закройте критичные расхождения в очереди сверки.</span>}
        </div>
      </Card>
      {!released && critical.length > 0 && (
        <Table keyOf={(i) => i.key} cols={[{ h: 'ЛС', r: (i) => <span className="mono">{i.acc}</span> }, { h: 'Тип', r: (i) => <Tag>{ISSUE_TYPES[i.type].label}</Tag> }, { h: 'Уверенность', r: (i) => <Conf v={i.conf} /> }, { h: 'Сумма', num: true, r: (i) => money(i.amount) }]} rows={critical} />
      )}
    </Page>
  );
}
