import os
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

PRECIP_PATH = os.path.join(DATA_DIR, "inamhi-precipitacion-2019diciembre.csv")
TEMP_PATH = os.path.join(DATA_DIR, "inamhi-temperaturamedia-2019diciembre.csv")

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
    c = 2 * np.arcsin(np.sqrt(a))
    
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
                
            # Extraer estaciones únicas y sus coordenadas
            unique_stations = self.df_precip[['Estacion', 'NombreEstacion', 'latitud2', 'longitud2', 'altitud']].drop_duplicates('Estacion').dropna(subset=['latitud2', 'longitud2'])
            
            for _, row in unique_stations.iterrows():
                self.stations[row['Estacion']] = {
                    'id': row['Estacion'],
                    'nombre': row['NombreEstacion'],
                    'lat': float(row['latitud2']),
                    'lon': float(row['longitud2']),
                    'altitud': float(row['altitud']) if not pd.isna(row['altitud']) else 0.0
                }
            
            self.loaded = True
            print(f"[InamhiClimateDB] Base de datos INAMHI cargada con éxito. {len(self.stations)} estaciones encontradas.")
        except Exception as e:
            print(f"[InamhiClimateDB] Error al cargar los datasets del INAMHI: {str(e)}")
            
    def get_nearest_station(self, lat, lon):
        self.load_data()
        if not self.stations:
            return None
            
        min_dist = float('inf')
        nearest = None
        
        for st_id, st in self.stations.items():
            dist = haversine(lat, lon, st['lat'], st['lon'])
            if dist < min_dist:
                min_dist = dist
                nearest = st
                
        if nearest:
            nearest_copy = nearest.copy()
            nearest_copy['distancia_km'] = round(min_dist, 2)
            return nearest_copy
        return None
        
    def get_station_history(self, station_id):
        self.load_data()
        if not self.loaded:
            return None
            
        # Filtrar registros de la estación
        p_sub = self.df_precip[self.df_precip['Estacion'] == station_id]
        t_sub = self.df_temp[self.df_temp['Estacion'] == station_id]
        
        if p_sub.empty or t_sub.empty:
            return None
            
        months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
        
        history = []
        for anio in sorted(p_sub['anio'].unique()):
            p_row = p_sub[p_sub['anio'] == anio]
            t_row = t_sub[t_sub['anio'] == anio]
            
            if p_row.empty or t_row.empty:
                continue
                
            p_vals = p_row[months].values[0]
            t_vals = t_row[months].values[0]
            
            history.append({
                'anio': int(anio),
                'precipitacion': [float(x) if not pd.isna(x) else 0.0 for x in p_vals],
                'temperatura': [float(x) if not pd.isna(x) else 0.0 for x in t_vals]
            })
            
        return history

    def get_aggregated_stats(self, station_id):
        self.load_data()
        if not self.loaded:
            return None
            
        p_sub = self.df_precip[self.df_precip['Estacion'] == station_id]
        t_sub = self.df_temp[self.df_temp['Estacion'] == station_id]
        
        if p_sub.empty or t_sub.empty:
            return None
            
        months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
        
        # Calcular medias y desviaciones
        precip_means = p_sub[months].mean(numeric_only=True).to_dict()
        temp_means = t_sub[months].mean(numeric_only=True).to_dict()
        
        precip_stds = p_sub[months].std(numeric_only=True).to_dict()
        temp_stds = t_sub[months].std(numeric_only=True).to_dict()
        
        # Totales anuales
        annual_precip = p_sub[months].sum(axis=1, numeric_only=True)
        annual_temp = t_sub[months].mean(axis=1, numeric_only=True)
        
        return {
            'precipitacion_media_mensual': {m: round(float(v), 2) for m, v in precip_means.items()},
            'temperatura_media_mensual': {m: round(float(v), 2) for m, v in temp_means.items()},
            'precipitacion_std_mensual': {m: round(float(v), 2) if not pd.isna(v) else 0.0 for m, v in precip_stds.items()},
            'temperatura_std_mensual': {m: round(float(v), 2) if not pd.isna(v) else 0.0 for m, v in temp_stds.items()},
            'precipitacion_anual_promedio': round(float(annual_precip.mean()), 2),
            'temperatura_anual_promedio': round(float(annual_temp.mean()), 2),
            'mejor_anio_precip': int(p_sub.loc[annual_precip.idxmax(), 'anio']) if not p_sub.empty and not annual_precip.empty else None,
            'peor_anio_precip': int(p_sub.loc[annual_precip.idxmin(), 'anio']) if not p_sub.empty and not annual_precip.empty else None
        }

# Instancia singleton
inamhi_db = InamhiClimateDB()
inamhi_db.load_data()
