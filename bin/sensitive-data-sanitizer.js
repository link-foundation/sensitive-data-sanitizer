#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { createSanitizer } from '../src/engines.js';
import { failure } from '../src/detection.js';
import {
  readTextFile,
  atomicWrite,
  listTextCandidates,
  decodeText,
} from '../src/files.js';
import { auditGitHistory } from '../src/history.js';
import { rewriteGitHistory } from '../src/history-rewrite.js';
import { knownSecretsFromGitHubAuth } from '../src/known.js';
import { createWikidataVerifier } from '../src/public-verifier.js';
import { streamCommand } from './stream.js';
import { sessionStructuralFields } from '../src/structured.js';
import {
  createGitleaksDetector,
  createTrufflehogDetector,
  createPresidioDetector,
} from '../src/external.js';

const help = `Usage: sensitive-data-sanitizer <redact|scan|history> [path|-] [options]

redact    Sanitize one UTF-8 file or stdin; publish only after verification
scan      Report metadata for a file, directory, or stdin (never source text)
history   Audit local reachable Git blobs, commit/tag metadata, and reflogs
history rewrite SOURCE --output DIRECTORY [--apply]
          Preview a fresh mirror clone; --apply rewrites only that clone

--config PATH       JSON knownSecrets, knownPersonal, publicEntities, limits
--output PATH       Write a new private output file atomically (redact only)
--in-place          Atomically replace the input file (redact only)
--native-only       Disable Secretlint; selected local detectors remain required
--paranoid          Add entropy detection (can redact innocent identifiers)
--gitleaks          Require locally installed Gitleaks in the detector union
--trufflehog        Require local TruffleHog with verification/updates disabled
--presidio PATH     Require a local Presidio JSON bridge (see examples)
--python COMMAND    Python executable for the bridge (default python3)
--model NAME        Installed model passed to the selected bridge
--language CODE     Model language passed to the selected bridge
--stream            Process bounded UTF-8 records; files use a bounded worker
--json              Sanitize JSON strings and keys; preserve session metadata
--jsonl             Sanitize JSONL records; combine with --stream for sessions
--identity-mask     Opt-in first/last 2 identity mask with fixed *** marker
--max-record-bytes N Maximum record bytes (JSONL: 8388608; text: 1048576)
--hive-mask         Opt-in first/last 3 mask for values longer than 12 characters
--preserve-encoding Re-encode sanitized encoded payloads with round-trip checks
--gh-auth           Read local gh auth token and mask its exact value
--verify-public     Opt-in Wikidata name lookup (sends candidate public names)
--apply             Apply history rewrite to the fresh clone, then audit it
--filter-repo PATH  git-filter-repo executable for history rewrite
--max-bytes NUMBER  Input byte limit (default 10485760)
--help              Show help
--version           Show package version

Exit codes: 0 successful redact / clean scan; 1 findings; 2 error/incomplete.
Directory scans omit .git and node_modules. Binary files are reported as
skipped and produce exit 2. History operations never push.`;

function parseArgs(argv) {
  const command = argv[0];
  const rewrite = command === 'history' && argv[1] === 'rewrite';
  const config = { command, rewrite, path: '-' };
  const boolean = new Map([
    ['--in-place', 'inPlace'],
    ['--native-only', 'nativeOnly'],
    ['--paranoid', 'paranoid'],
    ['--gitleaks', 'gitleaks'],
    ['--trufflehog', 'trufflehog'],
    ['--stream', 'stream'],
    ['--json', 'json'],
    ['--jsonl', 'jsonl'],
    ['--identity-mask', 'identityMask'],
    ['--hive-mask', 'hiveMask'],
    ['--preserve-encoding', 'preserveEncoding'],
    ['--gh-auth', 'ghAuth'],
    ['--verify-public', 'verifyPublic'],
    ['--apply', 'apply'],
  ]);
  const valued = new Map([
    ['--config', 'config'],
    ['--output', 'output'],
    ['--max-bytes', 'maxBytes'],
    ['--presidio', 'presidio'],
    ['--python', 'python'],
    ['--model', 'model'],
    ['--language', 'language'],
    ['--max-record-bytes', 'maxRecordBytes'],
    ['--filter-repo', 'filterRepo'],
  ]);
  let hasPath = false;
  for (let i = rewrite ? 2 : 1; i < argv.length; i++) {
    const arg = argv[i];
    if (boolean.has(arg)) {
      config[boolean.get(arg)] = true;
    } else if (valued.has(arg)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) {
        throw failure('ERR_ARGUMENT');
      }
      config[valued.get(arg)] = argv[++i];
    } else if (!hasPath && !arg.startsWith('--')) {
      config.path = arg;
      hasPath = true;
    } else {
      throw failure('ERR_ARGUMENT');
    }
  }
  validateArgs(config);
  return config;
}

