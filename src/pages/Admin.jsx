import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { ROLES, RES } from '../data/constants.js';
import { dt, uid } from '../lib/format.js';
import { Page, Card, Btn, Pill, Table, Modal, Field, Note, Seg } from '../ui.jsx';

const ZONE = (o, s) => o.type === 'supplier' ? `Ресурс: ${RES[o.res].name}` : o.type === 'osi' ? `Дома: ${o.blds.map((b) => s.buildings[b].short.replace('Дом ', '№')).join(', ')}` : o.type === 'erc' ? 'Все дома пилота' : o.type === 'gov' ? 'Обезличенные данные' : 'Платформа';
const ROLE_ORG = { supplier: ['supplier'], osi: ['osi'], inspector: ['supplier', 'erc'], operator: ['erc'], debt: ['erc'], head: ['erc'], admin: ['platform'], akimat: ['gov'], auditor: ['gov'] };

export function Users() {
  const { state, user, act, toast } = useStore();
  const [tab, setTab] = useState('users');
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'operator', org: 'erc' });
  const [err, setErr] = useState('');
  const orgsFor = (role) => state.orgs.filter((o) => ROLE_ORG[role].includes(o.type));
  const toggle = (u) => {
    if (u.id === user.id) { toast('Нельзя заблокировать собственную учётную запись', 'err'); return; }
    act(u.active ? 'Доступ отозван' : 'Доступ восстановлен', u.name, ROLES[u.role].name, (d) => { const x = d.users.find((y) => y.id === u.id); x.active = !x.active; });
    toast(u.active ? 'Учётная запись заблокирована, вход закрыт' : 'Доступ восстановлен');
  };
  const changeRole = (u, role) => {
    const org = orgsFor(role).some((o) => o.id === u.org) ? u.org : orgsFor(role)[0].id;
    act('Смена роли', u.name, `${ROLES[u.role].name} → ${ROLES[role].name}`, (d) => { const x = d.users.find((y) => y.id === u.id); x.role = role; x.org = org; });
    toast('Роль изменена, действует со следующего входа');
  };
  const create = () => {
    if (form.name.trim().split(/\s+/).length < 2) { setErr('Укажите имя и фамилию.'); return; }
    act('Новый пользователь', form.name, `${ROLES[form.role].name}, ${state.orgs.find((o) => o.id === form.org).name}`, (d) => { d.users.push({ id: uid('u'), name: form.name.trim(), role: form.role, org: form.org, active: true, invitedAt: new Date().toISOString() }); });
    setAdd(false); setForm({ name: '', role: 'operator', org: 'erc' }); toast('Пользователь создан и появится на экране входа');
  };
  return (
    <Page title="Организации и пользователи" lead="Каждый сотрудник видит только данные своей организации и зоны. Изменения ролей и доступа пишутся в журнал." actions={<Btn kind="pri" onClick={() => { setAdd(true); setErr(''); }}>Добавить пользователя</Btn>}>
      <Seg value={tab} onChange={setTab} items={[['users', 'Пользователи'], ['orgs', 'Организации']]} />
      {tab === 'users' ? (
        <Table keyOf={(u) => u.id} rowClass={(u) => (u.active ? '' : 'done')} cols={[
          { h: 'Сотрудник', r: (u) => <>{u.name}{u.id === user.id && <span className="sub">это вы</span>}</> },
          { h: 'Организация', r: (u) => state.orgs.find((o) => o.id === u.org)?.name },
          { h: 'Роль', r: (u) => <select aria-label={`Роль ${u.name}`} value={u.role} onChange={(e) => changeRole(u, e.target.value)} style={{ width: 'auto' }}>{Object.entries(ROLES).filter(([k]) => k !== 'resident').map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select> },
          { h: 'Статус', r: (u) => (u.active ? <Pill kind="ok">активен</Pill> : <Pill kind="bad">заблокирован</Pill>) },
          { h: '', r: (u) => <Btn small kind={u.active ? 'danger' : ''} onClick={() => toggle(u)}>{u.active ? 'Отозвать доступ' : 'Восстановить'}</Btn> },
        ]} rows={state.users} />
      ) : (
        <Table keyOf={(o) => o.id} cols={[
          { h: 'Организация', r: (o) => o.name }, { h: 'Зона видимости', r: (o) => ZONE(o, state) },
          { h: 'Сотрудников', num: true, r: (o) => state.users.filter((u) => u.org === o.id && u.active).length },
        ]} rows={state.orgs} />
      )}
      <Note>Жители входят через eGov и в этом списке не отображаются: их доступ определяется связкой ИИН — лицевой счёт.</Note>
      {add && (
        <Modal title="Новый пользователь" onClose={() => setAdd(false)}>
          <div className="form">
            <Field label="Имя и фамилия" error={err}><input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr(''); }} placeholder="Айжан Мукашева" /></Field>
            <Field label="Роль"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, org: orgsFor(e.target.value)[0].id })}>{Object.entries(ROLES).filter(([k]) => k !== 'resident').map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></Field>
            <Field label="Организация"><select value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })}>{orgsFor(form.role).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <div className="btns"><Btn kind="pri" onClick={create}>Создать</Btn></div>
          </div>
        </Modal>
      )}
    </Page>
  );
}

