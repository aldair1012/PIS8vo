"""Comparación interna por provincia con perfiles explícitos de entradas disponibles."""
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
from src.training_quality import evaluar, FEATURES, CATEGORICAL, grupos_reales

from src.intervalos import intervalo_rendimiento
from src.baseline_historica import baseline_historica
from src.model_evidence import AVAILABILITY

FUTURAS = [col for col in FEATURES if AVAILABILITY[col]['disponibilidad'] == 'etapa_posterior']
LUZ = 'horas_luz_dia'
PARAMS = dict(n_estimators=450, max_depth=3, learning_rate=.03, subsample=.8, colsample_bytree=.8,
              reg_alpha=.5, reg_lambda=5., min_child_weight=5, random_state=42,
              tree_method='hist', n_jobs=2, objective='reg:squarederror')
NIVEL = 0.8


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


def simular_formulario_basico(train, test):
    # Perfil explícito: ubicación, variedad y altitud conocidas, clima de escenario,
    # sin análisis de suelo por proveedor ni campos de manejo opcionales.
    declaradas = {'zona', 'provincia', 'variedad', 'altitud_msnm', 'tipo_grano', 'tipo_suelo',
                  'ph_suelo', 'temperatura_media_c', 'precipitacion_mm', 'humedad_relativa_pct',
                  'nitrogeno_kg_ha', 'temperatura_min_c', 'temperatura_max_c'}
    asumidas = [col for col in FEATURES if col not in declaradas]
    salida = test[FEATURES].astype({col: float for col in asumidas if col not in CATEGORICAL})
    for (provincia, zona, variedad), filas in test.groupby(['provincia', 'zona', 'variedad']).groups.items():
        base = baseline_historica(train, provincia, zona, variedad, asumidas, CATEGORICAL)
        for columna, valor in base.items():
            salida.loc[filas, columna] = valor
    salida['temperatura_min_c'] = salida['temperatura_media_c'] - 4.5
    salida['temperatura_max_c'] = salida['temperatura_media_c'] + 5.5
    return salida


def ajustar_predecir(train, y_train, test, columnas):
    cats = [c for c in CATEGORICAL if c in columnas]
    a, b = train[columnas].copy(), test[columnas].copy()
    if cats:
        encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        a[cats] = encoder.fit_transform(a[cats].astype(str))
        b[cats] = encoder.transform(b[cats].astype(str))
    return xgb.XGBRegressor(**PARAMS).fit(a, y_train).predict(b)


def umbral_residuos(train, y_train, grupos_train, columnas, nivel=NIVEL, pliegues=3):
    """Cuantil del error absoluto en provincias no vistas (validación interna por grupos)."""
    residuo = np.zeros(len(train))
    for a, b in GroupKFold(n_splits=pliegues).split(train, y_train, grupos_train):
        prueba = imputar(train.iloc[a], train.iloc[b], [LUZ]) if LUZ in columnas else train.iloc[b]
        pred = ajustar_predecir(train.iloc[a], y_train.iloc[a], prueba, columnas)
        residuo[b] = np.abs(y_train.iloc[b].to_numpy() - pred)
    n = len(residuo)
    orden = min(n, int(np.ceil((n + 1) * nivel)))
    return float(np.partition(residuo, orden - 1)[orden - 1])


def metricas(y, pred):
    return {'mae': float(mean_absolute_error(y, pred)),
            'rmse': float(np.sqrt(mean_squared_error(y, pred))),
            'r2': float(r2_score(y, pred))}


