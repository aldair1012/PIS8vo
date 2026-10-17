import os
import json
import shutil
from datetime import datetime
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.preprocessing import OrdinalEncoder, LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, accuracy_score, f1_score
import xgboost as xgb
import joblib

# Rutas (Paths)
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ML_ENGINE_DIR = os.path.dirname(SCRIPTS_DIR)
DATA_PATH = os.path.join(ML_ENGINE_DIR, "data", "maiz_ecuador_training_data.csv")
MODELS_DIR = os.path.join(ML_ENGINE_DIR, "models")

print(f"[ML Retrain] Base directory: {ML_ENGINE_DIR}")
print(f"[ML Retrain] Loading training data from {DATA_PATH}")

df = pd.read_csv(DATA_PATH)

categorical_cols = [
    "zona", "provincia", "variedad", "tipo_grano", "riego_tipo", 
    "tipo_suelo", "plagas_presentes", "control_plaga"
]

X = df.drop(columns=["rendimiento_t_ha", "categoria_cosecha"])
y_reg = df["rendimiento_t_ha"]
y_clf = df["categoria_cosecha"]

# Respaldar modelos actuales si existen
backup_folder_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
backup_dir = os.path.join(MODELS_DIR, backup_folder_name)
os.makedirs(backup_dir, exist_ok=True)

files_to_backup = [
    "random_forest.joblib",
    "xgboost.joblib",
    "random_forest_clf.joblib",
    "xgboost_clf.joblib",
    "label_encoder.joblib",
    "target_encoder.joblib",
    "metrics.json"
]

backup_count = 0
for file in files_to_backup:
    src_file = os.path.join(MODELS_DIR, file)
    if os.path.exists(src_file):
        shutil.copy(src_file, os.path.join(backup_dir, file))
        backup_count += 1

if backup_count > 0:
    print(f"[ML Retrain] Backed up {backup_count} current files to {backup_dir}")
else:
    print("[ML Retrain] No existing models found to backup.")

# Encoders fitting
print("[ML Retrain] Encoding categorical features...")
encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
X[categorical_cols] = encoder.fit_transform(X[categorical_cols].astype(str))

label_encoder = LabelEncoder()
y_clf_encoded = label_encoder.fit_transform(y_clf)

# Divisiones (Splits)
X_train_reg, X_test_reg, y_train_reg, y_test_reg = train_test_split(
    X, y_reg, test_size=0.2, random_state=42
)
X_train_clf, X_test_clf, y_train_clf, y_test_clf = train_test_split(
    X, y_clf_encoded, test_size=0.2, random_state=42
)

# 1. Entrenamiento de Regresores
print("[ML Retrain] Training Regressors with optimized parameters...")

# Regresor Random Forest Ajustado
rf_reg = RandomForestRegressor(
    n_estimators=300,
    max_depth=12,
    min_samples_split=5,
    min_samples_leaf=2,
    max_features="sqrt",
    random_state=42,
    n_jobs=-1
)
rf_reg.fit(X_train_reg, y_train_reg)

# Regresor XGBoost Ajustado
xgb_reg = xgb.XGBRegressor(
    n_estimators=600,
    max_depth=4,
    learning_rate=0.03,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    random_state=42,
    n_jobs=-1
)
xgb_reg.fit(X_train_reg, y_train_reg)

# Evaluar Regresores
rf_reg_pred = rf_reg.predict(X_test_reg)
rf_mae = float(mean_absolute_error(y_test_reg, rf_reg_pred))
rf_rmse = float(np.sqrt(mean_squared_error(y_test_reg, rf_reg_pred)))
rf_r2 = float(r2_score(y_test_reg, rf_reg_pred))

xgb_reg_pred = xgb_reg.predict(X_test_reg)
xgb_mae = float(mean_absolute_error(y_test_reg, xgb_reg_pred))
xgb_rmse = float(np.sqrt(mean_squared_error(y_test_reg, xgb_reg_pred)))
xgb_r2 = float(r2_score(y_test_reg, xgb_reg_pred))

print(f"[ML Retrain] RF Regressor R2: {rf_r2:.4f} | MAE: {rf_mae:.4f}")
print(f"[ML Retrain] XGB Regressor R2: {xgb_r2:.4f} | MAE: {xgb_mae:.4f}")

# 2. Entrenamiento de Clasificadores
print("[ML Retrain] Training Classifiers with optimized parameters...")

