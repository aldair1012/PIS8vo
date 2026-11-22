import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignBands } from './campaignBands.js';

const run = { id: 99, fecha: '2025-11-01 08:00:00', version_modelo: 'v1', rendimiento_t_ha: 20, parcela_ejecucion: { fecha_siembra: '2025-10-01' } };
const rows = Array.from({ length: 19 }, (_, i) => ({
  fecha_siembra: `${2000 + i}-01-01`, fecha_cosecha: `${2000 + i}-06-01`, registrado_en: `${2000 + i}-06-03 15:00:00`,
  observado_t_ha: 5 + i, prediccion: { id: i, version_modelo: 'v1', rendimiento_t_ha: 5 }, base_comparable: true,
}));
test('bandas de residuos por campaña y versión con corte de disponibilidad', () => {
  const excluded = [{ registrado_en: run.fecha }, { fecha_cosecha: '2025-11-01' }, { fecha_siembra: '2025-10-01' },
    { base_comparable: false }, { prediccion: { ...rows[0].prediccion, version_modelo: 'v2' } }];
  assert.deepEqual(campaignBands([...rows, ...excluded.map(row => ({ ...rows[0], ...row }))], run), {
    n: 19, median: 29, bands: [{ level: 50, low: 24, high: 34 }, { level: 90, low: 20, high: 38 }],
  });
  assert.equal(campaignBands(rows.slice(0, 2), run).bands.length, 0);
  assert.equal(campaignBands(rows.slice(0, 3), run).bands.length, 1);
  assert.equal(campaignBands(rows.slice(0, 18), run).bands.length, 1);
  assert.equal(campaignBands(rows, null).median, null);
});
