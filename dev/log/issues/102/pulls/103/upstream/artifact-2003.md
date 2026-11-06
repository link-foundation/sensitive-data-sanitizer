Verified this remains reproducible with `@actions/artifact@6.3.1`, its `unzip-stream@0.3.4` reader, and Node 26.13.0:
```sh
npm install --ignore-scripts @actions/artifact@6.3.1
node --pending-deprecation --throw-deprecation -e "require('unzip-stream').Parse()"
```
The constructor fails immediately with `DEP0005: Buffer() is deprecated`, at `unzip-stream/lib/unzip-stream.js:47:17`, before any archive is supplied. The 6.3.1 SDK still declares this reader.

Our workaround keeps the official SDK for authentication, transfer and digest verification (`skipDecompress: true`, preserving `expectedHash`), then uses `@zip.js/zip.js@2.24.0` for extraction. The adapter also checks entry paths and CRCs and exercises a real SDK upload/download ZIP round trip under `--pending-deprecation --throw-deprecation`: https://github.com/link-foundation/sensitive-data-sanitizer/pull/103 .

Replacing the SDK's reader with a maintained ZIP64/streaming implementation, or exposing an extraction strategy while keeping the transfer/hash layer, would remove this downstream duplication. A constructor-only `Buffer.from` patch removes this one warning but should not substitute for reviewing the old reader's other compatibility/security properties. This adds current-version evidence to this existing report.
