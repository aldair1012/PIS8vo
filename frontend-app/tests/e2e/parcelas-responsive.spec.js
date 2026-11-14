import { test, expect } from '@playwright/test';

for(const width of [390,820,1440])test(`formulario de parcela legible y alcanzable a ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route('**/backend-api/public/index.php/api/**',r=>r.fulfill({json:{}}));
  await page.route('**/api/auth/yo',r=>r.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas',r=>r.fulfill({json:[]}));
  await page.goto('/');await page.locator('.navbar').waitFor();
  if(await page.locator('#workspace-sidebar').evaluate(n=>n.inert))await page.getByRole('button',{name:'Expandir barra lateral'}).click();
  await page.getByRole('button',{name:'Mis parcelas',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Registrar Nueva Parcela'})).toBeVisible();
  const fields=await page.locator('.cultivos-form-fields').boundingBox();expect(fields.width).toBeGreaterThan(280);
  const save=page.getByRole('button',{name:'Registrar Parcela',exact:true});await save.scrollIntoViewIfNeeded();await expect(save).toBeInViewport();
  await expect(page.getByLabel('Tipo de Maíz *',{exact:true})).toBeEnabled();
  expect(await page.locator('.cultivos-create-form').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
});
