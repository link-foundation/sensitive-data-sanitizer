// Synthetic, bounded, interleaved comparison. Run with --max-old-space-size=256.
import { createSyncSanitizer } from '../../src/index.js';
import { performance } from 'node:perf_hooks';
const base = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: { mode: 'placeholder', map: false },
};
const words = [
  'кабардинец',
  'кабардинка',
  'казашка',
  'мордвин',
  'мордовка',
  'удмурт',
  'удмуртка',
  'молдаванин',
  'молдаванка',
  'Uzbek',
  'Tajik',
  'Chechen',
  'Romani',
  'Gypsy',
  'Latino',
  'Latina',
  'иудаизм',
  'старовер',
  'староверка',
  'Baptist',
  'эпилептик',
  'паралич',
  'наркомания',
  'AIDS',
  'bipolar',
  'ADHD',
  'wheelchair',
  'LGBT',
  'convicted',
  'felony',
  'профсоюз',
  'trade union',
  'коммунист',
  'коммунистка',
];
const variants = [
  ['base', base],
  ['empty', { ...base, vocabulary: {} }],
  ['empty attributes', { ...base, vocabulary: { personalAttributes: [] } }],
  [
    'one attribute',
    { ...base, vocabulary: { personalAttributes: ['старовер'] } },
  ],
  ['34 attributes', { ...base, vocabulary: { personalAttributes: words } }],
  [
    'keep',
    { ...base, transformation: { ...base.transformation, existing: 'keep' } },
  ],
];
const inputs = [
  [
    'prose',
    'Работал в компании Ромашка менеджером по продажам с 2019 года. '.repeat(
      16
    ),
    {},
  ],
  [
    'json',
    JSON.stringify({ level: 'INFO', msg: 'request completed', ms: 12 }),
    { structured: 'json' },
  ],
  [
    'preview',
    JSON.stringify({
      level: 'INFO',
      preview: 'Работал в компании Ромашка менеджером по продажам с 2019 года.',
    }),
    { structured: 'json' },
  ],
];
const rows = [];
for (const [input, text, options] of inputs) {
  const engines = variants.map(([name, extra]) => ({
    name,
    engine: createSyncSanitizer({ ...extra, ...options }),
    samples: [],
  }));
  for (const { engine } of engines) {
    engine.sanitize(text);
  }
  for (let round = 0; round < 5; round++) {
    for (let index = 0; index < engines.length; index++) {
      const entry = engines[(index + round) % engines.length];
      const start = performance.now();
      for (let i = 0; i < 5; i++) {
        entry.engine.sanitize(text);
      }
      entry.samples.push((performance.now() - start) / 5);
    }
  }
  for (const { name, samples } of engines) {
    rows.push({
      input,
      variant: name,
      medianMs: Number(samples.sort((a, b) => a - b)[2].toFixed(3)),
    });
  }
}
console.log(JSON.stringify(rows, null, 2));
