import { rejects } from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'test-anywhere';
import { createLiveReplySession } from '../examples/live-reply-adapter.mjs';

const left = 'é🧪 "one"\\line\n';
const right = 'second synthetic note';

function relay(owner, value) {
  return createLiveReplySession(owner).prepare(owner, value, {
    detector: {
      detect: (text) => {
        const start = text.indexOf(value);
        return start === -1
          ? []
          : [
              {
                start,
                end: start + value.length,
                type: 'PERSON',
                category: 'personal',
                rule: 'fixture',
              },
            ];
      },
    },
  });
}

const chunk = (index, content, finish_reason = null) => ({
  index,
  delta: content === null ? {} : { content },
  finish_reason,
});
const sse = (...choices) => `data: ${JSON.stringify({ choices })}\r\n\r\n`;
const done = 'data: [DONE]\r\n\r\n';

function fragments(bytes) {
  return Array.from(bytes, (byte) => Uint8Array.of(byte));
}

async function collectEvents(events) {
  const result = ['', ''];
  for await (const event of events) {
    if (!event.includes('[DONE]')) {
      for (const choice of JSON.parse(event.slice(6)).choices) {
        result[choice.index] += choice.delta.content ?? '';
      }
    }
  }
  return result;
}

describe('live JSON and SSE adapter', () => {
  it('re-escapes restored JSON and enforces session owner and namespace', async () => {
    const session = createLiveReplySession('owner-a');
    expect(() => session.prepare('owner-b', 'some text')).toThrow();
    const [a, b] = await Promise.all([
      relay('owner-a', left),
      relay('owner-b', right),
    ]);
    expect(a.providerText).not.toBe(b.providerText);
    expect(a.providerText).not.toContain(left);
    const payload = (content) =>
      fragments(
        Buffer.from(
          JSON.stringify({
            choices: [{ index: 0, message: { content } }],
          })
        )
      );
    const replies = await Promise.all([
      a.json(payload(a.providerText)),
      b.json(payload(a.providerText)),
    ]);
    expect(JSON.parse(replies[0]).choices[0].message.content).toBe(left);
    expect(JSON.parse(replies[1]).choices[0].message.content).toBe(
      a.providerText
    );
  });

  it('tracks interleaved delta indices after split gzip, UTF-8 and SSE decoding', async () => {
    const a = await relay('owner-a', left);
    const cut = 10;
    const events =
      sse(chunk(0, `🧪 ${a.providerText.slice(0, cut)}`)) +
      sse(chunk(1, a.providerText)) +
      sse(chunk(0, a.providerText.slice(cut))) +
      sse(chunk(1, null, 'stop'), chunk(0, null, 'stop')) +
      done;
    expect(
      await collectEvents(
        a.sse(fragments(gzipSync(events)), { encoding: 'gzip' })
      )
    ).toEqual([`🧪 ${left}`, left]);
  });

  it('drops pending values on disconnect and rejects truncation and inflation', async () => {
    const a = await relay('owner-a', left);
    const controller = new AbortController();
    const source = a.sse(
      [
        Buffer.from(
          sse(chunk(0, a.providerText)) + sse(chunk(0, null, 'stop')) + done
        ),
      ],
      { signal: controller.signal }
    );
    expect((await source.next()).value).not.toContain(left);
    controller.abort();
    await rejects(source.next());
    await rejects(
      collectEvents(a.sse([Buffer.from(sse(chunk(0, a.providerText)))]))
    );
    const oversized = gzipSync(' '.repeat(512 * 1024 + 1));
    await rejects(a.json([oversized], { encoding: 'gzip' }));
    const truncatedGzip = gzipSync(
      sse(chunk(0, 'safe', 'stop')) + done
    ).subarray(0, -5);
    await rejects(collectEvents(a.sse([truncatedGzip], { encoding: 'gzip' })));
  });
});
