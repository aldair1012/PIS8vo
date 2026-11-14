import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import localeES from 'echarts/lib/i18n/langES';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([AriaComponent, BarChart, LineChart, GridComponent, LegendComponent, TitleComponent, TooltipComponent, CanvasRenderer]);
echarts.registerLocale('ES', localeES);

export default function EChart({ option, className, style, onClick, ariaLabel }) {
  const nodeRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!nodeRef.current) return undefined;
    const chart = echarts.init(nodeRef.current, null, { renderer: 'canvas', locale: 'ES' });
    chartRef.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(nodeRef.current);
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onClick) return undefined;
    const handler = params => { if (params.componentType === 'series') onClick(params); };
    chart.on('click', handler);
    return () => { if (!chart.isDisposed()) chart.off('click', handler); };
  }, [onClick]);

  useEffect(() => {
    if (!chartRef.current) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    chartRef.current.setOption({ ...option, aria: { enabled: true, ...option?.aria }, ...(reduced ? { animation: false } : {}) }, { notMerge: true, lazyUpdate: false });
    chartRef.current.resize();
  }, [option]);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      chartRef.current?.setOption({ animation: false });
    }
  }, []);

  return <div ref={nodeRef} className={className} role="img" aria-label={ariaLabel} style={{ width: '100%', height: '100%', ...style }} />;
}
