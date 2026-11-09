"""Import official FAO/IIASA GAEZ v4 grain-maize references for mainland Ecuador.

Run with Python and Pillow. The downloaded original GeoTIFFs stay in the ignored
data/cache directory. The runtime consumes the compact JSON, without GIS tools.
"""
from __future__ import annotations

import hashlib
import json
import math
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "backend-api/data/cache/fuentes_gaez_v4"
OUTPUT = ROOT / "backend-api/data/referencias/gaez-v4-ecuador-maiz.json"
DATASETS = {
    "potencial": {
        "archivo": "maiz200a_yld.tif",
        "url": "https://s3.eu-west-1.amazonaws.com/data.gaezdev.aws.fao.org/res02/CRUTS32/Hist/8110H/maiz200a_yld.tif",
        "variable": "Agro-climatic potential yield",
        "supuestos": "Maíz genérico; insumos altos; riego sin limitación; capacidad de agua de referencia de 200 mm/m",
        "catalogo": "https://gaez-services.fao.org/server/rest/services/res02/ImageServer/query?where=objectid%3D365737&outFields=*&returnGeometry=false&f=json",
    },
    "alcanzable": {
        "archivo": "ycHr_mze.tif",
        "url": "https://s3.eu-west-1.amazonaws.com/data.gaezdev.aws.fao.org/res05/CRUTS32/Hist/8110H/ycHr_mze.tif",
        "variable": "Average attainable yield of current cropland",
        "supuestos": "Maíz genérico; insumos altos; secano; promedio de la superficie agrícola del píxel",
        "catalogo": "https://gaez-services.fao.org/server/rest/services/res05/ImageServer/query?where=objectid%3D258192&outFields=*&returnGeometry=false&f=json",
    },
}


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    result = {
        "fuente": "FAO/IIASA GAEZ v4 (publicado en 2021)",
        "documentacion": "https://www.fao.org/gaez/gaezv4/en",
        "clima_base": "CRUTS32 · 1981–2010",
        "consultado_utc": datetime.now(timezone.utc).isoformat(),
        "unidad_original": "kg DW/ha",
        "unidad_visible": "t MS/ha",
        "nota": "Referencias modeladas de aproximadamente 9 km. No son mediciones de la parcela, una predicción de su campaña ni un límite genético. No comparar con grano húmedo sin normalizar la humedad.",
        "capas": {},
    }
    for key, descriptor in DATASETS.items():
        source = CACHE / descriptor["archivo"]
        if not source.exists():
            request = urllib.request.Request(descriptor["url"], headers={"User-Agent": "ZeaSys/2.0 (agricultural data integration)"})
            with urllib.request.urlopen(request, timeout=45) as response:
                content = response.read(25_000_001)
            if len(content) > 25_000_000:
                raise ValueError("Unexpected source size")
            source.write_bytes(content)
        with Image.open(source) as raster:
            scale = raster.tag_v2[33550]
            tie = raster.tag_v2[33922]
            crs = tuple(raster.tag_v2.get(34735, ()))
            # Geographic WGS84 is GeoKey 2048, short value 4326.
            entries = [crs[i:i + 4] for i in range(4, len(crs), 4)]
            if (2048, 0, 1, 4326) not in entries:
                raise ValueError("Source CRS is not geographic WGS84")
            dx, dy = float(scale[0]), float(scale[1])
            origin_x, origin_y = float(tie[3]), float(tie[4])
            if abs(dx - 1 / 12) > 1e-6 or abs(dy - 1 / 12) > 1e-6:
                raise ValueError("Unexpected source resolution")
            x0 = math.floor((-81.8 - origin_x) / dx)
            x1 = math.ceil((-75.0 - origin_x) / dx)
            y0 = math.floor((origin_y - 1.8) / dy)
            y1 = math.ceil((origin_y + 5.5) / dy)
            crop = raster.crop((x0, y0, x1, y1))
            raw = list(crop.get_flattened_data())
            nodata = str(raster.tag_v2.get(42113, "")).strip("\x00 ")
            width, height = crop.size
            values = [None if float(value) < 0 or str(value) == nodata else int(value) for value in raw]
            result["capas"][key] = {
                **descriptor,
                "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "origen_oeste": origin_x + x0 * dx,
                "origen_norte": origin_y - y0 * dy,
                "paso_longitud": dx,
                "paso_latitud": dy,
                "columnas": width,
                "filas": height,
                "valores_kg_ms_ha": [values[i * width:(i + 1) * width] for i in range(height)],
            }
            x = math.floor((-80 - (origin_x + x0 * dx)) / dx)
            y = math.floor(((origin_y - y0 * dy) + 1) / dy)
            print(key, "control público (-80, -1):", values[y * width + x], "kg MS/ha")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(OUTPUT, OUTPUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
