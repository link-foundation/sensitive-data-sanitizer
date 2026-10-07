import { parentPort, workerData } from 'node:worker_threads';
import { sanitizeFileToFile } from './stream.js';
try {
  parentPort.postMessage({
    value: await sanitizeFileToFile(
      workerData.source,
      workerData.target,
      workerData.options
    ),
  });
} catch (error) {
  parentPort.postMessage({
    error: /^ERR_[A-Z_]+$/.test(error.code) ? error.code : 'ERR_WORKER',
  });
}
