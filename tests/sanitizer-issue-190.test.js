import { describe, it, expect } from 'test-anywhere';
import { performance } from 'node:perf_hooks';
import {
  compileKnown,
  createRestoreMap,
  inspect,
  restore,
  sanitize,
} from '../src/index.js';
import { knownMatcher } from '../src/compiled-known.js';
import { eachMatch } from '../src/detection.js';
import {
  foldText,
  isAnchorCharacter,
  regexAnchors,
} from '../src/known-matcher.js';
import {
  detectKnownPersonal,
  personalRegex,
} from '../src/personal-variants.js';

// Every name below is made up.
const person = (...values) =>
  compileKnown(values.map((value) => ({ type: 'PERSON', value })));
const flagged = (value, flags) =>
  compileKnown([{ type: 'PERSON', value, ...flags }]);
const spans = (text, knownPersonal) =>
  inspect(text, { knownOnly: true, knownPersonal })
    .filter((f) => f.type === 'PERSON')
    .map((f) => text.slice(f.start, f.end));
const failsWith = (run, code) => {
  let error;
  try {
    run();
  } catch (caught) {
    error = caught;
  }
  expect(error?.code).toBe(code);
};

describe('issue 186: identifiers', () => {
  const known = flagged('Tyutyunnik', { identifiers: true });
  it('matches a listed value as an identifier segment', () => {
    for (const [text, expected] of [
      ['case tyutyunnik_marketing', ['tyutyunnik']],
      ['const tyutyunnikCase = 1;', ['tyutyunnik']],
      ['TYUTYUNNIK_CALLS = 1', ['TYUTYUNNIK']],
      ['see tyutyunnik.json', ['tyutyunnik']],
      ['getTyutyunnikName()', ['Tyutyunnik']],
      ['HTTPTyutyunnik', ['Tyutyunnik']],
      ['user2tyutyunnik3', ['tyutyunnik']],
      ['tyutyunnik-report', ['tyutyunnik']],
      ['tyutyunniks xtyutyunnik tyutyunnikov', []],
    ]) {
      expect(spans(text, known)).toEqual(expected);
    }
  });
  it('keeps word boundaries without the option', () => {
    expect(spans('case tyutyunnik_marketing', person('Tyutyunnik'))).toEqual(
      []
    );
    expect(spans('const tyutyunnikCase = 1;', person('Tyutyunnik'))).toEqual(
      []
    );
  });
  it('joins the words of a value inside an identifier', () => {
    const pair = flagged('Evsey Tyutyunnik', { identifiers: true });
    for (const text of [
      'evsey_tyutyunnik',
      'EvseyTyutyunnik',
      'EVSEY_TYUTYUNNIK',
      'evsey-tyutyunnik',
      'tyutyunnik_evsey',
    ]) {
      expect(spans(`x ${text} y`, pair)).toEqual([text]);
    }
  });
  it('declines Cyrillic values inside identifiers', () => {
    const cyrillic = flagged('Тютюнник', { identifiers: true });
    expect(spans('тютюнника_звонки ТЮТЮННИКУ_ПИСЬМО', cyrillic)).toEqual([
      'тютюнника',
      'ТЮТЮННИКУ',
    ]);
  });
  it('accepts the options as compileKnown defaults and on plain arrays', () => {
    const list = compileKnown([{ type: 'PERSON', value: 'Tyutyunnik' }], {
      identifiers: true,
    });
    expect(list[0].identifiers).toBe(true);
    expect(spans('tyutyunnik_marketing', list)).toEqual(['tyutyunnik']);
    const own = compileKnown(
      [{ type: 'PERSON', value: 'Tyutyunnik', identifiers: false }],
      { identifiers: true }
    );
    expect(spans('tyutyunnik_marketing', own)).toEqual([]);
    expect(
      spans('tyutyunnik_marketing', [
        { type: 'PERSON', value: 'Tyutyunnik', identifiers: true },
      ])
    ).toEqual(['tyutyunnik']);
  });
  it('rejects malformed options', () => {
    const entry = { type: 'PERSON', value: 'Tyutyunnik' };
    failsWith(() => compileKnown([{ ...entry, identifiers: 1 }]), 'ERR_CONFIG');
    failsWith(() => compileKnown([entry], { warm: 'yes' }), 'ERR_CONFIG');
    failsWith(() => compileKnown([entry], { other: true }), 'ERR_CONFIG');
    failsWith(
      () =>
        inspect('x', {
          knownPersonal: [{ ...entry, transliterate: 'yes' }],
        }),
      'ERR_CONFIG'
    );
  });
});

