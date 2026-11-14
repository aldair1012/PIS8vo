import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeChartText, validarRespuestaRendimiento, provinceFromLocation, regionalHistory, simulationHistory, yieldAnalysis } from './yieldDashboard.js';

test('rechaza respuestas inválidas o de otra parcela antes de renderizar',()=>{
  for(const value of [null,[],{}, {cultivo_activo:{id:2},simulaciones_rendimiento:[]}, {cultivo_activo:{id:1},simulaciones_rendimiento:{}}, {cultivo_activo:{id:1},simulaciones_rendimiento:[null]}]) assert.throws(()=>validarRespuestaRendimiento(value,1));
  const empty={sin_datos:true,cultivo_activo:{id:1}};
  assert.equal(validarRespuestaRendimiento(empty,1),empty);
  const zero={cultivo_activo:{id:1},simulaciones_rendimiento:[{id:1,rendimiento_t_ha:0}]};
  assert.equal(validarRespuestaRendimiento(zero,1),zero);
});

test('un nombre de parcela no puede introducir HTML en la ayuda del gráfico',()=>{
  assert.equal(escapeChartText('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('identifica provincias con tildes y reconoce las que no tienen cobertura SIPA', () => {
  assert.equal(provinceFromLocation('Jipijapa, MANABI, Ecuador'), 'Manabí');
  assert.equal(provinceFromLocation('Los Ríos'), 'Los Ríos');
  assert.equal(provinceFromLocation('Santo Domingo De Los Tsáchilas'), 'Santo Domingo de los Tsáchilas');
  assert.equal(provinceFromLocation('Pichincha'), 'Pichincha');
  assert.equal(provinceFromLocation('Parcela sin ubicación'), null);
});

test('el histórico conserva solo la provincia del lote y deja huecos en años ausentes', () => {
  const periods = [
    { año: 2024, provincias: [{ provincia: 'Manabí', rendimiento_t_ha: 6 }, { provincia: 'Guayas', rendimiento_t_ha: 8 }] },
    { año: 2025, provincias: [{ provincia: 'Guayas', rendimiento_t_ha: 9 }] },
  ];
  const manabi = regionalHistory(periods, 'Manabí', 2025);
  assert.equal(manabi.selected, null);
  assert.equal(manabi.coverage, 1);
  assert.deepEqual(manabi.rows.map((row) => row.record?.rendimiento_t_ha ?? null), [6, null]);
  assert.equal(regionalHistory(periods, 'Guayas', 2025).selected.rendimiento_t_ha, 9);
  assert.equal(regionalHistory(periods, null, 2025).coverage, 0);
});

const simulation = { rendimiento_t_ha: 4, impactos_modelo_shap: { temperatura: 0.5, humedad: 0, precipitacion: -1, fertilizante: -0.5, phSuelo: 0, tipoSuelo: 0 } };

test('la cascada suma exactamente a la predicción y separa la brecha del catálogo', () => {
  const result = yieldAnalysis({ ...simulation, explicacion_modelo: { base: 5, recortada: false, aportes: simulation.impactos_modelo_shap } }, { rendimiento_maximo_catalogo: 10 });
  assert.equal(result.cascade[0].value, 5);
  assert.equal(result.cascade.at(-1).range[1], 4);
  assert.equal(result.cascade.at(-2).range[1], 4);
  assert.equal(result.gap, 6);
  assert.equal(result.primary.key, 'precipitacion');
  assert.ok(Math.abs(result.limiting.reduce((sum, row) => sum + row.share, 0) - 100) < 1e-9);
});

test('no inventa potencial, brecha ni base cuando faltan referencias o SHAP completos', () => {
  assert.equal(yieldAnalysis(simulation).gap, null);
  assert.equal(yieldAnalysis(simulation).potential, null);
  assert.deepEqual(yieldAnalysis({ rendimiento_t_ha: 4, impactos_modelo_shap: { precipitacion: -1 } }).cascade, []);
  assert.deepEqual(yieldAnalysis({ ...simulation, rendimiento_t_ha: 12 }).cascade, []);
  assert.deepEqual(yieldAnalysis({ ...simulation, rendimiento_t_ha: 0.5 }).cascade, []);
  assert.deepEqual(yieldAnalysis({ ...simulation, impactos_modelo_shap: { ...simulation.impactos_modelo_shap, area: 0.4 } }).cascade, []);
});

test('cero es válido y no se convierte en un factor limitante inexistente', () => {
  const result = yieldAnalysis({ ...simulation, impactos_modelo_shap: { temperatura: 0, humedad: 0, precipitacion: 0, fertilizante: 0, phSuelo: 0, tipoSuelo: 0 } });
  assert.equal(result.primary, null);
  assert.deepEqual(result.limiting, []);
  assert.equal(result.contributions.length, 6);
});

test('la curva conserva la selección antigua además de las ejecuciones recientes', () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, fecha: `2026-10-${String(index + 1).padStart(2, '0')}` }));
  const result = simulationHistory([...rows].reverse(), rows[0]);
  assert.equal(result.length, 13);
  assert.equal(result[0].id, 1);
  assert.equal(result.at(-1).id, 20);
  assert.equal(simulationHistory(rows, rows[19]).length, 12);
});
