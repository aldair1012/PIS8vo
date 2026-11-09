"""Indexa PDF locales por página en una colección nueva y conserva fuente y página.

Usar el Python del runtime de Codex (pypdf y pypdfium2) en Windows.
No borra ni modifica la colección ni el Document Store existentes.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.request

from pypdf import PdfReader
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'rag-sources'
NAMES = [
    'inec-espac-resultados-2025.pdf', 'iniap-guia-maiz-amarillo-litoral-2014.pdf',
    'iniap-guia-produccion-maiz-sierra-2021.pdf', 'iniap-manual-produccion-maiz-2007.pdf',
    'mag-guia-productores-maiz-amarillo-2026.pdf',
]
BASE = 'http://127.0.0.1:8000/api/v2/tenants/default_tenant/databases/default_database/collections'
COLLECTION = 'zeasys_cinco_pdf_v1'


def request(url, payload=None, timeout=120):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)


def split_text(text, size=200, overlap=30):
    text = ' '.join(text.split())
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            boundary = text.rfind(' ', start + size // 2, end)
            if boundary > start: end = boundary
        yield text[start:end]
        if end == len(text): break
        start = max(start + 1, end - overlap)


def main():
    missing = [name for name in NAMES if not (SOURCES / name).is_file()]
    if missing: raise RuntimeError('Faltan PDF: ' + ', '.join(missing))
    pages = []
    with tempfile.TemporaryDirectory(prefix='zeasys-pdf-ocr-') as temp:
        image_dir = Path(temp)
        for file_no, name in enumerate(NAMES):
            path = SOURCES / name
            reader = PdfReader(path)
            document = pdfium.PdfDocument(str(path))
            count_ocr = 0
            for index, page in enumerate(reader.pages):
                text = (page.extract_text() or '').strip()
                needs_ocr = len(text) < 200
                target = image_dir / f'{file_no:02d}-{index + 1:04d}.png'
                if needs_ocr:
                    bitmap = document[index].render(scale=2.0)
                    bitmap.to_pil().save(target)
                    count_ocr += 1
                pages.append({'source_file': name, 'page': index + 1, 'text': text, 'ocr': needs_ocr, 'image': target})
            document.close()
            print(f'{name}: {len(reader.pages)} páginas, {count_ocr} para OCR', flush=True)
        if any(page['ocr'] for page in pages):
            print('Reconociendo páginas escaneadas con OCR de Windows...', flush=True)
            subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(ROOT / 'tools/ocr_rag_windows.ps1'), '-ImageDir', str(image_dir)], check=True)
        for page in pages:
            if page['ocr']:
                text_path = page['image'].with_suffix('.txt')
                if text_path.exists(): page['text'] = text_path.read_text(encoding='utf-8-sig')
        entries = []
        coverage = {}
        for page in pages:
            name, number = page['source_file'], page['page']
            text = page['text'].strip()
            if len(text) < 40: continue
            coverage[name] = coverage.get(name, 0) + 1
            for part, chunk in enumerate(split_text(text)):
                identifier = hashlib.sha256(f'{name}:{number}:{part}:{chunk}'.encode()).hexdigest()[:32]
                entries.append({'id': identifier, 'text': chunk, 'metadata': {'source_file': name, 'page': number, 'ocr': page['ocr'], 'chunk': part}})
        if any(coverage.get(name, 0) == 0 for name in NAMES):
            raise RuntimeError('Uno o más PDF no tienen texto recuperable; no se indexaron parcialmente.')
        print('Páginas con texto:', json.dumps(coverage, ensure_ascii=False), '| fragmentos:', len(entries), flush=True)
        collections = request(BASE)
        existing = next((c for c in collections if c.get('name') == COLLECTION), None)
        collection = existing or request(BASE, {'name': COLLECTION, 'metadata': {'hnsw:space': 'cosine', 'description': 'Cinco PDF de referencia de ZeaSys, fuente y página'}})
        for start in range(0, len(entries), 16):
            batch = entries[start:start + 16]
            vectors = request('http://127.0.0.1:11434/api/embed', {'model': 'all-minilm', 'input': [x['text'] for x in batch]})['embeddings']
            if len(vectors) != len(batch) or any(len(v) != 384 for v in vectors): raise RuntimeError('Respuesta de embeddings incompleta.')
            request(f"{BASE}/{collection['id']}/upsert", {'ids': [x['id'] for x in batch], 'documents': [x['text'] for x in batch], 'metadatas': [x['metadata'] for x in batch], 'embeddings': vectors})
            if start % 160 == 0 or start + 16 >= len(entries): print(f'Indexados {min(start + 16, len(entries))}/{len(entries)}', flush=True)
        count = request(f"{BASE}/{collection['id']}/count")
        print(f"OK colección={COLLECTION} id={collection['id']} fragmentos={count}", flush=True)


if __name__ == '__main__': main()