function validateArgs(config) {
  config.maxBytes = Number(config.maxBytes ?? defaultByteLimit(config));
  if (
    !['redact', 'scan', 'history'].includes(config.command) ||
    !Number.isSafeInteger(config.maxBytes) ||
    config.maxBytes <= 0
  ) {
    throw failure('ERR_ARGUMENT');
  }
  if (
    (config.output && config.inPlace) ||
    ((config.output || config.inPlace) &&
      config.command !== 'redact' &&
      !config.rewrite) ||
    (config.inPlace && config.path === '-') ||
    (config.command === 'history' && config.path === '-')
  ) {
    throw failure('ERR_ARGUMENT');
  }
  validateFeatureArgs(config);
  validateOutput(config);
  validateBridge(config);
}

function validateFeatureArgs(config) {
  config.maxRecordBytes = Number(
    config.maxRecordBytes ?? (config.jsonl ? 8388608 : 1048576)
  );
  if (
    !Number.isSafeInteger(config.maxRecordBytes) ||
    config.maxRecordBytes <= 0 ||
    (config.stream && config.command !== 'redact') ||
    ((config.apply || config.filterRepo) && !config.rewrite) ||
    (config.rewrite &&
      (!config.output || config.inPlace || config.path === '-'))
  ) {
    throw failure('ERR_ARGUMENT');
  }
  validateStructuredArgs(config);
}

function validateStructuredArgs(config) {
  if ((config.json && config.jsonl) || (config.stream && config.json)) {
    throw failure('ERR_ARGUMENT');
  }
}

function validateBridge(config) {
  if (!config.presidio && (config.python || config.model || config.language)) {
    throw failure('ERR_ARGUMENT');
  }
}

function validateOutput(config) {
  if (
    config.output &&
    config.path !== '-' &&
    resolve(config.output) === resolve(config.path)
  ) {
    throw failure('ERR_OUTPUT');
  }
}

async function stdinText(stream, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      throw failure('ERR_LIMIT');
    }
    chunks.push(buffer);
  }
  return decodeText(Buffer.concat(chunks));
}

