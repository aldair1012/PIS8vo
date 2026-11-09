import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararExportacion, crearArchivoJson } from './prepararExportacion.js';
import { exportarReporteAPdf } from './exportarPdf.js';

const secciones = { cultivos: true, simulaciones: true, mediciones: true, kpis: true };
const opciones = () => ({ secciones, usuario: { nombre: 'Productor' }, ahora: new Date('2026-10-20T12:00:00Z'), obtenerParcelas: async () => [{ id: 1, nombre_parcela: 'A' }], obtenerHistorial: async (_anio, pagina) => ({ simulaciones: pagina === 1 ? [{ id: 1 }] : [{ id: 2 }], paginacion: { total: 2, paginas: 2, pagina } }), obtenerMediciones: async () => ({ datos: { profundidad_cm: 0 }, indicadores: {} }) });

test('reúne parcelas, todas las páginas y registros declarados en JSON no vacío', async () => {
  const datos = await prepararExportacion(opciones());
  assert.equal(datos.historial_simulaciones.length, 2);
  assert.equal(datos.registros_campo[0].datos.profundidad_cm, 0);
  const archivo = crearArchivoJson(datos);
  assert.ok(archivo.size > 0);
  assert.equal(JSON.parse(await archivo.text()).resumen_kpi.total_lotes, 1);
});
test('rechaza el historial si cambia o contiene duplicados', async () => {
  const caso = opciones();
  caso.obtenerHistorial = async (_anio, pagina) => ({ simulaciones: [{ id: 1 }], paginacion: { total: 2, paginas: 2, pagina } });
  await assert.rejects(prepararExportacion(caso), /historial completo/);
  caso.obtenerHistorial = async (_anio, pagina) => ({ simulaciones: [{ id: pagina }], paginacion: { total: pagina === 1 ? 2 : 3, paginas: 2, pagina } });
  await assert.rejects(prepararExportacion(caso), /historial cambió/);
});
test('no consulta secciones no seleccionadas y rechaza selecciones vacías', async () => {
  const caso = opciones(); caso.secciones = { cultivos: false, simulaciones: false, mediciones: false, kpis: false };
  await assert.rejects(prepararExportacion(caso), /Selecciona/);
  caso.secciones = { cultivos: false, simulaciones: false, mediciones: false, kpis: true };
  caso.obtenerHistorial = () => { throw new Error('No debe consultarse'); };
  assert.equal((await prepararExportacion(caso)).resumen_kpi.total_lotes, 1);
});
test('el informe escapa texto y distingue ausencia y cero', () => {
  let html = '';
  const ventana = { document: { open() {}, write(value) { html = value; }, close() {} } };
  exportarReporteAPdf({ meta: { exportado_por: '<script>', formato_version: 1 }, lotes_gps: [{ nombre_parcela: '<b>Parcela</b>', ph: 0 }], historial_simulaciones: [{ nombre: 'Prueba', rendimiento_estimado: null }], registros_campo: [{ nombre_parcela: '<b>X</b>', datos: { profundidad_cm: 0 } }] }, ventana);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;b&gt;Parcela&lt;/b&gt;'));
  assert.ok(html.includes('Profundidad (cm)</th><td>0'));
  assert.ok(!html.includes('Confianza'));
});
