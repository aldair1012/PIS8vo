import test from 'node:test';
import assert from 'node:assert/strict';
import { seguimientoNdvi } from './seguimientoNdvi.js';

function ejemplo() {
  const cosechas = [], observaciones = [];
  for (let i = 0; i <= 16; i++) {
    const anio = 2000+i, siembra = anio+'-01-01', ndvi = [0.3,0.5,0.7,0.4][i%4];
    observaciones.push({fecha_siembra:siembra, fecha:anio+'-02-10', registrado_en:anio+'-02-11', ndvi});
    if (i < 16) cosechas.push({fecha_siembra:siembra, fecha_cosecha:anio+'-07-01', registrado_en:anio+'-07-02',
      base_comparable:true, prediccion:{version_modelo:'v1', fecha:siembra, rendimiento_t_ha:4}, observado_t_ha:4+ndvi*2});
  }
  const simulacion = {fecha:'2015-12-30', parcela_ejecucion:{fecha_siembra:'2016-01-01'}, version_modelo:'v1', rendimiento_t_ha:4};
  return {cosechas,observaciones,simulacion};
}
test('NDVI de seguimiento mejora ambas referencias en cortes temporales separados', () => {
  const {cosechas,observaciones,simulacion}=ejemplo();
  const r=seguimientoNdvi(cosechas,observaciones,simulacion,'2016-02-15');
  assert.equal(r.n,16); assert.equal(r.pruebas,10); assert.ok(Math.abs(r.rendimiento-4.6)<1e-9);
});
test('excluye cosechas tardías, versiones diferentes, planes posteriores y observaciones retroactivas', () => {
  const {cosechas,observaciones,simulacion}=ejemplo();
  cosechas[0].registrado_en='2016-02-15'; cosechas[1].prediccion.version_modelo='v0';
  cosechas[2].prediccion.fecha='2002-02-15'; observaciones[3].registrado_en='2003-02-15';
  assert.equal(seguimientoNdvi(cosechas,observaciones,simulacion,'2016-02-15').n,12);
  observaciones.at(-1).registrado_en='2016-02-16';
  assert.match(seguimientoNdvi(cosechas,observaciones,simulacion,'2016-10-01').motivo,/Falta un NDVI/);
});
test('sin mejora sobre el modelo simple o sin un periodo completo conserva la planificación', () => {
  const {cosechas,observaciones,simulacion}=ejemplo();
  cosechas.forEach(c=>{c.observado_t_ha=4;});
  assert.equal(seguimientoNdvi(cosechas,observaciones,simulacion,'2016-02-15').rendimiento,undefined);
  assert.match(seguimientoNdvi(cosechas,observaciones,simulacion,'2016-01-30').motivo,/primera revisión/);
});
