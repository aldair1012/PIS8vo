import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import { getDashboardChartColors, getDashboardChartAnimation } from '../../utils/chartConfig';

ChartJS.register(...registerables);

// Plugin de retícula (crosshair)
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
  const isLightTheme = document.body.classList.contains('light-theme');
  const theme = getDashboardChartColors(isLightTheme);

  const chartData = {
    labels: labels || ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    datasets: [
      {
        type: 'bar',
        label: 'Lluvia de referencia · modelo (mm)',
        data: lluviaHistorica || [],
        backgroundColor: isLightTheme ? 'rgba(40, 111, 155, .3)' : 'rgba(158, 209, 255, .3)',
        borderColor: theme.sky,
        borderWidth: 1.5,
        borderRadius: 10,
        maxBarThickness: 32,
        yAxisID: 'yRain',
        order: 2,
        hoverBackgroundColor: theme.sky,
        hoverBorderColor: theme.sky
      },
      {
        type: 'bar',
        label: 'Lluvia del escenario · modelo (mm)',
        data: lluviaAnomala || [],
        backgroundColor: isLightTheme ? 'rgba(39, 120, 74, .48)' : 'rgba(159, 200, 98, .45)',
        borderColor: theme.leaf,
        borderWidth: 1.8,
        borderRadius: 10,
        maxBarThickness: 32,
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
        backgroundColor: theme.maize,
        borderWidth: 2.5,
        fill: false,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: theme.maize,
        pointHoverBorderColor: '#fff',
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
      intersect: false
    },
    layout: {
      padding: { top: 10, bottom: 5, left: 5, right: 5 }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: theme.text,
          font: { size: 14, weight: '800' },
          boxWidth: 18,
          padding: 16
        }
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
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      x: {
        grid: { color: theme.grid, lineWidth: 1 },
        border: { display: true, color: theme.border, width: 1 },
        ticks: { color: theme.muted, font: { size: 12, weight: '700' } }
      },
      yRain: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Precipitación (mm)',
          color: theme.text,
          font: { size: 14, weight: '800' }
        },
        grid: { color: theme.grid, lineWidth: 1 },
        border: { display: true, color: theme.border, width: 1 },
        ticks: { color: theme.muted, font: { size: 12, weight: '700' } }
      },
      yTemp: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Temperatura (°C)',
          color: theme.maize,
          font: { size: 14, weight: '800' }
        },
        grid: { drawOnChartArea: false },
        border: { display: true, color: theme.maize, width: 1 },
        ticks: { color: theme.maize, font: { size: 12, weight: '700' } }
      }
    }
  };

  return (
    <div className="chart-wrapper aspect-ratio-chart" style={{ position: 'relative', height: '300px', minHeight: '300px' }}>
      <Chart type="bar" data={chartData} options={options} plugins={[crosshairPlugin]} aria-label="Escenario mensual modelado de lluvia y temperatura" role="img" />
    </div>
  );
}