describe('issue 186: transliteration', () => {
  const known = flagged('Тютюнник Евсей', { transliterate: true });
  it('matches common romanizations of a Cyrillic value', () => {
    for (const text of [
      'Evsey Tyutyunnik',
      'Evsei Tiutiunnik',
      'Yevsey Tjutjunnik',
      'Tyutyunnik Evsey',
      'EVSEY TYUTYUNNIK',
      'Evsey T.',
    ]) {
      expect(spans(`resume of ${text} here`, known)).toEqual([text]);
    }
    expect(spans('Тютюнника Евсея', known)).toEqual(['Тютюнника Евсея']);
  });
  it('covers the letters of each system', () => {
    for (const [value, latin] of [
      ['Щукин', ['Shchukin', 'Schukin', 'Shhukin']],
      ['Жуковский', ['Zhukovskiy', 'Zhukovskii', 'Zhukovsky', 'Zhukovskij']],
      ['Цой', ['Tsoy', 'Tsoi', 'Coj', 'Tsoj']],
      ['Хрусталёв', ['Khrustalev', 'Khrustalyov', 'Hrustalev']],
      ['Максим', ['Maksim', 'Maxim']],
      ['Юлия', ['Yuliya', 'Yulia', 'Iuliia', 'Julija']],
      ['Медведев', ['Medvedev']],
      ['Елена', ['Elena', 'Yelena', 'Jelena']],
    ]) {
      const list = flagged(value, { transliterate: true });
      for (const text of latin) {
        expect(spans(`about ${text}.`, list)).toEqual([text]);
      }
    }
  });
  it('is off by default and combines with identifiers', () => {
    expect(
      spans('resume of Evsey Tyutyunnik', person('Тютюнник Евсей'))
    ).toEqual([]);
    const both = flagged('Тютюнник', {
      transliterate: true,
      identifiers: true,
    });
    expect(spans('tjutjunnikCase TIUTIUNNIK_CALLS', both)).toEqual([
      'tjutjunnik',
      'TIUTIUNNIK',
    ]);
  });
  it('replaces a Latin spelling with the placeholder of the listed person', () => {
    const map = createRestoreMap();
    const text = 'Тютюнник Евсей is Evsey Tyutyunnik.';
    const { text: output } = sanitize(text, {
      knownOnly: true,
      knownPersonal: known,
      transformation: { mode: 'placeholder', map },
    });
    expect(output).toBe('Person-1 is Person-1.');
    expect(restore(output, map)).toBe(text);
  });
});

