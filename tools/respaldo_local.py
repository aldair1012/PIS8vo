"""Respaldo privado y preparación de recuperación en una carpeta nueva, sin reemplazar la instalación."""
from __future__ import annotations
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import socket
import sqlite3
import stat
import subprocess
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
LOCAL = Path(os.environ.get('LOCALAPPDATA', ''))


def is_link(path):
    # Incluye junctions de Windows en Python 3.11, sin seguir el destino.
    return path.is_symlink() or bool(getattr(path.lstat(), 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0))


def port_open(port):
    with socket.socket() as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(('127.0.0.1', port)) == 0


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def private_destination(destination):
    destination = destination.expanduser().resolve()
    # Las copias contienen claves y datos personales; nunca servirlas por Apache.
    webroot = ROOT.parent.resolve()
    protected = [webroot, LOCAL / 'ZeaSys-Flowise-Local', LOCAL / 'ZeaSys-Chroma']
    if any(destination == item.resolve() or item.resolve() in destination.parents for item in protected):
        raise ValueError('El destino debe estar fuera del directorio web y de los servicios activos.')
    return destination


def write_manifest(directory):
    manifest = {}
    for file in directory.rglob('*'):
        if is_link(file):
            raise ValueError('No se admiten enlaces en el respaldo.')
        if file.is_file() and file != directory / 'manifest.json':
            manifest[file.relative_to(directory).as_posix()] = digest(file)
    (directory / 'manifest.json').write_text(json.dumps({
        'version': 2, 'creado': datetime.now().astimezone().isoformat(),
        'archivos_sha256': manifest,
    }, ensure_ascii=False, indent=2), encoding='utf-8')


