import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCamposCultivo, finCultivo, diasCultivo, periodoCultivo, editarPeriodo, errorPeriodo } from './fieldInputs.js';

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

test('el plan completa el tercer dato en cualquier orden y respeta la última corrección', () => {
  const values = { fecha: '2024-02-28', cosecha: '2024-03-01', dias: '3' };
  for (const first of Object.keys(values)) for (const second of Object.keys(values).filter(k => k !== first)) {
    let p = editarPeriodo(periodoCultivo(), first, values[first]);
    p = editarPeriodo(p, second, values[second]);
    assert.deepEqual([p.fecha, p.cosecha, p.dias], Object.values(values));
  }
  let p = editarPeriodo(periodoCultivo('2024-02-28', 10), 'cosecha', '2024-03-01');
  p = editarPeriodo(p, 'fecha', '2024-02-29');
  assert.equal(p.dias, '2');
  p = editarPeriodo(p, 'dias', '1');
  assert.equal(p.cosecha, '2024-02-29');
  assert.equal(diasCultivo('2026-12-31','2027-01-01'), 2);
});

test('el formulario conserva fechas contradictorias para corregirlas y borra el derivado obsoleto', () => {
  for (const value of ['2025-02-27', '2028-03-01']) {
    const p = editarPeriodo(periodoCultivo('2025-02-28', 12), 'cosecha', value);
    assert.equal(p.cosecha, value);
    assert.equal(p.dias, '');
    assert.ok(errorPeriodo(p));
  }
  assert.equal(diasCultivo('2025-02-29','2025-03-01'),null);
  const p = editarPeriodo(periodoCultivo('2024-02-28', 3), 'dias', '');
  assert.equal(p.cosecha, '');
});
