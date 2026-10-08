import { describe, it, expect } from 'test-anywhere';
import { inspect, sanitize, createSanitizer, redact } from '../src/index.js';
import {
  mrzName,
  mrzData,
  specimen,
  nationalIds,
} from './fixtures/identity.js';

describe('travel and identity regressions (#3–#8, #11)', () => {
  for (const value of [
    mrzName,
    mrzData,
    mrzData.slice(0, 28),
    mrzData.slice(0, 19),
    mrzData.slice(0, 23),
    'P<RUS KOVALEVA<<MARINA <<<<<<<<<<<<<<<<<<<<<<',
    '5839204716 RUS 8204117 M 310519< <<<<<<<<<<<<<<02',
    'I<UTOD231458907<<<<<<<<<<<<<<<',
    '7408122F1204159UTO<<<<<<<<<<<6',
    'ERIKSSON<<ANNA<MARIA<<<<<<<<<<<',
    'I<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<',
    'V<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
    'L898902C36UTO7408122F1204159<<<<<<<<<<',
    'L898902C30UTO7408120F1204150<<<<<<<<<<',
  ]) {
    it(`detects MRZ ${value.slice(0, 16)} with or without valid checks`, () => {
      expect(inspect(value).some((f) => f.type === 'PASSPORT_MRZ')).toBe(true);
      expect(sanitize(value).text).toBe('[REDACTED]');
    });
  }
  it('detects MRZ in escaped JSON and blocks residual MRZ from an engine', async () => {
    const input = JSON.stringify({ text: `${mrzName}\n${mrzData}` });
    expect(JSON.parse(sanitize(input).text).text.includes('KOVALEVA')).toBe(
      false
    );
    const engine = createSanitizer({
      secretlint: false,
      detectors: [
        {
          detect: (text) =>
            text.includes('[REDACTED]')
              ? [
                  {
                    start: 0,
                    end: 1,
                    type: 'PASSPORT_MRZ',
                    category: 'personal',
                    rule: 'residual-fixture',
                  },
                ]
              : [],
        },
      ],
    });
    let code;
    try {
      await engine.sanitize(mrzName);
    } catch (error) {
      code = error.code;
    }
    expect(code).toBe('ERR_RESIDUAL');
  });
  for (const value of [
    '<'.repeat(50),
    'vector<<int>>',
    Buffer.from('ordinary binary-free text').toString('base64'),
  ]) {
    it('rejects unrelated MRZ-like syntax', () => {
      expect(inspect(value).some((f) => f.type === 'PASSPORT_MRZ')).toBe(false);
    });
  }
  for (const value of [
    '45 17 839204',
    '4517 839204',
    '75 4930281',
    '583920471',
    'C3F7G9H2J',
    'K8392047',
    'M583K2047',
    'YA8392047',
    'L898902C36',
  ]) {
    it(`detects a standalone passport shape ${value}`, () => {
      expect(inspect(value).some((f) => f.type === 'PASSPORT_NUMBER')).toBe(
        true
      );
    });
  }
  for (const word of [
    'passport',
    'паспорт',
    'загран',
    'загранпаспорт',
    'серия',
    'номер',
    'pasaporte',
    'Reisepass',
    'passeport',
    'passaporto',
    '护照',
    'パスポート',
  ]) {
    it(`uses loose ${word} passport context`, () => {
      const low = inspect('583920471').find(
        (f) => f.type === 'PASSPORT_NUMBER'
      );
      const high = inspect(`${word} issued yesterday: 583920471`).find(
        (f) => f.type === 'PASSPORT_NUMBER'
      );
      expect(high.confidence > low.confidence).toBe(true);
    });
  }
});

