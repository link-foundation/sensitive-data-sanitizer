import { URL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL(
  '../../docs/case-studies/issue-146/data/',
  import.meta.url
);
const issues = JSON.parse(readFileSync(new URL('issues.json', root)))
  .flat()
  .filter((item) => !item.pull_request);
const comments = JSON.parse(
  readFileSync(new URL('issue-comments.json', root))
).flat();
// Preserve historical requirements and discussions for independent review.
const inventory = issues.map((issue) => ({
  number: issue.number,
  title: issue.title,
  state: issue.state,
  body: issue.body,
  comments: comments.filter((comment) =>
    comment.issue_url.endsWith(`/${issue.number}`)
  ),
  url: issue.html_url,
  acceptance:
    issue.state === 'open'
      ? 'requires implementation and verification'
      : 'closed upstream; independent regression audit required',
}));
writeFileSync(
  new URL('requirements.json', root),
  `${JSON.stringify(inventory, null, 2)}\n`
);
console.log(
  `${inventory.length} issues; ${comments.length} issue/PR conversation comments parsed (${inventory.reduce((sum, issue) => sum + issue.comments.length, 0)} on issues); open: ${inventory.filter((i) => i.state === 'open').map((i) => i.number)}`
);
