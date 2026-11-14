import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { dssService } from '../services/api';
import SowingPlanForm from '../components/SowingPlanForm';
import { savedSowingRows, sowingPlanning, irrigationLabel } from '../utils/sowingPlan';
import SimulationInfoCard from '../templates/Common/SimulationInfoCard';
import { DashboardMetric, DashboardPanel } from '../templates/Common/DashboardPrimitives';
import useExplicacionIA from '../hooks/usarExplicacionIA';
import { evidenceNumber as toFiniteNumber, evidenceDate, descriptivePercentiles, catalogSowingEvents, catalogHarvestEvents, recordedCropEvents, calendarStartDate, validateSowingResponse } from '../utils/agronomicEvidence';
import '../assets/siembra-dashboard.css';
import { Sprout, Activity, BarChart3, CalendarDays, MapPin, ArrowUpRight, Layers, ChevronDown, Info, Check, Pencil } from 'lucide-react';

const GaussChart=lazy(()=>import('../templates/Charts/GaussChart'));
const CalendarGrid=lazy(()=>import('../templates/Common/CalendarGrid'));
const longDate=value=>evidenceDate(value)?.toLocaleDateString('es-EC',{day:'numeric',month:'long',year:'numeric'}) || 'Por completar';

function SowingDisclosure({id,title,description,icon:Icon,open,onToggle,children}) {
  return <section className="sowing-disclosure"><h2><button type="button" id={`${id}-toggle`} aria-expanded={open} aria-controls={id} onClick={onToggle}>
    <span className="sowing-disclosure-icon"><Icon size={22} aria-hidden="true"/></span><span><strong>{title}</strong><span>{description}</span></span><ChevronDown className="sowing-chevron" size={20} aria-hidden="true"/>
  </button></h2><div id={id} hidden={!open} aria-labelledby={`${id}-toggle`}>{open&&children}</div></section>;
}

const formatMetricNumber = (value, maximumFractionDigits = 2) => (
  value === null ? '—' : value.toLocaleString('es-EC', { minimumFractionDigits: maximumFractionDigits, maximumFractionDigits })
);

