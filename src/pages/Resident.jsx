import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { RES, RK, CUR, MONTHS, ISSUE_TYPES } from '../data/constants.js';
import { billFor, billedPeriod, toPay, addr, normQty, issues } from '../lib/engine.js';
import { f0, f1, money, dt, uid, hash } from '../lib/format.js';
import { imageToDataUrl } from '../lib/files.js';
import { Page, Card, Btn, Pill, Table, Modal, Field, Note, Stats, Empty, useLocal, Tag } from '../ui.jsx';
import { BillView, AccPicker } from './Shared.jsx';

function useAcc() {
  const { state, user } = useStore();
  const [sel, setSel] = useLocal(`esepshy-acc-${user.iin}`, user.accounts[0]);
  const id = user.accounts.includes(sel) ? sel : user.accounts[0];
  return [state.accounts.find((a) => a.id === id), setSel, user.accounts];
}
export const plainPrev = (a, r) => Math.round((r === 'el' ? 4000 : r === 'water' ? 300 : 900) + hash(`${a.id}${r}`) * (r === 'el' ? 9000 : 700));

export function Bill({ go }) {
  const { state } = useStore();
  const [acc, setAcc, ids] = useAcc();
  const [dispute, setDispute] = useState(null);
  const m = billedPeriod(state);
  const due = toPay(state, acc);
  const released = state.period.status === 'released';
  return (
    <Page title="Квитанция" lead={released ? 'Квитанция за сентябрь выпущена после сверки начислений.' : 'Квитанция за сентябрь проходит ИИ-сверку. Пока показана квитанция за август.'}
      actions={<AccPicker state={state} ids={ids} value={acc.id} onChange={setAcc} />}>
      <Card>
        <Stats items={[
          { v: money(due), l: 'к оплате сейчас', color: due > 0 && acc.debt > 0 ? 'var(--bad)' : undefined },
          { v: money(acc.debt), l: 'долг прошлых периодов' },
          { v: released ? 'до 25.10.2026' : 'после выпуска', l: 'срок оплаты' },
          { v: released && acc.paidCur > 0 ? money(acc.paidCur) : '—', l: 'оплачено за сентябрь' },
        ]} />
        <div className="btns" style={{ marginTop: 14 }}>
          {due > 0 ? <Btn kind="pri" onClick={() => go('pay')}>Оплатить {money(due)}</Btn> : <Pill kind="ok">Задолженности нет</Pill>}
          <Btn onClick={() => go('readings')}>Передать показания</Btn>
        </div>
      </Card>
      <BillView state={state} acc={acc} m={m} onDispute={(res) => setDispute(res)} />
      {dispute && <Modal title="Обращение по начислению" onClose={() => setDispute(null)}><DisputeForm acc={acc} res={dispute} onDone={() => { setDispute(null); go('disputes'); }} /></Modal>}
    </Page>
  );
}

