"""Ensayo local reproducible: dos bases MySQL propias, SQLite/archivos ficticios y Chroma real aislado."""
from contextlib import closing, contextmanager
import argparse
import json
import os
from pathlib import Path
import shutil
import sqlite3
import socket
import subprocess
import tempfile
import time
from unittest.mock import patch

import respaldo_local as backup

ROOT = Path(__file__).resolve().parents[1]
PHP = os.environ.get('ZEASYS_TEST_PHP') or shutil.which('php') or r'C:\xampp\php\php.exe'
ENVIRONMENT = ROOT / 'backend-api/tests/integracion/entorno.php'
RECOVERY = ROOT / 'backend-api/tests/integracion/recuperacion.php'
CHROMA_CODE = """
import json, sys
from pathlib import Path
import chromadb
from chromadb.config import Settings
client = chromadb.PersistentClient(path=sys.argv[2], settings=Settings(anonymized_telemetry=False))
if sys.argv[1] == 'crear':
    collection = client.create_collection('recuperacion_prueba', embedding_function=None)
    collection.add(ids=['suelo','riego'], embeddings=[[1.,0.,0.],[0.,1.,0.]], documents=['Textura del suelo: documento ficticio', 'Riego: documento ficticio'], metadatas=[{'pagina':1},{'pagina':2}])
else:
    collection = client.get_collection('recuperacion_prueba', embedding_function=None)
    result = collection.query(query_embeddings=[[.99,.01,0.]], n_results=1)
    assert collection.count() == 2 and result['ids'][0] == ['suelo']
    assert result['metadatas'][0][0]['pagina'] == 1
    assert 'Textura' in result['documents'][0][0]
print('Chroma: correcto')
"""


def php(*arguments):
    return subprocess.check_output([PHP, *map(str, arguments)], cwd=ROOT)


