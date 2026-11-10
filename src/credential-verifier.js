import { Buffer } from 'node:buffer';
import { failure } from './detection.js';

// Fixed provider origins: candidates and source text cannot choose an endpoint.
// Every operation only reads identity, scopes, model listings or token status.
const providers = {
  github: [
    'https://api.github.com/user',
    'bearer',
    'https://docs.github.com/en/rest/users/users#get-the-authenticated-user',
  ],
  gitlab: [
    'https://gitlab.com/api/v4/personal_access_tokens/self',
    'private-token',
    'https://docs.gitlab.com/api/personal_access_tokens/',
  ],
  npm: [
    'https://registry.npmjs.org/-/whoami',
    'bearer',
    'https://docs.npmjs.com/cli/commands/npm-whoami',
  ],
  huggingface: [
    'https://huggingface.co/api/whoami-v2',
    'bearer',
    'https://huggingface.co/docs/hub/api',
  ],
  stripe: [
    'https://api.stripe.com/v1/balance',
    'bearer',
    'https://docs.stripe.com/api/balance/balance_retrieve',
  ],
  openai: [
    'https://api.openai.com/v1/models',
    'bearer',
    'https://developers.openai.com/api/reference/resources/models/methods/list',
  ],
  anthropic: [
    'https://api.anthropic.com/v1/models',
    'x-api-key',
    'https://docs.anthropic.com/en/api/models-list',
  ],
  sendgrid: [
    'https://api.sendgrid.com/v3/scopes',
    'bearer',
    'https://www.twilio.com/docs/sendgrid/api-reference/api-key-permissions/retrieve-a-list-of-scopes-for-which-this-user-has-access',
  ],
  digitalocean: [
    'https://api.digitalocean.com/v2/account',
    'bearer',
    'https://docs.digitalocean.com/reference/api/api-reference/#operation/account_get',
  ],
  notion: [
    'https://api.notion.com/v1/users/me',
    'bearer',
    'https://developers.notion.com/reference/get-self',
  ],
  discord: [
    'https://discord.com/api/v10/users/@me',
    'bot',
    'https://discord.com/developers/docs/resources/user#get-current-user',
  ],
  cloudflare: [
    'https://api.cloudflare.com/client/v4/user/tokens/verify',
    'bearer',
    'https://developers.cloudflare.com/api/resources/user/subresources/tokens/methods/verify/',
  ],
};
export const credentialProviders = Object.freeze(
  Object.entries(providers).map(([id, [endpoint, , source]]) =>
    Object.freeze({ id, endpoint, method: 'GET', source })
  )
);

function headers(provider, token) {
  const kind = providers[provider][1];
  const result = { Accept: 'application/json' };
  if (kind === 'bearer' || kind === 'bot') {
    result.Authorization = `${kind === 'bot' ? 'Bot' : 'Bearer'} ${token}`;
  } else {
    result[kind] = token;
  }
  if (provider === 'anthropic') {
    result['anthropic-version'] = ['2023', '06', '01'].join('-');
  }
  if (provider === 'notion') {
    result['Notion-Version'] = ['2022', '06', '28'].join('-');
  }
  return result;
}

// Consume at most a small response and discard all returned account data.
async function payload(response, maxResponseBytes) {
  if (!response.body) {
    throw failure('ERR_CREDENTIAL_VERIFICATION');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      length += value.length;
      if (length > maxResponseBytes) {
        throw failure('ERR_CREDENTIAL_VERIFICATION');
      }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw failure('ERR_CREDENTIAL_VERIFICATION');
    }
    return body;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
function authenticated(provider, body) {
  const checks = {
    github: () => Number.isInteger(body.id),
    gitlab: () =>
      Number.isInteger(body.id) &&
      body.active === true &&
      body.revoked === false,
    npm: () => typeof body.username === 'string' && body.username.length > 0,
    huggingface: () => typeof body.name === 'string' && body.name.length > 0,
    stripe: () => body.object === 'balance',
    openai: () => body.object === 'list' && Array.isArray(body.data),
    anthropic: () =>
      Array.isArray(body.data) && typeof body.has_more === 'boolean',
    sendgrid: () => Array.isArray(body.scopes),
    digitalocean: () => typeof body.account?.uuid === 'string',
    notion: () => body.object === 'user' && typeof body.id === 'string',
    discord: () =>
      typeof body.id === 'string' && typeof body.username === 'string',
    cloudflare: () => body.success === true && body.result?.status === 'active',
  };
  return checks[provider]();
}

/** Opt-in, read-only provider checks; never part of detection or publication. */
export function createCredentialVerifier({
  enabled = false,
  fetch: request = globalThis.fetch,
  timeoutMs = 5000,
  maxChecks = 100,
  maxResponseBytes = 64 * 1024,
} = {}) {
  if (
    typeof enabled !== 'boolean' ||
    typeof request !== 'function' ||
    ![timeoutMs, maxChecks, maxResponseBytes].every(
      (n) => Number.isSafeInteger(n) && n > 0
    )
  ) {
    throw failure('ERR_CONFIG');
  }
  let checks = 0;
  return async (candidate) => {
    validateCandidate(candidate?.provider, candidate?.token);
    const { provider, token } = candidate;
    const result = (status, reason) => ({
      provider,
      status,
      ...(reason ? { reason } : {}),
    });
    if (!enabled) {
      return result('disabled');
    }
    if (!Object.hasOwn(providers, provider)) {
      return result('unsupported');
    }
    if (checks++ >= maxChecks) {
      return result('unknown', 'budget');
    }
    try {
      const response = await request(providers[provider][0], {
        method: 'GET',
        headers: headers(provider, token),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 401) {
        await response.body?.cancel();
        return result('invalid');
      }
      if (response.status !== 200) {
        await response.body?.cancel();
        return result('unknown', 'http');
      }
      return authenticated(provider, await payload(response, maxResponseBytes))
        ? result('valid')
        : result('unknown', 'response');
    } catch {
      // Provider bodies and exception messages can echo credentials.
      return result('unknown', 'request');
    }
  };
}

function validateCandidate(provider, token) {
  if (
    typeof provider !== 'string' ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(provider) ||
    typeof token !== 'string' ||
    !token.length ||
    token.length > 16384 ||
    /[\s\p{Cc}]/u.test(token)
  ) {
    throw failure('ERR_CONFIG');
  }
}
