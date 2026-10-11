import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { ROLES } from '../data/constants.js';
import { Btn, Field, Seg, Note } from '../ui.jsx';
import { issues } from '../lib/engine.js';
import { money } from '../lib/format.js';
import { hashPass, DEMO_PASSWORD, LOCK_AFTER, LOCK_MS, passwordProblem } from '../lib/auth.js';

export default function Login() {
  const { state, reset } = useStore();
  const [tab, setTab] = useState('staff');
  return (
    <div className="login">
      <div className="login-hero">
        <div className="brand"><div className="brand-mark"><Gauge /></div><div><b>Esepshy</b><small>ТОО «JASA Ltd» · G-TON</small></div></div>
        <div>
          <h1>Esepshy</h1>
          <p>Единый расчётный центр ЖКХ: одна квитанция для жителя, ИИ-сверка начислений, дистанционный учёт электроэнергии, тепла, воды и газа, панель KPI для акимата.</p>
        </div>
        <p className="small">Тестовая версия на демо-данных: мкр «Самал-2», 12 домов, {state.accounts.length} лицевых счетов. Действия сохраняются в этом браузере.</p>
      </div>
      <div className="login-main">
        <div><h2 style={{ fontSize: '1.4rem' }}>Вход в Esepshy</h2></div>
        <Seg value={tab} onChange={setTab} items={[['staff', 'Сотрудник организации'], ['resident', 'Житель']]} />
        {tab === 'staff' ? <StaffLogin /> : <ResidentLogin />}
        <div className="btns"><Btn kind="ghost" small onClick={() => { if (window.confirm('Сбросить все изменения демо-данных?')) reset(); }}>Сбросить демо-данные</Btn><a className="small" href="/prototype.html">Первый прототип</a></div>
      </div>
    </div>
  );
}

