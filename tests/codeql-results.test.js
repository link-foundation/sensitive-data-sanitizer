import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'test-anywhere';
import { itUnless, sandboxed } from './helpers/skip.js';

const report = (results = []) => ({
  version: '2.1.0',
  runs: [
    {
      tool: { driver: { name: 'CodeQL' } },
      invocations: [{ executionSuccessful: true }],
      results,
    },
  ],
});
function check(reports) {
  const root = mkdtempSync(join(tmpdir(), 'sarif-gate-'));
  try {
    for (const [index, data] of reports.entries()) {
      writeFileSync(
        join(root, `${index}.sarif`),
        typeof data === 'string' ? data : JSON.stringify(data)
      );
    }
    return spawnSync(
      'node',
      [resolve('scripts/check-codeql-results.mjs'), root],
      { encoding: 'utf8' }
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
describe('CodeQL local result gate', () => {
  itUnless(sandboxed)(
    'accepts explicit clean reports from every language',
    () => {
      const result = check([report(), report()]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  );
  for (const data of [
    [],
    ['{'],
    [{}],
    [{ version: '2.1.0', runs: [] }],
    [{ version: '2.1.0', runs: [{}] }],
    [
      {
        version: '2.1.0',
        runs: [
          {
            ...report().runs[0],
            invocations: [{ executionSuccessful: false }],
          },
        ],
      },
    ],
  ]) {
    itUnless(sandboxed)(
      `rejects missing, malformed, or unsuccessful evidence ${JSON.stringify(data)}`,
      () => {
        assert.notEqual(check(data).status, 0);
      }
    );
  }
  for (const level of ['error', 'warning', 'note', 'none', undefined]) {
    itUnless(sandboxed)(
      `rejects a finding with severity ${level} in a later run/file`,
      () => {
        const data = report();
        data.runs.push(
          report([
            {
              ruleId: 'test/finding',
              level,
              message: { text: 'regression finding' },
            },
          ]).runs[0]
        );
        const result = check([report(), data]);
        assert.notEqual(result.status, 0);
        assert.match(result.stdout + result.stderr, /test\/finding/);
      }
    );
  }
  it('makes full analysis and the strict result gate prerequisites of terminal success', () => {
    const workflow = readFileSync('.github/workflows/security.yml', 'utf8');
    assert.match(workflow, /CODEQL_ACTION_DIFF_INFORMED_QUERIES: 'false'/);
    assert.match(workflow, /output: codeql-results/);
    assert.ok(
      workflow.indexOf('scripts/check-codeql-results.mjs') >
        workflow.search(/uses: github\/codeql-action\/analyze@v\d+\.\d+\.\d+\s/)
    );
    assert.match(workflow, /path: codeql-results/);
  });
});

describe('CodeQL invocation notifications and log escaping', () => {
  const withNotification = (key, notification) => {
    const data = report();
    data.runs[0].invocations[0][key] = [notification];
    return data;
  };
  for (const key of [
    'toolExecutionNotifications',
    'toolConfigurationNotifications',
  ]) {
    for (const [level, status] of [
      ['error', 1],
      ['warning', 1],
      [undefined, 1],
      ['note', 0],
      ['none', 0],
    ]) {
      itUnless(sandboxed)(
        `${key} with level ${level ?? 'default warning'} exits ${status} without findings`,
        () => {
          const result = check([
            withNotification(key, {
              level,
              descriptor: { id: 'extractor/diagnostic' },
              message: { text: 'Extraction diagnostic' },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: 'src/example.js' },
                    region: { startLine: 42 },
                  },
                },
              ],
            }),
          ]);
          assert.equal(result.status, status, result.stdout + result.stderr);
          if (status) {
            assert.match(
              result.stderr,
              /extractor\/diagnostic src\/example\.js:42/
            );
            assert.match(result.stderr, /Extraction diagnostic/);
          }
        }
      );
    }
    itUnless(sandboxed)(`${key} notification without a message fails`, () => {
      const result = check([
        withNotification(key, {
          level: 'note',
          descriptor: { id: 'extractor/diagnostic' },
        }),
      ]);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /malformed \w+ notification/);
    });
  }
  itUnless(sandboxed)('malformed notification arrays fail', () => {
    const data = report();
    data.runs[0].invocations[0].toolExecutionNotifications = {};
    const result = check([data]);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /malformed toolExecutionNotifications/);
  });
  for (const field of ['ruleId', 'message', 'notification']) {
    itUnless(sandboxed)(
      `escapes workflow commands in an untrusted SARIF ${field}`,
      () => {
        const injected =
          'x\n::error title=spoof::forged\r::add-mask::secret\n##[error]legacy';
        const data = report([
          {
            ruleId: field === 'ruleId' ? injected : 'rule',
            level: 'error',
            message: { text: field === 'message' ? injected : 'finding' },
          },
        ]);
        if (field === 'notification') {
          data.runs[0].invocations[0].toolExecutionNotifications = [
            {
              level: 'warning',
              descriptor: { id: injected },
              message: { text: injected },
            },
          ];
        }
        const result = check([data]);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stderr, /spoof/);
        assert.doesNotMatch(
          result.stdout + result.stderr,
          /::(?:error|add-mask)|##\[error\]/
        );
      }
    );
  }
});
