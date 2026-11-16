import { plot } from './explanationData.mjs';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
const date = offset => new Date(Date.parse(`${today}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
export const climatePlot = { ...plot, fecha_siembra: '2026-10-10', tipo_fecha_siembra: 'real_declarada', ciclo_dias: 150, riego_tipo: 'goteo' };
export const climateData = {
  cultivo_activo: climatePlot, consultado_en: `${today}T10:00:00-05:00`,
  clima_hoy: { disponible: true, fuente: 'Open-Meteo Forecast', actual: { fecha_hora: `${today}T10:00`, temperatura_c: 27.5, humedad_relativa_pct: 80, viento_kmh: 5, codigo_tiempo: 3, descripcion: 'Parcialmente nublado' } },
  pronostico_7d: Array.from({ length: 7 }, (_, i) => ({ fecha: date(i), temp_max_c: 30 + i % 3, temp_min_c: 21, precipitacion_mm: i, prob_precipitacion_pct: 20 + i * 10, descripcion: i > 2 ? 'Lluvia' : 'Parcialmente nublado', codigo_tiempo: i > 2 ? 61 : 3 })),
  periodo_clima_reciente: { inicio: date(-36), fin: date(-7), dias: 30 },
  clima_diaria_30d: Array.from({ length: 30 }, (_, i) => ({ fecha: date(-36 + i), precip_mm: i === 4 ? null : i % 5, et0_mm: 3, temp_media_c: 25 + i % 3 })),
  resumen_mensual_12m: { fuente: 'Open-Meteo Archive · ERA5', periodo: { inicio: '2025-11-01', fin: '2026-10-31' }, meses: [{ mes: '2026-09', precipitacion_mm: 0, temp_media_c: 25, dias_lluvia: 30, dias_temperatura: 30 }, { mes: '2026-10', precipitacion_mm: null, temp_media_c: 26, dias_lluvia: 30, dias_temperatura: 31 }] },
  suelo_ahora: { humedad_0_10cm: .23, temperatura_0_10cm: 24 },
  lluvia_anual_referencia: { valor: 1200, unidad: 'mm/año', fuente: 'INAMHI', periodo: '2000–2019', estacion: 'Prueba documental' },
  kpis: { enso: { indice: 'RONI', valor_indice: 1.97, periodo: 'ASO 2026', estado_texto: 'Anomalía cálida del Pacífico tropical', vigente: true } },
  api_source: 'Open-Meteo Archive',
};
export const climateObservations = { datos: {}, indicadores: { etapa_observada: { valor: 'Vegetativo V2–V8', fecha: date(-1) } } };
