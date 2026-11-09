"""Extrae maíz de la ESPAC 2025 para investigación, sin modificar el motor ML.

Conserva literalmente las 115 columnas del CSV oficial descargado. La segunda
salida es una revisión auxiliar de unidades y disponibilidad, no entrenamiento.
Solo calcula un cociente de producción/superficie en cultivos solos, publicados
como maíz seco y declarados en estado GRANO SECO. No corrige humedad ni imputa.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import zipfile
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "documentacion" / "fuentes-maiz"
CROPS = {
    "MAIZ DURO SECO (GRANO SECO)",
    "MAIZ SUAVE SECO (GRANO SECO)",
    "MAIZ DURO CHOCLO (CHOCLO)",
    "MAIZ SUAVE CHOCLO (CHOCLO)",
}
REQUIRED = {
    "Identificador", "ct_nclavr", "ct_k504", "ct_k506", "ct_k507", "ct_k508",
    "ct_k509", "ct_k510ha", "ct_k511ha", "ct_prod", "ct_k520", "fact_exp_fin",
}


def number(value: str) -> Decimal | None:
    text = value.strip()
    if not text:
        return None
    try:
        result = Decimal(text.replace(",", "."))
    except InvalidOperation as exc:
        raise ValueError(f"Número no reconocido en la fuente: {value!r}") from exc
    if not result.is_finite():
        raise ValueError(f"Número no finito en la fuente: {value!r}")
    return result


def unique_member(archive: zipfile.ZipFile, suffix: str) -> str:
    names = [name for name in archive.namelist() if name.endswith(suffix)]
    if len(names) != 1:
        raise ValueError(f"Se esperaba un único miembro {suffix!r}: {names}")
    return names[0]


def prepare(archive_path: Path, destination: Path) -> dict:
    raw_zip = archive_path.read_bytes()
    archive_hash = hashlib.sha256(raw_zip).hexdigest()
    manifest = json.loads((RESEARCH / "manifest.json").read_text(encoding="utf-8"))
    source = next((item for item in manifest if item["archivo"] == archive_path.name), None)
    if source is None or source["sha256"] != archive_hash:
        raise ValueError("La descarga no coincide con la huella del manifiesto revisado.")

    with zipfile.ZipFile(io.BytesIO(raw_zip)) as outer:
        inner_name = unique_member(outer, "INEC_ESPAC_BD_2025.zip")
        with zipfile.ZipFile(io.BytesIO(outer.read(inner_name))) as inner:
            csv_name = unique_member(inner, "INEC_ctnac_BD_2025.csv")
            csv_bytes = inner.read(csv_name)
    reader = csv.DictReader(io.StringIO(csv_bytes.decode("utf-8-sig")), delimiter=";")
    fields = reader.fieldnames or []
    if not REQUIRED.issubset(fields):
        raise ValueError(f"Faltan columnas requeridas: {sorted(REQUIRED - set(fields))}")
    records = list(reader)
    selected = [(line, row) for line, row in enumerate(records, 2) if row["ct_nclavr"].strip() in CROPS]
    if not selected:
        raise ValueError("No se encontraron los cuatro grupos de publicación de maíz esperados.")

    destination.mkdir(parents=True, exist_ok=True)
    original_path = destination / "maiz_espac2025_original.csv"
    with original_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, delimiter=";")
        writer.writeheader()
        writer.writerows(row for _, row in selected)

    # Estas condiciones son filtros de revisión, no una certificación de calidad.
    review = []
    flags_count: Counter = Counter()
    yield_by_crop: dict[str, list[Decimal]] = {}
    for line, row in selected:
        area = number(row["ct_k511ha"])
        planted = number(row["ct_k510ha"])
        production = number(row["ct_prod"])
        flags = []
        if "CHOCLO" in row["ct_nclavr"]:
            flags.append("producto_choclo")
        if row["ct_k504"].strip() != "1":
            flags.append("cultivo_asociado_u_otra_condicion")
        if row["ct_k520"].strip() != "GRANO SECO":
            flags.append("estado_distinto_de_grano_seco")
        if area is None or area <= 0:
            flags.append("superficie_cosechada_ausente_o_no_positiva")
        if production is None or production < 0:
            flags.append("produccion_ausente_o_negativa")
        if area is not None and planted is not None and area > planted:
            flags.append("superficie_cosechada_mayor_que_sembrada")
        calculated = ""
        if not flags:
            calculated = format(production / area, ".8f")
            yield_by_crop.setdefault(row["ct_nclavr"], []).append(production / area)
        flags_count.update(flags)
        review.append({
            "linea_csv_oficial": line,
            **{key: row[key] for key in [
                "Identificador", "ual_prov", "ct_numl", "ct_numt", "ct_nclavr",
                "ct_k504", "ct_k506", "ct_k507", "ct_k508", "ct_k509",
                "ct_k510ha", "ct_k511ha", "ct_prod", "ct_k520", "fact_exp_fin",
            ]},
            "cociente_t_ha_sin_ajuste_humedad": calculated,
            "observaciones_revision": "|".join(flags) if flags else "revisar_humedad_y_diseno_muestral",
        })
    review_path = destination / "revision_rendimiento_espac2025.csv"
    with review_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(review[0]), delimiter=";")
        writer.writeheader()
        writer.writerows(review)

    # Verifica que la exportación conserva cada valor de las filas originales.
    with original_path.open(encoding="utf-8-sig", newline="") as stream:
        reread = list(csv.DictReader(stream, delimiter=";"))
    if reread != [row for _, row in selected]:
        raise AssertionError("La copia de investigación no conserva las filas originales.")

    profile = {
        "fuente": "INEC ESPAC 2025, cultivos transitorios, cuatro grupos de maíz (excluye forrajero)",
        "url": source["url"],
        "licencia": "CC-BY-4.0 (perfil de metadatos INEC_ctnac_PM_2025.ods)",
        "zip_sha256": archive_hash,
        "miembro_zip": f"{inner_name} -> {csv_name}",
        "csv_oficial_sha256": hashlib.sha256(csv_bytes).hexdigest(),
        "filas_transitorios": len(records),
        "columnas_csv_oficial": len(fields),
        "filas_maiz": len(selected),
        "registros_por_cultivo": dict(Counter(row["ct_nclavr"] for _, row in selected)),
        "registros_por_provincia_etiqueta_original": dict(Counter(row["ual_prov"] for _, row in selected)),
        "registros_por_semilla_codigo_original": dict(Counter(row["ct_k506"] for _, row in selected)),
        "registros_por_riego_etiqueta_original": dict(Counter(row["ct_riego"] for _, row in selected)),
        "registros_por_anio_siembra_codigo_original": dict(Counter(row["ct_k508"] for _, row in selected)),
        "recuentos_observaciones_revision_no_excluyentes": dict(flags_count),
        "cocientes_calculados_por_cultivo": {key: len(values) for key, values in yield_by_crop.items()},
        "rangos_cocientes_t_ha_para_revision_no_validados": {
            key: {"min": float(min(values)), "max": float(max(values))}
            for key, values in yield_by_crop.items()
        },
        "archivos": {
            file.name: {"bytes": file.stat().st_size, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()}
            for file in (original_path, review_path)
        },
        "controles": {
            "copia_fiel_de_campos": True,
            "faltantes_rellenados": False,
            "cruce_con_otras_fuentes": False,
            "modelo_modificado": False,
            "apto_para_entrenar_sin_revision": False,
        },
        "advertencias": [
            "Datos oficiales de encuesta; no son pesajes independientes de parcelas de ZeaSys.",
            "4976 filas no equivalen necesariamente a 4976 parcelas o productores independientes.",
            "El cociente ct_prod/ct_k511ha no tiene ajuste adicional de humedad ni limpieza.",
            "Conservar unidades y factores de expansión; no promediar rendimientos sin revisar el diseño.",
            "El CSV observado tiene 115 columnas; la guía enumera 116. Se conserva el archivo descargado.",
            "Los códigos de año son 24 y 25; no se inventan fechas diarias ni duración exacta.",
        ],
    }
    (RESEARCH / "perfil-candidato-espac2025.json").write_text(
        json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return profile


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archivo", type=Path, default=RESEARCH / "descargas" / "espac_2025_datos_abiertos.zip")
    parser.add_argument("--salida", type=Path, default=RESEARCH / "candidatos")
    args = parser.parse_args()
    result = prepare(args.archivo, args.salida)
    print(json.dumps({key: result[key] for key in [
        "filas_transitorios", "columnas_csv_oficial", "filas_maiz",
        "registros_por_cultivo", "cocientes_calculados_por_cultivo", "controles",
    ]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
