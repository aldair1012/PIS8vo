"""Comprueba Gemini SSE → cURL → PHP → HTTP con un proveedor y una cuenta ficticios en loopback."""
import json
import os
from http.cookiejar import CookieJar
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPCookieProcessor, Request

ROOT = Path(__file__).resolve().parents[3]
PHP = os.getenv("ZEASYS_TEST_PHP", r"C:\xampp\php\php.exe")
router = r'''<?php
namespace ZeaSys\Dominios\Chat\Infraestructura {
    function curl_init($url) {
        if (!str_ends_with($url, ':streamGenerateContent?alt=sse')) throw new \Exception('Ruta inesperada');
        return \curl_init(getenv('MOCK_URL'));
    }
}
namespace {
    require getcwd().'/backend-api/src/Kernel/AutoloaderPsr4.php';
    ZeaSys\Kernel\AutoloaderPsr4::registrar(getcwd().'/backend-api/src');
    ZeaSys\Kernel\Errores\ManejadorErrores::registrar();
    session_start();
    $_SESSION['usuario_id'] = 17;
    if ($_SERVER['REQUEST_URI'] === '/memoria') { echo json_encode($_SESSION['chat']['historial'] ?? []); return; }
    $ref = new ReflectionClass(ZeaSys\Dominios\Chat\Aplicacion\ChatService::class);
    $servicio = $ref->newInstanceWithoutConstructor();
    $ref->getProperty('memoria')->setValue($servicio, new ZeaSys\Dominios\Chat\Infraestructura\MemoriaSesion());
    $ref->getProperty('flujoIa')->setValue($servicio, new ZeaSys\Dominios\Chat\Infraestructura\GeminiFlowise());
    $db = new PDO('sqlite:' . sys_get_temp_dir() . '/test.sqlite');
    $db->exec('CREATE TABLE IF NOT EXISTS consentimiento_asistente (id INTEGER PRIMARY KEY, usuario_id INT, version_aviso TEXT, autorizado INT, registrado_en TEXT DEFAULT CURRENT_TIMESTAMP)');
    $controller = new ZeaSys\Dominios\Chat\Http\ChatController($servicio, new ZeaSys\Dominios\Chat\Infraestructura\ConsentimientoAsistente($db));
    $peticion = ZeaSys\Kernel\Peticion::desdeGlobal();
    if ($_SERVER['REQUEST_URI'] === '/consentimiento') $controller->consentimiento($peticion);
    else $controller->preguntar($peticion);
}
'''


