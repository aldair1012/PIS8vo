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

REQUIRED = ("parcela_id", "provincia", "fecha_prediccion", "fecha_cosecha", "modelo_version", "fuente_observacion", "prediccion_t_ha")


WEIGHING = ('produccion_seca_kg', 'area_cosechada_ha')
INTERVAL = ('rango_min_t_ha', 'rango_max_t_ha')


def evaluate(path: Path) -> dict:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = set(REQUIRED) - set(reader.fieldnames or ())
        if missing:
            raise ValueError("Faltan columnas: " + ", ".join(sorted(missing)))
        columns = set(reader.fieldnames)
        if 'cosecha_t_ha' not in columns and not set(WEIGHING) <= columns:
            raise ValueError("Falta cosecha_t_ha o el par produccion_seca_kg y area_cosechada_ha.")
        if len(set(WEIGHING) & columns) == 1:
            raise ValueError("Incluye peso y área en columnas separadas.")
        if len(set(INTERVAL) & set(reader.fieldnames)) == 1:
            raise ValueError("Incluye ambos extremos del rango guardado.")
        rows = list(reader)
    if not rows:
        raise ValueError("El archivo no contiene observaciones.")
    groups: dict[tuple[str, str], list[tuple[float, float, tuple[float, float] | None]]] = defaultdict(list)
    versions: dict[str, list[tuple[float, float, tuple[float, float] | None]]] = defaultdict(list)
    seen = set()
    mismo_dia = 0
    for line, row in enumerate(rows, 2):
        def fail(message):
            raise ValueError(f"Línea {line}: {message}")
        if any(not str(row.get(key) or "").strip() for key in REQUIRED):
            fail("todos los campos son obligatorios")
        try:
            pred_date = date.fromisoformat(row['fecha_prediccion'].strip())
            harvest_date = date.fromisoformat(row['fecha_cosecha'].strip())
            predicted = float(row['prediccion_t_ha'])
        except ValueError:
            fail("fechas o rendimientos inválidos")
        weighed = [str(row.get(key) or '').strip() for key in WEIGHING]
        reported = str(row.get('cosecha_t_ha') or '').strip()
        if any(weighed):
            if reported:
                fail("usa una sola base de cálculo por fila: peso y área, o rendimiento observado")
            try:
                kg, area = map(float, weighed)
            except ValueError:
                fail("peso y área deben ser numéricos")
            if not (math.isfinite(area) and area > 0 and math.isfinite(kg) and kg >= 0):
                fail("revisa el peso seco (kg) y el área efectivamente cosechada (ha)")
            observed = kg / 1000 / area
        else:
            try:
                observed = float(reported)
            except ValueError:
                fail("falta un rendimiento observado válido o peso y área de cosecha")
        if pred_date > harvest_date:
            fail("la predicción debe ser anterior o igual a la cosecha")
        if not all(math.isfinite(value) and value >= 0 for value in (predicted, observed)):
            fail("los rendimientos deben ser números finitos no negativos")
        key = (row['parcela_id'].strip(), harvest_date.isoformat())
        if key in seen:
            fail("cosecha duplicada para la misma parcela y fecha")
        seen.add(key)
        intervalo = None
        extremos = [str(row.get(key) or '').strip() for key in INTERVAL]
        if any(extremos):
            try:
                inferior, superior = map(float, extremos)
            except ValueError:
                fail("se necesitan dos extremos numéricos para evaluar el rango")
            if not (math.isfinite(inferior) and math.isfinite(superior) and 0 <= inferior <= superior):
                fail("rango negativo, invertido o no finito")
            intervalo = (inferior, superior)
        mismo_dia += pred_date == harvest_date
        pair = (predicted, observed, intervalo)
        groups[(row['provincia'].strip(), str(harvest_date.year))].append(pair)
        versions[row['modelo_version'].strip()].append(pair)

    def metrics(values):
        errors = [predicted - observed for predicted, observed, _ in values]
        rangos = [(observed, bounds) for _, observed, bounds in values if bounds is not None]
        dentro = sum(lo <= observed <= hi for observed, (lo, hi) in rangos)
        return {"rangos_guardados": len(rangos), "cosechas_dentro_del_rango": dentro,
                "cobertura_observada": dentro / len(rangos) if rangos else None,
                "n": len(errors), "mae_t_ha": statistics.fmean(abs(e) for e in errors),
                "rmse_t_ha": math.sqrt(statistics.fmean(e * e for e in errors)),
                "sesgo_t_ha": statistics.fmean(errors)}

    return {"aviso": "Resultados descriptivos de las filas suministradas; no demuestran representatividad ni verifican automáticamente el origen.",
            "predicciones_el_dia_de_cosecha": mismo_dia,
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
