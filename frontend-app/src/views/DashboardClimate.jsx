import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Cloud, CloudLightning, CloudRain, CloudSun, Droplets, ExternalLink, Leaf, MapPin, MessageCircle, RefreshCw, Sprout, Sun, Thermometer, Waves, Wind } from 'lucide-react';
import { dssService } from '../services/api';
import EChart from '../components/EChart';
import useTema from '../hooks/useTema';
import { getDashboardChartColors, getChartTooltip } from '../utils/chartConfig';
import { climateDate, climateNumber, forecastDays, forecastSummary, historyDays, historyMonths, referenceWaterBalance, soilWaterPercent, validateClimateResponse } from '../utils/climateEvidence';
import { dateKindLabel, irrigationLabel, sowingPlanning } from '../utils/sowingPlan';
import '../assets/clm-panel.css';

const num = (value, digits = 1) => {
  const n = climateNumber(value);
  return n === null ? 'Sin dato' : n.toLocaleString('es-EC', { maximumFractionDigits: digits });
};
const dateLabel = (date, options = { day: 'numeric', month: 'short', year: 'numeric' }) => climateDate(date) ? new Date(`${date}T12:00:00`).toLocaleDateString('es-EC', options) : 'Por registrar';
const dayLabel = date => dateLabel(date, { weekday: 'short', day: 'numeric', month: 'short' });
const periodLabel = period => climateDate(period?.inicio) && climateDate(period?.fin) ? `${dateLabel(period.inicio)} al ${dateLabel(period.fin)}` : 'Período no informado por el proveedor';
const timeLabel = time => typeof time === 'string' && climateDate(time.slice(0, 10)) ? `${dateLabel(time.slice(0, 10))}${/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(time) ? ` · ${time.slice(11, 16)}` : ''}` : 'Hora no informada';
function WeatherIcon({ code, size = 28 }) {
  const value = climateNumber(code, 0, 99);
  const Icon = value === 0 ? Sun : value >= 95 ? CloudLightning : value >= 51 && value <= 82 ? CloudRain : value !== null && value <= 3 ? CloudSun : Cloud;
  return <Icon size={size} aria-hidden="true" />;
}
function SectionTitle({ icon: Icon, id, title, children }) {
  return <div className="climate-section-title"><span className="climate-icon"><Icon size={22} aria-hidden="true" /></span><div><h2 id={id}>{title}</h2>{children && <p>{children}</p>}</div></div>;
}
function Missing({ children }) { return <p className="climate-missing">{children}</p>; }

