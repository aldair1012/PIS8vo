import test from 'node:test';
import assert from 'node:assert/strict';
import { financeNumber, financeInputNumber, financeInputText, financeBudgetPreview, financeSourceLabel } from './financeBudget.js';

const inputs = { precioMaizQq: '20', rendimientoQq: '100', costoSemilla: '10', costoFert: '20', costoRiego: '0', costoProteccion: '0', otrosVar: '0', costosFijos: '20' };

test('los parsers preservan cero y descartan ausencia, booleanos y números no finitos', () => {
  assert.equal(financeNumber(0), 0);
  assert.equal(financeInputText('0'), '0');
  for (const value of ['', '  ', null, undefined, true, false, [], {}, NaN, Infinity, 'Infinity', '1e309']) {
    assert.equal(financeNumber(value), null);
    assert.equal(financeInputText(value), '');
  }
  assert.equal(financeNumber(-3), -3);
  assert.equal(financeInputNumber(-3), null);
});

test('la vista previa conserva parcelas de 0.01 ha sin elevarlas a una hectárea', () => {
  assert.deepEqual(financeBudgetPreview(inputs, 0.01), { area: 0.01, yieldQq: 100, priceQq: 20, costPerHa: 50, production: 1, revenue: 20, cost: 0.5, margin: 19.5 });
});

test('cosecha cero y precio cero producen ingresos cero y margen negativo real', () => {
  for (const override of [{ rendimientoQq: '0' }, { precioMaizQq: '0' }]) {
    const preview = financeBudgetPreview({ ...inputs, ...override }, 2);
    assert.equal(preview.revenue, 0);
    assert.equal(preview.margin, -100);
  }
});

test('un rendimiento vacío deja ingresos y margen ausentes, conservando costos', () => {
  const preview = financeBudgetPreview({ ...inputs, rendimientoQq: '' }, 2);
  assert.equal(preview.yieldQq, null);
  assert.equal(preview.production, null);
  assert.equal(preview.revenue, null);
  assert.equal(preview.margin, null);
  assert.equal(preview.cost, 100);
});

test('un costo vacío impide presentar margen o costo total como si fuera cero', () => {
  const preview = financeBudgetPreview({ ...inputs, costoFert: '' }, 2);
  assert.equal(preview.cost, null);
  assert.equal(preview.margin, null);
  assert.equal(preview.revenue, 4000);
});

test('sin superficie no hay totales de una parcela inventada', () => {
  for (const area of [null, '', 0, -1]) {
    const preview = financeBudgetPreview(inputs, area);
    assert.equal(preview.area, null);
    assert.equal(preview.production, null);
    assert.equal(preview.revenue, null);
    assert.equal(preview.cost, null);
    assert.equal(preview.margin, null);
    assert.equal(preview.costPerHa, 50);
  }
});

test('el desbordamiento numérico no se muestra como Infinity o NaN', () => {
  const preview = financeBudgetPreview({ ...inputs, rendimientoQq: '1e308', precioMaizQq: '1e308' }, 10);
  assert.equal(preview.revenue, null);
  assert.equal(preview.production, null);
  assert.equal(preview.margin, null);
});

test('los orígenes distinguen supuestos, simulaciones y datos no disponibles', () => {
  assert.match(financeSourceLabel('supuesto_configurable_sin_costo_observado'), /no es gasto observado/);
  assert.match(financeSourceLabel('media_rendimientos_modelo_guardados'), /simulaciones guardadas/);
  assert.match(financeSourceLabel(undefined), /no documentado/);
});
