import { failure } from './detection.js';

/** Opt-in literal values from explicitly selected credential environment keys. */
export function knownSecretsFromEnv(
  env = process.env,
  names = [
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'GITHUB_PAT',
    'OPENAI_API_KEY',
    'CODEX_API_KEY',
    'ANTHROPIC_API_KEY',
    'CLAUDE_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'QWEN_API_KEY',
    'DASHSCOPE_API_KEY',
    'HF_TOKEN',
    'HUGGINGFACE_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'NPM_TOKEN',
    'SLACK_BOT_TOKEN',
  ]
) {
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
