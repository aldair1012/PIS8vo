"""Comprueba la ruta real de ServicioDatosTerreno con proveedores HTTP locales."""
import json
import os
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


class Proveedor(BaseHTTPRequestHandler):
    # El archivo meteorológico y las cinco capas SoilGrids deben llegar juntos.
    barrera = threading.Barrier(6)
    peticiones = []
    valores = {"clay": 200, "silt": 300, "sand": 500, "phh2o": 62, "soc": 250}

    def do_GET(self):
        url = urlsplit(self.path)
        self.peticiones.append(url.path)
        try:
            self.barrera.wait(timeout=3)
        except threading.BrokenBarrierError:
            self.send_error(503)
            return
        if url.path == "/clima":
            data = {"daily": {"temperature_2m_mean": [23]}}
        else:
            capa = parse_qs(url.query)["LAYERS"][0].split("_")[0]
            data = {"features": [{"properties": {"pixel_value": self.valores[capa]}}]}
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


PHP = r"""<?php
require 'backend-api/src/Kernel/AutoloaderPsr4.php';
ZeaSys\Kernel\AutoloaderPsr4::registrar('backend-api/src');
use ZeaSys\Dominios\Terreno\Aplicacion\ServicioDatosTerreno;
use ZeaSys\Dominios\Terreno\Infraestructura\{TransferenciasHttp,CacheArchivos,ProveedorOpenMeteo,ProveedorSoilGrids};
use ZeaSys\Dominios\Terreno\Dominio\AltitudPorCultivoInterface;
$http = new TransferenciasHttp();
$cache = new CacheArchivos(getenv('CACHE_PRUEBA'));
$url = getenv('URL_PRUEBA');
$servicio = new ServicioDatosTerreno($cache, new ProveedorOpenMeteo($cache,$http,$url.'/clima'),
    new ProveedorSoilGrids($http,$url.'/suelo'), new class implements AltitudPorCultivoInterface {
        public function altitudPorCoordenadas(float $latitud,float $longitud): ?float { return null; }
    }, http: $http);
$primero = $servicio->obtener(-2,-80,15);
$segundo = $servicio->obtener(-2,-80,15);
echo json_encode([$primero,$segundo],JSON_THROW_ON_ERROR);
"""


if __name__ == "__main__":
    php = os.environ.get("PHP_BIN") or shutil.which("php") or "C:/xampp/php/php.exe"
    root = Path(__file__).resolve().parents[3]
    with ThreadingHTTPServer(("127.0.0.1", 0), Proveedor) as server, tempfile.TemporaryDirectory() as cache:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            result = subprocess.run([php], input=PHP, text=True, capture_output=True, check=True,
                                    cwd=root, timeout=15, env={**os.environ, "CACHE_PRUEBA": cache,
                                    "URL_PRUEBA": f"http://127.0.0.1:{server.server_port}"})
        finally:
            server.shutdown()
    cold, cached = json.loads(result.stdout)
    assert cold["clima_disponible_api"] and cold["clima"]["temperatura"] == 23
    assert cold["suelo_disponible_api"] and cold["suelo"]["ph"] == 6.2
    assert cached["frescura"] == cold["frescura"]
    assert Proveedor.peticiones.count("/clima") == 1 and Proveedor.peticiones.count("/suelo") == 5
    print("OK: seis transferencias simultáneas y cero peticiones adicionales al repetir.")
