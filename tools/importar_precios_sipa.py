"""Extrae la serie provincial del libro Precios productor mensuales del MAGP."""
import argparse
import hashlib
import json
import math
from pathlib import Path

from openpyxl import load_workbook

FUENTE = "https://sipa.agricultura.gob.ec/descargas/base-estadistica/modulo_economico/precios-productor.xlsx"
PRODUCTO = "Maíz Duro Seco Húmedo y Sucio"
MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()


def extraer(archivo):
    libro = load_workbook(archivo, read_only=True, data_only=True)
    try:
        hoja = libro["Nacional"]
        edicion = hoja.cell(5, 4).value
        notas = hoja.cell(6, 1).value
        if "13 % de humedad y 1 % de impurezas" not in notas:
            raise ValueError("Revisar la base de humedad de esta nueva edición.")
        series = {}
        for anio, mes, provincia, producto, presentacion, peso, unidad, precio in hoja.iter_rows(min_row=8, max_col=8, values_only=True):
            if producto != PRODUCTO:
                continue
            if str(peso) != "100" or unidad != "Libra" or presentacion not in {"Quintal", "Saco"}:
                raise ValueError(f"Presentación por revisar en {provincia}, {anio} {mes}")
            periodo = f"{int(anio):04d}-{MESES.index(mes.lower()) + 1:02d}"
            provincia = provincia.strip().title()
            registros = series.setdefault(provincia, {})
            if periodo in registros or not math.isfinite(float(precio)) or precio <= 0:
                raise ValueError(f"Revisar precio o duplicado en {provincia}, {periodo}")
            registros[periodo] = round(precio, 2)
        if not series:
            raise ValueError("El libro no contiene el producto esperado.")
        return {"fuente": FUENTE, "sha256": hashlib.sha256(archivo.read_bytes()).hexdigest(),
                "edicion": edicion.split(":")[-1].strip(), "producto": PRODUCTO,
                "unidad": "USD por 100 libras", "humedad_pct": 13, "impurezas_pct": 1, "series": series}
    finally:
        libro.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archivo", type=Path)
    args = parser.parse_args()
    salida = Path(__file__).resolve().parents[1] / "backend-api/data/referencias/precios-maiz-provincia.json"
    salida.write_text(json.dumps(extraer(args.archivo), ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
