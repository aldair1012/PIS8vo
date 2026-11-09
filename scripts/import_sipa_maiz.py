"""Import the official SIPA/MAGP maize workbook into the Rendimiento view.

Usage: python scripts/import_sipa_maiz.py [--input spr-mag.xlsx]
Requires openpyxl for reading the source workbook. The output is a compact,
auditable snapshot; rerun this script when SIPA publishes a revision.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import urllib.request
from datetime import date
from pathlib import Path

from openpyxl import load_workbook


SOURCE_URL = "https://sipa.agricultura.gob.ec/descargas/base-estadistica/modulo_productivo/spr-mag.xlsx"
PAGE_URL = "https://sipa.agricultura.gob.ec/index.php/maiz"
OUTPUT = Path(__file__).resolve().parents[1] / "frontend-app/src/data/sipa-maiz-duro-2020-2025.json"


def number(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"Invalid source number: {value!r}")
    return round(float(value), 6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, help="Previously downloaded official workbook")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()

    if args.input:
        content = args.input.read_bytes()
    else:
        with urllib.request.urlopen(SOURCE_URL, timeout=30) as response:
            content = response.read()

    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    periods = []
    for year in range(2020, 2026):
        sheet = workbook[f"Maíz Duro_{year % 100:02d}"]
        header = tuple(sheet.iter_rows(min_row=7, max_row=7, values_only=True))[0]
        if tuple(str(value).split("*")[0].strip() for value in header[:4]) != (
            "Provincia", "Superficie cosechada (ha)", "Producción (t)", "Rendimiento (t/ha)"
        ):
            raise ValueError(f"Unexpected headers in {sheet.title}: {header[:4]}")

        provinces = []
        national = None
        for name, area, production, yield_per_ha, *_ in sheet.iter_rows(min_row=8, values_only=True):
            if not isinstance(name, str) or not isinstance(area, (int, float)):
                continue
            record = {
                "provincia": name.strip(),
                "superficie_cosechada_ha": number(area),
                "produccion_t": number(production),
                "rendimiento_t_ha": number(yield_per_ha),
            }
            if name.strip().casefold() == "nacional":
                national = record
                break
            provinces.append(record)

        if national is None or not provinces:
            raise ValueError(f"Missing national/provincial data for {year}")
        if len({row["provincia"] for row in provinces}) != len(provinces):
            raise ValueError(f"Duplicate province in {year}")
        for key in ("superficie_cosechada_ha", "produccion_t"):
            if abs(sum(row[key] for row in provinces) - national[key]) > 0.001:
                raise ValueError(f"Province totals do not reconcile with national {key} in {year}")

        periods.append({
            "anio": year,
            "actualizacion_fuente": int(re.search(r"20\d{2}", str(sheet["C4"].value)).group()),
            "fuente_hoja": str(sheet["A3"].value or "").replace("|► Fuente:", "").strip(),
            "nota_metodologica": re.sub(r"^\s*\.\s*", "", str(sheet["A5"].value or "").replace("|► Notas técnicas:", "").strip()),
            "nacional": {key: value for key, value in national.items() if key != "provincia"},
            "provincias": provinces,
        })

    los_rios_2025 = next((row for row in periods[-1]["provincias"] if row["provincia"] == "Los Ríos"), None)
    if los_rios_2025 is None or los_rios_2025["produccion_t"] != 831045.011301:
        raise ValueError("The 2025 Los Ríos value differs from the official dashboard snapshot")

    payload = {
        "cultivo": "Maíz duro seco (grano seco)",
        "pais": "Ecuador",
        "consultado": date.today().isoformat(),
        "fuente_pagina": PAGE_URL,
        "fuente_archivo": SOURCE_URL,
        "sha256_archivo_fuente": hashlib.sha256(content).hexdigest(),
        "unidad_superficie": "ha",
        "unidad_produccion": "t brutas",
        "unidad_rendimiento": "t/ha",
        "periodos": periods,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Imported", len(periods), "years and", sum(len(p["provincias"]) for p in periods), "province-year records")


if __name__ == "__main__":
    main()
