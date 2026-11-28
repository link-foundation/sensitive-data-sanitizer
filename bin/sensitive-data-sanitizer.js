#!/usr/bin/env node
import '../src/personal-features.js';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { createSanitizer } from '../src/engines.js';
import { failure } from '../src/detection.js';
import {
  readTextFile,
  readTextInput,
  atomicWrite,
  decodeTextInput,
  encodeTextOutput,
} from '../src/files.js';
import { auditGitHistory } from '../src/history.js';
import { rewriteGitHistory } from '../src/history-rewrite.js';
import {
  knownSecretsFromGitHubAuth,
  knownSecretsFromEnv,
  knownSecretsFromGitHubConfig,
} from '../src/known.js';
import { decodeLinoObject } from '../src/lino-object.js';
import {
  cliLocale,
  cliLocaleArgument,
  resolveCliEnvironment,
} from './cli-messages.js';
import { readStdinBytes, scanCommand } from './scan.js';
import { publishReport } from './scan-report.js';
import { createWikidataVerifier } from '../src/public-verifier.js';
import { streamCommand } from './stream.js';
import { sessionStructuralFields } from '../src/structured.js';
import { placeholderOptions, saveMap, restoreCommand } from './placeholders.js';
import {
  createGitleaksDetector,
  createBetterleaksDetector,
  createTrufflehogDetector,
  createPresidioDetector,
} from '../src/external.js';

function parseArgs(argv, defaultConfigPath) {
  const command = argv[0];
  const rewrite = command === 'history' && argv[1] === 'rewrite';
  const config = { command, rewrite, path: '-', config: defaultConfigPath };
  const boolean = new Map([
    ['--in-place', 'inPlace'],
    ['--native-only', 'nativeOnly'],
    ['--credentials-only', 'credentialsOnly'],
    ['--known-only', 'knownOnly'],
    ['--env-secrets', 'envSecrets'],
    ['--gh-config', 'ghConfig'],
    ['--paranoid', 'paranoid'],
    ['--gitleaks', 'gitleaks'],
    ['--betterleaks', 'betterleaks'],
    ['--trufflehog', 'trufflehog'],
    ['--stream', 'stream'],
    ['--redact-oversized-records', 'redactOversizedRecords'],
    ['--allow-binary', 'allowBinary'],
    ['--two-pass', 'twoPass'],
    ['--json', 'json'],
    ['--jsonl', 'jsonl'],
    ['--identity-mask', 'identityMask'],
    ['--hive-mask', 'hiveMask'],
    ['--preserve-encoding', 'preserveEncoding'],
    ['--gh-auth', 'ghAuth'],
    ['--verify-public', 'verifyPublic'],
    ['--apply', 'apply'],
    ['--placeholder', 'placeholder'],
    ['--no-map', 'noMap'],
    ['--map-credentials', 'mapCredentials'],
    ['--staged', 'staged'],
    ['--respect-gitignore', 'respectGitignore'],
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
    ['--worker-timeout-ms', 'workerTimeoutMs'],
    ['--filter-repo', 'filterRepo'],
    ['--profile', 'profile'],
    ['--proper-names', 'properNames'],
    ['--scripts', 'scripts'],
    ['--map', 'map'],
    ['--map-format', 'mapFormat'],
    ['--placeholder-format', 'placeholderFormat'],
    ['--format', 'format'],
    ['--report-path', 'reportPath'],
    ['--baseline', 'baseline'],
    ['--write-baseline', 'writeBaseline'],
    ['--max-archive-depth', 'archiveDepth'],
    ['--from', 'from'],
    ['--to', 'to'],
    ['--since', 'since'],
    ['--until', 'until'],
  ]);
  const paths = [];
  for (let i = rewrite ? 2 : 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      paths.push(...argv.slice(i + 1));
      break;
    } else if (boolean.has(arg)) {
      config[boolean.get(arg)] = true;
    } else if (valued.has(arg)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) {
        throw failure('ERR_ARGUMENT');
      }
      config[valued.get(arg)] = argv[++i];
    } else if (!arg.startsWith('--')) {
      paths.push(arg);
    } else {
      throw failure('ERR_ARGUMENT');
    }
  }
  config.path = paths[0] ?? '-';
  config.paths = paths;
  validateArgs(config);
  return config;
}

