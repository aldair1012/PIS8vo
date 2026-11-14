export function evidenceNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function validateSowingResponse(data, plotId) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Respuesta de Siembra inválida.');
  if (plotId != null && String(data.cultivo_activo?.id) !== String(plotId)) throw new Error('La respuesta no corresponde a esta parcela.');
  if (!data.sin_datos && (evidenceNumber(data.kpis?.rendimiento_esperado) === null || !Number.isInteger(data.simulaciones_count) || data.simulaciones_count < 1)) throw new Error('Resumen de Siembra incompleto.');
  for (const key of ['ranking','heatmap','viabilidad_siembra','recomendaciones']) if (data[key] !== undefined && !Array.isArray(data[key])) throw new Error('Datos de Siembra inválidos.');
  return data;
}

export function evidenceDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.getFullYear() === Number(y) && date.getMonth() === Number(m) - 1 && date.getDate() === Number(d) ? date : null;
}

// Un dato ausente no se transforma en una celda cero ni añade variedades ficticias.
export function scenarioHeatmap(rows) {
  const values = (Array.isArray(rows) ? rows : []).flatMap((row) => {
    if (!row || row.tipo !== 'resultado_guardado' || !Number.isInteger(row.simulacion_id) || row.simulacion_id <= 0 || typeof row.fecha !== 'string' || !row.fecha.trim() || typeof row.hibrido !== 'string' || !row.hibrido.trim()) return [];
    const value = evidenceNumber(row.valor);
    return value === null || value < 0 ? [] : [{ ...row, valor: value }];
  });
  return { rows: values, dates: [...new Set(values.map((row) => row.fecha))], varieties: [...new Set(values.map((row) => row.hibrido))] };
}

export function descriptivePercentiles(p10, p50, p90) {
  const values = [p10, p50, p90].map(evidenceNumber);
  if (values.some((value) => value === null || value < 0) || values[0] > values[1] || values[1] > values[2]) return null;
  const padding = Math.max(0.25, (values[2] - values[0]) * 0.12);
  return { values, min: Math.max(0, values[0] - padding), max: values[2] + padding };
}

const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function catalogSowingEvents(rows, year) {
  return catalogEvents(rows, year, 'siembra');
}

export function catalogHarvestEvents(rows, year) {
  return catalogEvents(rows, year, 'cosecha');
}

function catalogEvents(rows, year, phase) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return [];
  return (Array.isArray(rows) ? rows : []).flatMap((item) => {
    if (!item || item.tipo !== 'ventana_catalogo_no_pronostico' || !item.fuente) return [];
    if (!String(item.estado ?? '').toLowerCase().startsWith(`${phase}:`)) return [];
    const match = /^(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)$/i.exec(String(item.rango || '').trim());
    if (!match) return [];
    const month = months.indexOf(match[3].toLowerCase());
    const startDay = Number(match[1]);
    const endDay = Number(match[2] ?? match[1]);
    const lastDay = new Date(year, month + 1, 0).getDate();
    if (startDay < 1 || endDay < startDay || endDay > lastDay) return [];
    return [{ start: new Date(year, month, startDay), end: new Date(year, month, endDay), title: item.estado || 'Referencia de catálogo', color: phase === 'cosecha' ? 'harvest' : 'info', phase, description: `${item.nota || ''} Fuente: ${item.fuente}. Referencia de catálogo; no es un pronóstico.`, monthKey: months[month] }];
  });
}

export function recordedCropEvents(calendar) {
  return (Array.isArray(calendar?.eventos) ? calendar.eventos : []).flatMap(row => {
    const date = evidenceDate(row?.fecha);
    if (!date || !row.fuente || !['siembra_registrada','siembra_simulada','fin_ciclo_estimado'].includes(row.tipo)) return [];
    return [{start:date,end:date,title:row.titulo,color:row.tipo === 'fin_ciclo_estimado' ? 'harvest':'info',description:`${row.nota || ''} Fuente: ${row.fuente}.`,phase:row.tipo,monthKey:months[date.getMonth()]}];
  });
}

export function calendarStartDate(events, year, month = new Date().getMonth()) {
  const dated = events.filter(row => row.start instanceof Date && !Number.isNaN(row.start.getTime())).sort((a,b)=>a.start-b.start);
  if (dated.some(row => row.start.getFullYear() === year && row.start.getMonth() === month)) return new Date(year,month,1);
  const next = dated.find(row => row.start >= new Date(year,month,1)) ?? dated[0];
  return next ? new Date(next.start.getFullYear(),next.start.getMonth(),1) : new Date(year,month,1);
}

export function measuredPhenologyEvents(rows) {
  return (Array.isArray(rows) ? rows : []).flatMap((item) => {
    if (!item) return [];
    const start = evidenceDate(item.inicio ?? item.fecha_inicio ?? item.start);
    const end = evidenceDate(item.fin ?? item.fecha_fin ?? item.end);
    if (!start || !end || end < start) return [];
    return [{ start, end, title: item.etapa || 'Etapa registrada', color: item.color || 'info', description: item.descripcion || '' }];
  });
}

export function soilWaterRows(profile) {
  if (!Array.isArray(profile?.labels)) return [];
  return profile.labels.map((label, index) => {
    const value = evidenceNumber(profile.valores?.[index]);
    return { label, value: value !== null && value >= 0 ? value : null };
  });
}
