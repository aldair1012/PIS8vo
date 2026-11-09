"""Motor real para integración; simula indisponibilidad de proveedores externos.

No modifica la aplicación ni el modelo: solo evita depender de red en esta prueba.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "ml-engine"))
import app as engine

engine.feature_builder.fetch_precision_soil = lambda *_args, **_kwargs: None
engine.feature_builder.fetch_precision_weather = lambda *_args, **_kwargs: None
engine.app.run(host="127.0.0.1", port=int(sys.argv[1]), debug=False)
