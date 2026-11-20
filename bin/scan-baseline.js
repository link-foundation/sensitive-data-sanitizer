import { createHmac } from 'node:crypto';
import { relative, resolve, sep } from 'node:path';
import { atomicWrite, readTextFile } from '../src/files.js';
import { failure } from '../src/detection.js';
import { decodeLinoObject, encodeLinoObject } from '../src/lino-object.js';

const maxBytes = 8 * 1024 * 1024;
const kind = 'sensitive-data-scan-baseline';
const digestPattern = /^[a-f0-9]{64}$/;

async function readBaseline(path) {
  try {
    const text = await readTextFile(path, maxBytes);
    const data = text.trimStart().startsWith('{')
      ? JSON.parse(text)
      : decodeLinoObject(text, maxBytes);
    if (
      data?.kind !== kind ||
      data.version !== 1 ||
      !Array.isArray(data.fingerprints) ||
      data.fingerprints.some(
        (digest) => typeof digest !== 'string' || !digestPattern.test(digest)
      )
    ) {
      throw failure('ERR_BASELINE');
    }
    return data.fingerprints;
  } catch {
    throw failure('ERR_BASELINE');
  }
}

export async function openScanBaseline({ baseline, writeBaseline }) {
  if (!baseline && !writeBaseline) {
    return undefined;
  }
  const key = process.env.SDS_BASELINE_KEY;
  if (typeof key !== 'string' || !digestPattern.test(key)) {
    throw failure('ERR_BASELINE_KEY');
  }
  const secret = Buffer.from(key, 'hex');
  const fingerprints = [];
  const remaining = new Map();
  if (baseline) {
    for (const digest of await readBaseline(baseline)) {
      remaining.set(digest, (remaining.get(digest) ?? 0) + 1);
    }
  }
  return {
    filter(path, text, findings, stdin) {
      const [file, ...members] = path;
      const location = stdin
        ? ['stdin', ...members]
        : [
            'file',
            relative(process.cwd(), resolve(file)).split(sep).join('/'),
            ...members,
          ];
      return findings.filter((finding) => {
        const digest = createHmac('sha256', secret)
          .update(
            JSON.stringify([
              location,
              finding.rule,
              finding.type,
              finding.category,
            ])
          )
          .update('\0')
          .update(text.slice(finding.start, finding.end), 'utf16le')
          .digest('hex');
        if (writeBaseline) {
          fingerprints.push(digest);
        }
        const count = remaining.get(digest) ?? 0;
        if (count > 0) {
          remaining.set(digest, count - 1);
        }
        return count === 0;
      });
    },
    async save() {
      if (writeBaseline) {
        const data = { kind, version: 1, fingerprints: fingerprints.sort() };
        const text = /\.json$/i.test(writeBaseline)
          ? `${JSON.stringify(data, null, 2)}\n`
          : encodeLinoObject(data);
        if (Buffer.byteLength(text) > maxBytes) {
          throw failure('ERR_LIMIT');
        }
        await atomicWrite(writeBaseline, text);
      }
    },
  };
}
