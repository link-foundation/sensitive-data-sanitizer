// Competitor feature parity probes built from documentation examples.
import {
  sanitize,
  inspect,
  createPatternDetector,
  createSanitizer,
  luhn,
} from '../../src/index.js';

// Google hotword example: C_MRN POSSIBLE, raised by "mrn|medical" within 10 chars.
const mrn = createPatternDetector({
  type: 'MEDICAL_RECORD',
  patterns: [/[0-9]{3}-[0-9]{1}-[0-9]{5}/],
  confidence: 0.4,
  context: ['mrn', 'medical'],
  contextWindow: { before: 10 },
});
const text = "Patient's MRN 444-5-22222 and just a number 333-2-33333";
console.log(
  inspect(text, { detectors: [mrn] }).filter((f) => f.rule === 'custom-pattern')
);
console.log(sanitize(text, { detectors: [mrn] }).text);
// Presidio deny list example: titles.
const titles = createPatternDetector({
  type: 'TITLE',
  denyList: ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Prof.'],
});
console.log(
  sanitize(
    'I suspect Professor Plum, in the Dining Room, with the candlestick',
    { detectors: [titles] }
  ).text
);
console.log(sanitize('Dr. and Mrs. Smith', { detectors: [titles] }).text);
// Validation callback: Luhn-checked employee number.
const employee = createPatternDetector({
  type: 'EMPLOYEE_ID',
  patterns: [{ regex: /\bE\d{16}\b/, confidence: 0.3 }],
  validate: (v) => (luhn(v.slice(1)) ? 0.9 : false),
});
console.log(
  sanitize('ids E4111111111111111 E4111111111111112', { detectors: [employee] })
    .text
);
const async = await createSanitizer({
  secretlint: false,
  detectors: [mrn],
}).sanitize(text);
console.log(async.text);
