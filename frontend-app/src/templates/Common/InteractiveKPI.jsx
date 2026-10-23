import React from 'react';

const MISSING_VALUE_PATTERN = /^(?:-|—|n\/a|na|sin\s+dato(?:s)?|no\s+disponible|pendiente)$/i;
const KPI_SLIDE_HEIGHT = 104;

function flattenRenderableText(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenRenderableText).join(' ');
  if (React.isValidElement(value)) return flattenRenderableText(value.props?.children);
  return '';
}

function isMissingMetricValue(value, slide = {}) {
  if (slide.isMissing === true) return true;
  if (slide.isMissing === false) return false;
  if (slide.explanation?.estado === 'sin_datos') return true;
  const text = flattenRenderableText(value).replace(/\s+/g, ' ').trim();
  return !text || MISSING_VALUE_PATTERN.test(text);
}

function getMetricState(slide) {
  if (isMissingMetricValue(slide.value, slide)) return 'empty';
  const text = `${slide.trend || ''} ${slide.explanation?.estado || ''}`.toLowerCase();
  if (/crít|critic|riesgo|pérd|perdid|alto|danger/.test(text)) return 'danger';
  if (/moder|medio|bajo|alerta|regular|warning/.test(text)) return 'warning';
  if (/favorable|óptim|optim|estable|bueno|saludable|logrado|success/.test(text)) return 'success';
  return 'neutral';
}

/**
 * InteractiveKPI — Reusable premium KPI card with vertical displacement/carousel
 * animation, responsive design, tooltips, SVG sparklines, and progress bars.
 */
