"""Prueba la ruta directa y su respaldo con servicios falsos en localhost."""
import json
import os
from pathlib import Path
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[3]
PHP = os.environ.get('ZEASYS_TEST_PHP', r'C:\xampp\php\php.exe')
COUNT = 0

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        global COUNT
        COUNT += 1
        body = json.dumps({'sourceDocuments': [{'pageContent': 'Texto de respaldo', 'metadata': {'source_file': 'inec-espac-resultados-2025.pdf', 'page': 4}}]}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *_args):
        pass

PHP_CODE = r'''<?php
require 'backend-api/src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar('backend-api/src');
define('FLOWISE_URL', getenv('TEST_FLOWISE_URL'));
define('FLOWISE_DOCUMENTAL_ID', 'flujo-ficticio');
define('FLOWISE_API_KEY', '');
if (getenv('TEST_MODO') === 'unset') putenv('ZEASYS_BUSQUEDA_DIRECTA');
else putenv('ZEASYS_BUSQUEDA_DIRECTA=' . getenv('TEST_MODO')); 
$paso = 0;
$transporte = function ($url, $body) use (&$paso) {
  $paso++;
  if (getenv('TEST_FALLA_DIRECTA') === '1') return null;
  if ($paso === 1) return [['name'=>'zeasys_cinco_pdf_v1','id'=>'12345678-1234-1234-1234-123456789abc']];
  if ($paso === 2) return ['embeddings'=>[array_fill(0,384,0.1)]];
  return ['documents'=>[['Texto directo']], 'metadatas'=>[[['source_file'=>'inec-espac-resultados-2025.pdf','page'=>3]]]];
};
$gemini = new ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise(new ZeaSys\Dominios\Chat\Infraestructura\RecuperadorChroma($transporte, []));
$metodo = new ReflectionMethod($gemini, 'recuperarDocumentos');
echo json_encode($metodo->invoke($gemini, 'Una pregunta suficientemente larga', 'ambito-ficticio'), JSON_THROW_ON_ERROR);
'''

def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        env = os.environ.copy()
        env['TEST_FLOWISE_URL'] = f'http://127.0.0.1:{server.server_port}'
        for mode, failure, expected_text, expected_calls in [('1', '0', 'Texto directo', 0), ('1', '1', 'Texto de respaldo', 1), ('0', '0', 'Texto de respaldo', 2), ('unset', '0', 'Texto directo', 2)]:
            env['TEST_FALLA_DIRECTA'] = failure
            env['TEST_MODO'] = mode
            result = subprocess.run([PHP], input=PHP_CODE, text=True, encoding='utf-8', cwd=ROOT, env=env, capture_output=True, check=True)
            docs = json.loads(result.stdout)
            assert docs[0]['texto'] == expected_text, docs
            assert COUNT == expected_calls, COUNT
        print('OK: ruta directa y retorno al flujo de respaldo con servicios simulados')
    finally:
        server.shutdown()
        server.server_close()

if __name__ == '__main__':
    main()
