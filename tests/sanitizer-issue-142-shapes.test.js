import { describe, it, expect } from 'test-anywhere';
import { createSanitizer, createSyncSanitizer } from '../src/index.js';

// Synthetic values, assembled at run time so secret scanners skip the source.
const OPAQUE = ['f3a9', 'c2e1b7d4', '9a0e6f12', 'c4b8d3e5'].join('');
const MARKER = ['SYNTHETIC', 'TOKEN', 'ALPHA', '123456'].join('_');
const HIVE = {
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
};
const hive = (text) => createSyncSanitizer(HIVE).sanitize(text).text;

describe('credential shapes (issue 136)', () => {
  it('masks all-caps credential markers that contain a digit', async () => {
    expect(hive(`export TEST_VALUE=${MARKER}`)).toBe(
      'export TEST_VALUE=SYN…456'
    );
    expect(
      (await createSanitizer(HIVE).sanitize(`value ${MARKER} end`)).text
    ).toBe('value SYN…456 end');
    for (const text of [
      'KNOWN_LOCAL_TOKEN_ENV_VARS',
      'export CI_TOKEN_2=',
      'echo $MY_TOKEN_22 ${CI_TOKEN_2} %APP_SECRET_1%',
      'uses: ${{ secrets.NPM_TOKEN_V2 }}',
    ]) {
      expect(hive(text)).toBe(text);
    }
  });
  it('masks XML elements with attributes and camelCase names', () => {
    expect(hive(`<clientSecret attr="1">${OPAQUE}</clientSecret>`)).toBe(
      '<clientSecret attr="1">f3a…3e5</clientSecret>'
    );
    expect(hive(`<apiToken>${OPAQUE}</apiToken>`)).toBe(
      '<apiToken>f3a…3e5</apiToken>'
    );
    expect(hive(`<Password type="text">${OPAQUE}</Password>`)).toBe(
      '<Password type="text">f3a…3e5</Password>'
    );
    expect(hive('<tokenType>bearer</tokenType>')).toBe(
      '<tokenType>bearer</tokenType>'
    );
  });
  it('treats a hash rocket before a quoted literal as a separator', () => {
    expect(hive("{ 'password' => 'hunter2long' }")).toBe(
      "{ 'password' => '[REDACTED]' }"
    );
    expect(hive(`:token => "${OPAQUE}"`)).toBe(':token => "f3a…3e5"');
    expect(hive(`$cfg{secret} = { api_key => '${OPAQUE}' };`)).toBe(
      "$cfg{secret} = { api_key => 'f3a…3e5' };"
    );
    // Arrow functions are code, not credentials.
    for (const text of [
      'tokens.map(token => token.trim())',
      'const check = (password) => password.length > 8;',
    ]) {
      expect(hive(text)).toBe(text);
    }
  });
  it('masks values that start with markup but keeps placeholders', () => {
    expect(hive('token: <script>alert(1)</script>')).toBe('token: <sc…pt>');
    expect(hive(`password=<x>${OPAQUE}`)).toBe('password=<x>…3e5');
    for (const text of [
      'token: <placeholder>',
      'token=<Openverse API token>',
      'password: <password>',
    ]) {
      expect(hive(text)).toBe(text);
    }
    // Formatting tags around a value stay; only the value is masked.
    expect(hive(`token=<em>${OPAQUE}</em>`)).toBe('token=<em>f3a…3e5</em>');
  });
  it('masks plural credential flags but not counters', () => {
    expect(hive(`tool --access-tokens ${OPAQUE}`)).toBe(
      'tool --access-tokens f3a…3e5'
    );
    expect(hive(`tool --api-keys=${OPAQUE}`)).toBe('tool --api-keys=f3a…3e5');
    expect(hive(`API_KEYS=${OPAQUE}`)).toBe('API_KEYS=f3a…3e5');
    for (const text of [
      'tool --max-tokens 4096',
      'tool --tokens-budget-stats on',
      'tokens: 1234',
      '"max_tokens": 4096',
    ]) {
      expect(hive(text)).toBe(text);
    }
  });
});
