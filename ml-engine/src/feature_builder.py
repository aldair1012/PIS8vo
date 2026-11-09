# feature_builder.py - Construye los features para la predicción.
# Incluye baselines históricas, recomendaciones agronómicas y consultas a APIs de clima/suelo.

import os
import re
import unicodedata
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
import urllib.request

from src.data_providers import fetch_open_meteo_historical, fetch_weather_with_fallback
from src.simulation_contract import validar_campos, calendario, ventana_historica, SCHEMA
from src.training_quality import evaluar as evaluar_calidad_entrenamiento
from src.model_evidence import evidence

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_FEATURE_VALUE = float(np.finfo(np.float32).max)

# Las 36 columnas que esperan los modelos, en el orden exacto de entrenamiento
COLS_ORDER = [
    'zona', 'provincia', 'variedad', 'tipo_grano', 'riego_tipo', 'tipo_suelo',
    'ph_suelo', 'materia_organica_pct', 'profundidad_suelo_cm', 'textura_arcilla_pct',
    'textura_arena_pct', 'textura_limo_pct', 'altitud_msnm', 'temperatura_media_c',
    'temperatura_min_c', 'temperatura_max_c', 'precipitacion_mm', 'humedad_relativa_pct',
    'horas_luz_dia', 'densidad_plantas_ha', 'ciclo_dias', 'nitrogeno_kg_ha',
    'fosforo_p2o5_kg_ha', 'potasio_k2o_kg_ha', 'magnesio_kg_ha', 'azufre_kg_ha',
    'aplicaciones_nitrogeno', 'lamina_riego_mm', 'biofertilizante', 'semilla_certificada',
    'ndvi_v6_vegetativo', 'ndvi_vt_floracion', 'ndvi_r3_llenado_grano', 'plagas_presentes',
    'presion_plaga_score', 'control_plaga'
]

CATEGORICAL_COLS = [
    "zona", "provincia", "variedad", "tipo_grano", "riego_tipo",
    "tipo_suelo", "plagas_presentes", "control_plaga"
]

# --- Carga de datasets de referencia ---
print("[ML Engine] Cargando dataset de referencia para baselines...")
df_training = pd.read_csv(os.path.join(BASE_DIR, "data", "maiz_ecuador_training_data.csv"))
_filas_elegibles, CALIDAD_REFERENCIAS = evaluar_calidad_entrenamiento(df_training)
df_reference = df_training.loc[_filas_elegibles].copy()
if df_reference.empty:
    raise ValueError('No hay registros coherentes para completar las variables ausentes.')

AGRONOMIA_JSON_PATH = os.path.join(os.path.dirname(BASE_DIR), "backend-api", "data", "agronomia_data.json")
agronomia_data = {}
if os.path.exists(AGRONOMIA_JSON_PATH):
    try:
        with open(AGRONOMIA_JSON_PATH, "r", encoding="utf-8") as f:
            agronomia_data = json.load(f)
        print(f"[ML Engine] Datos agronómicos cargados desde {AGRONOMIA_JSON_PATH}")
    except Exception as e:
        print(f"[ML Engine] Error al cargar datos agronómicos: {str(e)}")
else:
    print(f"[ML Engine] ADVERTENCIA: No se encontró {AGRONOMIA_JSON_PATH}")

REGLAS_JSON_PATH = os.path.join(BASE_DIR, "data", "reglas_decision.json")
reglas_decision = []
if os.path.exists(REGLAS_JSON_PATH):
    try:
        with open(REGLAS_JSON_PATH, "r", encoding="utf-8") as f:
            reglas_decision = json.load(f)
        print(f"[ML Engine] Reglas de decisión cargadas desde {REGLAS_JSON_PATH} ({len(reglas_decision)} reglas)")
    except Exception as e:
        print(f"[ML Engine] Error al cargar reglas de decisión: {str(e)}")
else:
    print(f"[ML Engine] ADVERTENCIA: No se encontró {REGLAS_JSON_PATH}")



