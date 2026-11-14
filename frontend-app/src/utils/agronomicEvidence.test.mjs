import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceNumber, evidenceDate, scenarioHeatmap, descriptivePercentiles, catalogSowingEvents, catalogHarvestEvents, recordedCropEvents, calendarStartDate, measuredPhenologyEvents, soilWaterRows } from './agronomicEvidence.js';

test('distingue cero medido de null, booleanos, espacios y objetos', () => {
  assert.equal(evidenceNumber(0), 0);
  assert.equal(evidenceNumber('0'), 0);
  for (const value of [null, undefined, false, true, '', ' ', [], {}, 'NaN', Infinity, '0x10', '0b10']) assert.equal(evidenceNumber(value), null);
});
test('la comparación usa solo ejecuciones existentes sin fabricar celdas o variedades', () => {
  const result = scenarioHeatmap([{ tipo: 'resultado_guardado', simulacion_id: 1, fecha: 'Simulación #1', hibrido: 'Variedad A', valor: 0 }, { tipo: 'resultado_guardado', simulacion_id: 2, fecha: 'Simulación #2', hibrido: 'Variedad B', valor: null }, { tipo: 'resultado_guardado', simulacion_id: 3, fecha: 'Simulación #3', hibrido: 'Variedad C', valor: '5.2' }, { fecha: 'Temprana', hibrido: 'Híbrido sintético', valor: 6 }]);
  assert.deepEqual(result.dates, ['Simulación #1', 'Simulación #3']);
  assert.deepEqual(result.varieties, ['Variedad A', 'Variedad C']);
  assert.deepEqual(result.rows.map((row) => row.valor), [0, 5.2]);
  assert.deepEqual(scenarioHeatmap(null), { rows: [], dates: [], varieties: [] });
});
test('percentiles descriptivos admiten una muestra constante sin ajustar una normal', () => {
  assert.deepEqual(descriptivePercentiles(0, 0, 0).values, [0, 0, 0]);
  const result = descriptivePercentiles(4, 4, 4);
  assert.ok(result.min < 4 && result.max > 4);
  assert.equal(descriptivePercentiles(null, 0, 0), null);
  assert.equal(descriptivePercentiles(5, 4, 6), null);
});
test('fechas ausentes o inválidas no se sustituyen por hoy ni se normalizan', () => {
  assert.equal(evidenceDate(null), null);
  assert.equal(evidenceDate('2026-02-30'), null);
  assert.equal(evidenceDate('2026-2-3'), null);
  assert.equal(evidenceDate('2024-02-29').getDate(), 29);
  assert.deepEqual(measuredPhenologyEvents([{ etapa: 'Emergencia', mes: 'Enero' }]), []);
  assert.deepEqual(measuredPhenologyEvents([{ inicio: '2026-02-10', fin: '2026-02-01' }]), []);
  assert.equal(measuredPhenologyEvents([{ etapa: 'Emergencia', inicio: '2026-02-01', fin: '2026-02-10' }]).length, 1);
});
test('el calendario usa únicamente ventanas de catálogo con fuente y rango válido', () => {
  const base = { tipo: 'ventana_catalogo_no_pronostico', fuente: 'Catálogo agronómico local', estado: 'Siembra: Manabí' };
  assert.equal(catalogSowingEvents([{ ...base, rango: '1–28 FEB' }], 2026).length, 1);
  for (const row of [{ rango: '1–15 Ene' }, { ...base, rango: '' }, { ...base, rango: '1–31 Feb' }, { ...base, rango: '16–2 Oct' }, { ...base, estado: 'Cosecha: Manabí', rango: '1–31 Ene' }]) assert.deepEqual(catalogSowingEvents([row], 2026), []);
});
test('agua por estrato conserva null y cero como estados diferentes', () => {
  assert.deepEqual(soilWaterRows({ labels: ['A', 'B', 'C'], valores: [null, 0] }), [{ label: 'A', value: null }, { label: 'B', value: 0 }, { label: 'C', value: null }]);
  assert.deepEqual(soilWaterRows(null), []);
});

test('cosechas del catálogo conservan fechas, tipo y fuente sin convertirse en siembras',()=>{
  const rows=[{tipo:'ventana_catalogo_no_pronostico',fuente:'Catálogo local',estado:'Cosecha: Manabí',rango:'1–31 AGO'}];
  assert.equal(catalogHarvestEvents(rows,2026)[0].phase,'cosecha');assert.deepEqual(catalogSowingEvents(rows,2026),[]);
  assert.deepEqual(catalogHarvestEvents([{...rows[0],fuente:null}],2026),[]);
});
test('el mes inicial contiene datos y las fechas de una campaña conservan su año propio',()=>{
  const events=recordedCropEvents({eventos:[{fecha:'2027-03-12',tipo:'siembra_registrada',titulo:'Siembra',fuente:'Productor'},{fecha:'2027-07-12',tipo:'fin_ciclo_estimado',titulo:'Fin estimado',fuente:'Simulación #1'}]});
  const start=calendarStartDate(events,2026,10);assert.equal(start.getFullYear(),2027);assert.equal(start.getMonth(),2);assert.equal(events.length,2);
  assert.deepEqual(recordedCropEvents({eventos:[{fecha:'2026-02-30',tipo:'siembra_registrada',fuente:'Productor'}]}),[]);
  const windows=catalogSowingEvents([{tipo:'ventana_catalogo_no_pronostico',fuente:'Catálogo',estado:'Siembra: Manabí',rango:'1–28 FEB'}],2026);
  assert.equal(calendarStartDate(windows,2026,10).getMonth(),1);
});
