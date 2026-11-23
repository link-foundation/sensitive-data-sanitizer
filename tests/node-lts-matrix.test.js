/* eslint local/no-changelog-comments: ["warn", { "allowDatesInStrings": true }] */
import { describe, expect, it } from 'test-anywhere';
import {
  createTestMatrix,
  selectLtsVersions,
} from '../scripts/node-lts-matrix.mjs';

const schedule = {
  v29: { lts: '2030-10-20', end: '2033-04-30' },
  v32: { lts: '2032-10-20', end: '2035-04-30' },
  v28: { lts: '2029-10-20', maintenance: '2030-10-20', end: '2031-04-30' },
  v30: { start: '2030-04-20', end: '2031-05-30' },
};
const releases = [
  { version: 'v32.0.0-alpha.1', lts: false },
  { version: 'v30.1.0', lts: false },
  { version: 'v28.9.12', lts: 'Old' },
  { version: 'v29.2.0', lts: 'New' },
  { version: 'v28.10.1', lts: 'Old' },
  { version: 'v29.0.0', lts: false },
];

describe('supported Node.js LTS selection', () => {
  it('picks the latest stable LTS patch per supported line, including maintenance and odd majors', () => {
    expect(selectLtsVersions(schedule, releases, '2030-10-19')).toEqual([
      '28.10.1',
    ]);
    expect(selectLtsVersions(schedule, releases, '2030-10-20')).toEqual([
      '28.10.1',
      '29.2.0',
    ]);
    expect(selectLtsVersions(schedule, releases, '2031-04-29')).toEqual([
      '28.10.1',
      '29.2.0',
    ]);
    expect(selectLtsVersions(schedule, releases, '2031-04-30')).toEqual([
      '29.2.0',
    ]);
  });

  it('waits for the first LTS build during the promotion day', () => {
    const beforePromotion = releases.filter(({ lts }) => lts !== 'New');
    expect(selectLtsVersions(schedule, beforePromotion, '2030-10-20')).toEqual([
      '28.10.1',
    ]);
    expect(() =>
      selectLtsVersions(schedule, beforePromotion, '2030-10-21')
    ).toThrow(/No published LTS release found for Node.js v29/);
  });

  it('fails on invalid or unusable upstream data', () => {
    expect(() => selectLtsVersions([], releases, '2030-10-20')).toThrow(
      /schedule object/
    );
    expect(() => selectLtsVersions(schedule, [], '2030-10-20')).toThrow(
      /nonempty Node.js release index/
    );
    expect(() => selectLtsVersions({}, releases, '2030-10-20')).toThrow(
      /No supported Node.js LTS releases/
    );
    expect(() =>
      selectLtsVersions({ v28: { lts: '2030-10-20' } }, releases, '2030-10-20')
    ).toThrow(/Invalid Node.js LTS dates/);
  });

  it('runs the same Node.js legs on scheduled checks without repeating Bun or Deno', () => {
    const versions = ['28.10.1', '29.2.0'];
    const all = createTestMatrix(versions);
    expect(createTestMatrix(versions, { nodeOnly: true }).include).toEqual(
      all.include.filter(({ runtime }) => runtime === 'node')
    );
  });
});
