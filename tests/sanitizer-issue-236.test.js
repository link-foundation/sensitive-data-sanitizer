import assert from 'node:assert/strict';
import { describe, it } from 'test-anywhere';
import {
  compileKnown,
  createSanitizer,
  inspect,
  isPlaceholderToken,
  sanitize,
} from '../src/index.js';

const documents = { profile: 'documents' };
const spans = (text, findings) =>
  findings.map(({ start, end, type, rule }) => [
    type,
    rule,
    text.slice(start, end),
  ]);

describe('resume identifiers and recording false positives (issue 236)', () => {
  it('redacts whole HH resume links including their query and fragment', async () => {
    const id = '0123456789abcdef0123456789abcdef012345';
    const engine = createSanitizer({ ...documents, secretlint: false });
    for (const prefix of ['https://', 'http://www.', '', 'www.']) {
      const link = `${prefix}hh.ru/resume/${id}?vacancyId=123&t=456#details`;
      const input = `Резюме: (${link}).`;
      assert.deepEqual(spans(input, inspect(input, documents)), [
        ['URL', 'document-share-link', link],
      ]);
      assert.equal(sanitize(input, documents).text, 'Резюме: ([REDACTED]).');
      assert.equal(
        (await engine.sanitize(input)).text,
        'Резюме: ([REDACTED]).'
      );
    }
    assert.ok(
      !inspect(`other.hh.ru/resume/${id}`, documents).some(
        ({ rule }) => rule === 'document-share-link'
      )
    );
  });

  it('finds one-word and full names following personal labels', () => {
    for (const [label, name] of [
      ['Имя', 'Ульяна'],
      ['ФИО', 'Пестрякова'],
      ['Фамилия', 'Пестрякова'],
      ['Кандидат', 'Ульяна'],
      ['Кандидат', 'Пестрякова'],
      ['Кандидат', 'Пестрякова Ульяна'],
      ['Соискатель', 'ульяна'],
    ]) {
      const input = `${label}: ${name}`;
      const people = spans(input, inspect(input, documents)).filter(
        ([type]) => type === 'PERSON'
      );
      assert.deepEqual(
        people.map(([, , value]) => value),
        [name]
      );
    }
    assert.deepEqual(inspect('Имя: не указано', documents), []);
  });

  it('finds compact domestic phones under plural labels or without a prefix', () => {
    for (const [input, numbers] of [
      [
        'Телефоны: 89123456789, 8 912 345 67 89.',
        ['89123456789', '8 912 345 67 89'],
      ],
      ['Телефоны: 79123456789', ['79123456789']],
      ['Звоните 9123456789', ['9123456789']],
      ['Звоните +79123456789', ['+79123456789']],
      ['ключ x9123456789a', []],
    ]) {
      const phones = spans(input, inspect(input, documents)).filter(
        ([type]) => type === 'PHONE'
      );
      assert.deepEqual(
        phones.map(([, , value]) => value),
        numbers
      );
    }
  });

  it('matches all spellings of a known Russian mobile with or without compilation', () => {
    const list = [{ type: 'PHONE', value: '+7 (912) 345-67-89' }];
    for (const knownPersonal of [list, compileKnown(list, { warm: true })]) {
      const phoneOptions = { knownOnly: true, knownPersonal };
      for (const value of [
        '9123456789',
        '79123456789',
        '89123456789',
        '+79123456789',
        '(912) 345-67-89',
        '8 912 345 67 89',
        '9 12.345-67-89',
      ]) {
        assert.deepEqual(spans(value, inspect(value, phoneOptions)), [
          ['PHONE', 'known-personal', value],
        ]);
      }
      for (const other of [
        '49123456789',
        '9123456780',
        'x9123456789',
        '912345678999',
      ]) {
        assert.deepEqual(inspect(other, phoneOptions), []);
      }
    }
  });

  it('reports actual messenger handles and ignores a whole reserved token', async () => {
    assert.ok(isPlaceholderToken('Username-1'));
    const input = 'Мой Telegram: @upestr';
    const engine = createSanitizer({ ...documents, secretlint: false });
    assert.deepEqual(spans(input, inspect(input, documents)), [
      ['USERNAME', 'messenger-label', '@upestr'],
    ]);
    for (const text of ['Telegram Username-1', 'Мой Telegram: Username-1']) {
      assert.deepEqual(inspect(text, documents), []);
      assert.deepEqual(await engine.inspect(text), []);
    }
    const replaced = sanitize(input, {
      ...documents,
      transformation: { mode: 'placeholder', map: false },
    }).text;
    assert.equal(replaced, 'Мой Telegram: Username-1');
    assert.deepEqual(inspect(replaced, documents), []);
  });

  it('excludes component indexes while retaining context-supported IPv6', () => {
    const options = { ...documents, publicKnowledge: false };
    for (const input of [
      '{"component_key":"<uuid-1>::0"}',
      '{"component_key":"<uuid-3>::12"}',
      'key a1::0 b',
      'тест2001:db8::a',
      '2001:db8::aтест',
    ]) {
      assert.deepEqual(inspect(input, options), []);
    }
    for (const [input, value] of [
      ['IP: a1::0', 'a1::0'],
      ['host [2001:db8::a]', '2001:db8::a'],
      ['::1', '::1'],
    ]) {
      assert.deepEqual(spans(input, inspect(input, options)), [
        ['IP_ADDRESS', 'ipv6', value],
      ]);
    }
  });
});
