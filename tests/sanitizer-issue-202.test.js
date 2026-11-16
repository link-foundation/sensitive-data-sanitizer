import { describe, it, expect } from 'test-anywhere';
import { performance } from 'node:perf_hooks';
import { compileKnown, inspect } from '../src/index.js';
import { isStart, startPattern } from '../src/known-matcher.js';
import { knownView } from '../src/known-view.js';

// Every name below is made up.
const spans = (text, knownPersonal) =>
  inspect(text, { knownOnly: true, knownPersonal }).map((f) => [
    f.type,
    text.slice(f.start, f.end),
  ]);
const known = compileKnown(
  ['Пряжкина Велимира Остаповна', 'Тютюнник Евсей', 'Ольховецкий'].map(
    (value) => ({ type: 'PERSON', value })
  ),
  { identifiers: true, transliterate: true, warm: true }
);
const prose =
  'Кандидат прошёл интервью, рекрутер Пряжкина отметила опыт в Go и Kubernetes; ' +
  '| 12 | Велимира | 54 | "ok" | см. `case_one`, &amp; https://example.test/a?b=1 ' +
  '**итог:** нужен ещё один созвон, оценка 4/5 — без замечаний.\n';

// The characters a word start depends on: lower, upper and title case
// letters in and outside the BMP, marks, digits, spaces, separators and
// lone surrogates.
const samples = [
  'a',
  'A',
  'я',
  'Я',
  'ǅ',
  'ª',
  '𝐀',
  '𝐚',
  '𐐀',
  '𐐨',
  '́',
  '1',
  '_',
  '.',
  ' ',
  '\t',
  '\n',
  ' ',
  ' ',
  '😀',
  '\ud800',
  '\udc00',
  '&',
];

describe('issue 202: short knownOnly texts', () => {
  it('finds the same word starts as the start pattern', () => {
    for (const a of samples) {
      for (const b of samples) {
        for (const c of samples) {
          const text = a + b + c;
          const expected = new Set(
            [...text.matchAll(startPattern)].map((m) => m.index)
          );
          for (let index = 0; index < text.length; index++) {
            const lowHalf =
              /[\udc00-\udfff]/u.test(text[index]) &&
              /[\ud800-\udbff]/u.test(text[index - 1] ?? '');
            if (lowHalf) {
              continue;
            }
            expect([text, index, isStart(text, index)]).toEqual([
              text,
              index,
              expected.has(index),
            ]);
          }
        }
      }
    }
  });

  it('keeps the matches the anchors lead to', () => {
    expect(spans('рекрутер Пряжкина Велимира Остаповна, ок', known)).toEqual([
      ['PERSON', 'Пряжкина Велимира Остаповна'],
    ]);
    expect(spans('see evseyTyutyunnik and EVSEY_TYUTYUNNIK', known)).toEqual([
      ['PERSON', 'evseyTyutyunnik'],
      ['PERSON', 'EVSEY_TYUTYUNNIK'],
    ]);
    // Results as on main before the change.
    expect(spans('ПряжкинаВелимира, xПряжкина Велимира', known)).toEqual([
      ['PERSON', 'ПряжкинаВелимира'],
      ['PERSON', 'Пряжкина Велимира'],
    ]);
    expect(spans('по Ольховецкий, ольховецкий', known)).toEqual([
      ['PERSON', 'Ольховецкий'],
      ['PERSON', 'ольховецкий'],
    ]);
    expect(spans('𝐚Пряжкина и Пряжкинаx', known)).toEqual([]);
    expect(spans('АБВ Ольховецкий DEMOОльховецкий', known)).toEqual([
      ['PERSON', 'Ольховецкий'],
      ['PERSON', 'Ольховецкий'],
    ]);
  });

  it('does not build a decoded view that only turns &amp; into &', () => {
    expect(knownView(prose, true, '&<')).toBe(undefined);
    expect(knownView('a &lt;b %26 c', true, '&<')).toBe(undefined);
    // `>` starts a quoted line, so `&gt;` still builds the view.
    expect(knownView('a &gt; b', true, '&<').text).toBe('a > b');
    expect(knownView(prose).text).toContain('`case_one`, & https');
    expect(knownView('&amp; &#1055;ряжкина', true, '&<').text).toBe(
      '& Пряжкина'
    );
    expect(knownView('Пряжкинa', true, '&<').text).toBe('Пряжкина');
    expect(spans('&amp; &#1055;ряжкина Велимира Остаповна', known)).toEqual([
      ['PERSON', '&#1055;ряжкина Велимира Остаповна'],
    ]);
  });

  it('keeps the view when a listed value can hold & or <', () => {
    const url = compileKnown([
      { type: 'URL', value: 'https://example.test/a?b=1&c=2' },
    ]);
    expect(spans('see https://example.test/a?b=1&amp;c=2 now', url)).toEqual([
      ['URL', 'https://example.test/a?b=1&amp;c=2'],
    ]);
    const company = compileKnown([{ type: 'COMPANY', value: 'Ромашка & Ко' }]);
    expect(spans('у Ромашка &amp; Ко есть', company)).toEqual([
      ['COMPANY', 'Ромашка &amp; Ко'],
    ]);
    const note = compileKnown([{ type: 'NOTE', value: 'a<b' }]);
    expect(spans('x a&lt;b y', note)).toEqual([['NOTE', 'a&lt;b']]);
  });

  it('checks thousands of short windows in bounded time', () => {
    const windows = Array.from({ length: 1000 }, (_, i) =>
      (prose.repeat(5) + i).slice(i % 50)
    );
    const started = performance.now();
    let findings = 0;
    for (const window of windows) {
      findings += inspect(window, {
        knownOnly: true,
        knownPersonal: known,
      }).length;
    }
    expect(findings).toBe(0);
    expect(performance.now() - started).toBeLessThan(20000);
  });
});
