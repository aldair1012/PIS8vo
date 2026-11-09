import os
import math
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

PRECIP_PATH = os.path.join(DATA_DIR, "inamhi-precipitacion-2019diciembre.csv")
TEMP_PATH = os.path.join(DATA_DIR, "inamhi-temperaturamedia-2019diciembre.csv")
MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']


def _finite(value):
    """Un valor no disponible nunca se convierte en una medición de cero."""
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _rounded(value):
    number = _finite(value)
    return round(number, 2) if number is not None else None

def haversine(lat1, lon1, lat2, lon2):
    # Distancia en kilómetros usando la fórmula de Haversine
    R = 6371.0
    lat1_rad = np.radians(lat1)
    lon1_rad = np.radians(lon1)
    lat2_rad = np.radians(lat2)
    lon2_rad = np.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    a = np.sin(dlat / 2)**2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon / 2)**2
    c = 2 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    
    return R * c

class InamhiClimateDB:
    def __init__(self):
        self.stations = {}
        self.df_precip = None
        self.df_temp = None
        self.loaded = False
        
    def load_data(self):
        if self.loaded:
            return
        
        try:
            if not os.path.exists(PRECIP_PATH) or not os.path.exists(TEMP_PATH):
                print(f"[InamhiClimateDB] Advertencia: No se encontraron los archivos CSV en {DATA_DIR}")
                return
            
            # Leer reemplazando comas por puntos en los decimales y usando punto y coma como separador
            self.df_precip = pd.read_csv(PRECIP_PATH, sep=";", decimal=",", encoding="latin1")
            self.df_temp = pd.read_csv(TEMP_PATH, sep=";", decimal=",", encoding="latin1")
            
            # Limpiar columnas de coordenadas y altitud
            for df in [self.df_precip, self.df_temp]:
                df['latitud2'] = pd.to_numeric(df['latitud2'], errors='coerce')
                df['longitud2'] = pd.to_numeric(df['longitud2'], errors='coerce')
                df['altitud'] = pd.to_numeric(df['altitud'], errors='coerce')
                df['anio'] = pd.to_numeric(df['anio'], errors='coerce')
                for month in MONTHS:
                    df[month] = pd.to_numeric(df[month], errors='coerce').replace([np.inf, -np.inf], np.nan)
                    df.loc[df[month] <= -999, month] = np.nan
            for month in MONTHS:
                self.df_precip.loc[self.df_precip[month] < 0, month] = np.nan
                
            # Extraer estaciones únicas y sus coordenadas
            unique_stations = self.df_precip[['Estacion', 'NombreEstacion', 'latitud2', 'longitud2', 'altitud']].drop_duplicates('Estacion').dropna(subset=['latitud2', 'longitud2'])
            
            for _, row in unique_stations.iterrows():
                self.stations[row['Estacion']] = {
                    'id': row['Estacion'],
                    'nombre': row['NombreEstacion'],
                    'lat': float(row['latitud2']),
                    'lon': float(row['longitud2']),
                    'altitud': _finite(row['altitud'])
                }
            
            self.loaded = True
            print(f"[InamhiClimateDB] Base de datos INAMHI cargada con éxito. {len(self.stations)} estaciones encontradas.")
        except Exception as e:
            print(f"[InamhiClimateDB] Error al cargar los datasets del INAMHI: {str(e)}")
            
    def get_nearest_station(self, lat, lon, max_distance_km=100.0, start_year=None, end_year=None):
        """Referencia histórica más cercana con datos de ambas variables.

        El radio es una regla operativa configurable, no una garantía de
        representatividad climática. Las fechas filtran disponibilidad real:
        solicitar un periodo sin observaciones no reutiliza años antiguos.
        """
        self.load_data()
        if not self.stations:
            return None
        lat, lon, radius = _finite(lat), _finite(lon), _finite(max_distance_km)
        if lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180:
            return None
        if radius is None or radius <= 0:
            return None
        if start_year is not None and end_year is not None and start_year > end_year:
            return None
        min_dist = float('inf')
        nearest = None

        for st_id, st in self.stations.items():
            if not (math.isfinite(st['lat']) and math.isfinite(st['lon'])):
                continue
            if abs(st['lat']) > 90 or abs(st['lon']) > 180:
                continue
            dist = haversine(lat, lon, st['lat'], st['lon'])
            if dist > radius or dist >= min_dist:
                continue
            p_sub, t_sub = self._station_rows(st_id, start_year, end_year)
            if p_sub.empty or t_sub.empty:
                continue
            p_years = set(p_sub.loc[p_sub[MONTHS].notna().any(axis=1), 'anio'])
            t_years = set(t_sub.loc[t_sub[MONTHS].notna().any(axis=1), 'anio'])
            if p_years & t_years:
                min_dist = dist
                nearest = st
                
        if nearest:
            nearest_copy = nearest.copy()
            nearest_copy['distancia_km'] = round(min_dist, 2)
            nearest_copy['radio_busqueda_km'] = radius
            nearest_copy['criterio'] = 'Más cercana dentro del radio con lluvia y temperatura disponibles en al menos un mismo año del periodo consultado'
            nearest_copy['representatividad_agronomica'] = 'No validada por distancia: pendiente contrastar altitud y relieve de la parcela'
            return nearest_copy
        return None

    def _station_rows(self, station_id, start_year=None, end_year=None):
        subsets = []
        for frame in (self.df_precip, self.df_temp):
            subset = frame[frame['Estacion'] == station_id]
            subset = subset[subset['anio'].notna()]
            if start_year is not None:
                subset = subset[subset['anio'] >= start_year]
            if end_year is not None:
                subset = subset[subset['anio'] <= end_year]
            subsets.append(subset)
        return tuple(subsets)
        
    def get_station_history(self, station_id):
        self.load_data()
        if not self.loaded:
            return None
            
        # Filtrar registros de la estación
        p_sub, t_sub = self._station_rows(station_id)
        
        if p_sub.empty and t_sub.empty:
            return None
            
        history = []
        for anio in sorted(set(p_sub['anio']) | set(t_sub['anio'])):
            p_row = p_sub[p_sub['anio'] == anio]
            t_row = t_sub[t_sub['anio'] == anio]
            
            p_vals = p_row[MONTHS].values[0] if not p_row.empty else [None] * 12
            t_vals = t_row[MONTHS].values[0] if not t_row.empty else [None] * 12
            
            history.append({
                'anio': int(anio),
                'precipitacion': [_finite(x) for x in p_vals],
                'temperatura': [_finite(x) for x in t_vals]
            })
            
        return history

    def get_aggregated_stats(self, station_id):
        self.load_data()
        if not self.loaded:
            return None
            
        p_sub, t_sub = self._station_rows(station_id)
        
        if p_sub.empty or t_sub.empty:
            return None
            
        # Calcular medias y desviaciones
        precip_means = p_sub[MONTHS].mean(numeric_only=True).to_dict()
        temp_means = t_sub[MONTHS].mean(numeric_only=True).to_dict()
        
        precip_stds = p_sub[MONTHS].std(numeric_only=True).to_dict()
        temp_stds = t_sub[MONTHS].std(numeric_only=True).to_dict()
        
        # Totales anuales
        annual_precip = p_sub[MONTHS].sum(axis=1, min_count=12, numeric_only=True).dropna()
        complete_temp = t_sub[MONTHS].notna().all(axis=1)
        annual_temp = t_sub.loc[complete_temp, MONTHS].mean(axis=1, numeric_only=True)
        years = sorted(set(p_sub['anio']) | set(t_sub['anio']))
        
        return {
            'precipitacion_media_mensual': {m: _rounded(v) for m, v in precip_means.items()},
            'temperatura_media_mensual': {m: _rounded(v) for m, v in temp_means.items()},
            'precipitacion_std_mensual': {m: _rounded(v) for m, v in precip_stds.items()},
            'temperatura_std_mensual': {m: _rounded(v) for m, v in temp_stds.items()},
            'precipitacion_anual_promedio': _rounded(annual_precip.mean()),
            'temperatura_anual_promedio': _rounded(annual_temp.mean()),
            'mejor_anio_precip': int(p_sub.loc[annual_precip.idxmax(), 'anio']) if not p_sub.empty and not annual_precip.empty else None,
            'peor_anio_precip': int(p_sub.loc[annual_precip.idxmin(), 'anio']) if not p_sub.empty and not annual_precip.empty else None,
            'periodo': {'desde': int(min(years)), 'hasta': int(max(years))},
            'anios_completos_precipitacion': len(annual_precip),
            'anios_completos_temperatura': len(annual_temp),
            'meses_reportados_precipitacion': {m: int(p_sub[m].count()) for m in MONTHS},
            'meses_reportados_temperatura': {m: int(t_sub[m].count()) for m in MONTHS},
            'fuente': 'INAMHI, observaciones históricas mensuales de estación',
            'tipo': 'referencia_historica_estacion',
            'nota': 'No es una medición de la parcela ni clima observado o pronosticado del ciclo actual. Los totales anuales requieren doce meses y no se rellenan vacíos con cero.',
        }

# Instancia singleton
inamhi_db = InamhiClimateDB()
