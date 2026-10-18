import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';

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
      ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.12)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }
};

export default function ClimateLine({ labels, lluviaHistorica, lluviaAnomala, temperaturaAnomala }) {
  const isLightTheme = document.body.classList.contains('light-theme');
  const textColor = isLightTheme ? '#020617' : '#ffffff';
  const tickColor = isLightTheme ? '#0f172a' : '#ffffff';
  const gridColor = isLightTheme ? 'rgba(51, 65, 85, 0.35)' : 'rgba(255, 255, 255, 0.28)';
  const borderColor = isLightTheme ? '#1e293b' : 'rgba(255, 255, 255, 0.6)';
  const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.95)';
  const tooltipBorder = isLightTheme ? 'rgba(15, 23, 42, 0.18)' : 'rgba(255, 255, 255, 0.1)';
  const tooltipTitle = isLightTheme ? '#0f172a' : '#f8fafc';
  const tooltipBody = isLightTheme ? '#334155' : 'rgba(255, 255, 255, 0.8)';

  const chartData = {
    labels: labels || ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    datasets: [
      {
        type: 'bar',
        label: 'Lluvia Histórica (mm)',
        data: lluviaHistorica || [],
        backgroundColor: isLightTheme ? 'rgba(59, 130, 246, 0.30)' : 'rgba(59, 130, 246, 0.22)',
        borderColor: isLightTheme ? 'rgba(59, 130, 246, 0.85)' : 'rgba(59, 130, 246, 0.65)',
        borderWidth: 1.5,
        borderRadius: 10,
        maxBarThickness: 32,
        yAxisID: 'yRain',
        order: 2,
        hoverBackgroundColor: 'rgba(59, 130, 246, 0.55)',
        hoverBorderColor: '#3b82f6'
      },
      {
        type: 'bar',
        label: 'Pronóstico Lluvia (mm)',
        data: lluviaAnomala || [],
        backgroundColor: isLightTheme ? 'rgba(22, 163, 74, 0.48)' : 'rgba(22, 163, 74, 0.4)',
        borderColor: isLightTheme ? 'rgb(22, 163, 74)' : 'rgb(22, 163, 74)',
        borderWidth: 1.8,
        borderRadius: 10,
        maxBarThickness: 32,
        yAxisID: 'yRain',
        order: 1,
        hoverBackgroundColor: 'rgba(22, 163, 74, 0.65)',
        hoverBorderColor: '#16a34a'
      },
      {
        type: 'line',
        label: 'Temp. Anómala (°C)',
        data: temperaturaAnomala || [],
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        borderWidth: 2.5,
        fill: false,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#ef4444',
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
          color: textColor,
          font: { size: 14, weight: '800' },
          boxWidth: 18,
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1.5,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
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
        grid: { color: gridColor, lineWidth: 1.5 },
        border: { display: true, color: borderColor, width: 2 },
        ticks: { color: tickColor, font: { size: 13, weight: '800' } }
      },
      yRain: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Precipitación (mm)',
          color: textColor,
          font: { size: 14, weight: '800' }
        },
        grid: { color: gridColor, lineWidth: 1.5 },
        border: { display: true, color: borderColor, width: 2 },
        ticks: { color: tickColor, font: { size: 13, weight: '800' } }
      },
      yTemp: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Temperatura (°C)',
          color: '#ef4444',
          font: { size: 14, weight: '800' }
        },
        grid: { drawOnChartArea: false },
        border: { display: true, color: '#ef4444', width: 2 },
        ticks: { color: isLightTheme ? '#dc2626' : '#f87171', font: { size: 13, weight: '800' } }
      }
    }
  };

  return (
    <div className="chart-wrapper aspect-ratio-chart" style={{ position: 'relative', height: '300px', minHeight: '300px' }}>
      <Chart type="bar" data={chartData} options={options} plugins={[crosshairPlugin]} />
    </div>
  );
}
