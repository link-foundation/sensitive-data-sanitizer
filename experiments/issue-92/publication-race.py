"""Reproduce a main-branch race without network access or registry publication.

Run with `before` to replay the old pull, or `after` to use the guarded helper.
All Git operations are confined to temporary repositories and bounded to 5s.
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
mode = sys.argv[1]
assert mode in ("before", "after")
with tempfile.TemporaryDirectory(prefix="issue-92-publish-") as temporary:
    cwd = Path(temporary)

    def git(*args):
        return subprocess.run(
            ["git", *args],
            cwd=cwd,
            text=True,
            capture_output=True,
            check=True,
            timeout=5,
        ).stdout.strip()

    git("init", "-q", "--initial-branch=main")
    git("config", "user.email", "test@example.com")
    git("config", "user.name", "Test")
    git("init", "--bare", "-q", "origin.git")
    git("remote", "add", "origin", str(cwd / "origin.git"))
    (cwd / "source.js").write_text("validated\n")
    git("add", "source.js")
    git("commit", "-qm", "validated")
    validated = git("rev-parse", "HEAD")
    git("push", "-q", "origin", "HEAD:main")
    (cwd / "source.js").write_text("unvalidated\n")
    git("commit", "-qam", "concurrent source change")
    git("push", "-q", "origin", "HEAD:main")
    git("reset", "--hard", validated)
    if mode == "before":
        git("pull", "origin", "main")
    else:
        module = (ROOT / "scripts/release-publication.mjs").as_uri()
        program = (
            f"import {{ prepareReleasePublication }} from {json.dumps(module)};"
            f"await prepareReleasePublication({{parentSha:{json.dumps(validated)},"
            "verifyRemote:true});"
        )
        subprocess.run(
            ["node", "--input-type=module", "-e", program],
            cwd=cwd,
            check=True,
            timeout=5,
        )
    actual = git("rev-parse", "HEAD")
    print(f"{mode}: validated={validated}, publication={actual}", flush=True)
    print(f"publication source: {(cwd / 'source.js').read_text().strip()}", flush=True)
    assert actual == validated, "publication pulled unvalidated source"
