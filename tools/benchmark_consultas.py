import json, os, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1];php=os.environ.get('ZEASYS_TEST_PHP',r'C:\xampp\php\php.exe');helper=root/'backend-api/tests/integracion/entorno.php'
identity=json.loads(subprocess.check_output([php,str(helper),'crear'],cwd=root))
try:
 env=os.environ.copy();env['ZEASYS_TEST_DB']=identity['db'];env['ZEASYS_TEST_TOKEN']=identity['token']
 subprocess.run([php,str(root/'tools/benchmark_consultas.php')],cwd=root,env=env,check=True)
finally:
 subprocess.run([php,str(helper),'eliminar',identity['db'],identity['token']],cwd=root,check=True,stdout=subprocess.DEVNULL)