export default function DashboardScenario({ cultivoElegidoId, añoSeleccionado, onNavigate, onDashboardData, onSelectYear, onCropUpdated }) {
  const [response, setResponse] = useState(null);
  const [reload, setReload] = useState(0);
  const [disclosures,setDisclosures]=useState({});
  const planButton=useRef(null);
  const restorePlanFocus=useRef(false);
  const disclosureOpen=name=>Boolean(disclosures[`${cultivoElegidoId}:${name}`]);
  const toggleDisclosure=name=>setDisclosures(previous=>({...previous,[`${cultivoElegidoId}:${name}`]:!previous[`${cultivoElegidoId}:${name}`]}));
  const [calendarPhase, setCalendarPhase] = useState('ambos');
  const requestKey = `${cultivoElegidoId ?? ''}:${añoSeleccionado ?? ''}`;
  const current = response?.key === requestKey ? response : null;
  const data = current?.data;
  const loading = current === null;
  const error = current?.error;
  const [editingKey, setEditingKey] = useState(null);
  const [notice, setNotice] = useState(null);
  const [historyOrder, setHistoryOrder] = useState('recientes');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectedYear = toFiniteNumber(añoSeleccionado);
  const baseYearNum = Number.isInteger(selectedYear) && selectedYear >= 2000 && selectedYear <= 2100 ? selectedYear : new Date().getFullYear();
  const zoneEvents = useMemo(() => [...catalogSowingEvents(data?.viabilidad_siembra, baseYearNum), ...catalogHarvestEvents(data?.viabilidad_siembra, baseYearNum)], [data?.viabilidad_siembra, baseYearNum]);
  const plan=useMemo(()=>sowingPlanning(data?.cultivo_activo,data?.calendario_parcela),[data]);
  const personalCalendar=useMemo(()=>({eventos:[
    ...(plan.start?[{fecha:plan.start,tipo:plan.fromSimulation?'siembra_simulada':'siembra_registrada',titulo:plan.kind==='real_declarada'?'Siembra realizada (declarada por ti)':plan.kind==='prevista'?'Siembra prevista':'Siembra: fecha por confirmar',fuente:plan.fromSimulation?'Fecha usada en una simulación':'Fecha guardada por ti'}]:[]),
    ...(plan.end?[{fecha:plan.end,tipo:'fin_ciclo_estimado',titulo:'Fin aproximado del cultivo',fuente:plan.durationFromSimulation?'Duración usada en una simulación':'Calculado con tu fecha y duración'}]:[]),
  ]}),[plan]);
  const plotEvents=useMemo(()=>recordedCropEvents(personalCalendar),[personalCalendar]);
  const calendarEvents=useMemo(()=>zoneEvents.filter(event=>calendarPhase==='ambos'||event.phase===calendarPhase),[zoneEvents,calendarPhase]);
  const personalDate=useMemo(()=>calendarStartDate(plotEvents,baseYearNum),[plotEvents,baseYearNum]);
  const zoneDate=useMemo(()=>calendarStartDate(calendarEvents,baseYearNum),[calendarEvents,baseYearNum]);
  const referencesOpen=disclosureOpen('references');
  const historyOpen=disclosureOpen('history');
  const ownCalendarOpen=disclosureOpen('calendar');

  const {
    mostrarModalIa,
    setMostrarModalIa,
    cargandoIa,
    datosIa,
    pedirExplicacionIa
  } = useExplicacionIA(cultivoElegidoId, añoSeleccionado);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const res = await dssService.getEscenarioData(cultivoElegidoId, añoSeleccionado);
        const valid = validateSowingResponse(res, cultivoElegidoId);
        if (active) setResponse({ key: requestKey, data: valid });
      } catch {
        if (active) setResponse(previous=>previous?.key===requestKey&&previous.data
          ? {...previous,refreshError:'Tu plan está guardado. No pudimos actualizar la información de esta pantalla. Puedes volver a cargar los datos.'}
          : {key:requestKey,error:'No se pudieron cargar los datos de Siembra. Vuelve a intentarlo.'});
      }
    }
    loadData();
    return () => { active = false; };
  }, [cultivoElegidoId, añoSeleccionado, requestKey, reload]);

  useEffect(() => {
    onDashboardData?.(data ? {...data,calendario_visible:{origen:referencesOpen?'zona':'parcela',fase:referencesOpen?calendarPhase:'fechas_de_la_parcela'}} : null);
  }, [data, onDashboardData, referencesOpen, calendarPhase]);

  useEffect(() => {
    if (editingKey !== null || !restorePlanFocus.current) return;
    restorePlanFocus.current = false;
    requestAnimationFrame(() => planButton.current?.focus({ preventScroll: true }));
  }, [editingKey]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (loading) {
    return <div className="dashboard-view dashboard-view--scenario ydp-dashboard sowing-dashboard"><div className="sowing-loading" role="status" aria-busy="true"><span className="ydp-loader" aria-hidden="true"/><p>Cargando el plan de tu parcela…</p><div className="sowing-loading-placeholder" aria-hidden="true"/></div></div>;
  }

  if (error) {
    return <section className="dashboard-view dashboard-view--scenario ydp-dashboard sowing-dashboard"><h1>Siembra</h1><p role="alert" className="ydp-state ydp-state--error">{error}</p><button type="button" className="ydp-primary-action" onClick={() => { setResponse(null); setReload(value => value + 1); }}>Reintentar siembra</button></section>;
  }

  if (!data?.cultivo_activo) {
    return <div className="dashboard-view dashboard-view--scenario ydp-dashboard sowing-dashboard"><section className="ydp-empty"><span className="ydp-empty-icon"><Sprout size={24} aria-hidden="true" /></span><p className="ydp-eyebrow">PLANIFICACIÓN DE SIEMBRA</p><h1>Elige una parcela para empezar</h1><p>Registra o selecciona una parcela para consultar sus fechas y simulaciones guardadas.</p><button type="button" onClick={()=>onNavigate?.('cultivos')}>Ir a mis parcelas <ArrowUpRight size={16} aria-hidden="true" /></button></section></div>;
  }

  const { percentiles } = data;
  const kpis = data.kpis ?? {};
  const recomendaciones = Array.isArray(data.recomendaciones) ? data.recomendaciones.filter((row) => row && typeof row === 'object') : [];
  const resumen = data.resumen_descriptivo || {};
  const muestra = toFiniteNumber(resumen.muestra);
  const rendimientoEsperado = toFiniteNumber(kpis.rendimiento_esperado);
  const medianaGuardada = toFiniteNumber(percentiles?.p50);
  const coeficienteVariacion = toFiniteNumber(resumen.coeficiente_variacion_pct);

  const historyRows = savedSowingRows(data, historyOrder);
  const hasSample = muestra !== null && muestra > 0;
  const lot = data.cultivo_activo;
  const explain = (nombre,valor,unidad,descripcion_tecnica,guia_lectura) => pedirExplicacionIa({tipo_elemento:'tarjeta',nombre,valor,unidad,descripcion_tecnica,guia_lectura,estado:valor===null?'sin_datos':'descriptivo',cultivo:'maiz'});
  const yieldUnit = 't/ha significa toneladas por cada hectárea. Sirve para comparar el rendimiento sin confundirlo con la producción total de la parcela.';
  const sampleLimit = 'Estos datos describen simulaciones guardadas de esta parcela y año; no son cosechas medidas ni garantizan lo que obtendrás en el campo.';
  const percentileSummary = descriptivePercentiles(percentiles?.p10, percentiles?.p50, percentiles?.p90);
  const metricReadings = [
    ['Es el promedio de los rendimientos de las simulaciones consultadas.', [yieldUnit, 'Se obtiene sumando los rendimientos guardados y dividiendo entre la cantidad de ejecuciones.']],
    ['Es el valor central al ordenar los rendimientos guardados de menor a mayor.', [yieldUnit, 'Resume el centro de la muestra; si hay un número par de resultados, se usan los dos valores centrales.']],
    ['Indica cuánto se diferencian entre sí los rendimientos de las simulaciones consultadas.', ['CV significa coeficiente de variación: compara la dispersión de los resultados con su promedio.', 'Un porcentaje mayor indica más diferencias dentro de esta muestra. No es un porcentaje de riesgo de perder la cosecha.']],
    ['Es la cantidad de simulaciones con un rendimiento válido que se están consultando.', ['El año filtra la fecha en que se hizo el cálculo, no la fecha de siembra.', 'Se consultan hasta las 50 ejecuciones más recientes del año. Cada ejecución es un cálculo del sistema.']],
  ];
  const explainPercentiles = () => pedirExplicacionIa({tipo_elemento:'grafico',nombre:muestra===1?'Resultado de la simulación disponible':'Percentiles de la muestra guardada',valor:muestra,unidad:'ejecuciones',datos_grafico:percentiles,
    descripcion_tecnica:'P10, mediana y P90 resumen esta muestra de resultados guardados; no son probabilidades futuras.',
    guia_lectura:{resumen:!percentileSummary?'No hay percentiles descriptivos válidos disponibles para esta muestra.':toFiniteNumber(percentiles?.muestra)===1?'Aquí hay una sola simulación. Su resultado no permite comparar la variación entre ejecuciones.':'Estos tres puntos resumen la parte baja, el centro y la parte alta de los rendimientos guardados.',
      lectura:!percentileSummary?['No se reemplazan los datos ausentes con ceros. Revisa que existan resultados guardados válidos para esta parcela y año.']:toFiniteNumber(percentiles?.muestra)===1?[`El rendimiento guardado es ${formatMetricNumber(toFiniteNumber(percentiles?.p50))} t/ha.`,yieldUnit]:[
        `P10: ${formatMetricNumber(toFiniteNumber(percentiles?.p10))} t/ha. Es una referencia de la parte baja de esta muestra.`,
        `P50 o mediana: ${formatMetricNumber(toFiniteNumber(percentiles?.p50))} t/ha. Es el valor central.`,
        `P90: ${formatMetricNumber(toFiniteNumber(percentiles?.p90))} t/ha. Es una referencia de la parte alta de esta muestra.`,yieldUnit],
      limite:'Los percentiles no son probabilidades de tu próxima cosecha ni límites garantizados. Con pocos resultados, el resumen puede cambiar mucho al agregar otra simulación.'}});
  const metrics = [
    {label:'Rendimiento medio guardado',value:rendimientoEsperado,unit:'t/ha',icon:Sprout,feature:true,detail:`Media de ${muestra} ${muestra===1?'ejecución guardada':'ejecuciones guardadas'}`,description:'Media de los rendimientos guardados para esta parcela y año. No es una nueva predicción ni una media medida de cosechas.'},
    {label:'Mediana guardada',value:medianaGuardada,unit:'t/ha',icon:BarChart3,detail:'Valor central de los resultados guardados',description:'Valor central de los rendimientos ordenados. Resume esta muestra; no es un objetivo agronómico ni una probabilidad futura.'},
    {label:'Variación de la muestra (CV)',value:coeficienteVariacion,unit:'%',icon:Activity,digits:1,detail:coeficienteVariacion===null?'Requiere al menos dos valores y media positiva':'Dispersión entre las ejecuciones consultadas',description:'Desviación estándar dividida por la media, expresada como porcentaje. Describe la dispersión de estas ejecuciones; no demuestra estabilidad entre campañas ni incertidumbre predictiva.'},
    {label:'Simulaciones consultadas',value:muestra,unit:'',icon:Layers,digits:0,detail:`Ejecuciones válidas realizadas en ${baseYearNum}`,description:'Cantidad de ejecuciones con rendimiento válido dentro de las 50 más recientes consultadas de esta parcela y año. No es la cantidad de cosechas reales.'},
  ];

  const editing=editingKey===String(lot.id);
  const closePlan=()=>{restorePlanFocus.current=true;setEditingKey(null);};
  const openPlan=()=>{setEditingKey(String(lot.id));requestAnimationFrame(()=>document.getElementById('sowing-plan-date')?.focus());};
  const hasPlan=plan.ownDate!==null;
  const years=[...new Set([baseYearNum,...(data.años_disponibles||[]).filter(year=>Number.isInteger(year)&&year>=2000&&year<=2100)])].sort((a,b)=>b-a);
  const visibleHistory=disclosureOpen('all-results')?historyRows:historyRows.slice(0,5);
  const explainRun=row=>explain(`Resultado guardado #${row.id}: ${row.nombre}`,row.valor,'t/ha','Resultado de una simulación guardada.',{
    resumen:`Es el rendimiento conservado de la simulación #${row.id}.`,lectura:[yieldUnit,`Se calculó el ${row.fechaTexto}. Variedad: ${row.variedad}.`],limite:sampleLimit});
  const pendingText=new Intl.ListFormat('es-EC',{style:'long',type:'conjunction'}).format(plan.pending);

  return <div className="dashboard-view dashboard-view--scenario ydp-dashboard sowing-dashboard">
    <header className="ydp-page-header sowing-page-header"><div><span className="ydp-eyebrow">TU PLAN DE CULTIVO</span><h1>{lot.nombre_parcela||'Tu parcela de maíz'}</h1><p className="sowing-intro">Guarda cuándo vas a sembrar y revisa las fechas de tu cultivo.</p><p className="ydp-location"><MapPin size={18} aria-hidden="true"/>{lot.provincia||lot.ubicacion||'Ubicación de tu parcela'}</p></div></header>

    {current?.refreshError&&<div className="sowing-refresh-error" role="alert"><p>{current.refreshError}</p><button type="button" className="sowing-secondary" onClick={()=>setReload(value=>value+1)}>Volver a cargar los datos</button></div>}

    <DashboardPanel id="sowing-main-plan" title="Tu plan de siembra" subtitle="Estas son las fechas y los datos de esta parcela." icon={Sprout} action={!editing&&<button ref={planButton} data-plot-id={lot.id} type="button" className="ydp-primary-action" onClick={openPlan}><Pencil size={18} aria-hidden="true"/>{hasPlan?'Editar mi plan':'Completar mi plan'}</button>}>
      {notice?.key===requestKey&&<p className="sowing-saved" role="status"><Check size={20} aria-hidden="true"/>{notice.message}</p>}
      {editing?<div id="sowing-plan-editor"><SowingPlanForm key={`${lot.id}:${reload}`} plot={lot} suggestion={plan} onCancel={closePlan} onSaved={patch=>{
        setResponse(previous=>previous?.key===requestKey?{...previous,data:{...previous.data,cultivo_activo:{...previous.data.cultivo_activo,...patch},calendario_parcela:null}}:previous);
        setNotice({key:requestKey,message:'Tu plan quedó guardado.'});restorePlanFocus.current=true;setEditingKey(null);setReload(value=>value+1);onCropUpdated?.();
      }}/></div>:<>
        <div className="sowing-plan-status"><span className="sowing-status-label"><span aria-hidden="true" className="sowing-status-dot"/>{plan.pending.length?'Plan por completar':'Plan guardado'}</span>{plan.pending.length>0&&<p>Te falta revisar: {pendingText}.</p>}</div>
        <div className="sowing-dates" role="group" aria-label="Fechas de tu cultivo">
          <div className="sowing-date"><span className="sowing-date-icon"><Sprout size={24} aria-hidden="true"/></span><div><h3>Siembra</h3><strong className="sowing-date-value">{longDate(plan.start)}</strong><p>{plan.start?(plan.kind==='real_declarada'?'Ya sembraste · dato informado por ti':plan.kind==='prevista'?'Fecha prevista: todavía es un plan':'Confirma si ya sembraste en esta fecha'):'Guarda el día que planeas sembrar.'}</p></div></div>
          <div className="sowing-date"><span className="sowing-date-icon"><CalendarDays size={24} aria-hidden="true"/></span><div><h3>Fin del cultivo (aproximado)</h3><strong className="sowing-date-value">{longDate(plan.end)}</strong><p>{plan.end?'Una referencia para preparar la cosecha.':plan.start?'Añade la duración para calcular esta fecha.':'Necesitamos la fecha de siembra y la duración.'}</p></div></div>
        </div>
        <dl className="sowing-campaign-summary"><div><dt>Maíz de esta parcela</dt><dd>{lot.variedad_maiz||'Por completar'}{lot.tipo_maiz&&<small>{lot.tipo_maiz}</small>}</dd></div><div><dt>Duración del cultivo</dt><dd>{plan.cycle===null?'Por completar':`${formatMetricNumber(plan.cycle,0)} días`}<small>{plan.durationFromSimulation?'Usada en una simulación; falta confirmarla':plan.cycle!==null?'Guardada por ti':'Desde la siembra hasta el fin del cultivo'}</small></dd></div><div><dt>Agua o riego</dt><dd>{irrigationLabel(plan.water)}</dd></div></dl>
        {(plan.fromSimulation||plan.durationFromSimulation)&&<p className="sowing-info"><Info size={20} aria-hidden="true"/><span>{plan.fromSimulation?'Esta fecha se usó en una simulación y aún no está guardada como plan de la parcela.':'La duración viene de una simulación anterior.'} Pulsa «{hasPlan?'Editar mi plan':'Completar mi plan'}» para revisarla y guardarla.</span></p>}
        {plan.end&&<p className="sowing-harvest-note">La fecha final se calcula con la siembra y la duración. El estado del cultivo y el clima pueden cambiar el momento de cosechar.</p>}
        {plotEvents.length>0&&<div className="sowing-personal-calendar"><button type="button" className="sowing-calendar-toggle" aria-expanded={ownCalendarOpen} aria-controls="siembra-calendar" onClick={()=>toggleDisclosure('calendar')}><CalendarDays size={20} aria-hidden="true"/>Ver mis fechas en calendario<ChevronDown size={18} aria-hidden="true"/></button><div id="siembra-calendar" hidden={!ownCalendarOpen}>{ownCalendarOpen&&<Suspense fallback={<p role="status">Abriendo tu calendario…</p>}><CalendarGrid events={plotEvents} initialDate={personalDate} resetToInitial fillHeight={false} embedded title="Las fechas de tu cultivo" eventDetailLabel="Detalle del calendario de la parcela" legendItems={[{color:'var(--zs-info)',label:'Siembra'},{color:'var(--zs-warning)',label:'Fin aproximado'}]}/></Suspense>}</div></div>}
      </>}
    </DashboardPanel>

    <div className="sowing-optional-heading"><h2>Si necesitas más información</h2><p>Abre sólo la opción que te ayude en este momento.</p></div>
    <SowingDisclosure id="sowing-zone-reference" title="Consultar meses habituales de la zona" description="Una guía general si todavía estás eligiendo cuándo sembrar." icon={CalendarDays} open={referencesOpen} onToggle={()=>toggleDisclosure('references')}>
      <div className="sowing-reference-heading"><h3>Referencias para {lot.provincia||'la ubicación de esta parcela'}</h3><p>Son meses publicados en el catálogo agrícola. No consideran el clima futuro de tu parcela ni cambian tu plan.</p></div>
      {zoneEvents.length?<><label className="sowing-filter">¿Qué fechas quieres consultar?<select aria-label="Tipo de referencia agrícola" value={calendarPhase} onChange={event=>setCalendarPhase(event.target.value)}><option value="ambos">Siembra y cosecha</option><option value="siembra">Meses de siembra</option><option value="cosecha">Meses de cosecha</option></select></label>
        <ul className="sowing-reference-list">{calendarEvents.map((event,index)=><li key={`${event.title}:${index}`}><span className="sowing-reference-type">{event.phase==='cosecha'?'Cosecha de referencia':'Siembra de referencia'}</span><strong>{event.start.toLocaleDateString('es-EC',{day:'numeric',month:'long'})}{event.end.getTime()!==event.start.getTime()?` al ${event.end.toLocaleDateString('es-EC',{day:'numeric',month:'long'})}`:''}</strong><span>{event.title}</span></li>)}</ul>
        {calendarEvents.length===0?<p className="sowing-empty">El catálogo no tiene referencias para esta opción. Esto no significa que el mes sea malo para cultivar.</p>:<details className="sowing-reference-calendar"><summary>Ver estas referencias en calendario</summary><Suspense fallback={<p role="status">Abriendo calendario de referencia…</p>}><CalendarGrid events={calendarEvents} initialDate={zoneDate} referenceYear={baseYearNum} resetToInitial fillHeight={false} embedded title="Referencia general del catálogo" eventDetailLabel="Detalle de la referencia de siembra" legendItems={[{color:'var(--zs-info)',label:'Siembra de referencia'},{color:'var(--zs-warning)',label:'Cosecha de referencia'}]}/></Suspense></details>}
        <p className="sowing-source-caption">Fuente: catálogo agrícola de la zona y el tipo de maíz registrados. Los meses sin referencia no han sido evaluados.</p>
      </>:<div className="sowing-empty"><h3>No encontramos una referencia para esta parcela</h3><p>Puedes guardar tu fecha de siembra igualmente. La falta de una ficha no significa que no puedas cultivar en esa zona.</p></div>}
    </SowingDisclosure>

    <SowingDisclosure id="sowing-saved-results" title="Consultar simulaciones guardadas" description={hasSample?`${muestra} ${muestra===1?'cálculo disponible':'cálculos disponibles'} de ${baseYearNum}. Son estimaciones, no cosechas reales.`:'Consulta los cálculos que ya hiciste para esta parcela.'} icon={BarChart3} open={historyOpen} onToggle={()=>toggleDisclosure('history')}>
      <div className="sowing-history-heading"><div><h3>Resultados que ya calculaste</h3><p>Sirven para revisar tus pruebas. Para analizar el rendimiento de tu parcela, abre la sección Rendimiento.</p></div><button type="button" className="sowing-secondary" onClick={()=>onNavigate?.('yield')}>Ir a Rendimiento <ArrowUpRight size={18} aria-hidden="true"/></button></div>
      <div className="sowing-history-filters"><label className="sowing-filter">Año en que hiciste las simulaciones<select aria-label="Año de las simulaciones" value={baseYearNum} disabled={editing} onChange={event=>onSelectYear?.(Number(event.target.value))}>{years.map(year=><option key={year} value={year}>{year}</option>)}</select></label>{hasSample&&<label className="sowing-filter">Ordenar resultados<select aria-label="Ordenar simulaciones guardadas" value={historyOrder} onChange={event=>setHistoryOrder(event.target.value)}><option value="recientes">Más recientes primero</option><option value="mayor">Mayor rendimiento primero</option><option value="menor">Menor rendimiento primero</option></select></label>}</div>
      <p className="sowing-year-help">Este año sólo filtra los cálculos guardados. Las fechas de tu cultivo son las que registraste en el plan.</p>
      {hasSample&&historyRows.length?<><p className="sowing-help">Pulsa un resultado para entender qué significa. «t/ha» significa toneladas por cada hectárea.</p><ul className="sowing-history-list" aria-label="Simulaciones guardadas de esta parcela">{visibleHistory.map(row=><li key={row.id}><button type="button" className="sowing-result" aria-label={`Ver explicación de simulación #${row.id}`} onClick={()=>explainRun(row)}><span className="sowing-result-copy"><strong>{row.nombre}</strong><span>Calculada: {row.fechaTexto}</span><span>{row.variedad==='Variedad no conservada'?'Esta simulación no guardó la variedad':row.variedad}</span></span><span className="sowing-result-value"><strong>{formatMetricNumber(row.valor,2)} <small>t/ha</small></strong><span>Rendimiento estimado</span></span><ArrowUpRight size={20} aria-hidden="true"/></button></li>)}</ul>{historyRows.length>5&&<button type="button" className="sowing-secondary sowing-more-results" aria-expanded={disclosureOpen('all-results')} onClick={()=>toggleDisclosure('all-results')}>{disclosureOpen('all-results')?'Mostrar sólo cinco resultados':`Ver los ${historyRows.length} resultados`}</button>}
        <details className="sowing-advanced" open={advancedOpen} onToggle={event=>setAdvancedOpen(event.currentTarget.open)}><summary>Ver estadísticas de las simulaciones <span>Opcional: promedio, variación y percentiles</span></summary><p>Este resumen describe tus simulaciones. No calcula una nueva cosecha ni mide el riesgo de tu cultivo.</p>
          <section className="ydp-metrics" aria-label="Indicadores avanzados de siembra">{metrics.map((metric,index)=><DashboardMetric key={metric.label} label={metric.label} value={formatMetricNumber(metric.value,metric.digits??2)} unit={metric.value===null?'':metric.unit} detail={metric.detail} icon={metric.icon} feature={metric.feature} onExplain={()=>explain(metric.label,metric.value,metric.unit,metric.description,{resumen:metric.value===null?'No hay un valor disponible para este indicador.':metricReadings[index][0],lectura:metricReadings[index][1],limite:sampleLimit})}/>)}</section>
          {advancedOpen&&<DashboardPanel title={muestra===1?'Resultado de la simulación disponible':'Percentiles de la muestra guardada'} subtitle="Detalle estadístico de los resultados guardados" icon={Activity} onExplain={explainPercentiles}><Suspense fallback={<p role="status">Preparando el gráfico…</p>}><GaussChart p10={percentiles?.p10} p50={percentiles?.p50} p90={percentiles?.p90} muestra={percentiles?.muestra}/></Suspense></DashboardPanel>}
          <details className="sowing-methodology"><summary>Cómo se calculan estos datos</summary><p>Los indicadores describen simulaciones guardadas, no cosechas observadas.</p>{recomendaciones.map((item,index)=><article className="sowing-source-note" key={index}><h3>{typeof item.titulo==='string'?item.titulo:'De dónde viene el resumen'}</h3>{typeof item.texto==='string'&&<p>{item.texto}</p>}</article>)}</details>
        </details>
      </>:<div className="sowing-empty"><h3>No hay simulaciones guardadas en {baseYearNum}</h3><p>Tu plan de siembra sigue disponible. Puedes cambiar el año o hacer una simulación cuando tengas los datos del cultivo.</p>{Number.isInteger(data.año_ultima_simulacion)&&data.año_ultima_simulacion!==baseYearNum&&onSelectYear&&<button type="button" className="sowing-secondary" onClick={()=>onSelectYear(data.año_ultima_simulacion)}>Ver simulaciones de {data.año_ultima_simulacion}</button>}<button type="button" className="sowing-secondary" onClick={()=>onNavigate?.('simular')}>Preparar una simulación <ArrowUpRight size={18} aria-hidden="true"/></button></div>}
    </SowingDisclosure>
    <SimulationInfoCard isOpen={mostrarModalIa} onClose={()=>setMostrarModalIa(false)} loading={cargandoIa} data={datosIa}/>
  </div>;
}
