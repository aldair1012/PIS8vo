"""Indexa una versión nueva y comprobable; nunca sustituye la colección activa automáticamente."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import time
from urllib.request import Request,urlopen

BASE='http://127.0.0.1:8000/api/v2/tenants/default_tenant/databases/default_database/collections'


def request(url,payload=None,timeout=120):
    body=None if payload is None else json.dumps(payload,ensure_ascii=False).encode()
    with urlopen(Request(url,body,{'Content-Type':'application/json'}),timeout=timeout) as response: return json.load(response)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('corpus',type=Path)
    parser.add_argument('--model',required=True)
    parser.add_argument('--salida',type=Path,required=True)
    args=parser.parse_args()
    corpus=json.loads(args.corpus.read_text(encoding='utf-8'))
    entries=corpus['entries']
    if not entries or len({x['id'] for x in entries})!=len(entries): raise ValueError('Corpus vacío o con IDs repetidos.')
    sha=hashlib.sha256(args.corpus.read_bytes()).hexdigest()
    name='zeasys_pdf_v2_'+re.sub('[^a-z0-9]+','_',args.model.lower()).strip('_')+'_'+sha[:8]
    collection=next((c for c in request(BASE) if c['name']==name),None)
    if collection is None: collection=request(BASE,{'name':name,'metadata':{'hnsw:space':'cosine','corpus_sha256':sha,'embedding_model':args.model}})
    gemma=args.model.startswith('embeddinggemma:')
    config={'version':2,'collection':name,'model':args.model,'corpus_sha256':sha,'query_prefix':'task: search result | query: ' if gemma else '', 'document_prefix':'title: {source} | text: ' if gemma else ''}
    started=time.monotonic()
    for start in range(0,len(entries),8):
        batch=entries[start:start+8]
        texts=[(('title: '+x['metadata']['source_file']+' | text: ') if gemma else '')+x['text'] for x in batch]
        response=request('http://127.0.0.1:11434/api/embed',{'model':args.model,'input':texts,'truncate':False,'keep_alive':'30m','options':{'num_thread':4}})
        vectors=response.get('embeddings',[])
        if len(vectors)!=len(batch): raise ValueError('Respuesta de embeddings incompleta.')
        dimension=len(vectors[0])
        if any(len(v)!=dimension or not all(type(x) in (int,float) and math.isfinite(x) for x in v) for v in vectors): raise ValueError('Vector inválido.')
        if 'dimensions' in config and config['dimensions']!=dimension: raise ValueError('Dimensión inconsistente.')
        config['dimensions']=dimension
        request(BASE+'/'+collection['id']+'/upsert',{'ids':[x['id'] for x in batch], 'documents':[x['text'] for x in batch], 'metadatas':[x['metadata'] for x in batch], 'embeddings':vectors})
        if start%80==0: print(args.model,min(start+8,len(entries)),'/',len(entries),flush=True)
    count=request(BASE+'/'+collection['id']+'/count')
    if count!=len(entries): raise ValueError('El recuento no coincide con la versión del corpus.')
    config.update({'entries':count,'index_seconds':round(time.monotonic()-started,3)})
    args.salida.write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Índice comprobado:',name,'fragmentos:',count,'dimensiones:',config['dimensions'],flush=True)


if __name__=='__main__': main()