# --- Mapeos de variedades y suelos ---
VARIEDAD_MAP = {
    "pioneer p4039": "Pioneer P4039",
    "iniap h-551": "INIAP H-551",
    "dekalb dk-7088": "Dekalb DK-7088",
    "iniap h-603 superior": "INIAP H-603 Superior",
    "iniap h-553": "INIAP H-553",
    "iniap renacer": "INIAP Renacer",
    "dekalb 5005": "Dekalb 5005",
    "emblema 777": "Emblema 777",
    "iniap h-248 soberano": "INIAP H-248 Soberano",
    "iniap 180": "INIAP 180",
    "iniap 198 canguil": "INIAP 198 Canguil",
    "iniap 101 blanco harinoso": "INIAP 101 Blanco Harinoso",
    "bonanza dulce": "Bonanza Dulce",
    "iniap 111 guagal": "INIAP 111 Guagal",
    "iniap 122 chaucho": "INIAP 122 Chaucho",
    "iniap 124 mishca": "INIAP 124 Mishca",
    "iniap 102 blanco blandito": "INIAP 102 Blanco Blandito",
    "iniap 192 chulpi": "INIAP 192 Chulpi",
    "iniap 199 racimo de uva": "INIAP 199 Racimo de Uva",
    "iniap 103 mishqui sara": "INIAP 103 Mishqui Sara",
    "iniap 153 zhima": "INIAP 153 Zhima",
    "iniap h-601": "INIAP H-601",
    "iniap h-553 (adaptado)": "INIAP H-553 (adaptado)",
    "tuxpeño": "Tuxpeño",
    "maíz duro amazónico (genérico)": "Maíz Duro Amazónico (genérico)"
}

SUELO_MAP = {
    "franco": "Franco limoso",
    "arcilloso": "Franco arcilloso",
    "arenoso": "Franco arenoso"
}
SUELO_MAP.update({'franco_equilibrado':'Franco', 'arcillo_limoso':'Arcillo limoso'})
# Conservar las tres homologaciones de la UI y aceptar nombres reales del
# catálogo del modelo, incluyendo el alias documentado «Franco-Arcilloso».
for _suelo in df_reference["tipo_suelo"].dropna().unique():
    SUELO_MAP.setdefault(str(_suelo).strip().lower(), str(_suelo))


def normalizar_tipo_suelo(value):
    if not isinstance(value, str):
        raise ValueError("El campo tipoSuelo debe ser un texto no vacío")
    key = " ".join(value.strip().lower().replace("-", " ").split())
    if key not in SUELO_MAP:
        raise ValueError(f"El campo tipoSuelo no es válido. Tipos disponibles: {', '.join(sorted(SUELO_MAP))}")
    return SUELO_MAP[key]


def get_historical_baseline(provincia, zona, variedad=None):
    """Saca medianas y modas del dataset histórico para rellenar los features que el usuario no pone."""
    sub_df = df_reference.copy()
    if variedad:
        temp_df = sub_df[sub_df["variedad"].str.lower() == variedad.lower()]
        if not temp_df.empty:
            sub_df = temp_df

    temp_df = sub_df[sub_df["provincia"] == provincia]
    if not temp_df.empty:
        sub_df = temp_df
    else:
        temp_df = sub_df[sub_df["zona"] == zona]
        if not temp_df.empty:
            sub_df = temp_df

    if sub_df.empty:
        sub_df = df_reference

    baseline = {}
    for col in COLS_ORDER:
        if col in CATEGORICAL_COLS:
            modes = sub_df[col].mode()
            if not modes.empty:
                baseline[col] = str(modes.iloc[0])
            else:
                baseline[col] = str(df_reference[col].mode().iloc[0])
        else:
            median_val = sub_df[col].median()
            if pd.isna(median_val):
                median_val = df_reference[col].median()
            baseline[col] = float(median_val)
    return baseline


def _parse_range(val_str, default_min, default_max):
    """Extrae rango numérico de un string tipo '21-27' o '600-800'."""
    if not val_str:
        return default_min, default_max
    val_str = str(val_str).replace("–", "-").replace("—", "-")
    val_str = re.sub(r'\(.*?\)', '', val_str)
    try:
        nums = [float(s) for s in re.findall(r"\d+\.?\d*", val_str)]
        if len(nums) >= 2:
            return nums[0], nums[1]
        elif len(nums) == 1:
            return nums[0], nums[0]
    except Exception:
        pass
    return default_min, default_max


