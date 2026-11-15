import { describe, it, expect } from 'test-anywhere';
import {
  compileKnown,
  createRestoreMap,
  inspect,
  restore,
  sanitize,
} from '../src/index.js';

// Every name below is made up.
const known = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
]);
const spans = (text) =>
  inspect(text, { knownOnly: true, knownPersonal: known })
    .filter((f) => f.type === 'PERSON')
    .map((f) => text.slice(f.start, f.end));
const redacted = (text) =>
  sanitize(text, { knownOnly: true, knownPersonal: known }).text;

describe('issue 201: Markdown record fields', () => {
  it('reports the value without its emphasis and keeps the emphasis', () => {
    for (const [text, output] of [
      [
        '**Фамилия:** Пряжкина\n**Имя:** Велимира',
        '**Фамилия:** [REDACTED]\n**Имя:** [REDACTED]',
      ],
      [
        'Фамилия: **Пряжкина**\nИмя: **Велимира**',
        'Фамилия: **[REDACTED]**\nИмя: **[REDACTED]**',
      ],
      [
        '**Фамилия**: Пряжкина\n**Имя**: Велимира',
        '**Фамилия**: [REDACTED]\n**Имя**: [REDACTED]',
      ],
      [
        '__Фамилия:__ _Пряжкина_\n__Имя:__ _Велимира_',
        '__Фамилия:__ _[REDACTED]_\n__Имя:__ _[REDACTED]_',
      ],
      [
        'Фамилия: `Пряжкина`\nИмя: `Велимира`',
        'Фамилия: `[REDACTED]`\nИмя: `[REDACTED]`',
      ],
    ]) {
      expect(spans(text)).toEqual(['Пряжкина', 'Велимира']);
      expect(redacted(text)).toBe(output);
    }
  });

  it('joins name fields that are consecutive list items', () => {
    for (const [text, expected] of [
      ['- **Фамилия:** Пряжкина\n- **Имя:** Велимира', 2],
      ['- last_name: Пряжкина\n- first_name: Велимира', 2],
      [
        '* **Фамилия:** Пряжкина\n* **Имя:** Велимира\n* Отчество: Остаповна',
        3,
      ],
      ['1. Фамилия: Пряжкина\n2. Имя: Велимира', 2],
      ['- Фамилия: Пряжкина\r\n- Email: p@example.test\r\n- Имя: Велимира', 2],
    ]) {
      expect(spans(text)).toEqual(
        ['Пряжкина', 'Велимира', 'Остаповна'].slice(0, expected)
      );
    }
    expect(redacted('- **Фамилия:** Пряжкина\n- **Имя:** Велимира')).toBe(
      '- **Фамилия:** [REDACTED]\n- **Имя:** [REDACTED]'
    );
  });

  it('joins the rows of a key/value table', () => {
    for (const text of [
      '| Фамилия | Пряжкина |\n| Имя | Велимира |',
      '| Поле | Значение |\n| --- | --- |\n| Фамилия | Пряжкина |\n| Имя | Велимира |',
      '| **Фамилия** | **Пряжкина** |\r\n| Email | p@example.test |\r\n| Имя | Велимира |',
      'Фамилия | Пряжкина\nИмя | Велимира',
    ]) {
      expect(spans(text)).toEqual(['Пряжкина', 'Велимира']);
    }
    expect(
      redacted(
        '| Поле | Значение |\n| --- | --- |\n| Фамилия | **Пряжкина** |\n| Имя | Велимира |\n| Отчество | Остаповна |'
      )
    ).toBe(
      '| Поле | Значение |\n| --- | --- |\n| Фамилия | **[REDACTED]** |\n| Имя | [REDACTED] |\n| Отчество | [REDACTED] |'
    );
  });

  it('keeps one person per record in placeholder mode', () => {
    const text = '- **Фамилия:** Пряжкина\n- **Имя:** Велимира';
    const map = createRestoreMap();
    const { text: output } = sanitize(text, {
      knownOnly: true,
      knownPersonal: known,
      transformation: { mode: 'placeholder', map },
    });
    expect(output).toBe('- **Фамилия:** Person-1\n- **Имя:** Person-1');
    expect(restore(output, map)).toBe(text);
  });

  it('does not join fields of separate lists, tables or records', () => {
    for (const text of [
      '- **Фамилия:** Пряжкина\n\n- **Имя:** Велимира',
      '- **Фамилия:** Пряжкина\nтекст\n- **Имя:** Велимира',
      '- Фамилия: Пряжкина\n- Фамилия: Тютюнник\n- Имя: Велимира',
      'Фамилия: Пряжкина\n- Имя: Велимира',
      '- first_name: Велимира\n  age: 3\n- last_name: Пряжкина',
      '- first_name: Велимира\n  last_name: Тютюнник\n- first_name: Ева\n  last_name: Пряжкина',
      '| Фамилия | Пряжкина |\n\n| Имя | Велимира |',
      '| Фамилия | Пряжкина |\nтекст\n| Имя | Велимира |',
      '| Фамилия | Пряжкина |\n| Фамилия | Тютюнник |\n| Имя | Велимира |',
    ]) {
      expect(spans(text)).toEqual([]);
    }
  });
});
