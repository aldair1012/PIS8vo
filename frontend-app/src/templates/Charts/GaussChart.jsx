import EChart from '../../components/EChart';
import { getDashboardChartColors, getChartTooltip } from '../../utils/chartConfig';
import useTema from '../../hooks/useTema';
import { descriptivePercentiles, evidenceNumber } from '../../utils/agronomicEvidence';

const formatYield = value => value.toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2});

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
  const option = {
    grid: { left: 32, right: 32, top: 16, bottom: 56 },
    tooltip: getChartTooltip(theme, {
      trigger: 'item', renderMode: 'richText',
      formatter: item => `${labels[item.dataIndex]} · ${formatYield(item.value[0])} t/ha`,
    }),
    xAxis: {
      type: 'value', min: summary.min, max: summary.max, splitNumber: 4,
      name: 'Rendimiento guardado (t/ha)', nameLocation: 'middle', nameGap: 30,
      nameTextStyle: { color: theme.muted }, axisLabel: { color: theme.muted },
      splitLine: { lineStyle: { color: theme.grid } },
    },
    yAxis: { type: 'value', show: false, min: 0.5, max: 1.5 },
    series: [{ type: 'line', lineStyle: { color: theme.leaf, width: 3 }, symbol: 'circle', symbolSize: 15,
      data: summary.values.map((x, i) => ({ value: [x, 1], itemStyle: { color: colors[i] } })),
    }],
  };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingTop: '0.3rem' }}>
    <div style={{ height: '245px', position: 'relative' }}>
      <EChart option={option} ariaLabel="Percentiles descriptivos P10, mediana y P90 de las simulaciones guardadas" />
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
