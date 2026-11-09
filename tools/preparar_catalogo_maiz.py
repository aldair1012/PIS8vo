"""Valida el catálogo revisado y exporta sus fichas; no genera cosechas.

La fuente canónica es el JSON compartido por PHP y React. Este programa no
reintroduce listas históricas retiradas ni modifica el entrenamiento de XGBoost.
"""
from pathlib import Path
import csv
import json
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


def validar(catalogo, retiradas):
    ids, nombres = set(), {}
    for ficha in catalogo['variedades']:
        assert ficha['id'] not in ids, f"Identificador duplicado: {ficha['id']}"
        assert ficha['id'] not in retiradas, f"Material retirado reintroducido: {ficha['nombre']}"
        ids.add(ficha['id'])
        for nombre in [ficha['nombre'], *ficha['alias']]:
            ascii_name = unicodedata.normalize('NFKD', nombre).encode('ascii', 'ignore').decode()
            clave = ''.join(c for c in ascii_name.casefold() if c.isalnum())
            assert clave not in nombres or nombres[clave] == ficha['id'], f"Alias ambiguo: {nombre}"
            nombres[clave] = ficha['id']
        assert ficha['fuentes'], f"Falta respaldo: {ficha['nombre']}"
        assert ficha['nombre_en_modelo'] or ficha.get('simulacion_grano_habilitada') is False, 'Una ficha sin etiqueta utilizable debe deshabilitar el cálculo específico.'
        for fuente in [*ficha['fuentes'], *(s for fuentes in ficha.get('fuentes_por_uso', {}).values() for s in fuentes)]:
            assert fuente['id'] in catalogo['fuentes'], f"Fuente desconocida: {fuente}"
        for uso, dias in ficha['cosecha_orientativa_dias'].items():
            assert uso in catalogo['usos'] and type(dias) is int and dias > 0
        altura = ficha['altitud_documentada_m']
        if altura is not None:
            assert 0 <= altura['min'] <= altura['max']


def main():
    catalogo = json.loads((ROOT / 'backend-api/data/referencias/catalogo-maiz-ecuador.json').read_text(encoding='utf-8'))
    auditoria = json.loads((ROOT / 'documentacion/fuentes-maiz/variedades-retiradas-20261107.json').read_text(encoding='utf-8'))
    validar(catalogo, {ficha['id'] for ficha in auditoria['retiradas']})
    output = ROOT / 'documentacion/fuentes-maiz/candidatos/catalogo_variedades_referencia.csv'
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.writer(stream, delimiter=';')
        writer.writerow(['Material', 'Tipo documentado', 'Usos documentados', 'Provincias de referencia', 'Altitud mínima de referencia (m)', 'Altitud máxima de referencia (m)', 'Días orientativos grano seco', 'Días orientativos choclo', 'Nombre en el modelo actual', 'Estado de ficha', 'Fuentes', 'Notas'])
        for ficha in catalogo['variedades']:
            altura, dias = ficha['altitud_documentada_m'] or {}, ficha['cosecha_orientativa_dias']
            writer.writerow([ficha['nombre'], ficha['tipo_grano_documentado'], ', '.join(ficha['usos_documentados']), ', '.join(ficha['provincias_documentadas']), altura.get('min', ''), altura.get('max', ''), dias.get('grano_seco', ''), dias.get('choclo', ''), ficha['nombre_en_modelo'], ficha['estado_ficha'], ' | '.join(catalogo['fuentes'][s['id']]['url'] for s in ficha['fuentes']), ' | '.join(ficha['notas'])])
    print(f"Catálogo validado: {len(catalogo['variedades'])} materiales. CSV exportado; sin crear observaciones agrícolas.")


if __name__ == '__main__':
    main()
