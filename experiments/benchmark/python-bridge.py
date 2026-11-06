"""Pinned offline baseline scanners, using installed English spaCy model."""

import importlib.metadata
import json
import sys
import tempfile
from pathlib import Path

import scrubadub
from detect_secrets.core.scan import scan_file
from detect_secrets.settings import default_settings
from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider

pins = dict(
    line.split("==")
    for line in Path(__file__).with_name("requirements.txt").read_text().splitlines()
    if line and not line.startswith("#")
)
pins["en-core-web-sm"] = "3.8.0"
for package, version in pins.items():
    if importlib.metadata.version(package) != version:
        raise RuntimeError("Install the pinned benchmark version of " + package)

nlp = NlpEngineProvider(
    nlp_configuration={
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
    }
).create_engine()
presidio = AnalyzerEngine(nlp_engine=nlp, supported_languages=["en"])
scrubber = scrubadub.Scrubber()
results = {}
for case in json.load(sys.stdin):
    text = case["text"]
    secrets = []
    with tempfile.TemporaryDirectory() as directory, default_settings():
        path = Path(directory) / "case.txt"
        path.write_text(text)
        for secret in scan_file(str(path)):
            value = secret.secret_value
            start = 0
            while value and (start := text.find(value, start)) >= 0:
                secrets.append({"start": start, "end": start + len(value)})
                start += len(value)
    results[case["id"]] = {
        "detect-secrets": secrets,
        "presidio": [
            {"start": r.start, "end": r.end}
            for r in presidio.analyze(text=text, language="en")
        ],
        "scrubadub": [
            {"start": f.beg, "end": f.end} for f in scrubber.iter_filth(text)
        ],
    }
json.dump(results, sys.stdout)
