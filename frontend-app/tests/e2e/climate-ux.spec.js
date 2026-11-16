import { test, expect } from '@playwright/test';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { climateData, climateObservations, climatePlot } from '../fixtures/climateData.mjs';
import { yieldData } from '../fixtures/explanationData.mjs';
import { waitForWorkspace } from './workspace-ready.js';
const output = '../documentacion/fuentes-maiz/descargas/clima-20261115';
const axe = path.resolve('../documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js');
async function prepare(page, { width = 1440, theme = 'light', payload = climateData } = {}) {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => { localStorage.setItem('theme', theme); localStorage.setItem('onboarding_done_987', 'true'); }, theme);
  await page.route('**/api/**', r => r.fulfill({ json: {} }));
  await page.route('**/api/auth/yo', r => r.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/api/parcelas', r => r.fulfill({ json: [climatePlot] }));
  await page.route('**/api/rendimiento?*', r => r.fulfill({ json: yieldData }));
  await page.route('**/api/rendimiento/mediciones/consulta?*', r => r.fulfill({ json: { mediciones: climateObservations } }));
  await page.route('**/api/clima?*', r => r.fulfill({ json: payload }));
  await page.goto('/'); await waitForWorkspace(page);
  if (width < 1024) await page.getByRole('button', { name: 'Expandir barra lateral', exact: true }).click();
  await page.getByRole('button', { name: 'Clima y cultivo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'El tiempo en tu parcela', exact: true })).toBeVisible();
}
for (const width of [375, 768, 1440]) for (const theme of ['light', 'dark']) test(`Clima claro y sin desbordamiento ${width}px ${theme}`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await prepare(page, { width, theme });
  await expect(page.locator('.climate-day')).toHaveCount(7);
  await expect(page.locator('.climate-week-summary')).toContainText('21 mm previstos');
  await expect(page.locator('.climate-crop-grid')).toContainText('Vegetativo V2–V8');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.climate-page').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  const rectangles = await page.locator('.climate-day').evaluateAll(nodes => nodes.map(node => ({ x: node.getBoundingClientRect().x, right: node.getBoundingClientRect().right, height: node.getBoundingClientRect().height })));
  for (const rect of rectangles) { expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.right).toBeLessThanOrEqual(width); expect(rect.height).toBeGreaterThanOrEqual(44); }
  mkdirSync(output, { recursive: true }); await page.screenshot({ path: `${output}/clima-${width}-${theme}.png`, animations: 'disabled' });
  for (const [id, name] of [['climate-week-title','pronostico'], ['climate-crop-title','observaciones'], ['climate-history-title','historial']]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${name}-${width}-${theme}.png`, animations: 'disabled' });
  }
  expect(errors).toEqual([]);
});
test('un día sin dato no se convierte en lluvia cero y los gráficos muestran tabla y períodos', async ({ page }) => {
  const payload = structuredClone(climateData); payload.pronostico_7d[2].precipitacion_mm = null;
  await prepare(page, { payload }); await expect(page.locator('.climate-week-summary')).toContainText('Pronóstico parcial');
  await page.getByText('Ver datos del gráfico en una tabla', { exact: true }).click();
  await expect(page.locator('.climate-page tbody')).toContainText('Sin dato');
  await page.getByRole('button', { name: 'Últimos 12 meses', exact: true }).click();
  await expect(page.locator('.climate-page tbody')).toContainText('2026-10'); await expect(page.locator('.climate-page tbody')).toContainText('Sin dato');
  await page.getByRole('button', { name: 'Temperatura', exact: true }).click(); await expect(page.getByRole('columnheader', { name: 'Temperatura media (°C)', exact: true })).toBeVisible();
});
test('tocar un día abre Gemini con esa fecha y la parcela actual, sin botón Explicar gráfico', async ({ page }) => {
  await prepare(page); let body;
  await page.route('**/api/chat/preguntar', r => { body = r.request().postDataJSON(); return r.fulfill({ json: { texto: 'La lluvia prevista orienta las labores. Revisa el terreno antes de decidir.', fuente_datos: {} } }); });
  const date = climateData.pronostico_7d[4].fecha;
  await page.getByRole('button', { name: `Consultar pronóstico del ${date}`, exact: true }).click();
  await expect(page.locator('.from-assistant .zeasys-chat-answer')).toContainText('Revisa el terreno');
  expect(body.pregunta).toContain(date); expect(body.cultivo_id).toBe(1); expect(body.vista).toBe('climate');
  await expect(page.getByRole('button', { name: 'Explicar gráfico', exact: true })).toHaveCount(0);
});
test('si falla una actualización conserva los datos y fechas anteriores', async ({ page }) => {
  await prepare(page); await page.route('**/api/clima?*', r => r.fulfill({ status: 503, json: { error: 'Servicio no disponible' } }));
  await page.getByRole('button', { name: 'Actualizar clima', exact: true }).click();
  await expect(page.locator('.climate-notice')).toContainText('Se conserva la consulta anterior'); await expect(page.locator('.climate-day')).toHaveCount(7);
});
test('el tiempo actual no se sustituye por un promedio y el registro de campo está conectado', async ({ page }) => {
  await prepare(page, { payload: { ...climateData, clima_hoy: null, pronostico_7d: [], clima_actual: { temperatura: 999 } } });
  await expect(page.locator('.climate-now')).toContainText('El proveedor no entregó'); await expect(page.locator('.climate-now')).not.toContainText('999');
  await page.getByRole('button', { name: 'Registrar observación', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Registro de campo', exact: true })).toBeVisible();
});
test('la respuesta de otra parcela no se presenta como clima propio', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepare(page);
  await page.route('**/api/clima?*', r => r.fulfill({ json: { ...climateData, cultivo_activo: { id: 999 } } }));
  await page.getByRole('button', { name: 'Actualizar clima', exact: true }).click();
  await expect(page.locator('.climate-notice')).toBeVisible(); await expect(page.locator('.climate-day')).toHaveCount(7);
});
for (const theme of ['light', 'dark']) test(`accesibilidad del clima ${theme}`, async ({ page }) => {
  test.skip(!existsSync(axe), 'Sin axe-core local'); await prepare(page, { theme }); await page.addScriptTag({ path: axe });
  const violations = await page.evaluate(async () => (await window.axe.run('.climate-page', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
  expect(violations).toEqual([]);
});
