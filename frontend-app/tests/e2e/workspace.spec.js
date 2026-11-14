import { test, expect } from '@playwright/test';

const fixtureOrigin = process.env.ZEASYS_E2E_ORIGIN || '';
test.skip(!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixtureOrigin), 'Requiere el entorno de integración desechable de ZeaSys.');
test.setTimeout(120000);

for (const [width, theme] of [[390, 'dark'], [390, 'light'], [768, 'dark'], [768, 'light'], [1440, 'dark'], [1440, 'light']]) {
  test(`navegación del espacio de trabajo ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const result = await page.request.post('/backend-api/public/index.php/api/auth/iniciar-sesion', {
      data: { correo: 'a@example.test', contrasena: ' ClavePrueba-2026! ' },
    });
    expect(result.ok()).toBeTruthy();
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.navbar')).toBeVisible();
    for (const name of ['Mis parcelas', 'Simular cosecha', 'Rendimiento', 'Siembra', 'Clima y cultivo', 'Finanzas', 'Mapa de parcelas', 'Simulaciones guardadas']) {
      if (await page.locator('#workspace-sidebar').evaluate(node => node.inert)) {
        await page.getByRole('button', { name: 'Expandir barra lateral' }).click();
      }
      const item = page.getByRole('button', { name, exact: true });
      await item.click();
      await expect(page.locator('#workspace-sidebar .sidebar-item-btn').filter({ has: page.locator('span', { hasText: name }) })).toHaveAttribute('aria-current', 'page');
      // El servidor PHP aislado atiende de una en una las consultas y recursos.
      await expect(page.getByText('Cargando vista…', { exact: true })).toHaveCount(0, { timeout: 30000 });
      await expect(page.locator('.content-body').getByText(/^Cargando/)).toHaveCount(0, { timeout: 30000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (process.env.ZEASYS_AUDIT_SCREENSHOTS) await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(' ', '-')}.png`), animations: 'disabled' });
    }
    await page.getByRole('button', { name: /Configuración de cuenta de/ }).click();
    await expect(page.getByRole('heading', { name: 'Descargar información', exact: true })).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.ZEASYS_AUDIT_SCREENSHOTS) await page.screenshot({ path: testInfo.outputPath('Configuracion.png'), animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}


test('Siembra guarda el plan con la API real y lo conserva al recargar',async({page})=>{
  const login=await page.request.post('/backend-api/public/index.php/api/auth/iniciar-sesion',{data:{correo:'a@example.test',contrasena:' ClavePrueba-2026! '}});expect(login.ok()).toBeTruthy();
  const me=await (await page.request.get('/backend-api/public/index.php/api/auth/yo')).json();await page.addInitScript(id=>localStorage.setItem(`onboarding_done_${id}`,'true'),me.usuario.id);
  await page.setViewportSize({width:1440,height:950});await page.goto('/');await page.getByRole('button',{name:'Siembra',exact:true}).click();await expect(page.getByRole('heading',{name:'Tu plan de siembra',exact:true})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:/^(Editar|Completar) mi plan$/}).click();await page.getByLabel('¿Ya sembraste en esa fecha?').selectOption('prevista');await page.getByLabel('Duración del cultivo en días').fill('150');await page.getByLabel('Agua o riego del cultivo').selectOption('goteo');await page.getByRole('button',{name:'Guardar mi plan',exact:true}).click();
  await expect(page.getByText('Tu plan quedó guardado.',{exact:true})).toBeVisible({timeout:30000});await expect(page.locator('.sowing-campaign-summary')).toContainText('150 días');
  await page.reload();await page.getByRole('button',{name:'Siembra',exact:true}).click();await expect(page.locator('.sowing-campaign-summary')).toContainText('150 días',{timeout:30000});await expect(page.locator('.sowing-campaign-summary')).toContainText('Riego por goteo');
});