function validateArgs(config) {
  config.maxBytes = Number(config.maxBytes ?? defaultByteLimit(config));
  if (
    !['redact', 'scan', 'restore', 'history'].includes(config.command) ||
    !Number.isSafeInteger(config.maxBytes) ||
    config.maxBytes <= 0
  ) {
    throw failure('ERR_ARGUMENT');
  }
  if (
    (config.output && config.inPlace) ||
    ((config.output || config.inPlace) &&
      !['redact', 'restore'].includes(config.command) &&
      !config.rewrite) ||
    (config.inPlace && config.path === '-') ||
    (config.command === 'history' && config.path === '-')
  ) {
    throw failure('ERR_ARGUMENT');
  }
  validateFeatureArgs(config);
  validatePaths(config);
  validateScanArgs(config);
  validateHistoryArgs(config);
  validateReportArgs(config);
  validateOutput(config);
  validateBridge(config);
}

function validateHistoryArgs(config) {
  if (
    (config.command !== 'history' || config.rewrite) &&
    [config.from, config.to, config.since, config.until].some(
      (bound) => bound !== undefined
    )
  ) {
    throw failure('ERR_ARGUMENT');
  }
}

function validatePaths(config) {
  // Only scan accepts several paths, including staged files from a hook.
  if (
    config.paths.length > 1 &&
    (config.command !== 'scan' ||
      (!config.staged &&
        !config.respectGitignore &&
        config.paths.includes('-')))
  ) {
    throw failure('ERR_ARGUMENT');
  }
}

