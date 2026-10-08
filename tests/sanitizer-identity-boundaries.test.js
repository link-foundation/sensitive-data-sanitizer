import { describe, it, expect } from 'test-anywhere';
import { inspect, sanitize, createSanitizer, redact } from '../src/index.js';
import { nationalIds, mrzData, specimen } from './fixtures/identity.js';

const layouts = [
  [
    'TD3',
    [
      'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<<',
      'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
    ],
  ],
  [
    'TD2',
    [
      'I<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<',
      'D231458907UTO7408122F1204159<<<<<<<6',
    ],
  ],
  [
    'TD1',
    [
      'I<UTOD231458907<<<<<<<<<<<<<<<',
      '7408122F1204159UTO<<<<<<<<<<<6',
      'ERIKSSON<<ANNA<MARIA<<<<<<<<<<<',
    ],
  ],
  [
    'MRV-A',
    [
      'V<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<<',
      'L898902C36UTO7408122F1204159<<<<<<<<<<<<<<<',
    ],
  ],
  [
    'MRV-B',
    [
      'V<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<',
      'L898902C36UTO7408122F1204159<<<<<<<',
    ],
  ],
];
describe('identity validation and boundary cases', () => {
  for (const [layout, sourceLines] of layouts) {
    const width =
      layout === 'TD1' ? 30 : ['TD3', 'MRV-A'].includes(layout) ? 44 : 36;
    const lines = sourceLines.map((line) =>
      line.slice(0, width).padEnd(width, '<')
    );
    it(`redacts complete and reflowed ${layout} documents`, () => {
      for (const separator of ['\n', ' ', '\r\n']) {
        expect(lines.every((line) => line.length === width)).toBe(true);
        const result = sanitize(lines.join(separator));
        expect(result.text.includes('ERIKSSON')).toBe(false);
        expect(result.text.includes('740812')).toBe(false);
      }
    });
  }
  it('detects soft wrapping between MRZ data groups', () => {
    const value = '5839204716\nRUS\n8204117\nM\n310519<<<<<<<<<<<<<<02';
    expect(sanitize(value).text).toBe('[REDACTED]');
  });
  it('scores intact checks higher while redacting corrupted checks', () => {
    const valid = 'L898902C36UTO7408122F1204159<<<<<<<<<<';
    const corrupt = 'L898902C30UTO7408120F1204150<<<<<<<<<<';
    expect(
      inspect(valid).find((f) => f.type === 'PASSPORT_MRZ').confidence
    ).toBe(0.99);
    expect(
      inspect(corrupt).find((f) => f.type === 'PASSPORT_MRZ').confidence
    ).toBe(0.85);
  });
});

describe('national checksum and identity policy boundaries', () => {
  for (const [type, value, label] of nationalIds) {
    it(`checks ${type} arithmetic and contextual confidence independently`, () => {
      expect(
        inspect(value).some((f) => f.type === type && f.confidence === 0.99)
      ).toBe(true);
      const last = value.at(-1),
        changed =
          value.slice(0, -1) +
          (/\d/.test(last)
            ? String((Number(last) + 1) % 10)
            : last === 'Z'
              ? 'A'
              : 'Z');
      expect(
        inspect(`${label} ${changed}`).some(
          (f) => f.type === type && f.confidence === 0.9
        )
      ).toBe(true);
      expect(
        inspect(`x${value}y`).some(
          (f) => f.type === type && f.rule === 'national-format'
        )
      ).toBe(false);
    });
  }
  for (const value of [
    'X583920471Y',
    'C3F7G9H2JA',
    'AAK8392047',
    'M583K20478',
    'YA83920470',
    '1 45 17 839204 2',
    'timestamp 583920471',
  ]) {
    it(`rejects passport substring ${value}`, () => {
      expect(inspect(value).some((f) => f.type === 'PASSPORT_NUMBER')).toBe(
        false
      );
    });
  }
});

