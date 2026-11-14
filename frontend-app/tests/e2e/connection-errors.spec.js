import { test, expect } from '@playwright/test';

test('permite recuperar la conexión al validar la sesión', async ({ page }) => {
  let requests = 0;
  let available = false;
  await page.route('**/backend-api/public/index.php/api/auth/yo', route => {
    requests += 1;
    return !available ? route.fulfill({ status: 503, json: { error: 'no disponible' } }) : route.fulfill({ json: { autenticado: false } });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar con ZeaSys');
  available = true;
  await page.getByRole('button', { name: 'Reintentar conexión' }).click();
  await expect(page.locator('.zeasys-home--dark, .zeasys-home--light')).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(2);
});

test('permite reintentar la carga de parcelas sin mostrar un estado vacío falso', async ({ page }) => {
  let requests = 0;
  let available = false;
  await page.route('**/backend-api/public/index.php/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/backend-api/public/index.php/api/auth/yo', route => route.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/backend-api/public/index.php/api/parcelas', route => {
    requests += 1;
    return !available ? route.fulfill({ status: 503, json: { error: 'no disponible' } }) : route.fulfill({ json: [] });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('No se pudieron cargar tus parcelas');
  available = true;
  await page.getByRole('button', { name: 'Reintentar carga' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron cargar tus parcelas' })).toHaveCount(0);
  expect(requests).toBeGreaterThanOrEqual(2);
});

test('muestra carga mientras se consultan las parcelas', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/backend-api/public/index.php/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/backend-api/public/index.php/api/auth/yo', route => route.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/backend-api/public/index.php/api/parcelas', async route => {
    await pending;
    await route.fulfill({ json: [] });
  });
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Cargando tus parcelas' })).toBeVisible();
  release();
  await expect(page.getByText('Cargando tus parcelas…')).toHaveCount(0);
});

test('ignora un fallo atrasado tras seleccionar otra parcela', async ({ page }) => {
  const parcelas = [{ id: 1, nombre_parcela: 'Parcela uno', area: 1 }, { id: 2, nombre_parcela: 'Parcela dos', area: 1 }];
  let requests = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/backend-api/public/index.php/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/backend-api/public/index.php/api/auth/yo', route => route.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/backend-api/public/index.php/api/parcelas', async route => {
    requests += 1;
    if (requests === 2) {
      await pending;
      await route.fulfill({ status: 503, json: { error: 'respuesta antigua' } });
    } else await route.fulfill({ json: parcelas });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Seleccionar parcela. Actual: Parcela uno' })).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Seleccionar parcela. Actual: Parcela uno' }).click();
  await page.getByText('Parcela dos', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Seleccionar parcela. Actual: Parcela dos' })).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThanOrEqual(3);
  release();
  await expect(page.getByText('No se pudieron cargar tus parcelas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Seleccionar parcela. Actual: Parcela dos' })).toBeVisible();
});

test('el historial distingue un fallo de conexión de una lista vacía', async ({ page }) => {
  let available = false;
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/backend-api/public/index.php/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/backend-api/public/index.php/api/auth/yo', route => route.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/backend-api/public/index.php/api/parcelas', route => route.fulfill({ json: [] }));
  await page.route('**/backend-api/public/index.php/api/simulaciones/historial**', route => !available
    ? route.fulfill({ status: 503, json: { error: 'no disponible' } })
    : route.fulfill({ json: { simulaciones: [], estadisticas: {}, años_disponibles: [] } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Cargando tus parcelas…')).toHaveCount(0);
  await page.getByRole('button', { name: 'Simulaciones guardadas' }).click();
  await expect(page.getByRole('alert')).toContainText('Error al cargar el historial');
  await expect(page.getByText('No hay simulaciones en el historial')).toHaveCount(0);
  available = true;
  await page.getByRole('button', { name: 'Reintentar carga' }).click();
  await expect(page.getByText('No hay simulaciones en el historial')).toBeVisible();
  await page.waitForTimeout(400);
  expect(pageErrors).toEqual([]);
});

test('el historial distingue mediciones ausentes de cero', async ({ page }) => {
  await page.route('**/backend-api/public/index.php/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/backend-api/public/index.php/api/auth/yo', route => route.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/backend-api/public/index.php/api/parcelas', route => route.fulfill({ json: [] }));
  await page.route('**/backend-api/public/index.php/api/simulaciones/historial**', route => route.fulfill({ json: {
    simulaciones: [{ id: 1, nombre: 'Sin mediciones', area_simulada: null, rendimiento_estimado: null, produccion_total: null }, { id: 2, nombre: 'Con cero', area_simulada: 0, rendimiento_estimado: 0, produccion_total: 0 }], estadisticas: {}, años_disponibles: [],
  } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Cargando tus parcelas…')).toHaveCount(0);
  await page.getByRole('button', { name: 'Simulaciones guardadas' }).click();
  const missing = page.getByRole('row').filter({ hasText: 'Sin mediciones' });
  await expect(missing).toContainText('Área no disponible');
  await expect(missing).toContainText('Rendimiento no disponible');
  await expect(missing).toContainText('Total: No disponible');
  const zero = page.getByRole('row').filter({ hasText: 'Con cero' });
  await expect(zero).toContainText('0,00 t/ha');
  await expect(zero).toContainText('Total: 0 t');
});
