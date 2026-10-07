import {
  createSanitizer,
  createGitleaksDetector,
  createTrufflehogDetector,
  createPresidioDetector,
} from '../src/index.js';
import { fileURLToPath, URL } from 'node:url';

// Install these optional local scanners before running this example.
// All selected detectors are required: an unavailable scanner blocks output.
const sanitizer = createSanitizer({
  detectors: [
    createGitleaksDetector(),
    createTrufflehogDetector(),
    createPresidioDetector({
      args: [fileURLToPath(new URL('./presidio-bridge.py', import.meta.url))],
    }),
  ],
});
const result = await sanitizer.sanitize(
  'name: Jane Doe; password=short; jane@example.org'
);
console.log(result.text);