export async function runCli(
  argv,
  {
    stdin = process.stdin,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {}
) {
  try {
    if (!argv.length || ['--help', '-h'].includes(argv[0])) {
      stdout.write(`${help}\n`);
      return 0;
    }
    if (['--version', '-v'].includes(argv[0])) {
      stdout.write(
        `${JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version}\n`
      );
      return 0;
    }
    const config = parseArgs(argv);
    const options = await loadOptions(config);
    const engine = createSanitizer(options);
    const context = { stdin, stdout };
    if (config.command === 'history') {
      return await historyCommand(config, engine, context);
    }
    if (config.stream) {
      return await streamCommand(config, engine, options, context);
    }
    if (config.command === 'redact') {
      return await redactCommand(config, engine, context);
    }
    return await scanCommand(config, engine, context);
  } catch (error) {
    stderr.write(
      `Sanitization failed; output was blocked (${/^ERR_[A-Z_]+$/.test(error.code) ? error.code : 'ERR_SANITIZATION'}).\n`
    );
    return 2;
  }
}

async function loadOptions(config) {
  let options = {};
  if (config.config) {
    try {
      options = JSON.parse(await readTextFile(config.config, 1024 * 1024));
    } catch {
      throw failure('ERR_CONFIG');
    }
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw failure('ERR_CONFIG');
  }
  if (config.nativeOnly) {
    options.secretlint = false;
  }
  if (config.paranoid) {
    options.paranoid = true;
  }
  await featureOptions(config, options);
  options.detectors = selectedDetectors(config, options.detectors);
  options.maxInputLength = Math.min(
    options.maxInputLength ?? config.maxBytes,
    config.maxBytes
  );
  return options;
}

async function featureOptions(config, options) {
  if (config.json || config.jsonl) {
    options.structured = config.jsonl ? 'jsonl' : 'json';
    options.structuralFields ??= sessionStructuralFields;
  }
  if (config.identityMask) {
    options.identityMask = true;
  }
  if (config.hiveMask) {
    options.transformation = { mode: 'hive-mask' };
  }
  if (config.preserveEncoding) {
    options.preserveEncoding = true;
  }
  if (config.ghAuth) {
    options.knownSecrets = [
      ...(options.knownSecrets ?? []),
      ...(await knownSecretsFromGitHubAuth()),
    ];
  }
  if (config.verifyPublic) {
    options.verifyPublic = createWikidataVerifier();
  }
}

function selectedDetectors(config, detectors = []) {
  const selected = [...detectors];
  for (const [flag, factory] of [
    ['gitleaks', createGitleaksDetector],
    ['trufflehog', createTrufflehogDetector],
  ]) {
    if (config[flag]) {
      selected.push(factory());
    }
  }
  if (config.presidio) {
    const args = [resolve(config.presidio)];
    for (const name of ['model', 'language']) {
      if (config[name]) {
        args.push(`--${name}`, config[name]);
      }
    }
    selected.push(
      createPresidioDetector({
        command: config.python ?? 'python3',
        args,
      })
    );
  }
  return selected;
}

function inputText(path, config, stdin) {
  return path === '-'
    ? stdinText(stdin, config.maxBytes)
    : readTextFile(path, config.maxBytes);
}

async function redactCommand(config, engine, { stdin, stdout }) {
  const result = await engine.sanitize(
    await inputText(config.path, config, stdin)
  );
  if (config.output || config.inPlace) {
    await atomicWrite(config.output ?? config.path, result.text, {
      replace: Boolean(config.inPlace),
    });
  } else {
    stdout.write(result.text);
  }
  return 0;
}

async function historyCommand(config, engine, { stdout }) {
  if (config.rewrite) {
    const result = await rewriteGitHistory(config.path, config.output, {
      sanitizer: engine,
      apply: Boolean(config.apply),
      filterRepoCommand: config.filterRepo ?? 'git-filter-repo',
      maxBytes: config.maxBytes,
    });
    stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }
  const result = await auditGitHistory(config.path, {
    sanitizer: engine,
    maxBytes: config.maxBytes,
  });
  stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return !result.complete ? 2 : result.findings.length ? 1 : 0;
}

async function scanCommand(config, engine, { stdin, stdout }) {
  const files =
    config.path === '-' ? ['-'] : await listTextCandidates(config.path);
  const results = [],
    skipped = [];
  for (const file of files) {
    const path = (await engine.sanitize(file)).text;
    try {
      results.push({
        path,
        findings: await engine.inspect(await inputText(file, config, stdin)),
      });
    } catch (error) {
      if (['ERR_BINARY', 'ERR_ENCODING', 'ERR_LIMIT'].includes(error.code)) {
        skipped.push({ path, reason: error.code });
      } else {
        throw error;
      }
    }
  }
  const complete = skipped.length === 0;
  stdout.write(`${JSON.stringify({ complete, results, skipped }, null, 2)}\n`);
  return !complete ? 2 : results.some((r) => r.findings.length) ? 1 : 0;
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  process.exitCode = await runCli(process.argv.slice(2));
}

function defaultByteLimit(config) {
  return config.stream ? 1073741824 : 10485760;
}
