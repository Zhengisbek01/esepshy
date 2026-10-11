export const MONTHS = ['окт 2025', 'ноя 2025', 'дек 2025', 'янв 2026', 'фев 2026', 'мар 2026', 'апр 2026', 'май 2026', 'июн 2026', 'июл 2026', 'авг 2026', 'сен 2026'];
export const MONTHS_SHORT = ['окт', 'ноя', 'дек', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен'];
export const MONTH_KEYS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
export const CUR = 11;

export const RES = {
  el: { name: 'Электроэнергия', short: 'Свет', unit: 'кВт·ч', tariff: 25.4, org: 'el', color: 'var(--el)', smartT: 0.8, lossT: 0.1, thr: 0.08, dig: 0,
    season: [1.05, 1.15, 1.3, 1.32, 1.22, 1.08, 0.98, 0.9, 0.92, 1.02, 1, 0.95] },
  heat: { name: 'Отопление', short: 'Тепло', unit: 'Гкал', tariff: 6850, org: 'heat', color: 'var(--heat)', smartT: 0.7, lossT: 0.1, thr: 0.09, dig: 2,
    season: [0.35, 0.85, 1.15, 1.25, 1.1, 0.8, 0.35, 0, 0, 0, 0, 0] },
  water: { name: 'Вода и водоотведение', short: 'Вода', unit: 'м³', tariff: 142, org: 'water', color: 'var(--water)', smartT: 0.8, lossT: 0.15, thr: 0.09, dig: 1,
    season: [0.95, 0.95, 0.95, 0.95, 0.95, 1, 1, 1.05, 1.12, 1.15, 1.12, 1.02] },
  gas: { name: 'Газ', short: 'Газ', unit: 'м³', tariff: 31.6, org: 'gas', color: 'var(--gas)', smartT: 0.8, lossT: 0.1, thr: 0.07, dig: 0,
    season: [1, 1.08, 1.15, 1.15, 1.1, 1.05, 1, 0.95, 0.92, 0.92, 0.93, 0.97] },
};
export const RK = Object.keys(RES);

export const ROLES = {
  resident: { name: 'Житель', group: 'Население' },
  supplier: { name: 'Поставщик ресурса', group: 'Поставщики и ОСИ' },
  osi: { name: 'ОСИ / КСК / УК', group: 'Поставщики и ОСИ' },
  inspector: { name: 'Инспектор', group: 'Поставщики и ОСИ' },
  operator: { name: 'Оператор сверки', group: 'ЕРЦ' },
  debt: { name: 'Специалист по задолженности', group: 'ЕРЦ' },
  head: { name: 'Руководитель ЕРЦ', group: 'ЕРЦ' },
  admin: { name: 'Администратор', group: 'ЕРЦ' },
  akimat: { name: 'Акимат', group: 'Государство' },
  auditor: { name: 'Аудитор', group: 'Государство' },
};

export const ORGS = [
  { id: 'erc', name: 'ЕРЦ «Самал» (демо)', type: 'erc' },
  { id: 'el', name: 'ТОО «ЭнергоСбыт» (демо)', type: 'supplier', res: 'el' },
  { id: 'heat', name: 'ГКП «Теплосети» (демо)', type: 'supplier', res: 'heat' },
  { id: 'water', name: 'ГКП «Водоканал» (демо)', type: 'supplier', res: 'water' },
  { id: 'gas', name: 'ТОО «ГазСервис» (демо)', type: 'supplier', res: 'gas' },
  { id: 'osi1', name: 'ОСИ «Самал-2/1» (демо)', type: 'osi', blds: [0, 1, 2, 3, 4, 5] },
  { id: 'osi2', name: 'ОСИ «Самал-2/2» (демо)', type: 'osi', blds: [6, 7, 8, 9, 10, 11] },
  { id: 'akimat', name: 'Управление энергетики и ЖКХ (демо)', type: 'gov' },
  { id: 'audit', name: 'Служба внутреннего аудита (демо)', type: 'gov' },
  { id: 'platform', name: 'Esepshy, оператор платформы', type: 'platform' },
];

export const USERS = [
  { id: 'u-op1', name: 'Айгерим Сапарова', role: 'operator', org: 'erc' },
  { id: 'u-op2', name: 'Данияр Ахметов', role: 'operator', org: 'erc' },
  { id: 'u-debt', name: 'Мадина Ергалиева', role: 'debt', org: 'erc' },
  { id: 'u-head', name: 'Ерлан Касымов', role: 'head', org: 'erc' },
  { id: 'u-admin', name: 'Тимур Ли', role: 'admin', org: 'platform' },
  { id: 'u-el', name: 'Бауыржан Омаров', role: 'supplier', org: 'el' },
  { id: 'u-heat', name: 'Нурлан Жумабаев', role: 'supplier', org: 'heat' },
  { id: 'u-water', name: 'Сауле Абенова', role: 'supplier', org: 'water' },
  { id: 'u-gas', name: 'Руслан Тлеубаев', role: 'supplier', org: 'gas' },
  { id: 'u-osi1', name: 'Гульнара Искакова', role: 'osi', org: 'osi1' },
  { id: 'u-osi2', name: 'Марат Сеитов', role: 'osi', org: 'osi2' },
  { id: 'u-insp-w', name: 'Ержан Беков', role: 'inspector', org: 'water' },
  { id: 'u-insp-e', name: 'Алибек Нуров', role: 'inspector', org: 'el' },
  { id: 'u-insp-c', name: 'Самат Кенжебаев', role: 'inspector', org: 'erc' },
  { id: 'u-akim', name: 'Асель Нурланова', role: 'akimat', org: 'akimat' },
  { id: 'u-audit', name: 'Ольга Ким', role: 'auditor', org: 'audit' },
];

export const ISSUE_TYPES = {
  norm: { label: 'Норматив вместо показаний', short: 'Норматив' },
  dup: { label: 'Двойное начисление', short: 'Дубль' },
  tariff: { label: 'Неверный тариф', short: 'Тариф' },
  rev: { label: 'Показание меньше прежнего', short: 'Показание' },
  pay: { label: 'Платёж не разнесён', short: 'Платёж' },
  area: { label: 'Площадь не совпадает', short: 'Площадь' },
  upload: { label: 'Сумма не равна объём × тариф', short: 'Арифметика' },
};

export const ANOMALY_KINDS = {
  balance: 'Небаланс дома',
  spike: 'Скачок расхода',
  zero: 'Нулевой расход при жильцах',
};

export const VISIT_RESULTS = {
  leak: 'Утечка',
  bypass: 'Обход счётчика',
  broken: 'Неисправный счётчик',
  ok: 'Нарушений нет',
};

export const SEG = {
  low: { name: 'Низкий риск', act: 'Напоминание в WhatsApp/SMS', cls: 'ok' },
  mid: { name: 'Средний риск', act: 'Звонок и предложение рассрочки', cls: 'warn' },
  high: { name: 'Высокий риск', act: 'Досудебная претензия', cls: 'bad' },
};

export const OSI_RATE = 55;
export const HEAT_NORM_M2 = 0.019;
