import { mkdtemp, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { sanitizeFileBounded, sanitizeStreamToFile } from '../src/stream.js';

export async function streamCommand(
  config,
  engine,
  options,
  { stdin, stdout }
) {
  let spool;
  try {
    const destination =
      config.output ?? (config.inPlace ? config.path : undefined);
    if (!destination) {
      spool = await mkdtemp(join(tmpdir(), 'sanitizer-cli-'));
    }
    const target = destination ?? join(spool, 'output');
    const limits = {
      maxRecordBytes: config.maxRecordBytes,
      maxTotalBytes: config.maxBytes,
      replace: Boolean(config.inPlace),
    };
    if (config.path === '-') {
      await sanitizeStreamToFile(stdin, target, {
        ...limits,
        sanitizer: engine,
        sanitizerOptions: options,
      });
    } else {
      const serializable = !options.detectors?.length && !options.verifyPublic;
      await sanitizeFileBounded(config.path, target, {
        ...limits,
        ...(serializable
          ? { sanitizerOptions: options }
          : { sanitizer: engine, sanitizerOptions: options }),
      });
    }
    if (spool) {
      for await (const chunk of createReadStream(target, {
        encoding: 'utf8',
      })) {
        if (stdout.write(chunk) === false) {
          await once(stdout, 'drain');
        }
      }
    }
    return 0;
  } finally {
    if (spool) {
      await rm(spool, { recursive: true, force: true });
    }
  }
}
