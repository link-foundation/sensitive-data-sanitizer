"""Prove focused regression tests reject the pre-fix workflows, restoring them."""

import subprocess
from pathlib import Path

root = Path("dev/log/issues/95/pulls/96")
paths = [
    Path(f".github/workflows/{name}.yml")
    for name in ("example-app", "security", "workflows")
]
paths.append(Path("scripts/check-file-line-limits.sh"))
originals = {path: path.read_bytes() for path in paths}
try:
    for path in paths:
        path.write_bytes(
            subprocess.check_output(
                ["git", "show", f"c92be73b6e212bbd67771e86cee215e3d631af83:{path}"]
            )
        )
    result = subprocess.run(
        [
            "node",
            "--test",
            "--test-timeout=30000",
            "tests/preview-tools.test.js",
            "tests/security-workflow.test.js",
            "tests/workflows-lint.test.js",
            "tests/check-file-line-limits.test.js",
        ],
        capture_output=True,
    )
    (root / "regression-before.log").write_bytes(result.stdout + result.stderr)
    if result.returncode != 1:
        raise RuntimeError(
            f"Expected failing regression tests, got {result.returncode}"
        )
    print("Pre-fix workflows rejected; see regression-before.log")
finally:
    for path, content in originals.items():
        path.write_bytes(content)
