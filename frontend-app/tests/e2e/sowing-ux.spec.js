import {test,expect} from '@playwright/test';
import {existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {plot,sowing,yieldData} from '../fixtures/explanationData.mjs';
const output='../documentacion/fuentes-maiz/descargas/siembra-ux-pro-max';
const axe=path.resolve('../documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js');
async function prepare(page,{width=1440,height=950,theme='light',empty=false,legacy=false,trace=false,saveFails=false,saveReloadFails=false,overlap=false}={}){
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({theme})=>{localStorage.setItem('theme',theme);localStorage.setItem('onboarding_done_987','true');},{theme});
  let current={...plot,fecha_siembra:empty?null:legacy?'2024-01-01':'2027-01-01',tipo_fecha_siembra:empty||legacy?null:'prevista',ciclo_dias:empty?null:120,riego_tipo:empty?null:'goteo'};
  const posted=[];let saved=false;
  await page.route('**/api/**',r=>r.fulfill({json:{}}));
  await page.route('**/api/auth/yo',r=>r.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas',r=>{
    if(r.request().method()==='GET')return r.fulfill({json:[current]});
    const data=r.request().postDataJSON();posted.push(data);if(saveFails)return r.fulfill({status:503,json:{error:'No pudimos guardar. Inténtalo de nuevo.'}});
    current={...current,...data};saved=true;return r.fulfill({json:{exito:true,cultivo:current}});
  });
  await page.route('**/api/rendimiento?*',r=>r.fulfill({json:yieldData}));
  await page.route('**/api/escenarios?*',r=>{
    if(saveReloadFails&&saved)return r.fulfill({status:503,json:{error:'No disponible'}});
    const year=new URL(r.request().url()).searchParams.get('año');const noResults=year==='2001';
    return r.fulfill({json:{...sowing,cultivo_activo:current,años_disponibles:[2001,2024,2026,2027],simulaciones_count:noResults?0:3,sin_datos:noResults,resumen_descriptivo:{muestra:noResults?0:3,coeficiente_variacion_pct:20},
      simulaciones:noResults?[]:[{id:101,nombre:'Prueba A',fecha:'2026-01-01',rendimiento:5,variedad:'Variedad A'},{id:102,nombre:'Prueba B',fecha:'2026-02-01',rendimiento:0},{id:103,nombre:'Prueba C',fecha:'2026-03-01',rendimiento:3}],
      viabilidad_siembra:[{rango:'1–28 FEB',estado:'Siembra: Manabí',fuente:'Catálogo local',tipo:'ventana_catalogo_no_pronostico'},{rango:overlap?'1–28 FEB':'1–31 AGO',estado:'Cosecha: Manabí',fuente:'Catálogo local',tipo:'ventana_catalogo_no_pronostico'}],
      calendario_parcela:trace?{fecha_siembra:'2024-02-01',ciclo_dias:120,tipo_fecha_siembra:'prevista'}:{},percentiles:{p10:0,p50:3,p90:5,muestra:noResults?0:3}}});
  });
  await page.route('**/api/simulaciones/explicar',r=>r.fulfill({status:503,json:{error:'Sin conexión'}}));
  await page.goto('/');const nav=page.getByRole('button',{name:'Siembra',exact:true});if(!await nav.isVisible())await page.getByRole('button',{name:'Expandir barra lateral'}).click();await nav.click();
  await expect(page.getByRole('heading',{name:'Tu plan de siembra',exact:true})).toBeVisible();return posted;
}
async function history(page){await page.getByRole('button',{name:/Consultar simulaciones guardadas/}).click();}

