import { describe, it, expect } from 'test-anywhere';
import { Buffer } from 'node:buffer';
import { createSyncSanitizer } from '../src/credentials-entry.js';

// Synthetic credentials assembled at runtime, never real secrets.
const GH = ['ghp_', 'Zx9Qw7Er5Ty3Ui1Op0As', '2Df4Gh6Jk8Lz0Xc2Vb4N'].join('');
const OTHER = ['ghp_', 'Ax8Sw6De4Fr2Gt0Hy9Ju', '1Ki3Lo5Pq7We9Rt1Yu3I'].join('');
const options = {
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
};
const engine = createSyncSanitizer(options);

function stable(input, expected, sanitizer = engine) {
  let text = input;
  for (let pass = 0; pass < 3; pass++) {
    text = sanitizer.sanitize(text).text;
    expect(text).toBe(expected);
  }
}

describe('masked credential context boundaries (issue 148)', () => {
  it('preserves the original vendor mask and sentence on repeated passes', () => {
    stable(
      `User token: ${GH}. Next sentence`,
      'User token: ghp…b4N. Next sentence'
    );
  });

  it('still masks a later credential on the same line', () => {
    stable(
      `User token: ${GH}. Next sentence; password: ${OTHER}. Last sentence`,
      'User token: ghp…b4N. Next sentence; password: ghp…u3I. Last sentence'
    );
    stable(
      `User token: ghp…b4N. Next sentence ${OTHER}. Last sentence`,
      'User token: ghp…b4N. Next sentence ghp…u3I. Last sentence'
    );
  });

  it('recognizes complete masks before punctuation and whitespace', () => {
    for (const mask of ['ghp…b4N', 'ghp...b4N', 'ab***yz', '***']) {
      for (const separator of ['. ', ', ', '; ', ': ', '! ', '? ', ' ', '\t']) {
        const text = `User token: ${mask}${separator}Next sentence`;
        stable(text, text);
      }
    }
  });

  for (const encoding of ['base64', 'base64url', 'hex', 'percent']) {
    it(`preserves prose and masks later credentials through repeated ${encoding} passes`, () => {
      const encode = (text) =>
        encoding === 'percent'
          ? Array.from(
              Buffer.from(text),
              (byte) => `%${byte.toString(16).padStart(2, '0')}`
            ).join('')
          : Buffer.from(text).toString(encoding);
      const input = `User token: ${GH}. Next sentence; password: ${OTHER}. Last sentence`;
      const expected =
        'User token: ghp…b4N. Next sentence; password: ghp…u3I. Last sentence';
      stable(`body ${encode(input)} end`, `body ${encode(expected)} end`);
      stable(
        `body ${encode(`User token: ghp…b4N. Next sentence; password: ${OTHER}. Last sentence`)} end`,
        `body ${encode(expected)} end`
      );
    });
  }

  it('does not exempt masks glued to literal credential material', () => {
    for (const value of [
      'ghp…b4N.literalSecret9',
      'ghp…b4NliteralSecret9',
      'ghp…b4N/secret9',
    ]) {
      expect(engine.sanitize(`password: ${value}`).text).not.toContain(value);
    }
  });

  it('keeps exact known secrets authoritative even when they look masked', () => {
    const sanitizer = createSyncSanitizer({
      ...options,
      knownSecrets: ['ghp…b4N'],
    });
    const output = sanitizer.sanitize(
      'User token: ghp…b4N. Next sentence'
    ).text;
    expect(output).toBe('User token: [REDACTED]. Next sentence');
    expect(
      sanitizer.sanitize('User token: ghp…b4N. Next sentence ghp…b4N').text
    ).toBe('User token: [REDACTED]. Next sentence [REDACTED]');
  });

  it('reports the existing template diagnostic without exposing values', () => {
    const events = [];
    const sanitizer = createSyncSanitizer({
      ...options,
      debug: (event) => events.push(event),
    });
    const text = 'User token: ghp…b4N. Next sentence';
    expect(sanitizer.sanitize(text).text).toBe(text);
    expect(
      events.some(
        (event) => event.event === 'template-value' && event.rule === 'context'
      )
    ).toBe(true);
  });
});
