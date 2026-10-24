import { failure } from './detection.js';

export function workerResult(worker, timeoutMs) {
  return new Promise((accept, reject) => {
    let timer,
      finished = false;
    const fail = () => {
      finished = true;
      clearTimeout(timer);
      reject(failure('ERR_WORKER'));
    };
    const renew = () => {
      clearTimeout(timer);
      timer = setTimeout(fail, timeoutMs);
    };
    renew();
    worker.on('message', (result) => {
      if (finished) {
        return;
      }
      if (result.progress) {
        renew();
        return;
      }
      finished = true;
      clearTimeout(timer);
      result.error
        ? reject(failure(result.error, result))
        : accept(result.value);
    });
    worker.once('error', fail);
    worker.once('exit', fail);
  });
}