export function Readings() {
  const { state, act, toast } = useStore();
  const [acc, setAcc, ids] = useAcc();
  const [vals, setVals] = useState({});
  const [errs, setErrs] = useState({});
  const [confirm, setConfirm] = useState({});
  const released = state.period.status === 'released';
  const meters = RK.filter((r) => acc.has[r] && r !== 'heat');
  const submit = (r) => {
    const sub = state.readings[acc.id]?.[r];
    const prev = sub ? sub.prev : plainPrev(acc, r);
    const v = Number(String(vals[r] || '').replace(',', '.'));
    if (!vals[r] || Number.isNaN(v)) { setErrs({ ...errs, [r]: 'Введите показание числом.' }); return; }
    if (v < prev) { setErrs({ ...errs, [r]: `Показание не может быть меньше предыдущего (${f0(prev)}).` }); return; }
    const qty = v - prev, nq = normQty(acc, r, CUR);
    if (qty > nq * 3 && !confirm[r]) { setErrs({ ...errs, [r]: `Расход ${f1(qty)} ${RES[r].unit} в 3 раза выше обычного. Проверьте и подтвердите ввод.` }); setConfirm({ ...confirm, [r]: 'ask' }); return; }
    act('Передача показаний', `ЛС ${acc.id}`, `${RES[r].name}: ${v} (расход ${f1(qty)} ${RES[r].unit})${released ? ', учтено в следующем периоде' : ''}`, (d) => {
      d.readings[acc.id] = d.readings[acc.id] || {};
      d.readings[acc.id][r] = { prev, value: v, qty, at: new Date().toISOString(), period: released ? '2026-10' : '2026-09' };
      if (!released) { const l = d.charges[acc.id].lines[r]; d.charges[acc.id].lines[r] = { ...l, qty: Math.round(qty * 100) / 100, basis: 'reading', sum: Math.round(qty * l.tariff * 100) / 100 }; }
    });
    setVals({ ...vals, [r]: '' }); setErrs({ ...errs, [r]: '' }); setConfirm({ ...confirm, [r]: null });
    toast(released ? 'Показания сохранены и будут учтены в октябрьской квитанции' : 'Показания приняты, начисление за сентябрь пересчитано');
  };
  return (
    <Page title="Показания счётчиков" lead="Умные счётчики передают показания сами. Обычные счётчики — до 25 числа, иначе начисление идёт по нормативу." actions={<AccPicker state={state} ids={ids} value={acc.id} onChange={setAcc} />}>
      <Table keyOf={(r) => r} cols={[
        { h: 'Счётчик', r: (r) => <span className="resname"><i className="dot" style={{ background: RES[r].color }} />{RES[r].name}</span> },
        { h: 'Тип', r: (r) => (acc.smart[r] ? <Tag tone="accent">умный, автопередача</Tag> : <Tag>обычный</Tag>) },
        { h: 'Предыдущее', num: true, r: (r) => (acc.smart[r] ? f1(acc.meterIdx[r].prev) : f0(state.readings[acc.id]?.[r]?.prev ?? plainPrev(acc, r))) },
        { h: 'Текущее', r: (r) => {
          if (acc.smart[r]) return <span className="mono">{f1(acc.meterIdx[r].cur)} <span className="sub">получено автоматически</span></span>;
          const sub = state.readings[acc.id]?.[r];
          return (
            <div className="form" style={{ gap: 6, minWidth: 220 }}>
              {sub && <span className="small">Передано: <b className="mono">{f0(sub.value)}</b> · {dt(sub.at)}</span>}
              <div className="btns"><input aria-label={`Показание ${RES[r].name}`} inputMode="decimal" style={{ width: 130 }} value={vals[r] || ''} onChange={(e) => { setVals({ ...vals, [r]: e.target.value }); setErrs({ ...errs, [r]: '' }); setConfirm({ ...confirm, [r]: null }); }} placeholder={sub ? 'новое' : 'показание'} />
                <Btn small kind="pri" onClick={() => submit(r)}>{confirm[r] === 'ask' ? 'Подтвердить' : 'Передать'}</Btn></div>
              {errs[r] && <span className="field-e">{errs[r]}</span>}
            </div>
          );
        } },
      ]} rows={meters} />
      <Note>Отопление начисляется по общедомовому счётчику или нормативу на м², отдельные показания не передаются.</Note>
    </Page>
  );
}

