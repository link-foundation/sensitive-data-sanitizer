import { parentPort, workerData } from 'node:worker_threads';
import { createSanitizer, prepareStreamEngine } from './engines.js';
import { compileKnown } from './compiled-known.js';

// Structured cloning discards the caller's weak compilation metadata.
if (workerData.knownPersonal) {
  workerData.knownPersonal = compileKnown(workerData.knownPersonal);
}

parentPort.on(
  'message',
  async ({ text, confirmedPersonal, nativeFindings }) => {
    try {
      const sanitizer = createSanitizer({ ...workerData, confirmedPersonal });
      await prepareStreamEngine(sanitizer, text, nativeFindings);
      parentPort.postMessage({ value: (await sanitizer.sanitize(text)).text });
    } catch (error) {
      parentPort.postMessage({
        error: /^ERR_[A-Z_]+$/.test(error.code) ? error.code : 'ERR_WORKER',
        record: error.record,
        offset: error.offset,
        recordOffset: error.recordOffset,
      });
    }
  }
);
