// Medición reproducible con la cuenta de la base desechable, nunca con cuentas reales.
const { createRequire } = require('node:module');
const path = require('node:path');
const { chromium } = createRequire(path.resolve(__dirname, '../frontend-app/package.json'))('@playwright/test');
const origin = process.env.ZEASYS_E2E_ORIGIN || '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Indica ZEASYS_E2E_ORIGIN del entorno de integración desechable');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const login = await context.request.post(origin + '/backend-api/public/index.php/api/auth/iniciar-sesion', { data: { correo: 'a@example.test', contrasena: ' ClavePrueba-2026! ' } });
    if (!login.ok()) throw Error('No se pudo iniciar la cuenta ficticia');
    const page = await context.newPage();
    const start = Date.now();
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('.ydp-metric').first().waitFor({ timeout: 30000 });
    const sections = [{ nombre: 'Rendimiento inicial', ms: Date.now() - start }];
    for (const [name, selector] of [['Clima y cultivo', '.dashboard-view--climate'], ['Finanzas', '.dashboard-view--finance'], ['Mapa de parcelas', '.map-page-shell']]) {
      const began = Date.now();
      await page.getByRole('button', { name, exact: true }).click();
      await page.locator(selector).waitFor({ timeout: 30000 });
      sections.push({ nombre: name, ms: Date.now() - began });
    }
    const scripts = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script' && r.name.includes('/assets/')).map(r => ({ archivo: new URL(r.name).pathname.split('/').pop(), bytes_codificados: r.encodedBodySize })).sort((a,b) => b.bytes_codificados - a.bytes_codificados).slice(0,8));
    const apis = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/backend-api/public/index.php/api/')).map(r => ({ ruta: new URL(r.name).pathname.split('/api/').pop(), ms: Math.round(r.duration) })).sort((a,b) => b.ms-a.ms).slice(0,8));
    console.log(JSON.stringify({secciones: sections, consultas_mas_lentas: apis, scripts_mayores: scripts, aviso: 'Datos y usuario ficticios; proveedores y recursos externos bloqueados; una ejecución local con caché fría. Los tiempos incluyen carga de cada vista, no mapas satelitales ni uso real de red.'}, null, 2));
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
