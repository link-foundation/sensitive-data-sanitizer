import { resolve } from 'node:path';
import { failure } from '../src/detection.js';
import {
  createRestoreMap,
  readRestoreMap,
  writeRestoreMap,
  restore,
} from '../src/restore-map.js';
import { readTextFile, atomicWrite } from '../src/files.js';

export async function placeholderOptions(config, options) {
  if (config.command === 'restore') {
    return;
  }
  if (config.placeholder) {
    options.transformation = { mode: 'placeholder' };
  }
  const transform = options.transformation;
  validatePlaceholderFlags(config, transform);
  if (transform?.mode !== 'placeholder') {
    return;
  }
  validateMapArgs(config);
  if (config.placeholderFormat) {
    transform.format = config.placeholderFormat;
  }
  if (config.mapCredentials) {
    transform.credentials = true;
  }
  if (config.noMap) {
    transform.map = false;
  }
  if (config.map) {
    try {
      const { lstat } = await import('node:fs/promises');
      await lstat(config.map);
      transform.map = await readRestoreMap(config.map);
      config.replaceMap = true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      transform.map = createRestoreMap({ format: transform.format });
    }
  } else if (transform.map !== false) {
    // The CLI cannot return a private map alongside stdout safely.
    throw failure('ERR_ARGUMENT');
  }
  config.restoreMap = transform.map;
}
function validatePlaceholderFlags(config, transform) {
  if (
    (config.map ||
      config.noMap ||
      config.placeholderFormat ||
      config.mapCredentials ||
      config.mapFormat) &&
    transform?.mode !== 'placeholder'
  ) {
    throw failure('ERR_ARGUMENT');
  }
}
function validateMapArgs(config) {
  if (config.map && config.noMap) {
    throw failure('ERR_ARGUMENT');
  }
  if (config.mapFormat && !['json', 'lino'].includes(config.mapFormat)) {
    throw failure('ERR_ARGUMENT');
  }
  if (
    config.map &&
    [config.path, config.output, config.config]
      .filter(Boolean)
      .some((path) => resolve(path) === resolve(config.map))
  ) {
    throw failure('ERR_OUTPUT');
  }
}

export async function saveMap(config) {
  if (config.map) {
    await writeRestoreMap(config.map, config.restoreMap, {
      replace: Boolean(config.replaceMap),
      ...(config.mapFormat ? { format: config.mapFormat } : {}),
    });
  }
}
export async function restoreCommand(config, { stdout }) {
  if (
    !config.map ||
    config.path === '-' ||
    config.stream ||
    config.noMap ||
    config.placeholder ||
    config.mapCredentials ||
    config.json ||
    config.jsonl ||
    config.inPlace
  ) {
    throw failure('ERR_ARGUMENT');
  }
  if (config.output && resolve(config.output) === resolve(config.map)) {
    throw failure('ERR_OUTPUT');
  }
  const text = restore(
    await readTextFile(config.path, config.maxBytes),
    await readRestoreMap(config.map)
  );
  if (config.output) {
    await atomicWrite(config.output, text);
  } else {
    stdout.write(text);
  }
  return 0;
}
