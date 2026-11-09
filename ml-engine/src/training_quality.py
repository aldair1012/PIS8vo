"""Auditoría de entrenamiento sin corregir ni inventar observaciones."""
import hashlib
import json
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
FEATURES = list(json.loads((ROOT / 'config/feature_info.json').read_text(encoding='utf-8'))['features'])
CATEGORICAL = ['zona', 'provincia', 'variedad', 'tipo_grano', 'riego_tipo', 'tipo_suelo', 'plagas_presentes', 'control_plaga']


def evaluar(frame):
    required = [*FEATURES, 'rendimiento_t_ha', 'categoria_cosecha']
    missing = sorted(set(required) - set(frame.columns))
    extra = sorted(set(frame.columns) - set(required))
    if missing or extra:
        raise ValueError(f'Esquema incompatible. Faltan: {missing}; sobran: {extra}')
    checks = {}
    numeric = frame[[c for c in required if c not in [*CATEGORICAL, 'categoria_cosecha']]].apply(pd.to_numeric, errors='coerce')
    checks['numeros_ausentes_o_no_finitos'] = ~np.isfinite(numeric).all(axis=1)
    checks['categorias_ausentes'] = frame[[*CATEGORICAL, 'categoria_cosecha']].isna().any(axis=1) | frame[[*CATEGORICAL, 'categoria_cosecha']].astype(str).apply(lambda c: c.str.strip().eq('')).any(axis=1)
    checks['temperaturas_inconsistentes'] = (numeric.temperatura_min_c > numeric.temperatura_media_c) | (numeric.temperatura_media_c > numeric.temperatura_max_c)
    texture = numeric[['textura_arcilla_pct', 'textura_arena_pct', 'textura_limo_pct']]
    checks['textura_inconsistente'] = (texture.sum(axis=1) - 100).abs().gt(2) | texture.lt(0).any(axis=1) | texture.gt(100).any(axis=1)
    checks['magnitudes_imposibles'] = numeric.ph_suelo.lt(0) | numeric.ph_suelo.gt(14) | numeric.humedad_relativa_pct.lt(0) | numeric.humedad_relativa_pct.gt(100) | numeric.rendimiento_t_ha.lt(0) | numeric.ciclo_dias.le(0)
    checks['canguil_clasificado_como_suave'] = frame.variedad.eq('INIAP 198 Canguil') & frame.tipo_grano.eq('Suave Harinoso')
    invalid = pd.DataFrame(checks).any(axis=1)
    duplicates = frame.duplicated(keep='first')
    valid = ~invalid & ~duplicates
    return valid, {'filas_originales': len(frame), 'filas_invalidas': int(invalid.sum()), 'duplicados_adicionales': int(duplicates.sum()),
                   'filas_elegibles_experimento': int(valid.sum()), 'problemas': {key: int(value.sum()) for key, value in checks.items()},
                   'nota': 'Excluir filas en un experimento no acredita la procedencia ni convierte las demás observaciones en cosechas verificadas.'}


def validar_publicacion(frame, path):
    _, report = evaluar(frame)
    digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    manifest_path = Path(path).with_suffix('.procedencia.json')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    if report['filas_invalidas'] or manifest.get('sha256') != digest or manifest.get('estado') != 'verificada' or not manifest.get('fuentes'):
        raise ValueError('Entrenamiento de publicación detenido: hay problemas de calidad o falta una procedencia verificada vinculada al SHA-256. Usa scripts/optimizar_xgboost.py para un experimento aislado. Detalle: '+json.dumps(report, ensure_ascii=False))
    return report
