import { evidenceDate, evidenceNumber } from './agronomicEvidence.js';

export const climateNumber = (value, min = -Infinity, max = Infinity) => {
  const n = evidenceNumber(value);
  return n !== null && n >= min && n <= max ? n : null;
};
export const climateDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && evidenceDate(value) ? value : null;
const dayStamp = date => Date.parse(`${date}T12:00:00Z`);

// Missing values stay missing. Duplicate dates never inflate an accumulation.
export function forecastDays(rows, start, horizon = 7) {
  const first = climateDate(start);
  const dates = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = climateDate(row?.fecha);
    if (!date || (first && (date < first || dayStamp(date) >= dayStamp(first) + horizon * 86400000)) || dates.has(date)) continue;
    const min = climateNumber(row.temp_min_c, -90, 65);
    const max = climateNumber(row.temp_max_c, -90, 65);
    dates.set(date, { fecha: date,
      temp_min_c: min !== null && max !== null && min > max ? null : min,
      temp_max_c: min !== null && max !== null && min > max ? null : max,
      precipitacion_mm: climateNumber(row.precipitacion_mm, 0),
      et0_mm: climateNumber(row.et0_mm, 0),
      prob_precipitacion_pct: climateNumber(row.prob_precipitacion_pct, 0, 100),
      codigo_tiempo: climateNumber(row.codigo_tiempo, 0, 99),
      descripcion: typeof row.descripcion === 'string' ? row.descripcion : '',
    });
  }
  return [...dates.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, horizon);
}

export function forecastSummary(days, start) {
  const valid = days.filter(day => day.precipitacion_mm !== null);
  const first = climateDate(start) || days[0]?.fecha;
  const complete = days.length === 7 && valid.length === 7 && days.every((day, i) => dayStamp(day.fecha) === dayStamp(first) + i * 86400000);
  return { complete, coverage: valid.length, total: complete ? valid.reduce((sum, day) => sum + day.precipitacion_mm, 0) : null,
    wettest: valid.length ? valid.reduce((a, b) => b.precipitacion_mm > a.precipitacion_mm ? b : a) : null };
}

export function historyDays(rows, period) {
  const start = climateDate(period?.inicio);
  const end = climateDate(period?.fin);
  const dates = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = climateDate(row?.fecha);
    if (!date || dates.has(date) || (start && date < start) || (end && date > end)) continue;
    dates.set(date, { fecha: date, precip_mm: climateNumber(row.precip_mm, 0), et0_mm: climateNumber(row.et0_mm, 0), temp_media_c: climateNumber(row.temp_media_c, -90, 65) });
  }
  // Fill explicit gaps only inside the provider's declared period.
  if (start && end && dayStamp(end) >= dayStamp(start) && dayStamp(end) - dayStamp(start) < 370 * 86400000) {
    for (let t = dayStamp(start); t <= dayStamp(end); t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10);
      if (!dates.has(date)) dates.set(date, { fecha: date, precip_mm: null, et0_mm: null, temp_media_c: null });
    }
  }
  return [...dates.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function referenceWaterBalance(rows, period) {
  const days = historyDays(rows, period);
  const expected = climateDate(period?.inicio) && climateDate(period?.fin) ? Math.round((dayStamp(period.fin) - dayStamp(period.inicio)) / 86400000) + 1 : null;
  const paired = days.filter(day => day.precip_mm !== null && day.et0_mm !== null);
  const complete = expected !== null && expected > 0 && days.length === expected && paired.length === expected;
  return { complete, coverage: paired.length, expected, rain: complete ? paired.reduce((sum, d) => sum + d.precip_mm, 0) : null,
    et0: complete ? paired.reduce((sum, d) => sum + d.et0_mm, 0) : null,
    balance: complete ? paired.reduce((sum, d) => sum + d.precip_mm - d.et0_mm, 0) : null };
}

export function historyMonths(rows) {
  const dates = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const month = row?.mes ?? row?.ym;
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || dates.has(month)) continue;
    const count = climateNumber(row.dias_lluvia, 0, 31);
    const expected = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    dates.set(month, { fecha: month, precip_mm: count !== null && count !== expected ? null : climateNumber(row.precipitacion_mm, 0),
      temp_media_c: climateNumber(row.temp_media_c, -90, 65), dias_temperatura: climateNumber(row.dias_temperatura, 0, 31), dias_esperados: expected });
  }
  return [...dates.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-12);
}

export function soilWaterPercent(value) {
  const n = climateNumber(value, 0, 1);
  return n === null ? null : n * 100;
}

export function validateClimateResponse(data, plotId) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('No llegó una respuesta válida del servicio de clima.');
  if (!data.sin_datos && plotId != null && String(data.cultivo_activo?.id) !== String(plotId)) throw new Error('La respuesta no identifica esta parcela. Vuelve a consultar.');
  for (const key of ['pronostico_7d', 'clima_diaria_30d']) {
    if (data[key] != null && !Array.isArray(data[key])) throw new Error('La información del clima llegó incompleta. Vuelve a consultar.');
  }
  return data;
}

export const cropPhases = {
  initial: { label: 'Inicial · poco suelo cubierto', kc: [0.3, 0.3] },
  developing: { label: 'Desarrollo · aumenta la cobertura', kc: [0.3, 1.2] },
  mid: { label: 'Plena cobertura · floración', kc: [1.2, 1.2] },
  late: { label: 'Final · secado del grano en campo', kc: [0.35, 1.2] },
};

export function cropWaterWeek(days, today, phase) {
  const factors = cropPhases[phase]?.kc;
  if (!factors || !forecastSummary(days, today).complete || days.some(day => climateNumber(day.et0_mm, 0) === null)) return null;
  const rain = days.reduce((sum, day) => sum + day.precipitacion_mm, 0);
  const et0 = days.reduce((sum, day) => sum + day.et0_mm, 0);
  const demand = factors.map(kc => kc * et0);
  return { rain, et0, demand, balance: [rain - demand[1], rain - demand[0]] };
}
