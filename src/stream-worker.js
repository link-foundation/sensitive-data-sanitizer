import { parentPort, workerData } from 'node:worker_threads';
import { sanitizeFileToFile } from './stream.js';
import { compileKnown } from './compiled-known.js';
try {
  const options = workerData.options.sanitizerOptions ?? workerData.options;
  if (options.knownPersonal) {
    options.knownPersonal = compileKnown(options.knownPersonal);
  }
  parentPort.postMessage({
    value: await sanitizeFileToFile(
      workerData.source,
      workerData.target,
      workerData.options,
      () => parentPort.postMessage({ progress: true })
    ),
  });
} catch (error) {
  parentPort.postMessage({
    error: /^ERR_[A-Z_]+$/.test(error.code) ? error.code : 'ERR_WORKER',
    record: error.record,
    offset: error.offset,
    recordOffset: error.recordOffset,
  });
}
