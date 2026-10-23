"""Reentrena y valida los modelos del motor de simulación.

El entrenamiento anterior usaba una sola partición aleatoria. Eso podía
inflar las métricas cuando había observaciones repetidas o muestras de una
misma provincia en entrenamiento y prueba. Este script entrena únicamente
XGBoost, valida por provincia con GroupKFold, elimina duplicados exactos y
deja registrada la calidad y el origen de cada métrica.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder


SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ML_ENGINE_DIR = os.path.dirname(SCRIPTS_DIR)
DATA_PATH = os.path.join(ML_ENGINE_DIR, "data", "maiz_ecuador_training_data.csv")
MODELS_DIR = os.path.join(ML_ENGINE_DIR, "models")

CATEGORICAL_COLS = [
    "zona",
    "provincia",
    "variedad",
    "tipo_grano",
    "riego_tipo",
    "tipo_suelo",
    "plagas_presentes",
    "control_plaga",
]
TARGET_REG = "rendimiento_t_ha"
TARGET_CLF = "categoria_cosecha"
GROUP_COL = "provincia"


def _xgb_regressor():
    """Regresor XGBoost usado para rendimiento en t/ha."""
    return xgb.XGBRegressor(
        n_estimators=600,
        max_depth=4,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
    )


def _xgb_classifier():
    """Clasificador XGBoost usado para categoría y probabilidad de cosecha."""
    return xgb.XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        eval_metric="mlogloss",
    )


def _regression_metrics(y_true, prediction):
    return {
        "mae": float(mean_absolute_error(y_true, prediction)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, prediction))),
        "r2": float(r2_score(y_true, prediction)),
    }


def _classification_metrics(y_true, prediction):
    return {
        "accuracy": float(accuracy_score(y_true, prediction)),
        "f1": float(f1_score(y_true, prediction, average="weighted", zero_division=0)),
    }


def _encode_fold(X_raw, train_idx, test_idx):
    """Ajusta categorías sólo con el pliegue de entrenamiento.

    Así una provincia reservada para prueba no filtra su código categórico al
    modelo y se comporta como una categoría desconocida, igual que en una
    parcela nueva en producción.
    """
    train_features = X_raw.iloc[train_idx].copy()
    test_features = X_raw.iloc[test_idx].copy()
    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    train_features[CATEGORICAL_COLS] = encoder.fit_transform(
        train_features[CATEGORICAL_COLS].astype(str)
    )
    test_features[CATEGORICAL_COLS] = encoder.transform(
        test_features[CATEGORICAL_COLS].astype(str)
    )
    return train_features, test_features


def _cross_validate_regressor(factory, X_raw, y, groups, n_splits):
    """Valida por grupos y devuelve medias y métricas de cada pliegue."""
    folds = []
    splitter = GroupKFold(n_splits=n_splits)
    for train_idx, test_idx in splitter.split(X_raw, y, groups):
        train_features, test_features = _encode_fold(X_raw, train_idx, test_idx)
        model = factory()
        model.fit(train_features, y.iloc[train_idx])
        prediction = model.predict(test_features)
        folds.append(_regression_metrics(y.iloc[test_idx], prediction))

    return {
        key: float(np.mean([fold[key] for fold in folds]))
        for key in ("mae", "rmse", "r2")
    } | {"folds": folds}


def _cross_validate_classifier(factory, X_raw, y, groups, n_splits):
    folds = []
    splitter = GroupKFold(n_splits=n_splits)
    for train_idx, test_idx in splitter.split(X_raw, y, groups):
        train_features, test_features = _encode_fold(X_raw, train_idx, test_idx)
        model = factory()
        model.fit(train_features, y.iloc[train_idx])
        prediction = model.predict(test_features)
        folds.append(_classification_metrics(y.iloc[test_idx], prediction))

    return {
        key: float(np.mean([fold[key] for fold in folds]))
        for key in ("accuracy", "f1")
    } | {"folds": folds}


def _backup_current_models():
    os.makedirs(MODELS_DIR, exist_ok=True)
    backup_dir = os.path.join(
        MODELS_DIR, f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    )
    files = [
        "xgboost.joblib",
        "xgboost_clf.joblib",
        "label_encoder.joblib",
        "target_encoder.joblib",
        "metrics.json",
    ]
    copied = 0
    for name in files:
        source = os.path.join(MODELS_DIR, name)
        if os.path.exists(source):
            os.makedirs(backup_dir, exist_ok=True)
            shutil.copy2(source, os.path.join(backup_dir, name))
            copied += 1
    return backup_dir if copied else None


def _load_current_metrics():
    path = os.path.join(MODELS_DIR, "metrics.json")
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}


def train(force=False):
    print(f"[ML Retrain] Base directory: {ML_ENGINE_DIR}")
    print(f"[ML Retrain] Loading training data from {DATA_PATH}")
    frame = pd.read_csv(DATA_PATH)

    required = set(CATEGORICAL_COLS + [TARGET_REG, TARGET_CLF, GROUP_COL])
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"Faltan columnas requeridas en el dataset: {', '.join(missing)}")

    feature_cols = [column for column in frame.columns if column not in (TARGET_REG, TARGET_CLF)]
    original_rows = len(frame)
    duplicate_mask = frame.duplicated(subset=feature_cols + [TARGET_REG, TARGET_CLF], keep="first")
    frame = frame.loc[~duplicate_mask].reset_index(drop=True)
    removed_duplicates = int(duplicate_mask.sum())

    X_raw = frame[feature_cols].copy()
    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    X = X_raw.copy()
    X[CATEGORICAL_COLS] = encoder.fit_transform(X[CATEGORICAL_COLS].astype(str))
    y_reg = frame[TARGET_REG].astype(float)
    target_encoder = LabelEncoder()
    y_clf = pd.Series(target_encoder.fit_transform(frame[TARGET_CLF].astype(str)))
    groups = frame[GROUP_COL].astype(str)

    n_splits = min(5, int(groups.nunique()))
    if n_splits < 2:
        raise ValueError("Se necesitan al menos dos grupos distintos para validar por provincia")

    print(
        f"[ML Retrain] Filas: {original_rows} -> {len(frame)} "
        f"(duplicados exactos removidos: {removed_duplicates}); "
        f"grupos {GROUP_COL}: {groups.nunique()}"
    )

    print(f"[ML Retrain] Validando xgboost con GroupKFold ({n_splits} grupos)...")
    xgb_reg_cv = _cross_validate_regressor(_xgb_regressor, X_raw, y_reg, groups, n_splits)
    xgb_reg = _xgb_regressor()
    xgb_reg.fit(X, y_reg)
    print(
        f"  xgboost: RMSE {xgb_reg_cv['rmse']:.4f} | "
        f"MAE {xgb_reg_cv['mae']:.4f} | R² {xgb_reg_cv['r2']:.4f}"
    )

    print("[ML Retrain] Validando xgboost_clf con GroupKFold...")
    xgb_clf_cv = _cross_validate_classifier(_xgb_classifier, X_raw, y_clf, groups, n_splits)
    xgb_clf = _xgb_classifier()
    xgb_clf.fit(X, y_clf)
    print(
        f"  xgboost_clf: accuracy {xgb_clf_cv['accuracy']:.4f} | "
        f"F1 {xgb_clf_cv['f1']:.4f}"
    )

    current_metrics = _load_current_metrics()
    current_validation = current_metrics.get("validacion_agrupada", {}).get("regresion", {})
    current_xgb_rmse = current_validation.get("xgboost", {}).get("rmse")
    new_xgb_rmse = xgb_reg_cv["rmse"]
    should_publish = force or current_xgb_rmse is None or new_xgb_rmse <= float(current_xgb_rmse) + 1e-9

    metrics = {
        "xgboost": {
            "mae": xgb_reg_cv["mae"],
            "rmse": xgb_reg_cv["rmse"],
            "r2": xgb_reg_cv["r2"],
            "validacion": "GroupKFold por provincia",
        },
        "xgboost_clf": {
            "accuracy": xgb_clf_cv["accuracy"],
            "f1": xgb_clf_cv["f1"],
            "validacion": "GroupKFold por provincia",
        },
    }
    metrics.update(
        {
            "modelo_principal": "xgboost",
            "criterio_seleccion": "XGBoost es el único modelo habilitado",
            "validacion_agrupada": {
                "estrategia": "GroupKFold",
                "grupo": GROUP_COL,
                "pliegues": n_splits,
                "regresion": {"xgboost": xgb_reg_cv},
                "clasificacion": {"xgboost_clf": xgb_clf_cv},
            },
            "dataset": {
                "filas_originales": original_rows,
                "filas_utilizadas": len(frame),
                "duplicados_exactos_removidos": removed_duplicates,
                "grupos": int(groups.nunique()),
                "columna_grupo": GROUP_COL,
            },
            "rango_objetivo": {
                "min": float(y_reg.min()),
                "max": float(y_reg.max()),
            },
        }
    )

    if not should_publish:
        print(
            "[ML Retrain] [WARN] XGBoost nuevo no mejora el RMSE agrupado. "
            f"Actual: {current_xgb_rmse} -> nuevo: {new_xgb_rmse:.4f}. "
            "Se conservan los modelos."
        )
        return metrics

    backup_dir = _backup_current_models()
    if backup_dir:
        print(f"[ML Retrain] Backup creado en {backup_dir}")

    joblib.dump(xgb_reg, os.path.join(MODELS_DIR, "xgboost.joblib"))
    joblib.dump(xgb_clf, os.path.join(MODELS_DIR, "xgboost_clf.joblib"))
    joblib.dump(encoder, os.path.join(MODELS_DIR, "label_encoder.joblib"))
    joblib.dump(target_encoder, os.path.join(MODELS_DIR, "target_encoder.joblib"))

    with open(os.path.join(MODELS_DIR, "metrics.json"), "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=4, ensure_ascii=False)

    print("[ML Retrain] [OK] XGBoost publicado como único modelo de simulación.")
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reentrena los modelos de ZeaSys")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Publica aunque el RMSE de XGBoost no mejore al último entrenamiento",
    )
    args = parser.parse_args()
    train(force=args.force)
