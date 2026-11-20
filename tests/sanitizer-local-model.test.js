import { rejects } from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import process from 'node:process';
import { URL } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'test-anywhere';
import {
  createLocalModelDetector,
  createPrivacyFilterDetector,
} from '../examples/local-model-spans.mjs';
import { createSanitizer } from '../src/index.js';

const person = 'Alice Fiction';
const prefix = '🧪 é ';
const sample = prefix + person;
const execFileAsync = promisify(execFile);
const codePointSpan = {
  start: Array.from(prefix).length,
  end: Array.from(sample).length,
  label: 'private_person',
  text: person,
};
const byteSpan = {
  start: Buffer.byteLength(prefix),
  end: Buffer.byteLength(sample),
  label: 'private_person',
  confidence: 0.95,
  text: person,
};

function modelReport(spans, finish_reason = 'stop') {
  return {
    choices: [
      {
        finish_reason,
        message: { content: JSON.stringify({ unit: 'byte', spans }) },
      },
    ],
  };
}

async function serve(handler, verify) {
  const server = createServer(async (request, response) => {
    try {
      const parts = [];
      for await (const part of request) {
        parts.push(part);
      }
      const body = JSON.parse(Buffer.concat(parts).toString());
      handler(body, response);
    } catch {
      response.writeHead(500).end();
    }
  });
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    await verify(`http://127.0.0.1:${server.address().port}/scan`);
  } finally {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  }
}

describe('opt-in local model spans', () => {
  it('normalizes native OPF codepoint ranges without inventing a model score', async () => {
    await serve(
      ({ text }, response) =>
        response.end(
          JSON.stringify({
            schema_version: 1,
            summary: { decoded_mismatch: false, span_count: 1 },
            text,
            detected_spans: [codePointSpan],
          })
        ),
      async (endpoint) => {
        const detector = createPrivacyFilterDetector({ endpoint });
        const findings = await detector.detect(sample);
        expect(findings.length).toBe(1);
        const [finding] = findings;
        expect([
          finding.start,
          finding.end,
          finding.type,
          finding.category,
          finding.confidence,
        ]).toEqual([
          prefix.length,
          sample.length,
          'PERSON',
          'personal',
          undefined,
        ]);
        await rejects(detector.detect(sample.replace(person, 'Other Person')));
        const thresholded = createPrivacyFilterDetector({
          endpoint,
          minConfidence: 0.7,
        });
        await rejects(thresholded.detect(sample));
      }
    );
  });

  it('keeps deterministic credentials in hybrid and verify even when the model only finds a person', async () => {
    await serve(
      (body, response) => {
        const text = body.messages[1].content;
        const start = text.indexOf(person);
        const spans =
          start === -1
            ? []
            : [
                {
                  ...byteSpan,
                  start: Buffer.byteLength(text.slice(0, start)),
                  end: Buffer.byteLength(text.slice(0, start) + person),
                  confidence: 0.8,
                },
              ];
        response.end(JSON.stringify(modelReport(spans)));
      },
      async (endpoint) => {
        const direct = createLocalModelDetector({ endpoint, model: 'fixture' });
        expect((await direct.detect(sample))[0].start).toBe(prefix.length);
        for (const mode of ['hybrid', 'verify']) {
          const detector = createLocalModelDetector({
            endpoint,
            model: 'fixture',
            mode,
          });
          const result = await createSanitizer({
            detectors: [detector],
          }).sanitize(`${sample}\npassword=SyntheticCredentialOnly`);
          expect(
            result.findings.some(({ category }) => category === 'credential')
          ).toBe(true);
          expect(result.text).not.toContain('SyntheticCredentialOnly');
          expect(
            result.findings.some(({ rule }) => rule === 'local-model')
          ).toBe(mode === 'hybrid');
        }
      }
    );
  });
});

describe('local model failure policy and limits', () => {
  it('connects directly even when Node enables a proxy for all destinations', async () => {
    if (
      process.versions.bun ||
      process.versions.deno ||
      !process.allowedNodeEnvironmentFlags.has('--use-env-proxy')
    ) {
      return;
    }
    await serve(
      (_body, response) => {
        const status = response.req.url === '/scan' ? 200 : 502;
        response.writeHead(status).end(JSON.stringify(modelReport([])));
      },
      async (endpoint) => {
        // Forward proxy requests use the absolute URL as the request target.
        const proxy = new URL(endpoint).origin;
        await execFileAsync(
          process.execPath,
          [
            '--input-type=module',
            '--eval',
            `const { createLocalModelDetector } = await import(process.argv[1]);
             await createLocalModelDetector({ endpoint: process.argv[2], model: 'fixture' }).detect('sample');`,
            new URL('../examples/local-model-spans.mjs', import.meta.url).href,
            endpoint,
          ],
          {
            env: {
              ...process.env,
              NODE_USE_ENV_PROXY: '1',
              HTTP_PROXY: proxy,
              http_proxy: proxy,
              NO_PROXY: '',
              no_proxy: '',
            },
          }
        );
      }
    );
  });

  it('fails the entire report on invalid offsets, scores, types, quotes, or truncated completion', async () => {
    let report;
    await serve(
      (_body, response) => response.end(JSON.stringify(report)),
      async (endpoint) => {
        const detector = createLocalModelDetector({
          endpoint,
          model: 'fixture',
        });
        for (const invalid of [
          { start: 1 },
          { end: byteSpan.end + 1 },
          { start: '8' },
          { confidence: 1.1 },
          { confidence: undefined },
          { label: 'constructor' },
          { text: 'wrong' },
        ]) {
          report = modelReport([byteSpan, { ...byteSpan, ...invalid }]);
          await rejects(detector.detect(sample));
        }
        report = modelReport([byteSpan], 'length');
        await rejects(
          createSanitizer({ detectors: [detector] }).sanitize(sample)
        );
        const fallback = createLocalModelDetector({
          endpoint,
          model: 'fixture',
          failurePolicy: 'deterministic-only',
        });
        const result = await createSanitizer({
          detectors: [fallback],
        }).sanitize('password=SyntheticCredentialOnly');
        expect(result.text).not.toContain('SyntheticCredentialOnly');
      }
    );
  });

  it('bounds input and the complete response, blocks redirects and honors the deadline', async () => {
    let requests = 0;
    await serve(
      (body, response) => {
        requests += 1;
        const text = body.messages[1].content;
        if (text === 'body-stalls') {
          response.writeHead(200);
          response.write('{');
        } else if (text === 'redirect') {
          response.writeHead(307, { Location: '/other' }).end();
        } else {
          response.end(' '.repeat(2048));
        }
      },
      async (endpoint) => {
        const options = { endpoint, model: 'fixture' };
        const bounded = createLocalModelDetector({
          ...options,
          maxInputBytes: 12,
          maxResponseBytes: 1024,
        });
        await rejects(bounded.detect('extra long input'));
        await rejects(bounded.detect('\ud800'));
        expect(requests).toBe(0);
        await rejects(bounded.detect('redirect'));
        expect(requests).toBe(1);
        await rejects(bounded.detect('body-limit'));
        const timed = createLocalModelDetector({ ...options, timeoutMs: 200 });
        await rejects(timed.detect('body-stalls'));
        expect(requests).toBe(3);
        expect(() =>
          createLocalModelDetector({
            ...options,
            endpoint: 'http://outside.example/scan',
          })
        ).toThrow();
      }
    );
  });
});
