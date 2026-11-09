"""Compara Flask con un prototipo FastAPI aislado; no inicia el servicio real ni modifica el modelo.

Requiere fastapi y uvicorn en el entorno de pruebas, además de dependencias del motor.
No incluye todos los extremos ni el middleware de producción, por lo que no habilita una migración.
"""
from __future__ import annotations
import json
import socket
import statistics
import sys
import threading
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, build_opener, ProxyHandler

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'ml-engine'))
import app as engine
from fastapi import FastAPI, Request as FastRequest
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
import uvicorn
from werkzeug.serving import make_server

engine.feature_builder.fetch_precision_soil = lambda *_args, **_kwargs: None
engine.feature_builder.fetch_precision_weather = lambda *_args, **_kwargs: None
candidate = FastAPI()


def compute(data):
    try:
        engine._validar_entrada(data)
        model = data.get('modelo', engine.predictor.model_metrics.get('modelo_principal', 'xgboost'))
        if not isinstance(model, str) or model.strip().lower() not in engine.predictor.MODELOS_DISPONIBLES:
            return {'error': 'Modelo no disponible', 'modelos_disponibles': engine.predictor.MODELOS_DISPONIBLES}, 400
        data['modelo'] = model.strip().lower()
        data['tipoSuelo'] = data['tipoSuelo'].strip().lower()
        features, metadata = engine.feature_builder.build_features(data)
        result = engine.predictor.predict(features, data['modelo'], float(data['area']))
        result['recomendaciones'] = engine.feature_builder.generar_recomendaciones(metadata['datos_entrada'], metadata['zona'])
        result['precision_data'] = metadata['precision_data']
        result['trazabilidad'] = metadata.get('trazabilidad', {})
        return result, 200
    except ValueError as exc:
        return {'error': str(exc)}, 400


@candidate.post('/predict')
async def predict(request: FastRequest):
    if 'application/json' not in request.headers.get('content-type', '').lower():
        return JSONResponse({'error': 'Content-Type debe ser application/json'}, status_code=415)
    try:
        body = await request.json()
    except ValueError:
        body = None
    data, status = await run_in_threadpool(compute, body)
    return JSONResponse(data, status_code=status)


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def request(port_number, data):
    req = Request(f'http://127.0.0.1:{port_number}/predict', json.dumps(data).encode(), {'Content-Type': 'application/json'})
    start = time.perf_counter()
    try:
        result = build_opener(ProxyHandler({})).open(req, timeout=30)
    except HTTPError as error:
        result = error
    with result:
        body = json.load(result)
        return result.status, body, (time.perf_counter() - start) * 1000


def main():
    flask_port, fastapi_port = port(), port()
    flask_server = make_server('127.0.0.1', flask_port, engine.app, threaded=True)
    threading.Thread(target=flask_server.serve_forever, daemon=True).start()
    server = uvicorn.Server(uvicorn.Config(candidate, host='127.0.0.1', port=fastapi_port, log_level='error', access_log=False))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        for _ in range(100):
            if server.started:
                break
            time.sleep(.1)
        if not server.started:
            raise RuntimeError('El prototipo FastAPI no inició')
        base = {'temperatura': 24.5, 'humedad': 70, 'precipitacion': 800, 'fertilizante': 150, 'phSuelo': 6.2, 'area': 2.5, 'tipoSuelo': 'franco'}
        cases = [base, {**base, 'area': True}, {**base, 'humedad': 101}, {'temperatura': 24}, {**base, 'modelo': 'inexistente'}]
        for case in cases:
            a, b = request(flask_port, case), request(fastapi_port, case)
            if a[:2] != b[:2]:
                raise RuntimeError('Los contratos difieren en una petición; no se debe migrar automáticamente.')
        results = {'flask_ms': [], 'fastapi_ms': []}
        for iteration in range(30):
            order = [('flask_ms', flask_port), ('fastapi_ms', fastapi_port)]
            if iteration % 2:
                order.reverse()
            for name, number in order:
                status, _, elapsed = request(number, base)
                if status != 200: raise RuntimeError(f'{name}: estado {status}')
                results[name].append(elapsed)
        report = {'casos_equivalentes': len(cases), 'muestras_por_servidor': len(results['flask_ms']),
                  'mediana_flask_ms': round(statistics.median(results['flask_ms']), 2),
                  'mediana_fastapi_ms': round(statistics.median(results['fastapi_ms']), 2),
                  'limites': 'Prototipo parcial; proveedores externos simulados caídos, peticiones secuenciales locales y misma máquina. No evalúa el resto de rutas, concurrencia, seguridad ni la exactitud agrícola.'}
        print('RESULTADO ' + json.dumps(report, ensure_ascii=True), flush=True)
    finally:
        flask_server.shutdown()
        server.should_exit = True
        thread.join(timeout=10)

if __name__ == '__main__': main()
