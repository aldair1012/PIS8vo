// Captura full-page de las vistas de datos sobre la cuenta ficticia del entorno desechable.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../frontend-app/package.json'))('@playwright/test');
const origin = process.env.ZEASYS_E2E_ORIGIN || '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Requiere el entorno desechable.');
const output = path.resolve(process.argv[2] || 'documentacion/fuentes-maiz/descargas/ui-fullpage');
const views = (process.env.ZEASYS_CAPTURE_VIEWS || 'Rendimiento,Siembra,Clima y cultivo,Finanzas').split(',');
const themes = (process.env.ZEASYS_CAPTURE_THEMES || 'light,dark').split(',');
const captureHeight = Number(process.env.ZEASYS_CAPTURE_HEIGHT || 1650);
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const theme of themes) {
      const context = await browser.newContext({ viewport: { width: 1440, height: captureHeight }, bypassCSP: true, deviceScaleFactor: 1 });
      const response = await context.request.post(origin + '/backend-api/public/index.php/api/auth/iniciar-sesion', { data: { correo: 'a@example.test', contrasena: ' ClavePrueba-2026! ' } });
      if (!response.ok()) throw Error('Falló el acceso ficticio.');
      await context.addInitScript(value => localStorage.setItem('theme', value), theme);
      const page = await context.newPage();
      await page.goto(origin + '/');
      await page.locator('.navbar').waitFor();
      // Captura del modal de bienvenida (se muestra en la primera entrada fresca).
      // Espera a que el dashboard de inicio pinte algo antes de capturar con el modal encima.
      await page.waitForFunction(() => {
        const c = document.querySelector('#workspace-content');
        return c && c.children.length > 0 && (c.textContent?.trim().length ?? 0) > 60;
      }, null, { timeout: 60000 }).catch(() => {});
      const cerrarConsejo = page.locator('.consejo-modal-primary, .consejo-modal-close');
      const modalVisible = await cerrarConsejo.first().isVisible().catch(() => false);
      if (modalVisible) {
        await page.screenshot({ path: path.join(output, `consejo-${theme}.png`), animations: 'disabled' });
        console.log('captura consejo', theme);
        await cerrarConsejo.first().click();
        await page.waitForTimeout(600);
      }
      for (const name of views) {
        if (await page.locator('#workspace-sidebar').evaluate(node => node.inert)) await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
        await page.getByRole('button', { name, exact: true }).click();
        await page.waitForTimeout(650);
        await page.waitForFunction(() => ![...document.querySelectorAll('#workspace-content .flex-center, #workspace-content [role=status]')].some(n => /^Cargando/i.test(n.textContent.trim())), null, { timeout: 60000 });
        await page.waitForTimeout(900);
        const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '-');
        await page.screenshot({ path: path.join(output, `1440-${theme}-${slug}.png`), animations: 'disabled', fullPage: true });
        console.log('captura', theme, name);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
