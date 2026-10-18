import { useState, useEffect } from 'react';
import { dssService, simulacionService } from '../services/api';
import ClimateLine from '../templates/Charts/ClimateLine';
import CalendarGrid from '../templates/Common/CalendarGrid';
import InfoModal from '../templates/Common/InfoModal';
import AIExplainModal from '../templates/Common/AIExplainModal';
import EmptyDashboard from '../templates/Common/EmptyDashboard';
import useExplicacionIA from '../hooks/usarExplicacionIA';
import { 
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

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
    pedirExplicacionIa,
    setRespuestasIaGuardadas
  } = useExplicacionIA(cultivoElegidoId, anioSeleccionado);

  useEffect(() => {
    if (data && data.kpis && data.kpis.indice_riesgo) {
      const { kpis } = data;
      const preloadKey = "Índice de Riesgo Estacional Compuesto";
      const preloadContext = {
        tipo_elemento: "tarjeta",
        nombre: preloadKey,
        cultivo: "maiz",
        valor: kpis.indice_riesgo?.nivel || "Bajo",
        unidad: "",
        estado: kpis.indice_riesgo?.color === 'danger' ? 'riesgoso' : (kpis.indice_riesgo?.color === 'warning' ? 'regular' : 'favorable'),
        rango_ideal: "Bajo",
        descripcion_tecnica: "Índice de riesgo total calculado ponderando de forma conjunta la falta de agua, los picos de calor y la probabilidad de heladas/inundaciones estacionales.",
        impacto_base: "Un nivel 'Riesgoso' indica que hay múltiples amenazas climáticas sincronizadas que podrían diezmar la cosecha si no se toman medidas activas.",
        recomendacion_base: "Implementar un plan de contingencia híbrido que combine seguros agrícolas, monitoreo digital de suelo y sistemas de riego flexibles."
      };
      
      const preload = async () => {
        try {
          const res = await simulacionService.explainData({
            ...preloadContext,
            cultivo_id: cultivoElegidoId
          });
          setRespuestasIaGuardadas(prev => ({ ...prev, [preloadKey]: res }));
        } catch (err) {
          console.warn("Error pre-cargando explicación climática:", err);
        }
      };
      preload();
    }
  }, [data, cultivoElegidoId, setRespuestasIaGuardadas]);

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
    <div>
      <div className="dashboard-title-row">
        <div>
          <p className="dashboard-title-desc">Sigue de cerca el crecimiento de tus plantas y mantente alerta ante heladas, sequías u otros riesgos del clima.</p>
        </div>
      </div>

      {/* Unified Phenology & Climate Risk Dashboard Card */}
      <div className="glass-panel dss-unified-card" style={{ animation: 'fadeIn 0.5s ease' }}>
        
        {/* Top metrics and risk badge row */}
        <div className="dss-card-metrics-row">
          
          {/* Left: 3 metrics */}
          <div className="dss-metrics-left-grid">
            
            {/* Metric 1: Estado ENSO */}
            <div 
              className="dss-metric-col" 
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Estado ENSO (El Niño / Oscilación del Sur)",
                cultivo: "maiz",
                valor: kpis?.enso?.estado || "Neutral",
                unidad: "",
                estado: kpis?.enso?.color === 'danger' ? 'riesgoso' : (kpis?.enso?.color === 'warning' ? 'regular' : 'favorable'),
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
                {kpis?.enso?.estado || "Neutral"}
              </div>
              <div className="dss-metric-title">Estado ENSO</div>
              <div className="dss-metric-trend" style={{ color: 'var(--text-muted)' }}>
                Fase Climática Actual
              </div>
            </div>

            {/* Metric 2: Prob. Lluvia Mínima */}
            <div 
              className="dss-metric-col" 
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Probabilidad de Lluvia por debajo del Promedio",
                cultivo: "maiz",
                valor: kpis?.prob_lluvia_bajo_promedio || 0,
                unidad: "%",
                estado: (kpis?.prob_lluvia_bajo_promedio || 0) > 60 ? "riesgoso" : ((kpis?.prob_lluvia_bajo_promedio || 0) > 30 ? "regular" : "favorable"),
                rango_ideal: "Baja probabilidad (menor a 35%)",
                descripcion_tecnica: "Estima la probabilidad acumulada de que las precipitaciones pluviales durante la campaña agrícola sean significativamente inferiores a la media climatológica del sector."
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {kpis?.prob_lluvia_bajo_promedio || 0} <span>%</span>
              </div>
              <div className="dss-metric-title">Prob. Lluvia Mínima</div>
              <div className="dss-metric-trend up">
                ▲ +2.3% en ciclo
              </div>
            </div>

            {/* Metric 3: Agua Útil Inicial */}
            <div 
              className="dss-metric-col" 
              onClick={() => pedirExplicacionIa({
                tipo_elemento: "tarjeta",
                nombre: "Agua Útil Inicial en Suelo",
                cultivo: "maiz",
                valor: kpis?.agua_util || 0,
                unidad: "mm",
                estado: (kpis?.agua_util || 0) > 120 ? "favorable" : ((kpis?.agua_util || 0) > 60 ? "regular" : "riesgoso"),
                rango_ideal: "100 a 160 mm",
                descripcion_tecnica: "Volumen de agua almacenada en el perfil del suelo que está disponible para ser absorbido por las raíces al momento del arranque de la siembra."
              })}
              style={{ cursor: 'pointer' }}
              title="Clic para ver detalle"
            >
              <div className="dss-metric-value">
                {kpis?.agua_util || 0} <span>mm</span>
              </div>
              <div className="dss-metric-title">Agua Útil Inicial</div>
              <div className="dss-metric-trend up">
                ▲ +5.1% en suelo
              </div>
            </div>

          </div>

          {/* Right: Risk Badge */}
          {(() => {
            const riskText = String(kpis?.indice_riesgo?.nivel || 'Bajo').toLowerCase();
            const riskColor = kpis?.indice_riesgo?.color || '';
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
                  nombre: "Índice de Riesgo Estacional Compuesto",
                  cultivo: "maiz",
                  valor: kpis?.indice_riesgo?.nivel || "Bajo",
                  unidad: "",
                  estado: levelClass === 'level-danger' ? 'riesgoso' : (levelClass === 'level-warning' ? 'regular' : 'favorable'),
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
                  <span className="dss-risk-value">{kpis?.indice_riesgo?.nivel || "Bajo"}</span>
                  <span className="dss-risk-sub">Riesgo Compuesto - {kpis?.indice_riesgo?.nivel || "Bajo"}</span>
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
      <div className="chart-grid">
        {/* Anomaly Chart */}
        <div 
          className="glass-panel chart-panel-interactive"
          onClick={() => pedirExplicacionIa({
            tipo_elemento: "grafico",
            nombre: "Desviación Mensual (Lluvia vs Temperatura)",
            cultivo: "maiz",
            valor: "Anomalías climatológicas del ciclo",
            unidad: "",
            estado: "anomalías estacionales",
            descripcion_tecnica: "Gráfico de líneas y barras de desviación mensual climatológica que indica si habrá exceso o déficit de lluvias y temperaturas extremas durante el ciclo del cultivo.",
            impacto_base: "Determina si el cultivo sufrirá inundaciones o sequías agudas que afecten el llenado de grano y la fotosíntesis.",
            recomendacion_base: "Verificar si hay meses de alta sequía para programar riegos adicionales o meses lluviosos para limpiar drenajes.",
            datos_grafico: timeline_anomalia
          })}
        >
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Desviación Mensual (Lluvia vs Temperatura)</h3>
          </div>
          <div className="glass-card-body">
            <ClimateLine 
              labels={timeline_anomalia?.labels || []}
              lluviaHistorica={timeline_anomalia?.lluvia_historica || []}
              lluviaAnomala={timeline_anomalia?.lluvia_anomala || []}
              temperaturaAnomala={timeline_anomalia?.temperatura_anomala || []}
            />
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
