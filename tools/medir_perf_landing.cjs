// Mide la página pública con el navegador: bytes, peticiones y tiempos de carga.
const { chromium } = require('playwright');
const origin = process.env.ZEASYS_E2E_ORIGIN || 'http://127.0.0.1/ZeaSys/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const requests = new Map();
  page.on('response', async (response) => {
    const req = response.request();
    try {
      const body = await response.body();
      requests.set(req.url(), { url: req.url(), size: body.length, status: response.status(), type: req.resourceType() });
    } catch { /* ignore */ }
  });
  const start = Date.now();
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 60000 });
  const loadMs = Date.now() - start;
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]));
    const lcp = performance.getEntriesByType('largest-contentful-paint');
    return { domInteractive: Math.round(nav?.domInteractive ?? -1), domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? -1), loadEventEnd: Math.round(nav?.loadEventEnd ?? -1), paints, lcpMs: lcp.length ? Math.round(lcp[lcp.length - 1].startTime) : null };
  });
  const totalBytes = [...requests.values()].reduce((s, r) => s + r.size, 0);
  const byType = new Map();
  for (const r of requests.values()) byType.set(r.type, (byType.get(r.type) ?? 0) + r.size);
  const top = [...requests.values()].filter(r => r.size > 1024 * 20).sort((a, b) => b.size - a.size).slice(0, 12).map(r => `${(r.size / 1024).toFixed(1).padStart(7)} KB  ${r.type.padEnd(11)} ${r.url.split('/').pop()}`);
  console.log('demandas:', requests.size, 'bytes:', (totalBytes / 1024).toFixed(1), 'KB', 'loadEventMs:', loadMs);
  console.log('por tipo:', [...byType.entries()].map(([k, v]) => `${k}=${(v / 1024).toFixed(1)}KB`).join('  '));
  console.log('métricas:', JSON.stringify(metrics));
  console.log('más pesado:\n' + top.join('\n'));
  await browser.close();
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
