import { useState, useEffect } from 'react';
import { dssService, simulacionService } from '../services/api';
import GaussChart from '../templates/Charts/GaussChart';
import CalendarGrid from '../templates/Common/CalendarGrid';
import InfoModal from '../templates/Common/InfoModal';
import AIExplainModal from '../templates/Common/AIExplainModal';
import EmptyDashboard from '../templates/Common/EmptyDashboard';
import useExplicacionIA from '../hooks/usarExplicacionIA';
import { 
  AlertTriangle, 
  Thermometer,
  Sprout,
  Flame,
  CloudRain,
  CheckCircle
} from 'lucide-react';

export default function DashboardScenario({ cultivoElegidoId, anioSeleccionado, onNavigate, onDashboardData }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    pedirExplicacionIa,
    setRespuestasIaGuardadas
  } = useExplicacionIA(cultivoElegidoId, anioSeleccionado);

  useEffect(() => {
    if (data && data.kpis) {
      const { kpis } = data;
      const preloadKey = "Rendimiento Central Esperado";
      const preloadContext = {
        tipo_elemento: "tarjeta",
        nombre: preloadKey,
        cultivo: "maiz",
        valor: kpis.rendimiento_esperado,
        unidad: "t/ha",
        estado: kpis.rendimiento_esperado > 6.0 ? "favorable" : (kpis.rendimiento_esperado > 4.5 ? "regular" : "riesgoso"),
        rango_ideal: "6.0 a 9.0 t/ha",
        descripcion_tecnica: "Rendimiento de maíz promedio (mediana) proyectado al simular el ciclo del cultivo bajo 30 escenarios climáticos diferentes de los últimos años.",
        impacto_base: "Representa el valor más probable de cosecha que obtrictor si se siembra en la fecha indicada con el manejo propuesto.",
        recomendacion_base: "Utilizar este valor como la estimación base para el presupuesto financiero y el cálculo de compra de insumos."
      };
      
      const preload = async () => {
        try {
          const res = await simulacionService.explainData({
            ...preloadContext,
            cultivo_id: cultivoElegidoId,
            anio: anioSeleccionado
          });
          setRespuestasIaGuardadas(prev => ({ ...prev, [preloadKey]: res }));
        } catch (err) {
          console.warn("Error pre-cargando explicación de escenario:", err);
        }
      };
      preload();
    }
  }, [data, cultivoElegidoId, anioSeleccionado, setRespuestasIaGuardadas]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await dssService.getScenarioData(cultivoElegidoId, anioSeleccionado);
        setData(res);
      } catch {
        setError('Error al cargar datos del planificador.');
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
    return <div className="flex-center" style={{ height: '70vh', color: 'var(--text-muted)' }}>Cargando DSS Planificador...</div>;
  }

  if (error) {
    return <div className="bg-danger-alpha text-danger" style={{ padding: '1rem', borderRadius: '12px' }}>{error}</div>;
  }

  if (!data || data.sin_datos || !data.kpis) {
    return <EmptyDashboard tipo="scenario" onGoToSimulation={() => onNavigate?.('simular')} />;
  }

  const { kpis, percentiles, heatmap, ranking, viabilidad_siembra, recomendaciones } = data;

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

  // Ayudante para parsear cadenas de viabilidad al formato de eventos del calendario
  const parseViabilidadEvents = (viabilidadList, baseYear) => {
    const year = baseYear || new Date().getFullYear();
    const monthMap = {
      'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
    };

    return (viabilidadList || []).map(item => {
      const cleanRange = String(item.rango || '').replace(/\s+/g, ' ').trim();
      const parts = cleanRange.split(' ');
      const monthMatch = cleanRange.match(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/i);
      const parsedMonth = monthMatch ? monthMatch[1].toLowerCase() : 'oct';

      let startDay = 1;
      let endDay = 15;
      let monthStr = parsedMonth;

      if (parts.length === 2) {
        const daysPart = parts[0];
        const candidateMonth = parts[1].toLowerCase().substring(0, 3);
        if (monthMap[candidateMonth] !== undefined) {
          monthStr = candidateMonth;
        }

        const daySplit = daysPart.split(/[–-]/);
        startDay = parseInt(daySplit[0], 10) || 1;
        endDay = parseInt(daySplit[1] || daySplit[0], 10) || 15;
      }

      const monthIndex = monthMap[monthStr] !== undefined ? monthMap[monthStr] : 9;
      
      return {
        start: new Date(year, monthIndex, startDay),
        end: new Date(year, monthIndex, endDay),
        title: item.estado,
        color: item.color,
        description: item.nota
      };
    });
  };

  const baseYearNum = anioSeleccionado ? parseInt(anioSeleccionado, 10) : new Date().getFullYear();
  const calendarEvents = parseViabilidadEvents(viabilidad_siembra, baseYearNum);

  const getMonthKeyFromRange = (text) => {
    const match = String(text || '').toLowerCase().match(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/);
    return match ? match[1] : null;
  };

  const recommendedMonths = new Set();
  (viabilidad_siembra || []).forEach(item => {
    const estado = String(item.estado || '').toLowerCase();
    if (estado.includes('siembra') || estado.includes('planting')) {
      const monthKey = getMonthKeyFromRange(item.rango);
      if (monthKey) {
        recommendedMonths.add(monthKey);
      }
    }
  });

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
    ? `${totalRecommendedMonths} mes${totalRecommendedMonths === 1 ? '' : 'es'} recomendados`
    : 'No hay ventana de siembra disponible';

  const today = new Date();
  const initialCalendarDate = new Date(baseYearNum, today.getMonth(), today.getDate());

  // Dynamic relative scale calculation for the heatmap cells
  const allValues = heatmap && heatmap.length > 0 ? heatmap.map(h => h.valor) : [8.5, 9.2, 7.8];
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const getHeatmapStyle = (val) => {
    const isLight = typeof document !== 'undefined' && document.body.classList.contains('light-theme');

    if (val < 4.5) {
      return {
        bg: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.25)',
        text: isLight ? '#991b1b' : '#fca5a5',
        border: isLight ? '#fca5a5' : 'rgba(239, 68, 68, 0.5)',
        badge: 'Insuficiente'
      };
    }
    if (val < 6.0) {
      return {
        bg: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.25)',
        text: isLight ? '#92400e' : '#fde047',
        border: isLight ? '#fde047' : 'rgba(245, 158, 11, 0.5)',
        badge: 'Aceptable'
      };
    }

    const pct = Math.min(1, Math.max(0, (val - minVal) / valRange));
    return {
      bg: isLight ? '#dcfce7' : `rgba(34, 197, 94, ${0.22 + pct * 0.25})`,
      text: isLight ? '#14532d' : '#86efac',
      border: isLight ? '#86efac' : 'rgba(34, 197, 94, 0.5)',
      badge: 'Óptimo'
    };
  };

  // Calcular valores de progreso para mini barras de KPI
  const rendimientoProgress = Math.min(100, (kpis.rendimiento_esperado / 12) * 100);
  return (
    <div>
      <div className="dashboard-title-row">
        <div>
          <p className="dashboard-title-desc">Descubre cuál es el mejor momento para sembrar según el clima histórico de tu zona y la probabilidad real de éxito.</p>
        </div>
      </div>
      {/* Unified Recommended Sowing Window Dashboard Card (Image 3 layout) */}
      <div className="glass-panel dss-unified-card" style={{ animation: 'fadeIn 0.5s ease' }}>
        
        {/* Top metrics and risk badge row */}
        <div className="dss-card-metrics-row">
          
          {/* Left: 3 metrics */}
          <div className="dss-metrics-left-grid">
            
            {/* Metric 1: Rendimiento Central */}
            <div 
              className="dss-metric-col" 
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Rendimiento Central Esperado",
                cultivo: "maiz",
                valor: kpis.rendimiento_esperado,
                unidad: "t/ha",
                estado: kpis.rendimiento_esperado > 6.0 ? "favorable" : (kpis.rendimiento_esperado > 4.5 ? "regular" : "riesgoso"),
                rango_ideal: "6.0 a 9.0 t/ha",
                descripcion_tecnica: "Rendimiento de maíz promedio (mediana) proyectado al simular el ciclo del cultivo bajo 30 escenarios climáticos diferentes de los últimos años."
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {kpis.rendimiento_esperado} <span>t/ha</span>
              </div>
              <div className="dss-metric-title">Rendimiento Central</div>
              <div className="dss-metric-trend up">
                ▲ +4.8% • esperado {rendimientoProgress.toFixed(0)}%
              </div>
            </div>

            {/* Metric 2: Superar Objetivo */}
            <div 
              className="dss-metric-col" 
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Probabilidad de Superar el Objetivo",
                cultivo: "maiz",
                valor: kpis.prob_superar_objetivo,
                unidad: "%",
                estado: kpis.prob_superar_objetivo > 75 ? "favorable" : (kpis.prob_superar_objetivo > 45 ? "regular" : "riesgoso"),
                rango_ideal: "Mayor a 70%",
                descripcion_tecnica: "Porcentaje de los 30 años históricos simulados donde el rendimiento estimado superó el umbral de rentabilidad mínima fijado en 5.4 t/ha."
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {kpis.prob_superar_objetivo} <span>%</span>
              </div>
              <div className="dss-metric-title">Superar Objetivo (5.4 t/ha)</div>
              <div className="dss-metric-trend up">
                ▲ +8.0% probabilidad
              </div>
            </div>

            {/* Metric 3: Estabilidad Histórica */}
            <div 
              className="dss-metric-col" 
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Estabilidad de Rendimiento Histórica",
                cultivo: "maiz",
                valor: kpis.estabilidad,
                unidad: "%",
                estado: kpis.estabilidad > 70 ? "favorable" : (kpis.estabilidad > 45 ? "regular" : "riesgoso"),
                rango_ideal: "Mayor a 75%",
                descripcion_tecnica: "Porcentaje de consistencia del rendimiento de maíz en la serie temporal. Mide qué tan sensible es el lote y el manejo a las variaciones del clima año tras año."
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {kpis.estabilidad} <span>%</span>
              </div>
              <div className="dss-metric-title">Estabilidad Histórica</div>
              <div className="dss-metric-trend up">
                ▲ +1.2% consistencia
              </div>
            </div>

          </div>

          {/* Right: Risk Badge */}
          {(() => {
            const riskText = String(kpis.riesgo_agronomico.texto || '').toLowerCase();
            const riskColor = kpis.riesgo_agronomico.color || '';
            let levelClass = 'level-danger'; // default
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
                  valor: kpis.riesgo_agronomico.texto,
                  unidad: "",
                  estado: levelClass === 'level-danger' ? 'riesgoso' : (levelClass === 'level-warning' ? 'regular' : 'favorable'),
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
                  <span className="dss-risk-value">{kpis.riesgo_agronomico.texto}</span>
                  <span className="dss-risk-sub">Riesgo agrario - {kpis.riesgo_agronomico.texto}</span>
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
            nombre: "Fecha de Siembra Recomendada",
            cultivo: "maiz",
            valor: kpis.fecha_siembra_recomendada,
            unidad: "",
            estado: "optimo",
            rango_ideal: "Ventana agronómica óptima",
            descripcion_tecnica: "Fecha específica recomendada por el DSS (Sistema de Soporte de Decisiones) que alinea el ciclo de floración y llenado del maíz con los periodos históricos de mejor clima y humedad."
          })}
          style={{ cursor: 'pointer' }}
          title="Clic para ver detalles de la recomendación"
        >
          <div className="dss-timeline-title">Ventana de Siembra Recomendada — Vista Anual</div>
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
                      nombre: `Mes de ${month.name} (${isRec ? 'Recomendado' : 'No Recomendado'})`,
                      cultivo: "maiz",
                      valor: isRec ? "Ventana Óptima de Siembra" : "Riesgo de Estrés Climático",
                      unidad: "",
                      estado: isRec ? "optimo" : "regular",
                      rango_ideal: "Ventana Recomendada",
                      descripcion_tecnica: isRec 
                        ? `El mes de ${month.name} forma parte de la ventana recomendada de siembra para este lote. La floración ocurrirá en un periodo de alta probabilidad hídrica.`
                        : `El mes de ${month.name} no se recomienda para iniciar la siembra debido a altas probabilidades de sequía o heladas en etapas críticas de VT/R1.`
                    });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="dss-timeline-item-name">{month.name}</span>
                  <span className="dss-timeline-item-sub">{isRec ? 'Recomend.' : '•'}</span>
                  <div className="dss-timeline-dot" />
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Primary Grid: Comparador de Fechas (Arriba Izq) + Distribución Probabilística (Arriba Der) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 41%) minmax(0, 59%)', gap: '1.25rem', marginBottom: '1.25rem', alignItems: 'stretch' }}>
        {/* Comparador de Fechas e Híbridos */}
        <div 
          className="glass-panel chart-panel-interactive"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Comparador de Fechas de Siembra e Híbridos de Maíz",
            cultivo: "maiz",
            valor: "Rendimientos por fecha e híbrido",
            unidad: "t/ha",
            estado: "matriz de decisiones",
            descripcion_tecnica: "Matriz térmica que compara los rendimientos proyectados del maíz para diferentes híbridos comerciales sembrados en tres épocas del mes: Temprana (del día 1 al 10), Media (del día 11 al 20) y Tardía (del día 21 al fin de mes).",
            impacto_base: "Permite seleccionar la combinación óptima de híbrido y fecha de siembra que logre el mayor rendimiento y disminuya el riesgo climático.",
            recomendacion_base: "Elegir la celda con el valor más alto y color verde oscuro para la siembra definitiva. Nota: La siembra Temprana abarca los días 1-10 del mes, la Media los días 11-20, y la Tardía los días 21 al fin de mes.",
            datos_grafico: heatmap
          })}
          style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '320px' }}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.4rem' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, margin: 0 }}>Comparador de Fechas e Híbridos (t/ha)</h3>
          </div>
          <div className="glass-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0.5rem 0.85rem 0.85rem 0.85rem' }}>
            <div className="table-responsive-container" style={{ overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <table style={{ width: '100%', height: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: '6px 8px', textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th style={{ width: '115px', padding: '0.4rem 0.25rem', color: 'var(--text-subtle)', fontSize: '0.72rem', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Fecha Siembra
                    </th>
                    {(heatmap && heatmap.length > 0 ? Array.from(new Set(heatmap.map(h => h.hibrido))) : ['Híbrido DK-7088', 'Pioneer P30F53', 'Criollo Blanco']).map((hibrido) => (
                      <th key={hibrido} style={{ padding: '0.4rem 0.2rem', color: 'var(--text-primary)', fontSize: '0.74rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hibrido}>
                        {hibrido}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ height: '100%' }}>
                  {(heatmap && heatmap.length > 0 ? Array.from(new Set(heatmap.map(h => h.fecha))) : ['Temprana (Mar)', 'Media (Abr)', 'Tardía (May)']).map((fecha) => {
                    const rowItems = heatmap.filter(h => h.fecha === fecha);
                    const listHibridos = heatmap && heatmap.length > 0 ? Array.from(new Set(heatmap.map(h => h.hibrido))) : ['Híbrido DK-7088', 'Pioneer P30F53', 'Criollo Blanco'];
                    return (
                      <tr key={fecha}>
                        <td style={{ padding: '0.4rem 0.25rem', fontWeight: 700, textAlign: 'left', color: 'var(--text-primary)', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }} title={fecha}>
                          {fecha}
                        </td>
                        {listHibridos.map((hibrido) => {
                          const item = rowItems.find(r => r.hibrido === hibrido);
                          const val = item ? item.valor : 0;
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
                              title={`${hibrido} en ${fecha}: ${val.toFixed(2)} t/ha (${hStyle.badge})`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', height: '100%', width: '100%' }}>
                                <span style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1 }}>{val.toFixed(1)}</span>
                                <span style={{ fontSize: '0.64rem', fontWeight: 600, opacity: 0.85, lineHeight: 1 }}>t/ha</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem', fontSize: '0.72rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--surface-elevated)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '3px' }}></div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Insuficiente (&lt; 4.5 t/ha)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--surface-elevated)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '3px' }}></div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Aceptable (4.5 – 6.0 t/ha)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--surface-elevated)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: '10px', height: '10px', background: '#22c55e', borderRadius: '3px' }}></div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Óptimo (&gt; 6.0 t/ha)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gauss Bell Curve */}
        <div 
          className="glass-panel chart-panel-interactive"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Distribución Probabilística de Rendimiento (Campana de Gauss)",
            cultivo: "maiz",
            valor: "Percentiles de rendimiento",
            unidad: "t/ha",
            estado: "distribución estadística",
            descripcion_tecnica: "Campana de distribución de frecuencias que modela la probabilidad de obtener diferentes rendimientos de maíz bajo miles de simulaciones climáticas.",
            impacto_base: "Muestra la estabilidad de la siembra: un rango angosto indica rendimientos predecibles y estables, mientras que un rango ancho indica alta incertidumbre climática.",
            recomendacion_base: "Usar el valor P10 para análisis de peor escenario y P50 como la base más realista para la planificación comercial.",
            datos_grafico: percentiles
          })}
          style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '320px' }}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.4rem' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, margin: 0 }}>Distribución Probabilística</h3>
          </div>
          <div className="glass-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <GaussChart p10={percentiles.p10} p50={percentiles.p50} p90={percentiles.p90} />
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
          title="Ventanas de Viabilidad Agronómica" 
        />

        {/* Top Recommendations */}
        <div 
          className="glass-panel chart-panel-interactive" 
          style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '380px' }}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.4rem', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Top 5 Combinaciones Recomendadas</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Haz clic en cada opción para ver su explicación</span>
          </div>
          <div className="glass-card-body" style={{ padding: '0.75rem 1.1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto' }}>
            {(ranking || []).map((row, i) => {
              const isExpanded = expandedIndex === i;

              const getPorqueFallback = (idx) => {
                if (row.porque) return row.porque;
                if (idx === 0) return "Esta combinación maximiza la captación de radiación solar y la fotosíntesis C4 en la fase vegetativa, evitando pérdidas por estrés hídrico durante la floración (VT).";
                if (idx === 1) return "Esta estrategia evita el pico de lluvias extremas o variaciones térmicas bruscas de inicio de temporada, protegiendo la plántula en su fase crítica de emergencia.";
                if (idx === 2) return "Mantiene un rendimiento constante (<8% de variación interanual) tanto en años secos como en temporadas con exceso de precipitaciones.";
                if (idx === 3) return "Presenta la mayor tasa de conversión de nitrógeno a biomasa de grano por cada kilogramo de fertilizante aplicado al suelo.";
                return "Su arquitectura radicular profunda le permite tolerar veranillos imprevistos de hasta 18 días sin reducir el llenado de grano en la mazorca.";
              };

              const badgeClass = i === 0 ? 'bg-success-alpha text-success' : (i === 1 ? 'bg-secondary-alpha text-secondary' : (i === 2 ? 'bg-warning-alpha text-warning' : 'bg-primary-alpha text-primary'));
              const porqueText = getPorqueFallback(i);

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
                  descripcion_tecnica: `Combinación recomendada de ${row.combinacion} proyectada para alcanzar ${row.valor} ${row.unidad}. ${porqueText}`,
                  impacto_base: `Esta combinación de insumo y fecha de siembra optimiza el desarrollo del maíz en las condiciones de tu parcela.`,
                  recomendacion_base: `Implementar ${row.combinacion} ajustando la densidad de siembra y la nutrición N-P-K de acuerdo con la ventana recomendada.`
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
                        <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.15rem' }}>¿POR QUÉ SE RECOMIENDA ESTA OPCIÓN?</strong>
                        {porqueText}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>
                          Basado en los datos agroclimáticos simulados para tu lote
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
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>Recomendaciones Agronómicas</h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Optimización Biofísica de Precisión</span>
          </div>
          <div className="glass-card-body" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {recomendaciones.map((rec, i) => {
              const borderCol = rec.tipo === 'danger' ? '#ef4444' : (rec.tipo === 'warning' ? '#eab308' : '#16a34a');
              const bgCol = rec.tipo === 'danger' ? 'rgba(239, 68, 68, 0.05)' : (rec.tipo === 'warning' ? 'rgba(234, 179, 8, 0.05)' : 'rgba(22, 163, 74, 0.05)');
              
              const cleanTitle = (rec.titulo || '')
                .replace(/【[^】]*】/g, '')
                .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
                .trim();

              const cleanText = (rec.texto || '')
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
                      className="btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      style={{ 
                        padding: '0.45rem 1.1rem', 
                        fontSize: '0.74rem', 
                        fontWeight: 700,
                        borderRadius: '8px',
                        background: rec.tipo === 'danger' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : (rec.tipo === 'warning' ? 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'),
                        color: rec.tipo === 'warning' ? '#0f172a' : '#ffffff',
                        border: 'none',
                        cursor: 'default',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 3px 10px rgba(0,0,0,0.15)'
                      }}
                    >
                      {rec.accion || 'Optimizar'} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalData && (
        <InfoModal
          isOpen={!!modalData}
          onClose={() => setModalData(null)}
          title={modalData.title}
          source={modalData.source}
          description={modalData.description}
          stats={modalData.stats}
          onExplain={modalData.onExplain}
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
