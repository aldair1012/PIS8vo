import test from 'node:test';
import assert from 'node:assert/strict';
import { leerAltitud, leerPhSuelo } from './datosParcela.js';
import { indiceKpiSeguro } from './kpiState.js';

test('solo acepta altitud numérica de la respuesta del proveedor', () => {
  assert.equal(leerAltitud({ elevation: [42.37] }), '42.4');
  assert.equal(leerAltitud({ elevation: [0] }), '0.0');
  for (const valor of [null, {}, { elevation: [null] }, { elevation: ['45'] }, { elevation: [Infinity] }]) assert.equal(leerAltitud(valor), null);
});
test('lee el pH SoilGrids únicamente si está presente y en rango', () => {
  assert.equal(leerPhSuelo({ properties: { layers: [{ name: 'phh2o', depths: [{ values: { mean: 65 } }] }] } }), '6.5');
  for (const valor of [null, {}, { properties: { layers: [] } }, { properties: { layers: [{ name: 'phh2o', depths: [{ values: { mean: null } }] }] } }, { properties: { layers: [{ name: 'phh2o', depths: [{ values: { mean: 160 } }] }] } }]) assert.equal(leerPhSuelo(valor), null);
});
test('el índice visible se adapta si desaparecen opciones del indicador', () => {
  assert.equal(indiceKpiSeguro(2, 3), 2);
  assert.equal(indiceKpiSeguro(2, 1), 0);
  assert.equal(indiceKpiSeguro(-1, 3), 0);
});
test('pH WMS convierte la unidad de SoilGrids y rechaza valores sin dato', () => {
  const sample = value => ({ features: [{ properties: { pixel_value: value } }] });
  assert.equal(leerPhSuelo(sample(65)), '6.5');
  for (const value of [-32768, null, '65', 160]) assert.equal(leerPhSuelo(sample(value)), null);
});
