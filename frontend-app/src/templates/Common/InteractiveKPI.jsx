import React from 'react';

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
  progressColor = '#3b82f6',
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
  const isHoveredRef = React.useRef(false);
  const cardRef = React.useRef(null);



  const slides = (propSlides || [
    {
      title: title ?? "Métrica",
      value: value ?? "-",
      trend: trend ?? "",
      progress: progress ?? null,
      progressColor: progressColor ?? '#3b82f6',
      progressLabelLeft: progressLabelLeft ?? "",
      progressLabelRight: progressLabelRight ?? "",
      sparklineData: sparklineData ?? null
    }
  ]).map(slide => ({
    title: slide.title ?? "Métrica",
    value: slide.value ?? "-",
    trend: slide.trend ?? "",
    progress: slide.progress ?? null,
    progressColor: slide.progressColor ?? '#3b82f6',
    progressLabelLeft: slide.progressLabelLeft ?? "",
    progressLabelRight: slide.progressLabelRight ?? "",
    sparklineData: slide.sparklineData ?? null,
    explanation: slide.explanation ?? null,
    onClick: slide.onClick ?? null
  }));

  const activeSlide = slides[activeIndex] || slides[0];
  const slideCount = slides.length;

  // Auto-slide transition effect con pausa al pasar el mouse y reanudación sincronizada en el siguiente ciclo
  React.useEffect(() => {
    if (slideCount > 1) {
      const timer = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden && !isHoveredRef.current) {
          setActiveIndex((prev) => (prev + 1) % slideCount);
        }
      }, 5500);
      return () => clearInterval(timer);
    }
  }, [slideCount]);

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
    let description = `Medición técnica de ${titleLower} procesada por el motor DSS para evaluar la salud del lote.`;
    let impact = `Influye en el equilibrio fisiológico y la productividad final de la plantación seleccionada.`;
    let recommendation = null;

    if (titleLower.includes('potencial') || titleLower.includes('genético') || titleLower.includes('genetico')) {
      description = "Techo biológico máximo que el híbrido puede alcanzar bajo radiación y nutrición ideal sin restricciones.";
      impact = "Sirve como referencia teórica máxima para medir qué tan cerca está la parcela de explotar la semilla al 100%.";
    } else if (titleLower.includes('alcanzable')) {
      description = "Rendimiento máximo posible considerando el clima real y la capacidad física del suelo de tu zona.";
      impact = "Establece la meta productiva realista a la que se debe apuntar optimizando la nutrición y el agua.";
    } else if (titleLower.includes('predicho') || titleLower.includes('esperado')) {
      description = "Rendimiento final estimado por el modelo de simulación al concluir el ciclo agrícola actual.";
      impact = "Determina las toneladas de cosecha que obtendrás y la viabilidad comercial de la siembra.";
    } else if (titleLower.includes('pérdida') || titleLower.includes('perdida') || titleLower.includes('brecha')) {
      description = "Estimación de quintales o toneladas no producidas debido a estrés de agua, nutrientes o clima.";
      impact = "Muestra exactamente en qué factor se está perdiendo dinero y rendimiento para tomar acción oportuna.";
    } else if (titleLower.includes('acción') || titleLower.includes('accion') || titleLower.includes('prioritaria') || titleLower.includes('alerta')) {
      description = "Manejo o práctica prioritaria recomendada para corregir el principal factor limitante del cultivo.";
      impact = "Previene reducciones mayores de rendimiento y estabiliza el desarrollo de las plantas.";
    } else if (titleLower.includes('agua') || titleLower.includes('estrés') || titleLower.includes('estres') || titleLower.includes('riego') || titleLower.includes('hídrico') || titleLower.includes('hidrico')) {
      description = "Disponibilidad hídrica disponible en las raíces o nivel de tensión evapotranspirativa de la planta.";
      impact = "Asegura la floración, previene el aborto de granos y mantiene la tasa de fotosíntesis activa.";
    } else if (titleLower.includes('suelo') || titleLower.includes('retención') || titleLower.includes('retencion') || titleLower.includes('textura')) {
      description = "Capacidad física del perfil del suelo para retener agua aprovechable y suministrar humedad.";
      impact = "Determina la resistencia del cultivo ante días secos sin lluvia y la frecuencia de riego requerida.";
    } else if (titleLower.includes('margen') || titleLower.includes('ganancia') || titleLower.includes('ingreso') || titleLower.includes('costo') || titleLower.includes('precio') || titleLower.includes('b/c')) {
      description = "Métrica financiera que calcula el retorno monetario restando los costos fijos y variables del ingreso total.";
      impact = "Garantiza la rentabilidad neta del agricultor por cada dólar invertido en el lote.";
    }

    return { title: slideTitle, description, impact, recommendation };
  };

  // Helper to render versatile SVG Mini Charts (Line, Bar, Donut Ring)
  const renderMiniChart = (chartConfig, defaultColor = '#60a5fa') => {
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
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth={strokeWidth} />
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
          <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize="9px" fontWeight="800">
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
      isHoveredRef.current = false;
      return;
    }

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    // Esperar 800 ms antes de desplegar la tarjeta flotante
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
      isHoveredRef.current = true;
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
    isHoveredRef.current = false;
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
    isHoveredRef.current = false;
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

  return (
    <div
      ref={cardRef}
      className={`glass-panel kpi-card ${isHovered && !hasModalOpen ? 'kpi-card-hovered' : ''}`}
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
        <div className={`kpi-icon-wrapper ${iconClass}`}>
          {icon}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {slides.length > 1 && (
            <div className="kpi-carousel-dots" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {slides.map((_, idx) => (
                <span
                  key={idx}
                  className={`kpi-dot ${idx === activeIndex ? 'active' : ''}`}
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
            transform: `translateY(-${activeIndex * 80}px)`,
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

                  <div className="kpi-value-row">
                    {typeof slide.value === 'string' ? (
                      <span className={`kpi-value ${valueClass} ${slide.value.length >= 11 ? 'kpi-value-long' : 'kpi-value-chip'}`} style={valueStyle}>
                        {slide.value}
                      </span>
                    ) : (
                      <span className={`kpi-value ${valueClass}`} style={valueStyle}>
                        {slide.value}
                      </span>
                    )}

                    {renderMiniChart(
                      slide.miniChart || slide.sparklineData,
                      slide.progressColor || progressColor
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Progress Bar & Labels (Fixed for Active Slide) */}
      {activeSlide.progress !== undefined && activeSlide.progress !== null && (
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
    </div>
  );
}
