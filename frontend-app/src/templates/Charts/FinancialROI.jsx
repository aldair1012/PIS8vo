import { Bar } from 'react-chartjs-2';
import { chartPalette, getDashboardChartColors, getDashboardChartAnimation } from '../../utils/chartConfig';
import useTema from '../../hooks/useTema';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function hexWithAlpha(hex, alpha) {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

export default function FinancialROI({ strategies }) {
  const temaClaro = useTema();
  const isLightTheme = temaClaro;
  const theme = getDashboardChartColors(isLightTheme);
  const comparableStrategies = Array.isArray(strategies)
    ? strategies.filter((strategy) => strategy.roi !== null && strategy.roi !== undefined && Number.isFinite(Number(strategy.roi)))
    : [];

  if (comparableStrategies.length === 0) {
    return <div className="chart-empty-state">No se puede calcular ROI sin costos positivos en este escenario.</div>;
  }

  const labels = comparableStrategies.map((strategy) => strategy.nombre);
  const roiData = comparableStrategies.map((strategy) => Number(strategy.roi));

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'ROI %',
        data: roiData,
        borderRadius: 12,
        maxBarThickness: 30,
        barPercentage: 0.84,
        categoryPercentage: 0.9,
        borderWidth: 0,
        hoverBorderColor: theme.text,
        hoverBorderWidth: 2,
        xAxisID: 'xROI',
        backgroundColor: (context) => {
          const base = chartPalette[context.dataIndex % chartPalette.length];
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return base;
          const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
          gradient.addColorStop(0, hexWithAlpha(base, 0.45));
          gradient.addColorStop(1, base);
          return gradient;
        },
        hoverBackgroundColor: (context) => chartPalette[context.dataIndex % chartPalette.length],
      }
    ]
  };

  const options = {
    indexAxis: 'y', // Barras horizontales
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 6, bottom: 2, left: 4, right: 10 }
    },
    animations: {
      x: { duration: 650, easing: 'easeOutQuart' }
    },
    animation: getDashboardChartAnimation(),
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        titleColor: theme.text,
        bodyColor: theme.muted,
        titleFont: { size: 13, weight: 'bold' },
        bodyFont: { size: 12, weight: 'bold' },
        cornerRadius: 10,
        boxPadding: 6,
        padding: 10,
        usePointStyle: true,
        displayColors: false,
        callbacks: {
          label: (item) => {
            const strategy = comparableStrategies[item.dataIndex];
            return [
              `ROI: ${Number(strategy?.roi ?? 0).toLocaleString('es-EC', { maximumFractionDigits: 1 })} %`,
              `Margen: $${Number(strategy?.margen ?? 0).toLocaleString('es-EC', { maximumFractionDigits: 2 })}/ha`,
              `Rendimiento: ${Number(strategy?.rendimiento ?? 0).toLocaleString('es-EC', { maximumFractionDigits: 2 })} t/ha`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        grid: {
          display: true,
          color: theme.grid,
          lineWidth: 1,
          drawTicks: false
        },
        border: { display: true, color: theme.border, width: 1 },
        ticks: {
          color: theme.text,
          font: { size: 13, weight: 'bold' },
          padding: 6
        }
      },
      xROI: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: 'ROI (%)',
          color: theme.muted,
          font: { size: 12, weight: 'bold' }
        },
        grid: { color: theme.grid, lineWidth: 1, drawTicks: false },
        border: { display: true, color: theme.border, width: 1 },
        ticks: { color: theme.muted, font: { size: 11, weight: 'bold' }, maxTicksLimit: 6 }
      }
    }
  };

  return (
    <div className="financial-roi chart-wrapper" style={{ height: '100%', minHeight: '340px', width: '100%' }}>
      <Bar key={String(temaClaro)} data={chartData} options={options} aria-label="Comparación del retorno de inversión por estrategia" role="img" />
    </div>
  );
}
