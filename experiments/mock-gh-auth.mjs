#!/usr/bin/env node
/** Synthetic local-auth command for exact-value integration tests. */
if (process.argv[2] === 'auth' && process.argv[3] === 'token') {
  process.stdout.write('synthetic-local-auth-fixture\n');
} else {
  process.exitCode = 1;
}
