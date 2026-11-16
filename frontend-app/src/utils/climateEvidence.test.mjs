import test from 'node:test';
import assert from 'node:assert/strict';
import { climateDate, forecastDays, forecastSummary, historyDays, historyMonths, referenceWaterBalance, soilWaterPercent, validateClimateResponse } from './climateEvidence.js';
const week = Array.from({ length: 7 }, (_, i) => ({ fecha: `2026-11-${15 + i}`, precipitacion_mm: 0, temp_min_c: 20, temp_max_c: 30, prob_precipitacion_pct: 70 }));
test('fechas imposibles, filas duplicadas y pronósticos anteriores no pasan', () => {
  assert.equal(climateDate('2026-02-30'), null);
  const days = forecastDays([week[1], week[0], week[0], { fecha: '2026-02-30' }, { fecha: '2026-11-14' }], '2026-11-15');
  assert.deepEqual(days.map(d => d.fecha), ['2026-11-15', '2026-11-16']);
});
test('siete días de lluvia cero son un acumulado válido, no una probabilidad de daño', () => {
  const summary = forecastSummary(forecastDays(week), '2026-11-15');
  assert.equal(summary.complete, true); assert.equal(summary.total, 0);
});
test('no se calcula total semanal con un día desconocido ni una fecha interrumpida', () => {
  assert.equal(forecastSummary(forecastDays(week.map((d, i) => i === 3 ? { ...d, precipitacion_mm: null } : d))).total, null);
  assert.equal(forecastSummary(forecastDays(week.map((d, i) => i === 6 ? { ...d, fecha: '2026-11-23' } : d))).total, null);
  assert.equal(forecastSummary([]).total, null);
});
test('rangos inválidos y máximas inferiores a mínimas permanecen ausentes', () => {
  const [day] = forecastDays([{ ...week[0], precipitacion_mm: -1, prob_precipitacion_pct: 130, temp_min_c: 35, temp_max_c: 20 }]);
  assert.equal(day.precipitacion_mm, null); assert.equal(day.prob_precipitacion_pct, null); assert.equal(day.temp_max_c, null);
});
test('el historial mantiene huecos dentro del período y conserva ceros', () => {
  const rows = historyDays([{ fecha: '2026-11-01', precip_mm: 0, et0_mm: 0, temp_media_c: 0 }], { inicio: '2026-11-01', fin: '2026-11-03' });
  assert.equal(rows.length, 3); assert.equal(rows[0].precip_mm, 0); assert.equal(rows[1].precip_mm, null);
});
test('la diferencia lluvia ET0 requiere cobertura coincidente completa, incluyendo ceros', () => {
  const period = { inicio: '2026-11-01', fin: '2026-11-02' };
  const rows = [{ fecha: period.inicio, precip_mm: 0, et0_mm: 0 }, { fecha: period.fin, precip_mm: 4, et0_mm: 2 }];
  assert.equal(referenceWaterBalance(rows, period).balance, 2);
  assert.equal(referenceWaterBalance(rows.slice(1), period).balance, null);
  assert.equal(referenceWaterBalance(rows).balance, null);
});
test('un mes con días de lluvia ausentes no aparenta un acumulado completo', () => {
  assert.equal(historyMonths([{ mes: '2026-10', precipitacion_mm: 100, dias_lluvia: 30 }])[0].precip_mm, null);
  assert.equal(historyMonths([{ mes: '2026-10', precipitacion_mm: 0, dias_lluvia: 31 }])[0].precip_mm, 0);
});
test('humedad volumétrica se convierte a porcentaje sin clasificar el riego', () => {
  assert.equal(soilWaterPercent(.23), 23); assert.equal(soilWaterPercent(null), null); assert.equal(soilWaterPercent(23), null);
});
test('una respuesta de otra parcela o con estructura rota se rechaza', () => {
  assert.throws(() => validateClimateResponse({ cultivo_activo: { id: 2 } }, 1));
  assert.throws(() => validateClimateResponse({ pronostico_7d: {} }, 1));
  assert.deepEqual(validateClimateResponse({ cultivo_activo: { id: 1 }, pronostico_7d: [] }, 1).pronostico_7d, []);
});
