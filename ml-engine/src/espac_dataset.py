"""Contrato de investigación ESPAC 2025: grano seco, cultivo solo, sin inventar las 36 entradas."""
import csv
import hashlib
import json
from pathlib import Path
import math
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[2]
CATEGORICAL=['provincia','tipo_maiz','tipo_semilla']
FEATURES=[*CATEGORICAL,'mes_siembra_sin','mes_siembra_cos','superficie_sembrada_ha']
ALLOWED={'MAIZ DURO SECO (GRANO SECO)':'duro_seco','MAIZ SUAVE SECO (GRANO SECO)':'suave_seco'}
SEEDS={'1':'comun','2':'mejorada','3':'certificada','4':'hibrida_nacional','5':'hibrida_internacional'}


def prepare(path, profile_path=None):
    path=Path(path)
    profile_path=profile_path or ROOT/'documentacion/fuentes-maiz/perfil-candidato-espac2025.json'
    profile=json.loads(Path(profile_path).read_text(encoding='utf-8'))
    sha=hashlib.sha256(path.read_bytes()).hexdigest()
    if sha!=profile['archivos']['maiz_espac2025_original.csv']['sha256']:
        raise ValueError('La copia de ESPAC difiere de la fuente revisada.')
    with path.open(encoding='utf-8-sig',newline='') as handle:
        reader=csv.DictReader(handle,delimiter=';'); fields=reader.fieldnames; raw=list(reader)
    required={'ct_nclavr','ct_k504','ct_k506','ct_k507','ct_k510ha','ct_k511ha','ct_prod','ct_k520','fact_exp_fin','ual_prov','ual_estr','ual_segm','Identificador'}
    if not required.issubset(fields or []): raise ValueError('Esquema ESPAC incompleto.')
    dictionary=json.loads((ROOT/'documentacion/fuentes-maiz/diccionario-transitorios2025.json').read_text(encoding='utf-8'))
    variable_rows=[r for rows in dictionary.values() for r in rows if any(value=='ct_prod' for value in r.values())]
    if len(variable_rows)!=1 or 'toneladas' not in str(variable_rows[0]).lower(): raise ValueError('No se acreditó la unidad de producción.')
    selected=[]; exclusions={}; seen=set()
    def exclude(reason): exclusions[reason]=exclusions.get(reason,0)+1
    for number,row in enumerate(raw,2):
        kind=row['ct_nclavr'].strip()
        if kind not in ALLOWED: exclude('producto_no_grano_seco'); continue
        if row['ct_k504'].strip()!='1': exclude('cultivo_asociado'); continue
        if row['ct_k520'].strip()!='GRANO SECO': exclude('estado_no_grano_seco'); continue
        def num(key):
            text=row[key].strip().replace(',','.')
            return float(text) if text else math.nan
        area,planted,production,weight=num('ct_k511ha'),num('ct_k510ha'),num('ct_prod'),num('fact_exp_fin')
        if not all(math.isfinite(v) for v in (area,planted,production,weight)) or area<=0 or planted<=0 or production<0:
            exclude('objetivo_o_superficie_ausente'); continue
        if area>planted or weight<0: raise ValueError(f'Contradicción física o peso de encuesta inválido en fila {number}.')
        if weight==0: exclude('factor_expansion_cero'); continue
        month=int(row['ct_k507'].strip()); seed=row['ct_k506'].strip()
        if month not in range(1,13) or seed not in SEEDS: raise ValueError(f'Código no reconocido en fila {number}.')
        province=row['ual_prov'].strip()
        if not province or 'NO DELIMITADA' in province: exclude('provincia_no_delimitada'); continue
        # Agrupa segmentos de muestreo: no se divide una misma zona muestreada entre entrenamiento y prueba.
        parts=[row[k].strip() for k in ('ual_prov','ual_estr','ual_segm')]
        if any(not x for x in parts): raise ValueError('Falta identificador para separar grupos.')
        group=hashlib.sha256('|'.join(parts).encode()).hexdigest()[:20]
        key=tuple(row[k] for k in fields)
        if key in seen: exclude('duplicado_exacto'); continue
        seen.add(key)
        selected.append({'provincia':province,'tipo_maiz':ALLOWED[kind],'tipo_semilla':SEEDS[seed],
                         'mes_siembra_sin':math.sin(2*math.pi*month/12),'mes_siembra_cos':math.cos(2*math.pi*month/12),
                         'superficie_sembrada_ha':planted,'rendimiento_t_ha':production/area,'peso_encuesta':weight,
                         'grupo_segmento':group,'linea_copia_maiz':number})
    frame=pd.DataFrame(selected)
    if frame.empty or not np.isfinite(frame[['rendimiento_t_ha','peso_encuesta',*FEATURES[3:]]]).all().all(): raise ValueError('No hay datos válidos para el ensayo.')
    return frame,{'sha256':sha,'fuente':profile['url'],'filas_originales':len(raw),'filas_ensayo':len(frame),
                  'segmentos':int(frame.grupo_segmento.nunique()),'provincias':int(frame.provincia.nunique()),
                  'por_tipo':frame.tipo_maiz.value_counts().to_dict(),'exclusiones':exclusions,
                  'objetivo':'ct_prod [toneladas métricas] / ct_k511ha [ha cosechadas]; sin ajuste adicional de humedad',
                  'features':FEATURES,'sin_geolocalizacion_individual':True,'sin_variedad_comercial':True,
                  'nota':'Datos retrospectivos de encuesta de una edición; no equivalen a observaciones verificadas de parcelas de ZeaSys.'}
