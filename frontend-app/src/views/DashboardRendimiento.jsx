import { useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Activity, ArrowUpRight, BarChart3, CalendarDays, MapPin, Play, Plus, Sprout, Wheat } from 'lucide-react';
import { dssService } from '../services/api';
import { getDashboardChartAnimation, getDashboardChartColors } from '../utils/chartConfig';
import { isYieldNumber, provinceFromLocation, regionalHistory, simulationHistory, yieldAnalysis } from '../utils/yieldDashboard';
import sipa from '../data/sipa-maiz-duro-2020-2025.json';
import ecuadorProvincias from '../data/ecuador-provincias.json';
import '../assets/rendimiento-dashboard.css';

ChartJS.register(...registerables);

const number = (value, digits = 2) => isYieldNumber(value)
  ? new Intl.NumberFormat('es-EC', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
  : '—';
const validDate = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const shortDate = (value) => validDate(value)?.toLocaleDateString('es-EC') ?? 'Fecha no registrada';
const latestYear = Math.max(...sipa.periodos.map(({ año }) => año));
const geocodingCache = new Map();

function useYieldChartColors() {
  const [light, setLight] = useState(() => document.body.classList.contains('light-theme'));
  useEffect(() => {
    const observer = new MutationObserver(() => setLight(document.body.classList.contains('light-theme')));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return getDashboardChartColors(light);
}

function MetricCard({ label, value, unit, detail, icon: Icon, feature = false }) {
  return <article className={`ydp-metric${feature ? ' ydp-metric--feature' : ''}`}>
    <div className="ydp-metric-label">{Icon && <Icon size={18} aria-hidden="true" />}<span>{label}</span></div>
    <div className="ydp-metric-window"><div className="ydp-metric-frame">
      <p className={`ydp-metric-value ${String(value ?? '').length > 9 ? 'ydp-metric-value--long' : ''}`}>{value ?? '—'}<small>{unit}</small></p>
      <p className="ydp-metric-detail">{detail}</p>
    </div></div>
  </article>;
}

function Panel({ title, subtitle, icon: Icon, action, className = '', children }) {
  return <section className={`ydp-panel ${className}`}>
    <header className="ydp-panel-header">
      <div className="ydp-panel-heading">
        {Icon && <Icon size={17} aria-hidden="true" />}
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      </div>
      {action}
    </header>
    {children}
  </section>;
}

function Legend({ items }) {
  return <div className="ydp-legend" aria-label="Leyenda del gráfico">
    {items.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>)}
  </div>;
}

const normalizedPlace = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');

function EcuadorProvinceMap({ province }) {
  const selectedKey = normalizedPlace(province);
  const mainland = ecuadorProvincias.features.filter((feature) => feature.properties.dpa_despro !== 'GALÁPAGOS');
  const galapagos = ecuadorProvincias.features.find((feature) => feature.properties.dpa_despro === 'GALÁPAGOS');
  const paths = (features, bounds, box) => {
    const [minX, minY, maxX, maxY] = bounds;
    const [left, top, width, height] = box;
    const sx = width / (maxX - minX);
    const sy = height / (maxY - minY);
    const scale = Math.min(sx, sy);
    const offsetX = left + (width - (maxX - minX) * scale) / 2;
    const offsetY = top + (height - (maxY - minY) * scale) / 2;
    const project = ([lon, lat]) => [offsetX + (lon - minX) * scale, offsetY + (maxY - lat) * scale];
    return features.map((feature) => {
      const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      const d = polygons.flatMap((polygon) => polygon.map((ring) => ring.map((point, index) => {
        const [x, y] = project(point);
        return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ') + ' Z')).join(' ');
      const active = normalizedPlace(feature.properties.dpa_despro) === selectedKey;
      return <path key={feature.properties.dpa_provin} d={d} className={active ? 'ydp-map-province is-selected' : 'ydp-map-province'} aria-hidden="true" />;
    });
  };
  const continentalBounds = [-81.1, -5.1, -75.0, 1.5];
  const galapagosBounds = [-92.2, -1.7, -89.0, 1.5];
  return <figure className="ydp-province-map" aria-label={`Mapa de Ecuador con ${province} resaltada`}>
    <figcaption><span>UBICACIÓN DE LA PARCELA</span><strong><MapPin size={14} aria-hidden="true" />{province}</strong></figcaption>
    <svg viewBox="0 0 220 260" role="img" aria-label={`Mapa provincial de Ecuador: ${province} resaltada`}>
      <g>{paths(mainland, continentalBounds, [35, 8, 174, 224])}</g>
      {galapagos && <g className="ydp-map-galapagos">{paths([galapagos], galapagosBounds, [5, 202, 34, 37])}</g>}
    </svg>
    <span className="ydp-map-caption">Límites CONALI · 2025</span>
  </figure>;
}

const barValueLabels = {
  id: 'yieldBarValues',
  afterDatasetsDraw(chart) {
    if (chart.options.indexAxis !== 'y') return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = chart.options.color;
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (!chart.isDatasetVisible(datasetIndex)) return;
      chart.getDatasetMeta(datasetIndex).data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (!isYieldNumber(value)) return;
        const text = number(value);
        const width = ctx.measureText(text).width;
        const point = bar.getProps(['x', 'y'], false);
        const x = Math.max(chartArea.left, Math.min(point.x + 7, chart.width - width - 6));
        ctx.fillText(text, x, point.y);
      });
    });
    ctx.restore();
  },
};

function chartOptions(colors, title, extra = {}) {
  return {
    responsive: true,
    color: colors.text,
    layout: { padding: { right: 44 } },
    maintainAspectRatio: false,
    animation: getDashboardChartAnimation(),
    interaction: { mode: 'index', intersect: false },
    hover: { mode: 'index', intersect: false },
    onHover: (event, elements, chart) => { chart.canvas.style.cursor = elements.length ? 'pointer' : 'default'; },
    transitions: { active: { animation: { duration: getDashboardChartAnimation() ? 180 : 0 } } },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: colors.tooltipBg, titleColor: colors.text, titleFont: { size: 12, weight: '600' }, bodyColor: colors.muted, bodyFont: { size: 12 }, borderColor: colors.tooltipBorder, borderWidth: 1, padding: 11, cornerRadius: 8, boxPadding: 5 },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: colors.muted, font: { size: 11 }, padding: 8, maxRotation: 0 } },
      y: { beginAtZero: true, border: { display: false }, ticks: { color: colors.muted, font: { size: 11 }, padding: 7, maxTicksLimit: 5 }, grid: { color: colors.grid, drawTicks: false }, title: { display: Boolean(title), text: title, color: colors.muted, font: { size: 10, weight: '600' } } },
    },
    ...extra,
  };
}