@contextmanager
def temporary_mysql():
    """Instancia nueva, puerto libre y datos temporales; no utiliza mysql.db de XAMPP."""
    binaries = Path(r'C:\xampp\mysql\bin')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix='zeasys-mariadb-') as tmp:
        folder = Path(tmp)
        datadir = folder/'data'
        subprocess.run([str(binaries/'mysql_install_db.exe'), '--datadir='+str(datadir), '--port='+str(port)], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with (folder/'server.log').open('wb') as log:
            process = subprocess.Popen([str(binaries/'mysqld.exe'), '--defaults-file='+str(datadir/'my.ini'), '--bind-address=127.0.0.1', '--innodb-buffer-pool-size=32M'], stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            admin = [str(binaries/'mysqladmin.exe'), '--no-defaults', '--host=127.0.0.1', '--port='+str(port), '--user=root']
            try:
                for _ in range(100):
                    if process.poll() is not None:
                        raise RuntimeError('La instancia temporal no pudo arrancar.')
                    ping = subprocess.run([*admin, 'ping'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    if ping.returncode == 0: break
                    time.sleep(.2)
                else: raise RuntimeError('La instancia temporal no respondió a tiempo.')
                yield {'ZEASYS_DB_HOST':'127.0.0.1', 'ZEASYS_DB_PORT':str(port), 'ZEASYS_DB_USER':'root', 'ZEASYS_DB_PASS':''}
            finally:
                if process.poll() is None:
                    try:
                        subprocess.run([*admin, 'shutdown'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        process.terminate()  # Exclusivamente el proceso creado arriba para este ensayo.
                        process.wait(timeout=10)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chroma-python', type=Path, default=Path(os.environ.get('LOCALAPPDATA', '')) / 'ZeaSys-Chroma/Scripts/python.exe')
    args = parser.parse_args()
    if not args.chroma_python.is_file():
        parser.error('Indica --chroma-python con el Python que tiene Chroma instalado.')
    with temporary_mysql() as env, patch.dict(os.environ, env):
        run_recovery(args)


def run_recovery(args):
    identities = []
    try:
        for _ in range(2):
            identities.append(json.loads(php(ENVIRONMENT, 'crear')))
        source, target = identities
        php(RECOVERY, 'sembrar', source['db'], source['token'])
        with tempfile.TemporaryDirectory(prefix='zeasys-recuperacion-') as tmp:
            folder = Path(tmp)
            project, local = folder/'web/ZeaSys', folder/'servicios'
            flowise = local/'ZeaSys-Flowise-Local'
            for relative in ('data','secrets','storage'):
                (flowise/relative).mkdir(parents=True)
            with closing(sqlite3.connect(flowise/'data/database.sqlite')) as db:
                db.execute('CREATE TABLE chat_flow (id TEXT, name TEXT, flowData TEXT)')
                db.execute('INSERT INTO chat_flow VALUES (?, ?, ?)', ('flujo-prueba', 'Flujo ficticio', '{"nodes":[],"edges":[]}'))
                db.commit()
            (flowise/'secrets/key').write_text('clave-ficticia-no-utilizable', encoding='utf-8')
            (flowise/'storage/documento.txt').write_text('almacenamiento ficticio', encoding='utf-8')
            for relative, content in (('backend-api/public/uploads/prueba.txt', b'archivo ficticio'), ('rag-sources/prueba.pdf', b'%PDF-1.4\n% solo fixture de copia'), ('.htaccess', b'# configuracion ficticia')):
                path = project/relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
            chroma_env = {**os.environ, 'ANONYMIZED_TELEMETRY':'False'}
            def chroma(mode, path):
                subprocess.run([str(args.chroma_python), '-c', CHROMA_CODE, mode, str(path)], env=chroma_env, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            chroma('crear', local/'ZeaSys-Chroma/data')
            # Este proceso de Chroma ya terminó; sus archivos están cerrados para copiar.
            controlled_env = {key:value for key,value in os.environ.items() if not key.startswith('ZEASYS_')}
            for key in ('ZEASYS_DB_HOST','ZEASYS_DB_PORT','ZEASYS_DB_USER','ZEASYS_DB_PASS'):
                if key in os.environ: controlled_env[key] = os.environ[key]
            controlled_env['ZEASYS_DB_NAME'] = source['db']
            with patch.object(backup, 'ROOT', project), patch.object(backup, 'LOCAL', local), patch.dict(os.environ, controlled_env, clear=True):
                saved = backup.backup(folder/'privado/copias', None)
                count = backup.verify(saved)
                restored = backup.prepare_restore(saved, folder/'privado/recuperado')
            php(RECOVERY, 'importar', target['db'], target['token'], restored/'base.sql')
            php(RECOVERY, 'comprobar', target['db'], target['token'])
            with closing(sqlite3.connect(restored/'flowise.sqlite')) as db:
                assert db.execute('SELECT id FROM chat_flow').fetchone()[0] == 'flujo-prueba'
            assert (restored/'uploads/prueba.txt').read_bytes() == b'archivo ficticio'
            assert (restored/'flowise-secrets/key').read_text() == 'clave-ficticia-no-utilizable'
            assert (restored/'flowise-storage/documento.txt').read_text() == 'almacenamiento ficticio'
            assert (restored/'configuracion/.htaccess').is_file()
            assert json.loads((restored/'configuracion/entorno-zeasys.json').read_text())['ZEASYS_DB_NAME'] == source['db']
            chroma('comprobar', restored/'chroma')
            # Abrir Chroma puede cambiar sus SQLite: comprobar huellas antes de abrir servicios.
            print(f'Recuperación correcta: {count} archivos verificados, MySQL restaurado con usuario limitado, SQLite y consulta vectorial real.')
            print('Datos exclusivamente ficticios. No comprueba el arranque de Flowise ni credenciales de proveedores.')
    finally:
        for identity in reversed(identities):
            php(ENVIRONMENT, 'eliminar', identity['db'], identity['token'])
        print('Bases desechables eliminadas; instalación personal conservada.')


if __name__ == '__main__':
    main()
