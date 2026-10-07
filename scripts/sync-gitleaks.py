#!/usr/bin/env python3
"""Vendor every rule from a pinned Gitleaks release; no regex translation.

The runtime evaluates the original Go/RE2 expressions with RE2 WASM. Keeping
the original scopes, captures and entropy avoids a lossy Go-to-JS conversion.
"""
import argparse
import hashlib
import json
from pathlib import Path
import tomllib
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--version', default='v8.30.1')
parser.add_argument('--source', type=Path, help='Use an already-downloaded TOML')
args = parser.parse_args()
base = f'https://raw.githubusercontent.com/gitleaks/gitleaks/{args.version}'
raw = args.source.read_bytes() if args.source else urllib.request.urlopen(f'{base}/config/gitleaks.toml').read()
rules = tomllib.loads(raw.decode())['rules']
target = Path(__file__).resolve().parent.parent / 'src/vendor/gitleaks'
target.mkdir(parents=True, exist_ok=True)
for old in target.glob('rules-*.json'):
    old.unlink()
for index in range(0, len(rules), 40):
    # All metadata is retained for audit and repeatable upgrades. Embedded
    # allowlists are not trusted as publication exemptions by our runtime.
    (target / f'rules-{index // 40}.json').write_text(json.dumps(rules[index:index+40], indent=2) + '\n')
license_text = urllib.request.urlopen(f'{base}/LICENSE').read()
(target / 'LICENSE').write_bytes(license_text)
(target / 'provenance.json').write_text(json.dumps({
    'version': args.version,
    'source': f'{base}/config/gitleaks.toml',
    'sha256': hashlib.sha256(raw).hexdigest(),
    'rules': len(rules),
    'textRules': sum('regex' in rule for rule in rules),
    'policy': 'Original RE2 patterns and entropy; no path/comment/allowlist suppression of sensitive text.',
}, indent=2) + '\n')
print(f'Vendored {len(rules)} rules from {args.version}')
