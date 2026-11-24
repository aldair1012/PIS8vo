import EChart from '../../components/EChart';
import { financeNumber } from '../../utils/financeBudget';
import { chartPalette, getChartBase, getChartTooltip, getDashboardChartColors } from '../../utils/chartConfig';
import useTema from '../../hooks/useTema';

// Misma paleta que el resto de gráficos: el maíz solo marca hitos puntuales.
const colorPalette = chartPalette;

export default function CostBreakdown({ items = [] }) {
  const theme = getDashboardChartColors(useTema());
  const expenseItems = items.filter(item => !item.is_total && Number(item.amount) < 0);
  const totalExpenses = expenseItems.reduce((total, item) => total + Math.abs(item.amount), 0);
  const netMargin = financeNumber(items.find(item => item.label === 'Margen Neto')?.amount);
  if (!totalExpenses) return <div className="chart-empty-state">No hay costos registrados para mostrar su distribución.</div>;
  const option = getChartBase(theme, {
    color: colorPalette,
    legend: { show: false },
    tooltip: getChartTooltip(theme, { trigger: 'item', renderMode: 'richText',
      formatter: item => `${item.name} · $${item.value.toLocaleString('es-EC')} (${item.percent} %)` }),
    series: [{ type: 'pie', radius: ['66%', '92%'], label: { show: false },
      itemStyle: { borderColor: theme.tooltipBg, borderWidth: 2, borderRadius: 4 },
      emphasis: { scaleSize: 6 },
      data: expenseItems.map(item => ({ name: item.label, value: Math.abs(item.amount) })) }],
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'center', minHeight: '240px' }}>
      {/* Doughnut Chart Canvas with Center Text Overlay */}
      <div style={{ position: 'relative', width: '100%', height: '220px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <EChart option={option} ariaLabel="Distribución de los costos del presupuesto calculado" />
        <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 700, letterSpacing: '0.05em', display: 'block' }}>
            Costo total
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15 }}>
            ${totalExpenses.toLocaleString('es-EC')}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
            Margen: {netMargin === null ? 'No disponible' : `$${netMargin.toLocaleString('es-EC', { maximumFractionDigits: 2 })}`}/ha
          </span>
        </div>
      </div>

      {/* Side Breakdown Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', width: '100%' }}>
        {expenseItems.map((item, idx) => {
          const itemColor = colorPalette[idx % colorPalette.length];
          const absVal = Math.abs(item.amount);
          const pct = ((absVal / totalExpenses) * 100).toLocaleString('es-EC', { maximumFractionDigits: 1 });

          return (
            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: itemColor, display: 'inline-block', boxShadow: `0 0 6px ${itemColor}80` }} />
                  {item.label}
                </div>
                <div style={{ fontWeight: 700, color: 'var(--zs-text)', fontSize: '0.78rem' }}>
                  ${absVal.toLocaleString('es-EC')} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({pct}%)</span>
                </div>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'var(--border-subtle)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (absVal / totalExpenses) * 100)}%`, height: '100%', background: itemColor, borderRadius: '99px', transition: 'width .65s cubic-bezier(.22,.61,.36,1)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