def generar_recomendaciones(datos, zona_ml):
    """Genera recomendaciones agronómicas comparando los datos de entrada contra los rangos del Excel."""
    recomendaciones = []
    if datos.get('ubicacion_confirmada') is False:
        recomendaciones.append('Ubicación no confirmada: no se atribuyen requisitos regionales ni dosis de fertilización a una provincia asumida por el modelo.')
        if datos.get('precipitacion_ciclo_mm') is None:
            recomendaciones.append('Precipitación del ciclo no disponible: un dato anual no permite evaluar la lluvia del periodo de cultivo.')
        else:
            recomendaciones.append('Lluvia del ciclo ingresada: falta confirmar la ubicación y la referencia local antes de clasificarla como adecuada o insuficiente.')
        return recomendaciones

    # Mapear zona ML a zona del Excel de agronomía
    excel_zone = "Costa – Litoral (Invierno)"
    if "Sierra_Norte" in zona_ml:
        excel_zone = "Sierra Norte"
    elif "Sierra_Centro" in zona_ml:
        excel_zone = "Sierra Centro"
    elif "Sierra_Sur" in zona_ml or "Loja" in zona_ml:
        excel_zone = "Sierra Sur"
    elif "Amazonía" in zona_ml or "Amazonia" in zona_ml:
        excel_zone = "Amazonía"

    condiciones = {}
    for c in agronomia_data.get("condiciones_agronomicas", []):
        if excel_zone.lower() in c.get("Zona", "").lower():
            condiciones = c
            break

    fertilizacion = {}
    for f in agronomia_data.get("fertilizacion", []):
        fert_zone = f.get("Zona", "").lower()
        if ("sierra" in fert_zone and "sierra" in excel_zone.lower()) or \
           ("costa" in fert_zone and "costa" in excel_zone.lower()) or \
           ("amazon" in fert_zone and "amazon" in excel_zone.lower()):
            fertilizacion = f
            break

    min_temp, max_temp = _parse_range(condiciones.get("Temperatura Óptima (°C)"), 21.0, 27.0)
    min_ph, max_ph = _parse_range(condiciones.get("pH Óptimo"), 6.0, 6.5)
    min_prec, max_prec = _parse_range(condiciones.get("Precipitación (mm/ciclo)"), 600.0, 800.0)
    min_fert, max_fert = _parse_range(fertilizacion.get("Nitrógeno N (kg/ha)"), 150.0, 200.0)

    # Temperatura
    temp = datos["temperatura"]
    if temp > max_temp:
        recomendaciones.append(
            f"Temperatura elevada ({temp:.1f}°C) superior al óptimo ({min_temp:.0f}-{max_temp:.0f}°C). Implementar riego para reducir estrés térmico."
        )
    elif temp < min_temp:
        recomendaciones.append(
            f"Temperatura baja ({temp:.1f}°C) inferior al óptimo ({min_temp:.0f}-{max_temp:.0f}°C). Considerar coberturas para proteger el cultivo."
        )
    else:
        recomendaciones.append(
            f"Temperatura óptima ({temp:.1f}°C) alineada con los requerimientos ({min_temp:.0f}-{max_temp:.0f}°C)."
        )

    # Humedad
    hum = datos["humedad"]
    if hum < 50:
        recomendaciones.append(
            f"Humedad relativa baja ({hum:.1f}%). Aumentar frecuencia de riego para mantener la humedad del suelo."
        )
    elif hum > 80:
        recomendaciones.append(
            f"Humedad excesiva ({hum:.1f}%). Vigilar la aparición de enfermedades fúngicas en las mazorcas."
        )
    else:
        recomendaciones.append(
            f"Humedad relativa adecuada ({hum:.1f}%) para el cultivo."
        )

    # El contrato legacy recibe lluvia anual; el catálogo expresa mm/ciclo.
    # Solo un acumulado explícito del ciclo permite comparar ambos periodos.
    prec = datos.get("precipitacion_ciclo_mm")
    if prec is None:
        recomendaciones.append(
            f"Precipitación del ciclo no disponible: la entrada anual ({datos['precipitacion']:.0f} mm/año) "
            f"no permite evaluar el rango de referencia ({min_prec:.0f}-{max_prec:.0f} mm/ciclo). "
            "Registrar la precipitación acumulada del ciclo; no se aplica una conversión automática."
        )
    elif prec < min_prec:
        recomendaciones.append(
            f"Precipitación del ciclo insuficiente ({prec:.0f} mm/ciclo) frente al requerimiento ({min_prec:.0f}-{max_prec:.0f} mm/ciclo). Se requiere riego complementario."
        )
    elif prec > max_prec:
        recomendaciones.append(
            f"Precipitación del ciclo ({prec:.0f} mm/ciclo) supera el requerimiento óptimo ({min_prec:.0f}-{max_prec:.0f} mm/ciclo). Asegurar limpieza de drenajes."
        )
    else:
        recomendaciones.append(
            f"Precipitación del ciclo adecuada ({prec:.0f} mm/ciclo) en rango óptimo ({min_prec:.0f}-{max_prec:.0f} mm/ciclo)."
        )

    # Fertilizante
    fert = datos["fertilizante"]
    if fert < min_fert:
        fracc = fertilizacion.get("Fraccionamiento N", "fraccionada")
        recomendaciones.append(
            f"Fertilización baja ({fert:.0f} kg N/ha). Dosis recomendada: {min_fert:.0f}-{max_fert:.0f} kg N/ha. Fraccionamiento sugerido: {fracc}."
        )
    elif fert > max_fert:
        recomendaciones.append(
            f"Exceso de fertilización nitrogenada ({fert:.0f} kg N/ha). La dosis recomendada es {min_fert:.0f}-{max_fert:.0f} kg/ha."
        )
    else:
        recomendaciones.append(
            f"Dosis de Nitrógeno ({fert:.0f} kg/ha) en rango sugerido ({min_fert:.0f}-{max_fert:.0f} kg/ha)."
        )

    # pH
    ph = datos["phSuelo"]
    if ph < min_ph:
        recomendaciones.append(
            f"pH del suelo muy ácido ({ph:.1f}). Rango óptimo: {min_ph:.1f}-{max_ph:.1f}. Aplicar cal agrícola para corregir acidez."
        )
    elif ph > max_ph:
        recomendaciones.append(
            f"pH del suelo alcalino ({ph:.1f}). Rango óptimo: {min_ph:.1f}-{max_ph:.1f}. Considerar materia orgánica para bajar el pH."
        )
    else:
        recomendaciones.append(
            f"pH del suelo óptimo ({ph:.1f}) para el cultivo de maíz."
        )

    # --- Mapeo y evaluación de reglas de decisión de precisión (Datos.docx) ---
    region_user = "Nacional"
    if "sierra" in excel_zone.lower():
        region_user = "Sierra"
    elif "costa" in excel_zone.lower():
        region_user = "Costa"
    elif "amazon" in excel_zone.lower():
        region_user = "Amazonía"

    for r in reglas_decision:
        region_regla = r.get("Región", "Nacional")
        if region_regla != "Nacional" and region_regla != "Todo el país" and region_regla.lower() not in region_user.lower():
            continue

        problema = r.get("Problema detectado", "").lower()
        regla_hidrica = any(palabra in problema for palabra in ("hídrico", "lixiviación", "encharcamiento"))
        # La variedad o una dosis baja de N tampoco acreditan estrés hídrico.
        if regla_hidrica and prec is None:
            continue
            
        # Evaluar coincidencia
        coincide = False
        razon = ""

        # 1. Deficiencia de nitrógeno
        if regla_hidrica:
            if "hídrico" in problema and prec < 450:
                coincide = True
                razon = f"Lluvia del ciclo baja ({prec:.0f} mm/ciclo)"
            elif ("lixiviación" in problema or "encharcamiento" in problema) and prec > 1000:
                coincide = True
                razon = f"Alta precipitación del ciclo ({prec:.0f} mm/ciclo)"
        elif ("nitrógeno" in problema or re.search(r"\bn\b", problema)) and fert < 120:
            coincide = True
            razon = f"Fertilización baja ({fert:.0f} kg N/ha)"
            
        # 3. Acidez de suelo
        elif "ácido" in r.get("Condición del suelo", "").lower() and ph < 5.6:
            coincide = True
            razon = f"Suelo ácido (pH {ph:.1f})"
            
        # 5. Coincidencia por variedad específica
        var_maiz = datos.get("variedad", "").lower()
        variedad_regla = r.get("Variedad", "").strip().lower()
        if not regla_hidrica and not coincide and var_maiz and variedad_regla and variedad_regla in var_maiz:
            coincide = True
            razon = f"Variedad {r.get('Variedad')}"

        if coincide:
            acc = r.get("Acción recomendada")
            just = r.get("Justificación técnica")
            src = r.get("Fuente (URL, año)")
            recomendaciones.append(
                f"Consejo de precisión local ({r.get('Subzona')}): {acc} | Justificación: {just} ({src})"
            )

    return recomendaciones


