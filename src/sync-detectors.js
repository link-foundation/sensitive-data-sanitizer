import { failure } from './detection.js';

export function validateDetectors(detectors = []) {
  if (
    !Array.isArray(detectors) ||
    detectors.some((d) => !d || typeof d.detect !== 'function')
  ) {
    throw failure('ERR_CONFIG');
  }
}

export function detectSync(text, options, emit) {
  if (options.knownOnly) {
    return;
  }
  for (const detector of options.detectors ?? []) {
    let findings;
    try {
      findings = detector.detect(text);
    } catch {
      throw failure('ERR_ENGINE');
    }
    if (findings && typeof findings.then === 'function') {
      // Observe rejections without allowing async work to publish output.
      Promise.resolve(findings).catch(() => {});
      throw failure('ERR_CONFIG');
    }
    if (!Array.isArray(findings)) {
      throw failure('ERR_ENGINE');
    }
    if (findings.length > (options.maxFindings ?? 100000)) {
      throw failure('ERR_LIMIT');
    }
    for (const finding of findings) {
      emit(finding);
    }
  }
}
