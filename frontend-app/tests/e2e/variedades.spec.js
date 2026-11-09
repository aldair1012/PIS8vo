import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Datos ficticios de parcela. Las fichas y la evaluación salen del servicio real.
const root = fileURLToPath(new URL('../../../', import.meta.url)).replaceAll('\\', '/');
const php = process.env.ZEASYS_TEST_PHP || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
const evaluations = JSON.parse(execFileSync(php, ['-r', `
require '${root}/backend-api/src/Kernel/AutoloaderPsr4.php';
ZeaSys\\Kernel\\AutoloaderPsr4::registrar('${root}/backend-api/src');
$c=new ZeaSys\\Dominios\\Simulaciones\\Aplicacion\\CatalogoMaiz(); $out=[];
foreach (['grano_seco','choclo','forraje','tostado','canguil'] as $uso) {
 $out[$uso]=$c->evaluar(['variedad_maiz'=>'INIAP 101 Blanco Harinoso Precoz','tipo_maiz'=>'Suave Harinoso','ubicacion'=>'Pichincha','altitud'=>2700,'ph'=>6.2],['objetivo'=>$uso]);
}
$out['perfil_canguil']=$c->evaluar(['variedad_maiz'=>'INIAP 198 Canguil','tipo_maiz'=>'Duro Amarillo / Blanco','ubicacion'=>'Pichincha','altitud'=>2700],['objetivo'=>'canguil']);
echo json_encode($out);`], { encoding: 'utf8' }));

for (const theme of ['light', 'dark']) {
  for (const width of [390, 820, 1440]) {
    test(`fichas y cambio de uso en ${theme}, ${width}px`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => {
        localStorage.setItem('theme', value);
        localStorage.setItem('onboarding_done_987', 'true');
      }, theme);
      await page.route('**/backend-api/public/index.php/api/**', route => route.fulfill({ json: {} }));
      await page.route('**/backend-api/public/index.php/api/auth/me', route => route.fulfill({ json: { authenticated: true, user: { id: 987, nombre: 'Prueba', rol: 'productor' } } }));
      await page.route('**/backend-api/public/index.php/api/cultivos', route => route.fulfill({ json: [{ id: 1, nombre_parcela: 'Parcela ficticia', area: 1, variedad_maiz: 'INIAP 101 Blanco Harinoso Precoz', tipo_maiz: 'Suave Harinoso', ubicacion: 'Pichincha', altitud: 2700, ph: 6.2 }] }));
      await page.route('**/backend-api/public/index.php/api/cultivos/valores-ubicacion*', route => route.fulfill({ json: { success: true, temperatura: 16, humedad: 70, ph_suelo: 6.2, tipo_suelo: 'franco', area_simulada: 1 } }));
      const requests = [];
      await page.route('**/backend-api/public/index.php/api/simulaciones/evaluar-variedades', route => {
        const payload = route.request().postDataJSON();
        requests.push(payload);
        return route.fulfill({ json: { success: true, evaluacion: evaluations[payload.objetivo] } });
      });
      await page.goto('/');
      const navigation = page.getByRole('button', { name: 'Simular cosecha', exact: true });
      if (!await navigation.isVisible()) await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
      await navigation.click();
      await page.locator('#simular-parcela').selectOption('1');
      await page.locator('.simulation-optional > summary').click();
      await page.getByLabel('Fecha de siembra del escenario').fill('2024-02-28');
      await page.getByLabel('Duración prevista del cultivo (días)').fill('120');
      await page.getByLabel('Agua de riego de todo el ciclo (mm)').fill('0');
      await expect(page.getByText('2024-06-26', { exact: true })).toBeVisible();
      expect(await page.locator('form.simulation-form').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
      await page.locator('.simulation-optional > summary').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`campos-${theme}-${width}.png`) });
      const panel = page.locator('.variedades-panel').filter({ hasText: '¿Tu variedad corresponde a esta zona?' });
      await panel.locator(':scope > summary').click();
      await panel.getByRole('button', { name: 'Revisar adaptación' }).click();
      await expect(panel.getByRole('heading', { name: 'INIAP 101 Blanco Harinoso Precoz', exact: true })).toBeVisible();
      await expect(panel).toContainText('205 días');
      await expect(panel).toContainText('14 materiales');
      await expect(panel).toContainText('No es un ranking nacional de popularidad de 2026');
      await expect(panel).toContainText('Choclo blanco');
      expect(requests[0].cultivo_id).toBe(1);
      await panel.getByLabel('¿Qué quieres cosechar?').selectOption('choclo');
      await expect(panel).toContainText('Los datos cambiaron');
      await expect(panel.getByRole('heading', { name: 'INIAP 101 Blanco Harinoso Precoz', exact: true })).toHaveCount(0);
      await panel.getByRole('button', { name: 'Revisar adaptación' }).click();
      await expect(panel).toContainText('120 días');
      await expect(panel).toContainText('no estima toneladas de choclo ni de forraje');
      const card = panel.getByRole('article', { name: 'INIAP 101 Blanco Harinoso Precoz', exact: true });
      await card.getByText('Fuentes y requisitos publicados', { exact: true }).click();
      await expect(card.getByRole('link').first()).toHaveAttribute('href', /iniap.*#page=15/);
      const bounds = await panel.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
      await panel.evaluate(element => element.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: testInfo.outputPath(`variedades-${theme}-${width}.png`) });
      expect(errors).toEqual([]);
    });
  }
}

test('canguil ofrece su ficha y evita una simulación específica sin soporte', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => { localStorage.setItem('onboarding_completed', 'true'); });
  await page.route('**/backend-api/public/index.php/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/backend-api/public/index.php/api/auth/me', route => route.fulfill({ json: { authenticated: true, user: { id: 987, nombre: 'Prueba', rol: 'productor' } } }));
  await page.route('**/backend-api/public/index.php/api/cultivos', route => route.fulfill({ json: [{ id: 2, nombre_parcela: 'Canguil ficticio', area: 1, variedad_maiz: 'INIAP 198 Canguil', tipo_maiz: 'Duro Amarillo / Blanco', ubicacion: 'Pichincha', altitud: 2700, ph: 6.2 }] }));
  await page.route('**/backend-api/public/index.php/api/cultivos/valores-ubicacion*', route => route.fulfill({ json: { success: true, area_simulada: 1 } }));
  await page.route('**/backend-api/public/index.php/api/simulaciones/evaluar-variedades', route => route.fulfill({ json: { success: true, evaluacion: evaluations.perfil_canguil } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Simular cosecha', exact: true }).click();
  await page.locator('#simular-parcela').selectOption('2');
  await expect(page.getByRole('button', { name: 'Ejecutar Simulación', exact: true })).toBeDisabled();
  const panel = page.locator('.variedades-panel').filter({ hasText: '¿Tu variedad corresponde a esta zona?' });
  await panel.locator(':scope > summary').click();
  await panel.getByLabel('¿Qué quieres cosechar?').selectOption('canguil');
  await panel.getByRole('button', { name: 'Revisar adaptación' }).click();
  await expect(panel).toContainText('235 días');
  await expect(panel).toContainText('Canguil para reventar');
  await expect(panel).toContainText('La simulación específica está deshabilitada');
});