test('la primera lectura muestra sólo el plan, con palabras claras y una acción principal',async({page})=>{
  await prepare(page);await expect(page.getByRole('button',{name:'Editar mi plan',exact:true})).toBeVisible();
  await expect(page.locator('.sowing-dates')).toContainText('1 de enero de 2027');await expect(page.locator('.sowing-dates')).toContainText('30 de abril de 2027');
  await expect(page.getByRole('button',{name:/Consultar meses habituales/})).toHaveAttribute('aria-expanded','false');
  await expect(page.getByRole('button',{name:/Consultar simulaciones guardadas/})).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('.ydp-metrics')).toHaveCount(0);await expect(page.locator('.sowing-history-list')).toHaveCount(0);
  await page.getByRole('button',{name:/Seleccionar parcela/}).click();await expect(page.getByRole('button',{name:'2027',exact:true})).toHaveCount(0);
});
test('valida junto al campo, guarda una vez y devuelve el foco sin vaciar la página',async({page})=>{
  const posted=await prepare(page);await page.getByRole('button',{name:'Editar mi plan',exact:true}).click();const form=page.getByRole('form',{name:'Editar planificación de la parcela'});
  await form.getByLabel('¿Ya sembraste en esa fecha?').selectOption('real_declarada');await form.getByLabel('Duración del cultivo en días').fill('0');await form.getByRole('button',{name:'Guardar mi plan',exact:true}).click();
  await expect(form.getByRole('alert')).toBeFocused();await expect(form.getByLabel('Fecha de siembra',{exact:true})).toHaveAttribute('aria-invalid','true');expect(posted).toHaveLength(0);
  await form.getByLabel('¿Ya sembraste en esa fecha?').selectOption('prevista');await form.getByLabel('Fecha de siembra',{exact:true}).fill('2027-02-01');await form.getByLabel('Duración del cultivo en días').fill('120');
  await form.getByRole('button',{name:'Guardar mi plan',exact:true}).click();await expect(page.getByRole('button',{name:'Editar mi plan',exact:true})).toBeFocused();await expect(page.getByText('Tu plan quedó guardado.',{exact:true})).toBeVisible();
  await expect(page.locator('.sowing-dates')).toContainText('31 de mayo de 2027');expect(posted).toHaveLength(1);
});
test('si falla el guardado conserva los datos y explica cómo volver a intentarlo',async({page})=>{
  await prepare(page,{saveFails:true});await page.getByRole('button',{name:'Editar mi plan',exact:true}).click();const form=page.getByRole('form');await form.getByLabel('Duración del cultivo en días').fill('150');await form.getByRole('button',{name:'Guardar mi plan',exact:true}).click();
  await expect(form.getByRole('alert')).toBeFocused();await expect(form.getByLabel('Duración del cultivo en días')).toHaveValue('150');await form.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByRole('button',{name:'Editar mi plan',exact:true})).toBeFocused();
});
test('las referencias no cambian el plan y las simulaciones mantienen sus ceros y fechas',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:/Consultar meses habituales/}).click();await page.getByLabel('Tipo de referencia agrícola').selectOption('cosecha');await expect(page.locator('.sowing-reference-list')).toContainText('agosto');await expect(page.locator('.sowing-dates')).toContainText('enero de 2027');
  await history(page);await page.getByLabel('Ordenar simulaciones guardadas').selectOption('menor');await expect(page.locator('.sowing-result').first()).toContainText('0,00');
  await page.getByRole('button',{name:'Ver explicación de simulación #102',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('0 t/ha');await page.keyboard.press('Escape');
  await page.getByLabel('Año de las simulaciones').selectOption('2001');await expect(page.getByRole('heading',{name:'No hay simulaciones guardadas en 2001'})).toBeVisible();await expect(page.locator('.sowing-dates')).toContainText('enero de 2027');
});
test('una fecha sin clasificar se pide confirmar y una fecha simulada no se guarda sola',async({page})=>{
  await prepare(page,{legacy:true});await expect(page.locator('.sowing-dates')).toContainText('Confirma si ya sembraste');await expect(page.locator('.sowing-dates')).not.toContainText('Ya sembraste ·');
});
test('se pueden revisar y copiar explícitamente los datos de una simulación',async({page})=>{
  const posted=await prepare(page,{empty:true,trace:true});await expect(page.locator('.sowing-info')).toContainText('aún no está guardada');await page.getByRole('button',{name:'Completar mi plan',exact:true}).click();const form=page.getByRole('form');await expect(form.getByLabel('Fecha de siembra',{exact:true})).toHaveValue('');expect(posted).toHaveLength(0);
  await form.getByRole('button',{name:'Usar los datos de esa simulación'}).click();await expect(form.getByLabel('Fecha de siembra',{exact:true})).toHaveValue('2024-02-01');await expect(form.getByLabel('¿Ya sembraste en esa fecha?')).toHaveValue('prevista');
});
for(const width of [375,768,1440])for(const theme of ['light','dark'])test(`lectura y controles a ${width}px ${theme}`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,{width,theme});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const box=await page.getByRole('button',{name:'Editar mi plan',exact:true}).boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
  mkdirSync(output,{recursive:true});await page.screenshot({path:`${output}/${width}-${theme}-plan.png`,fullPage:true});
  await page.getByRole('button',{name:'Editar mi plan',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${output}/${width}-${theme}-form.png`,fullPage:true});expect(errors).toEqual([]);
});
test('en horizontal y con texto al doble todos los datos y acciones siguen disponibles',async({page})=>{
  await prepare(page,{width:812,height:375});await page.addStyleTag({content:'html:has(.zeasys-workspace){font-size:32px;}'});await page.getByRole('button',{name:'Editar mi plan',exact:true}).click();await expect(page.getByRole('button',{name:'Guardar mi plan',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const theme of ['light','dark'])test(`auditoría de accesibilidad del plan, formulario y contenido opcional: ${theme}`,async({page})=>{
  test.skip(!existsSync(axe),'axe-core no está instalado en el entorno de auditoría');
  await prepare(page,{theme});await page.addScriptTag({path:axe});
  const check=async()=>{const violations=await page.evaluate(async()=> (await window.axe.run('.sowing-dashboard',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})));expect(violations).toEqual([]);};
  await check();await page.getByRole('button',{name:'Editar mi plan',exact:true}).click();await check();await page.getByRole('button',{name:'Cancelar',exact:true}).click();await history(page);await page.locator('.sowing-advanced > summary').click();await check();
});

test('un fallo al actualizar después de guardar no oculta el plan confirmado',async({page})=>{
  await prepare(page,{saveReloadFails:true});await page.getByRole('button',{name:'Editar mi plan',exact:true}).click();await page.getByLabel('Duración del cultivo en días').fill('150');await page.getByRole('button',{name:'Guardar mi plan',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tu plan de siembra',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('Tu plan está guardado');await expect(page.locator('.sowing-campaign-summary')).toContainText('150 días');await expect(page.getByRole('button',{name:'Volver a cargar los datos',exact:true})).toBeVisible();
});
test('al cambiar de tema la ubicación y tamaño de los elementos permanecen estables',async({page})=>{
  await prepare(page);const elements=['.sowing-page-header','#sowing-main-plan','.sowing-dates','.sowing-campaign-summary'];const before=[];for(const selector of elements)before.push(await page.locator(selector).boundingBox());
  await page.getByRole('button',{name:'Activar modo oscuro',exact:true}).click();
  for(let i=0;i<elements.length;i++){const after=await page.locator(elements[i]).boundingBox();for(const dimension of ['x','y','width','height'])expect(Math.abs(after[dimension]-before[i][dimension])).toBeLessThan(1);}
});
for(const theme of ['light','dark'])test(`el calendario y sus detalles usan el tema y mantienen controles accesibles: ${theme}`,async({page})=>{
  await prepare(page,{width:375,theme});await page.getByRole('button',{name:'Ver mis fechas en calendario',exact:true}).click();
  const previous=await page.getByRole('button',{name:'Mes anterior',exact:true}).boundingBox();expect(previous.height).toBeGreaterThanOrEqual(44);expect(previous.width).toBeGreaterThanOrEqual(44);
  await page.getByRole('button',{name:'1 de enero de 2027: Siembra prevista',exact:true}).click();const detail=page.getByRole('status',{name:'Detalle del calendario de la parcela'});await expect(detail).toBeVisible();expect(await detail.evaluate(node=>getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'1 de enero de 2027: Siembra prevista',exact:true})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('un día con siembra y cosecha de referencia permite leer ambos eventos',async({page})=>{
  await prepare(page,{overlap:true});await page.getByRole('button',{name:/Consultar meses habituales/}).click();await page.locator('.sowing-reference-calendar > summary').click();
  await page.getByRole('button',{name:/^1 de febrero de .*: Siembra: Manabí; Cosecha: Manabí$/}).click();const detail=page.getByRole('status',{name:'Detalle de la referencia de siembra'});await expect(detail).toContainText('Siembra: Manabí');await expect(detail).toContainText('Cosecha: Manabí');
});
