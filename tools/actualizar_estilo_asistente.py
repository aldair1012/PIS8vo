"""Actualiza solo las instrucciones editoriales del chatflow local de ZeaSys."""
import datetime
import json
import os
from pathlib import Path
import sqlite3

from switch_flowise_conversation_chain import DEFAULT_CHATFLOW_ID, SYSTEM_PROMPT

db = Path(os.environ['LOCALAPPDATA']) / 'ZeaSys-Flowise-Local' / 'data' / 'database.sqlite'
if not db.is_file():
    raise SystemExit('No se encontró la base local de Flowise.')
with sqlite3.connect(db, timeout=15) as connection:
    row = connection.execute('SELECT flowData FROM chat_flow WHERE id = ?', (DEFAULT_CHATFLOW_ID,)).fetchone()
    if not row:
        raise SystemExit('No se encontró el chatflow de ZeaSys.')
    flow = json.loads(row[0])
    nodes = [n for n in flow.get('nodes', []) if n.get('data', {}).get('type') == 'ConversationChain']
    if len(nodes) != 1:
        raise SystemExit('El chatflow no tiene exactamente una Conversation Chain; no se modificó.')
    inputs = nodes[0]['data']['inputs']
    current = inputs.get('systemMessagePrompt')
    if not isinstance(current, str):
        raise SystemExit('No se encontró el prompt actual; no se modificó.')
    if current == SYSTEM_PROMPT:
        print('Las instrucciones ya están actualizadas.')
    else:
        # Exigir la versión esperada evita sobrescribir una personalización distinta.
        if 'una pregunta de análisis, en un párrafo de máximo cuatro frases' not in current:
            raise SystemExit('El prompt fue personalizado; requiere revisión antes de sustituirlo.')
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        backup = db.with_name(f'database.antes-estilo-{stamp}.sqlite')
        with sqlite3.connect(backup) as snapshot:
            connection.backup(snapshot)
        inputs['systemMessagePrompt'] = SYSTEM_PROMPT
        connection.execute('UPDATE chat_flow SET flowData = ?, updatedDate = ? WHERE id = ?',
                           (json.dumps(flow, ensure_ascii=False, separators=(',', ':')),
                            datetime.datetime.now(datetime.timezone.utc).isoformat(), DEFAULT_CHATFLOW_ID))
        connection.commit()
        print('Instrucciones actualizadas; copia de seguridad:', backup)
