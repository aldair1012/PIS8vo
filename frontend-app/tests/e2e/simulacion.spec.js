import { test, expect } from '@playwright/test';
import fixture from '../fixtures/simulacion-prueba.json' with { type: 'json' };

// Parcela ficticia; resultado calculado offline con XGBoost. Nada se guarda en la cuenta.
const crop = { id: 91, nombre_parcela: 'Parcela de prueba', area: 1, ph: 6.2, variedad_maiz: 'INIAP 101 Blanco Harinoso Precoz', tipo_maiz: 'Suave Harinoso', ubicacion: 'Comunidad sin provincia en el nombre', latitud: -.18, longitud: -78.47, fecha_siembra: '2024-02-28' };
const location = { success: true, temperatura: 16, humedad: 70, ph_suelo: 6.2, tipo_suelo: 'franco', area_simulada: 1, provincia: 'Pichincha', fuente_provincia: 'Coordenadas de la parcela', referencia_suelo: { clase_estimada: 'Franco limosa' } };

async function abrir(page, theme, width, deferredLocation = null) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(value => { localStorage.setItem('theme', value); localStorage.setItem('onboarding_completed', 'true'); }, theme);
  await page.route('**/backend-api/public/index.php/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/backend-api/public/index.php/api/auth/me', route => route.fulfill({ json: { authenticated: true, user: { id: 987, nombre: 'Prueba', rol: 'productor' } } }));
  await page.route('**/backend-api/public/index.php/api/cultivos', route => route.fulfill({ json: [crop] }));
  await page.route('**/backend-api/public/index.php/api/cultivos/valores-ubicacion*', async route => { if (deferredLocation) await deferredLocation; await route.fulfill({ json: location }); });
  await page.goto('/');
  const nav = page.getByRole('button', { name: 'Simular cosecha', exact: true });
  if (!await nav.isVisible()) await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
  await nav.click();
  await page.locator('#simular-parcela').selectOption('91');
}

for (const theme of ['light', 'dark']) for (const width of [390, 820, 1440]) {
  test(`preparación, edición y resultado en ${theme} a ${width}px`, async ({ page }, testInfo) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await abrir(page, theme, width);
    await expect(page.locator('.simulation-location')).toContainText('Pichincha');
    await expect(page.locator('#simular-suelo')).toHaveValue('franco');
    await expect(page.locator('#simular-suelo')).toBeDisabled();
    await page.getByRole('button', { name: 'Modificar datos', exact: true }).click();
    await page.locator('#simular-area').fill('0,83'); await page.locator('#simular-area').blur();
    await expect(page.locator('#simular-area')).toHaveValue('0.83');
    await page.locator('#simular-temperatura').fill('26,7'); await page.locator('#simular-temperatura').blur();
    await expect(page.locator('#simular-temperatura')).toHaveValue('26.7');
    await page.locator('#simular-suelo').selectOption('arcilloso');
    await page.locator('#lluvia-ciclo').fill('700'); await page.locator('#simular-nitrogeno').fill('150');
    await page.locator('#campo-riego_tipo').selectOption('goteo');
    await page.locator('#campo-lamina_riego_mm').fill('150');
    await page.locator('.simulation-optional > summary').click();
    await page.getByLabel('Duración prevista del cultivo (días)').fill('120');
    await expect(page.getByText('2024-06-26', { exact: true })).toBeVisible();
    await page.locator('.simulation-workbench').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`preparar-${theme}-${width}.png`) });
    let sent;
    await page.route('**/backend-api/public/index.php/api/simulaciones/simular', route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { success: true, resultado: fixture } }); });
    await page.getByRole('button', { name: 'Ejecutar Simulación', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Resultado de la simulación', exact: true })).toBeVisible();
    expect(sent.area_simulada).toBe(.83); expect(sent.temperatura).toBe(26.7);
    expect(sent.usar_suelo_ubicacion).toBe(false); expect(sent.parametros_campo.riego_tipo).toBe('goteo');
    await expect(page.getByRole('tab', { name: '2 Resultado', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-preparar')).toBeHidden();
    expect(await page.locator('.simulation-workbench').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`resultado-${theme}-${width}.png`) });
    await page.getByText('Datos utilizados y límites del cálculo', { exact: true }).click();
    await expect(page.locator('.simulation-data-scroll')).toContainText('Sistema de agua o riego');
    await page.getByRole('button', { name: 'Modificar escenario', exact: true }).click();
    await expect(page.locator('#simular-area')).toHaveValue('0.83');
    await page.locator('#simular-area').fill('0.5');
    await expect(page.getByRole('tab', { name: '2 Resultado', exact: true })).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

test('respuesta tardía no reemplaza datos ya corregidos por el usuario', async ({ page }) => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  await abrir(page, 'light', 1440, pending);
  await page.getByRole('button', { name: 'Modificar datos', exact: true }).click();
  await page.locator('#simular-temperatura').fill('31.2');
  release();
  await expect(page.locator('#simular-suelo')).toHaveValue('franco');
  await expect(page.locator('#simular-temperatura')).toHaveValue('31.2');
});

test('no interpreta una coma ambigua de miles como 3.5 mm', async ({ page }) => {
  await abrir(page, 'light', 1440);
  await expect(page.locator('#simular-suelo')).toHaveValue('franco');
  await page.locator('#lluvia-ciclo').fill('3,500');
  await page.locator('#simular-nitrogeno').fill('150');
  await page.locator('#campo-riego_tipo').selectOption('temporal_lluvia');
  await expect(page.locator('#campo-lamina_riego_mm')).toHaveValue('0');
  await page.getByRole('button', { name: 'Ejecutar Simulación', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No uses separadores de miles');
  await expect(page.locator('#lluvia-ciclo')).toHaveValue('3,500');
});
