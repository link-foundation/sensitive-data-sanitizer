import { escapePattern } from './detection.js';
import { months } from './personal-context.js';

const boundary = '[\\p{L}\\p{M}\\p{N}_]';
const capitalized = (word) => word[0].toUpperCase() + word.slice(1);
const month = [
  ...new Set(months.split('|').flatMap((word) => [word, capitalized(word)])),
].join('|');
const rangeStart = `(?:(?:19|20)\\d{2}(?:-\\d{2}){0,2}|\\d{2}[./](?:\\d{2}\\.)?\\d{4}|(?:${month})\\.?[ \\t]+(?:19|20)\\d{2})`;
const rangeOpen = ['по настоящее время', 'настоящее время', 'сейчас', 'по н.в.']
  .concat(['н.в.', 'по н/в', 'н/в', 'present', 'now', 'current'])
  .flatMap((word) => [word, capitalized(word)])
  .map(escapePattern)
  .join('|');
export const documentDateRange = `${rangeStart}(?:[ \\t]*[-–—][ \\t]*|[ \\t]+(?:по|to)[ \\t]+)(?:${rangeStart}|${rangeOpen}|null|(?=\\)))(?!${boundary})`;