def evaluar_conjunto(frame, ficha_metricas, pliegues=4):
    y = frame['rendimiento_t_ha'].reset_index(drop=True)
    frame = frame.reset_index(drop=True)
    grupos = grupos_reales(frame['provincia'])
    previas = [c for c in FEATURES if c not in FUTURAS]
    nombres = ['mediana_global', 'media_por_zona', 'A_completo_etapas_reales',
               'B_completo_etapas_y_luz_imputadas', 'C_planificacion_luz_imputada', 'D_planificacion_sin_luz',
               'E_formulario_basico_36', 'F_formulario_basico_30']
    pred = {n: np.zeros(len(frame)) for n in nombres}
    cubre, ancho = np.zeros(len(frame), dtype=bool), np.zeros(len(frame))
    por_pliegue = []
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
        formulario = simular_formulario_basico(tr, te)
        pred['E_formulario_basico_36'][test] = ajustar_predecir(tr, ytr, formulario, FEATURES)
        pred['F_formulario_basico_30'][test] = ajustar_predecir(tr, ytr, formulario, previas)
        por_pliegue.append({'provincias': sorted(grupos.iloc[test].unique()), 'n': len(te),
                            'mae': {name: float(mean_absolute_error(y.iloc[test], p[test])) for name, p in pred.items()}})
        q = umbral_residuos(tr, ytr, grupos.iloc[train], previas)
        cubre[test] = np.abs(y.iloc[test].to_numpy() - pred['C_planificacion_luz_imputada'][test]) <= q
        ancho[test] = 2 * q
    resultado = {n: metricas(y, p) for n, p in pred.items()}
    # Reconstrucción histórica del ensayo A/B: el margen usa errores del mismo CSV y omite el recorte del motor.
    margen = max(resultado['A_completo_etapas_reales']['mae'], 1.96 * resultado['A_completo_etapas_reales']['rmse'])
    cubre_actual = np.abs(y.to_numpy() - pred['B_completo_etapas_y_luz_imputadas']) <= margen
    rangos = [intervalo_rendimiento(float(np.clip(p, .5, 12)), ficha_metricas['xgboost'], ficha_metricas['rango_objetivo'])
              for p in pred['E_formulario_basico_36']]
    dentro = sum(item['min'] <= observado <= item['max'] for item, observado in zip(rangos, y))
    banda_motor = {'casos_dentro': dentro, 'cobertura_observada': dentro / len(y),
                  'ancho_medio_t_ha': float(np.mean([item['max'] - item['min'] for item in rangos]))}
    return {'filas': int(len(frame)), 'grupos': int(grupos.nunique()), 'metricas': resultado, 'por_pliegue': por_pliegue,
            'regla_del_motor_sobre_E': banda_motor,
            'banda_empirica_C': {'nivel_nominal': NIVEL, 'cobertura_observada': float(cubre.mean()),
                            'ancho_medio_t_ha': float(ancho.mean())},
            'regla_sin_recorte_con_metricas_A_sobre_B': {'margen_t_ha': float(margen), 'ancho_t_ha': float(2 * margen),
                                     'cobertura_observada': float(cubre_actual.mean())}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--salida', type=Path, default=None)
    args = parser.parse_args()
    source = ROOT / 'data/maiz_ecuador_training_data.csv'
    metricas_path = ROOT / 'models/metrics.json'
    ficha_metricas = json.loads(metricas_path.read_text(encoding='utf-8'))
    original = pd.read_csv(source)
    elegibles, calidad = evaluar(original)
    sin_duplicados = ~original.duplicated(keep='first')
    registro = {
        'fecha': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'sha256_dataset': hashlib.sha256(source.read_bytes()).hexdigest(),
        'calidad': calidad, 'publicacion': False, 'sha256_metricas_publicadas': hashlib.sha256(metricas_path.read_bytes()).hexdigest(),
        'versiones': {'python': platform.python_version(), 'xgboost': xgb.__version__, 'sklearn': sklearn.__version__},
        'parametros': PARAMS,
        'validacion': 'GroupKFold(4) por provincia real (Loja y Loja Sierra juntas); medianas por zona tomadas solo del entrenamiento.',
        'limitaciones': ['B y C sustituyen solo etapas futuras y/o luz por zona. E y F usan la referencia de variedad del motor y suponen una zona y un clima de escenario conocidos.',
                         'Procedencia del CSV sin acreditar: no mide exactitud agrícola.'],
        'resultados': {
            'sin_filas_invalidas_ni_duplicados': evaluar_conjunto(original.loc[elegibles], ficha_metricas),
            'solo_sin_duplicados_como_el_modelo_publicado': evaluar_conjunto(original.loc[sin_duplicados], ficha_metricas),
        },
    }
    destino = args.salida or ROOT / 'experimentos' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') / 'realismo_inferencia.json'
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(registro, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(destino)


if __name__ == '__main__':
    main()
