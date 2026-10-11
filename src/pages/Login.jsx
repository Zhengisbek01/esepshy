import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { ROLES } from '../data/constants.js';
import { Btn, Field } from '../ui.jsx';
import { issues } from '../lib/engine.js';
import { money } from '../lib/format.js';

export default function Login() {
  const { state, login, reset } = useStore();
  const [mode, setMode] = useState(null);
  const [iin, setIin] = useState('');
  const [err, setErr] = useState('');
  const [signing, setSigning] = useState(false);

  const samples = useMemo(() => {
    const byIin = new Map();
    state.accounts.forEach((a) => byIin.set(a.iin, [...(byIin.get(a.iin) || []), a]));
    const out = [];
    const multi = [...byIin.entries()].find(([, v]) => v.length > 1);
    if (multi) out.push({ iin: multi[0], note: `2 квартиры · ${multi[1][0].owner}` });
    const debtor = state.accounts.find((a) => a.debt > 80000);
    if (debtor) out.push({ iin: debtor.iin, note: `долг ${money(debtor.debt)}` });
    const withIssue = issues(state).find((i) => i.status === 'open' && i.type === 'norm');
    if (withIssue) { const a = state.accounts.find((x) => x.id === withIssue.acc); out.push({ iin: a.iin, note: 'ошибка в начислении' }); }
    const clean = state.accounts.find((a) => !a.debt && !a.smart.water);
    if (clean) out.push({ iin: clean.iin, note: 'без долга, передаёт показания' });
    return out;
  }, [state]);

  const groups = useMemo(() => {
    const g = {};
    state.users.filter((u) => u.active).forEach((u) => { const grp = ROLES[u.role].group; (g[grp] = g[grp] || []).push(u); });
    return g;
  }, [state.users]);
  const orgName = (id) => state.orgs.find((o) => o.id === id)?.name || '';

  const egovSign = () => {
    if (!/^\d{12}$/.test(iin)) { setErr('ИИН состоит из 12 цифр.'); return; }
    if (!state.accounts.some((a) => a.iin === iin)) { setErr('По этому ИИН нет лицевых счетов в пилотном микрорайоне. Выберите тестовый ИИН ниже.'); return; }
    setSigning(true);
    setTimeout(() => { setSigning(false); login({ kind: 'resident', iin }); }, 700);
  };

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
        <div>
          <span className="eyebrow">Вход для жителей</span>
          {!mode && <div className="btns" style={{ marginTop: 10 }}><Btn kind="pri" onClick={() => setMode('egov')}>Войти через eGov</Btn></div>}
          {mode === 'egov' && (
            <div className="egov" style={{ marginTop: 10 }}>
              <div className="egov-top"><span>eGov · авторизация</span><span className="small">тестовый режим</span></div>
              <div className="egov-body">
                <Field label="ИИН" error={err} hint="В тестовом режиме подпись ЭЦП имитируется. Реальная проверка появится после подключения к eGov.">
                  <input inputMode="numeric" maxLength={12} value={iin} onChange={(e) => { setIin(e.target.value.replace(/\D/g, '')); setErr(''); }} placeholder="12 цифр" />
                </Field>
                <div className="chips">{samples.map((s) => <button key={s.iin + s.note} type="button" className="chip" onClick={() => { setIin(s.iin); setErr(''); }}>{s.iin} <span className="c">{s.note}</span></button>)}</div>
                <div className="btns"><Btn kind="pri" onClick={egovSign} disabled={signing}>{signing ? 'Проверка подписи…' : 'Подписать и войти'}</Btn><Btn kind="ghost" onClick={() => setMode(null)}>Отмена</Btn></div>
              </div>
            </div>
          )}
        </div>
        <div>
          <span className="eyebrow">Вход для сотрудников (демо-учётные записи)</span>
          {Object.entries(groups).map(([g, list]) => (
            <div key={g} style={{ marginTop: 14 }}>
              <h3 style={{ marginBottom: 8 }}>{g}</h3>
              <div className="role-grid">
                {list.map((u) => (
                  <button key={u.id} type="button" className="role-btn" onClick={() => login({ kind: 'staff', userId: u.id })}>
                    <b>{ROLES[u.role].name}</b><span>{u.name} · {orgName(u.org)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="btns"><Btn kind="ghost" small onClick={reset}>Сбросить демо-данные</Btn><a className="small" href="/prototype.html">Первый прототип</a></div>
      </div>
    </div>
  );
}

export const Gauge = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#0F2A2E" strokeWidth="2" /><path d="M10 10 L14.5 6" stroke="#0F2A2E" strokeWidth="2" strokeLinecap="round" /><circle cx="10" cy="10" r="1.8" fill="#0F2A2E" /></svg>
);
