import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  restore,
  createSanitizer,
  createSyncSanitizer,
  nationalRules,
  reservedPlaceholderTypes,
  isPlaceholderToken,
} from '../src/index.js';
import * as credentials from '../src/credentials-entry.js';
import { namespacePattern } from '../src/placeholder-types.js';

// Synthetic values only. The policy is the one given in issue 130.
const policy = (transformation = {}, extra = {}) => ({
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: {
    mode: 'placeholder',
    map: false,
    credentials: true,
    ...transformation,
  },
  ...extra,
});
const keep = (extra = {}) => policy({ existing: 'keep' }, extra);
function code(fn) {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return undefined;
}
const once = (text, options) =>
  createSyncSanitizer(options).sanitize(text).text;

describe('existing placeholders (issue 130)', () => {
  const first = 'Звонила Анна Смирнова, тел. +7 916 123-45-67';
  it('still rejects namespace tokens by default', () => {
    const output = once(first, policy());
    expect(output).toContain('Person-1');
    expect(output).toContain('Phone-1');
    expect(code(() => once(output, policy()))).toBe(
      'ERR_PLACEHOLDER_COLLISION'
    );
  });
  it('keeps tokens and numbers new values after the highest kept number', async () => {
    const output = once(first, policy());
    expect(once(output, keep())).toBe(output);
    const next = `${output}; перезвонил Пётр Сидоров`;
    const expected = `${output}; перезвонил Person-2`;
    expect(once(next, keep())).toBe(expected);
    expect((await createSanitizer(keep()).sanitize(next)).text).toBe(expected);
    expect(sanitize(next, keep()).text).toBe(expected);
    expect(once(expected, keep())).toBe(expected);
    expect(
      once(
        'Person-7 передал звонок Анне Смирновой',
        keep({ properNames: undefined })
      )
    ).toBe('Person-7 передал звонок Person-8');
  });
  it('keeps tokens in structured values and restores the new ones exactly', () => {
    const json = { structured: 'json', sensitiveFields: ['notes'] };
    expect(once('{"notes":"Sensitive-1","age":"Age-2"}', keep(json))).toBe(
      '{"notes":"Sensitive-1","age":"Age-2"}'
    );
    const text = 'Person-1 встретил Анну Смирнову, тел. +7 916 123-45-67';
    const result = sanitize(text, {
      transformation: { mode: 'placeholder', existing: 'keep' },
    });
    expect(result.text).toBe('Person-1 встретил Person-2, тел. Phone-1');
    expect(restore(result.text, result.map)).toBe(text);
  });
  it('rejects unknown existing modes and mixed policies', () => {
    for (const existing of ['skip', true, 1]) {
      expect(code(() => once('text', policy({ existing })))).toBe('ERR_CONFIG');
    }
    expect(
      code(() =>
        once('Анна Смирнова', {
          transformation: { mode: 'placeholder', existing: 'keep' },
          transformations: { PHONE: { mode: 'placeholder' } },
        })
      )
    ).toBe('ERR_CONFIG');
  });
});

describe('typed structured placeholders (issue 130)', () => {
  it('types whole JSON values in placeholder mode', async () => {
    const notes = policy(
      {},
      { structured: 'json', sensitiveFields: ['notes'] }
    );
    expect(once('{"notes":"любой текст"}', notes)).toBe(
      '{"notes":"Sensitive-1"}'
    );
    expect(
      once('{"age":34,"msg":"ok"}', policy({}, { structured: 'json' }))
    ).toBe('{"age":"Age-1","msg":"ok"}');
    expect(
      (await createSanitizer(notes).sanitize('{"notes":{"a":1},"x":[2]}')).text
    ).toBe('{"notes":"Sensitive-1","x":[2]}');
  });
  it('restores the original JSON values exactly', () => {
    const text = '{"notes":{"a":1},"age":34,"note2":"любой текст"}';
    const result = sanitize(text, {
      structured: 'json',
      profile: 'documents',
      sensitiveFields: ['notes', 'note2'],
      transformation: { mode: 'placeholder' },
    });
    expect(result.text).toBe(
      '{"notes":"Sensitive-1","age":"Age-1","note2":"Sensitive-2"}'
    );
    expect(restore(result.text, result.map)).toBe(text);
  });
  it('keeps redaction for JSON values in other modes', () => {
    expect(
      sanitize('{"notes":"любой текст"}', {
        structured: 'json',
        sensitiveFields: ['notes'],
      }).text
    ).toBe('{"notes":"[REDACTED]"}');
  });
});

describe('placeholder namespace (issue 130)', () => {
  it('exports a complete, stable list of reserved types', () => {
    const types = reservedPlaceholderTypes();
    expect(Object.isFrozen(types)).toBe(true);
    expect(reservedPlaceholderTypes()).toBe(types);
    expect(credentials.reservedPlaceholderTypes()).toBe(types);
    for (const type of [
      ...nationalRules.map((rule) => rule.type),
      'PERSON',
      'PROPER_NAME',
      'PERSONAL_ATTRIBUTE',
      'AGE',
      'DATE',
      'SENSITIVE',
      'CREDENTIAL',
    ]) {
      expect(types).toContain(type);
    }
  });
  it('recognizes whole tokens of any format and custom types', () => {
    expect(isPlaceholderToken('Person-1')).toBe(true);
    expect(isPlaceholderToken('UsBankNumber-12')).toBe(true);
    expect(credentials.isPlaceholderToken('Phone-3')).toBe(true);
    for (const text of ['Person-0', 'Person-01', 'Persona-1', ' Person-1', 1]) {
      expect(isPlaceholderToken(text)).toBe(false);
    }
    expect(isPlaceholderToken('<PERSON_3>', { format: '<{TYPE}_{n}>' })).toBe(
      true
    );
    expect(isPlaceholderToken('Ticket-3')).toBe(false);
    expect(isPlaceholderToken('Ticket-3', { types: ['TICKET'] })).toBe(true);
    expect(code(() => isPlaceholderToken('x', { format: '{n}' }))).toBe(
      'ERR_CONFIG'
    );
    expect(code(() => isPlaceholderToken('x', { types: ['lower'] }))).toBe(
      'ERR_CONFIG'
    );
  });
  it('compiles the namespace pattern once per format', () => {
    expect(namespacePattern('{Type}-{n}', ['PERSON'])).toBe(
      namespacePattern('{Type}-{n}', [])
    );
    expect(namespacePattern('{Type}-{n}', ['TICKET'])).not.toBe(
      namespacePattern('{Type}-{n}', [])
    );
  });
});