function StaffLogin() {
  const { state, login, sysAct } = useStore();
  const [lg, setLg] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [twofa, setTwofa] = useState(null);
  const [code, setCode] = useState('');
  const [demo, setDemo] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!lg.trim() || !pw) { setErr('Введите логин и пароль.'); return; }
    const u = state.users.find((x) => x.login.toLowerCase() === lg.trim().toLowerCase());
    if (u && u.lockedUntil > Date.now()) { setErr(`Слишком много неудачных попыток. Вход откроется через ${Math.ceil((u.lockedUntil - Date.now()) / 1000)} с.`); return; }
    if (!u || u.passHash !== hashPass(u.login, pw)) {
      if (u) {
        const failed = (u.failed || 0) + 1;
        const lock = failed >= LOCK_AFTER;
        sysAct({ name: u.login, role: 'system' }, lock ? 'Вход заблокирован' : 'Неудачный вход', u.name, lock ? `${LOCK_AFTER} неверных паролей подряд, блокировка на 1 минуту` : `Неверный пароль, попытка ${failed}`, (d) => {
          const x = d.users.find((y) => y.id === u.id); x.failed = lock ? 0 : failed; if (lock) x.lockedUntil = Date.now() + LOCK_MS;
        });
        setErr(lock ? 'Слишком много неудачных попыток. Вход заблокирован на 1 минуту.' : `Неверный логин или пароль. Осталось попыток: ${LOCK_AFTER - failed}.`);
      } else setErr('Неверный логин или пароль.');
      return;
    }
    if (!u.active) { setErr('Учётная запись заблокирована. Обратитесь к администратору платформы.'); return; }
    if (u.twoFactor) {
      const c = String(Math.floor(100000 + Math.random() * 900000));
      setTwofa({ u, c, tries: 0 }); setCode(''); setErr('');
      return;
    }
    finish(u);
  };
  const finish = (u) => {
    sysAct({ name: u.name, id: u.id, role: u.role }, 'Вход в систему', 'Логин организации', u.twoFactor ? 'С подтверждением кодом' : '', (d) => { const x = d.users.find((y) => y.id === u.id); x.failed = 0; x.lockedUntil = 0; x.lastLogin = new Date().toISOString(); });
    login({ kind: 'staff', userId: u.id });
  };
  const verify = (e) => {
    e.preventDefault();
    if (code.trim() === twofa.c) { finish(twofa.u); return; }
    const tries = twofa.tries + 1;
    if (tries >= 3) { setTwofa(null); setPw(''); setErr('Код введён неверно 3 раза. Войдите заново.'); return; }
    setTwofa({ ...twofa, tries }); setErr(`Неверный код. Осталось попыток: ${3 - tries}.`);
  };

  if (twofa) {
    return (
      <form className="card form" onSubmit={verify} style={{ maxWidth: 440 }}>
        <h3>Подтверждение входа</h3>
        <p className="small" style={{ margin: 0 }}>Для роли «{ROLES[twofa.u.role].name}» нужен второй фактор. Код отправлен по SMS.</p>
        <div className="egov" style={{ borderStyle: 'dashed' }}><div className="egov-body"><span className="small muted">SMS · тестовый режим</span><span>Esepshy: код входа <b className="mono">{twofa.c}</b>. Никому не сообщайте.</span></div></div>
        <Field label="Код из SMS" error={err}><input inputMode="numeric" autoFocus maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr(''); }} /></Field>
        <div className="btns"><Btn kind="pri" type="submit">Подтвердить</Btn><Btn kind="ghost" onClick={() => { setTwofa(null); setErr(''); }}>Отмена</Btn></div>
      </form>
    );
  }
  return (
    <div className="form">
      <form className="card form" onSubmit={submit} style={{ maxWidth: 440 }}>
        <Field label="Логин"><input autoComplete="username" value={lg} onChange={(e) => { setLg(e.target.value); setErr(''); }} placeholder="operator1" /></Field>
        <Field label="Пароль" error={err}>
          <div className="btns" style={{ flexWrap: 'nowrap' }}>
            <input type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} />
            <Btn kind="ghost" small onClick={() => setShow(!show)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}>{show ? 'Скрыть' : 'Показать'}</Btn>
          </div>
        </Field>
        <div className="btns"><Btn kind="pri" type="submit">Войти</Btn></div>
        <span className="small muted">Забыли пароль? Новый временный пароль выдаёт администратор платформы.</span>
      </form>
      <div>
        <Btn kind="ghost" small onClick={() => setDemo(!demo)} aria-expanded={demo}>{demo ? 'Скрыть демо-доступы' : 'Показать демо-доступы для проверки'}</Btn>
        {demo && (
          <div className="card" style={{ marginTop: 8 }}>
            <p className="small" style={{ margin: '0 0 10px' }}>Пароль для всех демо-учётных записей: <b className="mono">{DEMO_PASSWORD}</b>. Нажмите строку, чтобы подставить логин и пароль. У администратора после пароля нужен код из SMS.</p>
            <div className="tbl"><table><thead><tr><th>Логин</th><th>Роль</th><th>Сотрудник</th></tr></thead><tbody>
              {state.users.filter((u) => u.active).map((u) => (
                <tr key={u.id} className="click" onClick={() => { setLg(u.login); setPw(DEMO_PASSWORD); setErr(''); }}>
                  <td className="mono">{u.login}</td><td>{ROLES[u.role].name}</td><td>{u.name}<span className="sub">{state.orgs.find((o) => o.id === u.org)?.name}</span></td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResidentLogin() {
  const { state, login, sysAct } = useStore();
  const [iin, setIin] = useState('');
  const [err, setErr] = useState('');
  const [signing, setSigning] = useState(false);
  const samples = useMemo(() => {
    const byIin = new Map();
    state.accounts.forEach((a) => byIin.set(a.iin, [...(byIin.get(a.iin) || []), a]));
    const out = [];
    const multi = [...byIin.entries()].find(([, v]) => v.length > 1);
    if (multi) out.push({ iin: multi[0], note: '2 квартиры' });
    const debtor = state.accounts.find((a) => a.debt > 80000);
    if (debtor) out.push({ iin: debtor.iin, note: `долг ${money(debtor.debt)}` });
    const withIssue = issues(state).find((i) => i.status === 'open' && i.type === 'norm');
    if (withIssue) out.push({ iin: state.accounts.find((x) => x.id === withIssue.acc).iin, note: 'ошибка в начислении' });
    const clean = state.accounts.find((a) => !a.debt && !a.smart.water);
    if (clean) out.push({ iin: clean.iin, note: 'обычный счётчик воды' });
    return out;
  }, [state]);
  const sign = (e) => {
    e.preventDefault();
    if (!/^\d{12}$/.test(iin)) { setErr('ИИН состоит из 12 цифр.'); return; }
    const accs = state.accounts.filter((a) => a.iin === iin);
    if (!accs.length) { setErr('По этому ИИН нет лицевых счетов в пилотном микрорайоне.'); return; }
    setSigning(true);
    setTimeout(() => {
      setSigning(false);
      sysAct({ name: accs[0].owner, id: `iin-${iin}`, role: 'resident' }, 'Вход в систему', 'eGov (тестовый режим)', `ИИН ${iin.slice(0, 4)}••••${iin.slice(-2)}`);
      login({ kind: 'resident', iin });
    }, 700);
  };
  return (
    <form className="egov" onSubmit={sign} style={{ maxWidth: 520 }}>
      <div className="egov-top"><span>eGov · авторизация</span><span className="small">тестовый режим</span></div>
      <div className="egov-body">
        <Field label="ИИН" error={err}><input inputMode="numeric" maxLength={12} value={iin} onChange={(e) => { setIin(e.target.value.replace(/\D/g, '')); setErr(''); }} placeholder="12 цифр" /></Field>
        <span className="small muted">Тестовые ИИН жителей пилота:</span>
        <div className="chips">{samples.map((s) => <button key={s.iin + s.note} type="button" className="chip" onClick={() => { setIin(s.iin); setErr(''); }}>{s.iin} <span className="c">{s.note}</span></button>)}</div>
        <Note>В тестовом режиме подпись ЭЦП и eGov Mobile имитируется. После подключения к eGov вход будет по ЭЦП или QR-коду в eGov Mobile.</Note>
        <div className="btns"><Btn kind="pri" type="submit" disabled={signing}>{signing ? 'Проверка подписи…' : 'Подписать и войти'}</Btn></div>
      </div>
    </form>
  );
}

export function ChangePassword({ forced, onDone }) {
  const { user, act, toast, logout } = useStore();
  const [cur, setCur] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState('');
  const save = (e) => {
    e.preventDefault();
    if (hashPass(user.login, cur) !== user.passHash) { setErr(forced ? 'Неверный временный пароль.' : 'Текущий пароль указан неверно.'); return; }
    const pr = passwordProblem(p1); if (pr) { setErr(`Новый пароль: ${pr}`); return; }
    if (p1 === cur) { setErr('Новый пароль должен отличаться от текущего.'); return; }
    if (p1 !== p2) { setErr('Пароли не совпадают.'); return; }
    act('Смена пароля', user.name, forced ? 'После выдачи временного пароля' : 'По инициативе пользователя', (d) => { const x = d.users.find((y) => y.id === user.id); x.passHash = hashPass(x.login, p1); x.mustChange = false; x.passChangedAt = new Date().toISOString(); });
    toast('Пароль изменён'); onDone && onDone();
  };
  const form = (
    <form className="form" onSubmit={save}>
      <Field label={forced ? 'Временный пароль' : 'Текущий пароль'}><input type="password" autoComplete="current-password" value={cur} onChange={(e) => { setCur(e.target.value); setErr(''); }} /></Field>
      <Field label="Новый пароль" hint="Не короче 8 символов, буквы и цифры"><input type="password" autoComplete="new-password" value={p1} onChange={(e) => { setP1(e.target.value); setErr(''); }} /></Field>
      <Field label="Повторите новый пароль" error={err}><input type="password" autoComplete="new-password" value={p2} onChange={(e) => { setP2(e.target.value); setErr(''); }} /></Field>
      <div className="btns"><Btn kind="pri" type="submit">Сохранить пароль</Btn>{forced && <Btn kind="ghost" onClick={() => logout()}>Выйти</Btn>}</div>
    </form>
  );
  if (!forced) return form;
  return (
    <div className="login" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
      <div className="login-main" style={{ margin: '0 auto', maxWidth: 480 }}>
        <div className="brand"><div className="brand-mark"><Gauge /></div><div><b>Esepshy</b></div></div>
        <h2 style={{ fontSize: '1.3rem' }}>Смените временный пароль</h2>
        <p className="small muted" style={{ margin: 0 }}>{user.name}, администратор выдал вам временный пароль. Задайте постоянный, чтобы продолжить.</p>
        <div className="card">{form}</div>
      </div>
    </div>
  );
}

export const Gauge = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#0F2A2E" strokeWidth="2" /><path d="M10 10 L14.5 6" stroke="#0F2A2E" strokeWidth="2" strokeLinecap="round" /><circle cx="10" cy="10" r="1.8" fill="#0F2A2E" /></svg>
);
