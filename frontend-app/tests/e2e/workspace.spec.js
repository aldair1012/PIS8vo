import { test, expect } from '@playwright/test';

const fixtureOrigin = process.env.ZEASYS_E2E_ORIGIN || '';
test.skip(!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixtureOrigin), 'Requiere el entorno de integración desechable de ZeaSys.');
test.setTimeout(120000);

for (const [width, theme] of [[390, 'dark'], [390, 'light'], [768, 'dark'], [768, 'light'], [1440, 'dark'], [1440, 'light']]) {
  test(`navegación del espacio de trabajo ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const result = await page.request.post('/backend-api/public/index.php/api/auth/login', {
      data: { correo: 'a@example.test', contrasena: ' ClavePrueba-2026! ' },
    });
    expect(result.ok()).toBeTruthy();
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.navbar')).toBeVisible();
    for (const name of ['Mis parcelas', 'Simular cosecha', 'Rendimiento', 'Siembra', 'Clima y cultivo', 'Finanzas', 'Mapa de parcelas', 'Simulaciones guardadas']) {
      if (await page.locator('#workspace-sidebar').evaluate(node => node.inert)) {
        await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
      }
      const item = page.getByRole('button', { name, exact: true });
      await item.click();
      await expect(page.locator('#workspace-sidebar .sidebar-item-btn').filter({ has: page.locator('span', { hasText: name }) })).toHaveAttribute('aria-current', 'page');
      // El servidor PHP aislado atiende de una en una las consultas y recursos.
      await expect(page.getByText('Cargando vista…', { exact: true })).toHaveCount(0, { timeout: 30000 });
      await expect(page.locator('.content-body').getByText(/^Cargando/)).toHaveCount(0, { timeout: 30000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (process.env.ZEASYS_AUDIT_SCREENSHOTS) await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(' ', '-')}.png`), animations: 'disabled' });
    }
    await page.getByRole('button', { name: /Configuración de cuenta de/ }).click();
    await expect(page.getByRole('heading', { name: 'Descargar información', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.ZEASYS_AUDIT_SCREENSHOTS) await page.screenshot({ path: testInfo.outputPath('Configuracion.png'), animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}

