"""Referencias provinciales por producto ESPAC; no entrena ni sustituye el modelo.

Mantiene separado choclo de grano seco. El cociente ponderado se calcula solo
para registros completos de cultivo solo y un mismo estado de cosecha. No es
el tabulado oficial completo: no representa parcelas ni variedades comerciales.
"""
import csv
import hashlib
import json
import math
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'documentacion/fuentes-maiz/candidatos/maiz_espac2025_original.csv'
OUTPUT = ROOT / 'backend-api/data/referencias/espac2025-productos-maiz.json'
PRODUCTS = {
    'MAIZ DURO SECO (GRANO SECO)': ('duro_seco', 'Maíz duro seco', 'GRANO SECO', 't de grano seco/ha'),
    'MAIZ SUAVE SECO (GRANO SECO)': ('suave_seco', 'Maíz suave seco', 'GRANO SECO', 't de grano seco/ha'),
    'MAIZ DURO CHOCLO (CHOCLO)': ('duro_choclo', 'Maíz duro en choclo', 'CHOCLO', 't de choclo/ha'),
    'MAIZ SUAVE CHOCLO (CHOCLO)': ('suave_choclo', 'Maíz suave en choclo', 'CHOCLO', 't de choclo/ha'),
}

def prepare(source=SOURCE):
    profile = json.loads((ROOT/'documentacion/fuentes-maiz/perfil-candidato-espac2025.json').read_text(encoding='utf-8'))
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != profile['archivos']['maiz_espac2025_original.csv']['sha256']: raise ValueError('La copia no corresponde a la fuente revisada.')
    dictionary = json.loads((ROOT/'documentacion/fuentes-maiz/diccionario-transitorios2025.json').read_text(encoding='utf-8'))
    variables = [r for rows in dictionary.values() for r in rows if 'ct_prod' in r.values()]
    if len(variables) != 1 or 'toneladas' not in str(variables[0]).lower(): raise ValueError('Falta acreditar la unidad de producción.')
    geo = json.loads((ROOT/'frontend-app/src/data/ecuador-provincias.json').read_text(encoding='utf-8'))
    normalize = lambda v: ''.join(c for c in unicodedata.normalize('NFD', v.strip().lower()) if not unicodedata.combining(c))
    provinces = {normalize(f['properties']['dpa_despro']): f['properties']['dpa_despro'].title() for f in geo['features']}
    groups = defaultdict(list); exclusions = Counter(); seen = set()
    with source.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle, delimiter=';')
        for row in reader:
            identity = tuple(row.values())
            if identity in seen: exclusions['duplicado'] += 1; continue
            seen.add(identity)
            product = PRODUCTS.get(row['ct_nclavr'].strip())
            if not product: exclusions['otro_producto'] += 1; continue
            if row['ct_k504'].strip() != '1': exclusions['cultivo_asociado'] += 1; continue
            if row['ct_k520'].strip() != product[2]: exclusions['estado_incompatible_o_ausente'] += 1; continue
            try:
                area, planted, production, weight = [float(row[k].strip().replace(',', '.')) for k in ('ct_k511ha','ct_k510ha','ct_prod','fact_exp_fin')]
            except ValueError: exclusions['dato_ausente'] += 1; continue
            if not all(math.isfinite(x) for x in (area, planted, production, weight)) or area <= 0 or planted <= 0 or area > planted + 1e-6 or production < 0 or weight <= 0:
                exclusions['dato_fuera_de_contrato'] += 1; continue
            province = provinces.get(normalize(row['ual_prov']))
            if not province: exclusions['territorio_no_identificado'] += 1; continue
            groups[(product[0], province)].append((area, production, weight))
    products = []
    for key, title, state, unit in PRODUCTS.values():
        records = []
        for (group, province), rows in sorted(groups.items()):
            if group != key: continue
            # Menos de cinco registros: no se publica un promedio local frágil.
            if len(rows) < 5: continue
            weighted_area = sum(a*w for a, _, w in rows)
            weighted_production = sum(p*w for _, p, w in rows)
            records.append({'provincia': province, 'registros': len(rows), 'rendimiento_t_ha': round(weighted_production/weighted_area, 3)})
        products.append({'id': key, 'nombre': title, 'estado_cosecha': state, 'unidad': unit, 'provincias': records})
    return {'edicion': 2025, 'fuente': 'INEC · ESPAC 2025, microdatos de cultivos transitorios', 'url': profile['url'],
            'sha256': digest, 'calculado_por': 'ZeaSys; no es un tabulado oficial publicado',
            'metodo': 'Σ(producción en t × factor de expansión) / Σ(ha cosechadas × factor de expansión). Cultivo solo; estado de cosecha compatible; mínimo 5 registros por provincia y producto.',
            'limites': 'Referencia descriptiva de una encuesta retrospectiva. No identifica color, variedad comercial ni ubicación individual. No equiparar choclo con grano seco, ni comparar directamente con SIPA estandarizado a 13% de humedad. No valida el modelo XGBoost.',
            'exclusiones': dict(exclusions), 'productos': products}

if __name__ == '__main__':
    result = prepare(); OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({p['id']: {'provincias':len(p['provincias']), 'registros_publicables':sum(r['registros'] for r in p['provincias'])} for p in result['productos']}))
