import type { Detector } from './index.js';
export declare function createNerDetector(options?: {
  languages?: Array<'ru' | 'en'>;
  debug?: (event: { event: 'offline-ner'; count: number }) => void;
}): Promise<
  Detector & { detect(text: string): import('./index.js').Finding[] }
>;
