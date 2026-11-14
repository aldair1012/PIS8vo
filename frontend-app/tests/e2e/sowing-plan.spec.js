import { test, expect } from '@playwright/test';
import { plot, sowing, yieldData } from '../fixtures/explanationData.mjs';

async function prepare(page,{empty=false,width=1440}={}) {
  await page.setViewportSize({width,height:950});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{localStorage.setItem('onboarding_done_987','true');localStorage.setItem('theme','light');});
  let current={...plot,fecha_siembra:empty?null:'2027-03-01',tipo_fecha_siembra:empty?null:'prevista',ciclo_dias:empty?null:120,riego_tipo:empty?null:'goteo'};
  const posted=[];
  const payload=()=>({...sowing,cultivo_activo:current,viabilidad_siembra:[{rango:'1–28 FEB',estado:'Siembra: Manabí',fuente:'Catálogo local',tipo:'ventana_catalogo_no_pronostico'}],
    simulaciones:[{id:101,nombre:'Ejecución A',fecha:'2026-01-01',variedad:'Variedad A',rendimiento:5},{id:102,nombre:'Ejecución B',fecha:'2026-02-01',rendimiento:0},{id:103,nombre:'Ejecución C',fecha:'2026-03-01',rendimiento:3}],
    calendario_parcela:{fecha_siembra:current.fecha_siembra,tipo_fecha_siembra:current.tipo_fecha_siembra,ciclo_dias:current.ciclo_dias,riego_tipo:current.riego_tipo,eventos:current.fecha_siembra?[{fecha:current.fecha_siembra,tipo:'siembra_registrada',titulo:'Siembra prevista por el productor',fuente:'Fecha guardada por el productor'}]:[]}});
  await page.route('**/api/**',r=>r.fulfill({json:{}}));
  await page.route('**/api/auth/yo',r=>r.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas',r=>{
    if(r.request().method()==='GET')return r.fulfill({json:[current]});
    const body=r.request().postDataJSON();posted.push(body);current={...current,...body};return r.fulfill({json:{exito:true,cultivo:current}});
  });
  await page.route('**/api/rendimiento?*',r=>r.fulfill({json:yieldData}));
  await page.route('**/api/escenarios?*',r=>r.fulfill({json:payload()}));
  await page.goto('/');
  if(!await page.getByRole('button',{name:'Siembra',exact:true}).isVisible())await page.getByRole('button',{name:'Expandir barra lateral'}).click();
  await page.getByRole('button',{name:'Siembra',exact:true}).click();await expect(page.getByRole('heading',{name:'Tu plan de siembra',exact:true})).toBeVisible();
  return posted;
}

test('Mi cultivo es la vista inicial y el resumen separa campaña y año de cálculo',async({page})=>{
  await prepare(page);await expect(page.getByRole('button',{name:/Consultar simulaciones guardadas/})).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('.sowing-dates')).toContainText('Fecha prevista');
  await expect(page.locator('.sowing-campaign-summary')).toContainText('Riego por goteo');
  await page.getByRole('button',{name:'Ver mis fechas en calendario',exact:true}).click();await expect(page.getByRole('heading',{name:'Marzo 2027',exact:true})).toBeVisible();
  await expect(page.locator('.sowing-advanced')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Resultados guardados de mayor rendimiento'})).toHaveCount(0);
});
test('se puede editar y guardar una planificación existente con su clasificación',async({page})=>{
  const posted=await prepare(page);await page.getByRole('button',{name:'Editar mi plan',exact:true}).click();
  const form=page.getByRole('form',{name:'Editar planificación de la parcela'});
  await form.getByLabel('Fecha de siembra',{exact:true}).fill('2027-04-10');
  await form.getByLabel('¿Ya sembraste en esa fecha?').selectOption('prevista');
  await form.getByLabel('Duración del cultivo en días').fill('150');
  await form.getByLabel('Agua o riego del cultivo').selectOption('aspersion');
  await form.getByRole('button',{name:'Guardar mi plan',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Tu plan quedó guardado.'})).toBeVisible();
  expect(posted[0]).toMatchObject({fecha_siembra:'2027-04-10',tipo_fecha_siembra:'prevista',ciclo_dias:150,riego_tipo:'aspersion'});
  await expect(page.locator('.sowing-campaign-summary')).toContainText('Riego por aspersión');
  await page.getByRole('button',{name:'Editar mi plan',exact:true}).click();
  await expect(form.getByLabel('Fecha de siembra',{exact:true})).toHaveValue('2027-04-10');
});
test('la tabla unificada ordena fechas y rendimientos sin perder ceros',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:/Consultar simulaciones guardadas/}).click();const rows=page.locator('.sowing-history-list li');
  await expect(rows.first()).toContainText('Ejecución C');
  await page.getByLabel('Ordenar simulaciones guardadas').selectOption('mayor');await expect(rows.first()).toContainText('Ejecución A');
  await page.getByLabel('Ordenar simulaciones guardadas').selectOption('menor');await expect(rows.first()).toContainText('0,00 t/ha');
  await expect(page.locator('.sowing-history-list')).toHaveCount(1);
});
test('sin fechas se puede planificar, sin inferir que la siembra ocurrió',async({page})=>{
  await prepare(page,{empty:true});await expect(page.locator('.sowing-dates')).toContainText('Por completar');
  await page.getByRole('button',{name:'Completar mi plan',exact:true}).first().click();
  await expect(page.getByLabel('¿Ya sembraste en esa fecha?')).toHaveValue('');
});
for(const width of [390,944,1440])test(`la planificación y el análisis avanzado se adaptan a ${width}px`,async({page})=>{
  await prepare(page,{width});await page.getByRole('button',{name:/Consultar simulaciones guardadas/}).click();await page.locator('.sowing-advanced > summary').click();
  await expect(page.getByRole('region',{name:'Indicadores avanzados de siembra'})).toBeVisible();
  await page.getByRole('button',{name:/Consultar meses habituales/}).click();
  await expect(page.locator('.sowing-source-caption')).toContainText('sin referencia');
  await expect(page.locator('.sowing-dashboard')).not.toContainText('Riesgo agronómico: No evaluado');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
