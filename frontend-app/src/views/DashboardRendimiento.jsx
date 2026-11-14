import AnnualRainReference from '../components/AnnualRainReference';
import { comparisonAnnualRain } from '../utils/annualRain';
import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, CalendarDays, MapPin, Play, Plus, Sprout, Wheat } from 'lucide-react';
import { dssService } from '../services/api';
import { getDashboardChartColors } from '../utils/chartConfig';
import { escapeChartText, validarRespuestaRendimiento, isYieldNumber, provinceFromLocation, regionalHistory, simulationHistory, yieldAnalysis } from '../utils/yieldDashboard';
import sipa from '../data/sipa-maiz-duro-2020-2025.json';
import ecuadorProvincias from '../data/ecuador-provincias.json';
import EChart from '../components/EChart';
import ReferenciasMaiz from '../components/ReferenciasMaiz';
import { DashboardMetric as MetricCard, DashboardPanel as Panel } from '../templates/Common/DashboardPrimitives';
import useExplicacionIA from '../hooks/usarExplicacionIA';
import SimulationInfoCard from '../templates/Common/SimulationInfoCard';

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
const inputLabels = {
  temperatura_c: 'Temperatura media (°C)',
  humedad_pct: 'Humedad relativa (%)',
  precipitacion_mm_año: 'Lluvia anual ingresada al cálculo (mm/año)',
  precipitacion_mm_ciclo: 'Lluvia del ciclo (mm/ciclo)',
  precipitacion_mm: 'Lluvia registrada (mm)',
  periodo_precipitacion: 'Periodo de la lluvia registrada',
  fertilizante_kg_ha: 'Fertilización registrada (kg/ha)',
  ph_suelo: 'pH del suelo',
  tipo_suelo: 'Textura del suelo',
};

