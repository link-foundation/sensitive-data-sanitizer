import { describe, it, expect } from 'test-anywhere';
import { pagesEnabled } from '../scripts/check-pages.mjs';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
describe('conditional GitHub Pages deployment', () => {
  it('builds successfully with disabled or legacy Pages', () => {
    expect(pagesEnabled(404, {})).toBe(false);
    expect(pagesEnabled(200, { build_type: 'legacy' })).toBe(false);
    expect(pagesEnabled(200, { build_type: 'workflow' })).toBe(true);
  });
  it('surfaces authentication and server failures', () => {
    for (const status of [401, 403, 500]) {
      expect(() => pagesEnabled(status, {})).toThrow();
    }
  });
  it('gates configure, upload and deployment together', () => {
    const workflow = readFileSync('.github/workflows/example-app.yml', 'utf8');
    expect(workflow).toContain('run: bash scripts/check-pages.sh');
    expect(workflow).toContain("&& 'require' || 'warn'");
    const { jobs } = parse(workflow);
    const expected =
      "github.event_name == 'push' && github.ref == 'refs/heads/main'";
    for (const name of [
      'Configure GitHub Pages',
      'Upload GitHub Pages artifact',
    ]) {
      expect(
        jobs['web-build'].steps.find((step) => step.name === name).if
      ).toBe(expected);
    }
    expect(jobs['pages-deploy'].if).toBe(expected);
  });
});
