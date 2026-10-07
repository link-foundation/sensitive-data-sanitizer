"""Snapshot documented entity names only; no proprietary algorithms copied."""
import argparse
import hashlib
import html
import json
import re
import urllib.request
from pathlib import Path

sources = {
    'google': 'https://docs.cloud.google.com/sensitive-data-protection/docs/infotypes-reference',
    'azure': 'https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/concepts/entity-categories',
    'aws': 'https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html',
}
patterns = {
    'google': r'<td>\s*<code[^>]*>([A-Z][A-Z0-9_]+)</code>',
    'azure': r'<td>\[<strong>([A-Za-z0-9]+)</strong>\]</td>',
    'aws': r'<span class="term">([A-Z][A-Z0-9_]+)</span>',
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source-directory', type=Path, help='Explicit directory of catalog-<vendor>.html snapshots')
args = parser.parse_args()
root = Path('src/vendor/entities')
root.mkdir(parents=True, exist_ok=True)
for vendor, url in sources.items():
    raw = (args.source_directory / ('catalog-' + vendor + '.html')).read_bytes() if args.source_directory else urllib.request.urlopen(url).read()
    names = sorted(set(html.unescape(s) for s in re.findall(patterns[vendor], raw.decode())))
    if len(names) < 20:
        raise RuntimeError('Catalog extraction failed: ' + vendor)
    (root / (vendor + '.json')).write_text(json.dumps({'source': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'names': names}, indent=2) + '\n')
    print(vendor, len(names))
