import { it, expect } from 'test-anywhere';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse } from 'yaml';

it('keeps weekly dependency updates aligned with every tracked manifest', () => {
  const config = parse(readFileSync('.github/dependabot.yml', 'utf8'));
  const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter((path) => !/^(dev\/log|docs\/case-studies)\//u.test(path));
  const directory = (path) =>
    dirname(path) === '.' ? '/' : `/${dirname(path)}`;
  for (const [ecosystem, filename] of [
    ['npm', /^package-lock\.json$/u],
    ['pip', /^requirements.*\.txt$/u],
  ]) {
    const update = config.updates.find(
      (item) => item['package-ecosystem'] === ecosystem
    );
    const actual = [
      ...new Set(
        paths
          .filter((path) => filename.test(path.split('/').at(-1)))
          .map(directory)
      ),
    ].sort();
    expect((update.directories ?? [update.directory]).sort()).toEqual(actual);
  }
  expect(
    config.updates.map((item) => item['package-ecosystem']).sort()
  ).toEqual(['github-actions', 'npm', 'pip']);
  for (const update of config.updates) {
    expect(update.schedule.interval).toBe('weekly');
    expect(update.cooldown['default-days']).toBe(7);
  }
});
