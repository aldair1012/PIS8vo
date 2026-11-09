"""Mide bloqueos de sesión con procesos PHP independientes y archivos exclusivos de prueba."""
import json
from pathlib import Path
import secrets
import subprocess
import tempfile
import time

ROOT=Path(__file__).resolve().parents[3]
PHP=r'C:\xampp\php\php.exe'
CODE=r'''<?php
require 'backend-api/src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar('backend-api/src');
session_save_path($argv[1]); session_id($argv[2]); session_start();
$mode=$argv[3];
if($mode==='init') { $_SESSION=['usuario_id'=>77]; session_write_close(); exit; }
if($mode==='read' || $mode==='clear' || $mode==='logout') {
    $start=microtime(true);
    if($mode==='clear') (new ZeaSys\Dominios\Chat\Infraestructura\MemoriaSesion())->limpiar();
    if($mode==='logout') { $_SESSION=[]; session_destroy(); }
    else { $_SESSION['preferencia_prueba']='conservada'; session_write_close(); }
    echo json_encode(['seconds'=>microtime(true)-$start]); exit;
}
if($mode==='inspect') { echo json_encode($_SESSION); session_write_close(); exit; }
$work=function() use($argv) { file_put_contents($argv[4],'ready'); usleep(1600000); $_SESSION['chat']['historial'][]=['rol'=>'asistente','texto'=>'respuesta ficticia']; return 'ok'; };
try {
    $value=$mode==='old' ? $work() : ZeaSys\Kernel\SesionSinBloqueo::ejecutar($work,'chat');
    if(session_status()===PHP_SESSION_ACTIVE) session_write_close();
    echo json_encode(['result'=>$value]);
} catch(Throwable $e) { echo json_encode(['error'=>get_class($e)]); }
'''


def main():
    reports=[]
    with tempfile.TemporaryDirectory(prefix='zeasys-sesiones-') as tmp:
        folder=Path(tmp); script=folder/'sesion.php'; script.write_text(CODE,encoding='utf-8')
        def call(sid,mode):
            raw=subprocess.check_output([PHP,str(script),str(folder),sid,mode],cwd=ROOT)
            return json.loads(raw) if raw.strip() else {}
        for mode,action in [('old','read'),('new','read'),('new','clear'),('new','logout')]:
            sid=secrets.token_hex(16); call(sid,'init'); marker=folder/('ready-'+sid)
            process=subprocess.Popen([PHP,str(script),str(folder),sid,mode,str(marker)],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            try:
                for _ in range(100):
                    if marker.exists(): break
                    time.sleep(.01)
                else: raise RuntimeError('La operación larga no arrancó.')
                start=time.monotonic(); call(sid,action); elapsed=time.monotonic()-start
                output,error=process.communicate(timeout=6)
                if process.returncode or error: raise RuntimeError(error.decode())
                long=json.loads(output)
                if mode=='new' and action=='read':
                    state=call(sid,'inspect'); assert state['preferencia_prueba']=='conservada' and len(state['chat']['historial'])==1
                    assert elapsed<1.2
                elif action=='clear':
                    assert long.get('error','').endswith('ConflictoException')
                    assert call(sid,'inspect')['chat']['historial']==[]
                elif action=='logout': assert long.get('error','').endswith('NoAutorizadoException')
                else: assert elapsed>1.2
                reports.append({'mode':mode,'parallel_action':action,'parallel_seconds':round(elapsed,4),'result':long})
            finally:
                if process.poll() is None: process.terminate(); process.wait(timeout=5)
    print(json.dumps({'cases':reports,'note':'Procesos PHP y sesiones ficticias; mide el componente de sesión, no capacidad HTTP del servidor.'},ensure_ascii=False,indent=2))


if __name__=='__main__': main()
