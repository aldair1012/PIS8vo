"""Comprueba MLflow en una carpeta de laboratorio con datos explícitamente ficticios."""
import os
from pathlib import Path
import uuid
import mlflow
from mlflow.tracking import MlflowClient

lab = (Path(os.environ['TEMP']) / 'zeasys-lab-tools' / 'mlflow-test').resolve()
lab.mkdir(parents=True, exist_ok=True)
uri = 'sqlite:///' + (lab / 'tracking.sqlite').as_posix()
mlflow.set_tracking_uri(uri)
client = MlflowClient()
experiment = client.create_experiment('prueba-ficticia-' + uuid.uuid4().hex[:8], artifact_location=(lab / 'artifacts').as_uri())
with mlflow.start_run(experiment_id=experiment) as run:
    mlflow.set_tag('origen', 'prueba_ficticia_no_es_modelo_real')
    mlflow.log_param('algoritmo', 'modelo-ficticio')
    mlflow.log_metric('error_ficticio', 1.5)
    run_id = run.info.run_id
retrieved = client.get_run(run_id)
if retrieved.data.params.get('algoritmo') != 'modelo-ficticio' or retrieved.data.metrics.get('error_ficticio') != 1.5:
    raise RuntimeError('No se recuperaron los valores ficticios guardados')
(lab / 'modelo-ficticio').mkdir(exist_ok=True)
(lab / 'modelo-ficticio' / 'AVISO.txt').write_text('Prueba ficticia: no es un modelo utilizable.', encoding='utf-8')
name = 'zeasys-prueba-ficticia-' + uuid.uuid4().hex[:8]
client.create_registered_model(name)
model = client.create_model_version(name=name, source=(lab / 'modelo-ficticio').as_uri(), run_id=run_id, description='Solo prueba, no usar en producción')
readback = client.get_model_version(name, model.version)
if readback.run_id != run_id:
    raise RuntimeError('El registro de modelo no conserva la vinculación')
print('OK: parámetros, métrica ficticia y versión vinculada recuperados desde SQLite aislado.')
