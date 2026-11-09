"""Recorridos HTTP reales con MySQL desechable y el modelo entrenado local.

Uso: python backend-api/tests/integracion/ejecutar.py [--mantener]
Los proveedores externos se simulan caídos; no se usan cuentas o datos reales.
"""
import argparse
from contextlib import nullcontext
import http.cookiejar
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPCookieProcessor, ProxyHandler

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
PHP = os.environ.get("ZEASYS_TEST_PHP") or shutil.which("php") or r"C:\xampp\php\php.exe"


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Client:
    def __init__(self, origin):
        self.base = origin + "/backend-api/public/index.php/api/"
        self.cookies = http.cookiejar.CookieJar()
        self.opener = build_opener(ProxyHandler({}), HTTPCookieProcessor(self.cookies))

    def call(self, method, endpoint, data=None, expected=200):
        raw = json.dumps(data).encode() if data is not None else None
        req = Request(self.base + endpoint, raw, {"Content-Type": "application/json"}, method=method)
        try:
            res = self.opener.open(req, timeout=60)
        except HTTPError as error:
            res = error
        body = res.read().decode()
        assert res.code == expected, f"{method} {endpoint}: HTTP {res.code}, esperado {expected}: {body[:500]}"
        result = json.loads(body)
        assert isinstance(result, (dict, list)), f"Respuesta no estructurada: {endpoint}"
        return result


