// Sólo admite el servidor y la cuenta ficticia del entorno desechable de integración.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../frontend-app/package.json'))('@playwright/test');
const origin = process.env.ZEASYS_E2E_ORIGIN || '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Requiere el entorno desechable de integración.');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'documentacion/fuentes-maiz/descargas/rendimiento-estados-20261109'));
const axePath = path.join(root, 'documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js');
const api = origin + '/backend-api/public/index.php/api/';

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  try {
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, bypassCSP: true });
      const login = await context.request.post(api + 'auth/iniciar-sesion', { data: { correo: 'a@example.test', contrasena: ' ClavePrueba-2026! ' } });
      assert(login.ok(), 'Acceso ficticio disponible');
      await context.addInitScript(value => localStorage.setItem('theme', value), theme);
      const page = await context.newPage();
      const errors = [], externalGeocoding = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().includes('nominatim.openstreetmap.org')) externalGeocoding.push(request.url()); });
      await page.goto(origin);
      await page.locator('.ydp-metric').first().waitFor();
      const check = async state => {
        await page.evaluate(async () => {
          const finite = document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity);
          await Promise.all(finite.map(animation => animation.finished.catch(() => {})));
        });
        await page.addScriptTag({ path: axePath });
        const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
        const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth > innerWidth + 1, content: document.querySelector('.content-body').scrollWidth > document.querySelector('.content-body').clientWidth + 1 }));
        rows.push({ width, theme, state, violations, overflow, errors: [...errors], externalGeocoding: [...externalGeocoding] });
        await page.screenshot({ path: path.join(output, `${width}-${theme}-${state}.png`), animations: 'disabled' });
        await fs.writeFile(path.join(output, 'auditoria.json'), JSON.stringify(rows, null, 2));
        assert.equal(violations.length, 0, `Accesibilidad ${state}`);
        assert.deepEqual(overflow, { document: false, content: false });
        assert.deepEqual(errors, []);
        assert.deepEqual(externalGeocoding, [], 'La provincia del servidor evita geocodificación externa');
        console.log(width, theme, state, 'correcto');
      };
      await page.getByRole('button', { name: 'Consultar referencias de la zona' }).click();
      await page.locator('#ydp-ref-details').scrollIntoViewIfNeeded();
      await check('referencias');

      const factors = page.getByRole('region', { name: 'Aportes del modelo, gráfico desplazable' });
      await page.locator('.ydp-panel').filter({ has: factors }).getByRole('button', { name: 'Ver todos', exact: true }).click();
      await factors.scrollIntoViewIfNeeded();
      assert(await factors.evaluate(node => node.scrollHeight > node.clientHeight), 'Todos los factores requieren y permiten desplazamiento');
      await factors.focus();
      await page.keyboard.press('End');
      assert(await factors.evaluate(node => node.scrollTop > 0), 'Factores desplazables con teclado');
      await check('todos-factores');

      const comparison = page.locator('.ydp-panel').filter({ has: page.getByRole('heading', { name: 'Comparar simulaciones', exact: true }) });
      const selector = comparison.getByRole('combobox', { name: 'Comparar con' });
      const selected = await selector.locator('option').evaluateAll(nodes => nodes.find(node => node.textContent.includes('intercambiar')).value);
      const older = await selector.inputValue();
      await selector.selectOption(selected);
      await comparison.getByRole('columnheader', { name: `Seleccionada · #${older}`, exact: true }).waitFor();
      const table = comparison.getByRole('region', { name: 'Comparación de simulaciones, tabla desplazable' });
      await table.scrollIntoViewIfNeeded();
      await check('comparacion');

      await page.getByRole('button', { name: 'Ver o actualizar mediciones' }).click();
      await page.getByRole('dialog').getByLabel('Profundidad evaluada (cm)').waitFor();
      await check('registro');
      await page.getByRole('button', { name: 'Cerrar registro de campo' }).click();
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
