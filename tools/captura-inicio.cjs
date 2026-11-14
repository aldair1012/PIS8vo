// Captura full-page de la landing en modo claro/oscuro y dos anchos.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../frontend-app/package.json'))('@playwright/test');
const origin = process.env.ZEASYS_E2E_ORIGIN || 'http://127.0.0.1:5500';
const output = path.resolve(process.argv[2] || 'documentacion/fuentes-maiz/descargas/ui-inicio');
const widths = (process.env.ZEASYS_LANDING_WIDTHS || '1440,390').split(',').map(Number);
const themes = (process.env.ZEASYS_LANDING_THEMES || 'light,dark').split(',');
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of widths) for (const theme of themes) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, bypassCSP: true });
      await context.addInitScript(value => localStorage.setItem('theme', value), theme);
      const page = await context.newPage();
      await page.goto(origin + '/');
      await page.locator('.zeasys-home').waitFor();
      await page.waitForTimeout(700);
      const heights = await page.evaluate(() => [...document.querySelectorAll('#inicio, #capacidades, #datos, #contacto')].map(s => [s.id, Math.round(s.getBoundingClientRect().height)]));
      console.log(width, theme, JSON.stringify(heights));
      const snap = async (name) => { await page.locator(name).scrollIntoViewIfNeeded(); await page.waitForTimeout(650); return page.screenshot({ path: path.join(output, `${width}-${theme}-${name.replace('#', '')}.png`), animations: 'disabled' }); };
      await snap('#inicio');
      await snap('#capacidades');
      await snap('#datos');
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
