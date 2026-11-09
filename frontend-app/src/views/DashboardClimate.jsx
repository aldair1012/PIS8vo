import { useState, useEffect, useMemo } from 'react';
import { dssService } from '../services/api';
import ClimateLine from '../templates/Charts/ClimateLine';
import CalendarGrid from '../templates/Common/CalendarGrid';
import SimulationInfoCard from '../templates/Common/SimulationInfoCard';
import EmptyDashboard from '../templates/Common/EmptyDashboard';
import { DashboardSectionHeading } from '../templates/Common/DashboardSectionHeading';
import useExplicacionIA from '../hooks/usarExplicacionIA';
import { evidenceNumber as toFiniteNumber, evidenceDate, measuredPhenologyEvents, soilWaterRows } from '../utils/agronomicEvidence';
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

const formatMetricNumber = (value, maximumFractionDigits = 1) => {
  const number = toFiniteNumber(value);
  return number === null ? 'Sin datos' : number.toLocaleString('es-EC', { maximumFractionDigits });
};

const weatherIcon = (code) => {
  const codigo = toFiniteNumber(code);
  if (codigo === null) return <Cloud size={18} />;
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

export default function DashboardClimate({ cultivoElegidoId, añoSeleccionado, onNavigate, onDashboardData }) {
  const [response, setResponse] = useState(null);
  const requestKey = `${cultivoElegidoId ?? ''}:${añoSeleccionado ?? ''}`;
  const current = response?.key === requestKey ? response : null;
  const data = current?.data;
  const loading = current === null;
  const error = current?.error;
  const initialCalendarDate = useMemo(() => measuredPhenologyEvents(data?.timeline_fenologico)[0]?.start ?? evidenceDate(data?.fecha_siembra) ?? new Date(), [data]);

  const {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    pedirExplicacionIa
  } = useExplicacionIA(cultivoElegidoId, añoSeleccionado);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const res = await dssService.getClimaData(cultivoElegidoId, añoSeleccionado);
        if (active) setResponse({ key: requestKey, data: res });
      } catch {
        if (active) setResponse({ key: requestKey, error: 'Error al cargar datos de riesgo climático.' });
      }
    }
    loadData();
    return () => { active = false; };
  }, [cultivoElegidoId, añoSeleccionado, requestKey]);

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

  const { kpis, timeline_anomalia, agua_estratos, timeline_fenologico } = data || {};
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

  const phenology = Array.isArray(timeline_fenologico) ? timeline_fenologico.filter((row) => row && typeof row.etapa === 'string') : [];
  const calendarEvents = measuredPhenologyEvents(phenology);
  const waterRows = soilWaterRows(agua_estratos);
  const maxWaterValue = Math.max(0, ...waterRows.map((row) => row.value ?? 0)) || 1;
  const hasMonthlySeries = Array.isArray(timeline_anomalia?.labels) && ['lluvia_historica', 'lluvia_anomala', 'temperatura_anomala'].some((key) => Array.isArray(timeline_anomalia[key]) && timeline_anomalia[key].some((value) => toFiniteNumber(value) !== null));

  return (
    <div className="dashboard-view dashboard-view--climate">
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
                  <span style={{ display: 'inline-flex', width: '2rem', height: '2rem', borderRadius: '999px', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.16)', color: 'var(--zs-info)' }}>
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
                  {climaHoy.actual?.fecha_hora ? `Referencia temporal: ${climaHoy.actual.fecha_hora}` : 'Hora de referencia no disponible'} · {climaHoy.fuente || 'Fuente no informada'}
                </div>
              </div>

              <div style={{ flex: '2 1 420px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.65rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pronóstico de 7 días</div>
                  <span style={{ fontSize: '0.64rem', padding: '0.16rem 0.5rem', borderRadius: '999px', background: 'rgba(34, 197, 94, 0.12)', color: 'var(--zs-success)', fontWeight: 700 }}>Pronóstico</span>
                </div>
                {pronostico.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))', gap: '0.5rem' }}>
                    {pronostico.map((dia) => (
                      <div key={dia.fecha} style={{ padding: '0.65rem 0.5rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.035)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.28rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{formatForecastDay(dia.fecha)}</span>
                        <span style={{ color: 'var(--zs-info)' }}>{weatherIcon(dia.codigo_tiempo)}</span>
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

          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            <CloudSun size={20} style={{ flexShrink: 0, color: 'var(--zs-info)' }} />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Clima actual no disponible.</strong>{' '}
              {climaHoy?.error || 'La parcela necesita coordenadas válidas para consultar Open-Meteo Forecast.'}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem 1rem', marginTop: '0.9rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Thermometer size={13} /> Promedio 30 días: {formatMetricNumber(promedio30d?.temperatura)} °C</span>
          <span>{formatMetricNumber(promedio30d?.humedad)} % HR</span>
          <span>{promedio30d?.precipitacion_30d != null ? `${formatMetricNumber(promedio30d.precipitacion_30d)} mm en 30 días` : 'Sin acumulado de lluvia de 30 días'}</span>
          <span>{formatMetricNumber(promedio30d?.precipitacion_anual_estimada ?? promedio30d?.precipitacion)} mm/año estimados</span>
          <span>Fuente: {promedio30d?.fuente || data?.api_source || 'No informada'}</span>
          <span style={{ color: 'var(--text-muted)' }}>El promedio de 30 días y la extrapolación anual no son el clima de hoy ni mediciones del ciclo del cultivo.</span>
        </div>
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
                descripcion_tecnica: kpis?.enso?.desc || 'Se requiere una fuente ENSO con fecha y ámbito geográfico identificados. El clima de la parcela no permite deducir la fase de ENSO.'
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div 
                className="dss-metric-value" 
                style={{ color: !ensoEstado ? 'var(--text-muted)' : (kpis?.enso?.color === 'danger' ? 'var(--zs-danger)' : (kpis?.enso?.color === 'warning' ? 'var(--zs-warning)' : 'var(--zs-success)')) }}
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
                descripcion_tecnica: data?.procedencia?.riesgo?.motivo || 'Se necesita un modelo probabilístico calibrado y una climatología comparable para estimar lluvia por debajo del promedio.'
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
                descripcion_tecnica: data?.procedencia?.agua_util?.motivo || 'El agua disponible para raíces requiere mediciones del perfil y propiedades hidráulicas del suelo.'
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
            let levelClass = riesgoEstacionalTexto ? 'level-neutral' : 'level-empty';
            if (riskColor === 'danger' || /alto|elevado|cr[ií]tico/.test(riskText)) levelClass = 'level-danger';
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
                  descripcion_tecnica: data?.procedencia?.riesgo?.motivo || 'No hay una evaluación estacional disponible para esta parcela.'
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
          <div className="dss-timeline-title">Etapas fenológicas de referencia — desarrollo actual sin evaluar</div>
          <div className="dss-timeline-track">
            {phenology.map((stage, index) => <div key={`${stage.etapa}-${index}`} className="dss-timeline-item"
              onClick={() => pedirExplicacionIa({ tipo_elemento: 'tarjeta', nombre: `Referencia fenológica: ${stage.etapa}`, cultivo: 'maiz', valor: stage.etapa, estado: 'referencia_catalogo', descripcion_tecnica: `${stage.descripcion || 'No hay descripción de catálogo disponible.'} La etapa actual de esta parcela no ha sido observada ni evaluada.` })}
              style={{ cursor: 'pointer' }}>
              <span className="dss-timeline-item-name">{stage.etapa}</span>
              <span className="dss-timeline-item-sub">Referencia; sin evaluación</span>
              <div className="dss-timeline-dot" />
            </div>)}
            {phenology.length === 0 && <p className="chart-empty-state">No hay referencias fenológicas disponibles.</p>}
          </div>
        </div>

      </div>

      {/* Charts section */}
      <DashboardSectionHeading label="03 · Tendencias" title="Lluvia, temperatura y suelo" description="Los gráficos requieren series y mediciones con fuente. La ausencia de datos no representa un valor cero." />
      <div className="chart-grid">
        {/* Anomaly Chart */}
        <div 
          className="glass-panel chart-panel-interactive"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Series mensuales de lluvia y temperatura",
            cultivo: "maiz",
            valor: hasMonthlySeries ? 'Series mensuales disponibles' : null,
            unidad: "",
            estado: hasMonthlySeries ? 'serie_disponible' : 'sin_datos',
            descripcion_tecnica: timeline_anomalia?.motivo || 'La comparación requiere observaciones mensuales y una referencia climatológica identificada. No se puede inferir a partir del promedio de 30 días.',
            datos_grafico: timeline_anomalia
          })}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Series mensuales de lluvia y temperatura</h3>
          </div>
          <div className="glass-card-body">
            {hasMonthlySeries ? <ClimateLine
              labels={timeline_anomalia?.labels || []}
              lluviaHistorica={timeline_anomalia?.lluvia_historica || []}
              lluviaAnomala={timeline_anomalia?.lluvia_anomala || []}
              temperaturaAnomala={timeline_anomalia?.temperatura_anomala || []}
            /> : <p className="chart-empty-state" role="status">{timeline_anomalia?.motivo || 'No hay una serie mensual y una referencia climatológica disponibles para calcular anomalías.'}</p>}
            <p className="dashboard-chart-caption">El clima actual y el promedio de 30 días del encabezado no sustituyen una serie mensual de la campaña.</p>
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
                valor: waterRows.some((row) => row.value !== null) ? 'Agua útil disponible por estrato' : null,
            unidad: "mm",
            estado: waterRows.some((row) => row.value !== null) ? 'perfil_disponible' : 'sin_datos',
            descripcion_tecnica: agua_estratos?.motivo || 'El agua útil por profundidad requiere mediciones y propiedades hidráulicas; no se obtiene de la humedad del aire.',
            datos_grafico: agua_estratos
          })}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, margin: 0 }}>Agua Útil por Estrato de Suelo</h3>
            <span style={{ fontSize: '0.64rem', padding: '0.12rem 0.45rem', borderRadius: '5px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--zs-info)', fontWeight: 600 }}>Perfil Hídrico</span>
          </div>
          
          <div className="glass-card-body" style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {waterRows.map(({ label, value: val }) => {
                const percentage = val === null ? 0 : Math.min(100, Math.max(0, (val / maxWaterValue) * 100));
                
                return (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '75px 1fr 70px', alignItems: 'center', gap: '0.6rem' }}>
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
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: val !== null && val > 0 ? 'var(--zs-info)' : 'var(--text-subtle)', textAlign: 'right' }}>{val === null ? 'Sin datos' : `${formatMetricNumber(val)} mm`}</span>
                  </div>
                );
              })}
              {waterRows.length === 0 && <p className="chart-empty-state">No hay un perfil hídrico medido disponible.</p>}
            </div>

            <div style={{ marginTop: '0.35rem', padding: '0.45rem 0.65rem', background: 'rgba(59, 130, 246, 0.06)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.15)', fontSize: '0.7rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--zs-info)', marginRight: '0.4rem' }}>Nota Edafológica:</span>
              <span style={{ color: 'var(--text-muted)', lineHeight: '1.3' }}>
                {agua_estratos?.motivo || 'El agua útil requiere mediciones por profundidad y propiedades hidráulicas del suelo. La humedad relativa del aire no permite obtener este perfil.'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar & Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
        {/* Calendar (Left Column) */}
        {calendarEvents.length > 0 ? <CalendarGrid
          type="fenologico"
          events={calendarEvents} 
          initialDate={initialCalendarDate} 
          title="Fechas fenológicas registradas"
        /> : <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', marginTop: 0 }}>Fechas fenológicas no disponibles</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>La fecha de siembra y la descripción de etapas del catálogo no acreditan el desarrollo observado del cultivo. Se necesitan fechas de etapa registradas para mostrar eventos en este calendario.</p>
        </div>}

        {/* Referencias de catálogo, separadas de una evaluación del lote. */}
        <div className="glass-panel" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="glass-card-header" style={{ paddingBottom: '0.75rem', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Referencias de manejo por fase</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'block', marginTop: '0.15rem' }}>Información del catálogo; requiere comprobar la fase y las condiciones de la parcela antes de decidir una intervención.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', flex: 1 }}>
            {phenology.map((stage, index) => <div key={`${stage.etapa}-${index}`} className="custom-card phase-step-card"
              onClick={() => pedirExplicacionIa({
                tipo_elemento: 'tarjeta',
                nombre: `Referencia de manejo: ${stage.etapa}`,
                cultivo: 'maiz',
                valor: stage.etapa,
                estado: 'referencia_catalogo',
                descripcion_tecnica: `${stage.descripcion || 'No hay descripción disponible.'} Fuente: catálogo agronómico local. No se ha evaluado el estado actual del cultivo.`,
              })}
              style={{ padding: '1rem 0.85rem', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontWeight: 700 }}>REFERENCIA DE CATÁLOGO</span>
              <h4 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', margin: 0 }}>{stage.etapa}</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: 0 }}>{stage.descripcion || 'Sin descripción de manejo disponible.'}</p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Estado de la parcela: sin evaluar</span>
            </div>)}
            {phenology.length === 0 && <p className="chart-empty-state">No hay referencias de manejo disponibles.</p>}
          </div>
        </div>
      </div>

      <SimulationInfoCard
        isOpen={mostrarModalIa}
        onClose={() => setMostrarModalIa(false)}
        loading={cargandoIa}
        data={datosIa}
      />
    </div>
  );
}
