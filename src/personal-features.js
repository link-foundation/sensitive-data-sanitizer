// Registers the personal-data detectors and fake generators. The main entry
// imports this module for its side effect; the `./credentials` entry does not,
// which keeps faker, libphonenumber and these detectors out of its start-up.
import { registerFeatures } from './features.js';
import { detectPersonal } from './personal.js';
import { detectCatalog } from './entities.js';
import { detectIdentity, fakeIdentityValue } from './identity.js';
import { detectNational } from './national.js';
import { detectPersonalContext } from './personal-context.js';
import { detectPersonalEvidence } from './personal-evidence.js';
import { detectDocumentEntities } from './document-entities.js';
import {
  detectProseAndDocuments,
  validateProperNames,
} from './proper-names.js';
import { detectStrict } from './strict.js';
import { realisticFake } from './fake.js';
import { prepareFakeText } from './fake-entities.js';
import { fakeDocumentSpans } from './specimens.js';
import { recognizedPlaceholderSpans } from './placeholders.js';

function placeholderContains(spans, start) {
  let low = 0,
    high = spans.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (spans[mid].end <= start) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return spans[low]?.start <= start;
}

function detectPersonalData(text, emit, options) {
  let placeholders;
  const emitPersonal = (finding) => {
    // Native age rules start at the quantity. A placeholder's sequence
    // number cannot supply that evidence, even when a year noun follows it.
    if (finding.type === 'AGE') {
      placeholders ??= recognizedPlaceholderSpans(text, options);
      if (placeholderContains(placeholders, finding.start)) {
        return;
      }
    }
    emit(finding);
  };
  detectPersonal(text, emit);
  detectProseAndDocuments(text, emitPersonal, options, detectDocumentEntities);
  detectCatalog(text, emit);
  detectIdentity(text, emit);
  detectNational(text, emit);
  detectPersonalContext(text, emit);
  detectPersonalEvidence(text, emit);
  detectStrict(text, emitPersonal, options);
}

registerFeatures({
  detectPersonalData,
  validateProperNames,
  realisticFake,
  prepareFakeText,
  fakeDocumentSpans,
  fakeIdentityValue,
});
