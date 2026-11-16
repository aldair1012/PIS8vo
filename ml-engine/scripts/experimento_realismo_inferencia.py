"""Compara el contrato que hoy se usa al simular con uno de planificación. No publica.

La simulación previa a la siembra no conoce el NDVI de etapas futuras ni las
plagas, y `horas_luz_dia` tampoco llega de un proveedor: el motor las rellena
con medianas del conjunto histórico. Este ensayo mide el error en esas
condiciones, que es lo que recibe el productor, y no solo con las variables
reales de cada fila. También mide la cobertura de un intervalo conforme por
grupos y agrupa `Loja` con `Loja Sierra` al validar (misma provincia real).

No modifica datos ni modelos. La procedencia del CSV sigue sin acreditar: los
resultados describen consistencia interna, no exactitud agrícola.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import sys

import numpy as np
import pandas as pd
import sklearn
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import OrdinalEncoder
import xgboost as xgb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.training_quality import evaluar, FEATURES, CATEGORICAL  # noqa: E402

FUTURAS = ['ndvi_v6_vegetativo', 'ndvi_vt_floracion', 'ndvi_r3_llenado_grano',
           'plagas_presentes', 'presion_plaga_score', 'control_plaga']
LUZ = 'horas_luz_dia'
GRUPO_REAL = {'Loja Sierra': 'Loja'}
PARAMS = dict(n_estimators=450, max_depth=3, learning_rate=.03, subsample=.8, colsample_bytree=.8,
              reg_alpha=.5, reg_lambda=5., min_child_weight=5, random_state=42,
              tree_method='hist', n_jobs=2, objective='reg:squarederror')
NIVEL = 0.8


def grupos_reales(provincia):
    """Provincia real para validar: las subregiones de una misma provincia comparten grupo."""
    return provincia.replace(GRUPO_REAL)


def imputar(train, test, columnas, por='zona'):
    """Sustituye columnas de `test` por la mediana (o moda) de `train` en la misma zona.

    Imita al motor: lo que no se conoce al planificar se completa con una referencia.
    """
    salida = test.copy()
    for col in columnas:
        if col in CATEGORICAL:
            global_ref = train[col].mode().iloc[0]
            por_zona = train.groupby(por)[col].agg(lambda s: s.mode().iloc[0])
        else:
            global_ref = train[col].median()
            por_zona = train.groupby(por)[col].median()
        salida[col] = salida[por].map(por_zona).fillna(global_ref)
    return salida


def ajustar_predecir(train, y_train, test, columnas):
    cats = [c for c in CATEGORICAL if c in columnas]
    a, b = train[columnas].copy(), test[columnas].copy()
    if cats:
        encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        a[cats] = encoder.fit_transform(a[cats].astype(str))
        b[cats] = encoder.transform(b[cats].astype(str))
    return xgb.XGBRegressor(**PARAMS).fit(a, y_train).predict(b)


def umbral_conforme(train, y_train, grupos_train, columnas, nivel=NIVEL, pliegues=3):
    """Cuantil del error absoluto en provincias no vistas (validación interna por grupos)."""
    residuo = np.zeros(len(train))
    for a, b in GroupKFold(n_splits=pliegues).split(train, y_train, grupos_train):
        pred = ajustar_predecir(train.iloc[a], y_train.iloc[a], train.iloc[b], columnas)
        residuo[b] = np.abs(y_train.iloc[b].to_numpy() - pred)
    n = len(residuo)
    return float(np.quantile(residuo, min(1.0, np.ceil((n + 1) * nivel) / n), method='higher'))


def metricas(y, pred):
    return {'mae': float(mean_absolute_error(y, pred)),
            'rmse': float(np.sqrt(mean_squared_error(y, pred))),
            'r2': float(r2_score(y, pred))}


def evaluar_conjunto(frame, pliegues=4):
    y = frame['rendimiento_t_ha'].reset_index(drop=True)
    frame = frame.reset_index(drop=True)
    grupos = grupos_reales(frame['provincia'])
    previas = [c for c in FEATURES if c not in FUTURAS]
    nombres = ['mediana_global', 'media_por_zona', 'A_completo_etapas_reales',
               'B_completo_etapas_y_luz_imputadas', 'C_planificacion_luz_imputada', 'D_planificacion_sin_luz']
    pred = {n: np.zeros(len(frame)) for n in nombres}
    cubre, ancho = np.zeros(len(frame), dtype=bool), np.zeros(len(frame))
    for train, test in GroupKFold(n_splits=pliegues).split(frame, y, grupos):
        assert set(grupos.iloc[train]).isdisjoint(grupos.iloc[test])
        tr, te, ytr = frame.iloc[train], frame.iloc[test], y.iloc[train]
        pred['mediana_global'][test] = ytr.median()
        zona = ytr.groupby(tr['zona']).mean()
        pred['media_por_zona'][test] = te['zona'].map(zona).fillna(ytr.mean()).to_numpy()
        pred['A_completo_etapas_reales'][test] = ajustar_predecir(tr, ytr, te, FEATURES)
        pred['B_completo_etapas_y_luz_imputadas'][test] = ajustar_predecir(
            tr, ytr, imputar(tr, te, FUTURAS + [LUZ]), FEATURES)
        te_luz = imputar(tr, te, [LUZ])
        pred['C_planificacion_luz_imputada'][test] = ajustar_predecir(tr, ytr, te_luz, previas)
        pred['D_planificacion_sin_luz'][test] = ajustar_predecir(
            tr, ytr, te, [c for c in previas if c != LUZ])
        q = umbral_conforme(tr, ytr, grupos.iloc[train], previas)
        cubre[test] = np.abs(y.iloc[test].to_numpy() - pred['C_planificacion_luz_imputada'][test]) <= q
        ancho[test] = 2 * q
    resultado = {n: metricas(y, p) for n, p in pred.items()}
    # Regla vigente de predictor._intervalo_rendimiento: margen = max(MAE, 1,96 x RMSE) con las
    # métricas del escenario A, aplicado a lo que recibe el productor (escenario B). Sin recorte.
    margen = max(resultado['A_completo_etapas_reales']['mae'], 1.96 * resultado['A_completo_etapas_reales']['rmse'])
    cubre_actual = np.abs(y.to_numpy() - pred['B_completo_etapas_y_luz_imputadas']) <= margen
    return {'filas': int(len(frame)), 'grupos': int(grupos.nunique()), 'metricas': resultado,
            'intervalo_C': {'nivel_nominal': NIVEL, 'cobertura_observada': float(cubre.mean()),
                            'ancho_medio_t_ha': float(ancho.mean())},
            'regla_actual_sobre_B': {'margen_t_ha': float(margen), 'ancho_t_ha': float(2 * margen),
                                     'cobertura_observada': float(cubre_actual.mean())}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--salida', type=Path, default=None)
    args = parser.parse_args()
    source = ROOT / 'data/maiz_ecuador_training_data.csv'
    original = pd.read_csv(source)
    elegibles, calidad = evaluar(original)
    sin_duplicados = ~original.duplicated(keep='first')
    registro = {
        'fecha': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'sha256_dataset': hashlib.sha256(source.read_bytes()).hexdigest(),
        'calidad': calidad, 'publicacion': False,
        'versiones': {'python': platform.python_version(), 'xgboost': xgb.__version__, 'sklearn': sklearn.__version__},
        'parametros': PARAMS,
        'validacion': 'GroupKFold(4) por provincia real (Loja y Loja Sierra juntas); medianas por zona tomadas solo del entrenamiento.',
        'limitaciones': ['El motor real imputa por provincia y variedad cuando existen; aquí la provincia de prueba está reservada, por lo que se usa la zona.',
                         'Procedencia del CSV sin acreditar: no mide exactitud agrícola.'],
        'resultados': {
            'sin_filas_invalidas_ni_duplicados': evaluar_conjunto(original.loc[elegibles]),
            'solo_sin_duplicados_como_el_modelo_publicado': evaluar_conjunto(original.loc[sin_duplicados]),
        },
    }
    destino = args.salida or ROOT / 'experimentos' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') / 'realismo_inferencia.json'
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(registro, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(destino)


if __name__ == '__main__':
    main()