def backup(destination, mysql_defaults):
    # Chroma tiene varios archivos que deben corresponder al mismo momento.
    if port_open(8000) or port_open(3000):
        raise RuntimeError('Detén Chroma y Flowise antes de copiar sus datos y vuelve a intentarlo.')
    destination = private_destination(destination)
    destination.mkdir(parents=True, exist_ok=True)
    directory = destination / ('zeasys-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    directory.mkdir()
    mysql = Path(r'C:\xampp\mysql\bin\mysqldump.exe')
    if not mysql.is_file():
        raise RuntimeError('No se encontró mysqldump de XAMPP.')
    cmd = [str(mysql)]
    if mysql_defaults:
        cmd.append('--defaults-extra-file=' + str(mysql_defaults.resolve()))
    else:
        cmd += ['--host=' + os.environ.get('ZEASYS_DB_HOST', '127.0.0.1'),
                '--port=' + os.environ.get('ZEASYS_DB_PORT', '3306'),
                '--user=' + os.environ.get('ZEASYS_DB_USER', 'root')]
    database = os.environ.get('ZEASYS_DB_NAME', 'agropredict_db')
    cmd += ['--single-transaction', '--routines', '--triggers', '--default-character-set=utf8mb4', database]
    with (directory / 'base.sql').open('wb') as output:
        process_env = os.environ.copy()
        if not mysql_defaults and os.environ.get('ZEASYS_DB_PASS'):
            process_env['MYSQL_PWD'] = os.environ['ZEASYS_DB_PASS']
        completed = subprocess.run(cmd, stdout=output, stderr=subprocess.PIPE, check=False, env=process_env)
    if completed.returncode:
        raise RuntimeError('No se pudo exportar MySQL. Comprueba el servicio y sus credenciales; la carpeta parcial no es un respaldo completo.')
    flowise = LOCAL / 'ZeaSys-Flowise-Local'
    source_db = flowise / 'data' / 'database.sqlite'
    if not source_db.is_file():
        raise RuntimeError('No se encontró la base de Flowise; el respaldo está incompleto.')
    with closing(sqlite3.connect(source_db.as_uri() + '?mode=ro', uri=True)) as source, closing(sqlite3.connect(directory / 'flowise.sqlite')) as target:
        source.backup(target)
        if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('La copia SQLite no superó la comprobación de integridad.')
    for required in [flowise / 'secrets', LOCAL / 'ZeaSys-Chroma' / 'data']:
        if not required.is_dir():
            raise RuntimeError('Falta una carpeta esencial del asistente; el respaldo está incompleto: ' + str(required))
    for name, source in [('flowise-secrets', flowise / 'secrets'), ('flowise-storage', flowise / 'storage'),
                         ('chroma', LOCAL / 'ZeaSys-Chroma' / 'data'), ('uploads', ROOT / 'backend-api' / 'public' / 'uploads'),
                         ('pdf', ROOT / 'rag-sources')]:
        if source.is_dir():
            if destination == source.resolve() or source.resolve() in destination.parents:
                raise RuntimeError('El destino no puede estar dentro de una carpeta de origen.')
            if is_link(source) or any(is_link(file) for file in source.rglob('*')):
                raise ValueError('No se admiten enlaces en las carpetas de origen.')
            shutil.copytree(source, directory / name)
    config = directory / 'configuracion'
    config.mkdir()
    for relative in ('.htaccess', '.env', 'backend-api/.env', 'ml-engine/.env'):
        source = ROOT / relative
        if source.is_file():
            if is_link(source):
                raise ValueError('La configuración no puede ser un enlace.')
            target = config / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    # Solo variables de la aplicación heredadas por este proceso, nunca todo el entorno.
    runtime = {key: value for key, value in os.environ.items() if key.startswith('ZEASYS_')}
    (config / 'entorno-zeasys.json').write_text(json.dumps(runtime, ensure_ascii=False, indent=2), encoding='utf-8')
    write_manifest(directory)
    verify(directory)
    return directory


def verify(directory):
    if is_link(directory):
        raise ValueError('La carpeta de respaldo no puede ser un enlace.')
    directory = directory.resolve()
    if is_link(directory / 'manifest.json'):
        raise ValueError('El manifiesto no puede ser un enlace.')
    metadata = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    manifest = metadata.get('archivos_sha256') if isinstance(metadata, dict) else None
    if not isinstance(manifest, dict) or not {'base.sql', 'flowise.sqlite'}.issubset(manifest):
        raise ValueError('Manifiesto vacío o incompleto')
    for name, expected in manifest.items():
        if (not isinstance(name, str) or '\\' in name or ':' in name
                or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts
                or name != PurePosixPath(name).as_posix() or name == 'manifest.json'
                or not isinstance(expected, str) or re.fullmatch('[a-f0-9]{64}', expected) is None):
            raise ValueError('Entrada inválida en el manifiesto.')
        target = (directory / name).resolve()
        if directory not in target.parents or not target.is_file() or digest(target) != expected:
            raise ValueError('Archivo faltante o alterado: ' + str(name))
    actual = set()
    for file in directory.rglob('*'):
        if is_link(file):
            raise ValueError('No se admiten enlaces en el respaldo.')
        if file.is_file() and file != directory / 'manifest.json':
            actual.add(file.relative_to(directory).as_posix())
    if actual != set(manifest):
        raise ValueError('El respaldo contiene archivos no declarados en el manifiesto.')
    with closing(sqlite3.connect((directory / 'flowise.sqlite').as_uri() + '?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Copia SQLite inválida')
    return len(manifest)


def prepare_restore(directory, destination):
    """Prepara archivos verificados. No ejecuta SQL ni sobreescribe servicios o cuentas."""
    verify(directory)
    directory = directory.resolve()
    destination = private_destination(destination)
    if destination == directory or directory in destination.parents:
        raise ValueError('El destino no puede estar dentro de la copia de origen.')
    # copytree exige destino inexistente; no acepta una carpeta vacía ya existente.
    shutil.copytree(directory, destination)
    verify(destination)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    create = sub.add_parser('crear')
    create.add_argument('destino', type=Path)
    create.add_argument('--mysql-defaults', type=Path, help='archivo privado de opciones del cliente MySQL')
    check = sub.add_parser('verificar')
    check.add_argument('carpeta', type=Path)
    restore = sub.add_parser('preparar-restauracion', help='Verifica y copia a un destino privado inexistente; no importa SQL')
    restore.add_argument('carpeta', type=Path)
    restore.add_argument('destino', type=Path)
    args = parser.parse_args()
    try:
        if args.action == 'crear':
            result = backup(args.destino, args.mysql_defaults)
            print('Respaldo creado y huellas guardadas:', result)
            print('Archivos verificados:', verify(result))
        elif args.action == 'verificar':
            print('Archivos verificados:', verify(args.carpeta))
        else:
            print('Recuperación preparada en:', prepare_restore(args.carpeta, args.destino))
            print('No se modificaron bases, cuentas ni servicios. Sigue la guía de recuperación.')
    except (OSError, RuntimeError, ValueError, sqlite3.Error, json.JSONDecodeError) as exc:
        parser.exit(1, f'No se completó la operación: {exc}\n')

if __name__ == '__main__':
    main()
