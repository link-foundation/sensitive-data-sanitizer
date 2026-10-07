import { describe, it, expect } from 'test-anywhere';
import { Linter } from 'eslint';
import plugin from '../src/eslint-plugin.js';
const linter = new Linter();
const check = (source) =>
  linter.verify(source, [
    {
      plugins: { sanitizer: plugin },
      rules: { 'sanitizer/require-sanitized-output': 'error' },
    },
  ]);
describe('outbound static guard', () => {
  it('flags unsanitized sinks, shell commands and GitHub argv/body-file arguments', () => {
    for (const source of [
      'publish(raw);',
      'execFile("gh", ["pr", "comment", "2", "--body", raw]);',
      'const args=["pr","edit","2","--body-file",raw]; execFile("gh",args);',
      'command(`gh pr comment 2 --body ${raw}`);',
      'shell`gh issue create --title ${raw}`;',
    ]) {
      expect(check(source).length).toBe(1);
    }
  });
  it('accepts literal text and verified sanitizer results', () => {
    for (const source of [
      'publish("constant");',
      'publish(await sanitizePayload(raw));',
      'const safe = await sanitize(raw); publish(safe.text);',
      'const body=await sanitizeForPublication(raw); execFile("gh",["pr","comment","2","--body",body]);',
    ]) {
      expect(check(source).length).toBe(0);
    }
  });
  it('does not trust reassigned or shadowed sanitizer variables', () => {
    expect(
      check('let safe=await sanitizePayload(raw); safe=raw; publish(safe);')
        .length
    ).toBe(1);
    expect(
      check(
        'const safe=await sanitizePayload(raw); function f(safe){ publish(safe); }'
      ).length
    ).toBe(1);
  });
});
