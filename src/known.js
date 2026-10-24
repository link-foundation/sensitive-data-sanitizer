import { failure } from './detection.js';
import { readTextFile } from './files.js';

/** Explicitly load every host/account token from gh's local YAML config. */
export async function knownSecretsFromGitHubConfig({ path } = {}) {
  if (path !== undefined && (typeof path !== 'string' || !path)) {
    throw failure('ERR_CONFIG');
  }
  const { lstat } = await import('node:fs/promises');
  path ??= await gitHubConfigPath();
  try {
    await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw failure('ERR_AUTH');
  }
  try {
    const { parseDocument } = await import('yaml');
    const document = parseDocument(await readTextFile(path, 1024 * 1024), {
      logLevel: 'silent',
      prettyErrors: false,
    });
    if (document.errors.length) {
      throw failure('ERR_AUTH');
    }
    return configTokens(document.toJS({ maxAliasCount: 0 }));
  } catch {
    throw failure('ERR_AUTH');
  }
}

async function gitHubConfigPath() {
  const { join } = await import('node:path');
  const { homedir } = await import('node:os');
  const directory =
    process.env.GH_CONFIG_DIR ||
    (process.env.XDG_CONFIG_HOME
      ? join(process.env.XDG_CONFIG_HOME, 'gh')
      : process.platform === 'win32' && process.env.AppData
        ? join(process.env.AppData, 'GitHub CLI')
        : join(homedir(), '.config', 'gh'));
  return join(directory, 'hosts.yml');
}

function configTokens(config) {
  const values = new Set(),
    pending = [config];
  let count = 0;
  while (pending.length) {
    const entry = pending.pop();
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    if (++count > 10000) {
      throw failure('ERR_LIMIT');
    }
    for (const [key, value] of Object.entries(entry)) {
      if (
        ['oauth_token', 'api_token'].includes(key) &&
        typeof value === 'string' &&
        value.trim()
      ) {
        values.add(value);
      } else if (value && typeof value === 'object') {
        pending.push(value);
      }
    }
  }
  return [...values];
}

const secretEnvName =
  /(?:^|_)(?:TOKEN|(?:API|ACCESS|PRIVATE)?KEY|SECRET|PASSWORD|PASSWD|CREDENTIALS?|AUTH|PAT)(?:_|$)/i;
// Configuration suffixes describe how authentication works. Explicit names
// bypass this filter; credential suffixes such as AUTH_MODE_TOKEN still win.
const authConfigurationName =
  /(?:^|_)AUTH_(?:TRANSPORT|MODE|METHOD|TYPE|URL|URI|HOST|HOSTNAME|PATH|ENABLED|DISABLED|PORT|PROTOCOL|SCHEME)$/i;
/** Opt-in literal values from credential-named keys, or an explicit selection. */
export function knownSecretsFromEnv(env = process.env, names) {
  if (names === undefined) {
    names =
      env && typeof env === 'object'
        ? Object.keys(env).filter(
            (name) =>
              secretEnvName.test(name) && !authConfigurationName.test(name)
          )
        : [];
  }
  if (
    !env ||
    typeof env !== 'object' ||
    !Array.isArray(names) ||
    names.some((name) => typeof name !== 'string')
  ) {
    throw failure('ERR_CONFIG');
  }
  return [
    ...new Set(
      names
        .map((name) => env[name])
        .filter((value) => typeof value === 'string' && value.length)
    ),
  ];
}

/** Date and numeric spellings from documents-processing, with no inferred transliteration. */
export function personalVariants(entries) {
  if (!Array.isArray(entries)) {
    throw failure('ERR_CONFIG');
  }
  return entries.flatMap((entry) => {
    if (
      !entry ||
      typeof entry.value !== 'string' ||
      !entry.value ||
      !/^[A-Z][A-Z0-9_]{0,63}$/.test(entry.type)
    ) {
      throw failure('ERR_CONFIG');
    }
    const values = new Set([entry.value]);
    const numeric = entry.value.replace(/\D/g, '');
    if (numeric.length >= 6 && /^[+\d ()/.-]+$/.test(entry.value)) {
      values.add(numeric);
    }
    const iso = entry.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      for (const separator of ['/', '.', '-']) {
        values.add(`${iso[3]}${separator}${iso[2]}${separator}${iso[1]}`);
      }
    }
    const local = entry.value.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (local) {
      values.add(`${local[3]}-${local[2]}-${local[1]}`);
    }
    return [...values].map((value) => ({ type: entry.type, value }));
  });
}

/** Explicitly load the current local gh credential without logging the value. */
export async function knownSecretsFromGitHubAuth({
  command = 'gh',
  hostname,
  timeoutMs = 5000,
} = {}) {
  const { execFile } = await import('node:child_process');
  if (
    typeof command !== 'string' ||
    !command ||
    (hostname !== undefined && !/^[a-z0-9.-]+$/i.test(hostname)) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0
  ) {
    throw failure('ERR_CONFIG');
  }
  return new Promise((accept, reject) => {
    execFile(
      command,
      ['auth', 'token', ...(hostname ? ['--hostname', hostname] : [])],
      { timeout: timeoutMs, maxBuffer: 65536, encoding: 'utf8' },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          reject(failure('ERR_AUTH'));
          return;
        }
        accept([stdout.trim()]);
      }
    );
  });
}
