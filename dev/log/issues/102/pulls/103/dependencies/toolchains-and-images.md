# Toolchains, images, inline tools and local compatibility package

Registry/release metadata checked 2026-11-06 UTC. Full occurrence/source details are in the matching CSV.

| Dependency | Before | Latest stable | Final | Reason |
| --- | --- | --- | --- | --- |
| Node.js | 24.x | 26.13.0 | 26.13.0 | Current stable; Node 27 alpha excluded |
| npm | 11.16.0 helper / runner-provided | 12.2.2 | 12.2.2 | npm installed before setup-node cache calls npm config; npm 12 JSON consumers reviewed |
| Python | 3.13 | 3.15.2 | 3.14.10 | Upstream runtime incompatibility: Presidio 2.2.366 requires preshed<3.0.14; 3.0.13 source build crashes model loading on 3.15. Existing upstream issue 2431 and actual CI reproduction linked in ANALYSIS.md. Latest compatible security release retained. |
| Bun | 1.x | 1.4.4 | 1.4.4 | Current stable |
| Deno | 2.x | 2.9.8 | 2.9.8 | Current stable; regenerate deno.lock with this version |
| Temurin Java | 21 | 27.0.1.0.2+1 | 21.0.13+9 | Capacitor 8.6 generates Gradle 8.14.3 projects and recommends Java 21. Gradle 8.14.3 does not run on Java 27; forcing a Gradle 9.8.2 migration outside the supported template would break mobile builds. Latest Java 21 patch retained. |
| Buildx CLI | action-selected latest | 0.38.2 | 0.38.2 | Current stable, explicit version instead of floating download |
| BuildKit image | moby/buildkit:buildx-stable-1 | 0.34.2 | moby/buildkit:v0.34.2 | Current stable; manifest digest c5f8862f52499773af85bc07695b2379ef08e8002352b0df2c4864c91d78dabe verified in research/buildkit-image.json |
| Playwright container | 1.59.1-noble | 1.65.0-noble | sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d | Version and browser binary match locked Playwright 1.65.0; Ubuntu noble is supported upstream image |
| actionlint image / CLI | 1.7.12 | 1.7.12 | sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 | Latest release; known self-reference and queue:max schema gaps retain narrow existing exceptions; upstream reports linked |
| Ruff | 0.17.3 | 0.17.4 | 0.17.4 | All duplicated active pins synchronized |
| zizmor CLI | 1.30.1 | 1.32.0 | 1.32.0 | Supported by current zizmor-action 0.8.1; workflow policy updated |
| uv | not pinned | 0.13.7 | 0.13.7 | Metadata resolution and hash-locked install use upstream APIs |
| pip-audit | not pinned | 2.10.1 | 2.10.1 | Audits complete committed graph without interpreting auditor own environment as project |
| shellcheck-py | 0.11.0.1 | 0.11.0.1 | 0.11.0.1 | Current wrapper release; bundled ShellCheck 0.11.0 |
| git-filter-repo | 2.47.0 | 2.47.0 | 2.47.0 | Current release; documentation-only optional user tool |
| Gitleaks | 8.30.1 | 8.30.1 | 8.30.1 | Current stable; historical result tables remain original observations |
| TruffleHog | 3.99.0 | 3.99.8 | 3.99.8 | Current stable; historical results explicitly labeled original run |
| GitHub CLI | 2.103.3 | 2.103.3 | 2.103.3 | Current explicit downloaded version |
| en_core_web_sm | 3.8.0 | 3.8.0 compatible with spaCy 3.8 | 3.8.0 | Official spaCy model compatibility matrix selects 3.8.0; CI verifies wheel SHA256 and exercises model |
| local rimraf compatibility adapter | 1.0.0 | local package, no registry release | 1.0.0 | temp 0.9.4 still needs legacy callback API. Existing local adapter delegates actual deletion to node:fs.rm; lock metadata repaired; removal proposed upstream temp issue 100. |

The root Node >=22.13.0 engine is the supported consumer API floor, not the development toolchain. Development and CI use Node 26.13.0 / npm 12.2.2. No runtime feature requires dropping existing supported consumers.

Runner-provided Bash, curl, tar, Git, pipx, Android SDK and OS packages are managed by the GitHub-hosted runner image rather than this repository. The repository does not vendor or claim to lock their trees. All repository-managed downloaded tools, npm packages, Python packages and action/image references are inventoried here or in the ecosystem tables. Local audit environment helpers are listed separately in python-tooling; this is evidence, not a new product dependency surface.
