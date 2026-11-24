import EChart from '../../components/EChart';
import { chartPalette, getChartBase, getChartTooltip, getDashboardChartColors } from '../../utils/chartConfig';
import useTema from '../../hooks/useTema';

const fmt = value => Number(value).toLocaleString('es-EC', { maximumFractionDigits: 2 });

export default function FinancialROI({ strategies = [] }) {
  const theme = getDashboardChartColors(useTema());
  const rows = (Array.isArray(strategies) ? strategies : []).filter(row => row.roi != null && Number.isFinite(Number(row.roi)));
  if (!rows.length) return <div className="chart-empty-state">No se puede calcular ROI sin costos positivos en este escenario.</div>;
  const option = getChartBase(theme, {
    grid: { top: 12, left: 8, right: 18, bottom: 46, containLabel: true },
    legend: { show: false },
    tooltip: getChartTooltip(theme, {
      trigger: 'item', renderMode: 'richText',
      formatter: item => {
        const row = rows[item.dataIndex];
        return [row.nombre, `ROI: ${fmt(row.roi)} %`, `Margen: $${fmt(row.margen)}/ha`,
          `Rendimiento: ${fmt(row.rendimiento)} t/ha`].join('\n');
      },
    }),
    xAxis: { type: 'value', name: 'ROI (%)', nameLocation: 'middle', nameGap: 30,
      nameTextStyle: { color: theme.muted, fontSize: 11 }, axisLabel: { color: theme.muted, fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: theme.grid, type: 'dashed' } } },
    yAxis: { type: 'category', inverse: true, data: rows.map(row => row.nombre),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: theme.text, fontSize: 11, width: 105, overflow: 'break', interval: 0 } },
    series: [{ type: 'bar', barMaxWidth: 30, itemStyle: { borderRadius: [0, 6, 6, 0] },
      data: rows.map((row, i) => ({ value: Number(row.roi), itemStyle: { color: chartPalette[i % chartPalette.length] } })),
    }],
  });
  return <EChart className="financial-roi chart-wrapper" style={{ minHeight: 340 }}
    option={option} ariaLabel="Comparación del retorno de inversión por estrategia" />;
}