describe('issue 187: line breaks between parts', () => {
  const known = person('Тютюнник Евсей');
  it('matches a name split by one line break', () => {
    for (const [text, expected] of [
      ['Тютюнника Евсея', ['Тютюнника Евсея']],
      ['Тютюнника\nЕвсея', ['Тютюнника\nЕвсея']],
      ['Тютюнника\r\nЕвсея', ['Тютюнника\r\nЕвсея']],
      ['Тютюнника\n  Евсея', ['Тютюнника\n  Евсея']],
      ['// карточка Тютюнника\n// Евсея', ['Тютюнника\n// Евсея']],
      ['* Тютюнника\n * Евсея', ['Тютюнника\n * Евсея']],
      ['# Тютюнника\n# Евсея', ['Тютюнника\n# Евсея']],
      ['> Тютюнника\n> > Евсея', ['Тютюнника\n> > Евсея']],
      ['-- Тютюнника\n-- Евсея', ['Тютюнника\n-- Евсея']],
      ['; Тютюнника\n; Евсея', ['Тютюнника\n; Евсея']],
      ['Тютюнника\n\nЕвсея', []],
      ['Тютюнника\n//\n// Евсея', []],
    ]) {
      expect(spans(text, known)).toEqual(expected);
    }
  });
  it('applies to initials and other types', () => {
    const full = person('Пряжкина Велимира Остаповна');
    expect(spans('В. О.\nПряжкина', full)).toEqual(['В. О.\nПряжкина']);
    const company = compileKnown([
      { type: 'ORGANIZATION', value: 'ООО Ромашка Плюс' },
    ]);
    const text = 'договор с ООО Ромашка\n// Плюс';
    expect(
      inspect(text, { knownOnly: true, knownPersonal: company }).map((f) =>
        text.slice(f.start, f.end)
      )
    ).toEqual(['ООО Ромашка\n// Плюс']);
  });
  it('replaces and restores the split name', () => {
    const map = createRestoreMap();
    const text = '// Тютюнника\n// Евсея';
    const { text: output } = sanitize(text, {
      knownOnly: true,
      knownPersonal: known,
      transformation: { mode: 'placeholder', map },
    });
    expect(output).toBe('// Person-1');
    expect(restore(output, map)).toBe(text);
  });
  it('stays linear on long whitespace runs', () => {
    const text = `Тютюнника${' '.repeat(20000)}\n${' \n'.repeat(20000)}x`;
    const started = performance.now();
    expect(spans(text, known)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe('issue 188: partial forms', () => {
  it('drops a listed part nested in a listed full name', () => {
    const both = person('Тютюнник Евсей', 'Тютюнник');
    const ranges = (text) =>
      inspect(text, { knownOnly: true, knownPersonal: both }).map((f) => [
        f.start,
        f.end,
      ]);
    expect(ranges('Евсей Тютюнник')).toEqual([[0, 14]]);
    expect(ranges('резюме Тютюнника Евсея')).toEqual([[7, 22]]);
    expect(ranges('Тютюнник и Евсей Тютюнник')).toEqual([
      [0, 8],
      [11, 25],
    ]);
  });
  it('needs the surname or its own entry for a given name + patronymic', () => {
    const known = person('Пряжкина Велимира Остаповна');
    expect(spans('Велимира Остаповна ответила', known)).toEqual([]);
    expect(spans('Велимира ответила', known)).toEqual([]);
    expect(spans('Пряжкина ответила', known)).toEqual([]);
    expect(
      spans(
        'Велимира Остаповна ответила',
        person('Пряжкина Велимира Остаповна', 'Велимира Остаповна')
      )
    ).toEqual(['Велимира Остаповна']);
  });
  it('matches a given name with the surname initial', () => {
    const known = person('Пряжкина Велимира Остаповна');
    for (const [text, expected] of [
      ['Пряжкина В. О.', ['Пряжкина В. О.']],
      ['В. О. Пряжкина', ['В. О. Пряжкина']],
      ['Велимира П. ответила', ['Велимира П.']],
      ['Велимире П. ответили', ['Велимире П.']],
      ['Велимира П ответила', ['Велимира П']],
      ['Велимира Петровна ответила', []],
      ['Велимира К. ответила', []],
    ]) {
      expect(spans(text, known)).toEqual(expected);
    }
    expect(spans('John S. replied', person('John Smith'))).toEqual(['John S.']);
    expect(
      spans(
        'Velimira P. replied',
        flagged('Пряжкина Велимира Остаповна', { transliterate: true })
      )
    ).toEqual(['Velimira P.']);
  });
});

// The case-insensitive equivalents of every anchor character fold to it.
const anchorAlphabet = () => {
  const out = [];
  for (const [from, to] of [
    [0x21, 0x7e],
    [0xa1, 0x24f],
    [0x2b9, 0x2ba],
    [0x400, 0x45f],
    [0x2019, 0x2019],
  ]) {
    for (let code = from; code <= to; code++) {
      const char = String.fromCodePoint(code);
      if (isAnchorCharacter(foldText(char))) {
        out.push(char);
      }
    }
  }
  return out;
};

describe('issue 189: literal prefilter', () => {
  it('folds every case-insensitive equivalent of an anchor to it', () => {
    const alphabet = anchorAlphabet();
    const escape = (char) => char.replace(/[\]\\^\-[]/gu, '\\$&');
    const any = new RegExp(`^[${alphabet.map(escape).join('')}]$`, 'iu');
    const mismatches = [];
    for (let code = 0; code <= 0x10ffff; code++) {
      if (code >= 0xd800 && code <= 0xdfff) {
        continue;
      }
      const char = String.fromCodePoint(code);
      if (!any.test(char)) {
        continue;
      }
      for (const anchor of alphabet) {
        if (
          new RegExp(`^[${escape(anchor)}]$`, 'iu').test(char) &&
          foldText(char) !== foldText(anchor)
        ) {
          mismatches.push([code.toString(16), anchor]);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
  it('keeps text offsets when folding', () => {
    for (const text of ['İstanbul Тютюнник', 'ẞ Ё 𐐀 ᲀ ſ', 'ǅ Ǆ ǆ']) {
      expect(foldText(text).length).toBe(text.length);
    }
    expect(foldText('ТЮТЁВ ſ ᲀ')).toBe('тютев s в');
  });
  it('reads the literal prefixes of an expression', () => {
    expect(regexAnchors('(?<!x)(?:Abc|d[eE]f|g\\.h)')).toEqual([
      'abc',
      'def',
      'g.h',
    ]);
    expect(regexAnchors('(?:a|b)?cdef')).toEqual(['acde', 'bcde', 'cdef']);
    expect(regexAnchors('ab+c')).toEqual(['ab']);
    expect(regexAnchors('a\\p{L}b')).toEqual(['a']);
    expect(regexAnchors('[a-z]bc')).toBe(undefined);
    expect(regexAnchors('(?:x|\\s)y')).toBe(undefined);
  });
});

describe('issue 189: prefiltered matching', () => {
  it('finds what running every expression finds', () => {
    const entries = [
      { type: 'PERSON', value: 'Тютюнник Евсей' },
      { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
      { type: 'PERSON', value: 'Ёлкин Пётр' },
      { type: 'PERSON', value: 'Римский-Корсаков' },
      { type: 'PERSON', value: 'Ли Ян' },
      { type: 'PERSON', value: 'Steiß' },
      { type: 'PERSON', value: 'Ðorđe Šešelj' },
      { type: 'PERSON', value: 'Tyutyunnik', identifiers: true },
      { type: 'PERSON', value: 'Щукин Евгений', transliterate: true },
      {
        type: 'PERSON',
        value: 'Цой Юлия',
        transliterate: true,
        identifiers: true,
      },
      { type: 'ORGANIZATION', value: 'ООО «Ромашка»' },
      { type: 'ORGANIZATION', value: '«Ромашка Плюс»' },
      { type: 'PHONE', value: '+7 999 123-45-67' },
      { type: 'EMAIL', value: 'evsey@example.org' },
      { type: 'URL', value: 'https://example.org/evsey' },
      { type: 'ID', value: ' 42 ' },
      { type: 'ID', value: '42-17' },
    ];
    const texts = [
      'Тютюнника Евсея и ЕЛКИНА ПЕТРА, Елкиным Петром, ёлкин пётр.',
      'Пряжкиной В. О., Велимире П., Римский-Корсаков, Ли Яну, STEISS steiß.',
      'Đorđe Šešelj ÐORĐE ŠEŠELJ; tyutyunnikCase TYUTYUNNIK_x schukin evgeny',
      'TSOY_YULIA tsoiIuliia цой_юлия ООО «Ромашка» «ромашка плюс»',
      'call +7 999 123-45-67, evsey@example.org, example.org/evsey?x=1',
      'ID: 42 and 42-17 and x42-17y İ ẞ ſ ᲀ',
    ];
    const brute = (text) => {
      const out = [];
      for (const entry of entries) {
        eachMatch(text, personalRegex(entry.value, entry.type, entry), (m) =>
          out.push(`${m.index}:${m.index + m[0].length}:${entry.type}`)
        );
      }
      return out.sort();
    };
    const filtered = (list, text) => {
      const out = [];
      detectKnownPersonal(
        text,
        list,
        'known-personal',
        (f) => out.push(`${f.start}:${f.end}:${f.type}`),
        {}
      );
      return out.sort();
    };
    const compiled = compileKnown(entries);
    let found = 0;
    for (const text of texts) {
      const expected = brute(text);
      found += expected.length;
      expect(filtered(entries, text)).toEqual(expected);
      expect(filtered(compiled, text)).toEqual(expected);
    }
    expect(found).toBeGreaterThan(20);
  });
  it('compiles only the expressions whose anchors occur', () => {
    const list = compileKnown(
      Array.from({ length: 300 }, (_, i) => ({
        type: 'PERSON',
        value: `Фамилия${String.fromCodePoint(0x430 + (i % 32))}${i}ов Имя`,
      })).concat([{ type: 'PERSON', value: 'Тютюнник Евсей' }])
    );
    const matcher = knownMatcher(list);
    expect(matcher.always).toBe(0);
    inspect('текст без имен', { knownOnly: true, knownPersonal: list });
    expect(matcher.created()).toBe(0);
    expect(spans('о Тютюнника Евсея', list)).toEqual(['Тютюнника Евсея']);
    expect(matcher.created()).toBe(1);
  });
  it('warms every expression with warm: true', () => {
    const list = compileKnown(
      [
        { type: 'PERSON', value: 'Тютюнник Евсей' },
        { type: 'PERSON', value: 'Ёлкин Пётр' },
      ],
      { warm: true }
    );
    expect(knownMatcher(list).created()).toBe(2);
    expect(spans('Тютюнника Евсея', list)).toEqual(['Тютюнника Евсея']);
  });
  it('keeps the first call fast for a large list', () => {
    const syllables = ['ка', 'ло', 'ми', 'ре', 'ту', 'на', 'во', 'си', 'за'];
    let seed = 7;
    const random = () =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const word = (n) => {
      let out = '';
      for (let i = 0; i < n; i++) {
        out += syllables[Math.floor(random() * syllables.length)];
      }
      return out[0].toUpperCase() + out.slice(1);
    };
    const list = compileKnown(
      Array.from({ length: 2500 }, () => ({
        type: 'PERSON',
        value: `${word(3)}ов ${word(2)}`,
      }))
    );
    const started = performance.now();
    inspect('текст номер 1 без имен', { knownOnly: true, knownPersonal: list });
    // 0.22.5 spent about 7 s here compiling 2500 expressions.
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
