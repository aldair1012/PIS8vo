"""Contraste retrospectivo con el ZIP oficial de ESPAC 2024 y la copia acreditada de 2025."""
import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

from referencia_mensual_espac import construir, prepare, ROOT
from src.espac_dataset import ALLOWED

URL = "https://www.ecuadorencifras.gob.ec/documentos/web-inec/Estadisticas_agropecuarias/espac/2024/2_DD_DATOS_ABIERTOS_ESPAC_2024.zip"
SHA256 = "a158f5d6cc50c3651ca925e4459f2c6148366a7872232f1e0c2147523a4a8ad2"
MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()


def leer_2024(archivo):
    raw = archivo.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError("La edición no coincide con el archivo del INEC revisado.")
    with zipfile.ZipFile(io.BytesIO(raw)) as outer:
        nested = outer.read("2_DD_DATOS_ABIERTOS_ESPAC_2024/INEC_ESPAC_BD_2024.zip")
    with zipfile.ZipFile(io.BytesIO(nested)) as inner:
        with inner.open("INEC_ESPAC_BD_2024/INEC_ctnac_BD_2024.csv") as csv:
            original = pd.read_csv(csv, sep=";", encoding="utf-8-sig", dtype=str)
    datos = original.drop_duplicates()
    datos = datos.loc[datos.ct_nclavr.isin(ALLOWED) & datos.ct_k504.str.strip().eq("Solo")
                      & datos.ct_k520.str.strip().eq("GRANO SECO")].copy()
    for k in ["ct_k511ha", "ct_k510ha", "ct_prod", "fact_exp_fin"]:
        datos[k] = pd.to_numeric(datos[k].str.replace(",", ".", regex=False), errors="raise")
    datos["provincia"] = datos.ual_prov.str.strip()
    datos = datos.loc[datos.ct_k511ha.gt(0) & datos.ct_k510ha.ge(datos.ct_k511ha)
                      & datos.ct_prod.ge(0) & datos.fact_exp_fin.gt(0) & datos.provincia.notna()
                      & ~datos.provincia.str.contains("NO DELIMITADA", na=True)].copy()
    datos["tipo_maiz"] = datos.ct_nclavr.map(ALLOWED)
    datos["mes"] = datos.ct_k507.str.strip().str.lower().map({mes:i for i,mes in enumerate(MESES,1)})
    if datos.mes.isna().any() or datos[["ual_estr","ual_segm"]].isna().any().any():
        raise ValueError("Existen meses o segmentos sin interpretar.")
    datos["mes_siembra_sin"] = np.sin(datos.mes * 2*np.pi/12)
    datos["mes_siembra_cos"] = np.cos(datos.mes * 2*np.pi/12)
    claves = datos[["provincia","ual_estr","ual_segm"]].apply(lambda col:col.str.strip()).agg("|".join,axis=1)
    datos["grupo_segmento"] = claves.map(lambda s:hashlib.sha256(s.encode()).hexdigest()[:20])
    datos["rendimiento_t_ha"] = datos.ct_prod / datos.ct_k511ha
    datos["peso_encuesta"] = datos.fact_exp_fin
    return datos


def contrastar(modelo, registros):
    celdas = pd.DataFrame(modelo["celdas"])
    cubiertos = registros.merge(celdas,on=["provincia","tipo_maiz","mes"],validate="many_to_one")
    if cubiertos.empty:
        raise ValueError("No hay combinaciones territoriales y mensuales comparables.")
    errores = (cubiertos.rendimiento_t_ha - cubiertos.mediana).abs()
    base = cubiertos.tipo_maiz.map(modelo["base_por_tipo"])
    return {"elegibles":len(registros),"evaluados":len(cubiertos),"mae_t_ha":float(errores.mean()),
            "mae_base_por_tipo_t_ha":float((cubiertos.rendimiento_t_ha-base).abs().mean()),
            "rmse_t_ha":float(np.sqrt(np.mean(errores**2))),
            "bandas":[{"nivel":b["nivel"],"incluidas":int((errores <= b["margen"]).sum())} for b in modelo["bandas"]]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip_2024",type=Path)
    args = parser.parse_args()
    datos24 = leer_2024(args.zip_2024)
    carpeta = ROOT / "backend-api/data/referencias"
    modelo25 = json.loads((carpeta/"planificacion-mensual-espac.json").read_text(encoding="utf-8"))
    modelo24 = construir(datos24, {"fuente":URL, "sha256":SHA256}, edicion=2024)
    csv = ROOT / "documentacion/fuentes-maiz/candidatos/maiz_espac2025_original.csv"
    datos25, calidad = prepare(csv)
    originales = pd.read_csv(csv,sep=";",encoding="utf-8-sig")
    fechas = originales.iloc[datos25.linea_copia_maiz.to_numpy()-2]
    datos25["mes"] = fechas.ct_k507.to_numpy()
    posteriores = datos25.loc[fechas.ct_k508.to_numpy() == 25]
    informe = {"fuente_2024":URL,"sha256_zip_2024":SHA256,"sha256_csv_2025":calidad["sha256"],
               "referencia_publicada_2025_en_encuesta_2024":contrastar(modelo25,datos24),
               "metodo_ajustado_2024_en_siembras_2025":contrastar(modelo24,posteriores)}
    (carpeta/"contraste-ediciones-espac.json").write_text(json.dumps(informe,indent=2)+"\n",encoding="utf-8")


if __name__ == "__main__":
    main()
