"""Inventory a pinned Betterleaks resolved TOML against the native imports."""

import argparse
import hashlib
import json
import tomllib
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("config", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
raw = args.config.read_bytes()
config = tomllib.loads(raw.decode())
native = {}
for vendor in ("gitleaks", "betterleaks"):
    for path in Path(f"src/vendor/{vendor}").glob("rules-*.json"):
        for rule in json.loads(path.read_text()):
            native[rule["id"]] = vendor
rules = [
    {
        "id": rule["id"],
        "nativeImport": native.get(rule["id"]),
        "components": [item["id"] for item in rule.get("components", [])],
        "skipReport": rule.get("skipReport", False),
        "hasFilter": bool(rule.get("filter")),
        "hasValidation": bool(rule.get("validation")),
    }
    for rule in config["rules"]
]
result = {
    "release": "v1.10.0",
    "source": "https://github.com/betterleaks/betterleaks/releases/tag/v1.10.0",
    "sha256": hashlib.sha256(raw).hexdigest(),
    "rules": rules,
}
args.output.write_text(json.dumps(result, indent=2) + "\n")
print(
    json.dumps(
        {
            "rules": len(rules),
            "withoutNativeId": sum(not r["nativeImport"] for r in rules),
        }
    )
)
