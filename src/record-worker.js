import { parentPort, workerData } from 'node:worker_threads';
import { createSanitizer } from './engines.js';

const sanitizer = createSanitizer(workerData);
parentPort.on('message', async (text) => {
  try {
    parentPort.postMessage({ value: (await sanitizer.sanitize(text)).text });
  } catch (error) {
    parentPort.postMessage({
      error: /^ERR_[A-Z_]+$/.test(error.code) ? error.code : 'ERR_WORKER',
    });
  }
});
