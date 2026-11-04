import { describe, it, expect } from 'test-anywhere';
import { inspect, sanitize, restore } from '../src/index.js';
import { localeVocabulary } from '../src/locales.js';

const fixtures = [
  ['en', 'Acme Ltd', 'Northfield State University', 'Springfield'],
  ['es', 'Acme S.L.', 'Universidad Norte', 'Madrid'],
  ['fr', 'Acme SARL', 'Université Lumière', 'Paris'],
  ['de', 'Acme GmbH', 'Universität Nordfeld', 'Berlin'],
  ['pt', 'Acme Ltda', 'Universidade Nova', 'Lisboa'],
  ['ru', 'ООО «Ромашка»', 'Северный университет', 'Москва'],
  ['ja', '株式会社青空', '北野大学', '東京'],
  ['zh', '蓝天有限公司', '北方大学', '北京'],
  ['zh-Hant', '藍天有限公司', '北方大學', '臺北'],
  ['ko', '주식회사 한빛', '한빛대학교', '서울'],
  ['ar', 'شركة النور', 'جامعة النور', 'القاهرة'],
  ['he', 'אור בע״מ', 'אוניברסיטת הצפון', 'ירושלים'],
  ['hi', 'आकाश लिमिटेड', 'उत्तर विश्वविद्यालय', 'दिल्ली'],
  ['tr', 'Acme A.Ş.', 'Kuzey Üniversitesi', 'İstanbul'],
  ['id', 'PT Nusantara', 'Universitas Nusantara', 'Jakarta'],
  ['vi', 'Sen TNHH', 'Đại học Sen', 'Hà Nội'],
  ['th', 'บริษัทแสง', 'มหาวิทยาลัยแสง', 'กรุงเทพมหานคร'],
];
describe('document entity profile (#55)', () => {
  it('has employer, school and city fixtures for every supported locale', () => {
    expect(fixtures.map(([locale]) => locale)).toEqual(
      localeVocabulary.map(([locale]) => locale)
    );
  });
  for (const [locale, organization, education, location] of fixtures) {
    it(`detects list-form entities in ${locale} and supports reversible replacements`, () => {
      const text = `2019–2023  ${organization}\n2015–2019  ${education}\n${location}`;
      const found = inspect(text, { profile: 'documents' });
      for (const [type, value] of [
        ['ORGANIZATION', organization],
        ['EDUCATION', education],
        ['LOCATION', location],
      ]) {
        expect(
          found.some(
            (f) => f.type === type && text.slice(f.start, f.end) === value
          )
        ).toBe(true);
      }
      const result = sanitize(text, {
        profile: 'documents',
        transformation: { mode: 'placeholder' },
      });
      expect(result.text).toBe(
        '2019–2023  Organization-1\n2015–2019  Education-1\nLocation-1'
      );
      expect(restore(result.text, result.map)).toBe(text);
      const fake = sanitize(text, {
        profile: 'documents',
        transformation: { mode: 'fake', key: 'document-fixture' },
      });
      expect(fake.text.includes(organization)).toBe(false);
      expect(fake.text.includes(education)).toBe(false);
      expect(fake.text.includes(location)).toBe(false);
    });
  }
  it('detects legal forms in either order with and without quotes', () => {
    for (const value of [
      'ООО «Ромашка»',
      'Ромашка GmbH',
      'LLC Acme',
      'Acme LLC',
      '"Acme" Ltd',
      'Ltd "Acme"',
      'АО Ромашка',
      'Ромашка ПАО',
      'Acme Inc',
      'Acme AG',
      'Acme S.A.',
      'ИП Ромашка',
    ]) {
      expect(
        inspect(value, { documentEntities: true }).some(
          (f) =>
            f.type === 'ORGANIZATION' && f.start === 0 && f.end === value.length
        )
      ).toBe(true);
    }
  });
  it('detects labelled unknown places and bounded regions', () => {
    const text =
      'Based in Springfield, relocated from Riverton\nlocated in Northfield\nг. Тихогорск\nгород Светлоград\nCalifornia\nBayern';
    const values = inspect(text, { profile: 'documents' })
      .filter((f) => f.type === 'LOCATION')
      .map((f) => text.slice(f.start, f.end));
    for (const value of [
      'Springfield',
      'Riverton',
      'Northfield',
      'Тихогорск',
      'Светлоград',
      'California',
      'Bayern',
    ]) {
      expect(values.includes(value)).toBe(true);
    }
  });
  it('exposes lower confidence, threshold control and an explicit off switch', () => {
    const found = inspect('Acme Ltd\nSpringfield', { profile: 'documents' });
    expect(
      found.every((f) => f.confidence >= 0.6 && f.confidence <= 0.75)
    ).toBe(true);
    expect(
      sanitize('Acme Ltd\nSpringfield', {
        profile: 'documents',
        minConfidence: 0.8,
      }).text
    ).toBe('Acme Ltd\nSpringfield');
    expect(
      inspect('Acme Ltd\nSpringfield', {
        profile: 'documents',
        documentEntities: false,
      })
    ).toEqual([]);
    expect(inspect('Acme Ltd\nSpringfield')).toEqual([]);
    expect(
      inspect('Acme Ltd\nSpringfield', { profile: 'publication' })
    ).toEqual([]);
  });
  it('keeps reviewed public entities while knownPersonal overrides the exemption', () => {
    const publicEntities = [
      'Acme Ltd',
      'Northfield University',
      'Springfield',
    ].map((value, i) => ({
      value,
      type: ['ORGANIZATION', 'EDUCATION', 'LOCATION'][i],
      source: 'https://example.org/evidence',
      reviewedAt: '2026-11-04',
    }));
    const text = publicEntities.map((e) => e.value).join('\n');
    expect(sanitize(text, { profile: 'documents', publicEntities }).text).toBe(
      text
    );
    expect(
      sanitize(text, {
        profile: 'documents',
        publicEntities,
        knownPersonal: publicEntities,
      }).text
    ).toBe('[REDACTED]\n[REDACTED]\n[REDACTED]');
  });
});

it('exempts contained legacy company findings and lets private policy override', () => {
  const text = 'company Acme Ltd';
  const publicEntities = [
    {
      type: 'ORGANIZATION',
      value: 'Acme Ltd',
      source: 'https://example.org/evidence',
      reviewedAt: '2026-11-04',
    },
  ];
  expect(sanitize(text, { profile: 'documents', publicEntities }).text).toBe(
    text
  );
  expect(
    sanitize(text, {
      profile: 'documents',
      publicEntities,
      knownPersonal: publicEntities,
    }).text
  ).toBe('company [REDACTED]');
});