def wait_server(url, process):
    opener = build_opener(ProxyHandler({}))
    for _ in range(150):
        if process.poll() is not None:
            raise RuntimeError("El servidor de prueba terminó antes de estar disponible.")
        try:
            with opener.open(url, timeout=1):
                return
        except (URLError, TimeoutError):
            time.sleep(0.1)
    raise RuntimeError("El servidor de prueba no respondió a tiempo.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mantener", action="store_true", help="Mantener entorno hasta pulsar Enter para revisar el navegador")
    args = parser.parse_args()
    processes = []
    env = os.environ.copy()
    creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    identity = json.loads(subprocess.check_output([PHP, str(HERE / "entorno.php"), "crear"], cwd=ROOT, env=env))
    owned = [PHP, str(HERE / "entorno.php"), "eliminar", identity["db"], identity["token"]]
    checks = 0
    logs = tempfile.TemporaryDirectory(prefix="zeasys-integracion-")

    def checked(label):
        nonlocal checks
        checks += 1
        print(f"[OK] {label}", flush=True)

    try:
        with nullcontext(logs.name) as log_dir:
            api_port, ml_port = free_port(), free_port()
            origin = f"http://127.0.0.1:{api_port}"
            env.update({"ZEASYS_DB_NAME": identity["db"], "ZEASYS_IA_SERVER_URL": f"http://127.0.0.1:{ml_port}",
                        "ZEASYS_CACHE_DIR": str(Path(log_dir) / "cache"),
                        "ZEASYS_FLOWISE_URL": "http://127.0.0.1:1", "NO_PROXY": "127.0.0.1,localhost",
                        "HTTPS_PROXY": "http://127.0.0.1:1", "http_proxy": "http://127.0.0.1:1"})
            with open(Path(log_dir) / "ml.log", "w", encoding="utf-8") as ml_log, open(Path(log_dir) / "php.log", "w", encoding="utf-8") as php_log:
                ml = subprocess.Popen([sys.executable, str(HERE / "motor.py"), str(ml_port)], cwd=ROOT / "ml-engine", env=env, stdout=ml_log, stderr=subprocess.STDOUT, creationflags=creationflags)
                processes.append(ml)
                wait_server(f"http://127.0.0.1:{ml_port}/health", ml)
                api = subprocess.Popen([PHP, "-S", f"127.0.0.1:{api_port}", "-t", str(ROOT)], cwd=ROOT, env=env, stdout=php_log, stderr=subprocess.STDOUT, creationflags=creationflags)
                processes.append(api)
                wait_server(origin + "/backend-api/public/index.php/api/auth/me", api)
                a, b, visitor = Client(origin), Client(origin), Client(origin)
                visitor.call("GET", "cultivos", expected=401)
                checked("las rutas privadas exigen sesión")
                password = " ClavePrueba-2026! "
                a.call("POST", "auth/register", {"nombre": "Productor de prueba", "correo": "a@example.test", "contrasena": password, "confirmar_contrasena": password})
                assert a.call("GET", "auth/me")["authenticated"] is True
                checked("registro y sesión persistente con cookies")
                a.call("POST", "auth/logout")
                a.call("POST", "auth/login", {"correo": "a@example.test", "contrasena": password.strip()}, expected=401)
                a.call("POST", "auth/login", {"correo": "a@example.test", "contrasena": password})
                checked("contraseña nueva exacta, incluyendo espacios")
                b.call("POST", "auth/register", {"nombre": "Segundo productor", "correo": "b@example.test", "contrasena": "OtraClave-2026!", "confirmar_contrasena": "OtraClave-2026!"})
                invalid = {"nombre_parcela": ["inválido"], "area": 2, "latitud": -1, "longitud": -80}
                a.call("POST", "cultivos", invalid, expected=400)
                crop = a.call("POST", "cultivos", {"nombre_parcela": "Parcela de integración", "variedad_maiz": "INIAP H-551", "tipo_maiz": "Duro Amarillo", "ubicacion": "Manabí", "area": 2, "latitud": -1, "longitud": -80, "altitud": 45, "ph": 6.2, "fecha_siembra": "2024-06-01"})["cultivo"]
                crop_id = crop["id"]
                assert len(a.call("GET", "cultivos")) == 1
                a.call("PUT", "cultivos", {"id": crop_id, "nombre_parcela": "Parcela actualizada"})
                b.call("PUT", "cultivos", {"id": crop_id, "nombre_parcela": "Ajena"}, expected=403)
                b.call("DELETE", f"cultivos?id={crop_id}", expected=403)
                checked("crear/listar/editar parcelas y aislamiento entre usuarios")
                visitor.call("POST", "simulaciones/evaluar-variedades", {"cultivo_id": crop_id}, expected=401)
                b.call("POST", "simulaciones/evaluar-variedades", {"cultivo_id": crop_id}, expected=403)
                a.call("POST", "simulaciones/evaluar-variedades", {"cultivo_id": crop_id, "objetivo": "inexistente"}, expected=400)
                evaluation = a.call("POST", "simulaciones/evaluar-variedades", {"cultivo_id": crop_id, "ph_suelo": 6.2})["evaluacion"]
                assert evaluation["actual"]["id"] == "h551" and evaluation["materiales_catalogados"] == 14
                assert a.call("GET", "cultivos")[0]["variedad_maiz"] == "INIAP H-551"
                checked("catálogo de variedades con fuentes, permisos y parcela conservada")
                payload = {"cultivo_id": crop_id, "nombre": "Simulación real de integración", "modelo_usado": "xgboost", "temperatura": 24.5, "humedad": 70, "precipitacion": 700, "precipitacion_ciclo_mm": 700, "fertilizante": 150, "ph_suelo": 6.2, "tipo_suelo": "franco", "area_simulada": 2}
                a.call("PUT", "cultivos", {"id": crop_id, "variedad_maiz": "INIAP 101 Blanco Harinoso Precoz", "tipo_maiz": "Suave Harinoso", "ubicacion": "Comunidad sin provincia en el texto", "altitud": 2700, "latitud": -.18, "longitud": -78.47})
                soil_file = Path(log_dir) / 'cache' / 'precision_data_v6_-0.18_-78.47.json'
                soil_file.parent.mkdir(exist_ok=True)
                soil_file.write_text(json.dumps({'source':'Muestra ficticia de integración','suelo_campos_api':['clay','sand','silt','materia_organica'],'suelo':{'clay':29.4,'sand':40.4,'silt':30.1,'materia_organica':2.4}}),encoding='utf-8')
                field_data = {"ciclo_dias": 205, "densidad_plantas_ha": 50000, "lamina_riego_mm": 0, "riego_tipo": "temporal_lluvia", "semilla_certificada": 0, "fosforo_p2o5_kg_ha": 0}
                alias_result = a.call("POST", "simulaciones/simular", {**payload, "fecha_siembra": "2024-02-28", "parametros_campo": field_data, "usar_suelo_ubicacion":True})["resultado"]
                assert alias_result['trazabilidad']['suelo_ubicacion_utilizado'] is True
                assert alias_result['entradas_modelo']['textura_arcilla_pct'] == 29.4
                assert alias_result['trazabilidad']['provincia_identificada']['provincia'] == 'Pichincha'
                assert alias_result['entradas_modelo']['provincia'] == 'Pichincha'
                soil_file.unlink()
                assert alias_result["trazabilidad"]["contrato_campo"] == "1.0"
                assert alias_result["trazabilidad"]["calendario"]["fecha_fin_estimada"] == "2024-09-19"
                for key, value in field_data.items(): assert alias_result["entradas_modelo"][key] == value
                assert alias_result["entradas_modelo"]["variedad"] == "INIAP 101 Blanco Harinoso"
                assert alias_result["trazabilidad"]["variedad_simulada"]["registrada"] == "INIAP 101 Blanco Harinoso Precoz"
                saved_alias = a.call("GET", "simulaciones/historial")["simulaciones"][0]
                saved_details = json.loads(saved_alias["escenarios_json"])["_zeasys_modelo"]
                assert saved_details["evaluacion_variedades"]["actual"]["id"] == "i101"
                assert saved_details["parcela_ejecucion"]["variedad_maiz"] == "INIAP 101 Blanco Harinoso Precoz"
                assert saved_details["parcela_ejecucion"]["parametros_campo"]["lamina_riego_mm"] == 0
                assert saved_details["trazabilidad"]["calendario"]["ciclo_dias"] == 205
                a.call("DELETE", f"simulaciones/eliminar?id={alias_result['simulacion_id']}")
                for soil_code in ('franco_equilibrado','arcillo_limoso'):
                    soil_result=a.call('POST','simulaciones/simular',{**payload,'tipo_suelo':soil_code})['resultado']
                    saved_soil=a.call('GET','simulaciones/historial')['simulaciones'][0]
                    assert saved_soil['tipo_suelo']==soil_code
                    a.call('DELETE',f"simulaciones/eliminar?id={soil_result['simulacion_id']}")
                checked('las texturas nuevas se guardan y recuperan sin pérdida en MySQL')
                a.call("PUT", "cultivos", {"id": crop_id, "variedad_maiz": "INIAP 198 Canguil", "tipo_maiz": "Duro Amarillo / Blanco"})
                popcorn = a.call("POST", "simulaciones/evaluar-variedades", {"cultivo_id": crop_id, "objetivo": "canguil"})["evaluacion"]["actual"]
                assert popcorn["uso_documentado"] and popcorn["cosecha_orientativa_dias"] == 235
                a.call("POST", "simulaciones/simular", payload, expected=400)
                checked("canguil con ficha propia y bloqueo de una predicción incompatible")
                a.call("PUT", "cultivos", {"id": crop_id, "variedad_maiz": "INIAP H-551", "tipo_maiz": "Duro Amarillo", "ubicacion": "Manabí", "altitud": 45, "latitud":-1, "longitud":-80})
                checked("homologación de la misma variedad y conservación de su ficha en historial")
                b.call("POST", "simulaciones/simular", payload, expected=403)
                a.call("POST", "simulaciones/simular", {**payload, "area_simulada": 3}, expected=400)
                result = a.call("POST", "simulaciones/simular", payload)["resultado"]
                simulation_id = result["simulacion_id"]
                assert result["success"] is True and isinstance(result["rendimiento_estimado"], (int, float))
                assert result["trazabilidad"]["periodo_precipitacion"] == "mm/ciclo"
                assert result["trazabilidad"]["variedad_simulada"]["utilizada_por_modelo"] == "INIAP H-551"
                assert result["evaluacion_variedades"]["actual"]["id"] == "h551"
                checked("simulación HTTP con modelo real, ciclo explícito y persistencia MySQL")
                history = a.call("GET", "simulaciones/historial")
                assert history["simulaciones"][0]["id"] == simulation_id
                b.call("DELETE", f"simulaciones/eliminar?id={simulation_id}", expected=403)
                checked("historial persistido y autorización de eliminación")
                subprocess.run([PHP, str(HERE / "entorno.php"), "historial", identity["db"], identity["token"]], check=True, env=env, cwd=ROOT)
                page1 = a.call("GET", "simulaciones/historial?por_pagina=25&pagina=1")
                last = a.call("GET", "simulaciones/historial?por_pagina=25&pagina=6")
                assert page1["paginacion"]["total"] == 131 and len(page1["simulaciones"]) == 25
                assert len(last["simulaciones"]) == 6 and 2001 in page1["anios_disponibles"]
                assert set(row["id"] for row in page1["simulaciones"]).isdisjoint(row["id"] for row in last["simulaciones"])
                old = a.call("GET", "simulaciones/historial?anio=2001")
                assert len(old["simulaciones"]) == 1 and 2024 in old["anios_disponibles"]
                a.call("GET", "simulaciones/historial?pagina=-1", expected=400)
                a.call("GET", "simulaciones/historial?por_pagina=1000", expected=400)
                checked("historial de más de 100 registros, años completos, páginas sin duplicados y parámetros válidos")
                subprocess.run([PHP, str(HERE / "entorno.php"), "fronteras", identity["db"], identity["token"]], check=True, env=env, cwd=ROOT)
                before = a.call("GET", "simulaciones/historial?anio=2023")
                middle = a.call("GET", "simulaciones/historial?anio=2024")
                after = a.call("GET", "simulaciones/historial?anio=2025")
                assert before["paginacion"]["total"] == 1 and before["simulaciones"][0]["fecha"].startswith("2023-12-31")
                assert middle["paginacion"]["total"] == 131
                assert after["paginacion"]["total"] == 1 and after["simulaciones"][0]["fecha"].startswith("2025-01-01")
                checked("filtrado de simulaciones en los límites exactos entre años")
                a.call("POST", "yield/mediciones", {"cultivo_id": crop_id, "grano_seco_kg": 2, "biomasa_seca_kg": 5, "fecha_cosecha": "2024-12-01"})
                mediciones = a.call("POST", "yield/mediciones", {"cultivo_id": crop_id, "capacidad_campo_pct": 30, "marchitez_pct": 10, "profundidad_cm": 100, "fecha_suelo": "2024-12-01"})["mediciones"]
                assert mediciones["indicadores"]["indice_cosecha"]["valor"] == 0.4 and mediciones["indicadores"]["agua_medida"]["valor"] == 200
                b.call("POST", "yield/mediciones", {"cultivo_id": crop_id, "profundidad_cm": 80}, expected=403)
                assert a.call("GET", f"yield/mediciones/consulta?cultivo_id={crop_id}")["mediciones"]["datos"]["profundidad_cm"] == 100
                b.call("GET", f"yield/mediciones/consulta?cultivo_id={crop_id}", expected=403)
                visitor.call("GET", f"yield/mediciones/consulta?cultivo_id={crop_id}", expected=401)
                a.call("GET", "yield/mediciones/consulta", expected=400)
                checked("mediciones parciales conservan datos y protegen la parcela")
                for endpoint in ("yield", "financial", "scenarios", "climate"):
                    body = a.call("GET", f"{endpoint}?cultivo_id={crop_id}&anio=2024")
                    assert body, endpoint
                    b.call("GET", f"{endpoint}?cultivo_id={crop_id}&anio=2024", expected=403)
                    checked(f"dashboard {endpoint}: respuesta real y pertenencia de parcela")
                a.call("POST", "simulaciones/explain", {"nombre": "Rendimiento estimado", "valor": 0, "unidad": "t/ha", "cultivo_id": crop_id, "anio": 2002})
                b.call("POST", "simulaciones/explain", {"nombre": "Rendimiento", "cultivo_id": crop_id}, expected=403)
                checked("explicación HTTP y acceso restringido por parcela")
                favorite = {"conversacion_id": "integracion-local", "cultivo_id": crop_id, "anio": 2024, "vista": "yield", "mensajes": [{"rol": "usuario", "texto": "Pregunta de prueba"}, {"rol": "asistente", "texto": "Respuesta de prueba"}]}
                a.call("POST", "chat/favorito", favorite, expected=201)
                a.call("POST", "chat/favorito/eliminar", {"conversacion_id": "integracion-local"})
                a.call("POST", "chat/limpiar")
                checked("favoritos y limpieza de memoria sin proveedor externo")
                a.call("POST", "auth/update", {"nombre": "Productor actualizado"})
                checked("actualización de perfil")
                print(f"Integración: {checks} recorridos correctos. URL aislada: {origin}", flush=True)
                if args.mantener:
                    print("Entorno listo para navegador. Cuenta a@example.test; contraseña de prueba definida en el script. Enter limpia el entorno.", flush=True)
                    input()
                a.call("DELETE", f"simulaciones/eliminar?id={simulation_id}")
                a.call("DELETE", f"cultivos?id={crop_id}")
                a.call("POST", "auth/delete")
                assert a.call("GET", "auth/me")["authenticated"] is False
                b.call("POST", "auth/delete")
                checked("eliminación de simulación, parcela y cuentas ficticias")
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
        try:
            subprocess.run(owned, check=True, env=os.environ.copy(), cwd=ROOT)
        finally:
            logs.cleanup()


if __name__ == "__main__":
    main()
