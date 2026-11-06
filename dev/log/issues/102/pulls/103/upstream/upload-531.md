Current SDK review and a bounded fault-injection reproducer, from https://github.com/link-foundation/sensitive-data-sanitizer/pull/103:

`@actions/artifact@6.3.1` still has two distinct retry layers: Twirp request retries and the caller's complete upload operation. `NetworkError` codes including `ECONNRESET` are thrown immediately by the Twirp retry client. After a lost finalize response, retrying a complete `uploadArtifact(name, files, root)` can also encounter an artifact left by the first attempt. The current public upload API has no caller-supplied idempotency key or reconcile-and-retry option. This is a source/API observation and mocked failure test, not a claim that we reproduced a duplicate in the live hosted service on 6.3.1.

Minimal mocked operation (two attempts, no large file or real upload):

```js
let uploaded = false, calls = 0;
const client = {
  async uploadArtifact() {
    if (++calls === 1) {
      uploaded = true; // server committed, response was lost
      throw Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
    }
    if (uploaded) throw Object.assign(new Error('Conflict'), { status: 409 });
    uploaded = true;
    return { id: 123 };
  },
  async deleteArtifact() { uploaded = false; }
};
```

Calling upload twice alone now conflicts; calling delete between attempts permits recovery. Our automated `tests/artifact-transport.test.js` asserts the exact reconciliation order, bounded exhaustion, immediate permanent-4xx failures, and refusal to hide reconciliation errors. We retain a maximum-three-operation wrapper that reconciles the job-unique artifact name before restarting. It does not claim to repair duplicates already created inside one SDK finalize request.

Suggested upstream feature: reconcile a lost finalize response using a stable upload identity/name plus digest, then return the existing artifact on an exact match, or expose an explicit idempotent replacement operation. The transport should preserve structured status/cause fields and bound network retries too. That would let downstream consumers delete their generic whole-operation wrappers without dropping recovery behavior.
