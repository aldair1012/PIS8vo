import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSimulationNumber, precipitationPeriod, normalizarDecimalEntrada, parseScenarioNumber } from './simulationInput.js';

test('no convierte números mal formados o vacíos en mediciones cero', () => {
  for (const value of ['', ' ', '1..2', '1,2,3', '4abc', 'NaN', 'Infinity', true, null, undefined, [], {}]) {
    assert.equal(parseSimulationNumber(value), null, String(value));
  }
  assert.equal(parseSimulationNumber('0'), 0);
  assert.equal(parseSimulationNumber('1,25'), 1.25);
  assert.equal(parseSimulationNumber('-2.5'), -2.5);
});
test('normaliza decimales sin convertir separadores de miles ambiguos en lluvia', () => {
  assert.equal(normalizarDecimalEntrada('0,83'), '0.83');
  assert.equal(normalizarDecimalEntrada('26,7'), '26.7');
  assert.equal(normalizarDecimalEntrada('3.500,25'), '3500.25');
  assert.equal(normalizarDecimalEntrada('3,500.25'), '3500.25');
  assert.equal(parseScenarioNumber('3,500'), null);
  assert.equal(parseScenarioNumber('0,500'), .5);
  assert.equal(parseScenarioNumber('3500'), 3500);
});

test('el periodo de lluvia distingue ciclos nuevos de registros sin trazabilidad', () => {
  assert.equal(precipitationPeriod({ escenarios_json: JSON.stringify({ _zeasys_modelo: { trazabilidad: { periodo_precipitacion: 'mm/ciclo' } } }) }), 'mm/ciclo');
  assert.equal(precipitationPeriod({ trazabilidad: { periodo_precipitacion: 'mm/año' } }), 'mm/año');
  assert.equal(precipitationPeriod({ escenarios_json: '{invalid' }), 'periodo no confirmado');
  assert.equal(precipitationPeriod({}), 'periodo no confirmado');
});
