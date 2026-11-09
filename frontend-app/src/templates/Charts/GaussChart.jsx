import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { getDashboardChartColors, getDashboardChartAnimation } from '../../utils/chartConfig';
import { descriptivePercentiles, evidenceNumber } from '../../utils/agronomicEvidence';

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Se conserva el nombre del componente para los importadores existentes.
// Tres percentiles no permiten inferir una densidad ni ajustar una campana normal.
export default function GaussChart({ p10, p50, p90, muestra }) {
  const theme = getDashboardChartColors(document.body.classList.contains('light-theme'));
  const summary = descriptivePercentiles(p10, p50, p90);
  const count = evidenceNumber(muestra);
  if (!summary) return <div className="chart-empty-state">No hay percentiles descriptivos disponibles para las simulaciones guardadas.</div>;

  const labels = ['P10', 'P50 · Mediana', 'P90'];
  const colors = [theme.risk, theme.leaf, theme.sky];
  const chartData = {
    datasets: [{
      label: 'Percentiles descriptivos de simulaciones guardadas',
      data: summary.values.map((x) => ({ x, y: 1 })),
      borderColor: theme.border,
      borderWidth: 2,
      pointBackgroundColor: colors,
      pointBorderColor: colors,
      pointRadius: 7,
      pointHoverRadius: 9,
      fill: false,
      tension: 0,
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
        displayColors: false,
        callbacks: {
          title: (items) => labels[items[0].dataIndex],
          label: (item) => `${item.parsed.x.toFixed(2)} t/ha · resumen de ejecuciones guardadas`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear', min: summary.min, max: summary.max,
        grid: { color: theme.grid },
        border: { color: theme.border },
        ticks: { color: theme.muted },
        title: { display: true, text: 'Rendimiento estimado guardado (t/ha)', color: theme.muted },
      },
      y: { display: false, min: 0.5, max: 1.5 },
    },
  };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingTop: '0.3rem' }}>
    <div style={{ height: '245px', position: 'relative' }}>
      <Line data={chartData} options={options} aria-label="Percentiles descriptivos P10, mediana y P90 de las simulaciones guardadas" role="img" />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--zs-border)', paddingTop: '0.75rem' }}>
      {labels.map((label, index) => <div key={label} style={{ textAlign: 'center', flex: 1, padding: '0.45rem 0.3rem', borderRadius: '8px', background: 'var(--zs-inset-surface)', margin: '0 4px', border: '1px solid var(--zs-border)' }}>
        <div style={{ color: 'var(--zs-muted)', fontSize: '0.72rem', fontWeight: 700 }}>{label}</div>
        <div style={{ fontWeight: 900, color: colors[index], fontSize: '1.25rem', marginTop: '0.2rem' }}>{summary.values[index].toFixed(2)} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>t/ha</span></div>
      </div>)}
    </div>
    <p className="dashboard-chart-caption">{count !== null ? `${count} simulaciones guardadas. ` : ''}Los percentiles describen esta muestra de predicciones; no son probabilidades futuras ni una distribución normal validada.</p>
  </div>;
}
