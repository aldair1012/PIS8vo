# app.py - Servidor Flask. Solo rutas HTTP que delegan a predictor y feature_builder.

import logging
import math
import os

from flask import Flask, request, jsonify
from flask_cors import CORS
from src import feature_builder, predictor

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024

_origins = os.getenv(
    "ZEASYS_CORS_ORIGINS",
    "http://localhost,http://127.0.0.1,http://localhost:5500,http://127.0.0.1:5500",
)
CORS(
    app,
    resources={r"/*": {"origins": [origin.strip() for origin in _origins.split(",") if origin.strip()]}},
)


@app.errorhandler(413)
def payload_demasiado_grande(_error):
    return jsonify({"error": "El cuerpo de la petición supera 1 MB"}), 413


def _validar_numero(data, campo, *, minimo=None, maximo=None):
    """Convierte y valida un campo numérico sin aceptar NaN ni infinitos."""
    try:
        valor = float(data[campo])
    except (KeyError, TypeError, ValueError):
        raise ValueError(f"El campo {campo} debe ser numérico") from None

    if not math.isfinite(valor):
        raise ValueError(f"El campo {campo} debe ser un número finito")
    if minimo is not None and valor < minimo:
        raise ValueError(f"El campo {campo} debe ser mayor o igual a {minimo}")
    if maximo is not None and valor > maximo:
        raise ValueError(f"El campo {campo} debe ser menor o igual a {maximo}")
    return valor


def _validar_entrada(data):
    if not isinstance(data, dict) or not data:
        raise ValueError("No se recibieron datos JSON")

    campos_requeridos = (
        "temperatura", "humedad", "precipitacion",
        "fertilizante", "phSuelo", "area", "tipoSuelo",
    )
    faltantes = [campo for campo in campos_requeridos if campo not in data]
    if faltantes:
        raise ValueError(f"Campo requerido faltante: {faltantes[0]}")

    # Límites físicos básicos. Los rangos agronómicos óptimos se evalúan después;
    # aquí solo se rechazan entradas imposibles o peligrosas para el modelo.
    _validar_numero(data, "temperatura", minimo=-100, maximo=100)
    _validar_numero(data, "humedad", minimo=0, maximo=100)
    _validar_numero(data, "precipitacion", minimo=0)
    _validar_numero(data, "fertilizante", minimo=0)
    _validar_numero(data, "phSuelo", minimo=0, maximo=14)
    _validar_numero(data, "area", minimo=0.01)

    if not isinstance(data["tipoSuelo"], str) or not data["tipoSuelo"].strip():
        raise ValueError("El campo tipoSuelo debe ser un texto no vacío")

    for campo, minimo, maximo in (("latitud", -90, 90), ("longitud", -180, 180)):
        if data.get(campo) is not None:
            _validar_numero(data, campo, minimo=minimo, maximo=maximo)


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "success": True,
        "message": "ZeaSys Engine activo",
        "endpoints": {
            "/": "Info del servidor (GET)",
            "/health": "Estado de salud (GET)",
            "/metrics": "Métricas de los modelos (GET)",
            "/stats": "Estadísticas por zona (GET)",
            "/predict": "Predicción de rendimiento (POST)"
        }
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "modelos_cargados": predictor.MODELOS_DISPONIBLES,
        "version": "2.1.0"
    })


@app.route("/metrics", methods=["GET"])
def metrics():
    return jsonify(predictor.model_metrics)


@app.route("/predict", methods=["POST"])
def predict_route():
    if not request.is_json:
        return jsonify({"error": "Content-Type debe ser application/json"}), 415

    try:
        data = request.get_json(silent=True)
        _validar_entrada(data)

        modelo_nombre = data.get("modelo", "xgboost")
        if not isinstance(modelo_nombre, str):
            return jsonify({
                "error": "Modelo no disponible",
                "modelos_disponibles": predictor.MODELOS_DISPONIBLES
            }), 400
        modelo_nombre = modelo_nombre.strip().lower()
        if modelo_nombre not in predictor.MODELOS_DISPONIBLES:
            return jsonify({
                "error": "Modelo no disponible",
                "modelos_disponibles": predictor.MODELOS_DISPONIBLES
            }), 400
        data["modelo"] = modelo_nombre.lower()
        data["tipoSuelo"] = data["tipoSuelo"].strip().lower()

        # 1) Construir features
        df_features, metadata = feature_builder.build_features(data)

        # 2) Predecir
        area = float(data["area"])
        resultado = predictor.predict(df_features, modelo_nombre, area)

        # 3) Generar recomendaciones agronómicas
        recomendaciones = feature_builder.generar_recomendaciones(
            metadata["datos_entrada"], metadata["zona"]
        )
        resultado["recomendaciones"] = recomendaciones
        resultado["precision_data"] = metadata["precision_data"]

        return jsonify(resultado)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        app.logger.exception("Error interno durante la predicción")
        return jsonify({"error": "Error interno del motor de simulación"}), 500


@app.route("/stats", methods=["GET"])
def stats():
    try:
        stats_dict = {}
        zones = feature_builder.df_reference["zona"].unique()
        for zone in zones:
            sub = feature_builder.df_reference[feature_builder.df_reference["zona"] == zone]
            stats_dict[zone] = {
                "total_registros": int(len(sub)),
                "rendimiento_promedio": round(float(sub["rendimiento_t_ha"].mean()), 2),
                "rendimiento_max": round(float(sub["rendimiento_t_ha"].max()), 2),
                "temperatura_promedio": round(float(sub["temperatura_media_c"].mean()), 2),
                "precipitacion_promedio": round(float(sub["precipitacion_mm"].mean()), 2),
                "fertilizacion_promedio": round(float(sub["nitrogeno_kg_ha"].mean()), 2),
                "ph_promedio": round(float(sub["ph_suelo"].mean()), 2)
            }
        return jsonify({
            "success": True,
            "estadisticas_por_zona": stats_dict
        })
    except Exception as e:
        app.logger.exception("Error al calcular estadísticas")
        return jsonify({"error": "Error interno del motor de simulación"}), 500


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("\n" + "=" * 50)
    print("   ZeaSys ML Engine v2.1")
    print("   http://localhost:5000")
    print("=" * 50 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