describe('travel booking and birth-date contexts', () => {
  for (const [input, value, type] of [
    ['booking reference K7QWZP', 'K7QWZP', 'BOOKING_REFERENCE'],
    ['PNR: XKJHQZ, record locator XKJHQZ', 'XKJHQZ', 'BOOKING_REFERENCE'],
    ['код брони K7QWZP', 'K7QWZP', 'BOOKING_REFERENCE'],
    ['reservation code A9WX3', 'A9WX3', 'BOOKING_REFERENCE'],
    ['confirmation code K7QWZP8', 'K7QWZP8', 'BOOKING_REFERENCE'],
    ['e-ticket 098-2401234567', '098-2401234567', 'TICKET_NUMBER'],
    ['e-visa registration code E260512ABCDEF', 'E260512ABCDEF', 'VISA_NUMBER'],
    ['номер визы VN5839204', 'VN5839204', 'VISA_NUMBER'],
  ]) {
    it(`redacts ${type} in loose travel context`, () => {
      expect(
        inspect(input).some((f) => f.type === type && f.category === 'personal')
      ).toBe(true);
      expect(sanitize(input).text.includes(value)).toBe(false);
    });
  }
  for (const input of [
    'booking reference: NONE',
    'booking reference: UNKNOWN',
    'booking HOTEL',
    'git short SHA abcdef7',
    '2026-10-08T09:54:05Z version 45.17.839204',
    'call_583920471abcd thread_9434765919',
    '+7 912 555 0142',
  ]) {
    it('avoids travel matches in unrelated numbers and placeholders', () => {
      expect(
        inspect(input).some((f) =>
          [
            'PASSPORT_NUMBER',
            'BOOKING_REFERENCE',
            'TICKET_NUMBER',
            'VISA_NUMBER',
          ].includes(f.type)
        )
      ).toBe(false);
    });
  }
  for (const input of [
    'she was born on 07/12/1985 in Kazan',
    'All correct - real DOB `02/03/1990`',
    'birth date 1985-12-07',
    'дата рождения 07.12.1985',
    'д.р. 07.12.1985',
    'родилась 7 декабря 1985 года',
    'родился 07 декабря 1985',
    'Geburtsdatum 1985-12-07',
    'fecha de nacimiento: 07/12/1985',
    'date de naissance 07/12/1985',
    'born December 7, 1985',
    'birth date 7 Dec 1985',
  ]) {
    it('redacts contextual birth dates and preserves surrounding prose', () => {
      expect(inspect(input).some((f) => f.type === 'DATE_OF_BIRTH')).toBe(true);
      expect(
        sanitize(input).text.includes('1985') ||
          sanitize(input).text.includes('1990')
      ).toBe(false);
    });
  }
  it('keeps ordinary dates', () => {
    const input =
      'commit date 1985-12-07 release 07/12/1985 on December 7, 1985';
    expect(sanitize(input).text).toBe(input);
  });
});

describe('national IDs and identity policies', () => {
  for (const [type, value, label] of nationalIds) {
    it(`detects ${type} with common ${label} label`, () => {
      expect(inspect(`${label}: ${value}`).some((f) => f.type === type)).toBe(
        true
      );
    });
  }
  for (const [type, value] of nationalIds.filter(([type]) =>
    ['UK_NHS', 'RU_SNILS', 'RU_INN', 'ZA_ID_NUMBER'].includes(type)
  )) {
    it(`retains low-confidence checksum-valid bare ${type} for inspection`, () => {
      expect(
        inspect(value).some((f) => f.type === type && f.confidence === 0.35)
      ).toBe(true);
    });
  }
  it('uses fixed 2+2 identity masks and counts Unicode characters', () => {
    expect(sanitize(mrzData, { identityMask: true }).text).toBe('58***02');
    for (const value of [
      'A',
      'AB',
      'ABC',
      'ABCD',
      'ABCDE',
      'AB123456789CD',
      '😀AB😀C',
    ]) {
      const finding = [
        {
          start: 0,
          end: value.length,
          type: 'PASSPORT_NUMBER',
          category: 'personal',
          rule: 'fixture',
        },
      ];
      const text = redact(value, finding, {
        transformations: {
          PASSPORT_NUMBER: {
            mode: 'mask',
            keepStart: 2,
            keepEnd: 2,
            marker: '***',
          },
        },
      });
      const chars = Array.from(value);
      expect(text).toBe(
        chars.length < 5
          ? '[REDACTED]'
          : `${chars.slice(0, 2).join('')}***${chars.slice(-2).join('')}`
      );
    }
  });
  it('keeps only explicitly fake identity values and audits exemptions', async () => {
    const options = {
      fakeIdentity: 'specimen-and-synthetic',
      secretlint: false,
    };
    const engine = createSanitizer(options);
    expect((await engine.sanitize(specimen)).text).toBe(specimen);
    expect(
      (await engine.inspect(specimen)).every((f) => f.kept === 'fake')
    ).toBe(true);
    const fake = '9876543217RUS9001014F300101<<<<<<<<<<<<<<02';
    expect(sanitize(fake, options).text).toBe(fake);
    expect(
      sanitize(`test passport: ${mrzData}`, options).text.includes('583920471')
    ).toBe(false);
    expect(
      sanitize('example passport 58 39 204716', options).text.includes('204716')
    ).toBe(false);
    expect(sanitize('passport SPECIMEN', options).text).toBe(
      'passport SPECIMEN'
    );
    expect(sanitize(mrzData, { fakeValues: [mrzData] }).text).toBe(mrzData);
    expect(
      sanitize(mrzData, { fakeValues: [mrzData], knownSecrets: [mrzData] }).text
    ).toBe('[REDACTED]');
    expect(sanitize('password: 123456789', options).text).toBe(
      'password: [REDACTED]'
    );
  });
});
