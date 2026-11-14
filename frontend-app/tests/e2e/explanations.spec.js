import { test, expect } from '@playwright/test';

import { plot, sowing, yieldData } from '../fixtures/explanationData.mjs';

async function prepare(page, { view = 'Siembra', data = sowing, width = 1440, handler } = {}) {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { localStorage.setItem('onboarding_done_987', 'true'); localStorage.setItem('theme', 'light'); });
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/auth/yo', route => route.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/api/parcelas', route => route.fulfill({ json: [plot] }));
  await page.route('**/api/rendimiento?*', route => route.fulfill({ json: yieldData }));
  await page.route('**/api/escenarios?*', route => route.fulfill({ json: data }));
  await page.route('**/api/simulaciones/explicar', handler || (route => route.fulfill({ json: { que_significa: 'Detalle adicional del servidor.' } })));
  await page.goto('/');
  if (view === 'Siembra') {
    if (!await page.getByRole('button', { name: 'Siembra', exact: true }).isVisible()) await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
    await page.getByRole('button', { name: 'Siembra', exact: true }).click();
    await page.getByRole('button',{name:/Consultar simulaciones guardadas/}).click();
    await page.locator('.sowing-advanced > summary').click();
  }
  await expect(page.locator('.ydp-metrics')).toBeVisible();
}

test('el gráfico y la superficie abren una explicación clara sin botones extra', async ({ page }) => {
  const requests = [];
  await prepare(page, { handler: route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { que_significa: 'Detalle adicional del servidor.' } }); } });
  await expect(page.getByRole('button', { name: 'Explicar gráfico', exact: true })).toHaveCount(0);
  const panel = page.locator('.ydp-panel').filter({ has: page.getByRole('heading', { name: 'Percentiles de la muestra guardada', exact: true }) });
  await panel.locator('canvas').click({ position: { x: 80, y: 80 } });
  const info = page.getByRole('dialog', { name: /Información de/ });
  await expect(info.getByRole('heading', { name: 'Cómo leerlo', exact: true })).toBeVisible();
  await expect(info).toContainText('P10');
  await expect(info).toContainText('P90');
  await expect(info).toContainText('no son probabilidades');
  const unobstructed = await info.evaluate(element => {
    const panel = element.getBoundingClientRect();
    const launcher = document.querySelector('.zeasys-chat-tab')?.getBoundingClientRect();
    if (!launcher) return true;
    const left = Math.max(panel.left, launcher.left), right = Math.min(panel.right, launcher.right);
    const top = Math.max(panel.top, launcher.top), bottom = Math.min(panel.bottom, launcher.bottom);
    return right <= left || bottom <= top || Boolean(document.elementFromPoint((left + right) / 2, (top + bottom) / 2)?.closest('.simulation-info-card'));
  });
  expect(unobstructed, 'El lanzador del asistente no debe tapar la explicación').toBe(true);
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].datos_grafico).toEqual(sowing.percentiles);
  expect(requests[0]).not.toHaveProperty('guia_lectura');
  await page.keyboard.press('Escape');
  await expect(panel.getByRole('button', { name: /Ver explicación de Percentiles/ })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(info).toBeVisible();
  expect(requests).toHaveLength(1);
});

