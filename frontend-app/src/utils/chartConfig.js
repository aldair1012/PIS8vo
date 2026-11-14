// Paleta de gráficos del espacio interno, alineada con el informe técnico
// de ZeaSys: un acento agro-técnico apagado, verdes grisáceos y un latón
// discreto para el caso destacado. Evita saturación y brillo.
import { graphic } from 'echarts/core';

export const chartPalette = ['#8FBB9A', '#C7A24E', '#9CC6E6', '#6FA98B', '#D08B6F', '#82A68E'];

export function getDashboardChartColors(isLight = false) {
  return {
    primary: isLight ? '#1F5C38' : '#C3D7A4',
    leaf: isLight ? '#1F5C38' : '#8FBB9A',
    maize: isLight ? '#8A6A1C' : '#C7A24E',
    sky: isLight ? '#2C6E94' : '#9CC6E6',
    risk: isLight ? '#9A4530' : '#D08B6F',
    text: isLight ? '#14231A' : '#E8EDE8',
    muted: isLight ? '#3A4A41' : '#9DB09F',
    grid: isLight ? 'rgba(31, 92, 56, .13)' : 'rgba(160, 185, 170, .10)',
    border: isLight ? 'rgba(31, 92, 56, .26)' : 'rgba(160, 185, 170, .24)',
    tooltipBg: isLight ? '#FBFCFA' : '#141F17',
    tooltipBorder: isLight ? 'rgba(31, 92, 56, .22)' : 'rgba(160, 185, 170, .30)',
  };
}

export function getDashboardChartAnimation() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? false
    : { duration: 520, easing: 'easeOutCubic' };
}

/** Degradado horizontal suave para barras (de translúcido al color pleno). */
export function barGradient(hex, alpha = 0.6) {
  const hexAlpha = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return new graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: `${hex}${hexAlpha}` },
    { offset: 1, color: hex },
  ]);
}

/** Degradado vertical para áreas bajo líneas (color pleno arriba → casi transparente abajo). */
export function areaGradient(hex, topAlpha = 0.42, bottomAlpha = 0.02) {
  const alpha = (value) => Math.round(value * 255).toString(16).padStart(2, '0');
  return new graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: `${hex}${alpha(topAlpha)}` },
    { offset: 1, color: `${hex}${alpha(bottomAlpha)}` },
  ]);
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
    extraCssText: 'box-shadow: 0 14px 34px rgba(0, 0, 0, .34); backdrop-filter: blur(4px);',
    ...overrides,
  };
}
