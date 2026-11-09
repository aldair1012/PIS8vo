import { ArrowLeft, ArrowUpRight, Check, Info, Sprout, CloudRain } from 'lucide-react';
import { camposCultivo } from '../utils/fieldInputs';
import { yieldFactors } from '../utils/yieldDashboard';

const number = value => !['number','string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const format = (value, digits = 2) => number(value) === null ? 'No disponible' : new Intl.NumberFormat('es-EC', { maximumFractionDigits: digits }).format(number(value));
const text = rec => (typeof rec === 'string' ? rec : rec?.texto ?? '').replace(/【[^】]*】/g, '').trim();

export default function ResultadoSimulacion({ result, parcela, areaSimulada, onEditar, onAnalisis, headingRef }) {
  const trace = result.trazabilidad ?? {};
  const entries = result.entradas_modelo ?? {};
  const range = result.intervalo_rendimiento;
  const estimated = number(result.rendimiento_estimado);
  const validRange = range && number(range.min) !== null && number(range.max) !== null && number(range.max) >= number(range.min);
  const position = validRange && range.max > range.min && estimated !== null ? Math.min(100, Math.max(0, (estimated - range.min) / (range.max - range.min) * 100)) : 50;
  const recommendations = Array.isArray(result.recomendaciones) ? result.recomendaciones.map(text).filter(Boolean) : [];
  const assumptions = Array.isArray(trace.supuestos) ? trace.supuestos : Object.keys(trace.fuentes ?? {}).filter(key => /Referencia del conjunto|Referencia histórica/.test(trace.fuentes[key]));
  const scenarios = [['lluvioso', 'Lluvioso'], ['verano', 'Verano'], ['sequia', 'Sequía']].map(([key, label]) => ({ label, value: number(result.escenarios?.[key]?.rendimiento) })).filter(row => row.value !== null);
  const maxScenario = Math.max(estimated ?? 0, ...scenarios.map(row => row.value), 1);
  const weather = trace.clima_ciclo;
  return <article className="simulation-result" aria-labelledby="resultado-titulo">
    <header className="simulation-result-heading">
      <div><p className="simulation-eyebrow">Tu escenario calculado</p><h1 id="resultado-titulo" tabIndex={-1} ref={headingRef}>Resultado de la simulación</h1><p>{parcela?.nombre_parcela} · Grano seco</p></div>
      {result.simulacion_id && <span className="simulation-saved"><Check size={16} /> Guardada · #{result.simulacion_id}</span>}
    </header>
    {trace.variedad_simulada?.estado === 'referencia_general' && <p className="simulation-notice"><Info size={18} /><span>El cálculo utilizó una variedad de referencia. No es una estimación específica de la semilla registrada.</span></p>}
    <section className="simulation-harvest" aria-label="Estimación de cosecha">
      <div className="simulation-yield"><span className="simulation-kicker"><Sprout size={18} /> Rendimiento estimado</span><strong>{format(estimated)} <small>t/ha</small></strong><p>Toneladas de grano seco por hectárea en este escenario.</p></div>
      <div className="simulation-production"><span>Producción para tu superficie</span><strong>{format(result.produccion_total)} <small>t</small></strong><p>Para {format(areaSimulada)} ha. Es una estimación, no una cosecha garantizada.</p></div>
      {validRange && <div className="simulation-range"><div><span>Rango orientativo</span><strong>{format(range.min)}–{format(range.max)} t/ha</strong></div><div className="simulation-range-track" role="img" aria-label={`Rango orientativo de ${format(range.min)} a ${format(range.max)} toneladas por hectárea; estimación ${format(estimated)}`}><span style={{ left: `${position}%` }} /></div><p>Da una referencia de cuánto puede variar la estimación según el error del modelo. No asegura que tu cosecha quede dentro de este rango.</p></div>}
    </section>
    <div className="simulation-result-actions"><button type="button" className="btn btn-secondary" onClick={onEditar}><ArrowLeft size={17} /> Modificar escenario</button>{onAnalisis && <button type="button" className="btn btn-primary" onClick={onAnalisis}>Abrir análisis de la parcela <ArrowUpRight size={17} /></button>}</div>
    <div className="simulation-result-grid">
      <section className="simulation-section"><h3>Cómo interpretar este resultado</h3><p>La estimación combina los datos que ingresaste con referencias para las variables que faltan. Úsala para comparar escenarios y planificar.</p><dl className="simulation-facts"><div><dt>Provincia de la parcela</dt><dd>{trace.provincia_identificada?.provincia ?? entries.provincia ?? 'Sin confirmar'}</dd></div><div><dt>Agua o sistema de riego</dt><dd>{camposCultivo.riego_tipo.opciones[entries.riego_tipo] ?? 'Referencia sin especificar'}</dd></div><div><dt>Variedad utilizada</dt><dd>{trace.variedad_simulada?.utilizada_por_modelo ?? entries.variedad ?? 'No disponible'}</dd></div>{trace.calendario?.fecha_fin_estimada && <div><dt>Periodo orientativo</dt><dd>{trace.calendario.fecha_siembra} a {trace.calendario.fecha_fin_estimada} · {format(trace.calendario.ciclo_dias, 0)} días</dd></div>}</dl><p className="simulation-small">{assumptions.length} de las {Object.keys(entries).length} variables del cálculo se completaron con referencias. Esta cantidad no mide la precisión de tu cosecha.</p></section>
      <section className="simulation-section"><h3>Aspectos que conviene revisar</h3>{recommendations.length ? <><ul className="simulation-observations">{recommendations.slice(0, 3).map((rec, index) => <li key={index}>{rec}</li>)}</ul>{recommendations.length > 3 && <details className="simulation-disclosure"><summary>Ver las otras {recommendations.length - 3} observaciones</summary><ul className="simulation-observations">{recommendations.slice(3).map((rec, index) => <li key={index}>{rec}</li>)}</ul></details>}</> : <p>No se recibieron observaciones para esta ejecución.</p>}</section>
    </div>
    {scenarios.length > 0 && <section className="simulation-section"><h3><CloudRain size={19} /> Si cambian las condiciones del clima</h3><p>Son alternativas calculadas con condiciones fijas. No predicen el clima que tendrá tu cultivo.</p><div className="simulation-scenarios">{scenarios.map(row => <div key={row.label}><span>{row.label}</span><div aria-hidden="true"><span style={{ width: `${row.value / maxScenario * 100}%` }} /></div><strong>{format(row.value)} t/ha</strong></div>)}</div></section>}
    <details className="simulation-section simulation-disclosure"><summary>Datos utilizados y límites del cálculo</summary><div className="simulation-provenance-body">
      <p>Estas son las entradas reales del motor. Una referencia asumida no es una medición de tu parcela.</p>
      <div className="simulation-data-scroll"><table><thead><tr><th scope="col">Variable</th><th scope="col">Valor utilizado</th><th scope="col">Origen</th></tr></thead><tbody>{Object.entries(entries).map(([key, value]) => <tr key={key}><th scope="row">{camposCultivo[key]?.label ?? yieldFactors[key] ?? key.replaceAll('_', ' ')}</th><td>{typeof value === 'number' ? format(value, 4) : String(value ?? 'No disponible')}</td><td>{trace.fuentes?.[key] ?? 'Sin origen identificado'}</td></tr>)}</tbody></table></div>
      {trace.advertencias?.length > 0 && <ul className="simulation-observations">{trace.advertencias.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      {weather && weather.estado !== 'no_solicitado' && <section><h4>Referencia climática del periodo</h4>{weather.estado === 'periodo_pasado_consultado' ? <><p>{weather.inicio_consultado} a {weather.fin_consultado} · {weather.fuente}.</p><p>{weather.cobertura?.precipitation_complete ? `Lluvia acumulada en los días consultados: ${format(weather.resumen?.precipitacion_total_mm)} mm.` : 'La serie no está completa; no se presenta como un total del periodo.'}</p>{!weather.fin_del_ciclo_incluido && <p>La referencia no cubre todo el ciclo ni los días futuros.</p>}</> : <p>{({ sin_coordenadas: 'Faltan coordenadas de la parcela.', falta_fecha_siembra: 'Falta la fecha de siembra.', sin_dias_pasados_disponibles: 'El periodo todavía no tiene días pasados disponibles.', proveedor_no_disponible: 'El proveedor no respondió.' })[weather.estado] ?? 'Referencia no disponible.'}</p>}</section>}
      <p className="simulation-small">R² de validación global: {format(result.metricas_modelo?.r2)}. No es la probabilidad de acertar esta cosecha. La precisión con cosechas independientes sigue pendiente de comprobar.</p>
    </div></details>
  </article>;
}
