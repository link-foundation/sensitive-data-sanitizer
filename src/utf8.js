import { failure } from './detection.js';

export function sequenceWidth(first) {
  if (first < 0x80) {
    return 1;
  }
  if (first >= 0xc2 && first <= 0xdf) {
    return 2;
  }
  if (first >= 0xe0 && first <= 0xef) {
    return 3;
  }
  if (first >= 0xf0 && first <= 0xf4) {
    return 4;
  }
  return 0;
}
function secondByteAllowed(first, byte) {
  const limits = {
    0xe0: [0xa0, 0xbf],
    0xed: [0x80, 0x9f],
    0xf0: [0x90, 0xbf],
    0xf4: [0x80, 0x8f],
  };
  const [low, high] = limits[first] ?? [0x80, 0xbf];
  return byte >= low && byte <= high;
}
export function validSequence(bytes, index, width) {
  if (!width || index + width > bytes.length) {
    return false;
  }
  for (let next = 1; next < width; next++) {
    const byte = bytes[index + next];
    if (
      byte < 0x80 ||
      byte > 0xbf ||
      (next === 1 && !secondByteAllowed(bytes[index], byte))
    ) {
      return false;
    }
  }
  return true;
}
// Called only after fatal UTF-8 decoding fails. Diagnostics contain positions,
// never input bytes or personal values. Offsets identify the sequence start.
export function encodingFailure(bytes, record, baseOffset) {
  let index = 0;
  while (index < bytes.length) {
    const width = sequenceWidth(bytes[index]);
    if (!validSequence(bytes, index, width)) {
      break;
    }
    index += width;
  }
  return failure('ERR_ENCODING', {
    record,
    offset: baseOffset + index,
    recordOffset: index,
  });
}
