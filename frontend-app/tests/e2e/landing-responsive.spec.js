import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/yo', route => route.fulfill({ json: { autenticado: false } }));
  await page.route('https://accounts.google.com/gsi/client*', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

const sizes = [
  [320, 568], [390, 844], [768, 1024], [944, 994], [1024, 768],
  [1366, 768], [1920, 1080], [844, 390], [1280, 720],
];

async function expectContentFits(page, state) {
  const problems = await page.evaluate(currentState => {
    const face = document.querySelector(currentState === 'portada' ? '.zeasys-hero-flip-front' : '.zeasys-hero-auth-back');
    const selectors = currentState === 'portada'
      ? ['.zeasys-visual-heading', '.zeasys-dashboard-preview', '.zeasys-preview-meta']
      : ['.zeasys-login-card-head', '.zeasys-login-form', '.zeasys-submit-btn', '.zeasys-register-prompt'];
    const boundary = face.getBoundingClientRect();
    const issues = [];
    if (face.scrollHeight > face.clientHeight + 1) issues.push('La cara de la tarjeta recorta contenido vertical');
    for (const selector of selectors) {
      const element = face.querySelector(selector);
      const rect = element.getBoundingClientRect();
      if (rect.left < boundary.left - 1 || rect.right > boundary.right + 1 || rect.top < boundary.top - 1 || rect.bottom > boundary.bottom + 1) issues.push(`${selector} sale de la tarjeta`);
      if (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1) issues.push(`${selector} recorta su contenido`);
    }
    if (document.documentElement.scrollWidth > innerWidth) issues.push('Hay desbordamiento horizontal');
    return issues;
  }, state);
  expect(problems).toEqual([]);
}

for (const [width, height] of sizes) {
  test(`portada, acceso y registro sin recortes a ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    for (const state of ['portada', 'acceso', 'registro']) {
      if (state === 'acceso') {
        await page.locator('.zeasys-hero-actions button').filter({ hasText: 'Ingresar' }).click();
        await expect(page.locator('.zeasys-login-form input[type="email"]')).toBeFocused();
      } else if (state === 'registro') {
        await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
        await expect(page.locator('.zeasys-login-card')).toHaveClass(/--register/);
        await expect(page.locator('.zeasys-auth-mode-card')).not.toHaveClass(/is-switching/);
      }
      for (const theme of ['dark', 'light']) {
        if (!await page.locator(`.zeasys-home--${theme}`).count()) {
          await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
          await page.locator('.zeasys-theme-toggle').click();
        }
        await page.mouse.move(0, 0);
        await page.waitForTimeout(120);
        await expectContentFits(page, state);
        if (state === 'portada' && width === 944) {
          const bottom = await page.locator('.zeasys-hero-flip-front').evaluate(e => e.getBoundingClientRect().bottom + scrollY);
          expect(bottom, 'La vista de parcela completa debe caber en la ventana de la captura').toBeLessThan(height - 16);
        }
      }
    }
  });
}

test('la rueda permite leer el final de secciones largas sin saltos automáticos', async ({ page }) => {
  await page.setViewportSize({ width: 944, height: 994 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const nextTop = document.getElementById('capacidades').getBoundingClientRect().top + scrollY;
    scrollTo({ top: nextTop - innerHeight * .6 - 5, behavior: 'instant' });
  });
  await page.waitForTimeout(300);
  await page.mouse.move(10, 300);
  await page.mouse.wheel(0, 20);
  await page.waitForTimeout(300);
  const position = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1600);
  expect(Math.abs(await page.evaluate(() => scrollY) - position)).toBeLessThan(2);
});
