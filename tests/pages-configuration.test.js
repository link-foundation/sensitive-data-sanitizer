import { describe, it, expect } from 'test-anywhere';
import { pagesEnabled } from '../scripts/check-pages.mjs';
import { readFileSync } from 'node:fs';
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
    expect(workflow).toContain('node scripts/check-pages.mjs');
    expect(
      workflow.match(/if: steps.pages.outputs.pages_enabled == 'true'/g).length
    ).toBe(2);
    expect(workflow).toContain(
      "if: needs.web-build.outputs.pages_enabled == 'true'"
    );
  });
});
