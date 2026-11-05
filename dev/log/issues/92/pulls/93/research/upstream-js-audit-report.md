## Reproduction

While comparing the complete JavaScript template snapshot (tree 7877a27980664bc6453e80262f8391d1c2562ab1) against link-foundation/sensitive-data-sanitizer#92, the downstream CI exposed two shared gaps:

1. `npm audit --json` in the root, `examples/universal-app`, and `.github/actions/artifact-transport` reports GHSA-g3hv-75wg-m249 for minimatch 7–10. The desktop graph also reports GHSA-3g3m-2fjr-6pw4 for glob 9–14.0.1. The advisory propagation reports nine desktop packages even though there are only two underlying causes. The default high-only gate remains green but emits warnings; the scheduled moderate/fixable gate can fail. Upstream fixes exist: minimatch >=11.0.1 and glob >=14.0.2.
2. `pipx run zizmor==1.30.1 --config .github/zizmor.yml --min-confidence low --persona regular .` reports self-repository warnings for the artifact adapter references in links.yml, security.yml and workflows.yml. The existing compatibility ignore covers release.yml, example-app.yml and action.yml only. Satisfying these warnings with `$/...` makes actionlint 1.7.12 reject the new syntax; rhysd/actionlint#711 and rhysd/actionlint#732 already track that parser gap.

Downstream evidence: https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42067846815 and https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42067847790 . Complete logs and machine-readable audit output are preserved in the downstream PR's dev/log/issues/92/pulls/93 folder.

## Workarounds and code suggestions

- Resolve vulnerable transitive ranges with scoped overrides (`minimatch@>=7 <11` to ^11.0.4; `glob@>=9 <=14.0.1` to ^14.0.2), regenerate committed locks, and exercise archive extraction, actual Electron ASAR packaging and the live artifact roundtrip. Preserve unaffected older callable APIs used by legacy dependencies instead of globally forcing every historical minimatch/glob major.
- Until actionlint supports self-repository syntax, extend the existing narrowly documented self-repository compatibility rule to the three affected workflow files. Keep every other zizmor audit enabled. Add a policy check that catches new unlisted adapter users; remove this exception and adopt `$/` once both tools support it. Switching to a maintained parser with full support is another longer-term option.
- Dependency review's default scorecard threshold also emits twenty warnings for low aggregate repository-maintenance scores of SDK transitive packages, independently of known vulnerabilities. Keep scores displayed as informational context (`show-openssf-scorecard: true`, `warn-on-openssf-scorecard-level: 0`) while retaining strict vulnerability enforcement and full npm-audit reporting. This avoids treating a heuristic repository score as a package vulnerability verdict.

References: https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249 , https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 , https://docs.zizmor.sh/audits/#self-repository .
