import { describe, it, expect } from 'test-anywhere';
import { parse } from 'mrz';
import { sanitize, createSanitizer, redact, inspect } from '../src/index.js';
import { mrzCheck } from '../src/identity.js';
import * as checks from '../src/national-checks.js';
import { nationalIds } from './fixtures/identity.js';
import { nameExamples } from '../src/names.js';

const key = 'private-fixture-key-at-least-16-bytes';
const options = { transformation: { mode: 'fake', key } };
function fake(value, type, transform = options.transformation) {
  return redact(
    value,
    [
      {
        start: 0,
        end: value.length,
        type,
        category: 'personal',
        rule: 'fixture',
      },
    ],
    { transformation: transform }
  );
}
describe('realistic keyed fake transformations', () => {
  for (const [locale, value] of nameExamples) {
    it(`keeps the script of ${locale} names`, () => {
      const output = fake(value, 'PERSON');
      expect(output === value).toBe(false);
      for (const script of [
        'Latin',
        'Cyrillic',
        'Arabic',
        'Hebrew',
        'Devanagari',
        'Thai',
        'Han',
        'Hangul',
      ]) {
        const pattern = new RegExp(`\\p{Script=${script}}`, 'u');
        if (pattern.test(value)) {
          expect(pattern.test(output)).toBe(true);
        }
      }
    });
  }
  for (const type of [
    'UK_NHS_NUMBER',
    'AU_TAX_FILE_NUMBER',
    'SOUTH_AFRICA_ID_NUMBER',
  ]) {
    it(`validates the ${type} catalog alias`, () => {
      const [base, value] = {
        UK_NHS_NUMBER: nationalIds[0],
        AU_TAX_FILE_NUMBER: nationalIds[7],
        SOUTH_AFRICA_ID_NUMBER: nationalIds[6],
      }[type];
      expect(fake(value, type)).toBe(fake(value, base));
    });
  }
  it('generates valid Luhn cards, dotted CPF and NPI', () => {
    const card = fake('4111 1111 1111 1111', 'CREDIT_CARD');
    expect(checks.shortLuhn(card)).toBe(true);
    expect(card.startsWith('4111 11')).toBe(true);
    expect(
      inspect(fake('529.982.247-25', 'BRAZIL_CPF_NUMBER')).some(
        (f) => f.type === 'BRAZIL_CPF_NUMBER'
      )
    ).toBe(true);
    expect(
      checks.shortLuhn(`80840${fake('1234567893', 'US_HEALTHCARE_NPI')}`)
    ).toBe(true);
  });
  it('shares valid payment-card fakes across card catalog aliases', () => {
    const value = '4111 1111 1111 1111';
    for (const type of ['CREDIT_CARD_NUMBER', 'CREDIT_DEBIT_NUMBER']) {
      const output = fake(value, type);
      expect(output).toBe(fake(value, 'CREDIT_CARD'));
      expect(checks.shortLuhn(output)).toBe(true);
      expect(output.startsWith('4111 11')).toBe(true);
    }
  });
  for (const width of [30, 36]) {
    it(`generates independently valid ${width === 30 ? 'TD1' : 'TD2'} MRZ`, () => {
      const number = '583920471',
        birth = '820411',
        expiry = '310519';
      let lines;
      if (width === 30) {
        const header = `I<RUS${number}${mrzCheck(number)}${'<'.repeat(15)}`;
        let data = `${birth + mrzCheck(birth)}F${expiry}${mrzCheck(
          expiry
        )}RUS${'<'.repeat(11)}`;
        data += mrzCheck(
          header.slice(5, 30) +
            data.slice(0, 7) +
            data.slice(8, 15) +
            data.slice(18, 29)
        );
        lines = [header, data, 'KOVALEVA<<MARINA'.padEnd(30, '<')];
      } else {
        let data = `${number + mrzCheck(number)}RUS${birth}${mrzCheck(birth)}F${
          expiry
        }${mrzCheck(expiry)}${'<'.repeat(7)}`;
        data += mrzCheck(
          data.slice(0, 10) + data.slice(13, 20) + data.slice(21, 35)
        );
        lines = ['I<RUSKOVALEVA<<MARINA'.padEnd(36, '<'), data];
      }
      const output = sanitize(lines.join('\n'), options).text.split('\n');
      expect(parse(output).valid).toBe(true);
      expect(output.join('').includes(number)).toBe(false);
    });
  }
});
describe('keyed faking and cross-field consistency', () => {
  it('is stable per key and changes with the key', () => {
    const input = 'Applicant: Marina Kovaleva';
    expect(sanitize(input, options).text).toBe(sanitize(input, options).text);
    expect(
      sanitize(input, options).text ===
        sanitize(input, {
          transformation: { mode: 'fake', key: 'another-private-fixture-key' },
        }).text
    ).toBe(false);
    expect(
      sanitize(input, options).findings.some((f) => f.faked === true)
    ).toBe(true);
  });
  it('keeps Russian script, gender, patronymics and transliteration consistent', () => {
    const cyrillic = fake('Ковалева Марина Сергеевна', 'PERSON');
    const latin = fake('KOVALEVA-MARINA', 'PERSON');
    expect(/^[А-Яа-яЁё]+ [А-Яа-яЁё]+ [А-Яа-яЁё]+вна$/.test(cyrillic)).toBe(
      true
    );
    expect(cyrillic.includes('Ковалева')).toBe(false);
    expect(latin.includes('KOVALEVA')).toBe(false);
    expect(
      fake('marina kovaleva', 'PERSON')
        .split(' ')
        .map((v) => v.toUpperCase())
        .reverse()
        .join('-')
    ).toBe(latin);
  });
  for (const value of ['07/12/1985', '1985-12-07', '07.12.1985']) {
    it(`generates valid plausible ${value}`, () => {
      const output = fake(value, 'DATE_OF_BIRTH');
      expect(output === value).toBe(false);
      const d = output.includes('-')
        ? output.split('-')
        : output.split(/[/.]/).reverse();
      const date = new Date(`${d[0]}-${d[1]}-${d[2]}T00:00:00Z`);
      expect(Number.isNaN(date.getTime())).toBe(false);
      expect(date.getUTCFullYear() < 2008 && date.getUTCFullYear() > 1900).toBe(
        true
      );
    });
  }
  it('uses a shared date offset across formats', () => {
    expect(fake('1985-12-07', 'DATE_OF_BIRTH')).toBe(
      fake('07/12/1985', 'DATE_OF_BIRTH').split('/').reverse().join('-')
    );
  });
  const validators = {
    UK_NHS: checks.nhs,
    KR_RRN: checks.rrn,
    IT_FISCAL_CODE: checks.fiscalCode,
    SG_NRIC_FIN: checks.nric,
    PL_PESEL: checks.pesel,
    SE_PERSONNUMMER: checks.personnummer,
    ZA_ID_NUMBER: checks.southAfricanId,
    AU_TFN: checks.tfn,
    CA_SIN: checks.shortLuhn,
    RU_SNILS: checks.snils,
    RU_INN: checks.inn,
  };
  for (const [type, value] of nationalIds) {
    it(`generates valid same-format ${type} ${value.length}`, () => {
      const output = fake(value, type);
      expect(output.length).toBe(value.length);
      expect(output === value).toBe(false);
      expect(validators[type](output)).toBe(true);
      expect(output.replace(/[A-Z]/g, 'A').replace(/\d/g, '0')).toBe(
        value.replace(/[A-Z]/g, 'A').replace(/\d/g, '0')
      );
    });
  }
});
describe('national date century consistency', () => {
  for (const [type, prefix, validate] of [
    ['PL_PESEL', '0021011234', checks.pesel],
    ['SE_PERSONNUMMER', '20000101123', checks.personnummer],
  ]) {
    it(`shares the calendar offset across the century boundary for ${type}`, () => {
      const value = Array.from({ length: 10 }, (_, i) => prefix + i).find(
        validate
      );
      const output = fake(value, type);
      const date = fake('2000-01-01', 'DATE_OF_BIRTH');
      if (type === 'SE_PERSONNUMMER') {
        expect(output.slice(0, 8)).toBe(date.replaceAll('-', ''));
      } else {
        const month = Number(output.slice(2, 4));
        const century = [1900, 2000, 2100, 2200, 1800][Math.floor(month / 20)];
        expect(
          `${century + Number(output.slice(0, 2))}-${String(month % 20).padStart(2, '0')}-${output.slice(4, 6)}`
        ).toBe(date);
      }
      expect(validate(output)).toBe(true);
    });
  }
});
describe('fake contact values and provenance', () => {
  it('keeps country code and separators and uses reserved NANP/UK ranges', () => {
    for (const value of [
      '+7 912 555-01-42',
      '+1 (212) 234-5678',
      '+44 7911 123456',
    ]) {
      const output = fake(value, 'PHONE');
      expect(output.split(' ')[0]).toBe(value.split(' ')[0]);
      expect(output.length).toBe(value.length);
      expect(output === value).toBe(false);
      if (value.startsWith('+1')) {
        expect(/55501\d{2}$/.test(output.replace(/\D/g, ''))).toBe(true);
      }
      if (value.startsWith('+44')) {
        expect(/^447700900\d{3}$/.test(output.replace(/\D/g, ''))).toBe(true);
      }
    }
  });
  it('keeps reserved email and domain destinations', () => {
    expect(/@example\.com$/.test(fake('john@private.org', 'EMAIL'))).toBe(true);
    expect(/\.test$/.test(fake('private.org', 'DOMAIN_NAME'))).toBe(true);
  });
  it('keeps IBAN country, spacing, length and independent mod-97 validity', () => {
    const value = 'GB82 WEST 1234 5698 7654 32';
    const output = fake(value, 'IBAN');
    expect(output.length).toBe(value.length);
    expect(output.startsWith('GB')).toBe(true);
    expect(output === value).toBe(false);
    const compact = output.replaceAll(' ', '');
    const digits = (compact.slice(4) + compact.slice(0, 4)).replace(
      /[A-Z]/g,
      (letter) => String(letter.charCodeAt(0) - 55)
    );
    expect(BigInt(digits) % 97n).toBe(1n);
  });
  it('does not let generated personal values exempt credential findings', async () => {
    const engine = createSanitizer(options);
    const output = (await engine.sanitize('phone +7 912 555-01-42')).text;
    const number = output.slice('phone '.length);
    expect((await engine.sanitize(`password="${number}"`)).text).toBe(
      'password="[REDACTED]"'
    );
  });
  it('audits actual faking while retaining full-redaction fallbacks', () => {
    const result = sanitize('birth date: 31/02/1985', options);
    expect(result.text).toBe('birth date: [REDACTED]');
    expect(result.findings.some((f) => f.faked)).toBe(false);
  });
  it('rejects malformed MRZ dates with full redaction', () => {
    const header = 'P<RUSKOVALEVA<<MARINA'.padEnd(44, '<');
    const data = '5839204710RUS8213990F3105190'.padEnd(44, '<');
    expect(fake(`${header}\n${data}`, 'PASSPORT_MRZ')).toBe('[REDACTED]');
  });
  it('fully redacts credentials by default and only emits invalid marked credentials on opt-in', async () => {
    const input = `api_key=ghp_${'aB3cD4'.repeat(6)}`;
    expect(sanitize(input, options).text).toBe('api_key=[REDACTED]');
    const engine = createSanitizer({
      transformation: { mode: 'fake', key, credentials: true },
    });
    const output = await engine.sanitize(input);
    expect(output.text.startsWith('api_key=ghp_FAKE_')).toBe(true);
    expect(
      inspect(output.text).filter(
        (f) => f.category === 'credential' && f.rule !== 'context'
      ).length
    ).toBe(0);
    expect((await engine.sanitize(output.text)).text).toBe(output.text);
  });
  it('recognizes only the current keyed generators during residual verification', async () => {
    const engine = createSanitizer(options);
    const input = 'PNR K7QWZP; born on 07/12/1985; phone +7 912 555-01-42';
    const result = await engine.sanitize(input);
    expect(result.text.includes('K7QWZP')).toBe(false);
    expect((await engine.sanitize(result.text)).text).toBe(result.text);
    expect(
      (await engine.inspect(result.text)).filter((f) => f.kept === 'fake')
        .length > 0
    ).toBe(true);
    expect(
      (await createSanitizer().sanitize(result.text)).text === result.text
    ).toBe(false);
  });
});
describe('fake TD3 documents', () => {
  it('generates independently valid TD3 MRZ and matching names and birth dates', () => {
    const header = 'P<RUSKOVALEVA<<MARINA'.padEnd(44, '<');
    let data = `583920471${mrzCheck('583920471')}RUS820411${mrzCheck(
      '820411'
    )}F310519${mrzCheck('310519')}<<<<<<<<<<<<<<0`;
    data += mrzCheck(
      data.slice(0, 10) + data.slice(13, 20) + data.slice(21, 43)
    );
    const input = `${header}\n${data}\nApplicant: Marina Kovaleva\nborn on 1982-04-11`;
    const output = sanitize(input, options).text.split('\n');
    const document = parse(output.slice(0, 2));
    expect(document.valid).toBe(true);
    expect(output[0].includes('KOVALEVA')).toBe(false);
    expect(output[1].includes('583920471')).toBe(false);
    expect(document.fields.issuingState).toBe('RUS');
    expect(document.fields.nationality).toBe('RUS');
    const names = output[2]
      .slice('Applicant: '.length)
      .toUpperCase()
      .split(' ');
    expect(document.fields.firstName).toBe(names[0]);
    expect(document.fields.lastName).toBe(names[1]);
    expect(document.fields.birthDate).toBe(
      output[3].slice('born on '.length).replace(/-/g, '').slice(2)
    );
    const uto = sanitize(`${header}\n${data}`, {
      transformation: { mode: 'fake', key, mrzCountry: 'UTO' },
    }).text.split('\n');
    expect(uto[0].slice(2, 5)).toBe('UTO');
    expect(uto[1].slice(10, 13)).toBe('UTO');
    // This parser's country table omits ICAO's fictitious Utopia code.
    // Country fields do not participate in checks; validate with RUS there.
    expect(parse(uto.map((line) => line.replaceAll('UTO', 'RUS'))).valid).toBe(
      true
    );
  });
});
