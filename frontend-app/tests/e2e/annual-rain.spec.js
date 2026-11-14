import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {plot,sowing,yieldData} from '../fixtures/explanationData.mjs';
const reference={valor:537.4,unidad:'mm/año',fuente:'INAMHI',periodo:'2000–2019',años_completos:18,estacion:'PORTOVIEJO-UTM',distancia_km:2,url:'https://www.datosabiertos.gob.ec/'};
async function prepare(page,{width=1440,theme='light'}={}){
  await page.setViewportSize({width,height:950});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({theme})=>{localStorage.setItem('onboarding_done_987','true');localStorage.setItem('theme',theme);},{theme});
  await page.route('**/api/**',r=>r.fulfill({json:{}}));
  await page.route('**/api/auth/yo',r=>r.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas',r=>r.fulfill({json:[plot]}));
  const data={...yieldData,lluvia_anual_referencia:reference,simulaciones_rendimiento:yieldData.simulaciones_rendimiento.map((run,i)=>({...run,lluvia_anual_referencia:i===0?{...reference,valor:600}:null,entradas:{...run.entradas,precipitacion_mm_año:null,precipitacion_mm_ciclo:500}}))};
  await page.route('**/api/rendimiento?*',r=>r.fulfill({json:data}));
  await page.route('**/api/escenarios?*',r=>r.fulfill({json:{...sowing,cultivo_activo:{...plot,tipo_fecha_siembra:'prevista',ciclo_dias:120,riego_tipo:'goteo'}}}));
  await page.route('**/api/parcelas/valores-ubicacion?*',r=>r.fulfill({json:{exito:true,lluvia_anual_referencia:reference,precipitacion:537.4,temperatura:25,humedad:75,ph_suelo:6.2,tipo_suelo:'franco'}}));
  await page.goto('/');await expect(page.locator('.ydp-metrics')).toBeVisible();
}
async function navigate(page,name){const button=page.getByRole('button',{name,exact:true});if(!await button.isVisible())await page.getByRole('button',{name:'Expandir barra lateral'}).click();await button.click();}
test('la comparación publica la referencia anual sin modificar las entradas de la ejecución',async({page})=>{
  await prepare(page);
  const table=page.getByRole('region',{name:'Comparación de simulaciones, tabla desplazable'});
  const rain=table.getByRole('row').filter({hasText:'Lluvia anual de referencia (mm/año)'});
  await expect(rain).toContainText('600');await expect(rain).toContainText('537');
  await expect(rain).toContainText('Referencia conservada con esta ejecución');await expect(rain).toContainText('Referencia actual de la parcela');
  await expect(table.getByRole('row').filter({hasText:'Lluvia del ciclo (mm/ciclo)'})).toContainText('500');
  await expect(table.getByText('Lluvia anual ingresada al cálculo (mm/año)',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('complementary',{name:'Referencia histórica de lluvia anual'})).toContainText('2000–2019');
});
test('el formulario precarga la referencia anual y mantiene independiente la lluvia del ciclo',async({page})=>{
  await prepare(page);await navigate(page,'Simular cosecha');
  await page.locator('#simular-parcela').selectOption(String(plot.id));
  await expect(page.getByRole('complementary',{name:'Referencia histórica de lluvia anual'})).toContainText('537');
  await expect(page.locator('#lluvia-ciclo')).toHaveValue('');
  await page.locator('#lluvia-ciclo').fill('500');await expect(page.locator('#lluvia-ciclo')).toHaveValue('500');
});
for(const width of [390,944,1440])for(const theme of ['light','dark'])test(`Siembra sin desbordamiento y con jerarquía visible a ${width}px ${theme}`,async({page})=>{
  await prepare(page,{width,theme});await navigate(page,'Siembra');
  await expect(page.getByRole('heading',{name:'Tu plan de siembra',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Consultar simulaciones guardadas/})).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('.sowing-help')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  mkdirSync('../documentacion/fuentes-maiz/descargas/siembra-final',{recursive:true});
  await page.screenshot({path:`../documentacion/fuentes-maiz/descargas/siembra-final/${width}-${theme}.png`,fullPage:true});
});