function validateFeatureArgs(config) {
  config.maxRecordBytes = Number(
    config.maxRecordBytes ??
      (config.redactOversizedRecords
        ? 262144
        : config.jsonl
          ? 8388608
          : config.maxBytes)
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
  validateStreamArgs(config);
  if ((config.twoPass || config.redactOversizedRecords) && !config.stream) {
    throw failure('ERR_ARGUMENT');
  }
  if ((config.json && config.jsonl) || (config.stream && config.json)) {
    throw failure('ERR_ARGUMENT');
  }
}

function validateScanArgs(config) {
  const scan = config.command === 'scan';
  if (
    (!scan &&
      (config.staged ||
        config.respectGitignore ||
        config.baseline ||
        config.writeBaseline ||
        config.archiveDepth !== undefined)) ||
    (config.staged && config.respectGitignore)
  ) {
    throw failure('ERR_ARGUMENT');
  }
  config.archiveDepth = Number(config.archiveDepth ?? 0);
  if (
    !Number.isInteger(config.archiveDepth) ||
    config.archiveDepth < 0 ||
    config.archiveDepth > 5
  ) {
    throw failure('ERR_ARGUMENT');
  }
}

function validateReportArgs(config) {
  const formats =
    config.command === 'scan'
      ? ['lino', 'json', 'sarif', 'csv', 'junit']
      : ['lino', 'json'];
  if (config.format !== undefined || config.reportPath) {
    if (
      !['scan', 'history'].includes(config.command) ||
      (config.format !== undefined && !formats.includes(config.format))
    ) {
      throw failure('ERR_ARGUMENT');
    }
  }
  const inputs = [
    ...config.paths,
    config.config,
    config.baseline,
    config.output,
  ]
    .filter(Boolean)
    .map((path) => resolve(path));
  for (const target of [config.reportPath, config.writeBaseline].filter(
    Boolean
  )) {
    const path = resolve(target);
    if (inputs.includes(path)) {
      throw failure('ERR_OUTPUT');
    }
    inputs.push(path);
  }
}

function validateStreamArgs(config) {
  if (config.workerTimeoutMs !== undefined) {
    config.workerTimeoutMs = Number(config.workerTimeoutMs);
    if (
      !config.stream ||
      !Number.isSafeInteger(config.workerTimeoutMs) ||
      config.workerTimeoutMs <= 0 ||
      config.workerTimeoutMs > 2147483647
    ) {
      throw failure('ERR_ARGUMENT');
    }
  }
  if (
    config.allowBinary &&
    (config.json || config.jsonl || config.command === 'history')
  ) {
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

export async function runCli(
  argv,
  {
    stdin = process.stdin,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {}
) {
  let t = cliLocale('en');
  try {
    argv = [...argv];
    const env = resolveCliEnvironment();
    t = cliLocale(cliLocaleArgument(argv, env.locale));
    if (!argv.length || ['--help', '-h'].includes(argv[0])) {
      stdout.write(`${t('help')}\n`);
      return 0;
    }
    if (['--version', '-v'].includes(argv[0])) {
      stdout.write(`${packageVersion()}\n`);
      return 0;
    }
    const config = parseArgs(argv, env.config);
    const context = { stdin, stdout };
    return await dispatchCommand(config, context);
  } catch (error) {
    const location =
      Number.isSafeInteger(error.record) && Number.isSafeInteger(error.offset)
        ? t('location', { record: error.record, offset: error.offset })
        : '';
    const code = /^ERR_[A-Z_]+$/.test(error.code)
      ? error.code
      : 'ERR_SANITIZATION';
    stderr.write(`${t('failure', { code, location })}\n`);
    return 2;
  }
}

async function dispatchCommand(config, context) {
  if (config.command === 'restore') {
    return await restoreCommand(config, context);
  }
  const options = await loadOptions(config);
  const engine = createSanitizer(options);
  if (config.command === 'history') {
    return await historyCommand(config, engine, context);
  }
  if (config.stream) {
    return await streamCommand(config, engine, options, {
      ...context,
      beforePublish: () => saveMap(config),
    });
  }
  if (config.command === 'redact') {
    return await redactCommand(config, engine, context);
  }
  return await scanCommand(config, engine, context, packageVersion());
}

async function loadOptions(config) {
  let options = {};
  if (config.config) {
    try {
      const maxBytes = 1024 * 1024;
      const text = await readTextFile(config.config, maxBytes);
      options = text.trimStart().startsWith('{')
        ? JSON.parse(text)
        : decodeLinoObject(text, maxBytes);
    } catch {
      throw failure('ERR_CONFIG');
    }
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw failure('ERR_CONFIG');
  }
  options.profile =
    config.profile ??
    options.profile ??
    (config.command === 'redact' ? 'publication' : undefined);
  if (config.nativeOnly) {
    options.secretlint = false;
  }
  if (config.paranoid) {
    options.paranoid = true;
  }
  await featureOptions(config, options);
  await placeholderOptions(config, options);
  options.detectors = selectedDetectors(config, options.detectors);
  options.maxInputLength = Math.min(
    options.maxInputLength ?? config.maxBytes,
    config.maxBytes
  );
  config.lossless = !options.structured;
  if (config.allowBinary && !config.lossless) {
    throw failure('ERR_CONFIG');
  }
  return options;
}

async function featureOptions(config, options) {
  await localCredentials(config, options);
  options.properNames = config.properNames ?? options.properNames;
  if (config.scripts !== undefined) {
    options.scripts = config.scripts.split(',');
  }
  if (config.knownOnly) {
    options.knownOnly = true;
  }
  if (config.credentialsOnly) {
    options.credentialsOnly = true;
  }
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
  if (config.verifyPublic) {
    options.verifyPublic = createWikidataVerifier();
  }
}

async function localCredentials(config, options) {
  for (const [flag, load] of [
    ['envSecrets', knownSecretsFromEnv],
    ['ghConfig', knownSecretsFromGitHubConfig],
    ['ghAuth', knownSecretsFromGitHubAuth],
  ]) {
    if (config[flag]) {
      options.knownSecrets = [
        ...(options.knownSecrets ?? []),
        ...(await load()),
      ];
    }
  }
}

function selectedDetectors(config, detectors = []) {
  const selected = [...detectors];
  for (const [flag, factory] of [
    ['gitleaks', createGitleaksDetector],
    ['betterleaks', createBetterleaksDetector],
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

async function inputText(path, config, stdin) {
  const options = {
    lossless: config.lossless,
    allowBinary: Boolean(config.allowBinary),
  };
  return path === '-'
    ? decodeTextInput(await readStdinBytes(stdin, config.maxBytes), options)
    : readTextInput(path, config.maxBytes, options);
}

async function redactCommand(config, engine, { stdin, stdout }) {
  const input = await inputText(config.path, config, stdin);
  const result = await engine.sanitize(input.text);
  await saveMap(config);
  const output = encodeTextOutput(result.text, input.encoding);
  if (config.output || config.inPlace) {
    await atomicWrite(config.output ?? config.path, output, {
      replace: Boolean(config.inPlace),
    });
  } else {
    stdout.write(output);
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
      manifestFormat: config.format,
    });
    await publishReport(result, config, stdout, packageVersion());
    return 0;
  }
  const result = await auditGitHistory(config.path, {
    sanitizer: engine,
    maxBytes: config.maxBytes,
    from: config.from,
    to: config.to,
    since: config.since,
    until: config.until,
  });
  await publishReport(result, config, stdout, packageVersion());
  return !result.complete ? 2 : result.findings.length ? 1 : 0;
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  process.exitCode = await runCli(process.argv.slice(2));
}

function packageVersion() {
  return JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  ).version;
}

function defaultByteLimit(config) {
  return config.stream ? 1073741824 : 33554432;
}
