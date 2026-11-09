import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixtureOrigin = process.env.ZEASYS_E2E_ORIGIN || '';
test.skip(!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixtureOrigin), 'Requiere la base desechable de integración.');
test.describe.configure({ mode: 'serial' });
test.setTimeout(90000);

test.beforeEach(async ({ page }) => {
  const response = await page.request.post('/backend-api/public/index.php/api/auth/login', {
    data: { correo: 'a@example.test', contrasena: ' ClavePrueba-2026! ' },
  });
  expect(response.ok()).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.navbar')).toBeVisible();
});

test('simular desde el formulario conserva el resultado y lo guarda en historial', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const crops = await (await page.request.get('/backend-api/public/index.php/api/cultivos')).json();
  await page.getByRole('button', { name: 'Simular cosecha', exact: true }).click();
  await page.locator('#simular-parcela').selectOption(String(crops[0].id));
  await expect(page.getByRole('button', { name: 'Ejecutar Simulación', exact: true })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Modificar datos', exact: true }).click();
  await page.locator('#campo-riego_tipo').selectOption('goteo');
  for (const [id, value] of Object.entries({ 'simular-area': '1', 'simular-temperatura': '24.5', 'simular-humedad': '70', 'lluvia-ciclo': '700', 'simular-nitrogeno': '150', 'simular-ph': '6.2' })) {
    await page.locator(`#${id}`).fill(value);
  }
  await page.locator('#simular-suelo').selectOption('franco');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/simulaciones/simular') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ejecutar Simulación', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const result = (await response.json()).resultado;
  await expect(page.getByText('Resultado de la simulación', { exact: true })).toBeVisible();
  await expect(page.locator('#simular-area')).toHaveValue('1');
  await page.getByText('Datos utilizados y límites del cálculo', { exact: true }).click();
  await expect(page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Temperatura media', exact: true }) })).toContainText(/24[.,]5/);
  const history = await (await page.request.get('/backend-api/public/index.php/api/simulaciones/historial')).json();
  expect(history.simulaciones.some(item => Number(item.id) === Number(result.simulacion_id))).toBeTruthy();
  expect(result.rendimiento_estimado).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: 'Modificar escenario', exact: true }).click();
  await page.locator('#simular-area').fill('0.5');
  await expect(page.getByText('Resultado de la simulación', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('descarga JSON incluye todas las páginas y mediciones de la cuenta', async ({ page }) => {
  await page.getByRole('button', { name: /Configuración de cuenta de/ }).click();
  await expect(page.getByRole('heading', { name: 'Descargar información', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: /Registros de campo/ }).check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar JSON' }).click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  const data = JSON.parse(await readFile(await download.path(), 'utf8'));
  const history = await (await page.request.get('/backend-api/public/index.php/api/simulaciones/historial')).json();
  expect(data.meta.app).toBe('ZeaSys');
  expect(data.historial_simulaciones.length).toBe(history.paginacion.total);
  expect(data.historial_simulaciones.length).toBeGreaterThan(100);
  expect(data.lotes_gps.length).toBeGreaterThan(0);
  expect(data.registros_campo.length).toBe(data.lotes_gps.length);
});

test('registro de campo guarda un cambio y conserva los demás grupos', async ({ page }) => {
  await page.getByRole('button', { name: 'Mis parcelas', exact: true }).click();
  await page.getByRole('button', { name: 'Registro de campo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Registro de campo', exact: true });
  await expect(dialog.getByLabel('Profundidad evaluada (cm)')).toBeVisible({ timeout: 30000 });
  await dialog.getByLabel('Profundidad evaluada (cm)').fill('80');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/yield/mediciones') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Guardar mediciones', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const saved = (await response.json()).mediciones;
  expect(saved.datos.profundidad_cm).toBe(80);
  expect(saved.indicadores.indice_cosecha.valor).toBe(0.4);
  expect(saved.indicadores.agua_medida.valor).toBe(160);
  await expect(dialog.getByRole('status')).toContainText('Mediciones guardadas');
  await dialog.getByRole('button', { name: 'Cerrar registro de campo' }).click();
  await page.getByRole('button', { name: 'Registro de campo', exact: true }).click();
  await expect(dialog.getByLabel('Profundidad evaluada (cm)')).toHaveValue('80', { timeout: 30000 });
});