# Clasificador Random Forest Ajustado
rf_clf = RandomForestClassifier(
    n_estimators=300,
    max_depth=12,
    min_samples_split=5,
    min_samples_leaf=2,
    max_features="sqrt",
    random_state=42,
    n_jobs=-1
)
rf_clf.fit(X_train_clf, y_train_clf)

# Clasificador XGBoost Ajustado
xgb_clf = xgb.XGBClassifier(
    n_estimators=300,
    max_depth=4,
    learning_rate=0.03,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    n_jobs=-1
)
xgb_clf.fit(X_train_clf, y_train_clf)

# Evaluar Clasificadores
rf_clf_pred = rf_clf.predict(X_test_clf)
rf_acc = float(accuracy_score(y_test_clf, rf_clf_pred))
rf_f1 = float(f1_score(y_test_clf, rf_clf_pred, average="weighted"))

xgb_clf_pred = xgb_clf.predict(X_test_clf)
xgb_acc = float(accuracy_score(y_test_clf, xgb_clf_pred))
xgb_f1 = float(f1_score(y_test_clf, xgb_clf_pred, average="weighted"))

print(f"[ML Retrain] RF Classifier Accuracy: {rf_acc:.4f} | F1: {rf_f1:.4f}")
print(f"[ML Retrain] XGB Classifier Accuracy: {xgb_acc:.4f} | F1: {xgb_f1:.4f}")

# --- Validación: solo reemplazar si el modelo nuevo es mejor o igual ---
metrics_path = os.path.join(MODELS_DIR, "metrics.json")
current_metrics = {}
if os.path.exists(metrics_path):
    with open(metrics_path, "r") as f:
        current_metrics = json.load(f)

new_metrics = {
    "random_forest": {"mae": rf_mae, "rmse": rf_rmse, "r2": rf_r2},
    "xgboost": {"mae": xgb_mae, "rmse": xgb_rmse, "r2": xgb_r2},
    "random_forest_clf": {"accuracy": rf_acc, "f1": rf_f1},
    "xgboost_clf": {"accuracy": xgb_acc, "f1": xgb_f1}
}

# Comparar RMSE del modelo actual vs el nuevo (menor = mejor)
rf_current_rmse = current_metrics.get("random_forest", {}).get("rmse", float("inf"))
xgb_current_rmse = current_metrics.get("xgboost", {}).get("rmse", float("inf"))

rf_improved = rf_rmse <= rf_current_rmse
xgb_improved = xgb_rmse <= xgb_current_rmse

if rf_improved and xgb_improved:
    print(f"[ML Retrain] [OK] Modelos nuevos son iguales o mejores. Guardando...")
    print(f"  RF RMSE: {rf_current_rmse:.4f} -> {rf_rmse:.4f}")
    print(f"  XGB RMSE: {xgb_current_rmse:.4f} -> {xgb_rmse:.4f}")

    joblib.dump(rf_reg, os.path.join(MODELS_DIR, "random_forest.joblib"))
    joblib.dump(xgb_reg, os.path.join(MODELS_DIR, "xgboost.joblib"))
    joblib.dump(rf_clf, os.path.join(MODELS_DIR, "random_forest_clf.joblib"))
    joblib.dump(xgb_clf, os.path.join(MODELS_DIR, "xgboost_clf.joblib"))
    joblib.dump(encoder, os.path.join(MODELS_DIR, "label_encoder.joblib"))
    joblib.dump(label_encoder, os.path.join(MODELS_DIR, "target_encoder.joblib"))

    with open(metrics_path, "w") as f:
        json.dump(new_metrics, f, indent=4)

    print(f"[ML Retrain] Metricas actualizadas en {metrics_path}")
    print("[ML Retrain] Re-entrenamiento completado exitosamente.")
else:
    print(f"[ML Retrain] [WARN] Los modelos nuevos NO mejoraron respecto a los actuales.")
    print(f"  RF RMSE actual: {rf_current_rmse:.4f} | nuevo: {rf_rmse:.4f} {'[OK]' if rf_improved else '[FAIL]'}")
    print(f"  XGB RMSE actual: {xgb_current_rmse:.4f} | nuevo: {xgb_rmse:.4f} {'[OK]' if xgb_improved else '[FAIL]'}")
    print("[ML Retrain] Se conservan los modelos anteriores. El backup queda en:", backup_dir)
