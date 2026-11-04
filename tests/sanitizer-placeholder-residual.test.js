import { describe, it, expect } from 'test-anywhere';
import { sanitize, restore, createRestoreMap } from '../src/index.js';

const documents = (map = createRestoreMap()) => ({
  profile: 'documents',
  transformation: { mode: 'placeholder', map },
});

describe('placeholder residual safety', () => {
  for (const [input, expected] of [
    [
      'Telegram: @Janedoe2024/jane_doe@example.com',
      'Telegram: Username-1/Email-1',
    ],
    [
      'Telegram/Email: @JaneDoe/jane@example.com',
      'Telegram/Email: Username-1/Email-1',
    ],
    [
      'Опыт в компании Вектор-99, отдел продаж',
      'Опыт в компании Organization-1, отдел продаж',
    ],
    [
      'Работал в компании Вектор-1, затем Вектор-2.',
      'Работал в компании Organization-1, затем Organization-2.',
    ],
  ]) {
    it(input, () => {
      const map = createRestoreMap();
      const { text } = sanitize(input, documents(map));
      expect(text).toBe(expected);
      expect(restore(text, map)).toBe(input);
    });
  }

  it('hides a handle and email under the default profile', () => {
    expect(sanitize('Telegram: @Janedoe2024/jane_doe@example.com').text).toBe(
      'Telegram: [REDACTED]/[REDACTED]'
    );
  });

  it('leaves package paths and scopes alone', () => {
    for (const text of ['npm i @scope/pkg@1.2.3', 'see @types/node here']) {
      expect(sanitize(text).text).toBe(text);
    }
  });

  it('never leaves a placeholder directly before a digit', () => {
    expect(() =>
      sanitize('Код Вектор99', {
        findings: [
          {
            start: 4,
            end: 10,
            type: 'ORGANIZATION',
            category: 'personal',
            rule: 'caller',
            confidence: 0.9,
          },
        ],
        transformation: { mode: 'placeholder', map: createRestoreMap() },
      })
    ).toThrow();
  });

  it('keeps numbered organizations restorable in a shared map', () => {
    const map = createRestoreMap();
    for (const input of [
      'Работал в компании Вектор-1.',
      'Работал в компании Вектор-2.',
      'Вектор и Вектор-1.',
      'Опыт в компании Вектор-99, отдел продаж',
      'Telegram: @Janedoe2024/jane_doe@example.com',
    ]) {
      const { text } = sanitize(input, documents(map));
      expect(text.includes('Вектор')).toBe(false);
      expect(restore(text, map)).toBe(input);
    }
  });
});
