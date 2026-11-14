import test from 'node:test';
import assert from 'node:assert/strict';
import { savedSowingRows, dateKindLabel, sowingPlanning, validateSowingPlan } from './sowingPlan.js';

test('historial conserva ceros, ausencias y orden cronológico sin crear cruces', () => {
  const data={simulaciones:[{id:1,fecha:'2026-01-01',rendimiento:4},{id:2,fecha:'2026-02-01',rendimiento:0},{id:3,fecha:null,rendimiento:2},{id:1,rendimiento:7},{id:4,rendimiento:null}]};
  assert.deepEqual(savedSowingRows(data).map(r=>r.id),[2,1,3]);
  assert.deepEqual(savedSowingRows(data,'mayor').map(r=>r.valor),[4,2,0]);
  assert.deepEqual(savedSowingRows(data,'menor').map(r=>r.valor),[0,2,4]);
  assert.equal(savedSowingRows(data)[0].variedad,'Variedad no conservada');
  assert.equal(savedSowingRows(data)[2].fechaTexto,'Fecha no conservada');
});
test('historial admite respuestas anteriores pero no inventa una fecha', () => {
  const rows=savedSowingRows({heatmap:[{simulacion_id:8,fecha:'Simulación #8 · 2026-02-15',valor:2,hibrido:'Variedad A'},{simulacion_id:9,fecha:'Simulación #9',valor:3}]});
  assert.equal(rows[0].id,8);assert.equal(rows[0].fecha,'2026-02-15');assert.equal(rows[1].fecha,null);
});
test('un tipo ausente no se presenta como siembra realizada', () => {
  assert.match(dateKindLabel(null),/por confirmar/);assert.match(dateKindLabel('prevista'),/prevista/);assert.match(dateKindLabel('real_declarada'),/Real declarada/);
});
test('la planificación utiliza la fecha propia y no mezcla una campaña anterior',()=>{
  const plan=sowingPlanning({fecha_siembra:'2027-01-01',ciclo_dias:120,tipo_fecha_siembra:'prevista',riego_tipo:'goteo'}, {fecha_siembra:'2024-01-01',ciclo_dias:200,fecha_fin_estimada:'2024-07-18'});
  assert.equal(plan.end,'2027-04-30');assert.equal(plan.fromSimulation,false);assert.deepEqual(plan.pending,[]);
  assert.equal(sowingPlanning({fecha_siembra:'2027-01-01'}, {fecha_siembra:'2024-01-01',ciclo_dias:200}).end,null);
});
test('los datos de simulación son referencias hasta que se confirme el plan',()=>{
  const plan=sowingPlanning({}, {fecha_siembra:'2024-02-01',ciclo_dias:120,tipo_fecha_siembra:'prevista'});
  assert.equal(plan.fromSimulation,true);assert.equal(plan.durationFromSimulation,true);assert.equal(plan.end,'2024-05-30');assert.ok(plan.pending.includes('fecha de siembra'));
  assert.equal(sowingPlanning({fecha_siembra:'2027-02-31'}).start,null);
});
test('una fecha pasada sin clasificación no se convierte en siembra realizada',()=>{
  const plan=sowingPlanning({fecha_siembra:'2020-01-01'});
  assert.equal(plan.kind,undefined);assert.ok(plan.pending.includes('si ya sembraste en esa fecha'));
});
test('los errores de planificación identifican el campo y permiten datos opcionales vacíos',()=>{
  assert.deepEqual(validateSowingPlan({date:'',kind:'',cycle:'',irrigation:''},'2026-11-10'),{});
  const errors=validateSowingPlan({date:'2027-01-01',kind:'real_declarada',cycle:1.5,irrigation:'inventado'},'2026-11-10');
  assert.deepEqual(Object.keys(errors),['date','cycle','irrigation']);
  assert.ok(validateSowingPlan({date:'2026-01-01',kind:'',cycle:'',irrigation:''},'2026-11-10').kind);
});