export default function DashboardClimate({ cultivoElegidoId, cultivoActivo, onNavigate, onDashboardData, onAbrirRegistroCampo, revisionMediciones = 0 }) {
  const [result, setResult] = useState(null);
  const [observations, setObservations] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [historyRange, setHistoryRange] = useState('30d');
  const [historyVariable, setHistoryVariable] = useState('rain');
  const key = `${cultivoElegidoId ?? ''}:${refresh}`;
  const current = String(result?.plotId) === String(cultivoElegidoId) ? result : null;
  const data = current?.data;
  const pending = Boolean(cultivoElegidoId) && current?.key !== key;
  const field = String(observations?.plotId) === String(cultivoElegidoId) ? observations : null;
  const colors = getDashboardChartColors(useTema());

  useEffect(() => {
    if (!cultivoElegidoId) return;
    let active = true;
    dssService.getClimaData(cultivoElegidoId, null).then(raw => {
      const payload = validateClimateResponse(raw, cultivoElegidoId);
      if (active) setResult({ plotId: cultivoElegidoId, key, data: payload, today: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date()) });
    }).catch(() => {
      if (active) setResult(previous => ({ ...(String(previous?.plotId) === String(cultivoElegidoId) ? previous : {}), plotId: cultivoElegidoId, key, error: 'No se pudo actualizar el clima. Comprueba tu conexión e inténtalo de nuevo.' }));
    });
    return () => { active = false; };
  }, [cultivoElegidoId, key]);

  useEffect(() => {
    if (!cultivoElegidoId) return;
    let active = true;
    dssService.getRendimientoMediciones(cultivoElegidoId).then(record => {
      if (active) setObservations({ plotId: cultivoElegidoId, revision: revisionMediciones, data: record });
    }).catch(() => {
      if (active) setObservations({ plotId: cultivoElegidoId, revision: revisionMediciones, error: true });
    });
    return () => { active = false; };
  }, [cultivoElegidoId, revisionMediciones]);

  useEffect(() => { onDashboardData?.(data && !data.sin_datos ? data : null); }, [data, onDashboardData]);
  const ask = question => window.dispatchEvent(new CustomEvent('zeasys:ask-chat', { detail: { pregunta: question, cultivo_id: cultivoElegidoId } }));
  const recordField = () => onAbrirRegistroCampo?.();
  const reload = () => setRefresh(value => value + 1);

  if (!cultivoElegidoId || data?.sin_datos) return <div className="dashboard-view climate-page"><div className="climate-state"><MapPin size={32} aria-hidden="true" /><h2>Elige una parcela para consultar su clima</h2><p>La ubicación permite buscar el tiempo y los registros históricos cercanos a tu cultivo. Puedes hacerlo aunque todavía no hayas simulado una cosecha.</p><button className="climate-action" onClick={() => onNavigate?.('cultivos')}>Ir a mis parcelas <ArrowRight size={18} /></button></div></div>;
  if (!data) return <div className="dashboard-view climate-page"><div className="climate-state" role={current?.error ? 'alert' : 'status'} aria-busy={pending}>{current?.error ? <><h2>No pudimos consultar el clima</h2><p>{current.error}</p><button className="climate-action" onClick={reload}>Reintentar consulta</button></> : <><RefreshCw size={28} aria-hidden="true" /><h2>Consultando el clima de tu parcela…</h2><p>Buscamos el pronóstico y los datos históricos de esta ubicación.</p></>}</div></div>;

  const actual = data.clima_hoy?.disponible ? data.clima_hoy.actual : null;
  const forecast = forecastDays(data.pronostico_7d, current.today);
  const week = forecastSummary(forecast, current.today);
  const period = data.periodo_clima_reciente;
  const daily = historyDays(data.clima_diaria_30d, period);
  const monthly = historyMonths(data.resumen_mensual_12m?.meses);
  const history = historyRange === '30d' ? daily : monthly;
  const rain = historyVariable === 'rain';
  const values = history.map(row => rain ? row.precip_mm : row.temp_media_c);
  const validCount = values.filter(value => value !== null).length;
  const balance = referenceWaterBalance(data.clima_diaria_30d, period);
  const soilWater = soilWaterPercent(data.suelo_ahora?.humedad_0_10cm);
  const plan = sowingPlanning(cultivoActivo || {});
  const indicators = field?.data?.indicadores ?? {};
  const stage = indicators.etapa_observada;
  const pest = indicators.incidencia_plaga;
  const annual = data.lluvia_anual_referencia;
  const enso = data.kpis?.enso;
  const index = climateNumber(enso?.valor_indice ?? enso?.roni ?? enso?.oni, -10, 10);
  const ensoEstado = !enso || index === null ? null
    : enso.estado === 'anomalia_calida' || index >= .5 ? 'Anomalía cálida'
    : enso.estado === 'anomalia_fria' || index <= -.5 ? 'Anomalía fría'
    : 'Sin anomalía marcada';
  const ensoNota = (() => {
    if (!enso || index === null) return 'No se pudo consultar el índice del Pacífico ahora; el pronóstico de tu parcela sigue disponible.';
    const vigencia = enso.vigente === false ? 'Referencia no reciente: revisa su fecha antes de usarla. ' : '';
    if (!plan.start) return `${vigencia}Registra tu fecha de siembra en Siembra para relacionar este fenómeno con tu cultivo.`;
    if (plan.start > current.today) return `${vigencia}Siembras el ${dateLabel(plan.start)}: la fase de este fenómeno puede haber cambiado para entonces; vuelve a consultar cerca de esa fecha.`;
    if (plan.end && plan.end < current.today) return `${vigencia}Tu cultivo completó su ciclo (iniciado el ${dateLabel(plan.start)}); usa esta referencia para comparar con lo que observaste en campo.`;
    return `${vigencia}Tu cultivo está en campo desde el ${dateLabel(plan.start)}: esta es la condición del Pacífico que rodea a tu siembra; el pronóstico de 7 días sigue siendo la guía de tu parcela.`;
  })();
  const title = rain ? 'Lluvia acumulada' : 'Temperatura media';
  const unit = rain ? 'mm' : '°C';
  const option = {
    animation: false, grid: { left: 52, right: 20, top: 28, bottom: 42 },
    tooltip: getChartTooltip(colors, { renderMode: 'richText', valueFormatter: value => value === null ? 'Sin dato' : `${num(value)} ${unit}` }),
    xAxis: { type: 'category', data: history.map(row => historyRange === '30d' ? dateLabel(row.fecha, { day: 'numeric', month: 'short' }) : dateLabel(`${row.fecha}-01`, { month: 'short', year: '2-digit' })), axisLabel: { color: colors.muted, fontSize: 12, hideOverlap: true }, axisLine: { lineStyle: { color: colors.border } }, axisTick: { show: false } },
    yAxis: { type: 'value', name: unit, min: rain ? 0 : undefined, nameTextStyle: { color: colors.muted }, axisLabel: { color: colors.muted, fontSize: 12 }, splitLine: { lineStyle: { color: colors.grid } } },
    series: [{ name: title, type: rain ? 'bar' : 'line', data: values, connectNulls: false, barMaxWidth: 32, symbolSize: 7, itemStyle: { color: rain ? colors.sky : colors.maize, borderRadius: rain ? [4, 4, 0, 0] : undefined }, lineStyle: { width: 3 } }],
  };
  const explainHistory = item => ask(`Explícame ${title.toLowerCase()} ${item ? `del ${history[item.dataIndex]?.fecha}` : `de ${historyRange === '30d' ? 'los últimos 30 días' : 'los últimos 12 meses'}`} que muestra Clima y cultivo. Aclara su fuente, el período y qué conviene revisar en mi parcela, sin convertir datos ausentes en cero.`);

  return <div className="dashboard-view climate-page">
    <header className="climate-heading"><div><span className="climate-eyebrow">Seguimiento de tu parcela</span><h1>{cultivoActivo?.nombre_parcela || 'Clima y cultivo'}</h1><p><MapPin size={16} aria-hidden="true" />{cultivoActivo?.ubicacion || 'Ubicación de la parcela seleccionada'}</p></div><button type="button" className="climate-action climate-action--secondary" onClick={reload} disabled={pending}><RefreshCw size={18} aria-hidden="true" />{pending ? 'Consultando…' : 'Actualizar clima'}</button></header>
    <p className="climate-intro">Mira el tiempo, prepara tus labores y registra lo que observas en el cultivo. Toca una tarjeta para consultar su significado con el asistente.</p>
    {current.error && <div className="climate-notice" role="alert">{current.error} Se conserva la consulta anterior, con sus fechas originales.</div>}

    <section className="climate-panel climate-now" aria-labelledby="climate-now-title">
      <div className="climate-now-main"><SectionTitle icon={CloudSun} id="climate-now-title" title="El tiempo en tu parcela">Último dato: {timeLabel(actual?.fecha_hora)} · hora de la ubicación</SectionTitle>
        {actual ? <button className="climate-current-reading" onClick={() => ask('Explícame el último dato del tiempo de mi parcela, con su fecha y hora. ¿Qué conviene revisar antes de organizar las labores?')}><WeatherIcon code={actual.codigo_tiempo} size={44} /><span className="climate-temperature">{num(climateNumber(actual.temperatura_c, -90, 65))}<small> °C</small></span><span>{actual.descripcion || 'Condición no informada'}</span></button> : <Missing>El proveedor no entregó el tiempo actual. El historial y tus observaciones siguen disponibles abajo.</Missing>}
      </div>
      <div className="climate-now-details">
        <button className="climate-reading" onClick={() => ask('¿Qué significa la humedad relativa del aire que muestra mi parcela? Diferénciala de la humedad del suelo.')}><Droplets size={22} aria-hidden="true" /><span>Humedad del aire<strong>{num(climateNumber(actual?.humedad_relativa_pct, 0, 100), 0)}<small> %</small></strong></span></button>
        <button className="climate-reading" onClick={() => ask('¿Qué significa el viento indicado en Clima y cultivo y qué debo revisar antes de trabajar en mi parcela?')}><Wind size={22} aria-hidden="true" /><span>Viento<strong>{num(climateNumber(actual?.viento_kmh, 0))}<small> km/h</small></strong></span></button>
      </div>
      <button className="climate-reading climate-reading--enso" onClick={() => ask('Explícame el fenómeno de El Niño y La Niña que muestra Clima y cultivo. ¿Cómo se relaciona esta referencia del Pacífico con la fecha de siembra de mi parcela —actual o futura— y qué conviene revisar en el pronóstico de mi ubicación?')}>
        <Waves size={22} aria-hidden="true" />
        <span>El Niño y La Niña
          <strong>{ensoEstado ?? 'Sin dato'}<small>{index !== null ? `${enso.indice || 'RONI'}: ${num(index, 2)} °C · ${enso.etiqueta_trimestre || enso.periodo}` : 'Índice del Pacífico no disponible'}</small></strong>
          <span className="climate-reading-note">{ensoNota}</span>
          <span className="climate-reading-source">Fenómeno del Pacífico ecuatorial que suele influir en el clima de Ecuador · NOAA CPC · no pronostica la lluvia de tu parcela</span>
        </span>
      </button>
      <p className="climate-source">Fuente: Open-Meteo · estimaciones meteorológicas por ubicación; no son lecturas de una estación instalada en tu parcela.</p>
    </section>

    <section className="climate-panel" aria-labelledby="climate-week-title">
      <SectionTitle icon={CalendarDays} id="climate-week-title" title="Los próximos 7 días">Pronóstico para organizar tus labores. Puede cambiar al acercarse cada fecha.</SectionTitle>
      {forecast.length ? <><div className="climate-forecast-grid">{forecast.map(day => <button type="button" className="climate-day" key={day.fecha} onClick={() => ask(`Explícame el pronóstico del ${day.fecha} de mi parcela. Diferencia la cantidad de lluvia en mm, su probabilidad y la temperatura. ¿Qué conviene revisar para organizar mis labores?`)} aria-label={`Consultar pronóstico del ${day.fecha}`}>
        <span className="climate-day-date">{dayLabel(day.fecha)}</span><WeatherIcon code={day.codigo_tiempo} /><span className="climate-day-description">{day.descripcion || 'Sin descripción'}</span><strong className="climate-day-temp"><small>Máx.</small> {num(day.temp_max_c, 0)}°<span><small>Mín.</small> {num(day.temp_min_c, 0)}°</span></strong><span className="climate-day-rain"><Droplets size={16} aria-hidden="true" />{day.precipitacion_mm === null ? 'Lluvia sin dato' : `${num(day.precipitacion_mm)} mm`}</span><span className="climate-day-prob">{day.prob_precipitacion_pct === null ? 'Probabilidad sin dato' : `${num(day.prob_precipitacion_pct, 0)} % de lluvia`}</span><span className="climate-card-link">Consultar <ArrowRight size={14} aria-hidden="true" /></span>
      </button>)}</div><div className="climate-week-summary"><strong>{week.complete ? `${num(week.total)} mm previstos en los 7 días` : `Pronóstico parcial: lluvia informada en ${week.coverage} de 7 días`}</strong><p>Los milímetros indican cantidad de agua; el porcentaje indica probabilidad de precipitación. Ese porcentaje no mide el riesgo de perder la cosecha.</p></div></> : <Missing>No llegó un pronóstico vigente de esta ubicación. Pulsa Actualizar clima para volver a consultar; no se completan los días con valores inventados.</Missing>}
      {week.wettest?.precipitacion_mm > 0 && <div className="climate-tip"><Leaf size={20} aria-hidden="true" /><p>La mayor cantidad de lluvia prevista entre los días disponibles corresponde a <strong>{dayLabel(week.wettest.fecha)}</strong> ({num(week.wettest.precipitacion_mm)} mm). Revisa el drenaje y el estado del terreno antes de organizar una labor.</p></div>}
    </section>

    <section className="climate-panel" aria-labelledby="climate-crop-title">
      <div className="climate-panel-heading"><SectionTitle icon={Sprout} id="climate-crop-title" title="Tu cultivo y tus observaciones">La fecha de siembra ayuda a planificar. La etapa del cultivo se confirma observándolo en campo.</SectionTitle><button className="climate-action climate-action--secondary" onClick={recordField}>Registrar observación <ArrowRight size={18} aria-hidden="true" /></button></div>
      <dl className="climate-crop-grid"><div><dt>Siembra registrada</dt><dd>{dateLabel(plan.start)}<small>{plan.start ? dateKindLabel(plan.kind) : 'Completa el plan en Siembra'}</small></dd></div><div><dt>Agua o riego</dt><dd>{irrigationLabel(plan.water)}<small>Dato declarado por el productor</small></dd></div><div><dt>Última etapa observada</dt><dd>{stage?.valor || (field?.error ? 'No se pudo consultar' : 'Sin observación registrada')}<small>{stage?.valor ? `Observada el ${dateLabel(stage.fecha)}` : 'No se deduce automáticamente por los días transcurridos'}</small></dd></div></dl>
      {field?.revision !== revisionMediciones && <p role="status" className="climate-source">Actualizando tus observaciones…</p>}
      {pest?.valor != null && <p className="climate-observation">En tu última observación: {num(pest.valor)} % de plantas afectadas · {dateLabel(pest.fecha)}. {pest.nota}</p>}
      <div className="climate-crop-footer"><p>El clima por sí solo no confirma enfermedades en tu cultivo. Si ves manchas, daño en hojas o plantas débiles, registra la fecha y consulta los síntomas.</p><button className="climate-text-action" onClick={() => onNavigate?.('scenarios')}>Ver mi plan de siembra <ArrowRight size={17} aria-hidden="true" /></button></div>
    </section>

    <section className="climate-panel" aria-labelledby="climate-history-title">
      <SectionTitle icon={CloudRain} id="climate-history-title" title="Cómo ha cambiado el tiempo">Historia reciente de esta ubicación. Ayuda a entender lo que ha ocurrido; no anticipa el tiempo de los próximos meses.</SectionTitle>
      <div className="climate-history-controls"><div role="group" aria-label="Período del historial">{[['30d', 'Últimos 30 días'], ['12m', 'Últimos 12 meses']].map(([value, label]) => <button key={value} aria-pressed={historyRange === value} onClick={() => setHistoryRange(value)}>{label}</button>)}</div><div role="group" aria-label="Dato del historial">{[['rain', 'Lluvia'], ['temperature', 'Temperatura']].map(([value, label]) => <button key={value} aria-pressed={historyVariable === value} onClick={() => setHistoryVariable(value)}>{label}</button>)}</div></div>
      <button className="climate-chart-title" onClick={() => explainHistory()} aria-label={`Consultar ${title.toLowerCase()} del historial`}><strong>{title} ({unit})</strong><MessageCircle size={18} aria-hidden="true" /><span>Consultar este dato</span></button>
      <p className="climate-source">{periodLabel(historyRange === '30d' ? period : data.resumen_mensual_12m?.periodo)} · {validCount} de {history.length} {historyRange === '30d' ? 'días' : 'meses'} con datos de {rain ? 'lluvia' : 'temperatura'}.</p>
      {validCount ? <><div className="climate-history-chart"><EChart option={option} onClick={explainHistory} ariaLabel={`${title} del historial. ${validCount} períodos disponibles. Los datos ausentes quedan vacíos.`} /></div><details className="climate-table-details"><summary>Ver datos del gráfico en una tabla</summary><div className="climate-table-scroll"><table><caption>{title} · {historyRange === '30d' ? '30 días' : '12 meses'}</caption><thead><tr><th scope="col">{historyRange === '30d' ? 'Fecha' : 'Mes'}</th><th scope="col">{title} ({unit})</th></tr></thead><tbody>{history.map((row, i) => <tr key={row.fecha}><th scope="row">{row.fecha}</th><td>{num(values[i])}</td></tr>)}</tbody></table></div></details></> : <Missing>No hay datos disponibles para este período y variable. Prueba otra opción o vuelve a consultar.</Missing>}
      <p className="climate-source">Fuente: {historyRange === '12m' ? data.resumen_mensual_12m?.fuente || 'Open-Meteo Archive' : data.api_source || 'Open-Meteo Archive'}. Datos de modelos y reanálisis por ubicación. Los huecos indican información ausente, nunca lluvia cero.{historyRange === '12m' && !rain ? ' Las medias se calculan con los días que tienen temperatura disponible.' : ''}</p>
    </section>

    <div className="climate-secondary-grid"><section className="climate-panel" aria-labelledby="climate-soil-title"><SectionTitle icon={Droplets} id="climate-soil-title" title="Suelo y agua">Una referencia para saber qué conviene medir en campo.</SectionTitle><div className="climate-soil-readings"><button className="climate-reading" onClick={() => ask('Explícame la humedad estimada del suelo de 0 a 10 cm que muestra Clima y cultivo. ¿Por qué no basta ese porcentaje para decidir cuándo y cuánto regar?')}><Droplets size={22} aria-hidden="true" /><span>Agua en los primeros 10 cm<strong>{num(soilWater)}<small> % del volumen</small></strong></span></button><button className="climate-reading" onClick={() => ask('¿Qué significa la temperatura estimada del suelo de 0 a 10 cm y cómo se diferencia de la temperatura del aire?')}><Thermometer size={22} aria-hidden="true" /><span>Temperatura del suelo (0–10 cm)<strong>{num(climateNumber(data.suelo_ahora?.temperatura_0_10cm, -90, 65))}<small> °C</small></strong></span></button></div><p>Estimación del modelo meteorológico, no de un sensor en la parcela. No indica por sí sola que el suelo esté seco, óptimo o saturado.</p><details className="climate-water-details"><summary>Entender la relación entre lluvia y evaporación</summary><p>La lluvia aporta agua. La evapotranspiración de referencia (ET₀) estima la demanda de agua de una superficie de pasto de referencia.</p>{balance.complete ? <dl><div><dt>Lluvia del período</dt><dd>{num(balance.rain)} mm</dd></div><div><dt>ET₀ del mismo período</dt><dd>{num(balance.et0)} mm</dd></div><div><dt>Diferencia lluvia − ET₀</dt><dd>{num(balance.balance)} mm</dd></div></dl> : <p>Faltan días con lluvia y ET₀ coincidentes para calcular una diferencia completa.</p>}<p>Esta diferencia no es la dosis de riego de tu maíz ni mide el agua que queda en las raíces. Para decidir hacen falta el suelo, la etapa del cultivo, el agua aplicada y mediciones de campo.</p><p className="climate-source">Período: {periodLabel(period)} · Open-Meteo Archive.</p></details></section>
      <section className="climate-panel" aria-labelledby="climate-references-title"><SectionTitle icon={Leaf} id="climate-references-title" title="Referencias de la zona">Información adicional para consultar cuando la necesites.</SectionTitle><details className="climate-reference"><summary>Lluvia histórica anual de referencia</summary>{climateNumber(annual?.valor, 0) !== null ? <><strong className="climate-reference-number">{num(annual.valor)} mm/año</strong><p>Promedio histórico; no es la lluvia de este año ni la cantidad prevista para tu campaña.</p><p className="climate-source">{annual.fuente} · {typeof annual.periodo === 'string' ? annual.periodo : periodLabel(annual.periodo)}{annual.estacion ? ` · Estación ${annual.estacion}` : ''}</p></> : <Missing>No hay una referencia anual disponible para esta ubicación.</Missing>}</details><details className="climate-reference"><summary>El Niño y La Niña: referencia del Pacífico</summary>{index !== null ? <><p><strong>{enso.indice || (enso.roni != null ? 'RONI' : 'ONI')}: {num(index, 2)} °C</strong> · {enso.etiqueta_trimestre || enso.periodo}</p><p>{enso.estado_texto}. {enso.vigente === false ? 'La referencia no es reciente; revisa la fecha antes de usarla.' : 'El valor más reciente puede ser revisado por NOAA.'}</p><p>Este índice describe el Pacífico tropical. No pronostica cuánta lluvia caerá en tu parcela ni confirma un riesgo para tu cosecha.</p><a href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/" target="_blank" rel="noreferrer">Consultar NOAA <ExternalLink size={14} aria-hidden="true" /></a></> : <Missing>No se pudo consultar el índice de NOAA. El pronóstico local no se reemplaza por este índice.</Missing>}</details><button className="climate-help" onClick={() => ask('Ayúdame a interpretar Clima y cultivo. Resume los datos disponibles de mi parcela, distingue pronóstico, historial y observaciones, y dime qué información conviene registrar para decidir mejor.')}><MessageCircle size={22} aria-hidden="true" /><span><strong>¿Qué significa esto para mi cultivo?</strong><small>Consulta al asistente con los datos de esta parcela.</small></span><ArrowRight size={20} aria-hidden="true" /></button></section></div>
  </div>;
}
