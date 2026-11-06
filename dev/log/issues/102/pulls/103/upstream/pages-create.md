While updating dependencies in https://github.com/link-foundation/sensitive-data-sanitizer/pull/103, I reviewed `actions/deploy-pages@v5.0.1`. Its new backoff/jitter handles polling, but `src/internal/api-client.js:createPagesDeployment()` still makes one `POST /repos/{owner}/{repo}/pages/deployments` call with the ordinary GitHub client. A transient create failure exits deployment immediately. I searched existing retry/create/5xx reports; #418 concerns a deployment that was already created and #451 concerns artifact lookup, so this request concerns an earlier stage.

Minimal deterministic reproduction, without writing a live deployment:

1. Mock the POST to return HTTP 500 once, then a valid deployment response.
2. Invoke `createPagesDeployment()`: the first response rejects; the second is never requested.
3. For the lost-response case, let the first POST create the deployment but reject locally with `ECONNRESET`; a GET by `pages_build_version` returns that deployment. A safe retry must adopt it rather than create another.

Suggested implementation: a bounded create loop for HTTP 429/5xx and transient network failures; before each retry GET the deployment for the same commit, adopt a non-failed existing deployment, and only POST again when absent. Preserve immediate permanent-4xx errors, request IDs, the original OIDC payload, cancellation, and deployment status semantics. The polling improvements in v5.0.1 should remain intact.

Our retained workaround implements this using the documented REST/OIDC protocol in `scripts/deploy-pages.mjs`. `tests/deploy-pages.test.js` provides fully mocked reproductions for 500, 429, network errors, lost-response adoption, permanent failures, bounded polling, and cancellation; no service outage or live deployment is needed to run them. We would like to remove the local create/reconcile implementation once the official action supplies this behavior. An optional `artifact_id` input (as proposed in #399) would also remove our need to bypass name-based artifact lookup.
