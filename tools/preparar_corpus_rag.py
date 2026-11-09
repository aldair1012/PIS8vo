"""Extrae los cinco PDF con control de caracteres, OCR y fragmentos por página; no activa colecciones."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
NAMES = ['inec-espac-resultados-2025.pdf', 'iniap-guia-maiz-amarillo-litoral-2014.pdf',
         'iniap-guia-produccion-maiz-sierra-2021.pdf', 'iniap-manual-produccion-maiz-2007.pdf',
         'mag-guia-productores-maiz-amarillo-2026.pdf']
YEARS = [2025, 2014, 2021, 2007, 2026]


def needs_ocr(text):
    invalid = sum(unicodedata.category(c) in {'Co', 'Cc', 'Cs'} and c not in '\n\r\t' for c in text)
    return len(text.strip()) < 200 or '\ufffd' in text or invalid / max(len(text), 1) > .005


def chunks(text, size=650, overlap=90):
    """Mantiene frases cuando caben y nunca une páginas o documentos distintos."""
    text = re.sub(r'\s+', ' ', text).strip()
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            boundaries = [text.rfind(mark, start + size//2, end) for mark in ('. ', '; ', '? ')]
            stop = max(boundaries)
            end = stop + 1 if stop >= 0 else text.rfind(' ', start + size//2, end)
            if end <= start: end = min(start + size, len(text))
        yield text[start:end].strip()
        if end == len(text): break
        start = max(start + 1, end - overlap)
        while start < end and text[start-1] != ' ': start += 1


def build(pages, reviews, size=650):
    entries = []
    checked = {(x['source_file'], x['page']):x for x in reviews}
    for page in pages:
        name, number = page['source_file'], page['page']
        metadata = {'source_file':name, 'page':number, 'year':YEARS[NAMES.index(name)],
                    'ocr':page['extraction']=='ocr', 'source_sha256':page['source_sha256'],
                    'verified_excerpt':False, 'region':'Sierra' if 'sierra' in name else 'Litoral' if 'litoral' in name else 'General'}
        # Una página cotejada usa los extractos revisados, nunca su OCR contradictorio.
        review = checked.get((name,number))
        for index, part in enumerate(chunks(page['text'] if review is None else '', size)):
            if len(part) < 65: continue
            identifier = hashlib.sha256(f'{name}:{number}:{part}'.encode()).hexdigest()[:32]
            entries.append({'id':identifier, 'text':part, 'metadata':{**metadata, 'chunk':index}})
        if review:
            if review['source_sha256'] != page['source_sha256']: raise ValueError('La revisión corresponde a otro PDF: '+name)
            for index, part in enumerate(review['excerpts']):
                identifier = hashlib.sha256(f'verificado:{name}:{number}:{part}'.encode()).hexdigest()[:32]
                entries.append({'id':identifier, 'text':part, 'metadata':{**metadata, 'verified_excerpt':True, 'chunk':10000+index}})
    return entries


def main():
    from pypdf import PdfReader
    import pypdfium2 as pdfium
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--paginas', type=Path, required=True)
    parser.add_argument('--salida', type=Path, required=True)
    parser.add_argument('--revisiones', type=Path, default=ROOT/'backend-api/data/referencias/rag-revisiones.json')
    parser.add_argument('--reutilizar', action='store_true')
    args = parser.parse_args()
    if args.reutilizar:
        pages = json.loads(args.paginas.read_text(encoding='utf-8'))
        hashes = {name:hashlib.sha256((ROOT/'rag-sources'/name).read_bytes()).hexdigest() for name in NAMES}
        for page in pages:
            actual=hashes[page['source_file']]
            if actual != page['source_sha256']: raise ValueError('Cambió el PDF; extraer de nuevo.')
    else:
        pages = []
        with tempfile.TemporaryDirectory(prefix='zeasys-corpus-') as tmp:
            images = Path(tmp)
            for doc_index, name in enumerate(NAMES):
                path = ROOT/'rag-sources'/name
                sha = hashlib.sha256(path.read_bytes()).hexdigest()
                reader, rendered = PdfReader(path), pdfium.PdfDocument(str(path))
                count = 0
                for number, page in enumerate(reader.pages,1):
                    native = (page.extract_text() or '').strip()
                    ocr = needs_ocr(native)
                    target = images/f'{doc_index}-{number}.png'
                    if ocr:
                        rendered[number-1].render(scale=2).to_pil().save(target)
                        count += 1
                    pages.append({'source_file':name, 'page':number, 'source_sha256':sha, 'native_text':native,
                                  'text':native, 'extraction':'ocr' if ocr else 'native', 'image_name':target.name})
                rendered.close()
                print(name, 'páginas:',len(reader.pages),'OCR:',count,flush=True)
            subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',str(ROOT/'tools/ocr_rag_windows.ps1'),'-ImageDir',str(images)],check=True)
            for page in pages:
                if page['extraction']=='ocr':
                    result = (images/page['image_name']).with_suffix('.txt')
                    if not result.is_file(): raise ValueError('Falta el resultado OCR.')
                    page['text']=result.read_text(encoding='utf-8-sig').strip()
                del page['image_name']
        args.paginas.parent.mkdir(parents=True,exist_ok=True)
        args.paginas.write_text(json.dumps(pages,ensure_ascii=False),encoding='utf-8')
    reviews = json.loads(args.revisiones.read_text(encoding='utf-8')) if args.revisiones.is_file() else []
    entries = build(pages, reviews)
    content = {'version':2,'chunk_size':650,'chunk_overlap':90,'entries':entries}
    args.salida.parent.mkdir(parents=True,exist_ok=True)
    args.salida.write_text(json.dumps(content,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('Fragmentos:',len(entries),'extractos revisados:',sum(x['metadata']['verified_excerpt'] for x in entries),flush=True)


if __name__=='__main__': main()
