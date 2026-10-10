import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function pagesEnabled(status, body) {
  if (status === 404) {
    return false;
  }
  if (status !== 200) {
    throw new Error(`Pages configuration check failed (${status})`);
  }
  return body.build_type === 'workflow';
}
export async function checkPages(env = process.env, request = fetch) {
  const response = await request(
    `${env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${env.GITHUB_REPOSITORY}/pages`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GH_TOKEN}`,
      },
    }
  );
  const enabled = pagesEnabled(
    response.status,
    response.status === 200 ? await response.json() : {}
  );
  appendFileSync(env.GITHUB_OUTPUT, `pages_enabled=${enabled}\n`);
  console.log(
    enabled
      ? 'GitHub Actions Pages deployment enabled.'
      : 'Pages is not configured for GitHub Actions; web build remains enabled.'
  );
  return enabled;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await checkPages();
}
