import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/backend-api/public/index.php/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/backend-api/public/index.php/api/auth/me', route => route.fulfill({ json: { authenticated: true, user: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/backend-api/public/index.php/api/cultivos', route => route.fulfill({ json: [{ id: 1, nombre_parcela: 'Parcela de prueba', area: 1 }] }));
});

test('menú móvil mantiene el foco y vuelve al botón al pulsar Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
  await expect(page.getByRole('button', { name: 'Mis parcelas', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Mis parcelas', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Expandir barra lateral' })).toBeFocused();
  await expect(page.locator('#workspace-sidebar')).toHaveAttribute('inert', '');
});

test('selector de parcelas devuelve el foco y permite saltar al contenido', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Seleccionar parcela. Actual: Parcela de prueba' });
  await trigger.click();
  await expect(page.getByRole('textbox', { name: 'Buscar parcela' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.locator('.workspace-skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});