function useYieldChartColors() {
  const [light, setLight] = useState(() => document.body.classList.contains('light-theme'));
  useEffect(() => {
    const observer = new MutationObserver(() => setLight(document.body.classList.contains('light-theme')));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return getDashboardChartColors(light);
}

function Legend({ items }) {
  return <div className="ydp-legend" role="group" aria-label="Leyenda del gráfico">
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
    <span className="ydp-map-caption">Esquema provincial de ubicación</span>
  </figure>;
}

const scenarioNames = { lluvioso: 'Lluvioso', verano: 'Verano', sequia: 'Sequía' };

export default function DashboardRendimiento({ cultivoElegidoId, onNavigate, onDashboardData, onAbrirRegistroCampo, revisionMediciones = 0 }) {
  const [response, setResponse] = useState(null);
  const [recarga, setRecarga] = useState(0);
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
  const { mostrarModalIa, setMostrarModalIa, cargandoIa, datosIa, pedirExplicacionIa } = useExplicacionIA(cultivoElegidoId, null, simulation?.id);
  const comparison = simulations.find((item) => String(item.id) === comparisonId && item.id !== simulation?.id) ?? simulations.find((item) => item.id !== simulation?.id);
  const esMaizDuro = lot?.tipo_maiz === 'Duro Amarillo';
  const references = useMemo(() => data?.referencias_publicas ?? {}, [data?.referencias_publicas]);
  const locationKey = `${key}:${lot?.latitud}:${lot?.longitud}`;
  const provinciaResuelta = Object.hasOwn(lot ?? {}, 'provincia');
  const provinceInLot = provinciaResuelta ? provinceFromLocation(lot.provincia) : provinceFromLocation(lot?.ubicacion);
  const province = provinceInLot ?? (geocoded?.key === locationKey ? geocoded.province : null);
  const history = useMemo(() => regionalHistory(sipa.periodos, province, year), [province, year]);
  const period = sipa.periodos.find((item) => item.año === year);
  const analysis = yieldAnalysis(simulation, data?.kpis);
  const runs = simulationHistory(simulations, simulation, 12).filter((item) => isYieldNumber(item.rendimiento_t_ha));

  useEffect(() => {
    let active = true;
    dssService.getRendimientoData(cultivoElegidoId, null)
      .then((result) => { const valid = validarRespuestaRendimiento(result, cultivoElegidoId); if (active) setResponse({ key, data: valid }); })
      .catch(() => { if (active) setResponse({ key, error: 'No se pudieron cargar los datos de rendimiento. Vuelve a intentarlo.' }); });
    return () => { active = false; };
  }, [key, cultivoElegidoId, recarga, revisionMediciones]);

  useEffect(() => {
    if (provinciaResuelta || provinceInLot || !lot || lot.latitud == null || lot.longitud == null || lot.latitud === '' || lot.longitud === '') return undefined;
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
  }, [locationKey, lot, provinciaResuelta, provinceInLot]);

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
      referencia_sipa: esMaizDuro ? {
        cultivo: sipa.cultivo,
        fuente: sipa.fuente_pagina,
        año_visible: year,
        territorio_visible: province,
        provincia: history.selected,
        nota: 'Datos provinciales de maíz duro seco; son referencia regional y no cosechas medidas de esta parcela.',
      } : null,
    });
  }, [current, data, esMaizDuro, history.selected, lot, onDashboardData, province, references, simulation, simulations.length, year]);

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
  const scenarioAxisUnit = scenarioUnit === 'yield' ? 't/ha' : 't';
  const shapExtent = Math.ceil(Math.max(0.1, ...contributionRows.map((row) => Math.abs(row.value))) * 10) / 10;
  const historyYears = sipa.periodos.map((item) => item.año);


  if (!current) return <div className="dashboard-view ydp-dashboard"><div className="ydp-state" role="status"><span className="ydp-loader" />Cargando rendimiento de la parcela…</div></div>;
  if (current.error) return <div className="dashboard-view ydp-dashboard"><h1>Rendimiento</h1><div className="ydp-state ydp-state--error" role="alert">{current.error}</div><button type="button" className="ydp-primary-action" onClick={() => { setResponse(null); setRecarga(value => value + 1); }}>Reintentar rendimiento</button></div>;
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
  const yieldUnit = 't/ha significa toneladas por cada hectárea. Es distinto de las toneladas totales de tu parcela.';
  const simulationLimit = simulation ? `Corresponde a la simulación #${simulation.id}, calculada el ${shortDate(simulation.fecha)}. Es una estimación del sistema, no una cosecha medida ni una garantía.` : 'No hay una simulación disponible.';
  const scenarioChartContext = { labels: scenarioRows.map(row=>row.label), datasets: [{ label: scenarioUnit==='yield'?'Rendimiento (t/ha)':'Producción (t)', data: scenarioRows.map(row=>scenarioUnit==='yield'?row.rendimiento_t_ha:row.produccion_total_t ?? (isYieldNumber(areaValue)?row.rendimiento_t_ha*areaValue:null)) }] };
  const comparisonChartContext = simulation && comparison ? { labels:[`#${simulation.id}`,`#${comparison.id}`], datasets:[
    {label:'Rendimiento (t/ha)',data:[simulation.rendimiento_t_ha,comparison.rendimiento_t_ha]},
    {label:'Producción (t)',data:[simulation.produccion_total_t??null,comparison.produccion_total_t??null]},
    {label:'Superficie (ha)',data:[simulation.area_simulada_ha??null,comparison.area_simulada_ha??null]},
  ] } : null;
  const historyChartContext = {labels:history.rows.map(row=>row.year),datasets:[{label:`${province} (t/ha)`,data:chartPeriodData.map(row=>row.province)},{label:'Ecuador (t/ha)',data:chartPeriodData.map(row=>row.national)}]};
  const explain = (nombre, valor, unidad, resumen, lectura, limite = simulationLimit, datos_grafico) => pedirExplicacionIa({
    tipo_elemento: datos_grafico === undefined ? 'tarjeta' : 'grafico', nombre, valor: valor ?? null, unidad,
    descripcion_tecnica: resumen, datos_grafico, estado: valor == null && datos_grafico === undefined ? 'sin_datos' : 'descriptivo',
    guia_lectura: { resumen, lectura, limite },
  });

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
        <MetricCard label="Rendimiento" value={number(yieldValue)} unit="t/ha" detail={`Estimación · ${shortDate(simulation.fecha)}`} icon={Wheat} feature onExplain={()=>explain('Rendimiento',yieldValue,'t/ha','Es la cantidad de cosecha que el modelo estima por cada hectárea.',[yieldUnit,`Estás consultando la ejecución #${simulation.id}. El valor cambia si eliges otra simulación guardada.`])} />
        <MetricCard label="Producción" value={number(productionValue)} unit="t" detail="Cosecha estimada para tu superficie" icon={BarChart3} onExplain={()=>explain('Producción',productionValue,'t',isYieldNumber(productionValue)?'Es la cosecha total estimada para la superficie usada en esta simulación.':'No se conservó una producción total para esta ejecución.',['t significa toneladas. Una tonelada equivale a 1.000 kilogramos.',`Superficie del cálculo: ${number(areaValue)} ha. Rendimiento guardado: ${number(yieldValue)} t/ha.`])} />
        <MetricCard label="Rango orientativo" value={simulation.intervalo_rendimiento ? `${number(simulation.intervalo_rendimiento.min)}–${number(simulation.intervalo_rendimiento.max)}` : '—'} unit="t/ha" detail="Rango aproximado; no garantiza la cosecha" icon={Activity} onExplain={()=>explain('Rango orientativo',simulation.intervalo_rendimiento?`${number(simulation.intervalo_rendimiento.min)}–${number(simulation.intervalo_rendimiento.max)}`:null,'t/ha',simulation.intervalo_rendimiento?'Muestra los dos extremos del rango orientativo conservado con esta simulación.':'No hay un rango orientativo conservado para esta simulación.',[yieldUnit,'El extremo inferior y el superior ayudan a leer la amplitud de la estimación. No garantizan que la cosecha vaya a quedar dentro de esos valores.'])} />
        <MetricCard label="Superficie y escala" value={number(areaValue)} unit="ha" detail="Área utilizada en el cálculo" icon={MapPin} onExplain={()=>explain('Superficie y escala',areaValue,'ha',isYieldNumber(areaValue)?'Es el área usada para calcular la producción de esta simulación.':'No se conservó el área utilizada en esta ejecución.',['ha significa hectáreas. Una hectárea equivale a 10.000 metros cuadrados.','Puede ser diferente del área total de la parcela si simulaste sólo una parte.'])} />
      </section>
    </>}



    <section className="ydp-record-link">
      <div><strong>Registro de campo</strong><p>{Object.keys(data?.mediciones_campo?.indicadores ?? {}).length ? 'Consulta o actualiza las mediciones que registraste para esta parcela.' : '¿Tienes mediciones de tu parcela? Agrégalas en Registro de campo.'}</p></div>
      {Object.keys(data?.mediciones_campo?.indicadores ?? {}).length > 0 && <div className="ydp-record-summary">{[["indice_cosecha", "Índice de cosecha"], ["agua_medida", "Capacidad de agua"], ["etapa_observada", "Etapa"], ["incidencia_plaga", "Plantas afectadas"]].filter(([name]) => data.mediciones_campo.indicadores[name]).map(([name, label]) => { const item = data.mediciones_campo.indicadores[name]; return <span key={name}>{label}: <strong>{typeof item.valor === 'number' ? number(item.valor) : item.valor}{item.unidad ? ` ${item.unidad}` : ''}</strong></span>; })}</div>}
      <div className="ydp-record-actions">
        <button type="button" onClick={() => (onAbrirRegistroCampo ? onAbrirRegistroCampo() : onNavigate?.('cultivos', 'registro'))}>{Object.keys(data?.mediciones_campo?.indicadores ?? {}).length ? 'Ver o actualizar mediciones' : 'Agregar mediciones'} <ArrowUpRight size={16} aria-hidden="true" /></button>
        <button type="button" className="ydp-ref-summary" onClick={() => setRefAbierto(v => !v)} aria-controls="ydp-ref-details" aria-expanded={refAbierto}>Consultar referencias de la zona <Plus size={16} aria-hidden="true" /></button>
      </div>
    </section>
    <section className="ydp-reference-details" id="ydp-ref-details" hidden={!refAbierto}><ReferenciasMaiz provincia={province} /><Panel title="Referencias de contexto" subtitle="Información de fuentes externas para interpretar la parcela" icon={Activity}>
      <p className="ydp-chart-note">Son referencias o estimaciones de contexto, no mediciones de tu parcela ni resultados de tu simulación.</p>
      {!(references.potencial_zonal || references.alcanzable_zonal || references.maximo_ensayo_variedad || references.lluvia_historica_inamhi || data?.kpis?.radiacion_par_estimado != null) && <p className="ydp-chart-note">No hay referencias disponibles para esta parcela en este momento. Si aún no tienes una simulación, ejecuta una para consultar las fuentes disponibles.</p>}
      <div className="ydp-measured-results">
        {[["Potencial zonal", references.potencial_zonal], ["Rendimiento zonal alcanzable", references.alcanzable_zonal], ["Máximo de ensayo de la variedad", references.maximo_ensayo_variedad]].filter(([, item]) => item).map(([label, item]) => <div key={label}><strong>{label}</strong><span>{number(item.valor)} {item.unidad}</span><small>{item.fuente} {item.periodo ? `· ${item.periodo}` : ''}</small>{item.nota && <small>{item.nota}</small>}{item.url && <a href={item.url} target="_blank" rel="noreferrer">Consultar fuente</a>}</div>)}
        {references.lluvia_historica_inamhi && <div><strong>Lluvia histórica INAMHI</strong><span>Estación {references.lluvia_historica_inamhi.estacion}</span><small>Periodo {references.lluvia_historica_inamhi.periodo} · distancia {number(references.lluvia_historica_inamhi.distancia_km, 1)} km · {references.lluvia_historica_inamhi.años_con_12_meses} años completos.</small><small>{references.lluvia_historica_inamhi.nota}</small></div>}
        {data?.kpis?.radiacion_par_estimado != null && <div><strong>Radiación PAR estimada reciente</strong><span>{number(data.kpis.radiacion_par_estimado, 1)} mol/m²/día</span><small>Estimación a partir de radiación solar reciente de Open-Meteo; no es una medición directa.</small></div>}
      </div>
    </Panel></section>

    <div className="ydp-chart-grid">


      {scenarioRows.length > 1 && <Panel title="¿Cuánto producirías en cada escenario?" subtitle="Compara tu simulación con otras condiciones climáticas" icon={Sprout} onExplain={()=>explain('Comparación de escenarios climáticos',null,'','Compara tu simulación con alternativas que cambian condiciones climáticas y mantienen las demás entradas.',[scenarioUnit==='yield'?yieldUnit:'Ahora se muestran toneladas totales para la superficie de la simulación.','Una barra más larga representa un resultado estimado mayor. Usa los controles para cambiar las unidades o consultar un escenario.'],'Son escenarios con condiciones fijas; no son pronósticos del tiempo ni probabilidades de que ocurra cada clima.',scenarioChartContext)} action={<div className="ydp-segmented" role="group" aria-label="Medida del gráfico">{[['yield', 't/ha'], ['production', 'Toneladas']].map(([value, label]) => <button key={value} type="button" aria-pressed={scenarioUnit === value} onClick={() => setScenarioUnit(value)}>{label}</button>)}</div>}>
        <p className="ydp-chart-note">Son alternativas con condiciones fijas, no pronósticos meteorológicos ni límites optimista/pesimista. Las demás entradas permanecen iguales.</p>
        <div className="ydp-chart" style={{ height: Math.max(170, scenarioRows.length * 52 + 44) }}>
          <EChart
            ariaLabel="Comparación del rendimiento estimado en distintos escenarios climáticos"
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: colors.grid } }, backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, borderWidth: 1, padding: [10, 12], textStyle: { color: colors.text, fontSize: 12 }, formatter: (params) => { const item = params[0]; const row = scenarioRows[item.dataIndex]; const total = row.produccion_total_t ?? (isYieldNumber(areaValue) ? row.rendimiento_t_ha * areaValue : null); return `<strong>${escapeChartText(item.name)}</strong><br/>Rendimiento: <b>${number(row.rendimiento_t_ha)} t/ha</b><br/>Producción: <b>${number(total)} t</b>`; } },
              grid: { left: 8, right: 64, top: 6, bottom: 34, containLabel: true },
              xAxis: { type: 'value', boundaryGap: [0, 0.12], axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } }, axisLabel: { color: colors.muted, fontSize: 11 } },
              yAxis: { type: 'category', inverse: true, data: scenarioRows.map((row) => row.label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: colors.text, fontWeight: 600, fontSize: 12, margin: 14, width: 130, align: 'right' } },
              series: [{
                type: 'bar',
                data: scenarioRows.map((row) => ({
                  value: scenarioUnit === 'yield' ? row.rendimiento_t_ha : row.produccion_total_t ?? (isYieldNumber(areaValue) ? row.rendimiento_t_ha * areaValue : null),
                  itemStyle: {
                    color: row.key === 'base' ? colors.primary : row.key === 'lluvioso' ? colors.sky : row.key === 'verano' ? colors.maize : colors.risk,
                    borderRadius: [0, 6, 6, 0],
                    borderColor: selectedScenario?.key === row.key ? colors.text : 'transparent',
                    borderWidth: selectedScenario?.key === row.key ? 2 : 0,
                  },
                })),
                barWidth: 36,
                label: { show: true, position: 'right', distance: 10, color: colors.text, fontWeight: 650, fontSize: 12.5, formatter: (item) => `${number(item.value)} ${scenarioAxisUnit}` },
                emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.45)' } },
              }],
            }}
            onClick={(params) => setScenarioKey(scenarioRows[params.dataIndex]?.key)}
          />
        </div>
        <div className="ydp-scenario-buttons" role="group" aria-label="Consultar escenario">{scenarioRows.map((row) => <button key={row.key} type="button" aria-pressed={selectedScenario?.key === row.key} onClick={() => setScenarioKey(row.key)}>{row.label}</button>)}</div>
        {selectedScenario && <div className="ydp-scenario-result" aria-live="polite"><strong>{selectedScenario.label}</strong><span>{number(selectedScenario.rendimiento_t_ha)} t/ha · {number(selectedScenario.produccion_total_t ?? (isYieldNumber(areaValue) ? selectedScenario.rendimiento_t_ha * areaValue : null))} t</span><p>{selectedScenario.key === 'base' ? 'Condiciones de tu simulación.' : Object.entries(selectedScenario.condiciones ?? {}).map(([name, value]) => `${({ precipitacion_mm_ciclo: 'Lluvia del ciclo (mm)', precipitacion_mm_año: 'Lluvia anual legacy (mm)', humedad_pct: 'Humedad (%)', temperatura_c: 'Temperatura (°C)' })[name] ?? name}: ${value}`).join(' · ') || 'Condiciones no guardadas.'}</p></div>}

      </Panel>}

      {contributionRows.length > 0 && <Panel title="Qué influyó en la estimación" subtitle="Aportes del modelo · SHAP" icon={Activity} onExplain={()=>explain('Qué influyó en la estimación',null,'','Muestra cuánto empujó cada variable el resultado del modelo hacia arriba o hacia abajo.',['Las barras positivas aumentan la estimación del modelo; las negativas la reducen.','Una barra más larga indica un aporte mayor dentro de este cálculo. «Otros factores» agrupa las variables que no se muestran por separado.'],'SHAP explica el cálculo del modelo. No demuestra causas en el campo ni indica cuánto recuperarías al cambiar una sola variable.',contributionRows.map(row=>({nombre:row.name,valor:row.value})))} action={<button className="ydp-chart-control" type="button" aria-pressed={showAllFactors} onClick={() => setShowAllFactors((value) => !value)}>{showAllFactors ? 'Ver principales' : 'Ver todos'}</button>}>
        <p className="ydp-chart-note">{!simulation.explicacion_modelo && 'Explicación antigua parcial: solo incluye seis variables. '}Valores positivos elevan la estimación del modelo y negativos la reducen; no prueban causalidad agronómica.</p>
        <div className="ydp-chart ydp-factors-region" tabIndex={0} role="region" aria-label="Aportes del modelo, gráfico desplazable" style={{ height: Math.min(520, Math.max(220, contributionRows.length * 38 + 60)), overflowY: 'auto' }}>
          <EChart
            ariaLabel="Aportes de cada variable al rendimiento estimado por el modelo"
            style={{ height: Math.max(220, contributionRows.length * 38 + 60) }}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, borderWidth: 1, padding: [10, 12], textStyle: { color: colors.text, fontSize: 12 }, formatter: (params) => { const item = params[0]; return `<strong>${escapeChartText(item.name)}</strong><br/>Aporte: <b>${item.value > 0 ? '+' : ''}${number(item.value)} t/ha</b>`; } },
              grid: { left: 8, right: 74, top: 6, bottom: 38, containLabel: true },
              xAxis: { type: 'value', min: -shapExtent, max: shapExtent, splitNumber: 4, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } }, axisLabel: { color: colors.muted, fontSize: 11, formatter: (value) => (value > 0 ? '+' : '') + value } },
              yAxis: { type: 'category', inverse: true, data: contributionRows.map((row) => row.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: colors.text, fontWeight: 600, fontSize: 12, margin: 12, width: 120, overflow: 'break', lineHeight: 14, align: 'right' } },
              series: [{
                type: 'bar',
                data: contributionRows.map((row) => ({
                  value: row.value,
                  itemStyle: {
                    color: row.value >= 0 ? colors.leaf : colors.risk,
                    borderRadius: row.value >= 0 ? [0, 6, 6, 0] : [6, 0, 0, 6],
                  },
                  label: {
                    show: true,
                    position: row.value >= 0 ? 'right' : 'left',
                    distance: 8,
                    color: colors.text,
                    fontWeight: 650,
                    fontSize: 12,
                    formatter: () => `${row.value > 0 ? '+' : ''}${number(row.value)}`,
                  },
                })),
                barWidth: 24,
                emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.4)' } },
              }],
            }}
          />
        </div>
        <Legend items={[{ label: 'Aporte positivo', color: colors.leaf }, { label: 'Aporte negativo', color: colors.risk }]} />
      </Panel>}

      {classScores.length > 0 && <Panel title="¿Cómo clasifica el modelo tu rendimiento?" subtitle="Mayor puntaje significa mayor afinidad con esa categoría" icon={Activity} onExplain={()=>explain('Clasificación del rendimiento',null,'','Muestra cuánto se parece este resultado a cada categoría del clasificador.',['Un puntaje mayor indica más afinidad del modelo con esa categoría.','Los porcentajes son puntajes del clasificador, no porcentajes de cosecha que vas a obtener.'],'No son probabilidades físicas de éxito, pérdida o rendimiento real de tu cultivo.',classScores.map(([categoria,valor])=>({categoria,valor})))}>
        <p className="ydp-chart-note">Estos puntajes no son probabilidades físicas de cosecha.</p>
        <div className="ydp-chart" style={{ height: Math.max(145, classScores.length * 42 + 48) }}>
          <EChart
            ariaLabel="Puntajes del clasificador de rendimiento por categoría"
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, borderWidth: 1, padding: [10, 12], textStyle: { color: colors.text, fontSize: 12 }, formatter: (params) => { const item = params[0]; return `<strong>${escapeChartText(item.name)}</strong><br/>Puntaje: <b>${number(item.value, 1)} %</b>`; } },
              grid: { left: 8, right: 58, top: 6, bottom: 34, containLabel: true },
              xAxis: { type: 'value', min: 0, max: 100, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } }, axisLabel: { color: colors.muted, fontSize: 11, formatter: '{value}%' } },
              yAxis: { type: 'category', inverse: true, data: classScores.map(([name]) => name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: colors.text, fontWeight: 600, fontSize: 12, margin: 12, width: 130, overflow: 'break', lineHeight: 14, align: 'right' } },
              series: [{
                type: 'bar',
                data: classScores.map(([, value], index) => ({
                  value,
                  itemStyle: { color: classColors[index], borderRadius: [0, 5, 5, 0] },
                })),
                barWidth: 24,
                label: { show: true, position: 'right', distance: 8, color: colors.text, fontWeight: 690, fontSize: 12, formatter: (item) => `${number(item.value, 1)} %` },
                emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.4)' } },
              }],
            }}
          />
        </div>
      </Panel>}

      {runs.length > 1 && <Panel title="Simulaciones guardadas de esta parcela" subtitle="Predicciones anteriores del sistema, no cosechas reales" icon={BarChart3} onExplain={()=>explain('Simulaciones guardadas de esta parcela',runs.length,'ejecuciones','Permite revisar los resultados anteriores de esta misma parcela.',[yieldUnit,'Cada barra corresponde a una ejecución. La fecha indica cuándo se hizo el cálculo. Pulsa la barra para consultar sus indicadores.'],simulationLimit,runs.map(row=>({id:row.id,fecha:row.fecha,rendimiento:row.rendimiento_t_ha})))}>
        <p className="ydp-chart-note">Estos registros proceden del historial de simulaciones de tu cuenta para este lote. La fecha indica cuándo se ejecutó el cálculo. Pulsa una barra para consultar sus indicadores. Se muestran {runs.length} de {simulations.length} ejecuciones cargadas; Rendimiento consulta las 50 más recientes.</p>
        <div className="ydp-run-bars">{runs.map((item) => <button key={item.id} type="button" className="ydp-run-bar" aria-pressed={item.id === simulation?.id} onClick={() => setSelection({ lot: key, id: String(item.id) })}>
          <span className="ydp-run-label"><span>#{item.id} · {shortDate(item.fecha)}</span><strong>{number(item.rendimiento_t_ha)} <small>t/ha</small></strong></span>
          <span className="ydp-run-track" aria-hidden="true"><span style={{ width: `${Math.max(0, item.rendimiento_t_ha) / Math.max(0.1, ...runs.map((row) => row.rendimiento_t_ha)) * 100}%` }} /></span>
          <span className="ydp-run-detail">{isYieldNumber(item.produccion_total_t) ? `${number(item.produccion_total_t)} t estimadas` : 'Producción no registrada'}{isYieldNumber(item.area_simulada_ha) ? ` · ${number(item.area_simulada_ha)} ha` : ''}{item.id === simulation?.id ? ' · Consultando' : ''}</span>
        </button>)}</div>
      </Panel>}

    </div>
    {simulation && comparison && <Panel title="Comparar simulaciones" subtitle={`Consultando la simulación #${simulation.id}. Elige con cuál compararla.`} icon={BarChart3} onExplain={()=>explain('Comparar simulaciones',null,'',`Compara la ejecución #${simulation.id} con la #${comparison.id}.`,['Cada columna conserva el resultado y las entradas de su ejecución. Un guion significa que ese dato no quedó registrado.','Revisa primero las superficies, las entradas y las versiones del modelo antes de interpretar las diferencias.'],'Una diferencia de rendimiento no demuestra que una sola variable la haya causado.',comparisonChartContext)} action={<label className="ydp-year-select">Comparar con<select value={comparison.id} onChange={(event) => {
      const id = event.target.value;
      if (id === String(simulation.id)) setSelection({ lot: key, id: String(comparison.id) });
      setComparisonId(id);
    }}>{simulations.map((item) => <option key={item.id} value={item.id}>#{item.id} · {shortDate(item.fecha)}{item.id === simulation.id ? ' · actual (intercambiar)' : ''}</option>)}</select></label>}>
      <p className="ydp-chart-note">La simulación actual también aparece en la lista. Si la eliges, se intercambian las columnas para que puedas revisar ambas.</p>
      <div className="ydp-table-scroll" tabIndex={0} role="region" aria-label="Comparación de simulaciones, tabla desplazable"><table><thead><tr><th>Dato</th><th>Seleccionada · #{simulation.id}</th><th>Comparación · #{comparison.id}</th></tr></thead><tbody>
      {[['Rendimiento (t/ha)', simulation.rendimiento_t_ha, comparison.rendimiento_t_ha], ['Producción (t)', simulation.produccion_total_t, comparison.produccion_total_t], ['Área (ha)', simulation.area_simulada_ha, comparison.area_simulada_ha], ...[...new Set([...Object.keys(simulation.entradas ?? {}), ...Object.keys(comparison.entradas ?? {})])].filter(name => simulation.entradas?.[name] != null || comparison.entradas?.[name] != null).map((name) => [inputLabels[name] ?? name.replaceAll('_', ' '), simulation.entradas?.[name], comparison.entradas?.[name]])].map(([label, a, b]) => <tr key={label}><th scope="row">{label}</th><td>{isYieldNumber(a) ? number(a) : a ?? '—'}</td><td>{isYieldNumber(b) ? number(b) : b ?? '—'}</td></tr>)}
      <tr><th scope="row">Lluvia anual de referencia (mm/año)</th>{[simulation,comparison].map(run => {
        const item=comparisonAnnualRain(run,data?.lluvia_anual_referencia);
        return <td key={run.id}>{item ? <>{number(item.reference.valor)}<small className="ydp-rain-origin">{item.saved ? 'Referencia conservada con esta ejecución' : 'Referencia actual de la parcela'}</small></> : 'Sin referencia disponible'}</td>;
      })}</tr>
      </tbody></table></div>
      <p className="ydp-chart-note">La lluvia anual de referencia se obtiene por ubicación. Si no quedó conservada con la ejecución, se identifica como referencia actual y no se atribuye al cálculo anterior. La lluvia del ciclo permanece separada.</p>
      <AnnualRainReference reference={data?.lluvia_anual_referencia} />
      <p className="ydp-chart-note">{simulation.area_simulada_ha !== comparison.area_simulada_ha ? 'Las superficies son distintas; compara t/ha antes de comparar toneladas. ' : ''}{!simulation.version_modelo || !comparison.version_modelo ? 'No se puede verificar que ambas ejecuciones usaron la misma versión del modelo.' : simulation.version_modelo !== comparison.version_modelo ? 'Las versiones del modelo son diferentes.' : 'Ambas ejecuciones usaron la misma versión del modelo.'} Las diferencias no demuestran un efecto causal de una sola variable.</p>
    </Panel>}
      {esMaizDuro && province && history.coverage > 0 && <Panel title={`Histórico de rendimiento · ${province}`} subtitle="Maíz duro seco · promedio provincial SIPA" icon={CalendarDays} className="ydp-panel--history" onExplain={()=>explain(`Histórico de rendimiento · ${province}`,history.coverage,'años publicados','Compara promedios publicados de maíz duro seco de la provincia y de Ecuador.',[yieldUnit,'Cada punto corresponde a un año de la serie SIPA. Las líneas permiten ver cómo cambiaron los promedios regionales.'],'Es una referencia provincial, no una medición de esta parcela ni una predicción de su cosecha.',historyChartContext)} action={<label className="ydp-year-select">Año de referencia<select aria-label="Año de referencia provincial" value={year} onChange={(event) => setYear(Number(event.target.value))}>{historyYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}>
        <div className="ydp-reference-stats">
          <div><span>Provincia · {year}</span><strong>{number(history.selected?.rendimiento_t_ha)} <small>t/ha</small></strong></div>
          <div><span>Ecuador · {year}</span><strong>{number(period?.nacional?.rendimiento_t_ha)} <small>t/ha</small></strong></div>
          <div><span>Serie SIPA</span><strong>{history.coverage} <small>años publicados</small></strong></div>
        </div>
        <p className="ydp-chart-note">Referencia regional de maíz duro seco; no es una medición ni una predicción de esta parcela y puede no corresponder al tipo de maíz registrado.</p>
        <div className="ydp-history-layout"><div className="ydp-chart ydp-chart--history" style={{ height: 262 }}>
          <EChart
            ariaLabel={`Histórico de rendimiento de ${province} comparado con Ecuador`}
            option={{
              tooltip: { trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, borderWidth: 1, color: colors.text } }, backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, borderWidth: 1, padding: [10, 12], textStyle: { color: colors.text, fontSize: 12 }, formatter: (params) => params.map((item) => `${item.marker} <b>${item.seriesName}</b>: ${number(item.value)} t/ha`).join('<br/>') },
              legend: { bottom: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 6, textStyle: { color: colors.text, fontSize: 11 } },
              grid: { left: 4, right: 8, top: 10, bottom: 34, containLabel: true },
              xAxis: { type: 'category', boundaryGap: false, data: history.rows.map((row) => row.year), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: colors.muted } },
              yAxis: { type: 'value', name: 't/ha', nameTextStyle: { color: colors.muted, padding: [0, 0, 4, 24] }, scale: true, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' } }, axisLabel: { color: colors.muted, formatter: (value) => value.toLocaleString('es-EC') } },
              series: [
                { name: province, type: 'line', smooth: true, symbol: 'circle', symbolSize: 8, lineStyle: { width: 3, color: colors.maize }, itemStyle: { color: colors.maize, borderColor: colors.tooltipBg, borderWidth: 2 }, emphasis: { focus: 'series' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(200,162,78,0.38)' }, { offset: 1, color: 'rgba(200,162,78,0.02)' }] } }, data: chartPeriodData.map((row) => row.province) },
                { name: 'Ecuador', type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, type: 'dashed', color: colors.leaf }, itemStyle: { color: colors.leaf }, data: chartPeriodData.map((row) => row.national) },
              ],
            }}
            onClick={(params) => { if (history.rows[params.dataIndex]) setYear(history.rows[params.dataIndex].year); }}
          />
        </div><EcuadorProvinceMap province={province} /></div>
      </Panel>}
    {esMaizDuro && (!province || history.coverage === 0) && <section className="ydp-region-empty"><MapPin size={18} /><div><strong>Referencia provincial no disponible</strong><p>No se pudo asociar la ubicación de esta parcela con una provincia incluida en la serie SIPA.</p></div></section>}


    <SimulationInfoCard isOpen={mostrarModalIa} onClose={()=>setMostrarModalIa(false)} loading={cargandoIa} data={datosIa} />
  </div>;
}
