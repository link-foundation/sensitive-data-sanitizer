import { parentPort, workerData } from 'node:worker_threads';
import { createSanitizer, prepareStreamEngine } from './engines.js';

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
      });
    }
  }
);