test('la tarjeta completa funciona con clic y teclado y conserva el valor cero', async ({ page }) => {
  await prepare(page, { data: { ...sowing, kpis: { rendimiento_esperado: 0 } }, width: 390 });
  const card = page.locator('.ydp-metric').filter({ hasText: 'Rendimiento medio guardado' });
  await card.locator('.ydp-metric-value').click();
  const info = page.getByRole('dialog', { name: /Información de/ });
  await expect(info.locator('.simulation-info-card-value')).toHaveText('0 t/ha');
  await expect(info).toContainText('toneladas por cada hectárea');
  await page.keyboard.press('Escape');
  await expect(card.getByRole('button')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(info).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('la guía aparece de inmediato y sigue disponible si falla el detalle del servidor', async ({ page }) => {
  let pending;
  await prepare(page, { handler: route => { pending = route; } });
  await page.getByRole('button', { name: /Ver explicación de Mediana guardada/ }).click();
  const info = page.getByRole('dialog', { name: /Información de/ });
  await expect(info.getByRole('heading', { name: 'Qué muestra', exact: true })).toBeVisible();
  await expect(info).toContainText('valor central');
  await expect.poll(() => Boolean(pending)).toBe(true);
  await pending.fulfill({ status: 503, json: { error: 'sin conexión' } });
  await expect(info).toContainText('detalle adicional');
  await expect(info).toContainText('valor central');
});

test('las unidades, filtros y selección de ejecuciones no abren explicaciones accidentalmente', async ({ page }) => {
  await prepare(page, { view: 'Rendimiento' });
  await page.getByRole('button', { name: 'Toneladas', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver todos', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toHaveCount(0);
  await page.locator('.ydp-run-bar').filter({ hasText: '#102' }).click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toHaveCount(0);
  await page.locator('.ydp-run-bar').filter({ hasText: '#101' }).click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toHaveCount(0);
  await page.locator('.ydp-run-bar').filter({ hasText: '#102' }).click();
  await page.getByRole('button', { name: 'Ver explicación de Rendimiento', exact: true }).click();
  const info = page.getByRole('dialog', { name: /Información de/ });
  await expect(info.locator('.simulation-info-card-value')).toHaveText('3 t/ha');
  await expect(info).toContainText('#102');
});

test('una única simulación no se explica como una distribución de probabilidades', async ({ page }) => {
  await prepare(page, { data: { ...sowing, resumen_descriptivo: { muestra: 1 }, percentiles: { p10: 4, p50: 4, p90: 4, muestra: 1 } } });
  await page.getByRole('button', { name: /Ver explicación de Resultado de la simulación disponible/ }).click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toContainText('una sola simulación');
});

test('una explicación se cierra al cambiar la ejecución y no conserva el resultado anterior', async ({ page }) => {
  await prepare(page, { view: 'Rendimiento' });
  await page.getByRole('button', { name: 'Ver explicación de Rendimiento', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toContainText('#101');
  await page.locator('.ydp-run-bar').filter({ hasText: '#102' }).click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toHaveCount(0);
  await page.locator('.ydp-run-bar').filter({ hasText: '#101' }).click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toHaveCount(0);
  await page.locator('.ydp-run-bar').filter({ hasText: '#102' }).click();
  await page.getByRole('button', { name: 'Ver explicación de Rendimiento', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toContainText('#102');
});

test('dos pulsaciones mientras carga comparten una consulta y el foco vuelve a la última tarjeta', async ({ page }) => {
  const pending = [];
  await prepare(page, { handler: route => { pending.push(route); } });
  const first = page.getByRole('button', { name: /Ver explicación de Rendimiento medio guardado/ });
  await first.click(); await first.click();
  await expect.poll(() => pending.length).toBe(1);
  await pending[0].fulfill({ json: { que_significa: 'Detalle del promedio.' } });
  const second = page.getByRole('button', { name: /Ver explicación de Mediana guardada/ });
  await second.click();
  await page.keyboard.press('Escape');
  await expect(second).toBeFocused();
  await expect.poll(() => pending.length).toBe(2);
  await pending[1].fulfill({ json: { que_significa: 'Detalle de la mediana.' } });
  await expect(page.getByRole('dialog', { name: /Información de/ })).toHaveCount(0);
});

test('los percentiles ausentes se explican como ausencia, sin inventar ceros', async ({ page }) => {
  await prepare(page, { data: { ...sowing, percentiles: { p10: null, p50: null, p90: null, muestra: 3 } } });
  await page.getByRole('button', { name: /Ver explicación de Percentiles de la muestra guardada/ }).click();
  const info = page.getByRole('dialog', { name: /Información de/ });
  await expect(info).toContainText('No hay percentiles descriptivos válidos');
  await expect(info).not.toContainText('P10: 0');
});

test('las tarjetas financieras conservan la explicación directa sin un botón adicional', async ({ page }) => {
  const sent = [];
  await prepare(page, { view: 'Rendimiento', handler: route => { sent.push(route.request().postDataJSON()); return route.fulfill({ json: { que_significa: 'Ingreso menos los costos configurados.' } }); } });
  await page.route('**/api/financiero?*', route => route.fulfill({ json: { kpis: { margen_neto: 100, area_parcela: 2, nombre_parcela: plot.nombre_parcela }, costo_total: 100, waterfall_costos: [{ label: 'Ingreso Bruto', amount: 200 }] } }));
  await page.getByRole('button', { name: 'Finanzas', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Ver explicación de Margen neto estimado', exact: true });
  await expect(trigger).toBeVisible();
  await expect(page.locator('.kpi-explain-action')).toHaveCount(0);
  await trigger.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: /Información de/ })).toContainText('Ingreso menos los costos configurados.');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.locator('.kpi-card').filter({ has: trigger }).locator('.kpi-value').first().click();
  await expect(page.getByRole('dialog', { name: /Información de/ })).toBeVisible();
  expect(sent[0].nombre).toBe('Margen neto estimado');
});
