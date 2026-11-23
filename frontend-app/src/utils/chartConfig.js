// Paleta de gráficos del espacio interno ZeaSys V5 — Seis colores base:
// Petróleo (#345C50/#4D766A) como serie principal, Salvia (#7C9084/#88A092)
// como secundaria, y Amarillo Maíz (#E9B949) exclusivamente para hitos puntuales.

export const chartPalette = ['#345C50', '#7C9084', '#4D766A', '#88A092', '#E9B949', '#557B6E'];

export function getDashboardChartColors(isLight = false) {
  return {
    primary: isLight ? '#345C50' : '#4D766A',
    leaf: isLight ? '#7C9084' : '#88A092',
    maize: '#E9B949',
    sky: isLight ? '#7C9084' : '#88A092',
    risk: isLight ? '#a63b2e' : '#e5a379',
    text: isLight ? '#222523' : '#F3F1EB',
    muted: isLight ? 'rgba(34, 37, 35, 0.72)' : 'rgba(243, 241, 235, 0.72)',
    grid: isLight ? 'rgba(34, 37, 35, 0.08)' : 'rgba(243, 241, 235, 0.08)',
    border: isLight ? 'rgba(34, 37, 35, 0.14)' : 'rgba(243, 241, 235, 0.15)',
    tooltipBg: isLight ? '#FAF9F8' : '#252D29',
    tooltipBorder: isLight ? 'rgba(34, 37, 35, 0.14)' : 'rgba(243, 241, 235, 0.15)',
  };
}

/** Tooltip ECharts coherente con el tema: fondo elevado, sombra y radio amplio. */
export function getChartTooltip(colors, overrides = {}) {
  return {
    trigger: 'axis',
    axisPointer: { type: 'shadow', shadowStyle: { color: colors.grid } },
    backgroundColor: colors.tooltipBg,
    borderColor: colors.tooltipBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: [10, 12],
    textStyle: { color: colors.text, fontSize: 12 },
    extraCssText: 'box-shadow: 0 14px 34px rgba(0, 0, 0, .28); backdrop-filter: blur(4px);',
    ...overrides,
  };
}
