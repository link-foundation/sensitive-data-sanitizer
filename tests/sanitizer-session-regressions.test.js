import { describe, it, expect } from 'test-anywhere';
import { createSanitizer, inspect, sanitize } from '../src/index.js';

const negatives = [
  'ts=1696023757',
  'ts=1696087109',
  'ts=1696110866',
  '{"timestamp":1696023757}',
  'elapsed 1696000628374',
  'order 1015032381',
  'author=octocat',
  '"author": "Some Name"',
  'authored_by: bot',
  'authority=public',
  'authorize_url=https://example.com',
  'Date:   Wed Oct 7 12:00:00 2026 +0300',
  'Date: Wed, 07 Oct 2026 12:00:00 GMT',
  'Date: 2026-10-07',
  'name is\nvisa window',
  'nameis visawindo',
  'the visa window closes',
  'visa application form',
  'Visa card',
];
describe('issue 24 session negatives', () => {
  for (const value of negatives) {
    it(`keeps ${value}`, async () => {
      expect(sanitize(value).text).toBe(value);
      expect((await createSanitizer().sanitize(value)).text).toBe(value);
    });
  }
  it('keeps escaped JSON review prose in both publication APIs', async () => {
    const value = JSON.stringify({ stdout: 'nameis\\nvisawindo' });
    expect((await createSanitizer().sanitize(value)).text).toBe(value);
    expect((await createSanitizer().sanitizeJsonl(value)).text).toBe(value);
  });
  it('filters low checksum confidence while exposing evidence', () => {
    const value = '7707083893';
    expect(
      inspect(value).some((f) => f.type === 'RU_INN' && f.confidence <= 0.4)
    ).toBe(true);
    expect(sanitize(value).text).toBe(value);
    expect(sanitize(value, { minConfidence: 0.3 }).text).toBe('[REDACTED]');
    expect(sanitize('ИНН 7707083893').text.includes('7707083893')).toBe(false);
  });
  it('raises NHS confidence for patient context', () => {
    expect(
      inspect('patient: 9434765919').find((f) => f.type === 'UK_NHS')
        .confidence >= 0.9
    ).toBe(true);
  });
  it('measures false positives across realistic generated session metadata', () => {
    const corpus = Array.from(
      { length: 400 },
      (_, i) =>
        `ts=${1696000000 + i * 59} order ${1015000000 + i * 31} elapsed ${1696000000000 + i * 157} size=${4096 + i} port=8080 PID=${1000 + i} src/app.js:${10 + i}:3`
    );
    const falsePositives = corpus.filter(
      (value) => sanitize(value).text !== value
    ).length;
    expect(falsePositives / corpus.length).toBe(0);
  });
});
describe('issue 24 value spans and missing identities', () => {
  it('protects short wrapped MRZ name fragments', () => {
    expect(sanitize('P<RUSKOVALEVA<<\nOLGA').text).toBe('[REDACTED]');
  });
  it('propagates unknown labelled name components into reordered filenames', async () => {
    const input =
      'Applicant: Zorina Velenska\nFile: /cache/VELENSKA_ZORINA_photo.pdf';
    expect(sanitize(input).text).toBe(
      'Applicant: [REDACTED]\nFile: /cache/[REDACTED]_[REDACTED]_photo.pdf'
    );
    const document = JSON.stringify({
      person: 'Applicant: Zorina Velenska',
      path: '/cache/VELENSKA_ZORINA_photo.pdf',
    });
    const output = await createSanitizer({ structured: 'json' }).sanitize(
      document
    );
    expect(output.text.includes('VELENSKA')).toBe(false);
    expect(output.text.includes('ZORINA')).toBe(false);
  });
  for (const suffix of ['no ', 'number: ', 'No. ', '# ', '№ ']) {
    it(`keeps passport ${suffix}outside mask and allowlist`, () => {
      const value = `passport ${suffix}AB1234XYZ`;
      expect(sanitize(value, { identityMask: true }).text).toBe(
        `passport ${suffix}AB***YZ`
      );
      expect(
        sanitize(value, { identityMask: true, fakeValues: ['AB1234XYZ'] }).text
      ).toBe(value);
      expect(
        inspect(value).some(
          (f) =>
            f.type === 'PASSPORT_NUMBER' &&
            value.slice(f.start, f.end) === 'AB1234XYZ'
        )
      ).toBe(true);
    });
  }
  it('redacts short contextual identities completely', () => {
    expect(sanitize('pnr: AB12', { identityMask: true }).text).toBe(
      'pnr: [REDACTED]'
    );
    expect(sanitize('passport no AB12', { identityMask: true }).text).toBe(
      'passport no [REDACTED]'
    );
  });
  it('limits assignment passwords to their values', () => {
    expect(
      sanitize('password=hunter2 email john@private.org then more text').text
    ).toBe('password=[REDACTED] email [REDACTED] then more text');
  });
  for (const value of [
    '0812 3456 7890',
    'telp 0812-3456-7890',
    'HP: 0812 3456 7890',
    'hubungi (0812) 3456-7890',
    'โทร 08 123 4567',
    'เบอร์ (08) 123-4567',
    'gọi 090 123 4567',
    'SĐT: 090 123 4567',
    'điện thoại 090 123 4567',
  ]) {
    it(`detects local PHONE ${value}`, () => {
      expect(inspect(value).some((f) => f.type === 'PHONE')).toBe(true);
      expect(sanitize(value).text.match(/\d/)).toBe(null);
    });
  }
  it('exempts a synthetic MRZ as one document', () => {
    const value =
      'P<RUSTESTOVA<<OLGA<<<<<<<<<<<<<<<<<<<<<<<<<<\n9876543217RUS9001014F300101<<<<<<<<<<<<<<04';
    expect(
      sanitize(value, { fakeIdentity: 'specimen-and-synthetic' }).text
    ).toBe(value);
    expect(
      sanitize('Reisepass C01X00T47 MUSTERMANN ERIKA SPECIMEN', {
        fakeIdentity: 'specimen-and-synthetic',
      }).text
    ).toBe('Reisepass C01X00T47 MUSTERMANN ERIKA SPECIMEN');
  });
  it('keeps German specimen exemptions separate from adjacent real identities', () => {
    const specimen = 'Reisepass C01X00T47 MUSTERMANN ERIKA SPECIMEN';
    const input = `passport X5847296; ${specimen}; passport Y7284901; NHS 9434765919`;
    const output = sanitize(input, {
      fakeIdentity: 'specimen-and-synthetic',
    }).text;
    expect(output.includes(specimen)).toBe(true);
    for (const value of ['X5847296', 'Y7284901', '9434765919']) {
      expect(output.includes(value)).toBe(false);
    }
  });
  for (const value of [
    "This trip's affected flights are on Air India booking K7QWZP",
    "out: 'AirIndia-K7QWZP-2-AI0000-AAA-BBB-cancelled.pdf'",
    'reservation K7QWZP',
    'confirmation K7QWZP',
    'бронь K7QWZP',
  ]) {
    it(`detects booking ${value}`, () =>
      expect(sanitize(value).text.includes('K7QWZP')).toBe(false));
  }
  it('propagates booking values into all same-document paths', async () => {
    const input =
      "booking K7QWZP\nAirIndia-K7QWZP-flight.pdf\npath.join(FINAL, 'K7QWZP')";
    expect(
      (await createSanitizer().sanitize(input)).text.includes('K7QWZP')
    ).toBe(false);
    const json = JSON.stringify({
      filename: 'AirIndia-K7QWZP-flight.pdf',
      description: 'booking K7QWZP',
      path: '/K7QWZP/ticket',
    });
    expect(
      (await createSanitizer().sanitizeJsonl(json)).text.includes('K7QWZP')
    ).toBe(false);
  });
  for (const value of [
    'KOVALEVA-MARINA-PASSPORT.jpg and PETROV_IVAN_VISA.pdf',
    'Заявитель: Ковалева Марина Сергеевна, 1985 г.р.',
    'Ковалева Марина Сергеевна',
    'Marina Kovaleva and marina kovaleva again',
  ]) {
    it(`detects names ${value}`, () => {
      const output = sanitize(value).text;
      expect(
        /KOVALEVA|MARINA|PETROV|IVAN|Ковалева|Марина|Сергеевна|kovaleva/i.test(
          output
        )
      ).toBe(false);
    });
  }
});
