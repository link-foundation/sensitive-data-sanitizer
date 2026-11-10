#!/usr/bin/env python3
"""Vendor the Betterleaks rules that the pinned Gitleaks set does not have.

Betterleaks (the maintained Gitleaks successor) keeps the Gitleaks TOML
shape: Go/RE2 regexes, keywords and an optional secret group. Its per-rule
`filter` is an Expr program. Only the side-effect-free clauses that work on
the captured secret are translated:

* `entropy(secret) < N` / `<= N`    -> `entropy` (+ `entropyInclusive`)
* `matchesAny(secret, [...])`       -> `reject` patterns
* `!matchesAny(secret, [...])`      -> `require` patterns
* `containsAny(secret, [...])`      -> `reject` literal patterns

`tokenRatio` (a BPE heuristic), nearby-line evidence and live `validate`
requests are not evaluated: dropping them can only add findings, which is
the safe direction for a redactor. Rules marked `skipReport` (components
used only for validation) and the context-heavy `generic-*` rules (covered by
the native context detectors) are not vendored.
"""

import argparse
import hashlib
import json
import re
import tomllib
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--version", default="v1.10.0")
parser.add_argument("--source", type=Path, help="Use an already-downloaded TOML")
parser.add_argument("--license", type=Path, help="Use an already-downloaded LICENSE")
args = parser.parse_args()
base = f"https://raw.githubusercontent.com/betterleaks/betterleaks/{args.version}"
raw = (
    args.source.read_bytes()
    if args.source
    else urllib.request.urlopen(f"{base}/config/betterleaks.toml").read()
)
root = Path(__file__).resolve().parent.parent
gitleaks_ids = {
    rule["id"]
    for path in sorted((root / "src/vendor/gitleaks").glob("rules-*.json"))
    for rule in json.loads(path.read_text())
}

SECRET = r'finding\["secret"\]'
ENTROPY = re.compile(rf"(?:filter\.)?entropy\({SECRET}\)\s*(<=?)\s*([\d.]+)")
STRING = re.compile(r'`([^`]*)`|"((?:[^"\\]|\\.)*)"')
LIST = re.compile(
    rf"(!?)(?:filter\.)?(matchesAny|containsAny)\({SECRET},\s*"
    rf"\[((?:\s*(?:{STRING.pattern})\s*,?)*)\s*\]\)"
)


def strings(body):
    for raw_string, quoted in STRING.findall(body):
        yield raw_string if raw_string or not quoted else json.loads(f'"{quoted}"')


def translate(rule):
    """Return the translated filter fields and whether anything was dropped."""
    text = rule.get("filter", "")
    fields = {}
    entropy = ENTROPY.search(text)
    if entropy:
        fields["entropy"] = float(entropy.group(2))
        if entropy.group(1) == "<=":
            fields["entropyInclusive"] = True
    # Statements (`let`) build values from surrounding lines; their list
    # checks are not about the secret alone, so only entropy is kept.
    if "let " not in text:
        for negated, kind, body, *_ in LIST.findall(text):
            values = list(strings(body))
            if kind == "containsAny":
                values = [re.escape(value) for value in values]
            fields.setdefault("require" if negated else "reject", []).extend(values)
    rest = LIST.sub("", ENTROPY.sub("", text))
    rest = re.sub(
        r"(?:filter\.)?tokenRatio\(" + SECRET + r"\)\s*>=?\s*[\d.]+", "", rest
    )
    partial = bool(re.sub(r"[\s|()]", "", rest))
    return fields, partial


rules, partial = [], []
for rule in tomllib.loads(raw.decode())["rules"]:
    if (
        rule["id"] in gitleaks_ids
        or rule.get("skipReport")
        or "regex" not in rule
        or rule["id"].startswith("generic-")
    ):
        continue
    fields, dropped = translate(rule)
    if dropped:
        partial.append(rule["id"])
    entry = {
        key: rule[key]
        for key in (
            "id",
            "description",
            "regex",
            "secretGroup",
            "keywords",
            "confidence",
            "filter",
        )
        if key in rule
    }
    rules.append({**entry, **fields})

target = root / "src/vendor/betterleaks"
target.mkdir(parents=True, exist_ok=True)
for old in target.glob("rules-*.json"):
    old.unlink()
for index in range(0, len(rules), 40):
    (target / f"rules-{index // 40}.json").write_text(
        json.dumps(rules[index : index + 40], indent=2) + "\n"
    )
license_text = (
    args.license.read_bytes()
    if args.license
    else urllib.request.urlopen(f"{base}/LICENSE").read()
)
(target / "LICENSE").write_bytes(license_text)
(target / "provenance.json").write_text(
    json.dumps(
        {
            "version": args.version,
            "source": f"{base}/config/betterleaks.toml",
            "sha256": hashlib.sha256(raw).hexdigest(),
            "rules": len(rules),
            "files": (len(rules) + 39) // 40,
            "partialFilters": partial,
            "policy": "Only rule ids absent from the vendored Gitleaks set; original RE2 patterns; entropy and secret-only matchesAny/containsAny filters; no tokenRatio, nearby-line evidence, validation or skipReport components.",
        },
        indent=2,
    )
    + "\n"
)
print(f"Vendored {len(rules)} rules from {args.version}; partial filters: {partial}")
