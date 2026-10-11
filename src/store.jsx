import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { generate } from './data/generate.js';
import { ROLES } from './data/constants.js';
import { uid } from './lib/format.js';
import { invalidate } from './lib/engine.js';

const KEY = 'esepshy-state-v3';
const SKEY = 'esepshy-session-v1';
const Ctx = createContext(null);

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s.version === 3) return s; } } catch (e) { /* storage unavailable */ }
  return generate();
}
function loadSession() { try { return JSON.parse(localStorage.getItem(SKEY)) || null; } catch (e) { return null; } }

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [session, setSession] = useState(loadSession);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked: keep working in memory */ }
  }, [state]);
  useEffect(() => { try { session ? localStorage.setItem(SKEY, JSON.stringify(session)) : localStorage.removeItem(SKEY); } catch (e) { /* ignore */ } }, [session]);

  const user = useMemo(() => {
    if (!session) return null;
    if (session.kind === 'resident') {
      const accs = state.accounts.filter((a) => a.iin === session.iin);
      return { id: `iin-${session.iin}`, name: accs[0]?.owner || 'Житель', role: 'resident', org: null, iin: session.iin, accounts: accs.map((a) => a.id) };
    }
    const u = state.users.find((x) => x.id === session.userId);
    return u && u.active ? u : null;
  }, [session, state.users, state.accounts]);

  const toast = (text, kind = 'ok') => {
    const id = uid('t');
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  };

  /** Apply a change to a copy of the state and write it to the audit log. */
  const act = (action, object, details, fn) => {
    setState((prev) => {
      const d = structuredClone(prev);
      const res = fn ? fn(d) : undefined;
      if (res === false) return prev;
      invalidate(d);
      d.audit.unshift({ id: uid('a'), at: new Date().toISOString(), user: user?.name || 'система', userId: user?.id, role: user?.role || 'system', action, object, details });
      if (d.audit.length > 2000) d.audit.length = 2000;
      return d;
    });
  };

  const login = (sess) => {
    setSession(sess);
    const who = sess.kind === 'resident' ? `ИИН ${sess.iin.slice(0, 4)}••••${sess.iin.slice(-2)}` : state.users.find((u) => u.id === sess.userId)?.name;
    setState((prev) => { const d = { ...prev, audit: [{ id: uid('a'), at: new Date().toISOString(), user: who, role: sess.kind === 'resident' ? 'resident' : state.users.find((u) => u.id === sess.userId)?.role, action: 'Вход в систему', object: sess.kind === 'resident' ? 'eGov (тестовый режим)' : 'Логин организации', details: '' }, ...prev.audit] }; return d; });
  };
  const logout = () => setSession(null);
  const reset = () => { const s = generate(); setState(s); setSession(null); toast('Демо-данные сброшены к исходному состоянию'); };

  const value = { state, user, session, act, login, logout, reset, toast, roleName: (r) => ROLES[r]?.name || r };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
    </Ctx.Provider>
  );
}
export const useStore = () => useContext(Ctx);
