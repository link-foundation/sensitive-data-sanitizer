import { sanitize, inspect } from '../../src/index.js';
const raw = '"\\",ООО\\\\\\"Р\\\\\\"\\""';
console.log(
  JSON.stringify(raw),
  inspect(JSON.stringify({ output: raw }), {
    profile: 'documents',
    structured: 'json',
  })
);
try {
  console.log(
    sanitize(JSON.stringify({ output: raw }), {
      profile: 'documents',
      structured: 'json',
    })
  );
} catch (e) {
  console.log(e.code);
}
for (const input of [
  'Education: МГУ',
  'Дети: нет\nуровень: info',
  'Компания: Ромашка Лютик',
  'С уважением,\nАнна',
  'учился в МГУ',
  'Директор (продажи), Ромашка (2019 – 2021)',
  'Менеджер, Ромашка (Москва) (2019 – 2021)',
  'Менеджер | Ромашка | 2019-01-01 — 2021-05-31',
  'Менеджер, Ромашка (2019 – 2021); Директор, Лютик (2021 – 2023)',
]) {
  for (const structured of [false, true]) {
    try {
      console.log(
        structured,
        input,
        '=>',
        sanitize(structured ? JSON.stringify({ note: input }) : input, {
          profile: 'documents',
          structured: structured ? 'json' : undefined,
        }).text
      );
    } catch (e) {
      console.log(input, e.code);
    }
  }
}
