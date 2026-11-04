// Prints every row reported in issues #67-#70 with its current behavior.
// Run from the repository root: node experiments/issue-71/reproduce.mjs
import { sanitize, restore, createRestoreMap } from '../../src/index.js';

const key = 'example-key-0123456789abcdef';
const attempt = (text, options) => {
  try {
    const result = sanitize(text, options);
    return result.text;
  } catch (error) {
    return `THROW ${error.code}`;
  }
};
const person = (value) => ({
  knownOnly: true,
  knownPersonal: [{ type: 'PERSON', value }],
  transformation: { mode: 'placeholder' },
});
console.log('--- #67 known forms');
for (const [value, text] of [
  ['Петров Данил Сергеевич', 'с Петровым Данилом Сергеевичем.'],
  ['Данил Сергеевич', 'с Данилом Сергеевичем.'],
  ['Сергеевич', 'с Сергеевичем.'],
  ['Петров Данил Сергеевич', 'о Петрове Даниле Сергеевиче.'],
  ['Смирнова Алина Игоревна', 'со Смирновой Алиной Игоревной'],
  ['Петров Данил', 'с Петровым Данилом.'],
  ['Петров Данил Сергеевич', 'Данил Сергеевич Петров пришёл; Данилу Сергеевичу Петрову.'],
  ['Петров Данил Сергеевич', 'с Петровым Данилом.'],
  ['Семёнов Пётр', 'Семенов Петр'],
  ['Семенов Петр', 'Семёнов Пётр'],
  ['Петров Данил Сергеевич', 'Петров Д. С.; Петров Д.С.; Д. С. Петров; Петрову Д. С.'],
  ['Петров Данил Сергеевич', 'ПЕТРОВ ДАНИЛ СЕРГЕЕВИЧ'],
]) {
  console.log(`[${value}] ${text} => ${attempt(text, person(value))}`);
}
console.log('--- #68 fake identity');
const fake = (type, value) => ({
  knownOnly: true,
  knownPersonal: [{ type, value }],
  transformation: { mode: 'fake', key },
});
for (const [type, value, text] of [
  ['PERSON', 'Петров', 'Петров пришёл. Позвонили Петрову. Нет Петрова. С Петровым.'],
  ['PERSON', 'Смирнова Алина', 'Смирнова Алина. Смирновой Алине. Алину Смирнову.'],
  ['PERSON', 'Петров Данил Сергеевич', 'Петров Данил Сергеевич. Петрову Данилу Сергеевичу. Данила Сергеевича Петрова.'],
  ['ORGANIZATION', 'Ромашка', 'Работал в ООО «Ромашка», затем снова в Ромашке.'],
  ['LOCATION', 'Кострома', 'Живу в Костроме, родом из Костромы.'],
]) {
  console.log(`[${value}] ${text}\n  => ${attempt(text, fake(type, value))}`);
}
console.log('--- #69 residual');
for (const text of [
  'Telegram: @Janedoe2024/jane_doe@example.com',
  'Telegram/Email: @JaneDoe/jane@example.com',
  'tg: @jane_doe / jane_doe@example.com',
  'Опыт в компании Вектор-99, отдел продаж',
  'в компании Вектор-99 и в компании Гранит-7, позже в компании Вектор-99',
  'в компании Альфа-1',
  'Работал в компании Вектор-1, затем Вектор-2.',
]) {
  console.log(`${text}\n  => ${attempt(text, { transformation: { mode: 'placeholder' } })}`);
  console.log(`  documents => ${attempt(text, { profile: 'documents', transformation: { mode: 'placeholder', map: createRestoreMap() } })}`);
  console.log(`  default => ${attempt(text, {})}`);
}
const map = createRestoreMap();
for (const text of ['Работал в компании Вектор-1.', 'Работал в компании Вектор-2.', 'Вектор и Вектор-1.', 'Опыт в компании Вектор-99, отдел продаж', 'Telegram: @Janedoe2024/jane_doe@example.com']) {
  const output = attempt(text, { profile: 'documents', transformation: { mode: 'placeholder', map } });
  console.log(`shared ${text} => ${output}`);
  if (!output.startsWith('THROW')) {
    console.log(`  restored: ${restore(output, map) === text}`);
  }
}
console.log('--- #70 experience lines');
for (const text of [
  'Менеджер по продажам, Северная торговая компания (2019-05 – 2021-03)',
  'Ведущий инженер, Ромашка (2018-01 – 2020-12)',
  'QA engineer, Acme Solutions (2020-02 – 2023-06)',
  'Аналитик, «Северный ветер» (2018-01 – 2020-12)',
  'Менеджер, Северная торговая компания (май 2019 — март 2021)',
  'Менеджер по продажам — Северная торговая компания, 2019–2021',
  'Менеджер (Северная торговая компания), 2019–2021',
  'Руководитель отдела, ООО Ромашка (2018-01 – 2020-12)',
]) {
  console.log(`${text}\n  => ${attempt(text, { profile: 'documents', transformation: { mode: 'placeholder', format: '[{TYPE}_{n}]', map: false } })}`);
}
