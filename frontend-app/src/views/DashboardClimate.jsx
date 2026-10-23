import { useState, useEffect } from 'react';
import { dssService } from '../services/api';
import ClimateLine from '../templates/Charts/ClimateLine';
import CalendarGrid from '../templates/Common/CalendarGrid';
import InfoModal from '../templates/Common/InfoModal';
import AIExplainModal from '../templates/Common/AIExplainModal';
import EmptyDashboard from '../templates/Common/EmptyDashboard';
import DashboardIntro, { DashboardSectionHeading } from '../templates/Common/DashboardIntro';
import useExplicacionIA from '../hooks/usarExplicacionIA';
import {
  CheckCircle,
  AlertTriangle,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatMetricNumber = (value, maximumFractionDigits = 1) => (
  value === null ? 'Sin datos' : value.toLocaleString('es-EC', { maximumFractionDigits })
);

const weatherIcon = (code) => {
  const codigo = Number(code);
  if (codigo === 0) return <Sun size={18} />;
  if (codigo >= 95) return <CloudLightning size={18} />;
  if ((codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return <CloudRain size={18} />;
  if (codigo === 45 || codigo === 48) return <Cloud size={18} />;
  return <CloudSun size={18} />;
};

const formatForecastDay = (fecha) => {
  if (!fecha) return '—';
  const fechaLocal = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(fechaLocal.getTime())) return String(fecha);
  return fechaLocal.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric' });
};

export default function DashboardClimate({ cultivoElegidoId, anioSeleccionado, onNavigate, onDashboardData }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalData, setModalData] = useState(null);

  const {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    pedirExplicacionIa
  } = useExplicacionIA(cultivoElegidoId, anioSeleccionado);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await dssService.getClimateData(cultivoElegidoId, anioSeleccionado);
        setData(res);
      } catch {
        setError('Error al cargar datos de riesgo climático.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [cultivoElegidoId, anioSeleccionado]);

  useEffect(() => {
    if (data && !data.sin_datos && onDashboardData) onDashboardData(data);
  }, [data, onDashboardData]);

  if (loading) {
    return <div className="flex-center" style={{ height: '70vh', color: 'var(--text-muted)' }}>Cargando DSS Climático...</div>;
  }

  if (error) {
    return <div className="bg-danger-alpha text-danger" style={{ padding: '1rem', borderRadius: '12px' }}>{error}</div>;
  }

  if (data?.sin_datos) {
    return <EmptyDashboard tipo="climate" onGoToSimulation={() => onNavigate?.('simular')} />;
  }

  const { kpis, timeline_anomalia, agua_estratos, timeline_fenologico, fecha_siembra } = data || {};
  const climaHoy = data?.clima_hoy;
  const pronostico = Array.isArray(data?.pronostico_7d) ? data.pronostico_7d : [];
  const promedio30d = data?.clima_promedio_30d || data?.clima_actual;
  const ensoEstado = String(kpis?.enso?.estado || '').trim();
  const probLluviaBaja = toFiniteNumber(kpis?.prob_lluvia_bajo_promedio);
  const aguaUtilInicial = toFiniteNumber(kpis?.agua_util);
  const riesgoEstacional = typeof kpis?.indice_riesgo === 'string'
    ? { nivel: kpis.indice_riesgo }
    : (kpis?.indice_riesgo && typeof kpis.indice_riesgo === 'object' ? kpis.indice_riesgo : {});
  const riesgoEstacionalTexto = String(riesgoEstacional.nivel || '').trim();

  // Helper for safe date parsing across browsers
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    const cleanStr = String(dateStr).split(' ')[0].split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? new Date() : fallback;
  };

  // Map phenological stages to Date objects
  const mapPhenologyToEvents = (timeline, baseSowingDateStr) => {
    const sowingDate = parseLocalDate(baseSowingDateStr);

    const stagesRanges = [
      { startOffset: 0, endOffset: 14 },
      { startOffset: 15, endOffset: 59 },
      { startOffset: 60, endOffset: 79 },
      { startOffset: 80, endOffset: 110 }
    ];

    return (timeline || []).map((item, idx) => {
      const range = stagesRanges[idx] || { startOffset: 0, endOffset: 15 };
      
      const start = new Date(sowingDate.getTime());
      start.setDate(sowingDate.getDate() + range.startOffset);
      
      const end = new Date(sowingDate.getTime());
      end.setDate(sowingDate.getDate() + range.endOffset);

      let color = 'info';
      if (item.alerta === 'Alto' || item.alerta === 'Alta') color = 'danger';
      else if (item.alerta === 'Moderado' || item.alerta === 'Media') color = 'warning';
      else if (item.alerta === 'Bajo' || item.alerta === 'Baja') color = 'success';

      return {
        start,
        end,
        title: item.etapa,
        color,
        description: `${item.riesgo}: ${item.descripcion}`
      };
    });
  };

  const calendarEvents = mapPhenologyToEvents(timeline_fenologico, fecha_siembra);
  const getInitialCalendarDate = () => {
    const today = new Date();
    let year = today.getFullYear();
    if (fecha_siembra) {
      const sowing = parseLocalDate(fecha_siembra);
      year = sowing.getFullYear();
    }
    return new Date(year, today.getMonth(), today.getDate());
  };
  const initialCalendarDate = getInitialCalendarDate();

  return (
    <div className="dashboard-view dashboard-view--climate">
      <DashboardIntro
        step="03 / Agroclima"
        title="Clima a lo largo del cultivo"
        description="Relaciona el agua, la lluvia y la temperatura con las etapas fenológicas y sus riesgos para esta parcela."
        interpretation="Revisa primero el riesgo estacional y la fase del cultivo. Después contrasta las anomalías mensuales con el agua útil del suelo."
        source={data?.api_source ? `Contexto base: ${data.api_source} · series mensuales modeladas` : 'Contexto climático del lote · series mensuales modeladas'}
      />

      <DashboardSectionHeading
        label="Ahora"
        title="Clima actual y pronóstico"
        description="Lectura de corto plazo para la parcela. El promedio de 30 días se muestra aparte para no confundir clima observado con pronóstico."
      />

      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
        {climaHoy?.disponible ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'stretch' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0, padding: '1rem', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.18)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                  <span style={{ display: 'inline-flex', width: '2rem', height: '2rem', borderRadius: '999px', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.16)', color: '#60a5fa' }}>
                    {weatherIcon(climaHoy.actual?.codigo_tiempo)}
                  </span>
                  {climaHoy.actual?.descripcion || 'Condición actual'}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.35rem', marginTop: '0.65rem' }}>
                  <span style={{ fontSize: '2.7rem', lineHeight: 1, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatMetricNumber(climaHoy.actual?.temperatura_c)}
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>°C</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.85rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Droplets size={14} /> {formatMetricNumber(climaHoy.actual?.humedad_relativa_pct)} % HR</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CloudRain size={14} /> {formatMetricNumber(climaHoy.actual?.precipitacion_mm)} mm</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Wind size={14} /> {formatMetricNumber(climaHoy.actual?.viento_kmh)} km/h</span>
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.68rem', color: 'var(--text-subtle)', lineHeight: 1.4 }}>
                  {climaHoy.actual?.fecha_hora ? `Observado: ${climaHoy.actual.fecha_hora}` : 'Hora de observación no disponible'} · {climaHoy.fuente || 'Open-Meteo Forecast'}
                </div>
              </div>

              <div style={{ flex: '2 1 420px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.65rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pronóstico de 7 días</div>
                  <span style={{ fontSize: '0.64rem', padding: '0.16rem 0.5rem', borderRadius: '999px', background: 'rgba(34, 197, 94, 0.12)', color: '#4ade80', fontWeight: 700 }}>Pronóstico</span>
                </div>
                {pronostico.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))', gap: '0.5rem' }}>
                    {pronostico.map((dia) => (
                      <div key={dia.fecha} style={{ padding: '0.65rem 0.5rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.035)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.28rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{formatForecastDay(dia.fecha)}</span>
                        <span style={{ color: '#60a5fa' }}>{weatherIcon(dia.codigo_tiempo)}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatMetricNumber(dia.temp_max_c)}° / {formatMetricNumber(dia.temp_min_c)}°</span>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{formatMetricNumber(dia.precipitacion_mm)} mm</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-subtle)' }}>{formatMetricNumber(dia.prob_precipitacion_pct)} % lluvia</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    No hay pronóstico diario disponible para esta parcela.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem 1rem', marginTop: '0.9rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Thermometer size={13} /> Promedio 30 días: {formatMetricNumber(promedio30d?.temperatura)} °C</span>
              <span>{formatMetricNumber(promedio30d?.humedad)} % HR</span>
              <span>
                {promedio30d?.precipitacion_30d != null
                  ? `${formatMetricNumber(promedio30d.precipitacion_30d)} mm en 30 días · ${formatMetricNumber(promedio30d?.precipitacion_anual_estimada ?? promedio30d?.precipitacion)} mm/año est.`
                  : `${formatMetricNumber(promedio30d?.precipitacion_anual_estimada ?? promedio30d?.precipitacion)} mm/año estimados`}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>El promedio histórico no es el clima de hoy.</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            <CloudSun size={20} style={{ flexShrink: 0, color: '#60a5fa' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Clima actual no disponible.</strong>{' '}
              {climaHoy?.error || 'La parcela necesita coordenadas válidas para consultar Open-Meteo Forecast.'}
            </div>
          </div>
        )}
      </div>

      <DashboardSectionHeading label="02 · Señales" title="Estado del clima y del cultivo" description="Los indicadores sin una fuente disponible no se presentan como mediciones reales." />

      {/* Unified Phenology & Climate Risk Dashboard Card */}
      <div className="glass-panel dss-unified-card" style={{ animation: 'fadeIn 0.5s ease' }}>
        
        {/* Top metrics and risk badge row */}
        <div className="dss-card-metrics-row">
          
          {/* Left: 3 metrics */}
          <div className="dss-metrics-left-grid">
            
            {/* Metric 1: Estado ENSO */}
            <div 
              className={`dss-metric-col ${!ensoEstado ? 'dss-metric-empty' : ''}`}
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Estado ENSO (El Niño / Oscilación del Sur)",
                cultivo: "maiz",
                valor: ensoEstado || null,
                unidad: "",
                estado: !ensoEstado ? 'sin_datos' : (kpis?.enso?.color === 'danger' ? 'riesgoso' : (kpis?.enso?.color === 'warning' ? 'regular' : 'favorable')),
                rango_ideal: "Fase Neutral o La Niña Moderada",
                descripcion_tecnica: "Indicador global de anomalías de temperatura en el Océano Pacífico. Determina patrones de lluvia intensos (El Niño) o sequías prolongadas (La Niña) en la costa y sierra de Ecuador."
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div 
                className="dss-metric-value" 
                style={{ color: kpis?.enso?.color === 'danger' ? '#ef4444' : (kpis?.enso?.color === 'warning' ? '#eab308' : '#16a34a') }}
              >
                {ensoEstado || 'Sin datos'}
              </div>
              <div className="dss-metric-title">ENSO de referencia</div>
              <div className="dss-metric-trend" style={{ color: 'var(--text-muted)' }}>
                {ensoEstado ? 'Fase climática actual' : 'Dato no disponible'}
              </div>
            </div>

            {/* Metric 2: Prob. Lluvia Mínima */}
            <div 
              className={`dss-metric-col ${probLluviaBaja === null ? 'dss-metric-empty' : ''}`}
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Probabilidad de Lluvia por debajo del Promedio",
                cultivo: "maiz",
                valor: probLluviaBaja,
                unidad: "%",
                estado: probLluviaBaja === null ? "sin_datos" : (probLluviaBaja > 60 ? "riesgoso" : (probLluviaBaja > 30 ? "regular" : "favorable")),
                rango_ideal: "Baja probabilidad (menor a 35%)",
                descripcion_tecnica: "Estima la probabilidad acumulada de que las precipitaciones pluviales durante la campaña agrícola sean significativamente inferiores a la media climatológica del sector."
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {formatMetricNumber(probLluviaBaja)} {probLluviaBaja !== null && <span>%</span>}
              </div>
              <div className="dss-metric-title">Riesgo estimado de lluvia baja</div>
              <div className={`dss-metric-trend ${probLluviaBaja === null ? '' : 'up'}`}>
                {probLluviaBaja === null ? 'Dato no disponible' : 'Probabilidad del ciclo'}
              </div>
            </div>

            {/* Metric 3: Agua Útil Inicial */}
            <div 
              className={`dss-metric-col ${aguaUtilInicial === null ? 'dss-metric-empty' : ''}`}
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Agua Útil Inicial en Suelo",
                cultivo: "maiz",
                valor: aguaUtilInicial,
                unidad: "mm",
                estado: aguaUtilInicial === null ? "sin_datos" : (aguaUtilInicial > 120 ? "favorable" : (aguaUtilInicial > 60 ? "regular" : "riesgoso")),
                rango_ideal: "100 a 160 mm",
                descripcion_tecnica: "Volumen de agua almacenada en el perfil del suelo que está disponible para ser absorbido por las raíces al momento del arranque de la siembra."
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {formatMetricNumber(aguaUtilInicial)} {aguaUtilInicial !== null && <span>mm</span>}
              </div>
              <div className="dss-metric-title">Agua útil estimada</div>
              <div className={`dss-metric-trend ${aguaUtilInicial === null ? '' : 'up'}`}>
                {aguaUtilInicial === null ? 'Dato no disponible' : 'Balance hídrico del suelo'}
              </div>
            </div>

          </div>

          {/* Right: Risk Badge */}
          {(() => {
            const riskText = riesgoEstacionalTexto.toLowerCase();
            const riskColor = riesgoEstacional.color || '';
            let levelClass = riesgoEstacionalTexto ? 'level-danger' : 'level-empty';
            if (riskColor === 'success' || riskText.includes('bajo')) {
              levelClass = 'level-success';
            } else if (riskColor === 'warning' || riskText.includes('medio') || riskText.includes('moderad') || riskText.includes('regular')) {
              levelClass = 'level-warning';
            }
            return (
              <div 
                className={`dss-risk-badge-box ${levelClass}`}
                onClick={() => pedirExplicacionIa({
                  tipo_elemento: "tarjeta",
                  nombre: "Índice de Riesgo Estacional Compuesto",
                  cultivo: "maiz",
                  valor: riesgoEstacionalTexto || null,
                  unidad: "",
                  estado: levelClass === 'level-empty' ? 'sin_datos' : (levelClass === 'level-danger' ? 'riesgoso' : (levelClass === 'level-warning' ? 'regular' : 'favorable')),
                  rango_ideal: "Bajo",
                  descripcion_tecnica: "Índice de riesgo total calculado ponderando de forma conjunta la falta de agua, los picos de calor y la probabilidad de heladas/inundaciones estacionales."
                })}
                style={{ cursor: 'pointer' }}
                title="Clic para ver detalle del riesgo"
              >
                <div className={`dss-risk-icon-wrap ${levelClass}`}>
                  {levelClass === 'level-success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div className="dss-risk-text-info">
                  <span className="dss-risk-label">Riesgo Estacional</span>
                  <span className="dss-risk-value">{riesgoEstacionalTexto || 'Sin datos'}</span>
                  <span className="dss-risk-sub">{riesgoEstacionalTexto ? `Riesgo compuesto · ${riesgoEstacionalTexto}` : 'Se requiere una evaluación climática'}</span>
                </div>
              </div>
            );
          })()}

        </div>

        {/* Bottom phenology stage track (6 stages) */}
        <div className="dss-timeline-section">
          <div className="dss-timeline-title">Estado de Crecimiento del Cultivo — Etapas Fenológicas Simuladas</div>
          <div className="dss-timeline-track">
            {(() => {
              const today = new Date();
              let activeStageIndex = 0; // Default: Siembra (0)
              
              if (calendarEvents && calendarEvents.length > 0) {
                const activeEventIdx = calendarEvents.findIndex(event => today >= event.start && today <= event.end);
                if (activeEventIdx !== -1) {
                  activeStageIndex = activeEventIdx + 1; // Emergencia = 1, Vegetativo = 2, etc.
                } else {
                  if (today > calendarEvents[calendarEvents.length - 1].end) {
                    activeStageIndex = 5; // Madurez
                  } else if (today < calendarEvents[0].start) {
                    activeStageIndex = 0; // Siembra
                  } else {
                    activeStageIndex = 2; // Default Vegetativo
                  }
                }
              }

              const stagesList = [
                { key: 'siembra', name: 'Siembra', desc: 'Inicio' },
                { key: 'emergencia', name: 'Emergencia', desc: 'VE - V1' },
                { key: 'vegetativo', name: 'Vegetativo', desc: 'V2 - VT' },
                { key: 'floracion', name: 'Floración', desc: 'R1' },
                { key: 'llenado', name: 'Llenado', desc: 'R2 - R5' },
                { key: 'madurez', name: 'Madurez', desc: 'R6' }
              ];

              return stagesList.map((stage, idx) => {
                const isActive = activeStageIndex === idx;
                return (
                  <div 
                    key={stage.key} 
                    className={`dss-timeline-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      if (idx > 0 && idx <= calendarEvents.length) {
                        const event = calendarEvents[idx - 1];
                        pedirExplicacionIa({
                          tipo_elemento: "tarjeta",
                          nombre: `Etapa: ${event.title}`,
                          cultivo: "maiz",
                          valor: event.title,
                          unidad: "",
                          estado: event.color === 'danger' ? 'riesgoso' : (event.color === 'warning' ? 'regular' : 'favorable'),
                          descripcion_tecnica: `Rango simulado del ${event.start.toLocaleDateString()} al ${event.end.toLocaleDateString()}. ${event.description}`
                        });
                      } else {
                        pedirExplicacionIa({
                          tipo_elemento: "tarjeta",
                          nombre: `Etapa: ${stage.name}`,
                          cultivo: "maiz",
                          valor: stage.name,
                          unidad: "",
                          estado: "favorable",
                          descripcion_tecnica: `Etapa de ${stage.name} (${stage.desc}) simulada según calendario del híbrido.`
                        });
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                    title={`Clic para ver detalles de la etapa ${stage.name}`}
                  >
                    <span className="dss-timeline-item-name">{stage.name}</span>
                    <span className="dss-timeline-item-sub">{isActive ? 'Etapa Actual' : stage.desc}</span>
                    <div className="dss-timeline-dot" />
                  </div>
                );
              });
            })()}
          </div>
        </div>

      </div>

      {/* Charts section */}
      <DashboardSectionHeading label="03 · Tendencias" title="Lluvia, temperatura y suelo" description="Las series muestran cambios en el tiempo; las barras de suelo separan la disponibilidad de agua por estrato." />
      <div className="chart-grid">
        {/* Anomaly Chart */}
        <div 
          className="glass-panel chart-panel-interactive"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Escenario Mensual Modelado de Lluvia y Temperatura",
            cultivo: "maiz",
            valor: "Series mensuales de referencia y escenario",
            unidad: "",
            estado: "escenario modelado",
            descripcion_tecnica: "Serie mensual orientativa generada por el modelo a partir de la región y el año seleccionados. No es un pronóstico meteorológico ni una observación histórica mensual de una estación.",
            impacto_base: "Permite comparar la lluvia de referencia con la del escenario modelado y observar su relación con la temperatura estimada.",
            recomendacion_base: "Verificar si hay meses de alta sequía para programar riegos adicionales o meses lluviosos para limpiar drenajes.",
            datos_grafico: timeline_anomalia
          })}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Escenario mensual de lluvia y temperatura</h3>
          </div>
          <div className="glass-card-body">
            <ClimateLine 
              labels={timeline_anomalia?.labels || []}
              lluviaHistorica={timeline_anomalia?.lluvia_historica || []}
              lluviaAnomala={timeline_anomalia?.lluvia_anomala || []}
              temperaturaAnomala={timeline_anomalia?.temperatura_anomala || []}
            />
            <p className="dashboard-chart-caption">Series mensuales simuladas. La fuente climática del encabezado aporta contexto de la parcela, pero no convierte esta serie en una medición observada.</p>
          </div>
        </div>

        {/* Soil strata */}
        <div 
          className="glass-panel chart-panel-interactive"
          style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Agua Útil por Estrato de Suelo",
            cultivo: "maiz",
            valor: "Distribución de agua útil en estratos",
            unidad: "mm",
            estado: "perfil de humedad",
            descripcion_tecnica: "Representación del agua útil disponible en milímetros a diferentes profundidades del suelo (0-20cm, 20-40cm, 40-60cm y 60-100cm).",
            impacto_base: "El maíz requiere humedad en los estratos superiores para germinación y fases iniciales, pero depende del agua de capas profundas para soportar periodos secos en floración.",
            recomendacion_base: "Si observa estratos superficiales secos (0-20 cm < 30mm) en siembra temprana, aplique riegos de germinación.",
            datos_grafico: agua_estratos
          })}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, margin: 0 }}>Agua Útil por Estrato de Suelo</h3>
            <span style={{ fontSize: '0.64rem', padding: '0.12rem 0.45rem', borderRadius: '5px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontWeight: 600 }}>Perfil Hídrico</span>
          </div>
          
          <div className="glass-card-body" style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {(agua_estratos?.labels || ['0-20 cm', '20-40 cm', '40-60 cm', '60-100 cm']).map((label, index) => {
                const val = agua_estratos?.valores?.[index] ?? 0;
                const percentage = Math.min(100, Math.max(8, (val / 60) * 100));
                
                return (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '75px 1fr 45px', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: 600 }}>{label}</span>
                    <div style={{ height: '7px', background: 'var(--border-subtle)', borderRadius: '999px', overflow: 'hidden', width: '100%' }}>
                      <div 
                        style={{ 
                          width: `${percentage}%`, 
                          height: '100%',
                          background: val > 0 ? 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)' : 'var(--border-strong)',
                          borderRadius: '999px',
                          boxShadow: val > 0 ? '0 0 6px rgba(59, 130, 246, 0.3)' : 'none',
                          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: val > 0 ? '#3b82f6' : 'var(--text-subtle)', textAlign: 'right' }}>{val} mm</span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '0.35rem', padding: '0.45rem 0.65rem', background: 'rgba(59, 130, 246, 0.06)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.15)', fontSize: '0.7rem' }}>
              <span style={{ fontWeight: 700, color: '#60a5fa', marginRight: '0.4rem' }}>Nota Edafológica:</span>
              <span style={{ color: 'var(--text-muted)', lineHeight: '1.3' }}>
                Capas 0–40 cm sostienen etapa vegetativa; 40–100 cm sostienen floración en sequía.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar & Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
        {/* Calendar (Left Column) */}
        <CalendarGrid 
          type="fenologico"
          events={calendarEvents} 
          initialDate={initialCalendarDate} 
          title="Calendario Fenológico y Riesgos Post-Siembra" 
        />

        {/* Risk Recommendations (Right Column) */}
        <div className="glass-panel" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 0 0.75rem 0', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Recomendaciones de Manejo por Fase</h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'block', marginTop: '0.15rem' }}>Acciones agronómicas clave para mitigar el riesgo climático por etapa</span>
            </div>
            <span style={{ fontSize: '0.7rem', padding: '0.25rem 0.65rem', borderRadius: '99px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', fontWeight: 700, letterSpacing: '0.02em', flexShrink: 0 }}>Plan Agroclimático</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', flex: 1 }}>
            
            {/* Emergencia */}
            <div 
              className="custom-card phase-step-card" 
              onClick={(e) => {
                e.stopPropagation();
                pedirExplicacionIa({
                  tipo_elemento: "tarjeta",
                  nombre: "Fase de Emergencia (Días 0-15)",
                  cultivo: "maiz",
                  valor: "Control de Germinación y Humedad Superficial",
                  unidad: "",
                  estado: "optimo",
                  rango_ideal: "Humedad del suelo entre 60-80% CC",
                  descripcion_tecnica: "Monitoreo preventivo de drenajes y saturación hídrica en los primeros 15 días posteriores a la siembra para garantizar el establecimiento uniforme de plántulas.",
                  impacto_base: "La pudrición por anegamiento reduce la densidad poblacional por hectárea hasta un 35% en maíces híbridos.",
                  recomendacion_base: "Verificar la evacuación rápida de escorrentía superficial y evitar la siembra en hendiduras compactadas."
                });
              }}
              style={{ 
                padding: '1rem 0.85rem', 
                background: 'rgba(15, 23, 42, 0.65)', 
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.12)', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                transition: 'all 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.5rem',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div>
                <div style={{ marginBottom: '0.4rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.05em' }}>PASO 01 · DÍAS 0–15</span>
                </div>
                <h4 style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.4rem 0' }}>Fase de Emergencia</h4>
                <p style={{ fontSize: '0.82rem', color: '#ffffff', lineHeight: '1.45', margin: 0 }}>
                  Monitorear drenajes para evitar encharcamientos que pudran la semilla en los primeros 10 días.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#ffffff', fontWeight: 700, marginTop: '0.5rem' }}>
                <span>Ver Análisis DSS</span> ➔
              </div>
            </div>

            {/* Crecimiento */}
            <div 
              className="custom-card phase-step-card" 
              onClick={(e) => {
                e.stopPropagation();
                pedirExplicacionIa({
                  tipo_elemento: "tarjeta",
                  nombre: "Fase de Crecimiento Vegetativo (V4 - V12)",
                  cultivo: "maiz",
                  valor: "Fraccionamiento de Nitrógeno y Deshierbe",
                  unidad: "",
                  estado: "favorable",
                  rango_ideal: "Dosis fraccionada en V4 y V8",
                  descripcion_tecnica: "Etapa de rápida acumulación de biomasa y definición del tamaño potencial de la mazorca. Requiere disponibilidad inmediata de nitrógeno y control estricto de malezas.",
                  impacto_base: "La competencia por luz y humedad en esta etapa causa clorosis e inhibición irreversible del rendimiento.",
                  recomendacion_base: "Aplicar la segunda dosis de urea o nitrato incorporándolo con ligera humedad en el suelo."
                });
              }}
              style={{ 
                padding: '1rem 0.85rem', 
                background: 'rgba(15, 23, 42, 0.65)', 
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.12)', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                transition: 'all 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.5rem',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div>
                <div style={{ marginBottom: '0.4rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.05em' }}>PASO 02 · V4 – V12</span>
                </div>
                <h4 style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.4rem 0' }}>Fase de Crecimiento</h4>
                <p style={{ fontSize: '0.82rem', color: '#ffffff', lineHeight: '1.45', margin: 0 }}>
                  Aplicar fertilización nitrogenada fraccionada y controlar malezas que compiten por humedad útil.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#ffffff', fontWeight: 700, marginTop: '0.5rem' }}>
                <span>Ver Análisis DSS</span> ➔
              </div>
            </div>

            {/* Floración */}
            <div 
              className="custom-card phase-step-card" 
              onClick={(e) => {
                e.stopPropagation();
                pedirExplicacionIa({
                  tipo_elemento: "tarjeta",
                  nombre: "Fase de Floración / Espigado (VT - R1)",
                  cultivo: "maiz",
                  valor: "Prevención de Estrés Térmico e Hídrico (Crítico)",
                  unidad: "",
                  estado: "riesgoso",
                  rango_ideal: "Temperatura menor a 32°C",
                  descripcion_tecnica: "El periodo más sensible de todo el ciclo. Temperaturas superiores a 33°C combinadas con sequía desincronizan la liberación de polen con la viabilidad de los estigmas (sedas).",
                  impacto_base: "Provoca mazorcas vanas con fallas severas de llenado de grano y caídas drásticas de rendimiento.",
                  recomendacion_base: "Asegurar riegos de auxilio antes de la emisión de la espiga si se pronostican olas de calor."
                });
              }}
              style={{ 
                padding: '1rem 0.85rem', 
                background: 'rgba(15, 23, 42, 0.65)', 
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.12)', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                transition: 'all 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.5rem',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div>
                <div style={{ marginBottom: '0.4rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.05em' }}>PASO 03 · VT – R1</span>
                </div>
                <h4 style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.4rem 0' }}>Fase de Floración</h4>
                <p style={{ fontSize: '0.82rem', color: '#ffffff', lineHeight: '1.45', margin: 0 }}>
                  Asegurar riego complementario si se pronostican olas de calor (&gt;33°C) para evitar el aborto de polen.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#ffffff', fontWeight: 700, marginTop: '0.5rem' }}>
                <span>Ver Análisis DSS</span> ➔
              </div>
            </div>

          </div>
        </div>
      </div>

      {modalData && (
        <InfoModal
          isOpen={!!modalData}
          onClose={() => setModalData(null)}
          title={modalData.title}
          source={modalData.source}
          description={modalData.description}
          stats={modalData.stats}
        />
      )}

      <AIExplainModal
        isOpen={mostrarModalIa}
        onClose={() => setMostrarModalIa(false)}
        loading={cargandoIa}
        data={datosIa}
      />
    </div>
  );
}
