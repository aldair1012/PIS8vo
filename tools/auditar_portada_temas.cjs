/* Visual regression of the compiled public landing, without signing in. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const { chromium } = createRequire(path.join(root, 'frontend-app/package.json'))('@playwright/test');
const origin = process.env.ZEASYS_E2E_ORIGIN || 'http://localhost/ZeaSys/';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Use a local review server.');
const responsive = process.env.ZEASYS_AUDIT_PROFILE === 'responsive';
const responsiveSizes = { 390: 844, 768: 1024, 944: 994, 1366: 768, 1920: 1080, 844: 390 };
const output = path.join(root, `documentacion/fuentes-maiz/descargas/portada-${responsive ? 'responsive' : 'temas'}-20261109`);
const axePath = path.join(root, 'documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js');
assert(fs.existsSync(axePath), 'Falta axe-core en el entorno de auditoría; no se puede certificar accesibilidad.');
const defaults = responsive ? Object.keys(responsiveSizes).map(Number) : [390, 768, 1440, 1920];
const widths = process.argv.length > 2 ? process.argv.slice(2).map(Number) : defaults;
assert(widths.every(width => defaults.includes(width)));
fs.mkdirSync(output, { recursive: true });

async function geometry(page) {
  return page.evaluate(() => Object.fromEntries([
    '.zeasys-home-nav', '.zeasys-home-hero', '.zeasys-home-hero h1',
    '.zeasys-home-lead', '.zeasys-hero-steps', '.zeasys-hero-actions',
    '.zeasys-hero-flip', '.zeasys-login-card', '.zeasys-login-card-head',
    '.zeasys-google-signin', '.zeasys-google-button-host',
    '.zeasys-login-form', '.zeasys-submit-btn', '.zeasys-register-prompt',
    '.zeasys-capability-grid', '.zeasys-data-card', '.zeasys-home-footer',
  ].flatMap(selector => [...document.querySelectorAll(selector)].map((element, i) => {
    const rect = element.getBoundingClientRect();
    const css = getComputedStyle(element);
    return [`${selector}[${i}]`, {
      x: rect.x, y: rect.y + (css.position === 'fixed' ? 0 : scrollY),
      width: rect.width, height: rect.height,
      font: css.font, letterSpacing: css.letterSpacing,
    }];
  }))));
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    for (const width of widths) {
      const height = responsive ? responsiveSizes[width] : 1000;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: width === 1920 ? 'no-preference' : 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/auth/yo', route => route.fulfill({ json: { autenticado: false } }));
      if (width !== 1920) await page.route('https://accounts.google.com/gsi/client*', route => route.abort());
      await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
      await page.goto(origin);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.zeasys-home').waitFor();
      // Provider loading is independent of a theme change. Wait until it is
      // either ready or unavailable before comparing the two colour modes.
      await page.waitForFunction(() => document.querySelector('.zeasys-google-button-host') || document.querySelector('.zeasys-google-status[role="alert"]'), null, { timeout: 12000 });
      if (fs.existsSync(axePath)) await page.addScriptTag({ path: axePath });
      for (const state of ['portada', 'acceso', 'registro']) {
        if (state === 'acceso') {
          await page.locator('.zeasys-hero-actions button').filter({ hasText: 'Ingresar' }).click();
          await page.waitForFunction(() => document.querySelector('.zeasys-login-card')?.getAttribute('aria-hidden') === 'false');
        } else if (state === 'registro') {
          await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
          await page.waitForFunction(() => document.querySelector('.zeasys-login-card--register') && !document.querySelector('.zeasys-auth-mode-card.is-switching'));
        }
        await page.waitForTimeout(1200);
        let reference;
        for (const theme of ['dark', 'light']) {
          if (!await page.locator(`.zeasys-home--${theme}`).count()) {
            await page.evaluate(() => scrollTo(0, 0));
            await page.locator('.zeasys-theme-toggle').click();
          }
          await page.mouse.move(0, 0);
          await page.evaluate(() => scrollTo(0, 0));
          await page.waitForTimeout(650);
          const metrics = await geometry(page);
          const differences = [];
          if (reference) for (const [selector, values] of Object.entries(metrics)) {
            for (const [key, value] of Object.entries(values)) {
              const before = reference[selector]?.[key];
              if (typeof value === 'number' ? Math.abs(value - before) > .05 : value !== before) differences.push({ selector, key, before, after: value });
            }
          }
          else reference = metrics;
          const violations = fs.existsSync(axePath) ? await page.evaluate(async () => (await window.axe.run('.zeasys-home', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }))) : [];
          const surface = await page.locator('.zeasys-home-nav').evaluate(e => ({ background: getComputedStyle(e).backgroundColor, blur: getComputedStyle(e).backdropFilter }));
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
          const providerReady = Boolean(await page.locator('.zeasys-google-button-host iframe').count());
          const clipped = await page.locator(state === 'portada' ? '.zeasys-hero-flip-front' : '.zeasys-hero-auth-back').evaluate(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
          const screenshot = `${width}-${state}-${theme}.png`;
          if (responsive && state === 'portada') await page.screenshot({ path: path.join(output, `${width}-${state}-${theme}-viewport.png`) });
          await page.locator(state === 'portada' ? '.zeasys-home-hero' : '.zeasys-login-card').screenshot({ path: path.join(output, screenshot) });
          results.push({ width, height, state, theme, metrics, differences, surface, overflow, clipped, providerReady, violations, errors: [...errors], screenshot });
          console.log(JSON.stringify({ width, height, state, theme, differences: differences.length, violations: violations.length, overflow, clipped, providerReady }));
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    const reportPath = path.join(output, 'auditoria.json');
    const previous = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')).filter(r => !widths.includes(r.width)) : [];
    fs.writeFileSync(reportPath, JSON.stringify([...previous, ...results], null, 2));
  }
  assert.equal(results.length, widths.length * 6);
  assert.equal(results.filter(r => r.differences.length || r.violations.length || r.errors.length || r.overflow || r.clipped).length, 0, 'Inspect auditoria.json for failed checks.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
