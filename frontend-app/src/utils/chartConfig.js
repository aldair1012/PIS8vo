// Paleta de gráficos del espacio interno, alineada con la landing sin
// acoplar sus selectores. Chart.js necesita colores resueltos para canvas.
export const chartPalette = ['#9fc862', '#d8a83f', '#9ed1ff', '#70a984', '#e5a379', '#699887'];

export function getDashboardChartColors(isLight = false) {
  return {
    primary: isLight ? '#27784a' : '#c4e477',
    leaf: isLight ? '#27784a' : '#9fc862',
    maize: isLight ? '#9a6d14' : '#d8a83f',
    sky: isLight ? '#286f9b' : '#9ed1ff',
    risk: isLight ? '#af5437' : '#e5a379',
    text: isLight ? '#173b28' : '#f4f8f1',
    muted: isLight ? '#405f49' : '#c1d2c2',
    grid: isLight ? 'rgba(30, 78, 47, .11)' : 'rgba(196, 228, 197, .1)',
    border: isLight ? 'rgba(30, 78, 47, .24)' : 'rgba(196, 228, 197, .22)',
    tooltipBg: isLight ? '#ffffff' : '#10291d',
    tooltipBorder: isLight ? 'rgba(30, 78, 47, .18)' : 'rgba(196, 228, 197, .22)',
  };
}

export function getDashboardChartAnimation() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? false
    : { duration: 520, easing: 'easeOutCubic' };
}
