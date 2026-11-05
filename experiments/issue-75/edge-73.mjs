// Probes #73 beyond the issue table: under-redaction, adjacency, legacy maps,
// streams, nested values, structured records and map round trips.
import {
  sanitize,
  restore,
  createRestoreMap,
  sanitizeStream,
} from '../../src/index.js';
const P = (map) => ({
  profile: 'documents',
  transformation: { mode: 'placeholder', map },
});
const seeded = (seed = 'Кандидат: Петров Данил.') => {
  const map = createRestoreMap();
  sanitize(seed, P(map));
  return map;
};
const show = (label, fn) => {
  try {
    console.log(label.padEnd(44), JSON.stringify(fn()));
  } catch (error) {
    console.log(label.padEnd(44), 'THROWS', error.code ?? error.message);
  }
};
const reuse = (row, map = seeded()) => {
  const { text } = sanitize(row, P(map));
  const back = restore(text, map);
  return {
    text,
    restored: back === row,
    values: map.entries.map((e) => e.values),
  };
};
for (const row of [
  'Петров Данил пришёл.',
  'петров данил пришёл.',
  'ПЕТРОВ ДАНИЛ пришёл.',
  'Данил Петров пришёл.',
  'Д. Петров пришёл.',
  'Петров Д. пришёл.',
  'Петрову Данилу позвонили.',
  'С Петровым Данилом говорили.',
  'Данил пришёл.',
  'Петров пришёл.',
  'петров пришёл.',
  'Алина Петрову позвонила.',
  'Мария Петрова пришла.',
  'Петров Данил Сергеевич пришёл.',
  'Петров Данил. Позже Петров ушёл.',
  'Петров Данил. Позже петров ушёл.',
  'Петров Данил и Алина петрову.',
  'Отзыв: Алина Сергеевна петрову, отдел.',
  'Петрову Алину видели.',
]) {
  show(row, () => reuse(row));
}
// A row from a map written by 0.15.0, polluted with a bare lowercase surface.
const legacy = () => ({
  ...createRestoreMap(),
  entries: [
    {
      type: 'PERSON',
      number: 1,
      token: 'Person-1',
      values: ['Петров Данил', 'петров', 'Данилу', 'петрову'],
      aliases: ['Петров Данил'],
    },
  ],
});
for (const row of [
  'Опыт: петров день, данил, мария.',
  'Отзыв: Алина петрову, отдел.',
  'Петров Данил.',
]) {
  show(`legacy ${row}`, () => reuse(row, legacy()));
}
show('own single value matched capitalised', () => {
  const map = seeded('Кандидат: Петров Данил.');
  map.entries.push({
    type: 'PERSON',
    number: 2,
    token: 'Person-2',
    values: ['Мороз'],
    aliases: ['Мороз'],
  });
  return sanitize('Сильный мороз. Мороз пришёл.', P(map)).text;
});
show('listed part survives JSON', () => {
  const map = createRestoreMap();
  const opts = {
    knownOnly: true,
    knownPersonal: [
      { type: 'PERSON', value: 'Петров Данил' },
      { type: 'PERSON', value: 'Петров' },
    ],
    transformation: { mode: 'placeholder', map },
  };
  const first = sanitize('Петров Данил. Петров.', opts).text;
  const saved = JSON.parse(JSON.stringify(map));
  return {
    first,
    entry: saved.entries,
    next: sanitize('Петров ушёл.', { ...P(saved) }).text,
  };
});
show('structured record', () => {
  const map = seeded();
  const input = JSON.stringify({
    name: 'Петров Данил',
    note: 'петров день',
    other: 'Алина петрову',
  });
  return sanitize(input, P(map)).text;
});
show('encoded value', () => {
  const map = createRestoreMap();
  const encoded = Buffer.from('Петров Данил').toString('base64');
  return sanitize(`Петров Данил ${encoded}. Позже Петров.`, P(map)).text;
});
const collected = async (parts, options) => {
  let out = '';
  for await (const chunk of sanitizeStream(parts, options)) {
    out += typeof chunk === 'string' ? chunk : (chunk.text ?? '');
  }
  return out;
};
try {
  console.log(
    'stream fresh'.padEnd(44),
    JSON.stringify(
      await collected(
        [
          'Петров Данил пришёл.\n'.padEnd(200, ' '),
          '\nПозже Петрову позвонили. Алина петрову.\n',
        ],
        P(createRestoreMap())
      )
    )
  );
  console.log(
    'stream seeded'.padEnd(44),
    JSON.stringify(
      await collected(
        ['Опыт: петров день.\n', 'Петров Данил.\n', 'Петрову позвонили.\n'],
        P(seeded())
      )
    )
  );
} catch (error) {
  console.log('stream THROWS', error.code ?? error.message);
}
