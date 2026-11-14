import { camposCultivo, finCultivo } from '../utils/fieldInputs';
import { parseScenarioNumber, normalizarDecimalEntrada } from '../utils/simulationInput';

export default function ParametrosCampo({ fecha, onFechaChange, valores, onChange, ficha, historico, onHistoricoChange }) {
  const fin = finCultivo(fecha, parseScenarioNumber(valores.ciclo_dias));
  const duracionPublicada = ficha?.cosecha_orientativa_dias.grano_seco;
  return <details className="simulation-optional">
    <summary><span>Completar datos del cultivo <small>Opcional</small></span></summary>
    <div className="simulation-optional-body">
    <p>Si conoces estos datos, agrégalos para reducir las referencias que usa el modelo. Déjalos vacíos cuando no los tengas; escribe 0 solo si has confirmado que no aplicaste ese nutriente.</p>
    <div className="form-group">
      <label className="form-label" htmlFor="campo-fecha">Fecha de siembra del escenario</label>
      <input id="campo-fecha" className="form-input" type="date" min="1950-01-01" max="2100-12-31" value={fecha} onChange={event => onFechaChange(event.target.value)} />
      <p className="form-hint">Se propone la fecha guardada en la parcela. Puedes cambiarla para planificar otra siembra.</p>
    </div>
    <div className="simulacion-grid-2">
      {Object.entries(camposCultivo).filter(([key]) => !['riego_tipo','lamina_riego_mm','magnesio_kg_ha','azufre_kg_ha','aplicaciones_nitrogeno'].includes(key)).map(([key, rule]) => <div className="form-group" key={key}>
        <label className="form-label" htmlFor={`campo-${key}`}>{rule.label}</label>
        {rule.opciones ? <select id={`campo-${key}`} className="form-select" value={valores[key] ?? ''} onChange={event => onChange({ ...valores, [key]: event.target.value })}>
          <option value="">Sin dato registrado</option>
          {Object.entries(rule.opciones).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select> : <input id={`campo-${key}`} className="form-input" type="text" inputMode={rule.entero ? 'numeric' : 'decimal'} placeholder={{ ciclo_dias: 'Ej.: 120', densidad_plantas_ha: 'Ej.: 75000', lamina_riego_mm: 'Ej.: 120', fosforo_p2o5_kg_ha: 'Ej.: 30', potasio_k2o_kg_ha: 'Ej.: 20', magnesio_kg_ha: 'Ej.: 15', azufre_kg_ha: 'Ej.: 10', aplicaciones_nitrogeno: 'Ej.: 2', materia_organica_pct: 'Ej.: 2,5', profundidad_suelo_cm: 'Ej.: 40', temperatura_min_c: 'Ej.: 19', temperatura_max_c: 'Ej.: 29' }[key]} value={valores[key] ?? ''} onChange={event => onChange({ ...valores, [key]: event.target.value })} onBlur={event => onChange({ ...valores, [key]: normalizarDecimalEntrada(event.target.value) })} />}
      </div>)}
    </div>
    {duracionPublicada && <button className="btn btn-outline" type="button" onClick={() => onChange({ ...valores, ciclo_dias: String(duracionPublicada) })}>Usar referencia para grano: {duracionPublicada} días</button>}
    {fin && <p role="status">Fin orientativo del ciclo: <strong>{fin}</strong>. El primer día es el de siembra. El clima y el manejo pueden cambiar la fecha real de cosecha.</p>}
    <label className="simulation-checkbox">
      <input type="checkbox" checked={Boolean(historico)} onChange={event => onHistoricoChange(event.target.checked)} />
      Adjuntar referencia del clima pasado de este periodo
    </label>
    <p className="form-hint">Consulta días pasados por coordenadas. Se usa al ejecutar la simulación; no predice meses futuros ni reemplaza los valores del escenario.</p>
    {historico && !fin && <p role="status" className="form-hint" style={{ color: 'var(--danger, #b00020)' }}>Para que se use, completa la <strong>fecha de siembra</strong> y la <strong>duración del ciclo</strong> en días.</p>}
    </div>
  </details>;
}
