import { TextDecoder } from 'node:util';
import { constants } from 'node:fs';
import {
  open,
  lstat,
  unlink,
  link,
  rename,
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { URL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import {
  createSanitizer,
  sanitizerConfiguration,
  prepareStreamEngine,
} from './engines.js';
import { failure } from './detection.js';
import { sanitizeJsonlStream } from './jsonl-stream.js';
import { workerExecArgv } from './worker-options.js';
import { streamIdentity } from './stream-identity.js';

const streamKeys = new Set([
  'sanitizer',
  'sanitizerOptions',
  'maxRecordBytes',
  'batchBytes',
  'maxTotalBytes',
  'worker',
  'workers',
  'workerHeapMb',
  'workerTimeoutMs',
  'replace',
  'maxRegistryValues',
]);
function configuration(options) {
  const suppliedOptions = sanitizerConfiguration(options.sanitizer);
  const jsonl =
    (options.sanitizerOptions?.structured ??
      suppliedOptions?.structured ??
      options.structured) === 'jsonl';
  const maxRecordBytes =
    options.maxRecordBytes ?? (jsonl ? 8 : 1) * 1024 * 1024;
  const batchBytes = options.batchBytes ?? 256 * 1024;
  const maxTotalBytes = options.maxTotalBytes ?? 1024 * 1024 * 1024;
  for (const limit of [maxRecordBytes, batchBytes, maxTotalBytes]) {
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw failure('ERR_CONFIG');
    }
  }
  const identity = streamIdentity(
    {
      ...suppliedOptions,
      ...(options.sanitizerOptions ??
        Object.fromEntries(
          Object.entries(options).filter(([k]) => !streamKeys.has(k))
        )),
      maxInputLength: Math.max(maxRecordBytes, batchBytes) + 1,
    },
    options.maxRegistryValues
  );
  const sanitizerOptions = identity.options;
  const engine = createSanitizer(sanitizerOptions);
  return {
    maxRecordBytes,
    batchBytes,
    maxTotalBytes,
    sanitizerOptions,
    jsonl,
    identity,
    engine:
      !options.sanitizer || suppliedOptions
        ? engine
        : {
            async sanitize(text) {
              const result = await options.sanitizer.sanitize(text);
              return engine.sanitize(result.text);
            },
          },
  };
}
// Hold an incomplete record, multiline quotes, PEM blocks and wrapped base64.
// Held records have a finite byte limit; exceeding it blocks publication.
function advanceQuotes(line, state) {
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (state.escaped) {
      state.escaped = false;
      continue;
    }
    if (char === '\\' && state.quote) {
      state.escaped = true;
      continue;
    }
    if (state.quote && char === state.quote) {
      state.quote = '';
    } else if (!state.quote && opensQuote(char, line[i - 1])) {
      state.quote = char;
    }
  }
}
function opensQuote(char, previous) {
  return (
    char === '"' || (char === "'" && !/[\p{L}\p{N}]/u.test(previous ?? ''))
  );
}
function advanceCredentials(line, text, offset, state) {
  if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(line)) {
    state.pem = true;
  }
  if (/-----END [A-Z0-9 ]*PRIVATE KEY-----/.test(line)) {
    state.pem = false;
  }
  if (/^PuTTY-User-Key-File-[23]:/.test(line)) {
    state.putty = true;
  }
  if (/^Private-MAC:[ \t]*[a-fA-F0-9]+/.test(line)) {
    state.putty = false;
  }
  if (
    state.netrcStart < 0 &&
    /^\s*(?:machine\s+\S+|default)(?:\s|$)/.test(line)
  ) {
    state.netrcStart = offset;
  }
  if (
    state.netrcStart >= 0 &&
    /(?:machine\s+\S+|default)\s+login\s+\S+\s+password\s+\S+/.test(
      text.slice(state.netrcStart, offset + line.length)
    )
  ) {
    state.netrcStart = -1;
  }
}
function releaseBoundary(text, final) {
  let offset = 0,
    boundary = 0,
    base64Start = -1;
  const state = {
    quote: '',
    escaped: false,
    pem: false,
    putty: false,
    netrcStart: -1,
  };
  for (const match of text.matchAll(/[^\n]*\n|[^\n]+$/g)) {
    const line = match[0];
    const base64 = (
      base64Start >= 0
        ? /^[A-Za-z0-9+/_-]{1,128}={0,2}\r?\n?$/
        : /^[A-Za-z0-9+/_-]{16,128}={0,2}\r?\n?$/
    ).test(line);
    if (base64 && base64Start < 0) {
      base64Start = offset;
    }
    if (!base64) {
      base64Start = -1;
    }
    advanceCredentials(line, text, offset, state);
    advanceQuotes(line, state);
    offset += line.length;
    if (state.quote || state.pem || state.putty || state.netrcStart >= 0) {
      continue;
    }
    if (base64Start >= 0) {
      boundary = Math.min(boundary, base64Start);
    } else if (line.endsWith('\n') || final) {
      boundary = offset;
    }
  }
  return final ? text.length : boundary;
}
export async function* sanitizeStream(source, options = {}) {
  const config = configuration(options);
  if (config.jsonl) {
    yield* sanitizeJsonlStream(source, options, config);
    return;
  }
  const { engine, maxRecordBytes, batchBytes, maxTotalBytes } = config;
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  let pending = '',
    total = 0;
  async function* process(final) {
    if (Buffer.byteLength(pending) > maxRecordBytes) {
      throw failure('ERR_LIMIT');
    }
    // Until a batch can be released, rescanning every partial chunk only
    // repeats work. The byte bound above still applies on every chunk.
    if (!final && pending.length < Math.min(batchBytes, maxRecordBytes / 2)) {
      return;
    }
    const boundary = releaseBoundary(pending, final);
    if (
      boundary &&
      (final || boundary >= batchBytes || pending.length >= maxRecordBytes / 2)
    ) {
      const text = pending.slice(0, boundary);
      pending = pending.slice(boundary);
      config.identity.prepare(text, await prepareStreamEngine(engine, text));
      yield (await engine.sanitize(text)).text;
    }
  }
  for await (const chunk of source) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > maxTotalBytes || bytes.includes(0)) {
      throw failure(bytes.includes(0) ? 'ERR_BINARY' : 'ERR_LIMIT');
    }
    for (
      let i = 0;
      i < bytes.length;
      i += Math.min(65536, Math.max(1, maxRecordBytes / 4))
    ) {
      try {
        pending += decoder.decode(
          bytes.subarray(
            i,
            i + Math.min(65536, Math.max(1, maxRecordBytes / 4))
          ),
          { stream: true }
        );
      } catch {
        throw failure('ERR_ENCODING');
      }
      yield* process(false);
    }
  }
  try {
    pending += decoder.decode();
  } catch {
    throw failure('ERR_ENCODING');
  }
  yield* process(true);
}
export async function sanitizeStreamToFile(source, path, options = {}) {
  const target = resolve(path),
    temporary = join(dirname(target), `.sanitizer-${randomUUID()}.tmp`);
  let handle,
    outputBytes = 0;
  try {
    await validateTarget(target, options.replace);
    handle = await open(temporary, 'wx', 0o600);
    for await (const chunk of sanitizeStream(source, options)) {
      outputBytes += Buffer.byteLength(chunk);
      await handle.writeFile(chunk, 'utf8');
    }
    await handle.sync();
    await handle.close();
    handle = undefined;
    if (options.replace) {
      await rename(temporary, target);
    } else {
      await link(temporary, target);
      await unlink(temporary);
    }
    return { outputBytes };
  } catch (error) {
    throw failure(/^ERR_[A-Z_]+$/.test(error.code) ? error.code : 'ERR_OUTPUT');
  } finally {
    await handle?.close();
    await unlink(temporary).catch(() => {});
  }
}
async function validateTarget(target, replace) {
  try {
    const info = await lstat(target);
    if (!replace || !info.isFile() || info.isSymbolicLink()) {
      throw failure('ERR_OUTPUT');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}
export async function sanitizeFileToFile(source, target, options = {}) {
  let handle;
  try {
    handle = await open(
      source,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    );
    const info = await handle.stat();
    if (!info.isFile()) {
      throw failure('ERR_FILE');
    }
    const result = await sanitizeStreamToFile(
      handle.createReadStream({ highWaterMark: 65536, autoClose: false }),
      target,
      options
    );
    return { ...result, inputBytes: info.size };
  } catch (error) {
    throw failure(/^ERR_[A-Z_]+$/.test(error.code) ? error.code : 'ERR_FILE');
  } finally {
    await handle?.close();
  }
}
export async function sanitizeFileBounded(source, target, options = {}) {
  if (options.worker === false || options.sanitizer) {
    return sanitizeFileToFile(source, target, options);
  }
  const workerHeapMb = options.workerHeapMb ?? 256,
    workerTimeoutMs = options.workerTimeoutMs ?? 60000;
  if (
    !Number.isSafeInteger(workerHeapMb) ||
    workerHeapMb < 32 ||
    !Number.isSafeInteger(workerTimeoutMs) ||
    workerTimeoutMs <= 0
  ) {
    throw failure('ERR_CONFIG');
  }
  const staging = await mkdtemp(
    join(dirname(resolve(target)), '.sanitizer-worker-')
  );
  let worker;
  try {
    await validateTarget(resolve(target), options.replace);
    worker = new Worker(new URL('./stream-worker.js', import.meta.url), {
      workerData: {
        source,
        target: join(staging, 'output'),
        options: { ...options, replace: false },
      },
      resourceLimits: { maxOldGenerationSizeMb: workerHeapMb, stackSizeMb: 4 },
      execArgv: workerExecArgv(),
    });
    const result = await workerResult(worker, workerTimeoutMs);
    if (options.replace) {
      await rename(join(staging, 'output'), target);
    } else {
      await link(join(staging, 'output'), target);
    }
    return result;
  } finally {
    await worker?.terminate();
    await rm(staging, { recursive: true, force: true });
  }
}
function workerResult(worker, timeoutMs) {
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => reject(failure('ERR_WORKER')), timeoutMs);
    const fail = () => {
      clearTimeout(timer);
      reject(failure('ERR_WORKER'));
    };
    worker.once('message', (result) => {
      clearTimeout(timer);
      result.error ? reject(failure(result.error)) : accept(result.value);
    });
    worker.once('error', fail);
    worker.once('exit', fail);
  });
}
