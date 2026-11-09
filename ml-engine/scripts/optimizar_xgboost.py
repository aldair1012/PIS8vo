"""Comparación reproducible con validación anidada por provincia. No publica.

El permiso --depuracion-experimental excluye filas inválidas solo del ensayo.
Los artefactos quedan aislados; no modifica datos ni modelos de producción.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import sys
import time
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import OrdinalEncoder
import xgboost as xgb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.training_quality import evaluar, FEATURES, CATEGORICAL

BASE = dict(n_estimators=600, max_depth=4, learning_rate=.03, subsample=.8,
            colsample_bytree=.8, reg_alpha=.1, reg_lambda=1., random_state=42,
            tree_method='hist', n_jobs=2, objective='reg:squarederror')
CONFIGS = [BASE, {**BASE, 'n_estimators': 350, 'max_depth': 2, 'reg_lambda': 8., 'min_child_weight': 10},
           {**BASE, 'n_estimators': 450, 'max_depth': 3, 'reg_alpha': .5, 'reg_lambda': 5., 'min_child_weight': 5}]


def metricas(y, p):
    return {'mae': float(mean_absolute_error(y, p)), 'rmse': float(np.sqrt(mean_squared_error(y, p))), 'r2': float(r2_score(y, p))}


def ajustar(X, y, train, test, config):
    categorical = [c for c in CATEGORICAL if c in X.columns]
    encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    a, b = X.iloc[train].copy(), X.iloc[test].copy()
    a[categorical] = encoder.fit_transform(a[categorical].astype(str))
    b[categorical] = encoder.transform(b[categorical].astype(str))
    model = xgb.XGBRegressor(**config).fit(a, y.iloc[train])
    return model.predict(b), model, encoder


def elegir(X, y, groups):
    scores = []
    for config in CONFIGS:
        folds = []
        for train, test in GroupKFold(n_splits=3).split(X, y, groups):
            p, _, _ = ajustar(X, y, train, test, config)
            folds.append(metricas(y.iloc[test], p)['rmse'])
        scores.append(float(np.mean(folds)))
    return int(np.argmin(scores)), scores


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--depuracion-experimental', action='store_true')
    args = parser.parse_args()
    source = ROOT / 'data/maiz_ecuador_training_data.csv'
    original = pd.read_csv(source)
    eligible, quality = evaluar(original)
    if quality['filas_invalidas'] and not args.depuracion_experimental:
        raise ValueError('Hay filas inválidas. No se entrenó. Revisa la auditoría o usa --depuracion-experimental para excluirlas únicamente del ensayo.')
    frame = original.loc[eligible].reset_index(drop=True)
    run = ROOT / 'experimentos' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    run.mkdir(parents=True)
    record = {'estado': 'en_ejecucion', 'semilla': 42, 'sha256_dataset_original': hashlib.sha256(source.read_bytes()).hexdigest(),
              'calidad': quality, 'versiones': {'python': platform.python_version(), 'xgboost': xgb.__version__, 'sklearn': sklearn.__version__},
              'validacion': '4 grupos externos por provincia; 3 internos para selección de parámetros. Categorías ajustadas solo con entrenamiento.',
              'configuraciones': CONFIGS, 'publicacion': False, 'resultados': {}}
    log = run / 'experimento.json'
    def guardar(): log.write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    guardar()
    started = time.monotonic()
    y, groups = frame.rendimiento_t_ha, frame.provincia
    if groups.nunique() < 4: raise ValueError('Se necesitan al menos cuatro provincias.')
    # NDVI de etapas futuras y presión/control de plagas no están disponibles
    # al planificar la siembra. Su exclusión se evalúa como un contrato aparte.
    future = {'ndvi_v6_vegetativo', 'ndvi_vt_floracion', 'ndvi_r3_llenado_grano', 'plagas_presentes', 'presion_plaga_score', 'control_plaga'}
    try:
        for name, columns in [('contrato_actual_36', FEATURES), ('planificacion_sin_etapas_futuras', [c for c in FEATURES if c not in future])]:
            X = frame[columns]
            predictions, baseline, dummy = np.zeros(len(frame)), np.zeros(len(frame)), np.zeros(len(frame))
            folds = []
            for fold, (train, test) in enumerate(GroupKFold(n_splits=4).split(X, y, groups), 1):
                best, inner_scores = elegir(X.iloc[train].reset_index(drop=True), y.iloc[train].reset_index(drop=True), groups.iloc[train].reset_index(drop=True))
                predictions[test], _, _ = ajustar(X, y, train, test, CONFIGS[best])
                baseline[test], _, _ = ajustar(X, y, train, test, BASE)
                dummy[test] = y.iloc[train].median()
                assert set(groups.iloc[train]).isdisjoint(groups.iloc[test])
                folds.append({'pliegue': fold, 'provincias_prueba': sorted(groups.iloc[test].unique()), 'configuracion_elegida': best, 'rmse_internos': inner_scores,
                              'optimizado': metricas(y.iloc[test], predictions[test]), 'referencia': metricas(y.iloc[test], baseline[test])})
                print(f'{name}: pliegue {fold}/4 completado', flush=True)
            selected, scores = elegir(X, y, groups)
            _, model, encoder = ajustar(X, y, np.arange(len(X)), np.arange(len(X)), CONFIGS[selected])
            artifact = run / f'{name}.joblib'
            joblib.dump({'modelo': model, 'encoder': encoder, 'columnas': columns, 'categoricas': [c for c in CATEGORICAL if c in columns], 'solo_experimento': True}, artifact)
            record['resultados'][name] = {'columnas': columns, 'optimizado': metricas(y, predictions), 'referencia_mismos_datos': metricas(y, baseline), 'referencia_mediana': metricas(y, dummy),
                                         'pliegues': folds, 'parametros_candidato': CONFIGS[selected], 'sha256_artefacto': hashlib.sha256(artifact.read_bytes()).hexdigest(),
                                         'por_provincia': {province: metricas(y[groups.eq(province)], predictions[groups.eq(province)]) for province in sorted(groups.unique()) if groups.eq(province).sum() >= 2}}
            guardar()
        record.update(estado='completado', segundos=round(time.monotonic()-started, 2), motivo_no_publicacion='Procedencia original sin acreditar y sin cosechas externas de validación. El contrato de planificación también requiere adaptar inferencia y evaluar variables realmente disponibles.')
        guardar()
        print(str(log), flush=True)
    except Exception as error:
        record.update(estado='fallido', error=str(error)); guardar(); raise


if __name__ == '__main__':
    main()
