import type { Finding } from './index.d.ts';
export declare function createNerDetector(options?: {
  languages?: Array<'ru' | 'en'>;
  debug?: (event: { event: 'offline-ner'; count: number }) => void;
}): Promise<{ id: string; detect(text: string): Finding[] }>;
