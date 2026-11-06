"""Record action releases from GitHub before changing active workflow pins."""

import concurrent.futures
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "dev/log/issues/102/pulls/103/research/actions-registry.json"


def latest(repo):
    command = ["gh", "api", f"repos/{repo}/releases/latest"]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(f"Could not query {repo}: {result.stderr}")
    release = json.loads(result.stdout)
    return repo, {
        key: release[key]
        for key in ("tag_name", "published_at", "html_url", "body", "target_commitish")
    }


if __name__ == "__main__":
    actions = {}
    for file in (ROOT / ".github").rglob("*.yml"):
        if "node_modules" in file.parts:
            continue
        for action, ref in re.findall(
            r"uses: ([\w.-]+/[\w./-]+)@([\w.-]+)", file.read_text()
        ):
            repo = "/".join(action.split("/")[:2])
            actions.setdefault(repo, []).append(
                {"file": str(file.relative_to(ROOT)), "action": action, "before": ref}
            )
    actions.update(
        {
            name: []
            for name in (
                "rhysd/actionlint",
                "oven-sh/bun",
                "denoland/deno",
                "moby/buildkit",
                "microsoft/playwright",
                "adoptium/temurin25-binaries",
            )
        }
    )
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        releases = dict(executor.map(latest, sorted(actions)))
    for repo, release in releases.items():
        release["occurrences"] = actions[repo]
    OUTPUT.write_text(json.dumps(releases, indent=2) + "\n")
    print("\n".join(f"{repo}: {info['tag_name']}" for repo, info in releases.items()))
