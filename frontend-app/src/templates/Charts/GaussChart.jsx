import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { getDashboardChartColors, getDashboardChartAnimation } from '../../utils/chartConfig';
import useTema from '../../hooks/useTema';
import { descriptivePercentiles, evidenceNumber } from '../../utils/agronomicEvidence';

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
const formatYield = value => value.toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2});
const hexWithAlpha = (hex, alpha) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

// Se conserva el nombre del componente para los importadores existentes.
// Tres percentiles no permiten inferir una densidad ni ajustar una campana normal.
export default function GaussChart({ p10, p50, p90, muestra }) {
  const temaClaro = useTema();
  const theme = getDashboardChartColors(temaClaro);
  const summary = descriptivePercentiles(p10, p50, p90);
  const count = evidenceNumber(muestra);
  if (!summary) return <div className="chart-empty-state">No hay percentiles descriptivos disponibles para las simulaciones guardadas.</div>;
  if (count === 1) return <div className="siembra-single-result"><strong>{formatYield(summary.values[1])} t/ha</strong><p>Rendimiento de la única simulación guardada en este periodo.</p><p>Una simulación no permite comparar la variación de rendimientos.</p></div>;

  const labels = ['P10', 'P50 · Mediana', 'P90'];
  const colors = [theme.risk, theme.leaf, theme.sky];
  const chartData = {
    datasets: [{
      label: 'Percentiles descriptivos de simulaciones guardadas',
      data: summary.values.map((x) => ({ x, y: 1 })),
      borderColor: theme.leaf,
      borderWidth: 3,
      pointBackgroundColor: colors,
      pointBorderColor: temaClaro ? '#f6f9f4' : '#0b2417',
      pointBorderWidth: 2,
      pointRadius: 8,
      pointHoverRadius: 11,
      pointHoverBorderWidth: 3,
      fill: true,
      tension: 0.4,
      backgroundColor: (context) => {
        const { ctx, chartArea } = context.chart;
        if (!chartArea) return hexWithAlpha(theme.leaf, 0.3);
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, hexWithAlpha(theme.leaf, 0.4));
        gradient.addColorStop(1, hexWithAlpha(theme.leaf, 0.02));
        return gradient;
      },
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: getDashboardChartAnimation(),
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        borderWidth: 1,
        titleColor: theme.text,
        bodyColor: theme.muted,
        cornerRadius: 10,
        padding: 10,
        boxPadding: 6,
        usePointStyle: true,
        displayColors: false,
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12, weight: '600' },
        callbacks: {
          title: (items) => labels[items[0].dataIndex],
          label: (item) => `${formatYield(item.parsed.x)} t/ha · muestra guardada`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear', min: summary.min, max: summary.max,
        grid: { color: theme.grid, drawTicks: false },
        border: { color: theme.border },
        ticks: { color: theme.muted, font: { size: 11, weight: 'bold' } },
        title: { display: true, text: 'Rendimiento estimado guardado (t/ha)', color: theme.muted, font: { size: 12, weight: 'bold' } },
      },
      y: { display: false, min: 0.5, max: 1.45 },
    },
  };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingTop: '0.3rem' }}>
    <div style={{ height: '245px', position: 'relative' }}>
      <Line key={String(temaClaro)} data={chartData} options={options} aria-label="Percentiles descriptivos P10, mediana y P90 de las simulaciones guardadas" role="img" />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid var(--zs-border)', paddingTop: '0.75rem' }}>
      {labels.map((label, index) => <div key={label} style={{ textAlign: 'center', flex: 1, padding: '0.5rem 0.3rem', borderRadius: '12px', background: 'var(--zs-inset-surface)', border: '1px solid var(--zs-border)', boxShadow: '0 1px 0 rgba(255,255,255,.04) inset' }}>
        <div style={{ color: 'var(--zs-muted)', fontSize: '0.72rem', fontWeight: 700 }}>{label}</div>
        <div style={{ fontWeight: 900, color: colors[index], fontSize: '1.3rem', marginTop: '0.25rem', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{formatYield(summary.values[index])} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>t/ha</span></div>
      </div>)}
    </div>
    <p className="dashboard-chart-caption">{count !== null ? `${count} ${count === 1 ? 'simulación guardada' : 'simulaciones guardadas'}. ` : ''}Los percentiles describen esta muestra de predicciones; no son probabilidades futuras ni una distribución normal validada.</p>
    {summary.values[0] === summary.values[2] && <p className="dashboard-chart-caption">Los tres percentiles coinciden en {formatYield(summary.values[1])} t/ha; los puntos están superpuestos.</p>}
  </div>;
}
