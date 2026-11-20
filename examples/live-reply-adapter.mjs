import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { TextDecoder } from 'node:util';
import { createGunzip } from 'node:zlib';
import {
  createRestoreMap,
  createSanitizer,
  createStreamingRestorer,
} from '../src/index.js';
import { failure } from '../src/detection.js';

const bodyLimit = 512 * 1024;
const frameLimit = 64 * 1024;
const choiceLimit = 16;

function checkCancellation(signal) {
  if (signal?.aborted) {
    throw failure('ERR_ABORT');
  }
}

async function* bounded(chunks, limit) {
  let total = 0;
  for await (const chunk of chunks) {
    total += chunk.byteLength;
    if (total > limit) {
      throw failure('ERR_LIMIT');
    }
    yield chunk;
  }
}

// Takes raw bytes after the HTTP stack removes transfer framing. Do not
// decompress a fetch() response a second time; fetch already decodes it.
async function* decodedBody(chunks, { encoding = 'identity', signal } = {}) {
  if (encoding !== 'identity' && encoding !== 'gzip') {
    throw failure('ERR_ENCODING');
  }
  const incoming = Readable.from(bounded(chunks, bodyLimit), {
    objectMode: false,
  });
  const body = new PassThrough();
  const transforms = encoding === 'gzip' ? [createGunzip()] : [];
  const transfer = pipeline(incoming, ...transforms, body, { signal });
  // The reader and the pipeline can fail independently. Observe both and
  // wait for teardown before returning a failure or accepting the final EOF.
  void transfer.catch(() => {});
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    for await (const bytes of bounded(body, bodyLimit)) {
      yield decoder.decode(bytes, { stream: true });
    }
    await transfer;
    yield decoder.decode();
  } finally {
    body.destroy();
    await transfer.catch(() => {});
  }
}

// Restricted data-only SSE with comments and LF/CRLF framing. Protocol
// fields outside this example's contract are rejected.
async function* dataEvents(chunks) {
  let pending = '';
  let lines = [];
  let size = 0;
  for await (const chunk of chunks) {
    const text = pending + chunk;
    let start = 0;
    for (
      let end = text.indexOf('\n');
      end >= 0;
      end = text.indexOf('\n', start)
    ) {
      const line = text.slice(start, end).replace(/\r$/, '');
      start = end + 1;
      size += line.length + 1;
      if (size > frameLimit) {
        throw failure('ERR_LIMIT');
      }
      if (line === '') {
        if (lines.length) {
          yield lines.join('\n');
        }
        lines = [];
        size = 0;
      } else if (line.startsWith('data:')) {
        lines.push(line.slice(5).replace(/^ /, ''));
      } else if (!line.startsWith(':')) {
        throw failure('ERR_PROTOCOL');
      }
    }
    pending = text.slice(start);
    if (size + pending.length > frameLimit) {
      throw failure('ERR_LIMIT');
    }
  }
  if (pending || lines.length) {
    throw failure('ERR_PROTOCOL');
  }
}

function choiceIndex(choice) {
  const index = choice?.index;
  if (!Number.isInteger(index) || index < 0 || index >= choiceLimit) {
    throw failure('ERR_PROTOCOL');
  }
  return index;
}

function textDelta(choice) {
  const delta = choice.delta;
  if (
    !delta ||
    Object.keys(delta).some((key) => key !== 'role' && key !== 'content') ||
    (delta.content !== undefined &&
      delta.content !== null &&
      typeof delta.content !== 'string') ||
    (choice.finish_reason !== undefined &&
      choice.finish_reason !== null &&
      typeof choice.finish_reason !== 'string')
  ) {
    throw failure('ERR_PROTOCOL');
  }
  return delta;
}