def main():
    liberar = threading.Event()
    llamadas = []

    class Gemini(BaseHTTPRequestHandler):
        def do_POST(self):
            payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            llamadas.append(payload)
            pregunta = payload["contents"][-1]["parts"][0]["text"]
            if "cuota externa" in pregunta or ("busca con respaldo" in pregunta and "tools" in payload):
                self.send_error(429)
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()

            def emitir(candidate):
                self.wfile.write(("data: " + json.dumps({"candidates": [candidate]}) + "\r\n\r\n").encode())
                self.wfile.flush()

            emitir({"content": {"parts": [{"text": "Texto agrícola "}]}})
            if len(llamadas) == 1:
                assert liberar.wait(6), "PHP retuvo el primer fragmento hasta el final"
            if "corte simulado" in pregunta:
                return
            emitir({"content": {"parts": [{"text": "ficticio."}]}, "finishReason": "STOP",
                    "groundingMetadata": {"webSearchQueries": ["ejemplo"], "groundingChunks": [
                        {"web": {"uri": "https://example.org/prueba", "title": "Fuente ficticia"}}]}})

        def log_message(self, *_args):
            pass

    upstream = ThreadingHTTPServer(("127.0.0.1", 0), Gemini)
    worker = threading.Thread(target=upstream.serve_forever, daemon=True)
    worker.start()
    try:
        with tempfile.TemporaryDirectory() as directory:
            script = Path(directory) / "router.php"
            script.write_text(router, encoding="utf-8")
            with socket.socket() as port:
                port.bind(("127.0.0.1", 0))
                host = f"127.0.0.1:{port.getsockname()[1]}"
            env = dict(os.environ, ZEASYS_GEMINI_API_KEY="ficticia", ZEASYS_CHAT_PROVEEDOR="gemini",
                       ZEASYS_CHAT_LIMITE_MINUTO="7", ZEASYS_CHAT_LIMITE_DIARIO="10", MOCK_URL=f"http://127.0.0.1:{upstream.server_port}")
            process = subprocess.Popen([PHP, "-d", f"sys_temp_dir={directory}", "-d", f"session.save_path={directory}",
                                        "-S", host, str(script)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                client = build_opener(HTTPCookieProcessor(CookieJar()))

                def preguntar(pregunta, stream=True):
                    return client.open(Request("http://" + host + "/", data=json.dumps({"pregunta": pregunta, "modo_simple": True}).encode(),
                                               headers={"Content-Type": "application/json", "Accept": "text/event-stream" if stream else "application/json"}), timeout=8)

                def memoria():
                    with client.open("http://" + host + "/memoria", timeout=2) as response:
                        return json.load(response)

                def decidir(permiso, version):
                    with client.open(Request("http://" + host + "/consentimiento", data=json.dumps({"autorizado": permiso, "version": version}).encode(),
                                             headers={"Content-Type": "application/json"}), timeout=2) as response:
                        return json.load(response)

                for _ in range(80):
                    try:
                        memoria()
                        break
                    except OSError:
                        time.sleep(.04)
                try:
                    preguntar("Todavía sin permiso")
                    raise AssertionError("Faltó verificar el permiso de una cuenta existente")
                except HTTPError as error:
                    assert error.code == 428 and not llamadas
                    version = json.load(error)["version"]
                assert decidir(True, version)["autorizado"]
                with preguntar("Consulta actual ficticia") as response:
                    assert response.headers.get_content_type() == "text/event-stream"
                    assert response.readline().strip() == b"event: delta"
                    assert json.loads(response.readline()[6:])["texto"] == "Texto agrícola "
                    liberar.set()
                    tail = response.read().decode()
                    final = json.loads(tail.split("event: final\ndata: ")[1])
                    assert final["texto"] == "Texto agrícola ficticio."
                    assert final["fuente_datos"]["fuentes_web"][0]["url"] == "https://example.org/prueba"
                assert len(memoria()) == 2
                with preguntar("corte simulado") as response:
                    assert b"event: error" in response.read()
                assert len(memoria()) == 2
                assert llamadas[1]["contents"][1]["role"] == "model"
                assert "Modo simple" in llamadas[0]["systemInstruction"]["parts"][0]["text"]
                for cached in [False, True]:
                    with preguntar("¿Qué es el pH del suelo?", False) as response:
                        assert json.load(response)["fuente_datos"]["cache"] is cached
                assert len(llamadas) == 3 and len(llamadas[2]["contents"]) == 1
                for pregunta, cached in [("Precio de maíz en Manabí", False), ("Consulta el precio del maíz en Manabí", True)]:
                    with preguntar(pregunta, False) as response:
                        assert json.load(response)["fuente_datos"]["cache"] is cached
                assert len(llamadas) == 4 and len(llamadas[-1]["contents"]) == 1
                with preguntar("busca con respaldo", False) as response:
                    assert json.load(response)["fuente_datos"]["busqueda_no_disponible"]
                assert "tools" not in llamadas[-1]
                for _ in range(3):
                    try:
                        preguntar("cuota externa")
                        raise AssertionError("Se esperaba 429")
                    except HTTPError as error:
                        assert error.code == 429
                assert len(llamadas) == 8  # el último 429 proviene del límite local.
                assert len(memoria()) == 12
                assert not decidir(False, version)["autorizado"] and not memoria()
                try:
                    preguntar("Consulta después de retirar")
                    raise AssertionError("Se omitió la revocación")
                except HTTPError as error:
                    assert error.code == 428 and len(llamadas) == 8
                print("OK: primer delta antes del fin, sesión y fuentes, corte sin memoria, JSON, caché por tema y región, respaldo, 429, consentimiento y retiro.")
            finally:
                liberar.set()
                process.terminate()
                _, logs = process.communicate(timeout=5)
                assert b"PHP Warning" not in logs and b"Fatal error" not in logs, logs
    finally:
        upstream.shutdown()
        upstream.server_close()


if __name__ == "__main__":
    main()
