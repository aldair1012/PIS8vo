# predictor.py - Carga los modelos y hace la predicción + SHAP + escenarios.
# Los modelos principales son XGBoost y Random Forest (regresión y clasificación).

import os
import json
import numpy as np
import pandas as pd
import joblib
import shap

from src.feature_builder import COLS_ORDER, CATEGORICAL_COLS

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")

# --- Carga de modelos al inicio ---
print("[ML Engine] Cargando modelos e interpretadores...")
rf_model = joblib.load(os.path.join(MODELS_DIR, "random_forest.joblib"))
xgb_model = joblib.load(os.path.join(MODELS_DIR, "xgboost.joblib"))
rf_clf_model = joblib.load(os.path.join(MODELS_DIR, "random_forest_clf.joblib"))
xgb_clf_model = joblib.load(os.path.join(MODELS_DIR, "xgboost_clf.joblib"))

label_encoder = joblib.load(os.path.join(MODELS_DIR, "label_encoder.joblib"))
target_encoder = joblib.load(os.path.join(MODELS_DIR, "target_encoder.joblib"))

with open(os.path.join(MODELS_DIR, "metrics.json"), "r") as f:
    model_metrics = json.load(f)

# SHAP explainers para interpretar la importancia de cada variable
print("[ML Engine] Inicializando SHAP TreeExplainers...")
rf_explainer = shap.TreeExplainer(rf_model)
xgb_explainer = shap.TreeExplainer(xgb_model)

# Lista de modelos disponibles (para el endpoint /health)
MODELOS_DISPONIBLES = ["random_forest", "xgboost"]


def _probabilidad_cosecha(clf_model, df_encoded):
    """Devuelve la probabilidad de cosecha comercial del clasificador.

    El modelo clasifica cuatro estados (Alta, Media, Baja y Muy Baja). La
    probabilidad del KPI es la suma de Alta + Media; no se usa la confianza de
    la regresión, porque el R² no es una probabilidad de cosecha.
    """
    if not hasattr(clf_model, "predict_proba"):
        return None, {}

    try:
        probabilidades = np.asarray(clf_model.predict_proba(df_encoded)[0], dtype=float)
        clases_codificadas = np.asarray(
            getattr(clf_model, "classes_", np.arange(len(probabilidades))),
            dtype=int,
        )
        clases = target_encoder.inverse_transform(clases_codificadas)
    except (AttributeError, TypeError, ValueError, IndexError):
        # Un modelo sin probabilidades compatibles no debe romper una
        # simulación; el backend mostrará que el KPI no está disponible.
        return None, {}

    distribucion = {}
    probabilidad_comercial = 0.0
    encontro_clase_comercial = False
    for clase, probabilidad in zip(clases, probabilidades):
        etiqueta = str(clase)
        valor = max(0.0, min(1.0, float(probabilidad)))
        distribucion[etiqueta] = round(valor * 100.0, 1)
        if etiqueta.strip().lower() in {"alta", "media"}:
            probabilidad_comercial += valor
            encontro_clase_comercial = True

    if not encontro_clase_comercial:
        return None, distribucion
    return round(max(0.0, min(100.0, probabilidad_comercial * 100.0)), 1), distribucion


def predict(df_features, modelo_nombre="xgboost", area=1.0):
    """
    Recibe el DataFrame crudo (sin encodear), lo prepara, predice y calcula SHAP.
    Retorna un dict con todos los resultados listos para la respuesta JSON.
    """
    # Encodear las columnas categóricas
    df_encoded = df_features.copy()
    df_encoded[CATEGORICAL_COLS] = label_encoder.transform(df_encoded[CATEGORICAL_COLS].astype(str))

    if modelo_nombre not in MODELOS_DISPONIBLES:
        raise ValueError(f"Modelo no disponible: {modelo_nombre}")

    # Elegir modelo según lo que pidió el usuario
    if modelo_nombre == "random_forest":
        reg_model = rf_model
        clf_model = rf_clf_model
        explainer = rf_explainer
    else:
        reg_model = xgb_model
        clf_model = xgb_clf_model
        explainer = xgb_explainer

    # Predicción de rendimiento (regresión) y categoría (clasificación)
    prediccion_reg = float(reg_model.predict(df_encoded)[0])
    prediccion_reg = max(0.5, min(12.0, prediccion_reg))

    prediccion_clf_encoded = int(clf_model.predict(df_encoded)[0])
    prediccion_clf = str(target_encoder.inverse_transform([prediccion_clf_encoded])[0])
    probabilidad_cosecha, probabilidades_cosecha = _probabilidad_cosecha(clf_model, df_encoded)

    # SHAP - qué variable influyó más en la predicción
    shap_values = explainer.shap_values(df_encoded)[0]

    shap_dict = {
        "temperatura": round(float(shap_values[COLS_ORDER.index("temperatura_media_c")]), 4),
        "humedad": round(float(shap_values[COLS_ORDER.index("humedad_relativa_pct")]), 4),
        "precipitacion": round(float(shap_values[COLS_ORDER.index("precipitacion_mm")]), 4),
        "fertilizante": round(float(shap_values[COLS_ORDER.index("nitrogeno_kg_ha")]), 4),
        "phSuelo": round(float(shap_values[COLS_ORDER.index("ph_suelo")]), 4),
        "area": 0.0,
        "tipoSuelo": round(float(shap_values[COLS_ORDER.index("tipo_suelo")]), 4)
    }

    produccion_total = round(prediccion_reg * area, 2)
    r2 = model_metrics[modelo_nombre]["r2"]
    confianza = round(r2 * 100, 1)

    # Escenarios climáticos alternativos (qué pasa si llueve más, menos, o hay sequía)
    df_lluvioso = df_encoded.copy()
    df_lluvioso["precipitacion_mm"] = [1000.0]
    df_lluvioso["humedad_relativa_pct"] = [80.0]
    pred_lluvioso = float(reg_model.predict(df_lluvioso)[0])
    pred_lluvioso = max(0.5, min(12.0, pred_lluvioso))

    df_verano = df_encoded.copy()
    df_verano["precipitacion_mm"] = [700.0]
    df_verano["humedad_relativa_pct"] = [60.0]
    pred_verano = float(reg_model.predict(df_verano)[0])
    pred_verano = max(0.5, min(12.0, pred_verano))

    df_sequia = df_encoded.copy()
    df_sequia["precipitacion_mm"] = [300.0]
    df_sequia["humedad_relativa_pct"] = [40.0]
    df_sequia["temperatura_media_c"] = [33.0]
    pred_sequia = float(reg_model.predict(df_sequia)[0])
    pred_sequia = max(0.5, min(12.0, pred_sequia))

    escenarios = {
        "lluvioso": {
            "rendimiento": round(pred_lluvioso, 2),
            "produccion": round(pred_lluvioso * area, 2)
        },
        "verano": {
            "rendimiento": round(pred_verano, 2),
            "produccion": round(pred_verano * area, 2)
        },
        "sequia": {
            "rendimiento": round(pred_sequia, 2),
            "produccion": round(pred_sequia * area, 2)
        }
    }

    return {
        "success": True,
        "modelo": modelo_nombre,
        "rendimiento_estimado": round(prediccion_reg, 4),
        "produccion_total": produccion_total,
        "categoria_cosecha": prediccion_clf,
        "probabilidad_cosecha": probabilidad_cosecha,
        "probabilidades_cosecha": probabilidades_cosecha,
        "area": area,
        "confianza": confianza,
        "shap_values": shap_dict,
        "escenarios": escenarios,
        "metricas_modelo": model_metrics[modelo_nombre]
    }
