import { test, expect } from '@playwright/test';

// Compare document coordinates: opening access on mobile may scroll to the
// focused field, but switching a colour theme must never change its layout.
async function layoutMetrics(page) {
  return page.evaluate(() => {
    const selectors = [
      '.zeasys-home-nav', '.zeasys-home-brand', '.zeasys-home-links',
      '.zeasys-home-nav-actions', '.zeasys-theme-toggle', '.zeasys-nav-login',
      '.zeasys-home-hero', '.zeasys-home-hero-copy', '.zeasys-home-hero h1',
      '.zeasys-home-hero h1 span', '.zeasys-home-lead', '.zeasys-hero-steps',
      '.zeasys-hero-actions', '.zeasys-hero-visual', '.zeasys-hero-flip',
      '.zeasys-hero-flip-front', '.zeasys-login-card', '.zeasys-auth-mode-card',
      '.zeasys-login-card-head', '.zeasys-google-signin', '.zeasys-login-divider',
      '.zeasys-login-form', '.zeasys-login-form input', '.zeasys-submit-btn',
      '.zeasys-register-prompt', '.zeasys-section-heading',
      '.zeasys-capability-grid', '.zeasys-data-card', '.zeasys-home-footer',
    ];
    return Object.fromEntries(selectors.flatMap(selector => (
      [...document.querySelectorAll(selector)].map((element, index) => {
        const rect = element.getBoundingClientRect();
        const css = getComputedStyle(element);
        return [`${selector}[${index}]`, {
          x: rect.x + (css.position === 'fixed' ? 0 : scrollX),
          y: rect.y + (css.position === 'fixed' ? 0 : scrollY),
          width: rect.width, height: rect.height,
          fontSize: css.fontSize, fontWeight: css.fontWeight,
          lineHeight: css.lineHeight, letterSpacing: css.letterSpacing,
          padding: css.padding,
        }];
      })
    )));
  });
}

for (const width of [390, 768, 1440, 1920]) {
  test(`cambiar tema conserva medidas en portada, acceso y registro a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/auth/yo', route => route.fulfill({ json: { autenticado: false } }));
    // Keep the unavailable-provider state deterministic without a Google login.
    await page.route('https://accounts.google.com/gsi/client*', route => route.abort());
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    for (const state of ['portada', 'acceso', 'registro']) {
      if (state === 'acceso') {
        await page.locator('.zeasys-hero-actions button').filter({ hasText: 'Ingresar' }).click();
        await expect(page.locator('.zeasys-login-card')).toHaveAttribute('aria-hidden', 'false');
        await expect(page.locator('.zeasys-login-form input[type="email"]')).toBeFocused();
      } else if (state === 'registro') {
        await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
        await expect(page.locator('.zeasys-login-card')).toHaveClass(/--register/);
        await expect(page.locator('.zeasys-auth-mode-card')).not.toHaveClass(/is-switching/);
      }
      await page.waitForTimeout(400);
      // Bring the fixed theme control back into view after mobile form focus.
      await page.evaluate(() => scrollTo(0, 0));
      await expect(page.getByRole('button', { name: 'Cambiar a modo claro' })).toBeVisible();
      await page.mouse.move(0, 0);
      const dark = await layoutMetrics(page);
      await page.getByRole('button', { name: 'Cambiar a modo claro' }).click();
      await page.mouse.move(0, 0);
      await expect(page.locator('.zeasys-home--light')).toBeVisible();
      await expect(page.locator('.zeasys-home-hero')).toHaveCSS('color-scheme', 'dark');
      await expect.poll(() => layoutMetrics(page), { message: `${state}: la geometría debe ser igual en ambos temas` }).toEqual(dark);
      const navbarSurface = await page.locator('.zeasys-home-nav').evaluate(element => {
        const css = getComputedStyle(element);
        return { colour: css.backgroundColor, blur: css.backdropFilter };
      });
      expect(navbarSurface.colour).toMatch(/(?:0\.82|\/ 0\.82)\)?$/);
      expect(navbarSurface.blur).toContain('blur(');
      await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
      await page.mouse.move(0, 0);
      await expect(page.locator('.zeasys-home--dark')).toBeVisible();
      await expect(page.locator('.zeasys-home-hero')).toHaveCSS('color-scheme', 'dark');
      await expect.poll(() => layoutMetrics(page)).toEqual(dark);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

for (const width of [390, 768, 1440]) {
  test(`portada conserva navegación y tema a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/backend-api/public/index.php/api/auth/yo', route => route.fulfill({ json: { autenticado: false } }));
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