export function Dicts() {
  const { state, act, toast } = useStore();
  const [tab, setTab] = useState('templates');
  const [edit, setEdit] = useState(null);
  const [text, setText] = useState('');
  const save = () => {
    act('Изменён шаблон сообщения', edit.name, 'Новая версия шаблона', (d) => { const t = d.templates.find((x) => x.id === edit.id); t.history = [...(t.history || []), { text: t.text, at: new Date().toISOString() }]; t.text = text; });
    setEdit(null); toast('Шаблон сохранён, прошлая версия в истории');
  };
  return (
    <Page title="Справочники" lead="Дома, типы счётчиков и шаблоны сообщений. Изменения шаблонов версионируются.">
      <Seg value={tab} onChange={setTab} items={[['templates', 'Шаблоны сообщений'], ['houses', 'Дома'], ['meters', 'Типы счётчиков']]} />
      {tab === 'templates' && <Table keyOf={(t) => t.id} cols={[{ h: 'Шаблон', r: (t) => t.name }, { h: 'Текст', r: (t) => <span className="desc">{t.text}</span> }, { h: 'Версий', num: true, r: (t) => (t.history?.length || 0) + 1 }, { h: '', r: (t) => <Btn small onClick={() => { setEdit(t); setText(t.text); }}>Изменить</Btn> }]} rows={state.templates} />}
      {tab === 'houses' && <Table keyOf={(b) => b.id} cols={[{ h: 'Дом', r: (b) => b.name }, { h: 'Квартир', num: true, r: (b) => state.accounts.filter((a) => a.bld === b.id).length }, { h: 'Этажей', num: true, r: (b) => b.floors }, { h: 'Год', num: true, r: (b) => b.year }, { h: 'Газ', r: (b) => (b.hasGas ? 'есть' : 'нет') }, { h: 'ОСИ', r: (b) => state.orgs.find((o) => o.id === b.osi).name }]} rows={state.buildings} />}
      {tab === 'meters' && <Table keyOf={(m) => m.id} cols={[{ h: 'Тип', r: (m) => m.name }, { h: 'Ресурс', r: (m) => RES[m.res].name }, { h: 'Межповерочный интервал', r: (m) => m.interval }]} rows={state.meterTypes} />}
      {edit && (
        <Modal title={edit.name} onClose={() => setEdit(null)}>
          <Field label="Текст" hint="Подстановки: {ФИО}, {ЛС}, {адрес}, {сумма}, {кв}"><textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 120 }} /></Field>
          <div className="btns"><Btn kind="pri" onClick={save}>Сохранить новую версию</Btn></div>
        </Modal>
      )}
    </Page>
  );
}

export function Integrations() {
  const { state, act, toast } = useStore();
  const check = (it) => { act('Проверка интеграции', it.name, 'Связь в норме', (d) => { const x = d.integrations.find((y) => y.id === it.id); x.last = new Date().toISOString(); x.status = x.id === 'egov' ? 'test' : 'ok'; x.errors = 0; }); toast(`${it.name}: связь в норме`); };
  const fail = (it) => { act('Сбой интеграции', it.name, 'Нет ответа от системы (имитация)', (d) => { const x = d.integrations.find((y) => y.id === it.id); x.status = 'error'; x.errors += 1; x.failAt = new Date().toISOString(); }); toast(`Сбой обмена: ${it.name}. Уведомление отправлено администратору`, 'err'); };
  const ST = { ok: ['ok', 'работает'], test: ['info', 'тестовый режим'], warn: ['warn', 'есть ошибки'], error: ['bad', 'сбой'] };
  return (
    <Page title="Интеграции" lead="Статус обмена с банками-агентами, поставщиками и eGov. Сбой виден здесь и отправляет уведомление администратору.">
      <Table keyOf={(i) => i.id} cols={[
        { h: 'Система', r: (i) => i.name }, { h: 'Способ', r: (i) => i.mode },
        { h: 'Последний обмен', r: (i) => dt(i.last) }, { h: 'Ошибок', num: true, r: (i) => i.errors },
        { h: 'Статус', r: (i) => <Pill kind={ST[i.status][0]}>{ST[i.status][1]}</Pill> },
        { h: '', r: (i) => <div className="btns"><Btn small onClick={() => check(i)}>Проверить</Btn><Btn small kind="ghost" onClick={() => fail(i)}>Имитировать сбой</Btn></div> },
      ]} rows={state.integrations} />
      <Card title="Что подключается после пилота"><p className="small" style={{ margin: 0 }}>eGov: боевая авторизация жителей по ЭЦП и eGov Mobile. Банки-агенты: приём платежей по API с ежедневной сверкой. Поставщики: API вместо файлов. Все интеграции изолированы в отдельных модулях, остальная платформа не меняется.</p></Card>
    </Page>
  );
}
