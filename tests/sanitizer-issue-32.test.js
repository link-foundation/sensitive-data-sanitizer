import { describe, it, expect } from 'test-anywhere';
import { boundedProbe } from './bounded-probe.js';
import {
  createSanitizer,
  inspect,
  sanitize,
  sanitizeStream,
} from '../src/index.js';

const filenames = [
  'KOVALEVA_MARINA_PASSPORT.jpg',
  'IVANOV_IVAN_SCAN.pdf',
  'KUZNETSOVA-EKATERINA-ID.png',
  'SIDOROV_ALEKSEI_PHOTO.png',
  'SIDOROV-ALEKSEI-PHOTO.png',
  'TKACHENKO_BOGDAN_VISA.pdf',
  'ZHANG_WEI_PASSPORT.pdf',
  'NGUYEN_VAN_AN_PASSPORT.jpg',
  'scan_passport_kovaleva_marina.jpg',
  'ПАСПОРТ_Ковалева_Марина.pdf',
  'ВИЗА_Ковалева_Марина.pdf',
  'СКАН_Ковалева_Марина.pdf',
  'ФОТО_Ковалева_Марина.pdf',
];
const pairs = [
  'Alexey Sidorov',
  'Ekaterina Kuznetsova',
  'for Olesya Zyryanova',
  'Zyryanova Olesya',
  'Aleksei Sidorov',
  'Alexei Sidorov',
  'Aleksey Sidorov',
  'Bogdan Tkachenko',
  'Ковалева Марина',
  'Зырянова Олеся',
  'ALEKSEY SIDOROV',
  'Olesia Zyryanova',
];
async function stream(input, options) {
  let output = '';
  for await (const chunk of sanitizeStream([input], options)) {
    output += chunk;
  }
  return output;
}
describe('issue 32 name and identity regressions', () => {
  it('bounds document-name guards on a finite hostile tab suffix', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const probe = await boundedProbe(
      'experiments/issue-32/document-whitespace.mjs'
    );
    expect(probe.bytes > 128 * 1024).toBe(true);
    expect(probe.milliseconds < 1000).toBe(true);
  });
  for (const input of [...filenames, ...pairs]) {
    it(`protects ${input}`, async () => {
      expect(sanitize(input).redactions > 0).toBe(true);
      expect((await createSanitizer().sanitize(input)).redactions > 0).toBe(
        true
      );
    });
  }
  for (const input of ['112-233-445 95', '112 233 445 95', '487-192-053 19']) {
    it(`scores formatted SNILS ${input} as strong`, () => {
      expect(
        inspect(input).find((f) => f.type === 'RU_SNILS').confidence >= 0.85
      ).toBe(true);
      expect(sanitize(input).text).toBe('[REDACTED]');
    });
  }
  for (const label of [
    'пенсионное',
    'страховое свидетельство',
    'СНИЛС',
    'страховой номер',
  ]) {
    it(`recognizes SNILS context ${label}`, () => {
      expect(
        inspect(`${label} 11223344595`).some(
          (f) => f.type === 'RU_SNILS' && f.confidence >= 0.85
        )
      ).toBe(true);
    });
  }
  for (const input of ['500100732259', '771829456048']) {
    it(`protects a bare personal INN ${input}`, () => {
      expect(
        inspect(input).find((f) => f.type === 'RU_INN').confidence > 0.5
      ).toBe(true);
      expect(sanitize(input).text).toBe('[REDACTED]');
    });
  }
  for (const label of [
    'series and number',
    'passport series',
    'document number',
  ]) {
    it(`recognizes English passport context ${label}`, () => {
      expect(
        inspect(`${label}: 46 21 573918`).some(
          (f) => f.type === 'PASSPORT_NUMBER' && f.confidence >= 0.85
        )
      ).toBe(true);
    });
  }
  it('propagates confirmed names between scripts', () => {
    for (const input of [
      'ФИО: Зырянова Олеся\nфайл zyryanova.pdf',
      'P<RUSZYRYANOVA<<OLESYA<<<<<<<<<<<<<<<<<<<<<<\nфайл Зырянова.pdf',
    ]) {
      expect(
        sanitize(input).text.toLowerCase().includes('zyryanova') ||
          sanitize(input).text.includes('Зырянова')
      ).toBe(false);
    }
  });
  it('propagates GOST diacritic spellings back to Cyrillic', () => {
    const input = 'Applicant: Qazvela Malyševa\nsaved Малышева.pdf';
    expect(sanitize(input).text.includes('Малышева')).toBe(false);
  });
  it('provides the publication profile without changing numeric-noise negatives', async () => {
    for (const input of ['46 21 573918', '4621 573918']) {
      const output = await createSanitizer({ profile: 'publication' }).sanitize(
        input
      );
      expect(output.text.includes('573918')).toBe(false);
    }
    for (const input of ['ts=1696023757', 'order 1015032381']) {
      expect(sanitize(input, { profile: 'publication' }).text).toBe(input);
    }
  });
});
describe('issue 32 public and code negatives', () => {
  for (const input of [
    'Linus Torvalds',
    'Elon Musk tweeted',
    'Bill Gates',
    'Nelson Mandela',
    'Satya Nadella',
    'Tim Cook',
    'Grace Hopper',
    'Sergey Brin founded Google',
    'Pavel Durov said',
    'Vladimir Putin',
    'Marina Bay Sands hotel',
    'Marina Sands',
    'Marina Hotel',
    'Marina Street',
    'const userName = getUserName();',
    'const userName = user.name;',
    'const userName = existingUserName;',
    'state:\nt',
    ...[
      'FAILED',
      'ERROR',
      'HTTP',
      'PENDING',
      'OK',
      'CANCELLED',
      'CONFIRMED',
    ].map((v) => `Booking ${v} today`),
    'reservation HTTP 500',
  ]) {
    it(`keeps ${input}`, async () => {
      expect(sanitize(input).text).toBe(input);
      expect((await createSanitizer().sanitize(input)).text).toBe(input);
    });
  }
  it('retains private namesake and credential precedence', () => {
    expect(sanitize('patient: Sergey Brin').redactions > 0).toBe(true);
    expect(
      sanitize('Sergey Brin', {
        knownPersonal: [{ type: 'PERSON', value: 'Sergey Brin' }],
      }).text
    ).toBe('[REDACTED]');
  });
  it('keeps Russian mobile fakes in a mobile range', () => {
    const output = sanitize('phone +7 912 555-01-42', {
      transformation: { mode: 'fake', key: 'private-issue-32-key' },
    }).text;
    expect(/^phone \+7 9\d{2} \d{3}-\d{2}-\d{2}$/.test(output)).toBe(true);
    expect(output).not.toBe('phone +7 912 555-01-42');
  });
});
describe('issue 32 real-shaped session records', () => {
  const input = `${[
    { toolUseResult: { file: { content: '\nasync applicant is\nasync f' } } },
    { payload: { item: { content: [{ text: 'state:\nt' }] } } },
    {
      toolUseResult: {
        file: {
          content:
            'diff --git a/app.js b/app.js\n+const userName = getUserName();\n\tstate:\nq',
        },
      },
    },
    {
      payload: {
        item: {
          content: [
            { text: 'PASS test\nBooking FAILED today\nreservation HTTP 500' },
          ],
        },
      },
    },
  ]
    .map(JSON.stringify)
    .join('\n')}\n`;
  it('sanitizes valid JSONL without split escapes or residuals', async () => {
    expect((await createSanitizer().sanitizeJsonl(input)).text).toBe(input);
    for (const line of input.trim().split('\n')) {
      expect(JSON.parse((await createSanitizer().sanitize(line)).text)).toEqual(
        JSON.parse(line)
      );
    }
  });
  for (const workers of [1, 4]) {
    it(`supports real-shaped sessions with ${workers} workers`, async () => {
      expect(
        await stream(input, { structured: 'jsonl', workers, batchBytes: 1 })
      ).toBe(input);
    });
    it(`propagates confirmations across distant batches with ${workers} workers`, async () => {
      const records = [
        { text: 'Applicant: Qazvela Zorveta' },
        ...Array.from({ length: 8 }, (_, i) => ({
          i,
          text: 'ordinary output',
        })),
        { text: 'saved qazvela.pdf' },
      ]
        .map(JSON.stringify)
        .join('\n');
      const output = await stream(records, {
        structured: 'jsonl',
        workers,
        batchBytes: 1,
      });
      expect(output.toLowerCase().includes('qazvela')).toBe(false);
    });
    it(`fails closed on a late confirmation with ${workers} workers`, async () => {
      let code;
      try {
        await stream(
          '{"text":"qazvela.pdf"}\n{"text":"Applicant: Qazvela Zorveta"}\n',
          { structured: 'jsonl', workers, batchBytes: 1 }
        );
      } catch (error) {
        code = error.code;
      }
      expect(code).toBe('ERR_LATE_PERSONAL');
    });
  }
});
