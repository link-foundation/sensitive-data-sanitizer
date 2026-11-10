# Optional credential verification

[Documentation](README.md) · [API](API.md) · [Coverage](COVERAGE.md)

Detection asks whether text looks sensitive. Provider verification asks whether
one explicitly supplied credential authenticates to one service now. A revoked
or restricted credential still belongs in redacted output. Verification never
changes findings, suppresses redaction, rotates keys or revokes credentials.

```js
import { createCredentialVerifier } from '@link-foundation/sensitive-data-sanitizer';

const verify = createCredentialVerifier({ enabled: true, maxChecks: 10 });
const result = await verify({
  provider: 'github',
  token: process.env.CREDENTIAL_TO_CHECK,
});
console.log(result); // provider, status, optional reason; never the credential
```

Enabling this sends the credential to its named provider. It can leave provider
access logs and consume rate limits. The caller chooses candidates privately;
the sanitizer does not automatically extract or transmit matched values. The
factory defaults to `enabled: false`, which performs no network requests.

## Result meanings

| Status        | Meaning                                                                   | Publication decision                                  |
| ------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| `disabled`    | Checking was not enabled                                                  | Keep redacting                                        |
| `unsupported` | No built-in check for this provider ID                                    | Keep redacting                                        |
| `valid`       | HTTP 200 with the expected authenticated response shape                   | Redact and investigate the exposure                   |
| `invalid`     | Provider returned HTTP 401                                                | Keep redacting; this is not proof of a false positive |
| `unknown`     | Other HTTP status, malformed response, failed request or exhausted budget | Keep redacting                                        |

`unknown` can include insufficient scope, expiry, rate limiting, network failure
or a changed API. A successful check proves only access to that endpoint with
that credential; it does not establish all permissions or historical validity.
`reason` is one of `budget`, `http`, `response` or `request`. Account records,
response text, tokens and exception diagnostics are discarded.

## Built-in checks

Every built-in operation uses **GET**, a fixed HTTPS origin and credentials in
headers. The endpoint sources below describe the selected read operations.

| Provider ID    | Endpoint                                          | Authentication | Primary documentation                                                                                                                              |
| -------------- | ------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github`       | `api.github.com/user`                             | Bearer         | [Authenticated user](https://docs.github.com/en/rest/users/users#get-the-authenticated-user)                                                       |
| `gitlab`       | `gitlab.com/api/v4/personal_access_tokens/self`   | PRIVATE-TOKEN  | [Personal access tokens](https://docs.gitlab.com/api/personal_access_tokens/)                                                                      |
| `npm`          | `registry.npmjs.org/-/whoami`                     | Bearer         | [npm whoami](https://docs.npmjs.com/cli/commands/npm-whoami)                                                                                       |
| `huggingface`  | `huggingface.co/api/whoami-v2`                    | Bearer         | [Hub API](https://huggingface.co/docs/hub/api)                                                                                                     |
| `stripe`       | `api.stripe.com/v1/balance`                       | Bearer         | [Retrieve balance](https://docs.stripe.com/api/balance/balance_retrieve)                                                                           |
| `openai`       | `api.openai.com/v1/models`                        | Bearer         | [List models](https://developers.openai.com/api/reference/resources/models/methods/list)                                                           |
| `anthropic`    | `api.anthropic.com/v1/models`                     | x-api-key      | [List models](https://docs.anthropic.com/en/api/models-list)                                                                                       |
| `sendgrid`     | `api.sendgrid.com/v3/scopes`                      | Bearer         | [Retrieve scopes](https://www.twilio.com/docs/sendgrid/api-reference/api-key-permissions/retrieve-a-list-of-scopes-for-which-this-user-has-access) |
| `digitalocean` | `api.digitalocean.com/v2/account`                 | Bearer         | [Account API](https://docs.digitalocean.com/reference/api/api-reference/#operation/account_get)                                                    |
| `notion`       | `api.notion.com/v1/users/me`                      | Bearer         | [Retrieve self](https://developers.notion.com/reference/get-self)                                                                                  |
| `discord`      | `discord.com/api/v10/users/@me`                   | Bot            | [Current user](https://discord.com/developers/docs/resources/user#get-current-user)                                                                |
| `cloudflare`   | `api.cloudflare.com/client/v4/user/tokens/verify` | Bearer         | [Verify token](https://developers.cloudflare.com/api/resources/user/subresources/tokens/methods/verify/)                                           |

`credentialProviders` exports frozen metadata for this table. It is a bounded
catalog, not support for every token format of each service. GitLab deploy/job
tokens, Discord user tokens, Cloudflare account tokens, paired AWS credentials,
Azure identities, self-hosted installations and other services are not covered.
A GitHub installation token may authenticate to different endpoints than a
personal token; a rejection here does not prove that token is unusable elsewhere.

## Limits and testing

Options are `timeoutMs` (default 5000), `maxChecks` (100 per verifier instance),
`maxResponseBytes` (65536), `enabled` (false) and injectable `fetch`. Numeric
limits must be positive safe integers. Candidates require a nonempty token of
at most 16384 characters with no whitespace/control characters and a lowercase
provider ID. Invalid configuration or candidates throw `ERR_CONFIG` without
including their values.

There are no retries, redirects, endpoint overrides, stored credential caches or
background checks. Native fetch's abort signal covers the request and response;
a custom fetch implementation must honor that signal. The response reader
bounds consumed bytes and cancels its stream. Avoid retaining the candidate in
application logs or serializing the source environment.

[Mocked contract tests](../tests/sanitizer-credential-verifier.test.js) exercise
every provider, disabled/unsupported behavior, 401/403/429/5xx, malformed bodies,
size limits, request budgets, deadlines and unchanged redaction. They require no
live credentials. These tests establish request/response handling, not live
provider availability or exhaustive token-type support.