def fetch_precision_soil(lat, lon):
    """Consulta la API de SoilGrids para obtener datos reales del suelo."""
    try:
        url = f"https://rest.isric.org/soilgrids/v2.0/properties/query?lon={lon}&lat={lat}&property=phh2o&property=clay&property=sand&property=silt&property=soc&depth=0-5cm&value=mean"
        print(f"[ML Engine] Querying SoilGrids REST API: {url}")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (AgroPredict/2.0)'})
        with urllib.request.urlopen(req, timeout=4.0) as response:
            data = json.loads(response.read().decode('utf-8'))

        layers = data.get("properties", {}).get("layers", [])
        result = {}
        for layer in layers:
            name = layer.get("name")
            depths = layer.get("depths", [])
            if depths and depths[0].get("values"):
                val = depths[0]["values"].get("mean")
                if val is not None:
                    result[name] = float(val)

        mapped = {}
        if "phh2o" in result:
            mapped["ph_suelo"] = round(result["phh2o"] / 10.0, 2)
        if "clay" in result:
            mapped["textura_arcilla_pct"] = round(result["clay"] / 10.0, 2)
        if "sand" in result:
            mapped["textura_arena_pct"] = round(result["sand"] / 10.0, 2)
        if "silt" in result:
            mapped["textura_limo_pct"] = round(result["silt"] / 10.0, 2)
        if "soc" in result:
            soc_pct = result["soc"] / 100.0
            mapped["materia_organica_pct"] = round(soc_pct * 1.724, 2)

        if not mapped:
            # SoilGrids puede responder 200 sin datos para un píxel concreto.
            # No lo convertimos en ceros ni en valores teóricos: exponemos la
            # ausencia para que la UI muestre "No disponible" con motivo.
            return {
                "source": "soilgrids",
                "source_kind": "soil_properties",
                "quality": "unavailable",
                "requested_depth": "0-5cm",
                "reason": "SoilGrids no devolvió valores para las coordenadas consultadas",
            }

        mapped.update({
            "source": "soilgrids",
            "source_kind": "soil_properties",
            "quality": "model",
            "requested_depth": "0-5cm",
        })
        print(f"[ML Engine] SoilGrids retrieved successfully: {mapped}")
        return mapped
    except Exception as e:
        print(f"[ML Engine] SoilGrids API query failed (falling back): {str(e)}")
        return {
            "source": "soilgrids",
            "source_kind": "soil_properties",
            "quality": "unavailable",
            "requested_depth": "0-5cm",
            "reason": str(e),
        }


