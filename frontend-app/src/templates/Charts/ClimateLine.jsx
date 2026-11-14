import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import { getDashboardChartColors, getDashboardChartAnimation } from '../../utils/chartConfig';
import useTema from '../../hooks/useTema';

ChartJS.register(...registerables);

const hexWithAlpha = (hex, alpha) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

// Retícula vertical que sigue al cursor (crosshair).
const crosshairPlugin = {
  id: 'crosshairClimate',
  afterDraw(chart) {
    if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
      const ctx = chart.ctx;
      const activePoint = chart.tooltip._active[0];
      const x = activePoint.element.x;
      const topY = chart.chartArea.top;
      const bottomY = chart.chartArea.bottom;

      const isLight = document.body.classList.contains('light-theme');
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = getDashboardChartColors(isLight).border;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }
};

export default function ClimateLine({ labels, lluviaHistorica, lluviaAnomala, temperaturaAnomala }) {
  const temaClaro = useTema();
  const theme = getDashboardChartColors(temaClaro);

  const horizontalBarGradient = (hex, alpha = 0.55) => (context) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return hexWithAlpha(hex, alpha);
    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
    gradient.addColorStop(0, hexWithAlpha(hex, alpha * 0.45));
    gradient.addColorStop(1, hex);
    return gradient;
  };

  const areaGradient = (hex, top = 0.32, bottom = 0.02) => (context) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return hexWithAlpha(hex, top);
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, hexWithAlpha(hex, top));
    gradient.addColorStop(1, hexWithAlpha(hex, bottom));
    return gradient;
  };

  const chartData = {
    labels: labels || ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    datasets: [
      {
        type: 'bar',
        label: 'Lluvia de referencia (mm)',
        data: lluviaHistorica || [],
        backgroundColor: horizontalBarGradient(theme.sky, 0.42),
        borderColor: hexWithAlpha(theme.sky, 0.55),
        borderWidth: 1,
        borderRadius: 9,
        maxBarThickness: 30,
        yAxisID: 'yRain',
        order: 2,
        hoverBackgroundColor: theme.sky,
        hoverBorderColor: theme.sky
      },
      {
        type: 'bar',
        label: 'Lluvia del escenario (mm)',
        data: lluviaAnomala || [],
        backgroundColor: horizontalBarGradient(theme.leaf, 0.62),
        borderColor: theme.leaf,
        borderWidth: 1.5,
        borderRadius: 9,
        maxBarThickness: 30,
        yAxisID: 'yRain',
        order: 1,
        hoverBackgroundColor: theme.leaf,
        hoverBorderColor: theme.leaf
      },
      {
        type: 'line',
        label: 'Temperatura del escenario (°C)',
        data: temperaturaAnomala || [],
        borderColor: theme.maize,
        backgroundColor: areaGradient(theme.maize, 0.3, 0.02),
        borderWidth: 3,
        fill: 'origin',
        tension: 0.35,
        pointRadius: 3.5,
        pointBackgroundColor: theme.maize,
        pointHoverRadius: 6.5,
        pointHoverBackgroundColor: theme.maize,
        pointHoverBorderColor: temaClaro ? '#FBFCFA' : '#141F17',
        pointHoverBorderWidth: 2,
        yAxisID: 'yTemp',
        order: 0
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: getDashboardChartAnimation(),
    font: {
      family: 'Plus Jakarta Sans, sans-serif'
    },
    interaction: {
      mode: 'index',
      intersect: false,
      axis: 'x'
    },
    layout: {
      padding: { top: 12, bottom: 4, left: 4, right: 4 }
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          color: theme.text,
          font: { size: 12, weight: '700' },
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          padding: 14
        }
      },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        titleColor: theme.text,
        bodyColor: theme.muted,
        titleFont: { size: 12, weight: '700' },
        bodyFont: { size: 12, weight: '600' },
        cornerRadius: 10,
        boxPadding: 6,
        usePointStyle: true,
        padding: 10,
        mode: 'index',
        intersect: false,
        caretPadding: 6
      }
    },
    scales: {
      x: {
        grid: { color: theme.grid, lineWidth: 1 },
        border: { display: true, color: theme.border, width: 1 },
        ticks: { color: theme.muted, font: { size: 12, weight: '700' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
      },
      yRain: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Precipitación (mm)',
          color: theme.muted,
          font: { size: 11, weight: '700' }
        },
        grid: { color: theme.grid, lineWidth: 1 },
        border: { display: true, color: theme.border, width: 1 },
        ticks: { color: theme.muted, font: { size: 11, weight: '700' } }
      },
      yTemp: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Temperatura (°C)',
          color: theme.maize,
          font: { size: 11, weight: '700' }
        },
        grid: { drawOnChartArea: false },
        border: { display: true, color: theme.maize, width: 1 },
        ticks: { color: theme.maize, font: { size: 11, weight: '700' } }
      }
    }
  };

  return (
    <div className="chart-wrapper aspect-ratio-chart" style={{ position: 'relative' }}>
      <Chart key={String(temaClaro)} type="bar" data={chartData} options={options} plugins={[crosshairPlugin]} aria-label="Serie mensual modelada de lluvia de referencia, lluvia del escenario y temperatura" role="img" />
    </div>
  );
}
