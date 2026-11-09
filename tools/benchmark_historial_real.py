"""Carga y consulta el repositorio real con 20.000 filas ficticias, usando una base propia que se elimina."""
import json
import os
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
PHP=r'C:\xampp\php\php.exe'
helper=ROOT/'backend-api/tests/integracion/entorno.php'
identity=json.loads(subprocess.check_output([PHP,str(helper),'crear'],cwd=ROOT))
try:
    env={**os.environ,'ZEASYS_TEST_DB':identity['db'],'ZEASYS_TEST_TOKEN':identity['token']}
    subprocess.run([PHP,str(ROOT/'tools/benchmark_historial_real.php')],cwd=ROOT,env=env,check=True)
finally:
    subprocess.run([PHP,str(helper),'eliminar',identity['db'],identity['token']],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
