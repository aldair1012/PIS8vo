import { Bar } from 'react-chartjs-2';
import { chartPalette, getDashboardChartColors, getDashboardChartAnimation } from '../../utils/chartConfig';
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

export default function FinancialROI({ strategies }) {
  const isLightTheme = document.body.classList.contains('light-theme');
  const theme = getDashboardChartColors(isLightTheme);
  const comparableStrategies = Array.isArray(strategies)
    ? strategies.filter((strategy) => strategy.roi !== null && strategy.roi !== undefined && Number.isFinite(Number(strategy.roi)))
    : [];

  if (comparableStrategies.length === 0) {
    return <div className="chart-empty-state">No se puede calcular ROI sin costos positivos en este escenario.</div>;
  }

  const labels = comparableStrategies.map((strategy) => strategy.nombre);
  const roiData = comparableStrategies.map((strategy) => strategy.roi);

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'ROI %',
        data: roiData,
        backgroundColor: comparableStrategies.map((_, index) => chartPalette[index % chartPalette.length]),
        borderColor: comparableStrategies.map((_, index) => chartPalette[index % chartPalette.length]),
        borderWidth: 1.8,
        borderRadius: 10,
        maxBarThickness: 34,
        barPercentage: 0.88,
        categoryPercentage: 0.88,
        hoverBackgroundColor: comparableStrategies.map((_, index) => chartPalette[index % chartPalette.length]),
        xAxisID: 'xROI',
      }
    ]
  };

  const options = {
    indexAxis: 'y', // Turn it into a horizontal bar chart!
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 4, bottom: 2, left: 4, right: 10 }
    },
    font: {
      family: 'Plus Jakarta Sans, sans-serif'
    },
    animation: getDashboardChartAnimation(),
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1.5,
        titleColor: theme.text,
        bodyColor: theme.muted,
        titleFont: { size: 14, weight: '800' },
        bodyFont: { size: 13, weight: '600' },
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (item) => {
            const strategy = comparableStrategies[item.dataIndex];
            return [
              `ROI: ${item.formattedValue}%`,
              `Margen: $${strategy?.margen || 0}/ha`,
              `Rendimiento: ${strategy?.rendimiento || 0} t/ha`
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
          lineWidth: 1
        },
        border: { display: true, color: theme.border, width: 1 },
        ticks: {
          color: theme.text,
          font: { size: 14, weight: '800' }
        }
      },
      xROI: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: 'ROI (%)',
          color: theme.text,
          font: { size: 14, weight: '800' }
        },
        grid: { color: theme.grid, lineWidth: 1 },
        border: { display: true, color: theme.border, width: 1 },
        ticks: { color: theme.muted, font: { size: 12, weight: '700' } }
      }
    }
  };

  return (
    <div className="financial-roi chart-wrapper" style={{ height: '100%', minHeight: '340px', width: '100%' }}>
      <Bar data={chartData} options={options} aria-label="Comparación del retorno de inversión por estrategia" role="img" />
    </div>
  );
}
