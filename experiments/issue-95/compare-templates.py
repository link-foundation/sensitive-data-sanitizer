"""Compare every template blob and retain all workflow/script differences."""

import difflib
import json
import subprocess
import tarfile
from pathlib import Path

ROOT = Path("dev/log/issues/95/pulls/96/templates")
local_paths = (
    subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0")[:-1]
)
local = {
    p: Path(p).read_bytes()
    for p in local_paths
    if not p.startswith(("dev/log/", "docs/case-studies/"))
}

for kind in ("javascript", "python"):
    tree = json.loads((ROOT / f"{kind}-tree.json").read_text())
    with tarfile.open(ROOT / f"{kind}.tar.gz") as archive:
        remote = {
            m.name.split("/", 1)[1]: archive.extractfile(m).read()
            for m in archive.getmembers()
            if m.isfile() and "/" in m.name
        }
    assert not tree.get("truncated"), f"Incomplete {kind} recursive tree"
    assert set(remote) == {
        item["path"] for item in tree["tree"] if item["type"] == "blob"
    }, f"Archive/tree mismatch: {kind}"
    rows = []
    differences = []
    for path in sorted(set(local) | set(remote)):
        before, after = remote.get(path), local.get(path)
        state = (
            "identical"
            if before == after
            else "template only"
            if after is None
            else "local only"
            if before is None
            else "different"
        )
        rows.append({"path": path, "state": state})
        if (
            path.startswith((".github/", "scripts/"))
            and not path.endswith((".json", "licenses.txt"))
            and "/dist/" not in path
            and state != "identical"
        ):
            differences.extend(
                difflib.unified_diff(
                    (before or b"").decode(errors="replace").splitlines(True),
                    (after or b"").decode(errors="replace").splitlines(True),
                    fromfile=f"{kind}/{path}",
                    tofile=f"local/{path}",
                )
            )
    (ROOT / f"{kind}-comparison.json").write_text(
        json.dumps({"sha": tree["sha"], "files": rows}, indent=2) + "\n"
    )
    (ROOT / f"{kind}-ci.diff").write_text("".join(differences))
    print(
        kind,
        {
            state: sum(r["state"] == state for r in rows)
            for state in ("identical", "different", "template only", "local only")
        },
    )
