import { useEffect, useRef, useState } from 'react';
import { Check, Info } from 'lucide-react';
import { parcelasService } from '../services/api';
import { camposCultivo, editarPeriodo, errorPeriodo, periodoCultivo } from '../utils/fieldInputs';
import { irrigationLabel, validateSowingPlan } from '../utils/sowingPlan';

const fields={date:'sowing-plan-date',kind:'sowing-plan-kind',harvest:'sowing-plan-harvest',cycle:'sowing-plan-cycle',irrigation:'sowing-plan-water'};
const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export default function SowingPlanForm({ plot, suggestion, onSaved, onCancel }) {
  const [period,setPeriod]=useState(() => periodoCultivo(plot.fecha_siembra, plot.ciclo_dias ?? (plot.fecha_siembra && plot.fecha_siembra === suggestion?.start ? suggestion.cycle : null)));
  const { fecha: date, dias: cycle, cosecha: end } = period;
  const [kind,setKind]=useState(plot.tipo_fecha_siembra || '');
  const [irrigation,setIrrigation]=useState(plot.riego_tipo || '');
  const [saving,setSaving]=useState(false);
  const [errors,setErrors]=useState({});
  const [serverError,setServerError]=useState('');
  const [usedSuggestion,setUsedSuggestion]=useState(false);
  const errorRef=useRef(null), submitting=useRef(false);
  const updatePeriod = (field, value) => {
    const next = editarPeriodo(period, field, value);
    if (next.fecha && next.fecha !== date && next.calculado === 'fecha') setKind('prevista');
    setPeriod(next);
    setErrors(previous => ({ ...previous, date: undefined, cycle: undefined, harvest: undefined }));
    setServerError('');
  };
  const clear = field => {setErrors(previous=>({...previous,[field]:undefined}));setServerError('');};
  const hasError = Object.values(errors).some(Boolean) || Boolean(serverError);
  const errorSignature = `${serverError}|${Object.entries(errors).filter(([,message])=>message).map(([field,message])=>`${field}:${message}`).join(';')}`;
  useEffect(() => {
    if (hasError) errorRef.current?.focus({ preventScroll: false });
  }, [hasError, errorSignature]);
  const submit=async event=>{
    event.preventDefault();if(submitting.current)return;
    const issues=validateSowingPlan({date,kind,cycle,irrigation},today());
    const issue = errorPeriodo(period, '2000-01-01');
    if (issue) issues.harvest = issue;
    setErrors(issues);setServerError('');
    if(Object.keys(issues).length){return;}
    const payload={id:Number(plot.id),fecha_siembra:date||null,tipo_fecha_siembra:date?kind:null,ciclo_dias:cycle===''?null:Number(cycle),riego_tipo:irrigation||null};
    submitting.current=true;setSaving(true);
    try {await parcelasService.actualizar(payload);onSaved?.(payload);}
    catch(error){setServerError(typeof error.response?.data?.error==='string'?error.response.data.error:'No pudimos guardar tu plan. Revisa tu conexión y vuelve a intentarlo.');}
    finally{submitting.current=false;setSaving(false);}
  };
  const inlineError=field=>errors[field]&&<p className="sowing-field-error" id={`${fields[field]}-error`}>{errors[field]}</p>;
  const a11y=field=>({'aria-invalid':Boolean(errors[field]),'aria-describedby':[`${fields[field]}-hint`,errors[field]&&`${fields[field]}-error`].filter(Boolean).join(' ')});
  return <form className="sowing-plan-form" aria-label="Editar planificación de la parcela" noValidate onSubmit={submit}>
    <header><h3>Completa tu plan</h3><p>Guarda lo que ya sabes. Puedes dejar la duración y el riego pendientes si aún no los conoces.</p></header>
    {(Object.values(errors).some(Boolean)||serverError)&&<div ref={errorRef} className="sowing-form-errors" role="alert" tabIndex={-1}><strong>Revisa estos datos para continuar</strong>{serverError&&<p>{serverError}</p>}<ul>{Object.entries(errors).filter(([,message])=>message).map(([field,message])=><li key={field}><a href={`#${fields[field]}`} onClick={event=>{event.preventDefault();document.getElementById(fields[field])?.focus();}}>{message}</a></li>)}</ul></div>}
    {suggestion && suggestion.fromSimulation && !usedSuggestion && <div className="sowing-suggestion"><Info size={20} aria-hidden="true"/><div><p>Hay una fecha o duración usada en una simulación. Puedes copiarla y revisarla antes de guardar.</p><button type="button" className="sowing-secondary" disabled={saving} onClick={()=>{if(!date&&suggestion.start)setKind('prevista');setPeriod(periodoCultivo(date || suggestion.start, cycle || ((date || suggestion.start) === suggestion.start ? suggestion.cycle : '')));setUsedSuggestion(true);setErrors({});}}>Usar los datos de esa simulación</button></div></div>}
    {plot.fecha_siembra && suggestion?.durationFromSimulation && <p>La duración propuesta procede de una simulación con esta misma fecha de siembra. Puedes ajustarla antes de guardar.</p>}
    <div className="sowing-plan-fields">
      <div><label htmlFor={fields.date}>Fecha de siembra</label><p id={`${fields.date}-hint`}>El día que planeas sembrar o el día que ya sembraste.</p><input id={fields.date} type="date" min="2000-01-01" max="2100-12-31" value={date} disabled={saving} {...a11y('date')} onChange={event=>{updatePeriod('fecha',event.target.value);}}/>{inlineError('date')}</div>
      <div><label htmlFor={fields.kind}>¿Ya sembraste en esa fecha?</label><p id={`${fields.kind}-hint`}>Esto distingue un plan de una siembra que ya realizaste.</p><select id={fields.kind} value={kind} disabled={saving||!date} {...a11y('kind')} onChange={event=>{setKind(event.target.value);clear('kind');clear('date');}}><option value="">Elige una opción</option><option value="prevista">Voy a sembrar (fecha prevista)</option><option value="real_declarada">Ya sembré (fecha realizada)</option></select>{inlineError('kind')}</div>
      <div><label htmlFor={fields.harvest}>Fecha prevista de cosecha</label><p id={`${fields.harvest}-hint`}>Completa dos de los tres datos: siembra, cosecha o duración. La siembra cuenta como día 1.</p><input id={fields.harvest} type="date" min={date || '2000-01-01'} value={end} disabled={saving} {...a11y('harvest')} onChange={event => updatePeriod('cosecha',event.target.value)}/>{inlineError('harvest')}</div>
      <div><label htmlFor={fields.cycle}>Duración del cultivo en días</label><p id={`${fields.cycle}-hint`}>Si ingresas las dos fechas, los días se calculan automáticamente. Puedes ajustar la duración para cambiar la cosecha prevista.</p><input id={fields.cycle} type="number" min="1" max="730" step="1" inputMode="numeric" value={cycle} disabled={saving} {...a11y('cycle')} onChange={event=>{updatePeriod('dias',event.target.value);}}/>{inlineError('cycle')}</div>
      <div><label htmlFor={fields.irrigation}>Agua o riego del cultivo</label><p id={`${fields.irrigation}-hint`}>Elige cómo recibirá agua tu maíz.</p><select id={fields.irrigation} value={irrigation} disabled={saving} {...a11y('irrigation')} onChange={event=>{setIrrigation(event.target.value);clear('irrigation');}}><option value="">Todavía no lo sé</option>{Object.keys(camposCultivo.riego_tipo.opciones).map(value=><option key={value} value={value}>{irrigationLabel(value)}</option>)}</select>{inlineError('irrigation')}</div>
    </div>
    <div className="sowing-form-preview"><Check size={20} aria-hidden="true"/><p>{end?<>Con esa fecha y duración, el cultivo terminaría cerca del <strong>{new Date(`${end}T12:00:00`).toLocaleDateString('es-EC',{day:'numeric',month:'long',year:'numeric'})}</strong>. Es una referencia para preparar la cosecha.</>:'Al guardar una fecha y la duración, podrás ver el fin aproximado del cultivo.'}</p></div>
    <div className="sowing-plan-actions"><button type="submit" className="ydp-primary-action" disabled={saving}>{saving?'Guardando tu plan…':'Guardar mi plan'}</button><button type="button" className="sowing-secondary" disabled={saving} onClick={onCancel}>Cancelar</button></div>
  </form>;
}
