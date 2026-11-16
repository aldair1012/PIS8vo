// Precalienta el servidor de desarrollo antes de la suite E2E.
// El dev server compila los módulos bajo demanda; si las rutas lazy vienen
// frías, los primeros tests superan el timeout. Este globalSetup hace una
// pasada rápida por las zonas principales para que el resto de la suite
// corra con todo compilado. No cambia ninguna aserción.
import { chromium } from '@playwright/test';

const origin = process.env.ZEASYS_E2E_ORIGIN || 'http://127.0.0.1:5500';

export default async function primeServer() {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch {
    return; // Sin Chrome disponible; los tests esperan y se adaptan como siempre.
  }
  try {
    const context = await browser.newContext();
    const login = await context.request.post(`${origin}/backend-api/public/index.php/api/auth/iniciar-sesion`, {
      data: { correo: 'a@example.test', contrasena: ' ClavePrueba-2026! ' },
    });
    if (!login.ok()) return;
    const page = await context.newPage();
    await page.goto(`${origin}/`);
    await page.waitForLoadState('networkidle', { timeout: 45000 });
    // Descartar el modal de bienvenida si aparece para clicar la navegación.
    const consejo = page.locator('.consejo-modal-primary, .consejo-modal-close');
    if (await consejo.first().isVisible().catch(() => false)) await consejo.first().click();
    const destinos = ['Mis parcelas', 'Simular cosecha', 'Rendimiento', 'Siembra', 'Clima y cultivo', 'Finanzas', 'Mapa de parcelas'];
    for (const name of destinos) {
      try {
        await page.getByRole('button', { name, exact: true }).click({ timeout: 8000 });
        await page.waitForLoadState('networkidle', { timeout: 20000 });
      } catch {
        /* El entorno desechable ya validará el recorrido en los tests. */
      }
    }
    await context.close();
  } catch {
    /* Si el servidor aún no está listo, no es fatal: los tests usan timeouts amplios. */
  } finally {
    await browser.close();
  }
}
