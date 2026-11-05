"""Prove the previous four-stripe setup fails the measured-workload regression."""

import subprocess
from pathlib import Path

paths = [Path(".github/workflows/release.yml"), Path("scripts/run-test-shard.mjs")]
originals = {path: path.read_bytes() for path in paths}
log = Path("dev/log/issues/95/pulls/96/shard-regression-before.log")
try:
    for path in paths:
        path.write_bytes(subprocess.check_output(["git", "show", f"cb7a935:{path}"]))
    with log.open("w") as output:
        result = subprocess.run(
            ["node", "--test", "--test-timeout=30000", "tests/test-sharding.test.js"],
            stdout=output,
            stderr=subprocess.STDOUT,
            check=False,
        )
    assert result.returncode == 1, f"Expected regression failure; see {log}"
finally:
    for path, content in originals.items():
        path.write_bytes(content)
print(f"Previous setup fails the new regression; source restored. See {log}.")
