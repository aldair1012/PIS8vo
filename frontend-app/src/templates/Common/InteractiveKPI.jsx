import React from 'react';
import { indiceKpiSeguro } from '../../utils/kpiState';

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
  return slide.severity?.level === 'danger' ? 'danger' : slide.severity?.level === 'warning' ? 'warning' : 'neutral';
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
    severity: slide.severity ?? null,
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

  const slideCount = slides.length;
  const visibleIndex = indiceKpiSeguro(activeIndex, slideCount);
  const activeSlide = slides[visibleIndex];
  const activeSlideIsEmpty = isMissingMetricValue(activeSlide.value, activeSlide);
  const activeMetricState = getMetricState(activeSlide);

  // Los indicadores no cambian de significado sin intervención del usuario.

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
      const percent = Math.min(100, Math.max(0, (!isArray && chartConfig.percent !== undefined) ? chartConfig.percent : (data[data.length - 1] ?? 0)));
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

  const handleCardClick = (e) => {
    if (activeSlide && typeof activeSlide.onClick === 'function') {
      activeSlide.onClick(activeSlide, visibleIndex, e);
      return;
    }
    if (activeSlide && activeSlide.explanation && typeof onExplain === 'function') {
      onExplain(activeSlide.explanation);
      return;
    }
    if (typeof onClick === 'function') {
      const payload = (activeSlide && activeSlide.explanation) ? activeSlide.explanation : activeSlide;
      onClick(payload, activeSlide, visibleIndex, e);
    }
  };

  if (!hasRenderableSlides) return null;

  return (
    <div
      className={`kpi-card kpi-card-state-${activeMetricState} ${activeSlideIsEmpty ? 'kpi-card-empty' : ''}`}
      data-kpi-state={activeMetricState}
      title={tooltip}
      aria-label={tooltip || activeSlide.title}
      style={{
        animationDelay: `${delay * 60}ms`,
        cursor: (onClick || onExplain || activeSlide.onClick || activeSlide.explanation) ? 'pointer' : 'default',
        ...style
      }}
      onClick={handleCardClick}
    >


      {/* Icono, nombre y alerta solo cuando existe una condición explícita. */}
      <div className="kpi-top-row">
        <div className={`kpi-icon-wrapper ${iconClass} kpi-icon-state-${activeMetricState}`}>
          {icon}
        </div>
        <span className="kpi-heading-title">{activeSlide.title}</span>
        <div className="kpi-heading-status">
          {activeSlide.severity?.label && <span className={`kpi-severity kpi-severity--${activeSlide.severity.level}`}><span aria-hidden="true">⚠</span> {activeSlide.severity.label}</span>}
        </div>
      </div>

      {/* Middle Viewport: Vertical Slide Track for Title, Value & Sparkline */}
      <div className="kpi-carousel-wrapper">
        <div
          className="kpi-carousel-track"
          style={{
            transform: `translateY(-${visibleIndex * KPI_SLIDE_HEIGHT}px)`,
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {slides.map((slide, idx) => {
            return (
              <div key={idx} className="kpi-carousel-slide" aria-hidden={idx !== visibleIndex}>
                <div className="kpi-main-body">
                  <div className={`kpi-value-row ${isMissingMetricValue(slide.value, slide) ? 'kpi-value-row-empty' : ''}`}>
                    {isMissingMetricValue(slide.value, slide) ? (
                      <span className="kpi-empty-value" style={valueStyle}>
                        <span className="kpi-empty-value-icon" aria-hidden="true">—</span>
                        <span>Sin datos</span>
                      </span>
                    ) : (
                      <span className={`kpi-value ${valueClass} ${typeof slide.value === 'string' ? 'kpi-value-text' : ''} ${flattenRenderableText(slide.value).length >= 18 ? 'kpi-value-long' : flattenRenderableText(slide.value).length >= 10 ? 'kpi-value-compact' : ''}`} style={valueStyle}>
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
      {slides.length > 1 && <div className="kpi-switcher" aria-label={`Indicadores de ${activeSlide.title}`}><span>{visibleIndex + 1} / {slideCount}</span><div className="kpi-carousel-dots">{slides.map((slide, idx) => <button type="button" key={idx} className={`kpi-dot ${idx === visibleIndex ? 'active' : ''}`} aria-label={`Mostrar ${slide.title}, indicador ${idx + 1} de ${slideCount}`} aria-pressed={idx === visibleIndex} onClick={(event) => { event.stopPropagation(); setActiveIndex(idx); }} />)}</div></div>}
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