const scenarioNames = { lluvioso: 'Lluvioso', verano: 'Verano', sequia: 'Sequía' };

export default function DashboardRendimiento({ cultivoElegidoId, onNavigate, onDashboardData, onAbrirRegistroCampo }) {
  const [response, setResponse] = useState(null);
  const [selection, setSelection] = useState(null);
  const [scenarioUnit, setScenarioUnit] = useState('yield');
  const [scenarioKey, setScenarioKey] = useState('base');
  const [showAllFactors, setShowAllFactors] = useState(false);
  const [comparisonId, setComparisonId] = useState('');
  const [year, setYear] = useState(latestYear);
  const [geocoded, setGeocoded] = useState(null);
  const [refAbierto, setRefAbierto] = useState(false);
  const colors = useYieldChartColors();
  const key = String(cultivoElegidoId ?? 'sin-parcela');
  const current = response?.key === key ? response : null;
  const data = current?.data;
  const lot = data?.cultivo_activo;
  const simulations = data?.simulaciones_rendimiento ?? [];
  const simulation = simulations.find((item) => selection?.lot === key && String(item.id) === selection.id) ?? simulations[0] ?? null;
  const comparison = simulations.find((item) => String(item.id) === comparisonId && item.id !== simulation?.id) ?? simulations.find((item) => item.id !== simulation?.id);
  const references = useMemo(() => data?.referencias_publicas ?? {}, [data?.referencias_publicas]);
  const locationKey = `${key}:${lot?.latitud}:${lot?.longitud}`;
  const provinceInLot = provinceFromLocation(lot?.provincia) ?? provinceFromLocation(lot?.ubicacion);
  const province = provinceInLot ?? (geocoded?.key === locationKey ? geocoded.province : null);
  const history = useMemo(() => regionalHistory(sipa.periodos, province, year), [province, year]);
  const period = sipa.periodos.find((item) => item.año === year);
  const analysis = yieldAnalysis(simulation, data?.kpis);
  const runs = simulationHistory(simulations, simulation, 12).filter((item) => isYieldNumber(item.rendimiento_t_ha));

  useEffect(() => {
    let active = true;
    dssService.getRendimientoData(cultivoElegidoId, null)
      .then((result) => { if (active) setResponse({ key, data: result }); })
      .catch(() => { if (active) setResponse({ key, error: 'No se pudieron cargar los datos de rendimiento. Vuelve a intentarlo.' }); });
    return () => { active = false; };
  }, [key, cultivoElegidoId]);

  useEffect(() => {
    if (provinceInLot || !lot || lot.latitud == null || lot.longitud == null || lot.latitud === '' || lot.longitud === '') return undefined;
    const lat = Number(lot.latitud);
    const lon = Number(lot.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
    let active = true;
    const coordinateKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    if (!geocodingCache.has(coordinateKey)) {
      geocodingCache.set(coordinateKey, fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&format=json&accept-language=es`, { signal: AbortSignal.timeout(8000) })
        .then((result) => result.ok ? result.json() : null)
        .then((geo) => geo?.address?.country_code === 'ec'
          ? provinceFromLocation(geo.address.state) ?? provinceFromLocation(geo.address.province)
          : null)
        .catch(() => { geocodingCache.delete(coordinateKey); return null; }));
    }
    geocodingCache.get(coordinateKey).then((name) => { if (active) setGeocoded({ key: locationKey, province: name }); });
    return () => { active = false; };
  }, [locationKey, lot, provinceInLot]);

  useEffect(() => {
    if (!current) return;
    onDashboardData?.({
      cultivo_activo: lot,
      simulaciones_count: simulations.length,
      simulacion_seleccionada: simulation,
      kpis: simulation ? {
        rendimiento_predicho: simulation.rendimiento_t_ha,
        produccion_total_t: simulation.produccion_total_t,
        area_simulada_ha: simulation.area_simulada_ha,
      } : null,
      referencias_contexto: data?.referencias_contexto ?? null,
      referencias_publicas: references,
      mediciones_campo: data?.mediciones_campo ?? null,
      referencia_sipa: {
        cultivo: sipa.cultivo,
        fuente: sipa.fuente_pagina,
        año_visible: year,
        territorio_visible: province,
        provincia: history.selected,
        nota: 'Datos provinciales de maíz duro seco; son referencia regional y no cosechas medidas de esta parcela.',
      },
    });
  }, [current, data, history.selected, lot, onDashboardData, province, references, simulation, simulations.length, year]);

  const classScores = Object.entries(simulation?.probabilidades_clase_pct ?? {})
    .filter(([, value]) => isYieldNumber(value) && value > 0 && value <= 100);
  const scenarioRows = Object.entries(simulation?.escenarios_climaticos ?? {})
    .map(([key, value]) => ({ key, label: scenarioNames[key] ?? key, ...value }))
    .filter((row) => isYieldNumber(row.rendimiento_t_ha));
  const allContributions = analysis.contributions.filter((row) => row.value !== 0);
  const contributionRows = showAllFactors ? [...allContributions] : allContributions.slice(0, 6);
  if (!showAllFactors && allContributions.length > 6) contributionRows.push({ name: 'Otros factores', value: allContributions.slice(6).reduce((sum, row) => sum + row.value, 0) });
  if (simulation) scenarioRows.unshift({ key: 'base', label: 'Tu simulación', rendimiento_t_ha: simulation.rendimiento_t_ha, produccion_total_t: simulation.produccion_total_t });
  const selectedScenario = scenarioRows.find((row) => row.key === scenarioKey) ?? scenarioRows[0];
  const scenarioValue = (row) => scenarioUnit === 'yield' ? row.rendimiento_t_ha : row.produccion_total_t ?? (isYieldNumber(simulation?.area_simulada_ha) ? row.rendimiento_t_ha * simulation.area_simulada_ha : null);
  const scenarioAxisUnit = scenarioUnit === 'yield' ? 't/ha' : 't';
  const shapExtent = Math.ceil(Math.max(0.1, ...contributionRows.map((row) => Math.abs(row.value))) * 10) / 10;
  const historyYears = sipa.periodos.map((item) => item.año);
  const chartInteraction = chartOptions(colors, 'Rendimiento (t/ha)');

  if (!current) return <div className="dashboard-view ydp-dashboard"><div className="ydp-state" role="status"><span className="ydp-loader" />Cargando rendimiento de la parcela…</div></div>;
  if (current.error) return <div className="dashboard-view ydp-dashboard"><div className="ydp-state ydp-state--error" role="alert">{current.error}</div></div>;
  if (!lot) return <div className="dashboard-view ydp-dashboard"><div className="ydp-empty"><span className="ydp-empty-icon"><Sprout size={24} /></span><p className="ydp-eyebrow">ÁREA DE RENDIMIENTO</p><h1>Elige una parcela para empezar</h1><p>Cuando selecciones un lote, verás su proyección de cosecha, las referencias provinciales y los factores que influyen en el resultado.</p><button type="button" onClick={() => onNavigate?.('cultivos')}>Ir a mis parcelas <ArrowUpRight size={16} /></button></div></div>;

  const yieldValue = simulation?.rendimiento_t_ha;
  const productionValue = simulation?.produccion_total_t;
  const areaValue = simulation?.area_simulada_ha;
  const hasPrediction = isYieldNumber(yieldValue);
  const chartPeriodData = history.rows.map((row) => ({
    province: row.record?.rendimiento_t_ha ?? null,
    national: sipa.periodos.find((item) => item.año === row.year)?.nacional?.rendimiento_t_ha ?? null,
  }));
  const classColors = classScores.map(([name]) => /muy baja/i.test(name) ? colors.sky : /baja/i.test(name) ? colors.risk : /alta/i.test(name) ? colors.leaf : colors.maize);

  return <div className="dashboard-view ydp-dashboard">
    <header className="ydp-page-header">
      <div>
        <span className="ydp-eyebrow">DECISIONES · RENDIMIENTO</span>
        <h1>{lot.nombre_parcela || 'Rendimiento de la parcela'}</h1>
        <p className="ydp-location"><MapPin size={15} aria-hidden="true" />{lot.ubicacion || province || 'Ubicación registrada'}{lot.variedad_maiz && <span>{lot.variedad_maiz}</span>}</p>
      </div>
      <button className="ydp-primary-action" type="button" onClick={() => onNavigate?.('simular')}><Play size={15} fill="currentColor" />Nueva simulación</button>
    </header>

    {!hasPrediction ? <section className="ydp-prediction-empty">
      <div><span className="ydp-eyebrow">PROYECCIÓN DEL MODELO</span><h2>Aún no hay una simulación para esta parcela</h2><p>Los indicadores de cosecha aparecerán aquí cuando ejecutes una simulación de rendimiento.</p></div>
      <button type="button" onClick={() => onNavigate?.('simular')}>Ejecutar simulación <ArrowUpRight size={16} /></button>
    </section> : <>
      <section className="ydp-metrics" aria-label="Indicadores principales de rendimiento">
        <MetricCard label="Rendimiento" value={number(yieldValue)} unit="t/ha" detail={`Estimación · ${shortDate(simulation.fecha)}`} icon={Wheat} feature />
        <MetricCard label="Producción" value={number(productionValue)} unit="t" detail="Cosecha estimada para tu superficie" icon={BarChart3} />
        <MetricCard label="Rango orientativo" value={simulation.intervalo_rendimiento ? `${number(simulation.intervalo_rendimiento.min)}–${number(simulation.intervalo_rendimiento.max)}` : '—'} unit="t/ha" detail="Rango aproximado; no garantiza la cosecha" icon={Activity} />
        <MetricCard label="Superficie y escala" value={number(areaValue)} unit="ha" detail="Área utilizada en el cálculo" icon={MapPin} />
      </section>
    </>}



    <section className="ydp-record-link">
      <div><strong>Registro de campo</strong><p>{Object.keys(data?.mediciones_campo?.indicadores ?? {}).length ? 'Consulta o actualiza las mediciones que registraste para esta parcela.' : '¿Tienes mediciones de tu parcela? Agrégalas en Registro de campo.'}</p></div>
      {Object.keys(data?.mediciones_campo?.indicadores ?? {}).length > 0 && <div className="ydp-record-summary">{[["indice_cosecha", "Índice de cosecha"], ["agua_medida", "Capacidad de agua"], ["etapa_observada", "Etapa"], ["incidencia_plaga", "Plantas afectadas"]].filter(([name]) => data.mediciones_campo.indicadores[name]).map(([name, label]) => { const item = data.mediciones_campo.indicadores[name]; return <span key={name}>{label}: <strong>{typeof item.valor === 'number' ? number(item.valor) : item.valor}{item.unidad ? ` ${item.unidad}` : ''}</strong></span>; })}</div>}
      <div className="ydp-record-actions">
        <button type="button" onClick={() => (onAbrirRegistroCampo ? onAbrirRegistroCampo() : onNavigate?.('cultivos', 'registro'))}>{Object.keys(data?.mediciones_campo?.indicadores ?? {}).length ? 'Ver o actualizar mediciones' : 'Agregar mediciones'} <ArrowUpRight size={16} aria-hidden="true" /></button>
        <button type="button" className="ydp-ref-summary" onClick={() => { const d = document.getElementById('ydp-ref-details'); if (d) d.open = !d.open; setRefAbierto(v => !v); }} aria-controls="ydp-ref-details" aria-expanded={refAbierto}>Consultar referencias de la zona <Plus size={16} aria-hidden="true" /></button>
      </div>
    </section>
    <details className="ydp-reference-details" id="ydp-ref-details"><summary>Consultar referencias de la zona</summary><Panel title="Referencias de contexto" subtitle="Información de fuentes externas para interpretar la parcela" icon={Activity}>
      <p className="ydp-chart-note">Son referencias o estimaciones de contexto, no mediciones de tu parcela ni resultados de tu simulación.</p>
      {!(references.potencial_zonal || references.alcanzable_zonal || references.maximo_ensayo_variedad || references.lluvia_historica_inamhi || data?.kpis?.radiacion_par_estimado != null) && <p className="ydp-chart-note">No hay referencias disponibles para esta parcela en este momento. Si aún no tienes una simulación, ejecuta una para consultar las fuentes disponibles.</p>}
      <div className="ydp-measured-results">
        {[["Potencial zonal", references.potencial_zonal], ["Rendimiento zonal alcanzable", references.alcanzable_zonal], ["Máximo de ensayo de la variedad", references.maximo_ensayo_variedad]].filter(([, item]) => item).map(([label, item]) => <div key={label}><strong>{label}</strong><span>{number(item.valor)} {item.unidad}</span><small>{item.fuente} {item.periodo ? `· ${item.periodo}` : ''}</small>{item.nota && <small>{item.nota}</small>}{item.url && <a href={item.url} target="_blank" rel="noreferrer">Consultar fuente</a>}</div>)}
        {references.lluvia_historica_inamhi && <div><strong>Lluvia histórica INAMHI</strong><span>Estación {references.lluvia_historica_inamhi.estacion}</span><small>Periodo {references.lluvia_historica_inamhi.periodo} · distancia {number(references.lluvia_historica_inamhi.distancia_km, 1)} km · {references.lluvia_historica_inamhi.años_con_12_meses} años completos.</small><small>{references.lluvia_historica_inamhi.nota}</small></div>}
        {data?.kpis?.radiacion_par_estimado != null && <div><strong>Radiación PAR estimada reciente</strong><span>{number(data.kpis.radiacion_par_estimado, 1)} mol/m²/día</span><small>Estimación a partir de radiación solar reciente de Open-Meteo; no es una medición directa.</small></div>}
      </div>
    </Panel></details>

    <div className="ydp-chart-grid">


      {scenarioRows.length > 1 && <Panel title="¿Cuánto producirías en cada escenario?" subtitle="Compara tu simulación con otras condiciones climáticas" icon={Sprout} action={<div className="ydp-segmented" aria-label="Medida del gráfico">{[['yield', 't/ha'], ['production', 'Toneladas']].map(([value, label]) => <button key={value} type="button" aria-pressed={scenarioUnit === value} onClick={() => setScenarioUnit(value)}>{label}</button>)}</div>}>
        <p className="ydp-chart-note">Son alternativas con condiciones fijas, no pronósticos meteorológicos ni límites optimista/pesimista. Las demás entradas permanecen iguales.</p>
        <div className="ydp-chart" style={{ height: Math.max(150, scenarioRows.length * 44 + 45) }}><Bar plugins={[barValueLabels]} data={{ labels: scenarioRows.map((row) => row.label), datasets: [{ label: scenarioAxisUnit, data: scenarioRows.map(scenarioValue), backgroundColor: scenarioRows.map((row) => row.key === 'base' ? colors.primary : row.key === 'lluvioso' ? colors.sky : row.key === 'verano' ? colors.maize : colors.risk), borderColor: colors.border, borderWidth: scenarioRows.map((row) => row.key === selectedScenario?.key ? 1.5 : 0), borderRadius: 3, maxBarThickness: 32 }] }} options={{ ...chartInteraction, onClick: (_event, elements) => { if (elements.length) setScenarioKey(scenarioRows[elements[0].index].key); }, indexAxis: 'y', scales: { x: { ...chartInteraction.scales.y, title: { display: true, text: scenarioAxisUnit, color: colors.muted, font: { size: 10, weight: '600' } } }, y: { ...chartInteraction.scales.x, ticks: { ...chartInteraction.scales.x.ticks, autoSkip: false } } }, plugins: { ...chartInteraction.plugins, tooltip: { ...chartInteraction.plugins.tooltip, callbacks: { label: (item) => `${number(item.parsed.x)} ${scenarioAxisUnit}` } } } }} role="img" aria-label="Rendimiento estimado en los escenarios climáticos guardados de esta simulación" /></div>
        <div className="ydp-scenario-buttons" aria-label="Consultar escenario">{scenarioRows.map((row) => <button key={row.key} type="button" aria-pressed={selectedScenario?.key === row.key} onClick={() => setScenarioKey(row.key)}>{row.label}</button>)}</div>
        {selectedScenario && <div className="ydp-scenario-result" aria-live="polite"><strong>{selectedScenario.label}</strong><span>{number(selectedScenario.rendimiento_t_ha)} t/ha · {number(selectedScenario.produccion_total_t ?? (isYieldNumber(areaValue) ? selectedScenario.rendimiento_t_ha * areaValue : null))} t</span><p>{selectedScenario.key === 'base' ? 'Condiciones de tu simulación.' : Object.entries(selectedScenario.condiciones ?? {}).map(([name, value]) => `${({ precipitacion_mm_ciclo: 'Lluvia del ciclo (mm)', precipitacion_mm_año: 'Lluvia anual legacy (mm)', humedad_pct: 'Humedad (%)', temperatura_c: 'Temperatura (°C)' })[name] ?? name}: ${value}`).join(' · ') || 'Condiciones no guardadas.'}</p></div>}

      </Panel>}

      {contributionRows.length > 0 && <Panel title="Qué influyó en la estimación" subtitle="Aportes del modelo · SHAP" icon={Activity} action={<button className="ydp-chart-control" type="button" aria-pressed={showAllFactors} onClick={() => setShowAllFactors((value) => !value)}>{showAllFactors ? 'Ver principales' : 'Ver todos'}</button>}>
        <p className="ydp-chart-note">{!simulation.explicacion_modelo && 'Explicación antigua parcial: solo incluye seis variables. '}Valores positivos elevan la estimación del modelo y negativos la reducen; no prueban causalidad agronómica.</p>
        <div className="ydp-chart" style={{ height: Math.max(200, contributionRows.length * 32 + 35) }}><Bar plugins={[barValueLabels]} data={{ labels: contributionRows.map((row) => row.name), datasets: [{ label: 'Aporte al rendimiento (t/ha)', data: contributionRows.map((row) => row.value), backgroundColor: contributionRows.map((row) => row.value >= 0 ? colors.leaf : colors.risk), borderRadius: 3, maxBarThickness: 24 }] }} options={{ ...chartInteraction, indexAxis: 'y', scales: { x: { ...chartInteraction.scales.y, beginAtZero: false, min: -shapExtent, max: shapExtent, ticks: { ...chartInteraction.scales.y.ticks, stepSize: shapExtent / 4 }, title: { display: true, text: 'Aporte SHAP (t/ha) · escala simétrica', color: colors.muted, font: { size: 10, weight: '600' } } }, y: { ...chartInteraction.scales.x, ticks: { ...chartInteraction.scales.x.ticks, autoSkip: false } } }, plugins: { ...chartInteraction.plugins, tooltip: { ...chartInteraction.plugins.tooltip, callbacks: { label: (item) => `${item.parsed.x > 0 ? '+' : ''}${number(item.parsed.x)} t/ha` } } } }} role="img" aria-label="Aportes SHAP positivos y negativos a la estimación de rendimiento; escala simétrica centrada en cero" /></div>
        <Legend items={[{ label: 'Aporte positivo', color: colors.leaf }, { label: 'Aporte negativo', color: colors.risk }]} />
      </Panel>}

      {classScores.length > 0 && <Panel title="¿Cómo clasifica el modelo tu rendimiento?" subtitle="Mayor puntaje significa mayor afinidad con esa categoría" icon={Activity}>
        <p className="ydp-chart-note">Estos puntajes no son probabilidades físicas de cosecha.</p>
        <div className="ydp-chart" style={{ height: Math.max(135, classScores.length * 42 + 45) }}><Bar plugins={[barValueLabels]} data={{ labels: classScores.map(([name]) => name), datasets: [{ label: 'Puntaje (%)', data: classScores.map(([, value]) => value), backgroundColor: classColors, borderRadius: 3, maxBarThickness: 26 }] }} options={{ ...chartInteraction, indexAxis: 'y', scales: { x: { ...chartInteraction.scales.y, max: 100, ticks: { ...chartInteraction.scales.y.ticks, callback: (value) => `${value}%` }, title: { display: true, text: 'Puntaje (%)', color: colors.muted, font: { size: 10, weight: '600' } } }, y: { ...chartInteraction.scales.x, ticks: { ...chartInteraction.scales.x.ticks, autoSkip: false } } }, plugins: { ...chartInteraction.plugins, tooltip: { ...chartInteraction.plugins.tooltip, callbacks: { label: (item) => `${number(item.parsed.x, 1)}%` } } } }} role="img" aria-label="Puntajes del clasificador por categoría de rendimiento" /></div>
      </Panel>}

      {runs.length > 1 && <Panel title="Simulaciones guardadas de esta parcela" subtitle="Predicciones anteriores del sistema, no cosechas reales" icon={BarChart3}>
        <p className="ydp-chart-note">Estos registros proceden del historial de simulaciones de tu cuenta para este lote. La fecha indica cuándo se ejecutó el cálculo. Pulsa una barra para consultar sus indicadores.</p>
        <div className="ydp-run-bars">{runs.map((item) => <button key={item.id} type="button" className="ydp-run-bar" aria-pressed={item.id === simulation?.id} onClick={() => setSelection({ lot: key, id: String(item.id) })}>
          <span className="ydp-run-label"><span>#{item.id} · {shortDate(item.fecha)}</span><strong>{number(item.rendimiento_t_ha)} <small>t/ha</small></strong></span>
          <span className="ydp-run-track" aria-hidden="true"><span style={{ width: `${Math.max(0, item.rendimiento_t_ha) / Math.max(0.1, ...runs.map((row) => row.rendimiento_t_ha)) * 100}%` }} /></span>
          <span className="ydp-run-detail">{isYieldNumber(item.produccion_total_t) ? `${number(item.produccion_total_t)} t estimadas` : 'Producción no registrada'}{isYieldNumber(item.area_simulada_ha) ? ` · ${number(item.area_simulada_ha)} ha` : ''}{item.id === simulation?.id ? ' · Consultando' : ''}</span>
        </button>)}</div>
      </Panel>}

    </div>
    {simulation && comparison && <Panel title="Comparar simulaciones" subtitle={`Consultando la simulación #${simulation.id}. Elige con cuál compararla.`} icon={BarChart3} action={<label className="ydp-year-select">Comparar con<select value={comparison.id} onChange={(event) => {
      const id = event.target.value;
      if (id === String(simulation.id)) setSelection({ lot: key, id: String(comparison.id) });
      setComparisonId(id);
    }}>{simulations.map((item) => <option key={item.id} value={item.id}>#{item.id} · {shortDate(item.fecha)}{item.id === simulation.id ? ' · actual (intercambiar)' : ''}</option>)}</select></label>}>
      <p className="ydp-chart-note">La simulación actual también aparece en la lista. Si la eliges, se intercambian las columnas para que puedas revisar ambas.</p>
      <div className="ydp-table-scroll"><table><thead><tr><th>Dato</th><th>Seleccionada · #{simulation.id}</th><th>Comparación · #{comparison.id}</th></tr></thead><tbody>
      {[['Rendimiento (t/ha)', simulation.rendimiento_t_ha, comparison.rendimiento_t_ha], ['Producción (t)', simulation.produccion_total_t, comparison.produccion_total_t], ['Área (ha)', simulation.area_simulada_ha, comparison.area_simulada_ha], ...Object.keys(simulation.entradas ?? {}).map((name) => [name.replaceAll('_', ' '), simulation.entradas[name], comparison.entradas?.[name]])].map(([label, a, b]) => <tr key={label}><th scope="row">{label}</th><td>{isYieldNumber(a) ? number(a) : a ?? '—'}</td><td>{isYieldNumber(b) ? number(b) : b ?? '—'}</td></tr>)}
      </tbody></table></div>
      <p className="ydp-chart-note">{simulation.area_simulada_ha !== comparison.area_simulada_ha ? 'Las superficies son distintas; compara t/ha antes de comparar toneladas. ' : ''}{!simulation.version_modelo || !comparison.version_modelo ? 'No se puede verificar que ambas ejecuciones usaron la misma versión del modelo.' : simulation.version_modelo !== comparison.version_modelo ? 'Las versiones del modelo son diferentes.' : 'Ambas ejecuciones usaron la misma versión del modelo.'} Las diferencias no demuestran un efecto causal de una sola variable.</p>
    </Panel>}
      {province && history.coverage > 0 && <Panel title={`Histórico de rendimiento · ${province}`} subtitle="Maíz duro seco · promedio provincial SIPA" icon={CalendarDays} className="ydp-panel--history" action={<label className="ydp-year-select">Año de referencia<select aria-label="Año de referencia provincial" value={year} onChange={(event) => setYear(Number(event.target.value))}>{historyYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}>
        <div className="ydp-reference-stats">
          <div><span>Provincia · {year}</span><strong>{number(history.selected?.rendimiento_t_ha)} <small>t/ha</small></strong></div>
          <div><span>Ecuador · {year}</span><strong>{number(period?.nacional?.rendimiento_t_ha)} <small>t/ha</small></strong></div>
          <div><span>Serie SIPA</span><strong>{history.coverage} <small>años publicados</small></strong></div>
        </div>
        <p className="ydp-chart-note">Referencia regional de maíz duro seco; no es una medición ni una predicción de esta parcela y puede no corresponder al tipo de maíz registrado.</p>
        <div className="ydp-history-layout"><div className="ydp-chart ydp-chart--history"><Line data={{
          labels: history.rows.map((row) => row.year),
          datasets: [
            { label: province, data: chartPeriodData.map((row) => row.province), borderColor: colors.maize, backgroundColor: `${colors.maize}20`, tension: 0.28, fill: true, borderWidth: 3, pointRadius: history.rows.map((row) => row.year === year ? 6 : 3), pointHoverRadius: 8, pointBackgroundColor: colors.maize, pointHoverBorderWidth: 2, pointHoverBorderColor: colors.text, spanGaps: false },
            { label: 'Ecuador', data: chartPeriodData.map((row) => row.national), borderColor: colors.leaf, backgroundColor: colors.leaf, borderDash: [5, 5], tension: 0.25, fill: false, borderWidth: 2, pointRadius: 2, pointHoverRadius: 6, spanGaps: false },
          ],
        }} options={{ ...chartInteraction, onClick: (_event, elements) => { if (elements.length) setYear(history.rows[elements[0].index].year); }, plugins: { ...chartInteraction.plugins, legend: { display: true, position: 'bottom', labels: { color: colors.text, usePointStyle: true, padding: 18 } }, tooltip: { ...chartInteraction.plugins.tooltip, callbacks: { label: (item) => `${item.dataset.label}: ${number(item.parsed.y)} t/ha` } } } }} role="img" aria-label={`Rendimiento promedio anual provincial de ${province} frente a Ecuador entre 2020 y 2025`} /></div><EcuadorProvinceMap province={province} /></div>
      </Panel>}
    {(!province || history.coverage === 0) && <section className="ydp-region-empty"><MapPin size={18} /><div><strong>Referencia provincial no disponible</strong><p>No se pudo asociar la ubicación de esta parcela con una provincia incluida en la serie SIPA.</p></div></section>}


  </div>;
}