def fetch_precision_weather(lat, lon):
    """Consulta clima operativo con procedencia y fallback explícitos.

    Se conserva el nombre de esta función para no romper imports existentes,
    pero la implementación ahora usa Open-Meteo y NASA POWER mediante la capa
    de proveedores. No reemplaza los valores escritos por el usuario; sólo
    aporta datos externos y métricas agrícolas para el dashboard/chatbot.
    """
    try:
        mapped = fetch_weather_with_fallback(float(lat), float(lon), timeout=6.0)
        print(f"[ML Engine] Datos climáticos recibidos de {mapped.get('source')}: {mapped}")
        return mapped
    except Exception as e:
        print(f"[ML Engine] Weather providers failed: {str(e)}")
        return None


def build_features(data):
    """
    Toma los datos crudos del usuario y arma el DataFrame de 36 columnas listo para el modelo.
    Retorna (df_features, metadata) donde metadata tiene info extra para la respuesta.
    """
    campos_ingresados = validar_campos(data)
    temp = float(data["temperatura"])
    hum = float(data["humedad"])
    prec_payload = float(data["precipitacion"])
    fert = float(data["fertilizante"])
    ph = float(data["phSuelo"])
    area = float(data["area"])
    soil_type_str = normalizar_tipo_suelo(data["tipoSuelo"])
    prec_ciclo = float(data["precipitacion_ciclo_mm"]) if "precipitacion_ciclo_mm" in data else None
    prec = prec_ciclo if prec_ciclo is not None else prec_payload
    variedad_maiz = data.get("variedad_maiz", "Híbrido convencional")
    maiz_str = VARIEDAD_MAP.get(variedad_maiz.lower())
    advertencias = []
    altitud = float(data.get("altitud", 45.0))
    ubicacion = data.get("ubicacion", "")

    # Resolver la provincia exacta antes de obtener referencias; no convertir
    # provincias de Sierra/Amazonía en otra provincia representativa.
    def normalizar(value):
        return ''.join(c for c in unicodedata.normalize('NFD', str(value).lower()) if unicodedata.category(c) != 'Mn')

    coincidencias = [p for p in df_reference['provincia'].dropna().unique()
                     if normalizar(p) in normalizar(ubicacion)]
    if coincidencias:
        provincia = max(coincidencias, key=len)
        zona = str(df_reference.loc[df_reference['provincia'] == provincia, 'zona'].mode().iloc[0])
    else:
        # No presentar una provincia elegida por defecto como ubicación real.
        provincia, zona = '', ''
        advertencias.append('Provincia no identificada en el texto: se utiliza una referencia general del conjunto de entrenamiento.')

    tipo_maiz_input = data.get("tipo_maiz", "Duro Amarillo")
    tipo_maiz_lower = tipo_maiz_input.lower()
    if "amarillo / blanco" in tipo_maiz_lower:
        tipo_grano = "Duro Amarillo / Blanco"
    elif "suave" in tipo_maiz_lower or "harinoso" in tipo_maiz_lower:
        tipo_grano = "Suave Harinoso"
    else:
        tipo_grano = "Duro Amarillo"

    # Baseline histórica para rellenar lo que falta
    baseline = get_historical_baseline(provincia, zona, maiz_str)
    if not maiz_str:
        maiz_str = baseline['variedad']
        advertencias.append(f'Variedad no reconocida: el modelo utiliza {maiz_str} como referencia asumida, no como variedad confirmada.')
    provincia = provincia or baseline['provincia']
    zona = zona or baseline['zona']
    riego_tipo = baseline['riego_tipo']
    if prec_ciclo is None:
        advertencias.append('La entrada precipitacion conserva el contrato anual legacy y se envía al modelo sin conversión. El catálogo de features describe precipitacion_mm como acumulado del ciclo; esta discrepancia de periodo limita la interpretación del rendimiento y no se corrige reetiquetando el dato.')
        advertencias.append('Sin precipitación acumulada explícita del ciclo no se evalúan recomendaciones de lluvia por mm/ciclo.')
    fuentes = {col: 'Referencia del conjunto de entrenamiento (origen sin acreditar)' for col in COLS_ORDER}
    plan = calendario(data, campos_ingresados.get('ciclo_dias', baseline['ciclo_dias']))
    clima_ciclo = {'estado': 'no_solicitado', 'nota': 'El clima del proveedor es contexto; el cálculo conserva el escenario ingresado.'}
    if data.get('incluir_historico') is True:
        clima_ciclo['estado'] = 'sin_coordenadas'

    # APIs de precisión (si hay coordenadas)
    lat = data.get("latitud")
    lon = data.get("longitud")
    precision_soil = data.get('suelo_ubicacion') or None
    precision_weather = None
    historical_weather = None
    inamhi_info = None
    if lat is not None and lon is not None:
        try:
            lat_f = float(lat)
            lon_f = float(lon)
            if abs(lat_f) > 0.01 or abs(lon_f) > 0.01:
                if precision_soil is None and data.get('consultar_suelo',True):
                    precision_soil = fetch_precision_soil(lat_f, lon_f)
                if data.get('incluir_contexto_reciente',True):
                    precision_weather = fetch_precision_weather(lat_f, lon_f)
                if data.get("incluir_historico") is True:
                    try:
                        window = ventana_historica(plan, datetime.now(timezone(timedelta(hours=-5))).date())
                        if window:
                            historical_weather = fetch_open_meteo_historical(lat_f, lon_f, start=window[0], end=window[1], timeout=6.0)
                            clima_ciclo.update({'estado': 'periodo_pasado_consultado', 'inicio_consultado': window[0].isoformat(),
                                                'fin_consultado': window[1].isoformat(), 'fin_del_ciclo_incluido': window[1].isoformat() == plan['fecha_fin_estimada'],
                                                'resumen': historical_weather['summary'], 'cobertura': historical_weather['coverage'],
                                                'fuente': 'Open-Meteo, reanálisis histórico por coordenadas; no es una estación de la parcela'})
                        elif plan['fecha_siembra']:
                            clima_ciclo['estado'] = 'sin_dias_pasados_disponibles'
                        else:
                            clima_ciclo['estado'] = 'falta_fecha_siembra'
                    except Exception as history_ex:
                        clima_ciclo['estado'] = 'proveedor_no_disponible'
                        advertencias.append('No se pudo consultar el clima histórico del periodo. No se han inventado datos para completarlo.')
                        print(f"[ML Engine] Error consultando histórico Open-Meteo: {str(history_ex)}")
                try:
                    from src.inamhi_climate import inamhi_db
                    station = inamhi_db.get_nearest_station(lat_f, lon_f)
                    if station:
                        stats = inamhi_db.get_aggregated_stats(station['id'])
                        if stats:
                            inamhi_info = {
                                "estacion": station,
                                "estadisticas": stats
                            }
                            advertencias.append('INAMHI aporta una referencia histórica de estación cercana, no una medición del lote ni el clima del ciclo actual. La representatividad por altitud y relieve no está validada.')
                    else:
                        advertencias.append('No hay una estación INAMHI con lluvia y temperatura disponibles dentro del radio operativo de 100 km. No se asigna una referencia distante como si fuera local.')
                except Exception as db_ex:
                    print(f"[ML Engine] Error querying INAMHI local climate DB: {str(db_ex)}")
        except Exception as ex:
            print(f"[ML Engine] Error parsing coordinates: {str(ex)}")

    # Armar el dict de features empezando con la baseline
    features_dict = {}
    for col in COLS_ORDER:
        features_dict[col] = [baseline[col]]

    # Sobrescribir con datos de la API de suelo si los tenemos
    if precision_soil:
        for key in ["textura_arcilla_pct", "textura_arena_pct", "textura_limo_pct", "materia_organica_pct"]:
            if key in precision_soil:
                features_dict[key] = [precision_soil[key]]
                fuentes[key] = 'Estimación de proveedor de suelo por coordenadas'

    # Sobrescribir con los inputs del usuario. Son la fuente primaria del
    # modelo porque representan el escenario que el usuario está simulando;
    # los proveedores externos se mantienen como contexto verificable.
    features_dict["zona"] = [zona]
    features_dict["provincia"] = [provincia]
    features_dict["variedad"] = [maiz_str]
    features_dict["tipo_grano"] = [tipo_grano]
    features_dict["riego_tipo"] = [riego_tipo]
    features_dict["tipo_suelo"] = [soil_type_str]
    features_dict["ph_suelo"] = [ph]
    features_dict["altitud_msnm"] = [altitud]
    features_dict["temperatura_media_c"] = [temp]
    features_dict["temperatura_min_c"] = [temp - 4.5]
    features_dict["temperatura_max_c"] = [temp + 5.5]
    features_dict["precipitacion_mm"] = [prec]
    features_dict["humedad_relativa_pct"] = [hum]
    features_dict["nitrogeno_kg_ha"] = [fert]
    # La cantidad de nitrógeno no permite inferir P, K ni biofertilizante.
    for col in ['temperatura_media_c', 'humedad_relativa_pct', 'precipitacion_mm', 'nitrogeno_kg_ha', 'ph_suelo']:
        fuentes[col] = 'Entrada de la simulación'
    fuentes['precipitacion_mm'] = ('Precipitación acumulada del ciclo ingresada explícitamente (mm/ciclo)'
                                   if prec_ciclo is not None else 'Entrada anual legacy sin conversión al periodo del modelo (mm/año)')
    fuentes['tipo_suelo'] = 'Textura ingresada; categoría homologada del modelo'
    if data.get('suelo_ubicacion'):
        fuentes['tipo_suelo'] = 'Grupo de textura propuesto desde el mapa de suelo por coordenadas'
    fuentes['temperatura_min_c'] = fuentes['temperatura_max_c'] = 'Estimación a partir de temperatura media'
    fuentes['variedad'] = 'Variedad registrada' if variedad_maiz.lower() in VARIEDAD_MAP else 'Variedad de referencia asumida'
    fuentes['provincia'] = fuentes['zona'] = 'Ubicación reconocida' if coincidencias else 'Referencia geográfica asumida'
    fuentes['tipo_grano'] = 'Tipo registrado homologado al modelo'
    fuentes['altitud_msnm'] = 'Altitud enviada por la aplicación; puede ser un valor predeterminado'

    # Un cero declarado es un dato. No se sustituye por la mediana histórica.
    for campo, valor in campos_ingresados.items():
        features_dict[campo] = [valor]
        fuentes[campo] = 'Ingresado por el productor para este escenario'
    supuestos = [col for col, fuente in fuentes.items() if fuente.startswith('Referencia del conjunto')]
    evidencia = evidence(fuentes)
    if evidencia['variables_posteriores_asumidas']:
        advertencias.append('El modelo también utiliza vegetación y plagas de etapas posteriores del cultivo. En esta planificación se completan con referencias, no con observaciones futuras conocidas; la salida es un escenario exploratorio.')
    if supuestos:
        advertencias.append(f'El modelo completa {len(supuestos)} variables sin dato propio con referencias del conjunto de entrenamiento, cuyo origen sigue sin acreditar. Revisa cuáles son en Datos utilizados; no son mediciones de la parcela.')
    plan = calendario(data, features_dict['ciclo_dias'][0])
    if not campos_ingresados:
        advertencias.append('No se ingresaron parámetros adicionales de campo: la duración, densidad, riego y manejo restantes siguen siendo referencias asumidas.')

    df_features = pd.DataFrame(features_dict)
    for col in COLS_ORDER:
        if col not in CATEGORICAL_COLS:
            value = float(df_features.iloc[0][col])
            if not np.isfinite(value):
                raise ValueError(f'Entrada no finita: {col}')
            if value < df_training[col].min() or value > df_training[col].max():
                label = SCHEMA['campos'].get(col, {}).get('label', col.replace('_',' '))
                advertencias.append(f'{label}: {value:g} está fuera del rango observado de entrenamiento. El valor puede ser válido, pero el modelo tiene menos respaldo para estimarlo.')

    # Metadata extra que se usa en la respuesta final
    metadata = {
        'trazabilidad': {'fuentes': fuentes, 'advertencias': advertencias, 'supuestos': supuestos, 'suelo_ubicacion_utilizado': bool(data.get('suelo_ubicacion')), 'calendario': plan, 'clima_ciclo': clima_ciclo, 'contrato_campo': '1.0', 'calidad_referencias': CALIDAD_REFERENCIAS, 'unidad_fertilizante': 'kg N/ha', 'periodo_precipitacion': 'mm/ciclo' if prec_ciclo is not None else 'mm/año',
                        'periodo_precipitacion_catalogo_modelo': 'mm/ciclo',
                        'evidencia_modelo': evidencia,
                        'precipitacion_payload_mm': prec_payload,
                        'precipitacion_ciclo_mm': prec_ciclo,
                        'evaluacion_precipitacion_ciclo': 'disponible' if prec_ciclo is not None else 'no_evaluable_sin_dato_del_ciclo'},
        "zona": zona,
        "provincia": provincia,
        "datos_entrada": {
            "ubicacion_confirmada": bool(coincidencias),
            "temperatura": temp,
            "humedad": hum,
            "precipitacion": prec,
            "precipitacion_ciclo_mm": prec_ciclo,
            "fertilizante": fert,
            "phSuelo": ph,
            "variedad": variedad_maiz,
        },
        "precision_data": {
            "soilgrids": precision_soil,
            "weather": precision_weather,
            "open_meteo_historico": historical_weather,
            # Alias de compatibilidad para consumidores existentes.
            "open_meteo": precision_weather if precision_weather and precision_weather.get("source") == "open_meteo" else None,
            "nasa_power": precision_weather if precision_weather and precision_weather.get("source") == "nasa_power" else None,
            "inamhi_historico": inamhi_info
        }
    }

    return df_features, metadata