describe('identity masking and exemption boundaries', () => {
  it('applies identity overrides despite overlapping generic ID context', () => {
    expect(
      sanitize('passport: 583920471', {
        transformations: {
          PASSPORT_NUMBER: {
            mode: 'mask',
            keepStart: 2,
            keepEnd: 2,
            marker: '***',
          },
        },
      }).text
    ).toBe('passport: 58***71');
    for (const [type, value] of nationalIds) {
      const chars = Array.from(value);
      const finding = [
        {
          start: 0,
          end: value.length,
          type,
          category: 'personal',
          rule: 'fixture',
        },
      ];
      expect(redact(value, finding, { identityMask: true })).toBe(
        `${chars.slice(0, 2).join('')}***${chars.slice(-2).join('')}`
      );
    }
    expect(
      redact(
        'ABCDE',
        [
          {
            start: 0,
            end: 5,
            type: 'ID',
            category: 'personal',
            rule: 'fixture',
          },
        ],
        {
          transformation: {
            mode: 'mask',
            keepStart: 1,
            keepEnd: 1,
            minLength: 6,
            marker: 'hidden',
          },
        }
      )
    ).toBe('[REDACTED]');
  });
  it('uses the fake policy in decoded external-detector views', async () => {
    const encoded = Buffer.from(specimen).toString('base64');
    const engine = createSanitizer({
      secretlint: false,
      fakeIdentity: 'specimen-and-synthetic',
      detectors: [
        {
          detect: (text) =>
            text.includes('ERIKSSON')
              ? [
                  {
                    start: 0,
                    end: text.length,
                    type: 'PASSPORT_MRZ',
                    category: 'personal',
                    rule: 'fixture',
                  },
                ]
              : [],
        },
      ],
    });
    expect((await engine.sanitize(encoded)).text).toBe(encoded);
    expect((await engine.sanitize(mrzData)).text).toBe('[REDACTED]');
  });
  it('preserves configured catalog masks while extending the preset to catalog identity types', () => {
    const output = sanitize('passport: 583920471', {
      transformations: {
        PASSPORT: { mode: 'mask', keepStart: 1, keepEnd: 1, marker: '~' },
      },
    }).text;
    expect(output).toBe('passport: 5~1');
    for (const type of [
      'AU_TAX_FILE_NUMBER',
      'UK_NHS_NUMBER',
      'CNRESIDENT_IDENTITY_CARD_NUMBER',
      'DRIVERS_LICENSE_NUMBER',
      'INDIA_AADHAAR_INDIVIDUAL',
    ]) {
      expect(
        redact(
          'AB12345CD',
          [{ start: 0, end: 9, type, category: 'personal', rule: 'fixture' }],
          { identityMask: true }
        )
      ).toBe('AB***CD');
    }
  });
  it('audits specimens, repeated values and reviewed values without trusting incoming kept flags', () => {
    for (const value of ['111111111', '123456789', '987654321']) {
      const options = { fakeIdentity: 'specimen-and-synthetic' };
      expect(sanitize(value, options).text).toBe(value);
      expect(inspect(value, options).some((f) => f.kept === 'fake')).toBe(true);
    }
    const finding = [
      {
        start: 0,
        end: mrzData.length,
        type: 'PASSPORT_MRZ',
        category: 'personal',
        rule: 'fixture',
        kept: 'fake',
      },
    ];
    expect(redact(mrzData, finding)).toBe('[REDACTED]');
  });
  it('keeps a specimen from exempting adjacent realistic MRZ data', () => {
    const header = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<<';
    const options = { fakeIdentity: 'specimen-and-synthetic' };
    for (const data of [mrzData, 'PASSPORT 583920471', 'NHS 943 476 5919']) {
      const result = sanitize(`${header}\n${data}`, options);
      expect(result.text.includes('583920471')).toBe(false);
      expect(result.text.includes('820411')).toBe(false);
      expect(result.text.includes('943 476 5919')).toBe(false);
    }
    expect(sanitize(specimen, options).text).toBe(specimen);
  });
});
