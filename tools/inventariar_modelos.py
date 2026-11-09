"""Identifica artefactos locales sin modificarlos ni volver a entrenar."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ['ml-engine/models/xgboost.joblib', 'ml-engine/models/xgboost_clf.joblib',
         'ml-engine/models/label_encoder.joblib', 'ml-engine/models/target_encoder.joblib',
         'ml-engine/models/metrics.json', 'ml-engine/data/maiz_ecuador_training_data.csv',
         'ml-engine/scripts/retrain_models.py']


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as file:
        for block in iter(lambda: file.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def main():
    inventory = []
    for name in FILES:
        path = ROOT / name
        inventory.append({'archivo': name, 'sha256': sha256(path) if path.is_file() else None})
    print(json.dumps({'aviso': 'Las huellas identifican archivos; no acreditan origen ni precisión.', 'archivos': inventory}, indent=2, ensure_ascii=False))

if __name__ == '__main__': main()
