import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const lib = await import(
  pathToFileURL(resolve(process.argv[2] ?? 'src/index.js')).href
);
const s = lib.createSyncSanitizer({
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: {
    mode: 'placeholder',
    map: false,
    credentials: true,
    existing: 'keep',
  },
});
for (const t of [
  'диагноз: СПИД',
  'диагноз: ВИЧ',
  'СПИД',
  'у кандидата ПТСР',
  'в детстве ставили СДВГ',
  'состоит в ЛГБТ сообществе',
  'candidate mentioned PTSD',
  'у него спид',
  'у ребенка сдвг',
  'кандидат: птср',
  'лгбт сообщество',
  'has ptsd',
  'у неё вич-инфекция',
  'вич-инфекция',
  'ВИЧ-инфекция',
  'спидометр сломан',
  'у него вич',
]) {
  let out;
  try {
    out = JSON.stringify(s.sanitize(t).text);
  } catch (e) {
    out = e.code;
  }
  console.log(JSON.stringify(t), '->', out);
}
console.log(
  JSON.stringify(
    lib
      .inspect('Город: Москва, офис у метро', { profile: 'documents' })
      .map((f) => [f.type, f.start, f.end, f.rule])
  )
);
console.log(lib.inspect('Город: Казань', { profile: 'documents' }).length);