export function Pay() {
  const { state, act, toast } = useStore();
  const [acc, setAcc, ids] = useAcc();
  const due = toPay(state, acc);
  const [mode, setMode] = useState('full');
  const [amt, setAmt] = useState('');
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const amount = mode === 'full' ? due : Number(amt);
  const next = () => {
    if (mode === 'part' && (!amount || amount <= 0 || amount > due)) { setErr(`Введите сумму от 1 до ${f0(due)} ₸.`); return; }
    setStep(2);
  };
  const confirmPay = () => {
    const id = uid('pmt');
    act('Оплата онлайн', `ЛС ${acc.id}`, `${money(amount)} через банк-агента (тест)`, (d) => {
      const a = d.accounts.find((x) => x.id === acc.id);
      let rest = amount;
      const toDebt = Math.min(a.debt, rest); a.debt -= toDebt; rest -= toDebt;
      if (d.period.status === 'released') a.paidCur += rest;
      if (a.debt <= 0) { a.debt = 0; for (let m = 0; m < CUR; m++) if (a.pay[m] === 'none') a.pay[m] = 'online'; a.overdue = 0; }
      a.pay[CUR] = 'online';
      a.onlineP = Math.max(a.onlineP, 0.9);
      d.payments.unshift({ id, acc: a.id, amount, channel: 'online', at: new Date().toISOString(), bank: 'Банк-агент (тест)' });
    });
    setDone({ id, amount }); setStep(3); toast('Платёж принят банком');
  };
  return (
    <Page title="Оплата" actions={<AccPicker state={state} ids={ids} value={acc.id} onChange={(v) => { setAcc(v); setStep(1); setDone(null); }} />}>
      {step === 3 && done ? (
        <Card title="Платёж принят">
          <Stats items={[{ v: money(done.amount), l: 'оплачено' }, { v: done.id.slice(4, 14), l: 'номер операции' }, { v: money(toPay(state, acc)), l: 'остаток к оплате' }]} />
          <Note>Платёж уже учтён в лицевом счёте и в показателе «Платежи онлайн» на сводке акимата.</Note>
        </Card>
      ) : due <= 0 ? <Empty title="Задолженности нет" text="Все начисления оплачены. Новая квитанция появится после следующего расчётного периода." /> : step === 1 ? (
        <Card title={`К оплате ${money(due)}`} aside={`ЛС ${acc.id} · ${addr(state, acc)}`}>
          <div className="form" style={{ maxWidth: 420 }}>
            <div className="radio-list">
              <label><input type="radio" name="m" checked={mode === 'full'} onChange={() => setMode('full')} /> Вся сумма, {money(due)}</label>
              <label><input type="radio" name="m" checked={mode === 'part'} onChange={() => setMode('part')} /> Часть суммы</label>
            </div>
            {mode === 'part' && <Field label="Сумма, ₸" error={err}><input inputMode="numeric" value={amt} onChange={(e) => { setAmt(e.target.value.replace(/\D/g, '')); setErr(''); }} /></Field>}
            <Note>Сначала гасится долг прошлых периодов, затем текущее начисление.</Note>
            <div className="btns"><Btn kind="pri" onClick={next}>Перейти к оплате</Btn></div>
          </div>
        </Card>
      ) : (
        <div className="egov" style={{ maxWidth: 460 }}>
          <div className="egov-top" style={{ background: '#2B2F36' }}><span>Банк-агент · оплата</span><span className="small">тестовый режим</span></div>
          <div className="egov-body">
            <Stats items={[{ v: money(amount), l: 'сумма' }, { v: 'Esepshy ЕРЦ', l: 'получатель' }]} />
            <Note>В тестовом режиме деньги не списываются. Подключение банка-агента — по API после пилота.</Note>
            <div className="btns"><Btn kind="pri" onClick={confirmPay}>Подтвердить оплату</Btn><Btn kind="ghost" onClick={() => setStep(1)}>Назад</Btn></div>
          </div>
        </div>
      )}
    </Page>
  );
}

export function DisputeForm({ acc, res, onDone }) {
  const { act, toast } = useStore();
  const [reason, setReason] = useState('meter');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [err, setErr] = useState('');
  const reasons = { meter: 'Есть счётчик, а начислено по нормативу', area: 'Неверная площадь', paid: 'Уже оплачено', double: 'Двойное начисление', other: 'Другое' };
  const send = () => {
    if (reason === 'other' && text.trim().length < 5) { setErr('Опишите проблему хотя бы в нескольких словах.'); return; }
    act('Обращение жителя', `ЛС ${acc.id}`, `${res === 'osi' ? 'Взносы/прочее' : RES[res].name}: ${reasons[reason]}`, (d) => {
      d.complaints.unshift({ id: uid('c'), acc: acc.id, res, reason, reasonText: reasons[reason], text, photo, status: 'open', at: new Date().toISOString() });
    });
    toast('Обращение отправлено оператору ЕРЦ');
    onDone();
  };
  return (
    <div className="form">
      <p className="small muted" style={{ margin: 0 }}>Строка: <b>{res === 'osi' ? 'Взносы ОСИ / прочие услуги' : RES[res].name}</b> · ЛС {acc.id}</p>
      <div className="radio-list">{Object.entries(reasons).map(([k, l]) => <label key={k}><input type="radio" name="r" checked={reason === k} onChange={() => { setReason(k); setErr(''); }} /> {l}</label>)}</div>
      <Field label="Комментарий" error={err}><textarea value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="Например: счётчик воды установлен в марте, показания передаю" /></Field>
      <Field label="Фото (счётчик, документ)" hint="Необязательно"><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files[0]; if (f) setPhoto(await imageToDataUrl(f)); }} /></Field>
      {photo && <img src={photo} alt="Приложенное фото" className="thumb" />}
      <div className="btns"><Btn kind="pri" onClick={send}>Отправить</Btn></div>
    </div>
  );
}

