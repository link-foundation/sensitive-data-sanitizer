Current-version reproduction while updating a downstream Electron application: `temp@0.9.4` is still pulled by `electron-winstaller@5.4.4` on Node 26.13.0 / npm 12.2.2. Its callback-shaped rimraf integration prevents simply selecting the latest rimraf major.

Minimal consumer exercise:
```js
const temp = require('temp').track();
const dir = temp.mkdirSync('temp-cleanup-repro-');
require('node:fs').writeFileSync(require('node:path').join(dir, 'child'), 'x');
temp.cleanupSync();
if (require('node:fs').existsSync(dir)) throw Error('directory was not removed');
```

We retain a small local rimraf adapter using `fs.rm(path, {recursive: true, force: true}, callback)` and `fs.rmSync` to keep temp's callback and `.sync` contract without the deprecated glob/inflight/rimraf chain. Both the direct cleanup exercise and real desktop packaging run in our CI: https://github.com/link-foundation/sensitive-data-sanitizer/pull/103 .

The native-fs proposal already discussed in #102 would let us delete that adapter once released. In particular, passing the original callback to `fs.rm` preserves cleanup error reporting; the synchronous entry point needs the same recursive/force options. This is additional current-consumer evidence for the existing proposal, rather than a request to force a breaking rimraf API through the old integration.
