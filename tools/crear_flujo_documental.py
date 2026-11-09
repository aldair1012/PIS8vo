"""Crea un flujo documental auxiliar sin reemplazar el chat principal."""
import copy
import datetime
import json
import os
from pathlib import Path
import sqlite3
import urllib.request
import uuid

import enable_flowise_rag as rag

COLLECTION = 'zeasys_cinco_pdf_v1'
STORE_ID = '44dd87a7-5231-5c41-a866-8d28afe9b958'
FLOW_ID = '168a813e-e9ad-5d20-90b8-537fd98825f8'
db = Path(os.environ['LOCALAPPDATA']) / 'ZeaSys-Flowise-Local' / 'data' / 'database.sqlite'
url = 'http://127.0.0.1:8000/api/v2/tenants/default_tenant/databases/default_database/collections'
with urllib.request.urlopen(url, timeout=5) as response:
    collections = json.load(response)
collection = next((row for row in collections if row.get('name') == COLLECTION), None)
if not collection:
    raise SystemExit('La colección documental aún no está indexada.')
for source in ['inec-espac-resultados-2025.pdf', 'iniap-guia-maiz-amarillo-litoral-2014.pdf', 'iniap-guia-produccion-maiz-sierra-2021.pdf', 'iniap-manual-produccion-maiz-2007.pdf', 'mag-guia-productores-maiz-amarillo-2026.pdf']:
    req = urllib.request.Request(f"{url}/{collection['id']}/get", json.dumps({'where': {'source_file': source}, 'limit': 1, 'include': ['metadatas']}).encode(), {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as response:
        if not json.load(response).get('ids'): raise SystemExit(f'Faltan fragmentos de {source}.')

with sqlite3.connect(db, timeout=15) as conn:
    conn.row_factory = sqlite3.Row
    source_flow = conn.execute('SELECT * FROM chat_flow WHERE id = ?', (rag.CHATFLOW_ID,)).fetchone()
    source_store = conn.execute('SELECT * FROM document_store WHERE id = ?', (rag.STORE_ID,)).fetchone()
    if not source_flow or not source_store: raise SystemExit('Falta el flujo principal o el almacén original.')
    if conn.execute('SELECT 1 FROM chat_flow WHERE id = ?', (FLOW_ID,)).fetchone():
        raise SystemExit('El flujo documental ya existe; no se sobrescribe.')
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    backup = db.with_name('database.antes-flujo-documental-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.sqlite')
    with sqlite3.connect(backup) as snapshot: conn.backup(snapshot)
    store = dict(source_store)
    store.update({'id': STORE_ID, 'name': 'ZeaSys — Cinco PDF con página', 'description': 'Cinco PDF locales indexados externamente en Chroma; cada fragmento conserva archivo y página.', 'status': 'UPSERTED', 'loaders': '[]', 'whereUsed': '[]', 'createdDate': now, 'updatedDate': now})
    cfg = json.loads(store['vectorStoreConfig']); cfg['config']['collectionName'] = COLLECTION; cfg['config']['topK'] = '5'; store['vectorStoreConfig'] = json.dumps(cfg)
    columns = list(store)
    conn.execute('INSERT INTO document_store (' + ','.join('"'+k+'"' for k in columns) + ') VALUES (' + ','.join('?' for _ in columns) + ')', [store[k] for k in columns])
    flow = json.loads(source_flow['flowData'])
    model = rag.active_chat_model(flow)
    memory = next(n for n in flow['nodes'] if n.get('data', {}).get('type') == 'ConversationSummaryBufferMemory')
    rag.STORE_ID = STORE_ID
    store_node = rag.document_store_node()
    qa = rag.qa_node(model['id'])
    qa['data']['inputs']['returnSourceDocuments'] = True
    qa['data']['inputs']['rephrasePrompt'] = 'Reformula como consulta agrícola de máximo 25 palabras. No copies datos extensos.\n\nHistorial: {chat_history}\n\nPregunta: {question}\n\nConsulta:'
    qa['data']['inputs']['responsePrompt'] = 'Responde usando los fragmentos de referencia sin inventar datos. Distingue fuente histórica de datos actuales de la parcela.\n\n{context}'
    flow['nodes'] = [copy.deepcopy(model), copy.deepcopy(memory), store_node, qa]
    mh, memh = rag.output_handle(model, 'BaseChatModel'), rag.output_handle(memory, 'BaseMemory')
    flow['edges'] = [rag.edge(model['id'], mh, memory['id'], memory['id']+'-input-model-BaseChatModel', 'memory-model'), rag.edge(model['id'], mh, qa['id'], qa['id']+'-input-model-BaseChatModel', 'qa-model'), rag.edge(memory['id'], memh, qa['id'], qa['id']+'-input-memory-BaseMemory', 'qa-memory'), rag.edge(store_node['id'], store_node['id']+'-output-retriever-BaseRetriever', qa['id'], qa['id']+'-input-vectorStoreRetriever-BaseRetriever', 'retriever')]
    row = dict(source_flow)
    row.update({'id': FLOW_ID, 'name': 'ZeaSys — Consulta documental PDF', 'flowData': json.dumps(flow, ensure_ascii=False, separators=(',', ':')), 'createdDate': now, 'updatedDate': now, 'deployed': 1})
    columns = list(row)
    conn.execute('INSERT INTO chat_flow (' + ','.join('"'+k+'"' for k in columns) + ') VALUES (' + ','.join('?' for _ in columns) + ')', [row[k] for k in columns])
    conn.commit()
    print('Flujo documental creado:', FLOW_ID, '| Almacén:', STORE_ID, '| Respaldo:', backup)
