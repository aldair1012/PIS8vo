import { useState } from 'react';
import { cropPhases, cropWaterWeek, climateDate } from '../utils/climateEvidence';

const number = value => value.toLocaleString('es-EC', { maximumFractionDigits: 1 });
const range = ([low, high]) => low === high ? number(low) : `${number(low)} a ${number(high)}`;

export function WeeklyCropWater({ forecast, today, observation, stale }) {
  const [phase, setPhase] = useState('');
  const result = cropWaterWeek(forecast, today, phase);
  return <details className="climate-water-details">
    <summary>¿Alcanzaría la lluvia para el maíz esta semana?</summary>
    <p>Elige la fase que esperas durante los siete días para comparar la lluvia prevista con la demanda de un maíz de grano en condiciones estándar.</p>
    {observation?.valor && <p>Última observación de campo · {observation.valor} · {observation.fecha}.</p>}
    <label>Fase para el cálculo <select value={phase} onChange={event => setPhase(event.target.value)}>
      <option value="">Seleccionar fase del maíz</option>
      {Object.entries(cropPhases).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
    </select></label>
    {phase && (result ? <>
      <p><strong>{result.balance[1] < 0 ? 'La lluvia prevista queda por debajo de la demanda.' : result.balance[0] > 0 ? 'La lluvia prevista supera la demanda estimada.' : 'La lluvia puede cubrir la demanda según el coeficiente usado.'}</strong></p>
      <dl><div><dt>Lluvia prevista</dt><dd>{number(result.rain)} mm</dd></div><div><dt>Demanda del cultivo (ETc)</dt><dd>{range(result.demand)} mm</dd></div><div><dt>Lluvia menos demanda</dt><dd>{range(result.balance)} mm</dd></div></dl>
      <p>Del {today} al {forecast[6].fecha}. ET₀ prevista de {number(result.et0)} mm × coeficiente Kc de {range(cropPhases[phase].kc)}. En fases de transición se muestra el intervalo entre los extremos publicados.</p>
    </> : <p>Para calcular la semana hacen falta siete fechas seguidas desde hoy con lluvia y ET₀. Vuelve a actualizar el clima.</p>)}
    {stale && <p>Se usa el último pronóstico guardado. Comprueba su fecha antes de planificar labores.</p>}
    <p>El cálculo usa lluvia total y asume cultivo sano y sin estrés. La infiltración, el riego aplicado y el agua almacenada en las raíces requieren información de campo.</p>
    <a href="https://www.fao.org/4/X0490E/x0490e0b.htm" target="_blank" rel="noreferrer">FAO-56 · tabla 12, maíz de grano</a>
  </details>;
}

export function ThermalTimeline({ thermal, observation, plan, today }) {
  const events = (thermal?.hitos || []).map(item => ({ date: item.fecha, label: `${item.etapa} · umbral de ${number(item.gdd_umbral)} °C·día`, origin: 'Estimación térmica' }));
  if (observation?.valor && climateDate(observation.fecha) && plan.kind === 'real_declarada' && plan.start && observation.fecha >= plan.start && observation.fecha <= today && (!plan.end || observation.fecha <= plan.end)) {
    events.push({ date: observation.fecha, label: observation.valor, origin: 'Observación del productor' });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  return <details className="climate-water-details"><summary>Desarrollo del maíz por grados-día</summary>
    {thermal ? <><p><strong>{thermal.gdd != null ? number(thermal.gdd) : number(thermal.gdd_parcial)} °C·día {thermal.gdd == null ? 'con cobertura parcial' : 'acumulados'}</strong> · {thermal.dias_validos} de {thermal.dias_esperados} días con temperatura mínima y máxima entre {thermal.inicio} y {thermal.fin}.</p>
      <p>{thermal.fuente} · malla de {thermal.resolucion} · consulta {thermal.consultado_utc?.slice(0, 10)}. El archivo se consulta con siete días de margen.</p></> :
      <p>{plan.kind === 'real_declarada' ? 'Aún no hay datos térmicos de archivo para esta campaña. Revisa las coordenadas, la duración y la fecha de siembra.' : 'Confirma la fecha real de siembra para acumular calor desde ese día.'}</p>}
    {events.length > 0 && <ol>{events.map(item => <li key={item.date + item.label}><time dateTime={item.date}>{item.date}</time> · <strong>{item.label}</strong> · {item.origin}</li>)}</ol>}
    <p>La media diaria de mínimas y máximas se ajusta con base de 10 °C y techo de 30 °C. Las fechas térmicas ilustran un híbrido de referencia de Kentucky. Falta calibrar esos umbrales para la variedad ecuatoriana de esta parcela.</p>
    <a href="https://publications.mgcafe.uky.edu/files/agr202.pdf" target="_blank" rel="noreferrer">University of Kentucky · AGR-202, tabla 2</a>
  </details>;
}
