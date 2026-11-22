"""Copia consistente de MariaDB en línea y ensayo de restauración en una base nueva."""
import argparse
import gzip
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone

from respaldo_local import digest, private_destination


def ejecutar(destino, verificar, opciones=None):
    destino = private_destination(destino)
    destino.mkdir(mode=0o700, parents=True, exist_ok=True)
    base = os.environ.get('ZEASYS_DB_NAME', 'agropredict_db')
    if not re.fullmatch(r'[a-zA-Z0-9_]+', base):
        raise ValueError('Nombre de base inválido.')
    binarios = Path(os.environ.get('ZEASYS_MYSQL_BIN', r'C:\xampp\mysql\bin'))
    config = ['--defaults-extra-file=' + str(opciones.resolve(strict=True))] if opciones else [
        '--host=' + os.environ.get('ZEASYS_DB_HOST', '127.0.0.1'),
        '--port=' + os.environ.get('ZEASYS_DB_PORT', '3306'),
        '--user=' + os.environ.get('ZEASYS_DB_USER', 'root')]
    entorno = os.environ.copy()
    if not opciones and entorno.get('ZEASYS_DB_PASS'):
        entorno['MYSQL_PWD'] = entorno['ZEASYS_DB_PASS']
    cliente = [str(binarios / 'mysql.exe'), *config, '--batch', '--skip-column-names', '--default-character-set=utf8mb4']
    def consulta(sql, db=None):
        cmd = cliente + (['--database=' + db] if db else []) + ['--execute=' + sql]
        return subprocess.check_output(cmd, env=entorno, stderr=subprocess.PIPE, text=True, encoding='utf8').strip()
    identificador = uuid.uuid4().hex
    fecha = datetime.now(timezone.utc)
    with tempfile.TemporaryDirectory(dir=destino) as temporal:
        ruta = Path(temporal)
        copia = ruta / 'base.sql'
        with copia.open('wb') as archivo:
            subprocess.run([str(binarios / 'mysqldump.exe'), *config, '--single-transaction',
                            '--quick', '--hex-blob', '--routines', '--triggers', '--default-character-set=utf8mb4', base],
                           env=entorno, stdout=archivo, stderr=subprocess.PIPE, check=True)
        salida = ruta / 'entrega'
        salida.mkdir()
        comprimido = salida / 'base.sql.gz'
        with copia.open('rb') as original, gzip.open(comprimido, 'wb') as reducido:
            shutil.copyfileobj(original, reducido)
        tablas = None
        if verificar:
            ensayo = 'zeasys_restore_' + identificador
            consulta('CREATE DATABASE ' + ensayo + ' CHARACTER SET utf8mb4')
            try:
                # Se restaura exactamente la entrega comprimida. La base efímera se creó en este proceso.
                with gzip.open(comprimido, 'rb') as datos, tempfile.TemporaryFile() as descomprimido:
                    shutil.copyfileobj(datos, descomprimido)
                    descomprimido.seek(0)
                    subprocess.run([*cliente, '--database=' + ensayo], env=entorno, stdin=descomprimido,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
                nombres = consulta("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'", ensayo).splitlines()
                if not nombres:
                    raise RuntimeError('El ensayo restauró cero tablas.')
                for nombre in nombres:
                    tabla = '`' + nombre.replace('`', '``') + '`'
                    if not consulta('CHECK TABLE ' + tabla, ensayo).endswith('\tstatus\tOK'):
                        raise RuntimeError('Falló la integridad de una tabla restaurada.')
                tablas = len(nombres)
            finally:
                consulta('DROP DATABASE ' + ensayo)
        (salida / 'manifest.json').write_text(json.dumps({'fecha_utc': fecha.isoformat(),
            'base': base, 'sha256': digest(comprimido), 'tablas_restauradas_verificadas': tablas}, indent=2), encoding='utf-8')
        final = destino / ('base-' + fecha.strftime('%Y%m%dT%H%M%SZ') + '-' + identificador[:8])
        salida.rename(final)
        return final


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destino', type=Path)
    parser.add_argument('--probar-restauracion', action='store_true')
    parser.add_argument('--mysql-defaults', type=Path)
    args = parser.parse_args()
    print(ejecutar(args.destino, args.probar_restauracion, args.mysql_defaults))
