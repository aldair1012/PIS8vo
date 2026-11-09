"""Compara recuperación directa y Flowise sin modificar colecciones ni configuración."""
from __future__ import annotations
import argparse
import json
import math
import re
import unicodedata
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

ALLOWED = {'inec-espac-resultados-2025.pdf', 'iniap-guia-maiz-amarillo-litoral-2014.pdf',
           'iniap-guia-produccion-maiz-sierra-2021.pdf', 'iniap-manual-produccion-maiz-2007.pdf',
           'mag-guia-productores-maiz-amarillo-2026.pdf'}
BASE = 'http://127.0.0.1:8000/api/v2/tenants/default_tenant/databases/default_database/collections'


def request(url, payload=None):
    data = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
    with urlopen(Request(url, data, {'Content-Type': 'application/json'}), timeout=25) as res:
        return json.load(res)


def normalized(docs):
    result = []
    for document in docs:
        meta = document.get('metadata') or {}
        page, name, text = meta.get('page'), meta.get('source_file'), document.get('pageContent')
        if name not in ALLOWED or type(page) is not int or page < 1 or not isinstance(text, str) or not text.strip():
            continue
        result.append({'archivo': name, 'pagina': page, 'texto': text.strip()[:200]})
        if len(result) == 3:
            break
    return result


def regional_filter(question):
    """Aplica una exclusión únicamente cuando se menciona una sola región explícita."""
    text = ''.join(ch for ch in unicodedata.normalize('NFD', question.lower()) if unicodedata.category(ch) != 'Mn')
    sierra = bool(re.search(r'\bsierra\b', text))
    litoral = bool(re.search(r'\blitoral\b', text))
    if sierra == litoral:
        return None
    excluded = 'iniap-guia-maiz-amarillo-litoral-2014.pdf' if sierra else 'iniap-guia-produccion-maiz-sierra-2021.pdf'
    return {'source_file': {'$in': sorted(ALLOWED - {excluded})}}


def direct(question, *, aplicar_filtro_regional=True):
    start = time.monotonic()
    collections = request(BASE)
    collection = next((c for c in collections if c.get('name') == 'zeasys_cinco_pdf_v1'), None)
    if collection is None:
        raise ValueError('Colección documental no encontrada')
    embedding = request('http://127.0.0.1:11434/api/embed', {'model': 'all-minilm', 'input': question})['embeddings'][0]
    if len(embedding) != 384 or not all(isinstance(v, (float, int)) and math.isfinite(v) for v in embedding):
        raise ValueError('Vector de consulta inválido')
    query = {'query_embeddings': [embedding], 'n_results': 10, 'include': ['documents', 'metadatas']}
    where = regional_filter(question) if aplicar_filtro_regional else None
    if where:
        query['where'] = where
    data = request(f"{BASE}/{collection['id']}/query", query)
    docs = [{'pageContent': text, 'metadata': meta} for text, meta in zip(data['documents'][0], data['metadatas'][0])]
    return {'segundos': time.monotonic() - start, 'fuentes': normalized(docs)}


def flowise(question, url):
    start = time.monotonic()
    data = request(url, {'question': question})
    return {'segundos': time.monotonic() - start, 'fuentes': normalized(data.get('sourceDocuments', []))}


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('preguntas', type=Path, help='JSON: lista de preguntas para comparar')
    parser.add_argument('--sin-filtro-regional', action='store_true', help='Compara recuperación sin prefiltrar contra el flujo actual')
    parser.add_argument('--flowise-url', default='http://127.0.0.1:3000/api/v1/prediction/168a813e-e9ad-5d20-90b8-537fd98825f8')
    args = parser.parse_args()
    questions = json.loads(args.preguntas.read_text(encoding='utf-8-sig'))
    if not isinstance(questions, list) or not questions or any(not isinstance(q, str) or not q.strip() or len(q) > 200 for q in questions):
        parser.error('Se requiere una lista no vacía de preguntas de hasta 200 caracteres')
    for question in questions:
        for name, func in [('directo', lambda: direct(question, aplicar_filtro_regional=not args.sin_filtro_regional)), ('flowise', lambda: flowise(question, args.flowise_url))]:
            try:
                result = func()
            except Exception as exc:
                result = {'error': str(exc)}
            print(json.dumps({'pregunta': question, 'metodo': name, **result}, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    main()
