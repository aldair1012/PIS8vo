import { useState, useEffect, useMemo } from 'react';
import { dssService } from '../services/api';
import GaussChart from '../templates/Charts/GaussChart';
import CalendarGrid from '../templates/Common/CalendarGrid';
import SimulationInfoCard from '../templates/Common/SimulationInfoCard';
import EmptyDashboard from '../templates/Common/EmptyDashboard';
import { DashboardSectionHeading } from '../templates/Common/DashboardSectionHeading';
import useExplicacionIA from '../hooks/usarExplicacionIA';
import { evidenceNumber as toFiniteNumber, scenarioHeatmap, catalogSowingEvents } from '../utils/agronomicEvidence';
import {
  AlertTriangle, 
  Thermometer,
  Sprout,
  Flame,
  CloudRain,
  CheckCircle
} from 'lucide-react';

const formatMetricNumber = (value, maximumFractionDigits = 2) => (
  value === null ? 'Sin datos' : value.toLocaleString('es-EC', { maximumFractionDigits })
);

export default function DashboardScenario({ cultivoElegidoId, añoSeleccionado, onNavigate, onDashboardData }) {
  const [response, setResponse] = useState(null);
  const requestKey = `${cultivoElegidoId ?? ''}:${añoSeleccionado ?? ''}`;
  const current = response?.key === requestKey ? response : null;
  const data = current?.data;
  const loading = current === null;
  const error = current?.error;
  const [expandedIndex, setExpandedIndex] = useState(null);
  const selectedYear = toFiniteNumber(añoSeleccionado);
  const baseYearNum = Number.isInteger(selectedYear) && selectedYear >= 2000 && selectedYear <= 2100 ? selectedYear : new Date().getFullYear();
  const initialCalendarDate = useMemo(() => new Date(baseYearNum, new Date().getMonth(), 1), [baseYearNum]);

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
        const res = await dssService.getEscenarioData(cultivoElegidoId, añoSeleccionado);
        if (active) setResponse({ key: requestKey, data: res });
      } catch {
        if (active) setResponse({ key: requestKey, error: 'Error al cargar datos del planificador.' });
      }
    }
    loadData();
    return () => { active = false; };
  }, [cultivoElegidoId, añoSeleccionado, requestKey]);

  useEffect(() => {
    if (data && !data.sin_datos && onDashboardData) onDashboardData(data);
  }, [data, onDashboardData]);

  if (loading) {
    return <div className="flex-center" style={{ height: '70vh', color: 'var(--text-muted)' }}>Cargando DSS Planificador...</div>;
  }

  if (error) {
    return <div className="bg-danger-alpha text-danger" style={{ padding: '1rem', borderRadius: '12px' }}>{error}</div>;
  }

  if (!data || data.sin_datos || !data.kpis) {
    return <EmptyDashboard tipo="scenario" onGoToSimulation={() => onNavigate?.('simular')} />;
  }

  const { kpis, percentiles, viabilidad_siembra } = data;
  const heatmap = scenarioHeatmap(data.heatmap);
  const ranking = Array.isArray(data.ranking) ? data.ranking.filter((row) => row?.tipo === 'resultado_guardado' && Number.isInteger(row.simulacion_id) && row.simulacion_id > 0 && toFiniteNumber(row.valor) !== null) : [];
  const recomendaciones = Array.isArray(data.recomendaciones) ? data.recomendaciones.filter((row) => row && typeof row === 'object') : [];
  const resumen = data.resumen_descriptivo || {};
  const muestra = toFiniteNumber(resumen.muestra);
  const objetivo = toFiniteNumber(resumen.objetivo_referencia_t_ha);
  const rendimientoEsperado = toFiniteNumber(kpis.rendimiento_esperado);
  const fraccionSobreObjetivo = toFiniteNumber(resumen.fraccion_supera_objetivo_pct);
  const coeficienteVariacion = toFiniteNumber(resumen.coeficiente_variacion_pct);
  const riesgoAgronomico = typeof kpis.riesgo_agronomico === 'string'
    ? { texto: kpis.riesgo_agronomico }
    : (kpis.riesgo_agronomico && typeof kpis.riesgo_agronomico === 'object' ? kpis.riesgo_agronomico : {});
  const riesgoTexto = String(riesgoAgronomico.texto || '').trim();

  const getIcon = (name) => {
    switch(name) {
      case 'Thermometer':
      case 'ThermometerSun': return <Thermometer size={18} />;
      case 'Sprout': return <Sprout size={18} />;
      case 'Flame': return <Flame size={18} />;
      case 'CloudRainWind': return <CloudRain size={18} />;
      default: return <CheckCircle size={18} />;
    }
  };

  const calendarEvents = catalogSowingEvents(viabilidad_siembra, baseYearNum);
  const recommendedMonths = new Set(calendarEvents.map((event) => event.monthKey));

  const monthLabels = [
    { key: 'ene', name: 'ENE' },
    { key: 'feb', name: 'FEB' },
    { key: 'mar', name: 'MAR' },
    { key: 'abr', name: 'ABR' },
    { key: 'may', name: 'MAY' },
    { key: 'jun', name: 'JUN' },
    { key: 'jul', name: 'JUL' },
    { key: 'ago', name: 'AGO' },
    { key: 'sep', name: 'SEP' },
    { key: 'oct', name: 'OCT' },
    { key: 'nov', name: 'NOV' },
    { key: 'dic', name: 'DIC' }
  ];

  const totalRecommendedMonths = recommendedMonths.size;
  const recommendedProgress = Math.round(Math.min(100, (totalRecommendedMonths / monthLabels.length) * 100));
  const recommendedWindowLabel = totalRecommendedMonths > 0
    ? `${totalRecommendedMonths} mes${totalRecommendedMonths === 1 ? '' : 'es'} con referencia de catálogo`
    : 'Sin referencia de calendario disponible para esta parcela';

  // Dynamic relative scale calculation for the heatmap cells
  const allValues = heatmap.rows.map((item) => item.valor);
  const maxVal = allValues.length ? Math.max(...allValues) : 0;
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const getHeatmapStyle = (val) => {
    const isLight = typeof document !== 'undefined' && document.body.classList.contains('light-theme');

    if (val === null) return { bg: 'var(--surface-elevated)', text: 'var(--text-subtle)', border: 'var(--border-subtle)', badge: 'Sin simulación' };

    if (val < 4.5) {
      return {
        bg: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.25)',
        text: isLight ? '#991b1b' : '#fca5a5',
        border: isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.5)',
        badge: 'Menos de 4.5 t/ha'
      };
    }
    if (val < 6.0) {
      return {
        bg: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.25)',
        text: isLight ? '#92400e' : '#fde047',
        border: isLight ? '#fde047' : 'rgba(245, 158, 11, 0.5)',
        badge: 'Entre 4.5 y 6 t/ha'
      };
    }

    const pct = Math.min(1, Math.max(0, (val - minVal) / valRange));
    return {
      bg: isLight ? '#dcfce7' : `rgba(34, 197, 94, ${0.22 + pct * 0.25})`,
      text: isLight ? '#14532d' : '#86efac',
      border: isLight ? '#86efac' : 'rgba(34, 197, 94, 0.5)',
      badge: '6 t/ha o más'
    };
  };

  return (
    <div className="dashboard-view dashboard-view--scenario">
      <DashboardSectionHeading label="01 · Resumen" title="Resultados de simulaciones guardadas" description="Resumen descriptivo de ejecuciones de esta parcela. No representa probabilidades futuras ni estabilidad entre campañas." />
      {/* Unified Recommended Sowing Window Dashboard Card (Image 3 layout) */}
      <div className="glass-panel dss-unified-card" style={{ animation: 'fadeIn 0.5s ease' }}>
        
        {/* Top metrics and risk badge row */}
        <div className="dss-card-metrics-row">
          
          {/* Left: 3 metrics */}
          <div className="dss-metrics-left-grid">
            
            {/* Metric 1: Rendimiento Central */}
            <div
              className={`dss-metric-col ${rendimientoEsperado === null ? 'dss-metric-empty' : ''}`}
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Rendimiento medio de simulaciones guardadas",
                cultivo: "maiz",
                valor: rendimientoEsperado,
                unidad: "t/ha",
                estado: rendimientoEsperado === null ? "sin_datos" : "descriptivo",
                descripcion_tecnica: `Media de ${muestra ?? 'las'} simulaciones guardadas para la parcela y el periodo seleccionado. No es una nueva predicción ni una media observada de cosechas.`
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {formatMetricNumber(rendimientoEsperado)} {rendimientoEsperado !== null && <span>t/ha</span>}
              </div>
              <div className="dss-metric-title">Rendimiento medio guardado</div>
              <div className={`dss-metric-trend ${rendimientoEsperado === null ? '' : 'up'}`}>
                {rendimientoEsperado === null ? 'Dato no disponible' : `${muestra ?? '—'} simulaciones en la muestra`}
              </div>
            </div>

            {/* Metric 2: Superar Objetivo */}
            <div 
              className={`dss-metric-col ${fraccionSobreObjetivo === null ? 'dss-metric-empty' : ''}`}
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Fracción de simulaciones sobre el objetivo de referencia",
                cultivo: "maiz",
                valor: fraccionSobreObjetivo,
                unidad: "%",
                estado: fraccionSobreObjetivo === null ? "sin_datos" : "descriptivo",
                descripcion_tecnica: `Porcentaje de la muestra de simulaciones guardadas con rendimiento superior a ${objetivo ?? 'un objetivo no informado'} t/ha. Es una fracción empírica de esta muestra y no una probabilidad futura de éxito ni un umbral de rentabilidad calculado.`
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {formatMetricNumber(fraccionSobreObjetivo, 1)} {fraccionSobreObjetivo !== null && <span>%</span>}
              </div>
              <div className="dss-metric-title">Muestra sobre objetivo{objetivo !== null ? ` (${objetivo} t/ha)` : ''}</div>
              <div className="dss-metric-trend">
                {fraccionSobreObjetivo === null ? 'Dato no disponible' : 'Fracción empírica; no es probabilidad futura'}
              </div>
            </div>

            {/* Metric 3: Estabilidad Histórica */}
            <div 
              className={`dss-metric-col ${coeficienteVariacion === null ? 'dss-metric-empty' : ''}`}
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Coeficiente de variación de la muestra",
                cultivo: "maiz",
                valor: coeficienteVariacion,
                unidad: "%",
                estado: coeficienteVariacion === null ? "sin_datos" : "descriptivo",
                descripcion_tecnica: "Desviación estándar dividida por la media de los rendimientos guardados, expresada como porcentaje. Describe dispersión de ejecuciones y no demuestra estabilidad interanual ni incertidumbre predictiva. Requiere al menos dos valores y media positiva."
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {formatMetricNumber(coeficienteVariacion, 1)} {coeficienteVariacion !== null && <span>%</span>}
              </div>
              <div className="dss-metric-title">Variación de la muestra (CV)</div>
              <div className="dss-metric-trend">
                {coeficienteVariacion === null ? 'Se requieren más datos válidos' : 'Dispersión descriptiva entre ejecuciones'}
              </div>
            </div>

          </div>

          {/* Right: Risk Badge */}
          {(() => {
            const riskText = riesgoTexto.toLowerCase();
            const riskColor = riesgoAgronomico.color || '';
            let levelClass = riesgoTexto ? 'level-neutral' : 'level-empty';
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
                  nombre: "Riesgo Agronómico Compuesto",
                  cultivo: "maiz",
                  valor: riesgoTexto || null,
                  unidad: "",
                  estado: levelClass === 'level-empty' ? 'sin_datos' : (levelClass === 'level-danger' ? 'riesgoso' : (levelClass === 'level-warning' ? 'regular' : 'favorable')),
                  rango_ideal: "Bajo",
                  descripcion_tecnica: "Calificación combinada del riesgo de pérdida del cultivo debido a factores biológicos y abióticos del lote simulado en la ventana seleccionada."
                })}
                style={{ cursor: 'pointer' }}
                title="Clic para ver detalle del riesgo"
              >
                <div className={`dss-risk-icon-wrap ${levelClass}`}>
                  {levelClass === 'level-success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div className="dss-risk-text-info">
                  <span className="dss-risk-label">Riesgo Agronómico</span>
                  <span className="dss-risk-value">{riesgoTexto || 'Sin datos'}</span>
                  <span className="dss-risk-sub">{riesgoTexto ? `Riesgo agrario · ${riesgoTexto}` : 'Se requiere una evaluación del escenario'}</span>
                </div>
              </div>
            );
          })()}

        </div>

        {/* Bottom timeline track (12 months) */}
        <div 
          className="dss-timeline-section"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "tarjeta",
            nombre: "Meses de siembra según catálogo local",
            cultivo: "maiz",
            valor: kpis.fecha_siembra_recomendada,
            unidad: "",
            estado: calendarEvents.length ? "referencia_catalogo" : "sin_datos",
            descripcion_tecnica: "Meses indicados por el catálogo agronómico local para la provincia identificada. No son fechas óptimas calculadas por el modelo ni una evaluación del clima futuro."
          })}
          style={{ cursor: 'pointer' }}
          title="Clic para ver detalles de la recomendación"
        >
          <div className="dss-timeline-title">Referencia de siembra del catálogo — Vista anual</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{recommendedWindowLabel}</span>
            <div style={{ flex: '1 1 260px', minWidth: '140px', height: '8px', background: 'var(--border-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${recommendedProgress}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #84cc16)', borderRadius: '999px' }} />
            </div>
          </div>
          <div className="dss-timeline-track">
            {monthLabels.map(month => {
              const isRec = recommendedMonths.has(month.key);
              return (
                <div 
                  key={month.key} 
                  className={`dss-timeline-item ${isRec ? 'recommended' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    pedirExplicacionIa({
                      tipo_elemento: "tarjeta",
                      nombre: `Mes de ${month.name} (${isRec ? 'Con referencia de catálogo' : 'Sin referencia disponible'})`,
                      cultivo: "maiz",
                      valor: isRec ? "Mes indicado en catálogo" : null,
                      unidad: "",
                      estado: isRec ? "referencia_catalogo" : "sin_datos",
                      descripcion_tecnica: isRec 
                        ? `El mes de ${month.name} aparece en la referencia del catálogo para la provincia de la parcela. Esta referencia no acredita condiciones hídricas futuras.`
                        : `No hay una ventana de catálogo identificada para ${month.name}. La ausencia de referencia no significa que el mes sea inadecuado ni acredita un riesgo climático.`
                    });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="dss-timeline-item-name">{month.name}</span>
                  <span className="dss-timeline-item-sub">{isRec ? 'Catálogo' : 'Sin evaluar'}</span>
                  <div className="dss-timeline-dot" />
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <DashboardSectionHeading label="02 · Comparación" title="Ejecuciones, variedades y resultados" description="Se comparan únicamente resultados guardados. Las celdas ausentes no representan rendimiento cero." />
      {/* Primary Grid: Comparador de Fechas (Arriba Izq) + Distribución Probabilística (Arriba Der) */}
      <div className="scenario-comparison-grid">
        {/* Comparador de Fechas e Híbridos */}
        <div 
          className="glass-panel chart-panel-interactive"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Comparación de simulaciones guardadas y variedades",
            cultivo: "maiz",
            valor: "Rendimientos guardados por ejecución y variedad",
            unidad: "t/ha",
            estado: "matriz de decisiones",
            descripcion_tecnica: "Cada fila identifica una simulación guardada y su fecha de ejecución, no una fecha de siembra. La comparación es descriptiva y no prueba un efecto causal de la variedad o del manejo.",
            datos_grafico: heatmap.rows
          })}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.4rem' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, margin: 0 }}>Simulaciones guardadas por variedad (t/ha)</h3>
          </div>
          <div className="glass-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0.5rem 0.85rem 0.85rem 0.85rem' }}>
            <div className="table-responsive-container" style={{ overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {heatmap.rows.length === 0 && <p className="chart-empty-state" role="status">No hay resultados guardados disponibles para esta comparación.</p>}
              {heatmap.rows.length > 0 && (
              <table style={{ width: '100%', height: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '6px 8px', textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ width: '115px', padding: '0.4rem 0.25rem', color: 'var(--text-subtle)', fontSize: '0.72rem', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Ejecución
                    </th>
                    {heatmap.varieties.map((hibrido) => (
                      <th key={hibrido} style={{ padding: '0.4rem 0.2rem', color: 'var(--text-primary)', fontSize: '0.74rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hibrido}>
                        {hibrido}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ height: '100%' }}>
                  {heatmap.dates.map((fecha) => {
                    const rowItems = heatmap.rows.filter(h => h.fecha === fecha);
                    const listHibridos = heatmap.varieties;
                    return (
                      <tr key={fecha}>
                        <td style={{ padding: '0.4rem 0.25rem', fontWeight: 700, textAlign: 'left', color: 'var(--text-primary)', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }} title={fecha}>
                          {fecha}
                        </td>
                        {listHibridos.map((hibrido) => {
                          const item = rowItems.find(r => r.hibrido === hibrido);
                          const val = item ? item.valor : null;
                          const hStyle = getHeatmapStyle(val);
                          return (
                            <td 
                              key={hibrido} 
                              style={{ 
                                height: '62px',
                                padding: '0', 
                                background: hStyle.bg, 
                                color: hStyle.text,
                                border: `1.5px solid ${hStyle.border}`,
                                borderRadius: '10px',
                                fontWeight: 800,
                                fontSize: '1rem',
                                boxShadow: '0 3px 10px rgba(0, 0, 0, 0.03)',
                                transition: 'all 0.2s ease',
                                cursor: 'default',
                                verticalAlign: 'middle'
                              }}
                              title={val === null ? `${hibrido} en ${fecha}: sin simulación guardada` : `${hibrido} en ${fecha}: ${val.toFixed(2)} t/ha`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', height: '100%', width: '100%' }}>
                                <span style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1 }}>{val === null ? '—' : val.toFixed(1)}</span>
                                {val !== null && <span style={{ fontSize: '0.64rem', fontWeight: 600, opacity: 0.85, lineHeight: 1 }}>t/ha</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem', fontSize: '0.72rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--surface-elevated)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '3px' }}></div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>&lt; 4.5 t/ha</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--surface-elevated)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '3px' }}></div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>4.5 – 6.0 t/ha</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--surface-elevated)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: '10px', height: '10px', background: '#22c55e', borderRadius: '3px' }}></div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>≥ 6.0 t/ha</span>
              </div>
            </div>
          </div>
        </div>

        {/* Percentiles descriptivos de la muestra guardada. */}
        <div 
          className="glass-panel chart-panel-interactive"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Percentiles descriptivos de simulaciones guardadas",
            cultivo: "maiz",
            valor: "Percentiles de rendimiento",
            unidad: "t/ha",
            estado: "descriptivo",
            descripcion_tecnica: `P10, mediana y P90 de ${muestra ?? 'las'} ejecuciones guardadas. Resumen de esta muestra de predicciones; no es una distribución normal validada, una garantía de rendimiento ni una probabilidad futura.`,
            datos_grafico: percentiles
          })}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.4rem' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, margin: 0 }}>Percentiles de la muestra guardada</h3>
          </div>
          <div className="glass-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <GaussChart p10={percentiles?.p10} p50={percentiles?.p50} p90={percentiles?.p90} muestra={percentiles?.muestra} />
          </div>
        </div>
      </div>

      {/* Secondary Grid: Calendario (Abajo Izq) + Top 5 Combinaciones (Abajo Der) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
        {/* Calendar */}
        <CalendarGrid 
          type="siembra"
          events={calendarEvents} 
          initialDate={initialCalendarDate} 
          title="Referencia de siembra del catálogo local"
        />

        {/* Top Recommendations */}
        <div 
          className="glass-panel chart-panel-interactive" 
          style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '380px' }}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.4rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Hasta 5 resultados guardados de mayor rendimiento</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Haz clic en cada opción para ver su explicación</span>
          </div>
          <div className="glass-card-body" style={{ padding: '0.75rem 1.1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto' }}>
            {ranking.length === 0 && <p role="status" className="chart-empty-state">No hay simulaciones guardadas para ordenar.</p>}
            {ranking.map((row, i) => {
              const isExpanded = expandedIndex === i;

              const badgeClass = i === 0 ? 'bg-success-alpha text-success' : (i === 1 ? 'bg-secondary-alpha text-secondary' : (i === 2 ? 'bg-warning-alpha text-warning' : 'bg-primary-alpha text-primary'));
              const porqueText = typeof row.porque === 'string' && row.porque.trim()
                ? row.porque
                : 'Este resultado figura en el orden de rendimientos guardados. No hay una explicación causal registrada para esta ejecución.';

              const handleItemClick = (e) => {
                e.stopPropagation();
                setExpandedIndex(isExpanded ? null : i);
              };

              const handleIaClick = (e) => {
                e.stopPropagation();
                pedirExplicacionIa({
                  tipo_elemento: "tarjeta",
                  nombre: `Estrategia #${i+1}: ${row.estrategia}`,
                  cultivo: "maiz",
                  valor: `${row.valor} ${row.unidad}`,
                  unidad: row.unidad,
                  estado: row.badge,
                  descripcion_tecnica: `Resultado guardado: ${row.combinacion ?? 'detalle de combinación no conservado'}. ${porqueText}`
                });
              };

              return (
                <div 
                  key={i} 
                  onClick={handleItemClick}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.35rem', 
                    padding: '0.7rem 0.9rem', 
                    borderRadius: '10px', 
                    background: isExpanded ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-elevated)', 
                    border: isExpanded ? '1.5px solid var(--accent-primary, #3b82f6)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-subtle)', background: 'var(--surface-hover)', padding: '0.12rem 0.4rem', borderRadius: '5px' }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                        {row.estrategia}
                      </span>
                      <span className={`badge ${badgeClass}`} style={{ fontSize: '0.64rem', padding: '0.12rem 0.45rem' }}>
                        {row.badge}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#ffffff' }}>
                        {row.valor} <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>{row.unidad}</span>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: isExpanded ? 'var(--accent-primary, #60a5fa)' : 'var(--text-subtle)', fontWeight: 700 }}>
                        {isExpanded ? '▲ Ocultar' : '▼ Ver explicación'}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--secondary, #60a5fa)' }}>
                    <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>Combinación:</span> {row.combinacion}
                  </div>

                  {/* Explicación por separado únicamente al dar clic */}
                  {isExpanded && (
                    <div style={{ marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.45rem', animation: 'fadeIn 0.2s ease' }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.45', background: 'rgba(255, 255, 255, 0.03)', padding: '0.5rem 0.65rem', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.15rem' }}>CONTEXTO DEL RESULTADO GUARDADO</strong>
                        {porqueText}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>
                          Orden descriptivo; no acredita una recomendación agronómica
                        </span>
                        <button
                          type="button"
                          onClick={handleIaClick}
                          style={{
                            padding: '0.28rem 0.65rem',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid var(--accent-primary, #3b82f6)',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: 'var(--accent-primary, #60a5fa)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Análisis Detallado
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recomendaciones Agronómicas (Formato Ancho Completo 100% Elegante) */}
      {recomendaciones && recomendaciones.length > 0 && (
        <div className="glass-panel" style={{ width: '100%', marginBottom: '1.5rem', boxSizing: 'border-box' }}>
          <div className="glass-card-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Alcance y referencias del resumen</h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Procedencia y límites de los datos</span>
          </div>
          <div className="glass-card-body" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {recomendaciones.map((rec, i) => {
              const borderCol = rec.tipo === 'danger' ? '#ef4444' : (rec.tipo === 'warning' ? '#eab308' : '#16a34a');
              const bgCol = rec.tipo === 'danger' ? 'rgba(239, 68, 68, 0.05)' : (rec.tipo === 'warning' ? 'rgba(234, 179, 8, 0.05)' : 'rgba(22, 163, 74, 0.05)');
              
              const cleanTitle = String(rec.titulo || '')
                .replace(/【[^】]*】/g, '')
                .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
                .trim();

              const cleanText = String(rec.texto || '')
                .replace(/【[^】]*】/g, '')
                .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
                .trim();

              return (
                <div 
                  key={i} 
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.9rem 1.25rem', 
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `5px solid ${borderCol}`,
                    background: 'var(--surface-elevated)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                    gap: '1.25rem',
                    flexWrap: 'nowrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      color: borderCol,
                      background: bgCol,
                      padding: '0.55rem',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {getIcon(rec.icono)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        {cleanTitle}
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: 0 }}>
                        {cleanText}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn" 
                      onClick={() => onNavigate?.('history')}
                      disabled={!onNavigate}
                      style={{ 
                        padding: '0.45rem 1.1rem', 
                        fontSize: '0.74rem', 
                        fontWeight: 700,
                        borderRadius: '8px',
                        background: rec.tipo === 'danger' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : (rec.tipo === 'warning' ? 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'),
                        color: rec.tipo === 'warning' ? '#0f172a' : '#ffffff',
                        border: 'none',
                        cursor: onNavigate ? 'pointer' : 'default',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 3px 10px rgba(0,0,0,0.15)'
                      }}
                    >
                      Ver simulaciones
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SimulationInfoCard
        isOpen={mostrarModalIa}
        onClose={() => setMostrarModalIa(false)}
        loading={cargandoIa}
        data={datosIa}
      />
    </div>
  );
}
