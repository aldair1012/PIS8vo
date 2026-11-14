import { evidenceDate, evidenceNumber } from './agronomicEvidence.js';
import { finCultivo } from './fieldInputs.js';

export const dateKindLabel = value => value === 'real_declarada' ? 'Real declarada por el productor' : value === 'prevista' ? 'Fecha prevista' : 'Tipo de fecha por confirmar';

export const irrigationLabel = value => ({temporal_lluvia:'Solo lluvia (sin riego)',goteo:'Riego por goteo',aspersion:'Riego por aspersión',gravedad:'Riego por gravedad',goteo_aspersion:'Goteo y aspersión',aspersion_lluvia:'Lluvia y aspersión',lluvia_complementario:'Lluvia con riego de apoyo',natural_exceso:'Exceso de agua registrado'})[value] || 'Por completar';

export function sowingPlanning(plot = {}, calendar = {}) {
  const iso = value => evidenceDate(value) ? String(value).slice(0,10) : null;
  const days = value => { const n=evidenceNumber(value); return Number.isInteger(n)&&n>=1&&n<=730?n:null; };
  const ownDate=iso(plot.fecha_siembra);
  const referenceDate=iso(calendar?.fecha_siembra) || iso(calendar?.eventos?.find(event=>event.tipo!=='fin_ciclo_estimado')?.fecha);
  const start=ownDate || referenceDate;
  const ownCycle=days(plot.ciclo_dias);
  const cycle=ownCycle ?? (start && referenceDate===start?days(calendar?.ciclo_dias):null);
  const kind=ownDate?plot.tipo_fecha_siembra:calendar?.tipo_fecha_siembra;
  const end=finCultivo(start,cycle);
  const water=plot.riego_tipo || calendar?.riego_tipo;
  return {start,end,cycle,kind,water,ownDate,ownCycle,
    fromSimulation:Boolean(start&&!ownDate),durationFromSimulation:Boolean(cycle!==null&&ownCycle===null),
    pending:[!ownDate&&'fecha de siembra',ownDate&&!['prevista','real_declarada'].includes(kind)&&'si ya sembraste en esa fecha',ownCycle===null&&'duración del cultivo',!water&&'agua o riego'].filter(Boolean)};
}

export function validateSowingPlan({date,kind,cycle,irrigation},today) {
  const errors={};
  if(date && (!evidenceDate(date)||date<'2000-01-01'||date>'2100-12-31')) errors.date='Escribe una fecha válida entre 2000 y 2100.';
  if(date&&!['prevista','real_declarada'].includes(kind)) errors.kind='Indica si vas a sembrar o si ya sembraste en esa fecha.';
  if(date&&kind==='real_declarada'&&date>today) errors.date='Si todavía no llega esa fecha, elige «Voy a sembrar». Una siembra realizada no puede estar en el futuro.';
  const value=evidenceNumber(cycle);
  if(cycle!==''&&(value===null||!Number.isInteger(value)||value<1||value>730)) errors.cycle='Escribe una cantidad de días enteros entre 1 y 730, o deja el campo vacío.';
  if(irrigation && irrigationLabel(irrigation)==='Por completar') errors.irrigation='Elige una de las opciones de agua o riego.';
  return errors;
}

export function savedSowingRows(data, order = 'recientes') {
  const source = Array.isArray(data.simulaciones) ? data.simulaciones : (Array.isArray(data.heatmap) ? data.heatmap : []);
  const ids = new Set();
  const rows = source.flatMap(raw => {
    const id = raw?.id ?? raw?.simulacion_id;
    const value = evidenceNumber(raw?.rendimiento ?? raw?.valor);
    if (!Number.isInteger(id) || id < 1 || value === null || value < 0 || ids.has(id)) return [];
    ids.add(id);
    const rawDate = typeof raw.fecha==='string' ? raw.fecha.match(/\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?/)?.[0] : null;
    const date = evidenceDate(rawDate);
    return [{ id, valor:value, nombre:raw.nombre || `Simulación #${id}`, variedad:raw.variedad || raw.hibrido || 'Variedad no conservada',
      fecha:date ? rawDate : null, fechaTexto:date ? date.toLocaleDateString('es-EC') : 'Fecha no conservada' }];
  });
  return rows.sort((a,b) => {
    if (order==='mayor' && a.valor!==b.valor) return b.valor-a.valor;
    if (order==='menor' && a.valor!==b.valor) return a.valor-b.valor;
    return (b.fecha || '').localeCompare(a.fecha || '') || b.id-a.id;
  });
}
