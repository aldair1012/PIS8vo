import { useState } from 'react';
import { dssService } from '../services/api';

const fields = ['grano_seco_kg', 'biomasa_seca_kg', 'fecha_cosecha', 'capacidad_campo_pct', 'marchitez_pct', 'profundidad_cm', 'fecha_suelo', 'etapa', 'fecha_observacion', 'plaga', 'incidencia_pct'];
const stages = [['VE', 'Emergencia'], ['V2-V8', 'Vegetativo V2–V8'], ['V9-VT', 'Vegetativo avanzado'], ['VT-R1', 'Floración / polinización'], ['R2-R5', 'Formación y llenado de grano'], ['R6', 'Madurez fisiológica']];

export default function MedicionesRendimiento({ lote, registro, onSaved, defaultOpen = false }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field, registro?.datos?.[field] ?? ''])));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const futureSowing = lote.fecha_siembra && String(lote.fecha_siembra).slice(0, 10) > today;
  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  const number = (name, label, min, max, placeholder) => <label>{label}<input name={name} type="number" step="any" min={min} max={max} value={values[name]} placeholder={placeholder} onChange={change} /></label>;
  const date = (name, label) => <label>{label}<input name={name} type="date" max={today} value={values[name]} placeholder="dd/mm/aaaa" onChange={change} /></label>;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const changes = Object.fromEntries(fields.filter((field) => String(values[field]) !== String(registro?.datos?.[field] ?? '')).map((field) => [field, values[field]]));
      if (Object.keys(changes).length === 0) { setStatus({ message: 'No hay cambios para guardar.' }); return; }
      const result = await dssService.saveRendimientoMediciones(lote.id, changes);
      await onSaved(result.mediciones);
      setStatus({ message: 'Mediciones guardadas. Los indicadores ya están actualizados.' });
    } catch (error) {
      const detail = error.response?.data?.error;
      setStatus({ error: true, message: typeof detail === 'string' ? detail : 'No se pudieron guardar las mediciones. Revisa los grupos y sus fechas.' });
    } finally {
      setSaving(false);
    }
  };

  return <details className="yd-source-details yd-field-record" open={defaultOpen || undefined}>
    <summary>Completar datos medidos de esta parcela<span>Cosecha · suelo · observaciones</span></summary>
    <form onSubmit={save}>
      <p>Registra únicamente mediciones que tengas. Cada grupo necesita sus valores y su fecha. Se guardan como datos declarados por el productor.</p>
      {futureSowing && <p className="yd-field-notice">Siembra programada: {String(lote.fecha_siembra).slice(0, 10)}. Las observaciones del cultivo y la cosecha se habilitan desde esa fecha; puedes registrar antes el análisis del suelo.</p>}
      <div className="yd-measurement-grid">
        <fieldset disabled={futureSowing || saving}>
          <legend>Índice de cosecha</legend>
          <p>Grano seco y biomasa aérea seca total de la misma muestra. La biomasa incluye el grano.</p>
          {number('grano_seco_kg', 'Grano seco (kg)', 0, 1e9, 'Ej.: 1300')}
          {number('biomasa_seca_kg', 'Biomasa aérea seca total (kg)', 0.000001, 1e9, 'Ej.: 1850')}
          {date('fecha_cosecha', 'Fecha de cosecha / muestreo')}
        </fieldset>
        <fieldset disabled={saving}>
          <legend>Capacidad de agua del suelo</legend>
          <p>Contenido volumétrico de agua del análisis del suelo y profundidad del perfil evaluado.</p>
          {number('capacidad_campo_pct', 'Capacidad de campo (% vol.)', 0, 100, 'Ej.: 32')}
          {number('marchitez_pct', 'Punto de marchitez (% vol.)', 0, 100, 'Ej.: 18')}
          {number('profundidad_cm', 'Profundidad evaluada (cm)', 0.1, 200, 'Ej.: 30')}
          {date('fecha_suelo', 'Fecha del análisis')}
        </fieldset>
        <fieldset disabled={futureSowing || saving}>
          <legend>Observación del cultivo</legend>
          <label>Etapa observada<select name="etapa" value={values.etapa} onChange={change}><option value="">Sin observación</option>{stages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Plaga observada<input name="plaga" maxLength={150} value={values.plaga} placeholder="Ej.: Cogollero" onChange={change} /></label>
          {number('incidencia_pct', 'Plantas afectadas (%)', 0, 100, 'Ej.: 5')}
          {date('fecha_observacion', 'Fecha de la observación')}
        </fieldset>
      </div>
      <div className="yd-field-actions"><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar mediciones'}</button>{status && <p role={status.error ? 'alert' : 'status'}>{status.message}</p>}</div>
    </form>
  </details>;
}
