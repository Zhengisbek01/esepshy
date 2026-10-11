import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { RES, ANOMALY_KINDS, VISIT_RESULTS } from '../data/constants.js';
import { f1, money, dt, uid } from '../lib/format.js';
import { imageToDataUrl } from '../lib/files.js';
import { Page, Btn, Pill, Modal, Field, Note, Tag, Chips, Empty, Card } from '../ui.jsx';

export function Visits() {
  const { state, user, act, toast } = useStore();
  const [f, setF] = useState('assigned');
  const [open, setOpen] = useState(null);
  const mine = state.visits.filter((v) => v.inspector === user.id);
  const list = mine.filter((v) => f === 'all' || v.status === f);
  return (
    <Page title="Мои выезды" lead="Выезды по аномалиям учёта. На месте зафиксируйте результат, сфотографируйте счётчик и внесите показание.">
      <Chips value={f} onChange={setF} items={[['assigned', 'На сегодня', mine.filter((v) => v.status === 'assigned').length], ['done', 'Выполнены', mine.filter((v) => v.status === 'done').length], ['all', 'Все', mine.length]]} />
      {list.length === 0 ? <Empty title="Выездов нет" text="Новые выезды назначает поставщик ресурса из раздела «Аномалии учёта»." /> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
          {list.map((v) => {
            const b = state.buildings[v.snap.bld];
            const a = v.snap.acc && state.accounts.find((x) => x.id === v.snap.acc);
            return (
              <Card key={v.id} title={a ? `${b.name}, кв. ${a.apt}` : b.name} aside={v.status === 'assigned' ? <Pill kind="warn">назначен</Pill> : <Pill kind="ok">выполнен</Pill>}>
                <div className="form" style={{ gap: 8 }}>
                  <div className="btns"><Tag>{ANOMALY_KINDS[v.snap.kind]}</Tag><span className="resname"><i className="dot" style={{ background: RES[v.snap.res].color }} />{RES[v.snap.res].short}</span></div>
                  <p className="small" style={{ margin: 0 }}>{v.snap.text}</p>
                  {a && <span className="small muted">Собственник: {a.owner} · {a.phone}</span>}
                  <span className="small muted">Назначен {dt(v.at)} · ущерб ≈ {money(v.snap.dmg)}/мес</span>
                  {v.status === 'done' && <span className="small"><b>{VISIT_RESULTS[v.result]}</b> · показание {f1(v.reading)} · {dt(v.doneAt)}</span>}
                  <div className="btns">{v.status === 'assigned' ? <Btn kind="pri" onClick={() => setOpen(v)}>Зафиксировать результат</Btn> : !v.requestId && (v.result === 'leak' || v.result === 'broken') ? <Btn onClick={() => setOpen({ ...v, mode: 'request' })}>Создать заявку на устранение</Btn> : v.requestId ? <Pill kind="info">заявка создана</Pill> : null}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {open && <Modal title={open.mode === 'request' ? 'Заявка на устранение' : 'Результат проверки'} onClose={() => setOpen(null)}>{open.mode === 'request' ? <RequestForm v={open} onDone={() => setOpen(null)} /> : <ResultForm v={open} onDone={(next) => setOpen(next)} />}</Modal>}
    </Page>
  );
}

function ResultForm({ v, onDone }) {
    const { state, act, toast } = useStore();
    const [result, setResult] = useState('');
    const [photo, setPhoto] = useState(null);
    const [reading, setReading] = useState('');
    const [comment, setComment] = useState('');
    const [err, setErr] = useState('');
    const save = () => {
      if (!result) { setErr('Выберите результат проверки.'); return; }
      if (!photo) { setErr('Без фото счётчика результат не отправляется.'); return; }
      const rd = Number(reading.replace(',', '.'));
      if (!reading || Number.isNaN(rd)) { setErr('Внесите показание счётчика числом.'); return; }
      const at = new Date().toISOString();
      act('Результат выезда', ANOMALY_KINDS[v.snap.kind], `${state.buildings[v.snap.bld].name}: ${VISIT_RESULTS[result]}`, (d) => {
        const x = d.visits.find((y) => y.id === v.id);
        Object.assign(x, { status: 'done', result, photo, reading: rd, comment, doneAt: at, geo: 'мкр Самал-2 (демо-координаты)' });
        const st = d.anomalyState[v.anomalyKey] || { snap: v.snap };
        d.anomalyState[v.anomalyKey] = { ...st, status: 'checked', result };
      });
      toast('Результат отправлен поставщику');
      onDone(result === 'leak' || result === 'broken' ? { ...v, status: 'done', result, mode: 'request' } : null);
    };
    return (
      <div className="form">
        <div className="radio-list">{Object.entries(VISIT_RESULTS).map(([k, l]) => <label key={k}><input type="radio" name="res" checked={result === k} onChange={() => { setResult(k); setErr(''); }} /> {l}</label>)}</div>
        <Field label="Фото счётчика"><input type="file" accept="image/*" capture="environment" onChange={async (e) => { const f = e.target.files[0]; if (f) { setPhoto(await imageToDataUrl(f)); setErr(''); } }} /></Field>
        {photo && <img src={photo} alt="Фото счётчика" className="thumb" />}
        <Field label={`Показание, ${RES[v.snap.res].unit}`}><input inputMode="decimal" value={reading} onChange={(e) => { setReading(e.target.value); setErr(''); }} /></Field>
        <Field label="Комментарий"><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Что обнаружено на месте" /></Field>
        {err && <span className="field-e">{err}</span>}
        <Note>Время и место фиксации сохраняются автоматически.</Note>
        <div className="btns"><Btn kind="pri" onClick={save}>Отправить результат</Btn></div>
      </div>
    );
  }

function RequestForm({ v, onDone }) {
    const { state, user, act, toast } = useStore();
    const b = state.buildings[v.snap.bld];
    const supplier = RES[v.snap.res].org;
    const [to, setTo] = useState(v.snap.kind === 'balance' ? b.osi : supplier);
    const [text, setText] = useState(v.result === 'leak' ? 'Обнаружена утечка, требуется ремонт' : 'Счётчик неисправен, требуется замена или поверка');
    const create = () => {
      const id = uid('rq');
      const a = v.snap.acc && state.accounts.find((x) => x.id === v.snap.acc);
      act('Заявка на устранение', b.name, `${state.orgs.find((o) => o.id === to).name}: ${text}`, (d) => {
        d.requests.unshift({ id, visitId: v.id, to, bld: b.id, apt: a ? a.apt : null, res: v.snap.res, text, by: user.name, at: new Date().toISOString(), status: 'new' });
        d.visits.find((y) => y.id === v.id).requestId = id;
      });
      toast('Заявка передана'); onDone();
    };
    return (
      <div className="form">
        <Field label="Кому"><select value={to} onChange={(e) => setTo(e.target.value)}><option value={supplier}>{state.orgs.find((o) => o.id === supplier).name}</option><option value={b.osi}>{state.orgs.find((o) => o.id === b.osi).name}</option></select></Field>
        <Field label="Описание"><textarea value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <div className="btns"><Btn kind="pri" onClick={create}>Создать заявку</Btn><Btn kind="ghost" onClick={onDone}>Не нужно</Btn></div>
      </div>
    );
  }
