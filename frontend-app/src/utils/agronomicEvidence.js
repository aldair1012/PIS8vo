export function evidenceNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return [];
  return (Array.isArray(rows) ? rows : []).flatMap((item) => {
    if (!item || item.tipo !== 'ventana_catalogo_no_pronostico' || !item.fuente) return [];
    if (!/^siembra\b/i.test(String(item.estado ?? ''))) return [];
    const match = /^(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)$/i.exec(String(item.rango || '').trim());
    if (!match) return [];
    const month = months.indexOf(match[3].toLowerCase());
    const startDay = Number(match[1]);
    const endDay = Number(match[2] ?? match[1]);
    const lastDay = new Date(year, month + 1, 0).getDate();
    if (startDay < 1 || endDay < startDay || endDay > lastDay) return [];
    return [{ start: new Date(year, month, startDay), end: new Date(year, month, endDay), title: item.estado || 'Referencia de catálogo', color: 'info', description: `${item.nota || ''} Fuente: ${item.fuente}. Referencia de catálogo; no es un pronóstico.`, monthKey: months[month] }];
  });
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
