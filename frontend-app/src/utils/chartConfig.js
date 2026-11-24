// Paleta de gráficos del espacio interno ZeaSys V5 — Seis colores base:
// Petróleo (#345C50/#4D766A) como serie principal, Salvia (#7C9084/#88A092)
// como secundaria, y Amarillo Maíz (#E9B949) exclusivamente para hitos puntuales.

export const chartPalette = ['#345C50', '#7C9084', '#4D766A', '#88A092', '#E9B949', '#557B6E'];

export function getDashboardChartColors(isLight = false) {
  return {
    primary: isLight ? '#345C50' : '#4D766A',
    leaf: isLight ? '#7C9084' : '#88A092',
    maize: '#E9B949',
    // El cielo era idéntico a la hoja: se diferencia con un tono más profundo
    // de la misma rama salvia para que escenarios y referencias no se confundan.
    sky: isLight ? '#557B6E' : '#7FA394',
    risk: isLight ? '#a63b2e' : '#e5a379',
    text: isLight ? '#222523' : '#F3F1EB',
    muted: isLight ? 'rgba(34, 37, 35, 0.72)' : 'rgba(243, 241, 235, 0.72)',
    grid: isLight ? 'rgba(34, 37, 35, 0.08)' : 'rgba(243, 241, 235, 0.08)',
    border: isLight ? 'rgba(34, 37, 35, 0.14)' : 'rgba(243, 241, 235, 0.15)',
    tooltipBg: isLight ? '#FAF9F8' : '#252D29',
    tooltipBorder: isLight ? 'rgba(34, 37, 35, 0.14)' : 'rgba(243, 241, 235, 0.15)',
  };
}

const CHART_FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/**
 * Base visual compartida para todos los canvas. Centraliza rejilla, ejes,
 * leyenda y tipografía para que cada pestaña se lea con el mismo criterio.
 * Las opciones propias de cada gráfico se fusionan después y ganan siempre.
 */
export function getChartBase(colors, overrides = {}) {
  const base = {
    animationDuration: 520,
    animationEasing: 'cubicOut',
    textStyle: { fontFamily: CHART_FONT, color: colors.text, fontSize: 12 },
    grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
      textStyle: { color: colors.muted, fontSize: 11, fontFamily: CHART_FONT },
    },
    xAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.muted, fontSize: 11, margin: 12, fontFamily: CHART_FONT },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.muted, fontSize: 11, margin: 12, fontFamily: CHART_FONT },
      splitLine: { show: true, lineStyle: { color: colors.grid, type: 'dashed' } },
    },
  };
  return mergeChartOption(base, overrides);
}

/** Fusión superficial y predecible: las claves del llamador prevalecen. */
export function mergeChartOption(base, overrides = {}) {
  const result = { ...base, ...overrides };
  for (const key of ['grid', 'legend', 'xAxis', 'yAxis', 'tooltip', 'aria', 'textStyle']) {
    if (base[key] && overrides[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      result[key] = { ...base[key], ...overrides[key] };
    }
  }
  return result;
}

/** Tooltip ECharts coherente con el tema y con los valores en español. */
export function getChartTooltip(colors, overrides = {}) {
  return {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow',
      shadowStyle: { color: colors.grid },
      label: { backgroundColor: colors.tooltipBg, color: colors.text, fontSize: 11 },
    },
    backgroundColor: colors.tooltipBg,
    borderColor: colors.tooltipBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: [10, 12],
    confine: true,
    transitionDuration: 0.18,
    textStyle: { color: colors.text, fontSize: 12, fontFamily: CHART_FONT },
    extraCssText: 'box-shadow: 0 14px 34px rgba(0, 0, 0, .22); backdrop-filter: blur(6px);',
    ...overrides,
  };
}

/** Formateador de cifras para tooltips y etiquetas, con criterio ecuatoriano. */
export function formatChartValue(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sin dato';
  return new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value));
}
