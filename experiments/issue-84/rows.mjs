import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

// Complete first-column text tables from the issue snapshots, excluding #79's
// JavaScript expressions (covered explicitly by the regression suite).
export const rows = [78, 80, 81, 82, 83].flatMap((issue) => {
  const { body } = JSON.parse(
    readFileSync(new URL(`issue-${issue}.json`, import.meta.url))
  );
  return [...body.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => ({
    issue,
    input: match[1],
    limit: [
      'Спасибо, Анна!',
      'Анна, добрый день!',
      'Менеджер Анна',
      'Лютик, менеджер',
    ].includes(match[1]),
  }));
});
