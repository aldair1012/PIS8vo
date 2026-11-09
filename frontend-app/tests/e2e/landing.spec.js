import { test, expect } from '@playwright/test';

for (const width of [390, 768, 1440]) {
  test(`portada conserva navegación y tema a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/backend-api/public/index.php/api/auth/me', route => route.fulfill({ json: { authenticated: false } }));
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.zeasys-home--dark')).toBeVisible();
    await page.getByRole('button', { name: 'Cambiar a modo claro' }).click();
    await expect(page.locator('.zeasys-home--light')).toBeVisible();
    await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
    await expect(page.locator('.zeasys-home--dark')).toBeVisible();
    if (width === 390) {
      const menu = page.getByRole('button', { name: 'Abrir menú' });
      await menu.click();
      await expect(page.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