function restoreEvent(data, cursors, restorer, signal) {
  const event = JSON.parse(data);
  const choices = event?.choices;
  if (!Array.isArray(choices) || choices.length > choiceLimit) {
    throw failure('ERR_PROTOCOL');
  }
  const seen = new Set();
  for (const choice of choices) {
    const index = choiceIndex(choice);
    if (seen.has(index) || cursors.get(index) === null) {
      throw failure('ERR_PROTOCOL');
    }
    seen.add(index);
    const delta = textDelta(choice);
    const cursor = cursors.get(index) ?? restorer.open({ signal });
    let text = cursor.write(delta.content ?? '');
    if (typeof choice.finish_reason === 'string') {
      text += cursor.finish();
      cursors.set(index, null);
    } else {
      cursors.set(index, cursor);
    }
    if (text || typeof delta.content === 'string') {
      delta.content = text;
    }
  }
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function* restoreEvents(chunks, restorer, options) {
  const cursors = new Map();
  let sentBytes = 0;
  let ended = false;
  try {
    for await (const data of dataEvents(decodedBody(chunks, options))) {
      if (ended) {
        throw failure('ERR_PROTOCOL');
      }
      if (data === '[DONE]') {
        if (!cursors.size || [...cursors.values()].some(Boolean)) {
          throw failure('ERR_PROTOCOL');
        }
        ended = true;
        continue;
      }
      const event = restoreEvent(data, cursors, restorer, options.signal);
      sentBytes += Buffer.byteLength(event);
      if (sentBytes > bodyLimit) {
        throw failure('ERR_LIMIT');
      }
      options.signal?.throwIfAborted();
      yield event;
    }
    if (!ended) {
      throw failure('ERR_PROTOCOL');
    }
    options.signal?.throwIfAborted();
    yield 'data: [DONE]\n\n';
  } catch {
    throw failure('ERR_REPLY');
  } finally {
    for (const cursor of cursors.values()) {
      cursor?.cancel();
    }
  }
}

async function restoreJson(chunks, restorer, options) {
  try {
    const parts = [];
    for await (const part of decodedBody(chunks, options)) {
      parts.push(part);
    }
    const reply = JSON.parse(parts.join(''));
    if (!Array.isArray(reply?.choices) || reply.choices.length > choiceLimit) {
      throw failure('ERR_PROTOCOL');
    }
    const seen = new Set();
    for (const choice of reply.choices) {
      const index = choiceIndex(choice);
      const message = choice.message;
      if (
        seen.has(index) ||
        typeof message?.content !== 'string' ||
        message.tool_calls ||
        message.function_call
      ) {
        throw failure('ERR_PROTOCOL');
      }
      seen.add(index);
      const cursor = restorer.open({ signal: options.signal });
      const restored = [];
      for (let start = 0; start < message.content.length; start += frameLimit) {
        restored.push(
          cursor.write(message.content.slice(start, start + frameLimit))
        );
      }
      restored.push(cursor.finish());
      message.content = restored.join('');
    }
    const encoded = JSON.stringify(reply);
    if (Buffer.byteLength(encoded) > bodyLimit) {
      throw failure('ERR_LIMIT');
    }
    options.signal?.throwIfAborted();
    return encoded;
  } catch {
    throw failure('ERR_REPLY');
  }
}

/**
 * The gateway creates this only after authenticating and authorizing session
 * ownership. Pass a server-verified principal, never a header or request field.
 */
export function createLiveReplySession(owner) {
  if (typeof owner !== 'string' || !owner) {
    throw failure('ERR_AUTH');
  }
  const namespace = randomBytes(8).toString('hex');
  let map = createRestoreMap({ format: `[[${namespace}:{TYPE}_{n}]]` });
  let queue = Promise.resolve();
  let preparing = 0;

  return {
    prepare(principal, text, { detector, signal } = {}) {
      if (principal !== owner) {
        throw failure('ERR_AUTH');
      }
      if (typeof text !== 'string' || !text.isWellFormed()) {
        throw failure('ERR_INPUT');
      }
      if (preparing >= 8 || Buffer.byteLength(text) > frameLimit) {
        throw failure('ERR_LIMIT');
      }
      preparing += 1;
      const preparation = queue.then(async () => {
        checkCancellation(signal);
        const working = globalThis.structuredClone(map);
        const result = await createSanitizer({
          detectors: detector ? [detector] : [],
          maxInputLength: frameLimit,
          transformation: { mode: 'placeholder', map: working },
        }).sanitize(text);
        result.map.documents.length = 0;
        const restorer = createStreamingRestorer(result.map, {
          maxOutputUnits: bodyLimit,
        });
        checkCancellation(signal);
        map = result.map;
        return {
          providerText: result.text,
          redactions: result.redactions,
          json: (chunks, options = {}) =>
            restoreJson(chunks, restorer, options),
          sse: (chunks, options = {}) =>
            restoreEvents(chunks, restorer, options),
        };
      });
      queue = preparation
        .catch(() => {})
        .finally(() => {
          preparing -= 1;
        });
      return preparation;
    },
  };
}
