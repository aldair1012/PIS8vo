"""Evalúa páginas relevantes anotadas; las métricas corresponden a este conjunto, no a toda la agronomía."""
import argparse
import json
import math
import re
from pathlib import Path
import subprocess
import time
import unicodedata
from indexar_corpus_rag import BASE,request

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--indice',type=Path)
    parser.add_argument('--corpus',type=Path)
    parser.add_argument('--hibrida',action='store_true')
    parser.add_argument('--salida',type=Path,required=True)
    args=parser.parse_args()
    config=json.loads(args.indice.read_text(encoding='utf-8')) if args.indice else {'collection':'zeasys_cinco_pdf_v1','model':'all-minilm','query_prefix':''}
    questions=json.loads((ROOT/'tools/preguntas_rag_verificadas.json').read_text(encoding='utf-8'))
    collection=next(c for c in request(BASE) if c['name']==config['collection'])
    rows=[]
    for q in questions:
        start=time.monotonic()
        vec=request('http://127.0.0.1:11434/api/embed',{'model':config['model'],'input':config.get('query_prefix','')+q['question'],'truncate':False,'options':{'num_thread':4}})['embeddings'][0]
        data=request(BASE+'/'+collection['id']+'/query',{'query_embeddings':[vec],'n_results':15 if args.hibrida else 10,'include':['documents','metadatas']})
        if args.hibrida:
            payload={'question':q['question'],'dense_ids':data['ids'][0],'corpus_file':str(args.corpus.resolve())}
            result=subprocess.run([r'C:\xampp\php\php.exe',str(ROOT/'tools/consulta_rag.php')],input=json.dumps(payload),text=True,encoding='utf-8',capture_output=True,check=True)
            docs=json.loads(result.stdout)
        else:
            docs=[{'pageContent':t,'metadata':m} for t,m in zip(data['documents'][0],data['metadatas'][0])]
            sierra=bool(re.search(r'\bsierra\b',q['question'],re.I)); litoral=bool(re.search(r'\blitoral\b',q['question'],re.I))
            if sierra != litoral:
                excluded='iniap-guia-maiz-amarillo-litoral-2014.pdf' if sierra else 'iniap-guia-produccion-maiz-sierra-2021.pdf'
                docs=[x for x in docs if x['metadata']['source_file']!=excluded]
            docs=docs[:3]
        relevant={tuple(x) for x in q['relevant_pages']}
        keys=[(x['metadata']['source_file'],x['metadata']['page']) for x in docs]
        flags=[int(key in relevant) for key in keys]
        hit=bool(relevant & set(keys))
        mrr=next((1/(n+1) for n,x in enumerate(flags) if x),0)
        dcg=sum(flag/math.log2(n+2) for n,flag in enumerate(flags))
        # Páginas repetidas no aportan relevancia adicional al NDCG.
        seen=set(); dcg=0
        for n,key in enumerate(keys):
            if key in relevant and key not in seen: dcg+=1/math.log2(n+2); seen.add(key)
        ideal=sum(1/math.log2(n+2) for n in range(min(3,len(relevant))))
        def normalize(text): return ''.join(c for c in unicodedata.normalize('NFD',text.casefold()) if c.isalnum())
        context=normalize(' '.join(x['pageContent'] for x in docs))
        facts=q.get('required_facts',[])
        fact_coverage=sum(normalize(term) in context for term in facts)/len(facts) if facts else 0
        rows.append({'id':q['id'],'question':q['question'],'split':q['split'],'p1':flags[0] if flags else 0,'recall3':len(relevant & set(keys))/len(relevant),'hit3':int(hit),'mrr3':mrr,'ndcg3':dcg/ideal,'fact_coverage':fact_coverage,'seconds':round(time.monotonic()-start,4),'retrieved':[{'file':x['metadata']['source_file'],'page':x['metadata']['page'],'text':x['pageContent']} for x in docs]})
        print(q['id'],'hit:',int(hit),'p1:',flags[0] if flags else 0,flush=True)
    def summary(items): return {k:round(sum(x[k] for x in items)/len(items),4) for k in ('p1','recall3','hit3','mrr3','ndcg3','fact_coverage','seconds')}
    report={'config':config,'hybrid':args.hibrida,'questions':len(rows),'metrics':summary(rows),'by_split':{s:summary([x for x in rows if x['split']==s]) for s in sorted({x['split'] for x in rows})},'rows':rows,'limitation':'Etiquetas de páginas seleccionadas cotejadas visualmente; no son juicios exhaustivos de todos los fragmentos ni validación agronómica independiente.'}
    args.salida.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report['metrics']),flush=True)


if __name__=='__main__': main()
