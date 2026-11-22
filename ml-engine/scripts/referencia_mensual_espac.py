"""Referencia pre-siembra por provincia, producto y mes. Particiones por segmento de encuesta."""
import json
import math
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.espac_dataset import prepare, ROOT


def construir(frame, calidad, edicion=2025):
    frame = frame.copy()
    angulo = np.arctan2(frame.mes_siembra_sin, frame.mes_siembra_cos)
    frame["mes"] = (np.rint(angulo * 12 / (2*np.pi)).astype(int) - 1) % 12 + 1
    # La misma unidad muestral siempre cae en el mismo bloque, incluso si tiene varios lotes.
    bloque = frame.grupo_segmento.map(lambda valor: int(valor[:8], 16) % 10)
    ajuste, calibracion, prueba = frame[bloque < 6], frame[bloque.between(6, 7)], frame[bloque >= 8]
    claves = ["provincia", "tipo_maiz", "mes"]
    celdas = []
    for (provincia, producto, mes), grupo in ajuste.groupby(claves):
        if grupo.grupo_segmento.nunique() < 5:
            continue
        grupo = grupo.sort_values("rendimiento_t_ha")
        i = np.searchsorted(grupo.peso_encuesta.cumsum(), grupo.peso_encuesta.sum() / 2)
        celdas.append({"provincia": provincia, "tipo_maiz": producto, "mes": int(mes),
                       "mediana": float(grupo.rendimiento_t_ha.iloc[i]), "parcelas": len(grupo),
                       "segmentos": int(grupo.grupo_segmento.nunique())})
    import pandas as pd
    tabla = pd.DataFrame(celdas)
    def evaluar(datos):
        unidos = datos.merge(tabla, on=claves, validate="many_to_one")
        return np.abs(unidos.rendimiento_t_ha - unidos.mediana).to_numpy()

    residuos = np.sort(evaluar(calibracion))
    errores = evaluar(prueba)
    if len(residuos) < 20 or not len(errores):
        raise ValueError("Faltan observaciones independientes para calibrar y probar.")
    bandas = []
    for nivel in (0.5, 0.9):
        margen = float(residuos[math.ceil((len(residuos)+1)*nivel)-1])
        bandas.append({"nivel": nivel, "margen": margen, "aciertos_prueba": int(np.sum(errores <= margen))})
    base_por_tipo = {}
    for producto, grupo in ajuste.groupby("tipo_maiz"):
        grupo = grupo.sort_values("rendimiento_t_ha")
        pos = np.searchsorted(grupo.peso_encuesta.cumsum(), grupo.peso_encuesta.sum()/2)
        base_por_tipo[producto] = float(grupo.rendimiento_t_ha.iloc[pos])
    return {"edicion": edicion, "fuente": calidad["fuente"], "sha256": calidad["sha256"], "base_por_tipo": base_por_tipo,
            "total": len(frame), "ajuste": len(ajuste), "calibracion": len(residuos),
            "prueba": len(errores), "prueba_total": len(prueba), "mae": float(errores.mean()),
            "rmse": float(np.sqrt(np.mean(errores ** 2))), "bandas": bandas, "celdas": celdas}


if __name__ == "__main__":
    archivo = ROOT / "documentacion/fuentes-maiz/candidatos/maiz_espac2025_original.csv"
    datos = construir(*prepare(archivo))
    destino = ROOT / "backend-api/data/referencias/planificacion-mensual-espac.json"
    destino.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
