import { useEffect, useState } from 'react';
import { CalendarDays, Sprout, Droplets, Bug, Layers, ExternalLink, Info } from 'lucide-react';
import { parcelasService } from '../services/api';
import { evidenceDate, evidenceNumber } from '../utils/agronomicEvidence';
import '../assets/agricultural-calendar.css';

const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function SourceLink({ guide, id, page }) {
  const source=guide?.fuentes?.[id];
  if (!source?.url?.startsWith('https://')) return null;
  const label=`${source.institucion}${source.anio?` · ${source.anio}`:''}${page?` · PDF pág. ${page}`:''}`;
  return <a className="ag-calendar-source" aria-label={`${label} (abre en otra pestaña)`} href={`${source.url}${page?`#page=${page}`:''}`} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={15} aria-hidden="true"/></a>;
}

export default function AgriculturalCalendar({ guide, plot, plan, onEditPlan }) {
  const [month,setMonth]=useState(()=>evidenceDate(plan.start)?.getMonth()??new Date().getMonth());
  const [soil,setSoil]=useState(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if (!plot.id) return;
    let active=true;
    const controller=new AbortController();
    parcelasService.obtenerValoresUbicacion(plot.id,{signal:controller.signal}).then(data=>{
      if(active)setSoil({key:plot.id,data:data?.exito===true?data:null});
    }).catch(()=>{if(active)setSoil({key:plot.id,data:null});});
    return ()=>{active=false;controller.abort();};
  },[plot.id,retry]);
  const windows=guide?.ventana;
  const referenced=Array.isArray(windows?.meses)&&windows.meses.includes(month+1);
  const start=evidenceDate(plan.start);
  const end=evidenceDate(plan.end);
  const currentSoil=soil?.key===plot.id?soil:undefined;
  const mapped=currentSoil?.data?.referencia_suelo;
  const storedPh=evidenceNumber(plot.ph);
  const fieldPh=storedPh??evidenceNumber(currentSoil?.data?.ph_suelo);
  const health=guide?.sanidad;
  const requirements=guide?.suelo;
  const dateLabel=date=>date?.toLocaleDateString('es-EC',{day:'numeric',month:'long',year:'numeric'});
  const sowingLabel=plan.fromSimulation?'Fecha usada en una simulación':plan.kind==='real_declarada'?'Tu siembra declarada':plan.kind==='prevista'?'Tu siembra prevista':'Siembra por confirmar';

  return <section className="ag-calendar" aria-labelledby="ag-calendar-title">
    <header className="ag-calendar-header"><span className="ag-calendar-heading-icon"><CalendarDays size={24} aria-hidden="true"/></span><div><p className="ag-calendar-eyebrow">PARA PLANIFICAR TU CULTIVO</p><h2 id="ag-calendar-title">Calendario agrícola de tu zona</h2><p>{guide?.provincia||'Provincia por identificar'} · {guide?.variedad||plot.variedad_maiz||'Maíz por identificar'}</p></div></header>
    <p className="ag-calendar-lead">Elige un mes para consultar la época de siembra. Debajo encontrarás qué suelo necesita el maíz y qué problemas se han reportado en la zona.</p>
    {guide?.avisos?.length>0&&<div className="ag-calendar-notice"><Info size={20} aria-hidden="true"/><div>{guide.avisos.map(text=><p key={text}>{text}</p>)}</div></div>}
    <div className="ag-calendar-season"><Sprout size={22} aria-hidden="true"/><div><span>Época publicada para sembrar</span><strong>{windows?.etiqueta||'Sin una ventana verificada para esta parcela'}</strong><p>{guide?.alcance||'No se recibió una guía institucional para esta combinación.'} · No es una fecha óptima calculada para esta variedad.</p></div></div>
    <div className="ag-calendar-months" role="group" aria-label="Meses del calendario agrícola">{months.map((name,index)=>{
      const recommended=windows?.meses?.includes(index+1)===true;
      const sowing=start?.getMonth()===index;
      const harvest=end?.getMonth()===index;
      return <button type="button" key={name} className={`ag-calendar-month${recommended?' has-reference':''}`} aria-pressed={month===index} aria-controls="ag-calendar-month-detail" onClick={()=>setMonth(index)}>
        <span className="ag-calendar-month-name">{name}</span><span className="ag-calendar-month-state">{recommended?'Época publicada':'Sin referencia'}</span>
        {(sowing||harvest)&&<span className="ag-calendar-plan-marks">{sowing&&<span><Sprout size={14} aria-hidden="true"/>{plan.fromSimulation?'Fecha simulada':'Tu siembra'} {start.getFullYear()}</span>}{harvest&&<span><CalendarDays size={14} aria-hidden="true"/>Fin aprox. {end.getFullYear()}</span>}</span>}
      </button>;
    })}</div>
    <div className="ag-calendar-month-detail" id="ag-calendar-month-detail" aria-live="polite" aria-atomic="true"><h3>{months[month]} <span>{referenced?'Dentro de la época publicada':'Sin una ventana publicada para este mes'}</span></h3><p>{referenced?windows.detalle:'Esto no significa que no puedas sembrar. Confirma las lluvias, el riego y la adaptación del maíz antes de decidir.'}</p>
      {start?.getMonth()===month&&<p className="ag-calendar-own-date"><Sprout size={18} aria-hidden="true"/>{sowingLabel}: {dateLabel(start)}.</p>}
      {end?.getMonth()===month&&<p className="ag-calendar-own-date"><CalendarDays size={18} aria-hidden="true"/>Fin aproximado de tu cultivo: {dateLabel(end)}.</p>}
      <p className="ag-calendar-small">La guía se repite por meses; no pronostica el tiempo de un año. Consultarla no cambia tu plan.</p>
      {windows&&<div className="ag-calendar-source-row"><SourceLink guide={guide} id={windows.fuente_id} page={windows.pagina_pdf}/>{windows.fuente_complementaria_id&&<SourceLink guide={guide} id={windows.fuente_complementaria_id} page={windows.pagina_complementaria_pdf}/>}</div>}
      <button type="button" className="sowing-secondary" onClick={onEditPlan}>Elegir una fecha en mi plan</button>
    </div>
    <div className="ag-calendar-context">
      <section className="ag-calendar-soil" aria-labelledby="ag-soil-title"><h3 id="ag-soil-title"><Layers size={22} aria-hidden="true"/>Suelo y agua</h3>
        {requirements?<><p className="ag-calendar-label">Lo que recomienda la guía</p><p>{requirements.texturas.join(', ')}.</p><p><strong>pH de referencia: {requirements.ph_min.toLocaleString('es-EC')}–{requirements.ph_max.toLocaleString('es-EC')}</strong></p><p>{requirements.detalle}</p><SourceLink guide={guide} id={requirements.fuente_id} page={requirements.pagina_pdf}/></>:<p>No tenemos requisitos documentados para el maíz registrado.</p>}
        <div className="ag-calendar-field-soil"><h4>Referencia de tu parcela</h4>{currentSoil===undefined?<p role="status">Consultando los datos del terreno…</p>:<>
          <p><strong>Textura:</strong> {mapped?.clase_estimada||'Sin estimación disponible'}</p>
          {fieldPh!==null&&<p><strong>pH {storedPh!==null?'registrado':'de referencia'}:</strong> {fieldPh.toLocaleString('es-EC')}</p>}
          {mapped?<p className="ag-calendar-small">{mapped.fuente} · {mapped.profundidad}. Es una estimación superficial del mapa; no reemplaza un análisis del suelo.</p>:<><p className="ag-calendar-small">La guía sigue disponible aunque el servicio de suelo no responda.</p><button type="button" className="sowing-secondary" onClick={()=>{setSoil(null);setRetry(value=>value+1);}}>Volver a consultar el terreno</button></>}
        </>}</div>
        <p className="ag-calendar-water"><Droplets size={20} aria-hidden="true"/>{guide?.riego?.nota||'Confirma el agua disponible antes de sembrar.'}</p>
      </section>
      <section className="ag-calendar-health" aria-labelledby="ag-health-title"><h3 id="ag-health-title"><Bug size={22} aria-hidden="true"/>Qué conviene vigilar</h3>
        {health?<><p className="ag-calendar-label">Antecedentes: {health.periodo}</p><p>{health.alcance}. La fuente documenta:</p><ul>{health.problemas.map(item=><li key={item.nombre}><strong>{item.nombre}</strong><span>{item.tipo}</span></li>)}</ul><SourceLink guide={guide} id={health.fuente_id} page={health.pagina_pdf}/></>:<p>No tenemos un informe provincial verificado para esta combinación de maíz y zona.</p>}
        <div className="ag-calendar-health-note"><Info size={20} aria-hidden="true"/><p>{guide?.vigilancia_actual?.nota||'No hay un reporte actual integrado para esta parcela.'}</p></div>
        <p>Si observas daños, registra la fecha y toma fotografías para consultar a un técnico. Un síntoma por sí solo no identifica su causa.</p>
        <SourceLink guide={guide} id="agrocalidad_vigilancia"/>
      </section>
    </div>
    <details className="ag-calendar-sources"><summary>Ver fuentes y alcance de esta guía</summary><p>Información institucional seleccionada según provincia y grupo de maíz. No certifica la parcela ni sustituye la revisión en campo. La variedad registrada se conserva.</p><ul>{Object.entries(guide?.fuentes||{}).map(([id,source])=><li key={id}><strong>{source.titulo}</strong><SourceLink guide={guide} id={id}/>{source.nota&&<p>{source.nota}</p>}</li>)}</ul></details>
  </section>;
}
