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

function detectPersonalData(text, emit, options) {
  detectPersonal(text, emit);
  detectProseAndDocuments(text, emit, options, detectDocumentEntities);
  detectCatalog(text, emit);
  detectIdentity(text, emit);
  detectNational(text, emit);
  detectPersonalContext(text, emit);
  detectPersonalEvidence(text, emit);
  detectStrict(text, emit, options);
}

registerFeatures({
  detectPersonalData,
  validateProperNames,
  realisticFake,
  prepareFakeText,
  fakeDocumentSpans,
  fakeIdentityValue,
});
