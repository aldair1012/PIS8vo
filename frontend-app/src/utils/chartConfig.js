// src/utils/chartConfig.js — Configuración base para charts mejorados (interactividad, animaciones, tooltips)
const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const chartPalette = CHART_COLORS;

export const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 800,
    easing: 'easeOutQuart',
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        color: 'var(--text-secondary)',
        font: { family: 'Inter', size: 11, weight: 500 },
        padding: 12,
        usePointStyle: true,
        pointStyle: 'circle',
      },
    },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      titleFont: { family: 'Inter', size: 13, weight: 600 },
      bodyFont: { family: 'Inter', size: 12 },
      callbacks: {
        label: (ctx) => {
          const label = ctx.dataset.label || '';
          const value = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
          return `${label}: ${typeof value === 'number' ? value.toFixed(2) : value}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(148, 163, 184, 0.08)', drawBorder: false },
      ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
    },
    y: {
      grid: { color: 'rgba(148, 163, 184, 0.08)', drawBorder: false },
      ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
    },
  },
  interaction: {
    mode: 'index',
    intersect: false,
  },
};

export const getChartColor = (index) => CHART_COLORS[index % CHART_COLORS.length];

export const chartAnimation = {
  duration: 800,
  easing: 'easeOutQuart',
  delay: (context) => context.dataIndex * 50,
};