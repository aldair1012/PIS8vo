"""Evalúa predicciones históricas frente a cosechas verificadas, sin entrenar ni publicar modelos."""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from datetime import date
from pathlib import Path

REQUIRED = ("parcela_id", "provincia", "fecha_prediccion", "fecha_cosecha", "modelo_version", "fuente_observacion", "prediccion_t_ha", "cosecha_t_ha")


def evaluate(path: Path) -> dict:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = set(REQUIRED) - set(reader.fieldnames or ())
        if missing:
            raise ValueError("Faltan columnas: " + ", ".join(sorted(missing)))
        rows = list(reader)
    if not rows:
        raise ValueError("El archivo no contiene observaciones.")
    groups: dict[tuple[str, str], list[tuple[float, float]]] = defaultdict(list)
    versions: dict[str, list[tuple[float, float]]] = defaultdict(list)
    seen = set()
    for line, row in enumerate(rows, 2):
        def fail(message):
            raise ValueError(f"Línea {line}: {message}")
        if any(not str(row.get(key) or "").strip() for key in REQUIRED):
            fail("todos los campos son obligatorios")
        try:
            pred_date = date.fromisoformat(row['fecha_prediccion'].strip())
            harvest_date = date.fromisoformat(row['fecha_cosecha'].strip())
            predicted = float(row['prediccion_t_ha'])
            observed = float(row['cosecha_t_ha'])
        except ValueError:
            fail("fechas o rendimientos inválidos")
        if pred_date > harvest_date:
            fail("la predicción debe ser anterior o igual a la cosecha")
        if not all(math.isfinite(value) and value >= 0 for value in (predicted, observed)):
            fail("los rendimientos deben ser números finitos no negativos")
        key = (row['parcela_id'].strip(), harvest_date.isoformat())
        if key in seen:
            fail("cosecha duplicada para la misma parcela y fecha")
        seen.add(key)
        pair = (predicted, observed)
        groups[(row['provincia'].strip(), str(harvest_date.year))].append(pair)
        versions[row['modelo_version'].strip()].append(pair)

    def metrics(values):
        errors = [predicted - observed for predicted, observed in values]
        return {"n": len(errors), "mae_t_ha": statistics.fmean(abs(e) for e in errors),
                "rmse_t_ha": math.sqrt(statistics.fmean(e * e for e in errors)),
                "sesgo_t_ha": statistics.fmean(errors)}

    return {"aviso": "Resultados descriptivos de las filas suministradas; no demuestran representatividad ni verifican automáticamente el origen.",
            "total": metrics([pair for values in groups.values() for pair in values]),
            "por_provincia_y_anio": [{"provincia": province, "anio": year, **metrics(values)} for (province, year), values in sorted(groups.items())],
            "por_version": [{"modelo_version": version, **metrics(values)} for version, values in sorted(versions.items())]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archivo", type=Path, help="CSV con predicciones guardadas y cosechas verificadas")
    args = parser.parse_args()
    try:
        print(json.dumps(evaluate(args.archivo), ensure_ascii=False, indent=2, allow_nan=False))
    except (OSError, ValueError, OverflowError) as exc:
        parser.exit(2, f"No se pudo evaluar: {exc}\n")


if __name__ == "__main__":
    main()
