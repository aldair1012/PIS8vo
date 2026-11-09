import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCamposCultivo, finCultivo } from './fieldInputs.js';

test('datos de campo conservan ceros y unidades; vacíos se omiten', () => {
  assert.deepEqual(prepararCamposCultivo({ ciclo_dias: '120', lamina_riego_mm: '0', fosforo_p2o5_kg_ha: '', materia_organica_pct: '2,3', semilla_certificada: '0' }, 24),
    { ciclo_dias: 120, lamina_riego_mm: 0, materia_organica_pct: 2.3, semilla_certificada: 0 });
});
test('fechas y duración respetan año bisiesto y primer día inclusivo', () => {
  assert.equal(finCultivo('2024-02-28', 3), '2024-03-01');
  assert.equal(finCultivo('2025-02-29', 120), null);
  assert.equal(finCultivo('2026-12-31', 1), '2026-12-31');
});
test('rechaza temperaturas contradictorias, dosis imposibles y campos ajenos', () => {
  for (const datos of [{ temperatura_min_c: '25' }, { temperatura_max_c: '23' }, { ciclo_dias: '120.5' }, { densidad_plantas_ha: '0' }, { lamina_riego_mm: '-1' }, { rendimiento_t_ha: '10' }]) {
    assert.throws(() => prepararCamposCultivo(datos, 24));
  }
});
