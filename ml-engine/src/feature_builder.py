# feature_builder.py - Construye los features para la predicción.
# Incluye baselines históricas, recomendaciones agronómicas y consultas a APIs de clima/suelo.

import os
import re
import json
import numpy as np
import pandas as pd
import urllib.request

from src.data_providers import fetch_open_meteo_historical, fetch_weather_with_fallback

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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
df_reference = pd.read_csv(os.path.join(BASE_DIR, "data", "maiz_ecuador_training_data.csv"))

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

    # Precipitación
    prec = datos["precipitacion"]
    if prec < min_prec:
        recomendaciones.append(
            f"Precipitación insuficiente ({prec:.0f} mm) frente al requerimiento ({min_prec:.0f}-{max_prec:.0f} mm). Se requiere riego complementario."
        )
    elif prec > max_prec:
        recomendaciones.append(
            f"Precipitación ({prec:.0f} mm) supera el requerimiento óptimo ({min_prec:.0f}-{max_prec:.0f} mm). Asegurar limpieza de drenajes."
        )
    else:
        recomendaciones.append(
            f"Precipitación adecuada ({prec:.0f} mm) en rango óptimo ({min_prec:.0f}-{max_prec:.0f} mm)."
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
            
        # Evaluar coincidencia
        coincide = False
        razon = ""

        # 1. Deficiencia de nitrógeno
        if "N" in r.get("Problema detectado", "") and fert < 120:
            coincide = True
            razon = f"Fertilización baja ({fert:.0f} kg N/ha)"
            
        # 2. Estrés hídrico
        elif "hídrico" in r.get("Problema detectado", "").lower() and prec < 450:
            coincide = True
            razon = f"Lluvia baja ({prec:.0f} mm)"
            
        # 3. Acidez de suelo
        elif "ácido" in r.get("Condición del suelo", "").lower() and ph < 5.6:
            coincide = True
            razon = f"Suelo ácido (pH {ph:.1f})"
            
        # 4. Encharcamiento / Lixiviación
        elif ("lixiviación" in r.get("Problema detectado", "").lower() or "encharcamiento" in r.get("Problema detectado", "").lower()) and prec > 1000:
            coincide = True
            razon = f"Alta precipitación ({prec:.0f} mm)"
            
        # 5. Coincidencia por variedad específica
        var_maiz = datos.get("variedad", "").lower()
        if not coincide and var_maiz and r.get("Variedad", "").lower() in var_maiz:
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
    temp = float(data["temperatura"])
    hum = float(data["humedad"])
    prec = float(data["precipitacion"])
    fert = float(data["fertilizante"])
    ph = float(data["phSuelo"])
    area = float(data["area"])
    tipo_suelo = data["tipoSuelo"].lower()

    soil_type_str = SUELO_MAP.get(tipo_suelo, "Franco limoso")
    variedad_maiz = data.get("variedad_maiz", "Híbrido convencional")
    maiz_str = VARIEDAD_MAP.get(variedad_maiz.lower(), "Pioneer P4039")
    altitud = float(data.get("altitud", 45.0))
    ubicacion = data.get("ubicacion", "")

    # Determinar provincia y zona por la ubicación del texto
    provincia = "Los Ríos"
    zona = "Costa_Invierno"

    ubicacion_lower = ubicacion.lower()
    if "manabi" in ubicacion_lower or "manabí" in ubicacion_lower:
        provincia, zona = "Manabí", "Costa_Invierno"
    elif "guayas" in ubicacion_lower or "guayaquil" in ubicacion_lower:
        provincia, zona = "Guayas", "Costa_Invierno"
    elif "los ríos" in ubicacion_lower or "los rios" in ubicacion_lower or "quevedo" in ubicacion_lower:
        provincia, zona = "Los Ríos", "Costa_Invierno"
    elif "loja" in ubicacion_lower:
        provincia, zona = "Loja", "Loja_Subtropical"
    elif "imbabura" in ubicacion_lower or "carchi" in ubicacion_lower or "pichincha" in ubicacion_lower or "quito" in ubicacion_lower:
        provincia, zona = "Pichincha", "Sierra_Norte"
    elif "chimborazo" in ubicacion_lower or "cotopaxi" in ubicacion_lower or "tungurahua" in ubicacion_lower:
        provincia, zona = "Chimborazo", "Sierra_Centro"
    elif "azuay" in ubicacion_lower or "cañar" in ubicacion_lower:
        provincia, zona = "Azuay", "Sierra_Sur"
    elif "napo" in ubicacion_lower or "pastaza" in ubicacion_lower or "orellana" in ubicacion_lower or "morona" in ubicacion_lower:
        provincia, zona = "Orellana", "Amazonía"

    riego_tipo = "temporal_lluvia"
    if prec < 450:
        riego_tipo = "gravedad"

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

    # APIs de precisión (si hay coordenadas)
    lat = data.get("latitud")
    lon = data.get("longitud")
    precision_soil = None
    precision_weather = None
    historical_weather = None
    inamhi_info = None
    if lat is not None and lon is not None:
        try:
            lat_f = float(lat)
            lon_f = float(lon)
            if abs(lat_f) > 0.01 or abs(lon_f) > 0.01:
                precision_soil = fetch_precision_soil(lat_f, lon_f)
                precision_weather = fetch_precision_weather(lat_f, lon_f)
                if data.get("incluir_historico") is True:
                    try:
                        historical_weather = fetch_open_meteo_historical(lat_f, lon_f, timeout=6.0)
                    except Exception as history_ex:
                        print(f"[ML Engine] Error consultando histórico Open-Meteo: {str(history_ex)}")
                try:
                    from src.inamhi_climate import inamhi_db
                    station = inamhi_db.get_nearest_station(lat_f, lon_f)
                    if station:
                        stats = inamhi_db.get_aggregated_stats(station['id'])
                        inamhi_info = {
                            "estacion": station,
                            "estadisticas": stats
                        }
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
    features_dict["fosforo_p2o5_kg_ha"] = [fert * 0.4]
    features_dict["potasio_k2o_kg_ha"] = [fert * 0.3]
    features_dict["biofertilizante"] = [1.0 if fert < 100 else 0.0]

    df_features = pd.DataFrame(features_dict)

    # Metadata extra que se usa en la respuesta final
    metadata = {
        "zona": zona,
        "provincia": provincia,
        "datos_entrada": {
            "temperatura": temp,
            "humedad": hum,
            "precipitacion": prec,
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
