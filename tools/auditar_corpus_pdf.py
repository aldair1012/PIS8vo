"""Audita texto nativo de PDF sin modificar el corpus; no verifica OCR ni consejos."""
from collections import Counter
from pathlib import Path
import json
import re
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'rag-sources'
UNITS = re.compile(r'(?i)\b(?:kg|g|ha|mm|cm|mg|ml|l)\b|%')


def main():
    results = []
    for path in sorted(SOURCES.glob('*.pdf')):
        doc = PdfReader(path)
        counts = Counter()
        for page in doc.pages:
            text = (page.extract_text() or '').strip()
            counts['paginas'] += 1
            counts['texto_nativo_escaso'] += len(text) < 200
            counts['contienen_numeros'] += bool(re.search(r'\d', text))
            counts['contienen_unidades_posibles'] += bool(UNITS.search(text))
        results.append({'archivo': path.name, **counts})
    print(json.dumps({'aviso': 'Conteos heurísticos de texto nativo; no evalúan OCR, exactitud, tablas ni vigencia.', 'archivos': results}, ensure_ascii=True, indent=2))

if __name__ == '__main__': main()