export function Disputes() {
  const { state } = useStore();
  const [acc, setAcc, ids] = useAcc();
  const [open, setOpen] = useState(false);
  const list = state.complaints.filter((c) => ids.includes(c.acc));
  return (
    <Page title="Обращения" lead="Оспорить строку квитанции можно здесь или прямо в квитанции кнопкой «Не согласен»." actions={<><AccPicker state={state} ids={ids} value={acc.id} onChange={setAcc} /><Btn kind="pri" onClick={() => setOpen(true)}>Новое обращение</Btn></>}>
      <Table keyOf={(c) => c.id} empty="Обращений пока нет" cols={[
        { h: 'Дата', r: (c) => dt(c.at) },
        { h: 'Строка', r: (c) => (c.res === 'osi' ? 'Взносы ОСИ / прочее' : RES[c.res].name) },
        { h: 'Причина', r: (c) => <span className="desc">{c.reasonText}{c.text && <span className="sub">{c.text}</span>}</span> },
        { h: 'Статус', r: (c) => (c.status === 'open' ? <Pill kind="warn">на рассмотрении</Pill> : <Pill kind={c.outcome === 'fixed' ? 'ok' : 'neutral'}>{c.outcome === 'fixed' ? 'исправлено' : 'отказано'}</Pill>) },
        { h: 'Ответ ЕРЦ', r: (c) => <span className="desc">{c.answer || '—'}{c.answeredAt && <span className="sub">{dt(c.answeredAt)}</span>}</span> },
      ]} rows={list} />
      {open && <Modal title="Новое обращение" onClose={() => setOpen(false)}><ChooseLine acc={acc} onDone={() => setOpen(false)} /></Modal>}
    </Page>
  );
}
function ChooseLine({ acc, onDone }) {
  const [res, setRes] = useState(null);
  if (res) return <DisputeForm acc={acc} res={res} onDone={onDone} />;
  return (
    <div className="radio-list">
      {RK.filter((r) => acc.has[r]).map((r) => <label key={r}><input type="radio" name="line" onChange={() => setRes(r)} /> {RES[r].name}</label>)}
      <label><input type="radio" name="line" onChange={() => setRes('osi')} /> Взносы ОСИ / прочие услуги</label>
    </div>
  );
}

export function History() {
  const { state } = useStore();
  const [acc, setAcc, ids] = useAcc();
  const last = billedPeriod(state);
  const rows = Array.from({ length: last + 1 }, (_, m) => last - m);
  const corr = issues(state).filter((i) => i.acc === acc.id && i.status === 'fixed');
  const pays = state.payments.filter((p) => p.acc === acc.id);
  const chan = { online: <Pill kind="ok">онлайн</Pill>, kassa: <Pill kind="neutral">касса</Pill>, bank: <Pill kind="neutral">банк</Pill>, none: <Pill kind="bad">не оплачено</Pill> };
  return (
    <Page title="История начислений и платежей" actions={<AccPicker state={state} ids={ids} value={acc.id} onChange={setAcc} />}>
      {corr.length > 0 && (
        <Card title="Корректировки начислений">
          <Table keyOf={(c) => c.key} cols={[
            { h: 'Дата', r: (c) => dt(c.decidedAt) },
            { h: 'Причина', r: (c) => <><Tag>{ISSUE_TYPES[c.type].label}</Tag><span className="sub desc">{c.text}</span></> },
            { h: 'Сумма', num: true, r: (c) => money(c.amount) },
          ]} rows={corr} />
        </Card>
      )}
      {pays.length > 0 && (
        <Card title="Платежи в Esepshy">
          <Table keyOf={(p) => p.id} cols={[{ h: 'Дата', r: (p) => dt(p.at) }, { h: 'Способ', r: () => chan.online }, { h: 'Сумма', num: true, r: (p) => money(p.amount) }]} rows={pays} />
        </Card>
      )}
      <Table keyOf={(m) => m} cols={[
        { h: 'Период', r: (m) => MONTHS[m] },
        { h: 'Начислено', num: true, r: (m) => money(billFor(state, acc, m).total) },
        { h: 'Оплата', r: (m) => chan[acc.pay[m]] || chan.none },
      ]} rows={rows} />
    </Page>
  );
}
