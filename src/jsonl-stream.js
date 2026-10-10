import { TextDecoder } from 'node:util';
import { Worker } from 'node:worker_threads';
import { URL } from 'node:url';
import { failure } from './detection.js';
import { workerExecArgv } from './worker-options.js';
import { prepareStreamEngine } from './engines.js';
import { inspect } from './sanitizer.js';

async function* records(source, { maxRecordBytes, maxTotalBytes }) {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  let parts = [],
    length = 0,
    total = 0;
  function decode() {
    try {
      return decoder.decode(Buffer.concat(parts, length));
    } catch {
      throw failure('ERR_ENCODING');
    }
  }
  for await (const chunk of source) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > maxTotalBytes || bytes.includes(0)) {
      throw failure(bytes.includes(0) ? 'ERR_BINARY' : 'ERR_LIMIT');
    }
    let start = 0;
    while (start < bytes.length) {
      const newline = bytes.indexOf(10, start);
      const end = newline < 0 ? bytes.length : newline + 1;
      length += end - start;
      if (length > maxRecordBytes) {
        throw failure('ERR_LIMIT');
      }
      // Copy a fragment so a small retained tail never holds a huge input buffer.
      parts.push(Buffer.from(bytes.subarray(start, end)));
      if (newline >= 0) {
        yield decode();
        parts = [];
        length = 0;
      }
      start = end;
    }
  }
  if (length) {
    yield decode();
  }
}
async function* batches(source, config) {
  let parts = [],
    length = 0;
  for await (const record of records(source, config)) {
    const bytes = Buffer.byteLength(record);
    if (length && length + bytes > config.batchBytes) {
      yield parts.join('');
      parts = [];
      length = 0;
    }
    parts.push(record);
    length += bytes;
    if (length >= config.batchBytes) {
      yield parts.join('');
      parts = [];
      length = 0;
    }
  }
  if (length) {
    yield parts.join('');
  }
}
function workerSlot(options, heap, timeout) {
  let worker;
  try {
    worker = new Worker(new URL('./record-worker.js', import.meta.url), {
      workerData: options,
      execArgv: workerExecArgv(),
      resourceLimits: { maxOldGenerationSizeMb: heap, stackSizeMb: 4 },
    });
  } catch {
    throw failure('ERR_CONFIG');
  }
  let pending,
    failed = false;
  function settle(result) {
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    pending.resolve(result);
    pending = undefined;
  }
  worker.on('message', settle);
  worker.on('error', () => {
    failed = true;
    settle({ error: 'ERR_WORKER' });
  });
  worker.on('exit', () => {
    failed = true;
    settle({ error: 'ERR_WORKER' });
  });
  return {
    run(text, confirmedPersonal, nativeFindings) {
      if (failed) {
        return Promise.resolve({ error: 'ERR_WORKER' });
      }
      return new Promise((resolve) => {
        pending = {
          resolve,
          timer: setTimeout(() => settle({ error: 'ERR_WORKER' }), timeout),
        };
        worker.postMessage({ text, confirmedPersonal, nativeFindings });
      });
    },
    async close() {
      settle({ error: 'ERR_WORKER' });
      await worker.terminate();
    },
  };
}
function workerCount(options, config) {
  const callbacks =
    options.sanitizer ||
    config.sanitizerOptions.debug ||
    config.sanitizerOptions.verifyPublic ||
    config.sanitizerOptions.detectors?.length;
  const count =
    options.workers ?? (callbacks || typeof Deno !== 'undefined' ? 1 : 2);
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 16 ||
    (callbacks && count > 1)
  ) {
    throw failure('ERR_CONFIG');
  }
  // Deno's Node compatibility does not implement resource-limited workers.
  return typeof Deno !== 'undefined' ? 1 : count;
}
export async function* sanitizeJsonlStream(source, options, config) {
  const count = workerCount(options, config);
  if (count === 1) {
    for await (const batch of batches(source, config)) {
      config.identity.prepare(
        batch,
        await prepareStreamEngine(config.engine, batch)
      );
      yield (await config.engine.sanitize(batch)).text;
    }
    return;
  }
  const heap = options.workerHeapMb ?? 256,
    timeout = options.workerTimeoutMs ?? 60000;
  if (
    !Number.isSafeInteger(heap) ||
    heap < 32 ||
    !Number.isSafeInteger(timeout) ||
    timeout <= 0
  ) {
    throw failure('ERR_CONFIG');
  }
  const slots = [],
    queue = [];
  let sequence = 0;
  async function next() {
    const result = await queue.shift();
    if (result.error) {
      throw failure(result.error);
    }
    return result.value;
  }
  try {
    for (let i = 0; i < count; i++) {
      slots.push(workerSlot(config.sanitizerOptions, heap, timeout));
    }
    for await (const batch of batches(source, config)) {
      const nativeFindings = inspect(batch, config.sanitizerOptions);
      const confirmedPersonal = config.identity.prepare(batch, nativeFindings);
      queue.push(
        slots[sequence++ % count].run(batch, confirmedPersonal, nativeFindings)
      );
      if (queue.length === count) {
        yield await next();
      }
    }
    while (queue.length) {
      yield await next();
    }
  } finally {
    await Promise.all(slots.map((slot) => slot.close()));
  }
}
