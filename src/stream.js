import { LogDecoder, encodeLogText } from './log-bytes.js';
import { constants, createReadStream } from 'node:fs';
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
import { failure, internalFailure } from './detection.js';
import { sanitizeJsonlStream } from './jsonl-stream.js';
import { workerExecArgv } from './worker-options.js';
import { streamIdentity } from './stream-identity.js';
import { workerResult } from './file-worker-result.js';

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
  'twoPass',
  'allowBinary',
]);
function configuration(options, collecting = false, complete) {
  validatePass(options);
  const suppliedOptions = sanitizerConfiguration(options.sanitizer);
  const structured =
    options.sanitizerOptions?.structured ??
    suppliedOptions?.structured ??
    options.structured;
  const jsonl = structured === 'jsonl';
  validateBinary(options, structured);
  const batchBytes = options.batchBytes ?? 256 * 1024;
  const maxTotalBytes = options.maxTotalBytes ?? 1024 * 1024 * 1024;
  const maxRecordBytes =
    options.maxRecordBytes ?? (jsonl ? 8 * 1024 * 1024 : maxTotalBytes);
  for (const limit of [maxRecordBytes, batchBytes, maxTotalBytes]) {
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw failure('ERR_CONFIG');
    }
  }
  const identity = streamIdentity(
    identityConfiguration(options, suppliedOptions, maxRecordBytes, batchBytes),
    options.maxRegistryValues,
    collecting,
    complete
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
    collecting,
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
function validateBinary(options, structured) {
  if (
    (options.allowBinary !== undefined &&
      typeof options.allowBinary !== 'boolean') ||
    (options.allowBinary && structured)
  ) {
    throw failure('ERR_CONFIG');
  }
}
function validatePass(options) {
  if (options.twoPass !== undefined && typeof options.twoPass !== 'boolean') {
    throw failure('ERR_CONFIG');
  }
}
function identityConfiguration(
  options,
  suppliedOptions,
  maxRecordBytes,
  batchBytes
) {
  return {
    ...suppliedOptions,
    ...(options.sanitizerOptions ??
      Object.fromEntries(
        Object.entries(options).filter(([k]) => !streamKeys.has(k))
      )),
    maxInputLength: Math.max(maxRecordBytes, batchBytes) + 1,
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
  if (options.twoPass) {
    throw failure('ERR_CONFIG');
  }
  try {
    yield* streamWithConfiguration(source, options, configuration(options));
  } catch (error) {
    throw internalFailure(error);
  }
}
async function* streamWithConfiguration(source, options, config) {
  if (config.jsonl) {
    yield* sanitizeJsonlStream(source, options, config);
    return;
  }
  const { engine, maxRecordBytes, batchBytes, maxTotalBytes } = config;
  const decoder = new LogDecoder();
  let pending = '',
    total = 0,
    pendingBytes = 0,
    nextScan = Math.min(batchBytes, maxRecordBytes / 2);
  async function* process(final) {
    if (pendingBytes > maxRecordBytes) {
      throw failure('ERR_LIMIT');
    }
    // Until a batch can be released, rescanning every partial chunk only
    // repeats work. The byte bound above still applies on every chunk.
    if (!final && pending.length < nextScan) {
      return;
    }
    const boundary = releaseBoundary(pending, final);
    if (
      boundary &&
      (final || boundary >= batchBytes || pending.length >= maxRecordBytes / 2)
    ) {
      const text = pending.slice(0, boundary);
      pending = pending.slice(boundary);
      pendingBytes -= encodeLogText(text).length;
      config.identity.prepare(text, await prepareStreamEngine(engine, text));
      if (config.collecting) {
        config.onProgress?.();
      }
      if (!config.collecting) {
        yield (await engine.sanitize(text)).text;
      }
    }
    // An incomplete logical record is rescanned at geometrically increasing
    // sizes, so arbitrary chunking cannot turn one long line quadratic.
    nextScan = Math.max(
      Math.min(batchBytes, maxRecordBytes / 2),
      pending.length * 2
    );
  }
  for await (const chunk of source) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > maxTotalBytes) {
      throw failure('ERR_LIMIT');
    }
    if (!options.allowBinary && bytes.includes(0)) {
      throw failure('ERR_BINARY');
    }
    for (
      let i = 0;
      i < bytes.length;
      i += Math.min(65536, Math.max(1, maxRecordBytes / 4))
    ) {
      try {
        const decoded = decoder.decode(
          bytes.subarray(
            i,
            i + Math.min(65536, Math.max(1, maxRecordBytes / 4))
          ),
          { stream: true }
        );
        pending += decoded;
        pendingBytes += encodeLogText(decoded).length;
      } catch {
        throw failure('ERR_ENCODING');
      }
      yield* process(false);
    }
  }
  try {
    const decoded = decoder.decode();
    pending += decoded;
    pendingBytes += encodeLogText(decoded).length;
  } catch {
    throw failure('ERR_ENCODING');
  }
  yield* process(true);
}
export async function sanitizeStreamToFile(
  source,
  path,
  options = {},
  onProgress
) {
  const target = resolve(path),
    temporary = join(dirname(target), `.sanitizer-${randomUUID()}.tmp`);
  let handle,
    outputBytes = 0;
  try {
    await validateTarget(target, options.replace);
    handle = await open(temporary, 'wx', 0o600);
    const stream = options.twoPass
      ? twoPassStream(source, temporary, options, onProgress)
      : sanitizeStream(source, options);
    for await (const chunk of stream) {
      const bytes = encodeLogText(chunk);
      outputBytes += bytes.length;
      await handle.writeFile(bytes);
      onProgress?.();
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
    throw /^ERR_[A-Z_]+$/.test(error?.code) ? error : failure('ERR_OUTPUT');
  } finally {
    await handle?.close();
    await unlink(temporary).catch(() => {});
  }
}
async function* twoPassStream(source, temporary, options, onProgress) {
  const spool = `${temporary}.input`;
  let input;
  try {
    const discovery = configuration(options, true);
    discovery.onProgress = onProgress;
    input = await open(spool, 'wx', 0o600);
    async function* capture() {
      let total = 0;
      for await (const chunk of source) {
        const bytes = Buffer.from(chunk);
        total += bytes.length;
        if (total > discovery.maxTotalBytes) {
          throw failure('ERR_LIMIT');
        }
        await input.writeFile(bytes);
        yield bytes;
      }
    }
    for await (const chunk of streamWithConfiguration(
      capture(),
      options,
      discovery
    )) {
      void chunk;
    }
    await input.close();
    input = undefined;
    const complete = {
      ...options,
      twoPass: false,
      sanitizerOptions: discovery.sanitizerOptions,
    };
    yield* streamWithConfiguration(
      createReadStream(spool),
      complete,
      configuration(complete, false, true)
    );
  } catch (error) {
    throw internalFailure(error);
  } finally {
    await input?.close();
    await unlink(spool).catch(() => {});
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
export async function sanitizeFileToFile(
  source,
  target,
  options = {},
  onProgress
) {
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
      options,
      onProgress
    );
    return { ...result, inputBytes: info.size };
  } catch (error) {
    throw /^ERR_[A-Z_]+$/.test(error?.code) ? error : failure('ERR_FILE');
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
    workerTimeoutMs <= 0 ||
    workerTimeoutMs > 2147483647
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
