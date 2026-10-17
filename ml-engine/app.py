# app.py - Servidor Flask. Solo rutas HTTP que delegan a predictor y feature_builder.

from flask import Flask, request, jsonify
from flask_cors import CORS
from src import feature_builder, predictor

app = Flask(__name__)
CORS(app)


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
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No se recibieron datos JSON"}), 400

        campos_requeridos = [
            "temperatura", "humedad", "precipitacion",
            "fertilizante", "phSuelo", "area", "tipoSuelo"
        ]
        for campo in campos_requeridos:
            if campo not in data:
                return jsonify({"error": f"Campo requerido faltante: {campo}"}), 400

        modelo_nombre = data.get("modelo", "xgboost")
        if not isinstance(modelo_nombre, str) or modelo_nombre.lower() not in predictor.MODELOS_DISPONIBLES:
            return jsonify({
                "error": "Modelo no disponible",
                "modelos_disponibles": predictor.MODELOS_DISPONIBLES
            }), 400
        data["modelo"] = modelo_nombre.lower()

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

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"Error interno del motor de simulación: {str(e)}"}), 500


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
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("   ZeaSys ML Engine v2.1")
    print("   http://localhost:5000")
    print("=" * 50 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
