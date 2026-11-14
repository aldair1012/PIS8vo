/* Isolated public-browser review: fixture data and requests, no personal database. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { chromium } = createRequire(path.join(root, 'frontend-app/package.json'))('@playwright/test');
const output = path.join(root, 'documentacion/fuentes-maiz/descargas/explicaciones-20261110');
const axePath = path.join(root, 'documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js');
const origin = process.env.ZEASYS_E2E_ORIGIN || 'http://localhost/ZeaSys/';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
assert(fs.existsSync(axePath), 'Falta axe-core para revisar accesibilidad.');
fs.mkdirSync(output, { recursive: true });

async function main() {
  const { plot, sowing, yieldData } = await import(pathToFileURL(path.join(root, 'frontend-app/tests/fixtures/explanationData.mjs')));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [], contexts = [];
  try {
    for (const width of [390, 944, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(t => { localStorage.setItem('onboarding_done_987', 'true'); localStorage.setItem('theme', t); }, theme);
      await page.route('**/api/**', r => r.fulfill({ json: {} }));
      await page.route('**/api/auth/yo', r => r.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
      await page.route('**/api/parcelas', r => r.fulfill({ json: [plot] }));
      await page.route('**/api/escenarios?*', r => r.fulfill({ json: sowing }));
      await page.route('**/api/rendimiento?*', r => r.fulfill({ json: yieldData }));
      await page.route('**/api/simulaciones/explicar', r => {
        const payload = r.request().postDataJSON();
        assert(!Object.hasOwn(payload, 'guia_lectura'));
        contexts.push(payload);
        return r.fulfill({ json: { que_significa: 'Detalle adicional de la revisión.' } });
      });
      await page.goto(origin);
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: axePath });
      for (const view of ['Rendimiento', 'Siembra']) {
        const navigation = page.getByRole('button', { name: view, exact: true });
        if (!await navigation.isVisible()) await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
        await navigation.click();
        if (view === 'Siembra') { await page.getByRole('button',{name:/Consultar simulaciones guardadas/}).click();await page.locator('.sowing-advanced > summary').click(); }
        await page.locator('.ydp-metrics').waitFor();
        assert.equal(await page.getByRole('button', { name: 'Explicar gráfico', exact: true }).count(), 0);
        const titles = page.locator('.ydp-dashboard .dashboard-explain-title');
        const count = await titles.count();
        assert(count >= (view === 'Siembra' ? 5 : 7), 'Debe incluir las tarjetas y los gráficos.');
        for (let index = 0; index < count; index++) {
          const trigger = titles.nth(index);
          const title = await trigger.innerText();
          await trigger.click();
          const dialog = page.getByRole('dialog', { name: /Información de/ });
          await dialog.waitFor();
          await page.locator('.simulation-info-card-loading').waitFor({ state: 'hidden' });
          assert(await dialog.getByRole('heading', { name: 'Qué muestra', exact: true }).isVisible());
          assert(await dialog.getByRole('heading', { name: 'Cómo leerlo', exact: true }).count());
          assert(await dialog.getByRole('heading', { name: 'Ten en cuenta', exact: true }).count());
          const overflow = await dialog.evaluate(e => e.scrollWidth > e.clientWidth + 1);
          const violations = index === count - 1 ? await page.evaluate(async () => (await window.axe.run('.simulation-info-card', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }))) : [];
          if (index === count - 1) await dialog.screenshot({ path: path.join(output, `${width}-${theme}-${view}.png`) });
          results.push({ width, theme, view, title, overflow, violations, errors: [...errors] });
          await page.keyboard.press('Escape');
          assert(await trigger.evaluate(e => e === document.activeElement));
        }
        console.log(JSON.stringify({ width, theme, view, explanations: count, errors: errors.length }));
      }
      await context.close();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'auditoria.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(output, 'contextos.json'), JSON.stringify(contexts, null, 2));
  }
  assert.equal(results.filter(r => r.overflow || r.violations.length || r.errors.length).length, 0, 'Revisa auditoria.json.');
  // Validate the exact browser payloads with the real PHP domain service and its
  // in-memory repositories. This also runs its existing evidence/absence suite.
  const php = spawnSync(process.env.ZEASYS_PHP || 'C:/xampp/php/php.exe', ['-r', `
    require getcwd().'/backend-api/tests/explicacion/ejecutar.php';
    $contextos = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
    [$interprete] = servicio();
    foreach ($contextos as $contexto) {
      $respuesta = $interprete->explicar($contexto);
      contrato($respuesta);
      comprobar(!str_starts_with($respuesta['que_significa'], 'No hay un dato disponible'), 'El contexto visible debe poder interpretarse: '.$contexto['nombre']);
    }
    echo 'Contextos reales del navegador aprobados: '.count($contextos).PHP_EOL;
  `], { cwd: root, input: JSON.stringify(contexts), encoding: 'utf8' });
  fs.writeFileSync(path.join(output, 'contrato-php.log'), php.stdout + php.stderr);
  assert.equal(php.status, 0, php.stdout + php.stderr);
  console.log(php.stdout.trim());
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