export default function InteractiveKPI({
  icon,
  iconClass = 'text-secondary',
  title,
  value,
  valueClass = '',
  valueStyle = {},
  tooltip,
  progress,
  progressColor = '#9fc862',
  onClick,
  onExplain,
  delay = 0,
  trend,
  sparklineData,
  progressLabelLeft,
  progressLabelRight,
  slides: propSlides,
  style = {}
}) {
  const componentId = React.useId().replace(/:/g, '');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const [popoverSide, setPopoverSide] = React.useState('right');
  const cardRef = React.useRef(null);



  const normalizedSlides = (propSlides || [
    {
      title: title ?? "Métrica",
      value: value ?? "-",
      trend: trend ?? "",
      progress: progress ?? null,
      progressColor: progressColor ?? '#9fc862',
      progressLabelLeft: progressLabelLeft ?? "",
    progressLabelRight: progressLabelRight ?? "",
      sparklineData: sparklineData ?? null,
      miniChart: null
    }
  ]).map(slide => ({
    title: slide.title ?? "Métrica",
    value: slide.value ?? "-",
    trend: slide.trend ?? "",
    progress: slide.progress ?? null,
    progressColor: slide.progressColor ?? '#9fc862',
    progressLabelLeft: slide.progressLabelLeft ?? "",
    progressLabelRight: slide.progressLabelRight ?? "",
    sparklineData: slide.sparklineData ?? null,
    miniChart: slide.miniChart ?? null,
    isMissing: slide.isMissing ?? null,
    emptyHint: slide.emptyHint ?? null,
    explanation: slide.explanation ?? null,
    onClick: slide.onClick ?? null
  }));

  // Una tarjeta no debe ocupar espacio ni mostrar un valor de ejemplo cuando
  // el backend no entregó el indicador. Se conserva sólo la información real;
  // el carrusel sigue funcionando para las slides válidas restantes.
  const renderableSlides = normalizedSlides.filter(slide => !isMissingMetricValue(slide.value, slide));
  const hasRenderableSlides = renderableSlides.length > 0;
  // Mantener una slide técnica mientras se ejecutan los hooks evita cambiar
  // el orden de hooks entre renders; la tarjeta se omite antes de pintarse.
  const slides = hasRenderableSlides
    ? renderableSlides
    : (normalizedSlides.length > 0 ? normalizedSlides : [{ title: 'Métrica', value: '-' }]);

  const activeSlide = slides[activeIndex] || slides[0];
  const slideCount = slides.length;
  const activeSlideIsEmpty = isMissingMetricValue(activeSlide.value, activeSlide);
  const activeMetricState = getMetricState(activeSlide);

  // Los indicadores no cambian de significado sin intervención del usuario.

  // Generador inteligente de explicaciones concisas para el popover flotante
  const getPopoverContent = (slide) => {
    const exp = slide.explanation;
    const slideTitle = slide.title || "Métrica Agrícola";
    
    if (exp) {
      return {
        title: exp.nombre || slideTitle,
        description: exp.descripcion_tecnica || `Medición agroclimática de ${slideTitle.toLowerCase()} para el seguimiento del lote.`,
        impact: exp.impacto_base || `Incide directamente en el desarrollo fisiológico y rendimiento esperado del cultivo.`,
        recommendation: exp.recomendacion_base || null,
        source: exp.fuente || null
      };
    }

    const titleLower = slideTitle.toLowerCase();
    let description = `Indicador de ${titleLower} calculado con los datos disponibles para este lote.`;
    let impact = 'Úsalo como apoyo para comparar escenarios; comprueba la fuente y los supuestos antes de tomar una decisión.';
    let recommendation = null;

    if (titleLower.includes('potencial') || titleLower.includes('genético') || titleLower.includes('genetico')) {
      description = 'Referencia de rendimiento bajo condiciones favorables para el híbrido y los supuestos del modelo.';
      impact = 'Permite comparar el potencial con el rendimiento estimado; no representa una cosecha garantizada.';
    } else if (titleLower.includes('alcanzable')) {
      description = 'Estimación del rendimiento alcanzable dadas las restricciones consideradas por el modelo.';
      impact = 'Sirve como referencia para priorizar mejoras de manejo y contrastarlas con datos medidos.';
    } else if (titleLower.includes('predicho') || titleLower.includes('esperado')) {
      description = 'Rendimiento proyectado para los supuestos actuales de parcela, campaña y manejo.';
      impact = 'Ayuda a dimensionar el escenario productivo; el resultado observado puede ser diferente.';
    } else if (titleLower.includes('pérdida') || titleLower.includes('perdida') || titleLower.includes('brecha')) {
      description = 'Diferencia estimada entre una referencia de rendimiento y el resultado del escenario.';
      impact = 'Señala factores que conviene revisar, sin atribuir causalidad exacta a una sola variable.';
    } else if (titleLower.includes('acción') || titleLower.includes('accion') || titleLower.includes('prioritaria') || titleLower.includes('alerta')) {
      description = 'Acción sugerida según los datos y reglas disponibles para el lote.';
      impact = 'Conviene validarla con las condiciones reales de la parcela antes de aplicarla.';
    } else if (titleLower.includes('agua') || titleLower.includes('estrés') || titleLower.includes('estres') || titleLower.includes('riego') || titleLower.includes('hídrico') || titleLower.includes('hidrico')) {
      description = 'Indicador relacionado con agua disponible, demanda atmosférica o estrés hídrico.';
      impact = 'Ayuda a identificar periodos que requieren seguimiento o revisión del riego.';
    } else if (titleLower.includes('suelo') || titleLower.includes('retención') || titleLower.includes('retencion') || titleLower.includes('textura')) {
      description = 'Estimación de una propiedad del suelo relevante para el agua y el crecimiento del cultivo.';
      impact = 'Aporta contexto para interpretar la retención de humedad; se recomienda contrastarla con una medición local.';
    } else if (titleLower.includes('margen') || titleLower.includes('ganancia') || titleLower.includes('ingreso') || titleLower.includes('costo') || titleLower.includes('precio') || titleLower.includes('b/c')) {
      description = 'Indicador económico calculado con el precio, la producción y los costos del escenario configurado.';
      impact = 'Permite explorar sensibilidad y punto de equilibrio; no garantiza un resultado financiero.';
    }

    return { title: slideTitle, description, impact, recommendation };
  };

  // Helper to render versatile SVG Mini Charts (Line, Bar, Donut Ring)
  const renderMiniChart = (chartConfig, defaultColor = '#9fc862') => {
    if (!chartConfig) return null;

    // Normalize input: if chartConfig is an array, treat as sparkline data
    const isArray = Array.isArray(chartConfig);
    const data = isArray ? chartConfig : (chartConfig.data || []);
    const chartType = !isArray && chartConfig.type ? chartConfig.type : 'line';
    const color = !isArray && chartConfig.color ? chartConfig.color : defaultColor;

    // Determine vivid stroke/fill color
    let strokeColor = color;
    if (typeof color === 'string' && color.includes('gradient')) {
      if (color.includes('#863bff') || color.includes('#a855f7')) strokeColor = '#c084fc';
      else if (color.includes('#10b981') || color.includes('#34d399')) strokeColor = '#34d399';
      else if (color.includes('#ef4444') || color.includes('#f87171')) strokeColor = '#f87171';
      else if (color.includes('#f59e0b') || color.includes('#fbbf24')) strokeColor = '#fbbf24';
      else strokeColor = '#60a5fa';
    }

    const gradId = `kpi-mini-grad-${componentId}-${String(strokeColor).replace(/[^a-zA-Z0-9]/g, '')}`;

    // TYPE 1: DONUT / CIRCULAR RING (For ROI %, Efficiency, Probability)
    if (chartType === 'donut' || chartType === 'ring') {
      const size = 36;
      const strokeWidth = 4;
      const center = size / 2;
      const radius = (size - strokeWidth) / 2;
      const circumference = 2 * Math.PI * radius;
      const percent = Math.min(100, Math.max(0, (!isArray && chartConfig.percent !== undefined) ? chartConfig.percent : (data[data.length - 1] || 75)));
      const strokeDashoffset = circumference - (percent / 100) * circumference;

      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', flexShrink: 0 }}>
          <defs>
            <filter id={`ring-glow-${gradId}`}>
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={strokeColor} floodOpacity="0.65" />
            </filter>
          </defs>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--zs-border-strong)" strokeWidth={strokeWidth} />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            filter={`url(#ring-glow-${gradId})`}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
          <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="9px" fontWeight="800">
            {Math.round(percent)}%
          </text>
        </svg>
      );
    }

    // TYPE 2: MINI BARS (For Financial Costs, Expenses, Revenue breakdowns)
    if (chartType === 'bar') {
      if (!data.length) return null;
      const width = 74;
      const height = 32;
      const max = Math.max(...data, 1);
      const barWidth = Math.max(4, Math.floor((width - (data.length - 1) * 3) / data.length));

      return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', flexShrink: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.95" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.35" />
            </linearGradient>
            <filter id={`bar-glow-${gradId}`}>
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={strokeColor} floodOpacity="0.5" />
            </filter>
          </defs>
          {data.map((val, idx) => {
            const barHeight = Math.max(4, (Math.abs(val) / max) * (height - 4));
            const x = idx * (barWidth + 3);
            const y = height - barHeight;
            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={`url(#${gradId})`}
                filter={`url(#bar-glow-${gradId})`}
              />
            );
          })}
        </svg>
      );
    }

    // TYPE 3: SPARKLINE / LINE CURVE (Default continuous trend)
    if (!data.length || data.length < 2) return null;
    const width = 84;
    const height = 32;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const pathD = `M ${points.join(' L ')}`;
    const areaD = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', flexShrink: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.5" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
          <filter id={`glow-${gradId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={strokeColor} floodOpacity="0.65" />
          </filter>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#glow-${gradId})`}
        />
      </svg>
    );
  };

  const hoverTimerRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (typeof document !== 'undefined' && (document.querySelector('.ia-modal-backdrop') || document.querySelector('.modal-overlay') || document.body.classList.contains('modal-open'))) {
      setIsHovered(false);
      return;
    }

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    // Esperar 800 ms antes de desplegar la tarjeta flotante
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const windowWidth = typeof window !== 'undefined' ? (window.innerWidth || document.documentElement.clientWidth) : 1200;
        if (rect.right + 310 > windowWidth) {
          setPopoverSide('left');
        } else {
          setPopoverSide('right');
        }
      }
    }, 800);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    setIsHovered(false);
  };

  // Helper to categorize trend badge class
  const getBadgeClass = (trStr) => {
    if (!trStr) return '';
    const lower = String(trStr).toLowerCase();
    if (lower.includes('crítico') || lower.includes('critico') || lower.includes('alto') || lower.includes('alerta de baja') || lower.includes('riesgo')) {
      return 'badge-critical';
    }
    if (lower.includes('moderado') || lower.includes('medio') || lower.includes('alerta') || lower.includes('bajo')) {
      return 'badge-warning';
    }
    if (trStr.startsWith('+') || lower.includes('up') || lower.includes('óptimo') || lower.includes('optimo') || lower.includes('estable') || lower.includes('favorable') || lower.includes('bueno') || lower.includes('logrado') || lower.includes('saludable')) {
      return 'badge-success';
    }
    if (trStr.startsWith('-') || lower.includes('pérdida') || lower.includes('perdida')) {
      return 'badge-danger';
    }
    return 'badge-neutral';
  };

  const handleCardClick = (e) => {
    setIsHovered(false);
    if (activeSlide && typeof activeSlide.onClick === 'function') {
      activeSlide.onClick(activeSlide, activeIndex, e);
      return;
    }
    if (activeSlide && activeSlide.explanation && typeof onExplain === 'function') {
      onExplain(activeSlide.explanation);
      return;
    }
    if (typeof onClick === 'function') {
      const payload = (activeSlide && activeSlide.explanation) ? activeSlide.explanation : activeSlide;
      onClick(payload, activeSlide, activeIndex, e);
    }
  };

  const popoverData = getPopoverContent(activeSlide);
  const hasModalOpen = typeof document !== 'undefined' && (
    document.querySelector('.ia-modal-backdrop') || 
    document.querySelector('.modal-overlay') || 
    document.body.classList.contains('modal-open')
  );

  if (!hasRenderableSlides) return null;

  return (
    <div
      ref={cardRef}
      className={`glass-panel kpi-card kpi-card-state-${activeMetricState} ${activeSlideIsEmpty ? 'kpi-card-empty' : ''} ${isHovered && !hasModalOpen ? 'kpi-card-hovered' : ''}`}
      data-kpi-state={activeMetricState}
      title={tooltip}
      aria-label={tooltip || activeSlide.title}
      style={{
        animationDelay: `${delay * 60}ms`,
        cursor: (onClick || onExplain || activeSlide.onClick || activeSlide.explanation) ? 'pointer' : 'default',
        ...style
      }}
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >


      {/* Ventana Flotante Lateral (Side Hover Popover Explicativo) */}
      {isHovered && !hasModalOpen && (
        <div className={`kpi-side-popover popover-${popoverSide}`}>
          <div className="kpi-popover-header">
            <div className="kpi-popover-title-box">
              <span className="kpi-popover-title">{popoverData.title}</span>
            </div>
            {activeSlide.trend && (
              <span className={`kpi-trend-badge ${getBadgeClass(activeSlide.trend)}`}>
                {activeSlide.trend}
              </span>
            )}
          </div>

          <div className="kpi-popover-val-row">
            <span className="kpi-popover-val">
              {typeof activeSlide.value === 'object' ? activeSlide.value : activeSlide.value}
            </span>
            {slides.length > 1 && (
              <span style={{ fontSize: '0.62rem', color: 'var(--text-subtle)', marginLeft: 'auto' }}>
                Tema {activeIndex + 1} de {slides.length}
              </span>
            )}
          </div>

          <div className="kpi-popover-body">
            <div className="kpi-popover-section">
              <span className="kpi-popover-label">¿QUÉ ES?</span>
              <span className="kpi-popover-text">{popoverData.description}</span>
            </div>

            <div className="kpi-popover-section">
              <span className="kpi-popover-label" style={{ color: '#4ade80' }}>IMPACTO EN LA PLANTACIÓN:</span>
              <div className="kpi-popover-text-impact">{popoverData.impact}</div>
            </div>

            {popoverData.recommendation && (
              <div className="kpi-popover-section">
                <span className="kpi-popover-label" style={{ color: '#fbbf24' }}>RECOMENDACIÓN:</span>
                <span className="kpi-popover-text" style={{ fontStyle: 'italic' }}>{popoverData.recommendation}</span>
              </div>
            )}

            {popoverData.source && (
              <div className="kpi-popover-section">
                <span className="kpi-popover-label" style={{ color: '#93c5fd' }}>PROCEDENCIA:</span>
                <span className="kpi-popover-text">{popoverData.source}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Row: Icon, Dots (if multi-slide), & Trend Badge */}
      <div className="kpi-top-row">
        <div className={`kpi-icon-wrapper ${iconClass} kpi-icon-state-${activeMetricState}`}>
          {icon}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {slides.length > 1 && (
            <div className="kpi-carousel-dots" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {slides.map((_, idx) => (
                <button
                  type="button"
                  key={idx}
                  className={`kpi-dot ${idx === activeIndex ? 'active' : ''}`}
                  aria-label={`Mostrar ${slides[idx].title}, indicador ${idx + 1} de ${slideCount}`}
                  aria-pressed={idx === activeIndex}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(idx);
                  }}
                />
              ))}
            </div>
          )}
          {activeSlide.trend && (
            <span className={`kpi-trend-badge ${getBadgeClass(activeSlide.trend)}`}>
              {activeSlide.trend}
            </span>
          )}
        </div>
      </div>

      {/* Middle Viewport: Vertical Slide Track for Title, Value & Sparkline */}
      <div className="kpi-carousel-wrapper">
        <div
          className="kpi-carousel-track"
          style={{
            transform: `translateY(-${activeIndex * KPI_SLIDE_HEIGHT}px)`,
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {slides.map((slide, idx) => {
            return (
              <div key={idx} className="kpi-carousel-slide">
                <div className="kpi-main-body">
                  <div className="kpi-title-row">
                    <span className="kpi-title">{slide.title}</span>
                  </div>

                  <div className={`kpi-value-row ${isMissingMetricValue(slide.value, slide) ? 'kpi-value-row-empty' : ''}`}>
                    {isMissingMetricValue(slide.value, slide) ? (
                      <span className="kpi-empty-value" style={valueStyle}>
                        <span className="kpi-empty-value-icon" aria-hidden="true">—</span>
                        <span>Sin datos</span>
                      </span>
                    ) : (
                      <span className={`kpi-value ${valueClass} ${typeof slide.value === 'string' ? 'kpi-value-text' : ''} ${flattenRenderableText(slide.value).length >= 18 ? 'kpi-value-long' : ''}`} style={valueStyle}>
                        {slide.value}
                      </span>
                    )}

                    {!isMissingMetricValue(slide.value, slide) && renderMiniChart(
                      slide.miniChart || slide.sparklineData,
                      slide.progressColor || progressColor
                    )}
                  </div>
                  {isMissingMetricValue(slide.value, slide) && (
                    <div className="kpi-empty-hint">
                      {slide.emptyHint || 'Este indicador requiere datos del lote o una nueva simulación.'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Progress Bar & Labels (Fixed for Active Slide) */}
      {!activeSlideIsEmpty && activeSlide.progress !== undefined && activeSlide.progress !== null && (
        <div className="kpi-bottom-progress">
          <div className="kpi-mini-bar">
            <div
              className="kpi-mini-bar-fill"
              style={{
                width: `${Math.min(100, Math.max(0, activeSlide.progress))}%`,
                background: activeSlide.progressColor || progressColor,
                boxShadow: `0 0 10px ${activeSlide.progressColor || progressColor}80`
              }}
            />
          </div>
          {(activeSlide.progressLabelLeft || activeSlide.progressLabelRight) && (
            <div className="kpi-progress-labels">
              <span className="kpi-label-left">{activeSlide.progressLabelLeft}</span>
              <span className="kpi-label-right">{activeSlide.progressLabelRight}</span>
            </div>
          )}
        </div>
      )}
      {activeSlideIsEmpty && (
        <div className="kpi-empty-footer">
          <span className="kpi-empty-footer-dot" aria-hidden="true" />
          <span>{activeSlide.explanation?.fuente ? `Fuente: ${activeSlide.explanation.fuente}` : 'Fuente pendiente de completar'}</span>
        </div>
      )}
      {(onClick || onExplain || activeSlide.onClick || activeSlide.explanation) && (
        <button
          type="button"
          className="kpi-explain-action"
          onClick={(event) => {
            event.stopPropagation();
            handleCardClick(event);
          }}
          aria-label={`Ver explicación de ${activeSlide.title}`}
        >
          Ver explicación <span aria-hidden="true">↗</span>
        </button>
      )}
    </div>
  );
}
