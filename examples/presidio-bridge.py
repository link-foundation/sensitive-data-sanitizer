"""Local stdin/stdout adapter. Install Presidio and models before use.

Example: python -m pip install presidio-analyzer
         python -m spacy download en_core_web_lg
Configure NlpEngineProvider here for other installed language models.
This script does not download models or contact a remote analysis service.
"""
import argparse
import json
import sys

from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider
import spacy

parser = argparse.ArgumentParser()
parser.add_argument('--language', default='en')
parser.add_argument('--model', default='en_core_web_lg')
options = parser.parse_args()
if not spacy.util.is_package(options.model):
    raise SystemExit('Install the selected model before running this offline bridge.')

text = sys.stdin.read(10 * 1024 * 1024 + 1)
if len(text) > 10 * 1024 * 1024:
    raise SystemExit(2)
nlp = NlpEngineProvider(nlp_configuration={
    'nlp_engine_name': 'spacy',
    'models': [{'lang_code': options.language, 'model_name': options.model}],
}).create_engine()
analyzer = AnalyzerEngine(nlp_engine=nlp, supported_languages=[options.language])
results = analyzer.analyze(text=text, language=options.language)
json.dump([{"start":r.start,"end":r.end,"entity_type":r.entity_type} for r in results], sys.stdout)
