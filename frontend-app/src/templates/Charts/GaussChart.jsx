import { Line } from 'react-chartjs-2';
import { getDashboardChartColors, getDashboardChartAnimation } from '../../utils/chartConfig';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
} from 'chart.js';

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

// Plugin personalizado de retícula (crosshair)
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
      const ctx = chart.ctx;
      const activePoint = chart.tooltip._active[0];
      const x = activePoint.element.x;
      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;

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

export default function GaussChart({ p10, p50, p90 }) {
  const isLightTheme = document.body.classList.contains('light-theme');
  const theme = getDashboardChartColors(isLightTheme);

  if (![p10, p50, p90].every((value) => typeof value === 'number' && Number.isFinite(value)) || p90 <= p10 || p50 < p10 || p50 > p90) {
    return <div className="chart-empty-state">No hay percentiles suficientes para estimar una distribución de rendimiento.</div>;
  }

  const mean = p50;
  // Aproximación normal derivada del intervalo central P10–P90.
  const stdDev = (p90 - p10) / 2.56;

  const dataPoints = [];
  const minX = Math.max(0, Math.min(p10, mean - 3 * stdDev));
  const maxX = Math.max(p90, mean + 3 * stdDev);
  const step = (maxX - minX) / 80;

  for (let x = minX; x <= maxX; x += step) {
    const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
    const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
    dataPoints.push({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(4)) });
  }

  // Asegurar que el último punto esté en maxX
  const lastExponent = -0.5 * Math.pow((maxX - mean) / stdDev, 2);
  const lastY = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(lastExponent);
  dataPoints.push({ x: parseFloat(maxX.toFixed(2)), y: parseFloat(lastY.toFixed(4)) });

  // Generar ticks redondeados y combinarlos con p10, p50, p90 de forma clara y sin amontonamiento
  const rawTicks = Array.from(new Set([
    parseFloat(minX.toFixed(1)),
    parseFloat(p10.toFixed(1)),
    parseFloat(p50.toFixed(1)),
    parseFloat(p90.toFixed(1)),
    parseFloat(maxX.toFixed(1))
  ])).sort((a, b) => a - b);

  // Filtrar valores que estén a menos de 0.35 t/ha de distancia para evitar solapamientos
  const allTicks = [];
  for (let i = 0; i < rawTicks.length; i++) {
    const val = rawTicks[i];
    if (i === 0 || (val - allTicks[allTicks.length - 1]) >= 0.35) {
      allTicks.push(val);
    }
  }

  // Plugin para dibujar las líneas verticales en P10, P50 y P90
  const verticalLinesPlugin = {
    id: 'verticalLines',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
      ctx.save();

      const drawLine = (val, color) => {
        const xPos = x.getPixelForValue(val);
        if (xPos >= chart.chartArea.left && xPos <= chart.chartArea.right) {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 4]);
          ctx.moveTo(xPos, top);
          ctx.lineTo(xPos, bottom);
          ctx.stroke();
        }
      };

      // Línea P10 (Pesimista) - Rojo
      drawLine(p10, theme.risk);

      // Línea P50 (Esperado) - Verde
      drawLine(p50, theme.leaf);

      // Línea P90 (Optimista) - Azul
      if (Math.abs(p90 - p50) > 0.05) {
        drawLine(p90, theme.sky);
      }

      ctx.restore();
    }
  };

  const chartData = {
    datasets: [
      {
        label: 'Distribución aproximada de rendimiento',
        data: dataPoints,
        borderColor: theme.leaf,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: theme.leaf,
        pointHoverBorderColor: isLightTheme ? '#0f172a' : '#fff',
        pointHoverBorderWidth: 2,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;

          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, isLightTheme ? 'rgba(39, 120, 74, .26)' : 'rgba(159, 200, 98, .26)');
          gradient.addColorStop(1, 'rgba(159, 200, 98, 0)');
          return gradient;
        },
        tension: 0.3
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
        titleFont: { size: 13, weight: '800' },
        bodyFont: { size: 12, weight: '600' },
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: (items) => `Rendimiento: ${items[0].parsed.x.toFixed(2)} t/ha`,
          label: (item) => `Densidad: ${item.parsed.y.toFixed(3)}`
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        min: minX,
        max: maxX,
        grid: {
          color: theme.grid,
          lineWidth: 1,
          drawTicks: true
        },
        border: {
          display: true,
          color: theme.border,
          width: 1
        },
        afterBuildTicks: (axis) => {
          axis.ticks = allTicks.map(v => ({ value: v }));
        },
        ticks: {
          color: theme.muted,
          callback: (value) => {
            const formatted = value.toFixed(1);
            if (value === allTicks[allTicks.length - 1]) {
              return `${formatted} t/ha`;
            }
            return formatted;
          },
          font: {
            size: 13,
            weight: '800',
            family: 'Plus Jakarta Sans'
          },
          padding: 8
        }
      },
      y: {
        grid: {
          display: false
        },
        ticks: {
          display: false
        }
      }
    }
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
    padding: '0.3rem 0 0 0'
  };

  return (
    <div style={containerStyle}>
      <div style={{ height: '245px', position: 'relative' }}>
        <Line data={chartData} options={options} plugins={[crosshairPlugin, verticalLinesPlugin]} aria-label="Distribución aproximada del rendimiento entre percentiles P10, P50 y P90" role="img" />
      </div>
      
      {/* Indicadores de Percentiles con Tamaño y Estructura Destacada */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        borderTop: '1px solid var(--zs-border)',
        paddingTop: '0.75rem',
        marginTop: '0.2rem'
      }}>
        <div style={{ textAlign: 'center', flex: 1, padding: '0.45rem 0.3rem', borderRadius: '8px', background: 'var(--zs-inset-surface)', margin: '0 4px', border: '1px solid var(--zs-border)' }}>
          <div style={{ color: 'var(--zs-muted)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            P10 · PESIMISTA
          </div>
          <div style={{ fontWeight: 900, color: theme.risk, fontSize: '1.25rem', marginTop: '0.2rem' }}>
            {p10.toFixed(2)} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>t/ha</span>
          </div>
        </div>
        
        <div style={{ textAlign: 'center', flex: 1, padding: '0.45rem 0.3rem', borderRadius: '8px', background: 'var(--zs-inset-surface)', margin: '0 4px', border: '1px solid var(--zs-border)' }}>
          <div style={{ color: 'var(--zs-muted)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            P50 · ESPERADO
          </div>
          <div style={{ fontWeight: 900, color: theme.leaf, fontSize: '1.25rem', marginTop: '0.2rem' }}>
            {p50.toFixed(2)} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>t/ha</span>
          </div>
        </div>
        
        <div style={{ textAlign: 'center', flex: 1, padding: '0.45rem 0.3rem', borderRadius: '8px', background: 'var(--zs-inset-surface)', margin: '0 4px', border: '1px solid var(--zs-border)' }}>
          <div style={{ color: 'var(--zs-muted)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            P90 · OPTIMISTA
          </div>
          <div style={{ fontWeight: 900, color: theme.sky, fontSize: '1.25rem', marginTop: '0.2rem' }}>
            {p90.toFixed(2)} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>t/ha</span>
          </div>
        </div>
      </div>
      <p className="dashboard-chart-caption">Curva normal aproximada a partir de P10 y P90; los percentiles son las referencias directas para comparar escenarios.</p>
    </div>
  );
}
