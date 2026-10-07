// Reproduce the accessible-repository inventory and indexed-code searches.
// Only metadata is saved; incident logs and matched source values are omitted.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const directory = 'docs/case-studies/issue-1/research';
mkdirSync(directory, { recursive: true });
const owners = ['link-foundation', 'linksplatform', 'link-assistant', 'konard'];
function gh(args) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
for (const owner of owners) {
  const endpoint =
    owner === 'konard' ? `users/${owner}/repos` : `orgs/${owner}/repos`;
  const repositories = gh([
    'api',
    `${endpoint}?per_page=100&type=${owner === 'konard' ? 'owner' : 'all'}`,
    '--paginate',
    '--jq',
    '.[] | {full_name,default_branch,description,archived}',
  ]);
  const owned = repositories
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.full_name.toLowerCase().startsWith(`${owner}/`));
  writeFileSync(
    join(directory, `${owner}-repositories.jsonl`),
    `${owned.map((entry) => JSON.stringify(entry)).join('\n')}\n`
  );
  console.log(
    JSON.stringify({
      owner,
      repositories: owned.length,
    })
  );
  for (const term of ['sanit', 'redact']) {
    const path = join(directory, `${owner}-${term}-search.jsonl`);
    if (existsSync(path)) {
      continue;
    }
    const matches = [];
    for (let page = 1; page <= 10; page++) {
      const result = await fetchPage(owner, term, page);
      matches.push(
        ...result.items.map((entry) => ({
          path: entry.path,
          url: entry.html_url,
          repository: { fullName: entry.repository.full_name },
        }))
      );
      if (result.items.length < 100) {
        break;
      }
    }
    writeFileSync(
      path,
      `${matches.map((match) => JSON.stringify(match)).join('\n')}\n`
    );
    console.log(
      JSON.stringify({ owner, term, indexedMatches: matches.length, cap: 1000 })
    );
  }
}

async function fetchPage(owner, term, page) {
  let result;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      result = JSON.parse(
        gh([
          'api',
          `search/code?q=${term}+user:${owner}&per_page=100&page=${page}`,
        ])
      );
      return result;
    } catch (error) {
      if (attempt === 3 || !String(error.stderr).includes('rate limit')) {
        throw error;
      }
      console.log(
        JSON.stringify({ owner, term, page, waitingForRateLimit: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  }
}
