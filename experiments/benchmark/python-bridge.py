"""Pinned offline baseline scanners, using installed English spaCy model."""
import json
import sys
import tempfile
import importlib.metadata
from pathlib import Path
from detect_secrets.settings import default_settings
from detect_secrets.core.scan import scan_file
from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider
import scrubadub

for package, version in {"detect-secrets": "1.5.0", "presidio-analyzer": "2.2.364", "scrubadub": "2.0.1", "spacy": "3.8.16", "en-core-web-sm": "3.8.0"}.items():
    if importlib.metadata.version(package) != version:
        raise RuntimeError("Install the pinned benchmark version of " + package)

nlp = NlpEngineProvider(nlp_configuration={
    "nlp_engine_name": "spacy", "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}]
}).create_engine()
presidio = AnalyzerEngine(nlp_engine=nlp, supported_languages=["en"])
scrubber = scrubadub.Scrubber()
results = {}
for case in json.load(sys.stdin):
    text = case["text"]
    secrets = []
    with tempfile.TemporaryDirectory() as directory, default_settings():
        path = Path(directory) / 'case.txt'
        path.write_text(text)
        for secret in scan_file(str(path)):
            value = secret.secret_value
            start = 0
            while value and (start := text.find(value, start)) >= 0:
                secrets.append({"start": start, "end": start + len(value)})
                start += len(value)
    results[case["id"]] = {
        "detect-secrets": secrets,
        "presidio": [{"start": r.start, "end": r.end} for r in presidio.analyze(text=text, language="en")],
        "scrubadub": [{"start": f.beg, "end": f.end} for f in scrubber.iter_filth(text)],
    }
json.dump(results, sys.stdout)
