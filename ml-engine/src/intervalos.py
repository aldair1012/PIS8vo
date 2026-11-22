"""Rango orientativo utilizado por las simulaciones de ZeaSys."""


def intervalo_rendimiento(prediccion, metricas, objetivo):
    """Calcula un rango aproximado de predicción a partir de validación.

    El rango no es una garantía estadística ni reemplaza una medición en campo;
    comunica el error esperado del modelo para evitar presentar un único número
    como si fuera exacto. Las métricas nuevas proceden de GroupKFold por
    provincia, pero se mantiene un fallback para modelos antiguos.
    """
    try:
        rmse = max(0.0, float(metricas.get("rmse", 0.0)))
        mae = max(0.0, float(metricas.get("mae", 0.0)))
    except (TypeError, ValueError):
        rmse, mae = 0.0, 0.0

    try:
        minimo = float(objetivo.get("min", 0.5))
        maximo = float(objetivo.get("max", 12.0))
    except (AttributeError, TypeError, ValueError):
        minimo, maximo = 0.5, 12.0

    # 1.96 * RMSE es una aproximación conservadora; se etiqueta como tal en la
    # respuesta para no confundirla con un intervalo de confianza calibrado.
    margen = max(mae, 1.96 * rmse)
    # La predicción puede quedar fuera del rango histórico por el límite de
    # seguridad del predictor; en ese caso el intervalo nunca debe invertir
    # sus extremos ni excluir el valor que realmente se devolvió.
    limite_inferior = max(min(minimo, float(prediccion)), float(prediccion) - margen)
    limite_superior = min(max(maximo, float(prediccion)), float(prediccion) + margen)
    return {
        "min": round(limite_inferior, 2),
        "max": round(limite_superior, 2),
        "margen_aproximado": round(margen, 2),
        "error_medio_validacion": round(mae, 2),
        "nivel": "orientativo_no_calibrado",
    }
