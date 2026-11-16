"""Instala el nodo propio conservando modelo, credencial y memoria de Flowise. No imprime secretos."""
from pathlib import Path
import datetime as dt
import json
import os
import shutil
import sqlite3

ROOT=Path(__file__).resolve().parents[1]
HOME_FLOWISE=Path(os.environ.get('LOCALAPPDATA',''))/'ZeaSys-Flowise-Local'
FLOW_ID='27d477e0-66b5-4a51-aba0-dcfaf80728c1'

def main():
    db=HOME_FLOWISE/'data/database.sqlite'
    modules=HOME_FLOWISE/'node_modules/flowise-components/dist/nodes/chains'
    if not db.is_file() or not modules.is_dir():raise RuntimeError('Instala primero el Flowise local de ZeaSys.')
    target=modules/'ZeaSysGeminiSearch'
    target.mkdir(exist_ok=True)
    source=ROOT/'flowise-nodes/ZeaSysGeminiSearch/ZeaSysGeminiSearch.js'
    dest=target/source.name
    if not dest.exists() or dest.read_bytes()!=source.read_bytes():shutil.copy2(source,dest)
    with sqlite3.connect(db) as con:
        raw=con.execute('select flowData from chat_flow where id=?',(FLOW_ID,)).fetchone()
        if raw is None:
            print('Nodo instalado. El flujo principal todavía no está configurado.');return
        flow=json.loads(raw[0])
        chain=next(n for n in flow['nodes'] if n['data'].get('name') in ['conversationChain','zeaSysGeminiSearch'])
        if chain['data'].get('name')=='zeaSysGeminiSearch':
            print('Nodo de búsqueda instalado; flujo ya actualizado.');return
        backup_dir=HOME_FLOWISE/'backups';backup_dir.mkdir(exist_ok=True)
        backup=backup_dir/('antes-gemini-busqueda-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S')+'.sqlite')
        with sqlite3.connect(backup) as copy:con.backup(copy)
        data=chain['data'];data.update(name='zeaSysGeminiSearch',label='ZeaSys · Gemini con búsqueda',type='ZeaSysGeminiSearch',version=1,baseClasses=['ZeaSysGeminiSearch','BaseChain','Runnable'])
        data['inputs']={key:val for key,val in data.get('inputs',{}).items() if key in ['model','memory']}
        data['inputParams']=[]
        if data.get('outputs'):data['outputs']={'output':'zeaSysGeminiSearch'}
        data['outputAnchors']=[{'id':chain['id']+'-output-zeaSysGeminiSearch-ZeaSysGeminiSearch|BaseChain|Runnable','name':'zeaSysGeminiSearch','label':'ZeaSys · Gemini con búsqueda','type':'ZeaSysGeminiSearch|BaseChain|Runnable'}]
        data['inputAnchors']=[a for a in data.get('inputAnchors',[]) if a.get('name') in ['model','memory']]
        for node in flow['nodes']:
            if node['data'].get('name')=='chatGoogleGenerativeAI':node['data']['inputs']['streaming']=False
        con.execute('update chat_flow set flowData=?,updatedDate=? where id=?',(json.dumps(flow,ensure_ascii=False),dt.datetime.now(dt.timezone.utc).isoformat(),FLOW_ID))
        print('Flujo principal actualizado: Gemini + búsqueda + memoria. Respaldo privado creado.')

if __name__=='__main__':main()
