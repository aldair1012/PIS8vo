import base64
import csv
import io
import json
from urllib.request import Request


def probar_campanas(a, b, visitor, parcela, recientes):
    ruta = 'rendimiento/campanas'
    consulta = f'{ruta}?parcela_id={parcela}'
    assert a.call('GET', consulta) == {'observaciones': [], 'cosechas': [], 'metricas': []}
    visitor.call('GET', consulta, expected=401)
    b.call('GET', consulta, expected=403)
    anterior = next(s for s in recientes if s['fecha'].startswith('2024-06-01'))
    datos = {'parcela_id': parcela, 'simulacion_id': anterior['id'], 'fecha_siembra': '2024-06-01',
             'fecha_cosecha': '2024-12-01', 'produccion_seca_kg': 0, 'area_cosechada_ha': 2,
             'humedad_grano_pct': 14, 'fuente': 'Comprobante de prueba', 'base_comparable': True,
             'rendimiento_t_ha': 999, 'version_modelo': 'valor cliente ignorado'}
    for override in [{'fecha_cosecha': '2024-06-01'}, {'fecha_siembra': '2024-06-02'}, {'area_cosechada_ha': 0},
                     {'area_cosechada_ha': 1}, {'fuente': ''}, {'simulacion_id': 987654321}]:
        a.call('POST', ruta + '/cosecha', {**datos, **override}, expected=400)
    b.call('POST', ruta + '/cosecha', datos, expected=403)
    a.call('POST', ruta + '/cosecha', datos)
    a.call('POST', ruta + '/cosecha', datos, expected=400)
    a.call('POST', ruta + '/cosecha', {**datos, 'fecha_siembra': '2023-06-01', 'fecha_cosecha': '2023-11-01',
                                         'simulacion_id': '', 'base_comparable': False})
    historia = a.call('GET', consulta)
    assert len(historia['cosechas']) == 2 and historia['cosechas'][0]['observado_t_ha'] == 0
    pred = historia['cosechas'][0]['prediccion']
    assert pred['id'] == anterior['id'] and pred['rendimiento_t_ha'] == float(anterior['rendimiento_estimado'])
    assert pred['version_modelo'] == json.loads(anterior['escenarios_json'])['_zeasys_modelo']['version_modelo']
    medida = historia['metricas'][0]
    assert medida['n'] == 1 and medida['mae'] == medida['rmse'] == medida['sesgo'] == pred['rendimiento_t_ha']
    assert medida['rangos'] == int(pred['intervalo'] is not None)
    assert medida['dentro'] == int(bool(pred['intervalo']) and pred['intervalo']['min'] <= 0 <= pred['intervalo']['max'])
    a.call('POST', ruta + '/observacion', {'parcela_id': parcela, 'fecha_siembra': '2024-06-01',
                                            'fecha': '2024-06-02', 'fuente': 'Escena', 'ndvi': 1.1}, expected=400)
    foto = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=')
    limite = 'zeasys-campana-prueba'
    campos = {'parcela_id': parcela, 'fecha_siembra': '2024-06-01', 'fecha': '2024-06-02', 'fuente': 'Escena de prueba', 'ndvi': '0'}
    cuerpo = b''.join(f'--{limite}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in campos.items())
    cuerpo += f'--{limite}\r\nContent-Disposition: form-data; name="adjunto"; filename="cam.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + foto + f'\r\n--{limite}--\r\n'.encode()
    req = Request(a.base + ruta + '/observacion', cuerpo, {'Content-Type': f'multipart/form-data; boundary={limite}'})
    with a.opener.open(req) as res:
        assert json.load(res)['exito']
    obs = a.call('GET', consulta)['observaciones'][0]
    assert float(obs['ndvi']) == 0 and 'adjunto' not in obs and obs['adjunto_tipo'] == 'image/png'
    descarga = ruta + f'/adjunto?id={obs["id"]}'
    with a.opener.open(a.base + descarga) as res:
        assert res.read() == foto and 'no-store' in res.headers['Cache-Control']
    b.call('GET', descarga, expected=403)
    visitor.call('GET', descarga, expected=401)


def probar_acompanamiento(a, b, visitor, parcela):
    ruta = 'acompanamiento'
    grant = {'parcela_id': parcela, 'correo': 'b@example.test'}
    visitor.call('GET', ruta, expected=401)
    assert b.call('GET', ruta)['triaje'] == []
    a.call('POST', ruta + '/accesos', {**grant, 'correo': 'a@example.test'}, expected=400)
    b.call('POST', ruta + '/accesos', grant, expected=403)
    a.call('POST', ruta + '/accesos', grant)
    a.call('POST', ruta + '/accesos', grant)
    permisos = a.call('GET', ruta)['accesos']
    assert len(permisos) == 1 and permisos[0]['correo'] == 'b@example.test'
    triaje = b.call('GET', ruta)['triaje']
    assert len(triaje) == 1 and triaje[0]['id'] == parcela and triaje[0]['estado'] == 'Revisar pérdida'
    assert triaje[0]['rendimiento_observado_t_ha'] == 0 and 'datos_json' not in triaje[0]
    b.call('GET', f'rendimiento/campanas?parcela_id={parcela}', expected=403)
    b.call('POST', 'rendimiento/campanas/observacion', {'parcela_id': parcela}, expected=403)
    b.call('PUT', 'parcelas', {'id': parcela, 'nombre_parcela': 'No autorizado'}, expected=403)
    revoca = {'parcela_id': parcela, 'tecnico_id': permisos[0]['tecnico_id']}
    b.call('DELETE', ruta + '/accesos', revoca, expected=403)

    def exportar():
        with b.opener.open(b.base + ruta + '/exportar') as res:
            assert 'no-store' in res.headers['Cache-Control']
            return list(csv.DictReader(io.StringIO(res.read().decode('utf-8-sig'))))
    assert [f['id'] for f in exportar()] == [str(parcela)]
    a.call('DELETE', ruta + '/accesos', revoca)
    assert b.call('GET', ruta)['triaje'] == [] and exportar() == []
