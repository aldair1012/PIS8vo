import {test,expect} from '@playwright/test';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {agriculturalGuide} from '../fixtures/agriculturalGuide.mjs';
import {plot,sowing,yieldData} from '../fixtures/explanationData.mjs';
import {waitForWorkspace} from './workspace-ready.js';
const axe=path.resolve('../documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js');
const output='../documentacion/fuentes-maiz/descargas/calendario-agricola-20261115';
const facts=JSON.parse(readFileSync(new URL('../../../backend-api/data/referencias/calendario-agricola-ecuador.json',import.meta.url),'utf8'));
async function prepare(page,{width=1440,height=1000,theme='light',guide=agriculturalGuide,soilFails=false,slowSoil=false}={}){
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(theme=>{localStorage.setItem('theme',theme);localStorage.setItem('onboarding_done_987','true');},theme);
  const plots=Array.from({length:25},(_,i)=>({...plot,id:i+1,nombre_parcela:i===0?'Parcela de prueba':i===24?'Última parcela con un nombre muy largo para comprobar que no se recorta':`Parcela ${i+1}`,ubicacion:i===24?'Una localidad con un nombre bastante largo · Manabí · Ecuador':'Ayacucho · Santa Ana · Manabí · Ecuador',fecha_siembra:'2027-01-01',tipo_fecha_siembra:'prevista',ciclo_dias:120,riego_tipo:'goteo'}));
  await page.route('**/api/**',r=>r.fulfill({json:{}}));
  await page.route('**/api/auth/yo',r=>r.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas',r=>r.fulfill({json:plots}));
  await page.route('**/api/rendimiento?*',r=>r.fulfill({json:yieldData}));
  await page.route('**/api/escenarios?*',r=>{const id=Number(new URL(r.request().url()).searchParams.get('parcela_id')||1);return r.fulfill({json:{...sowing,guia_agricola:guide,cultivo_activo:plots[id-1]}});});
  await page.route('**/api/parcelas/valores-ubicacion?*',async r=>{
    if(slowSoil)await new Promise(resolve=>setTimeout(resolve,650));
    if(soilFails)return r.fulfill({status:503,json:{error:'No disponible'}});
    return r.fulfill({json:{exito:true,ph_suelo:6.2,referencia_suelo:{fuente:'ISRIC SoilGrids 250 m',profundidad:'0–5 cm',clase_estimada:'Franco limoso'}}});
  });
  await page.goto('/');await waitForWorkspace(page);const nav=page.getByRole('button',{name:'Siembra',exact:true});if(!await nav.isVisible())await page.getByRole('button',{name:'Expandir barra lateral'}).click();await nav.click();
  await expect(page.getByRole('heading',{name:'Calendario agrícola de tu zona',exact:true})).toBeVisible();
}

test('guía conectada: meses, suelo y antecedentes conservan su fuente y no modifican el plan',async({page})=>{
  await prepare(page);await expect(page.locator('.ag-calendar-month.has-reference')).toHaveCount(2);
  await page.locator('.ag-calendar-month').filter({hasText:'Febrero'}).click();await expect(page.locator('#ag-calendar-month-detail')).toContainText('encuesta de invierno de 2022');
  await expect(page.locator('.ag-calendar-soil')).toContainText('Franco limoso');await expect(page.locator('.ag-calendar-soil')).toContainText('0–5 cm');
  await expect(page.locator('.ag-calendar-health')).toContainText('Invierno 2022');await expect(page.locator('.ag-calendar-health')).toContainText('síntoma reportado');await expect(page.locator('.ag-calendar-health-note')).toContainText('no confirman');
  await page.locator('.ag-calendar-month').filter({hasText:'Agosto'}).click();await expect(page.locator('#ag-calendar-month-detail')).toContainText('Esto no significa que no puedas sembrar');await expect(page.locator('.sowing-dates')).toContainText('1 de enero de 2027');
  await page.getByRole('button',{name:'Elegir una fecha en mi plan',exact:true}).click();await expect(page.getByLabel('Fecha de siembra',{exact:true})).toHaveValue('2027-01-01');
});

test('la guía sigue siendo útil cuando el servicio del terreno está caído',async({page})=>{
  await prepare(page,{soilFails:true});await expect(page.locator('.ag-calendar-soil')).toContainText('Sin estimación disponible');await expect(page.locator('.ag-calendar-season')).toContainText('Enero y febrero');await expect(page.getByRole('button',{name:'Volver a consultar el terreno'})).toBeVisible();
});

test('una respuesta tardía del terreno no bloquea la selección mensual',async({page})=>{
  await prepare(page,{slowSoil:true});await page.locator('.ag-calendar-month').filter({hasText:'Marzo'}).click();await expect(page.locator('#ag-calendar-month-detail')).toContainText('Marzo');await expect(page.locator('.ag-calendar-soil')).toContainText('Franco limoso');
});

test('sin cobertura no se pintan meses favorables ni enfermedades de otra provincia',async({page})=>{
  await prepare(page,{guide:{...agriculturalGuide,ventana:null,sanidad:null,avisos:['No hay una ventana verificada para esta combinación.']}});await expect(page.locator('.ag-calendar-month.has-reference')).toHaveCount(0);await expect(page.locator('.ag-calendar-health')).toContainText('No tenemos un informe provincial verificado');
});

test('maíz de altura conserva meses parciales y no extiende el riego al grano seco',async({page})=>{
  await prepare(page,{guide:{...agriculturalGuide,familia:'sierra',provincia:'Azuay',variedad:'INIAP 101',ventana:facts.ventanas['sierra:Azuay'],suelo:facts.suelo.sierra,riego:{nota:'Otras épocas con riego sólo para cosecha en choclo; no se extiende al grano seco.'}}});await expect(page.locator('.ag-calendar-month.has-reference')).toHaveCount(4);await expect(page.locator('.ag-calendar-season')).toContainText('Finales de septiembre');await expect(page.locator('.ag-calendar-water')).toContainText('choclo');
});

for(const width of [375,768,1440])for(const theme of ['light','dark'])test(`calendario y selector con 25 parcelas: ${width}px ${theme}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await prepare(page,{width,theme});
  expect(await page.locator('.ag-calendar-month').evaluateAll(rows=>rows.every(row=>row.getBoundingClientRect().height>=108))).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);mkdirSync(output,{recursive:true});await page.locator('.ag-calendar-months').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/calendar-${width}-${theme}.png`});await page.locator('.ag-calendar-context').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/context-${width}-${theme}.png`});
  await page.getByRole('button',{name:/Seleccionar parcela\. Actual:/}).click();const panel=page.getByRole('dialog',{name:'Seleccionar parcela',exact:true});await expect(panel).toBeVisible();await expect(panel.locator('.lote-selector-card')).toHaveCount(25);
  const measures=await panel.locator('.lote-selector-card').evaluateAll(rows=>rows.map(row=>{const b=row.getBoundingClientRect();return {height:b.height,overflow:row.scrollHeight>b.height+2,textInside:[...row.querySelectorAll('.plot-option-copy > *')].every(e=>{const r=e.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom&&r.right<=b.right;})};}));
  expect(measures.every(row=>row.height>=96&&!row.overflow&&row.textInside)).toBe(true);
  const box=await panel.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(box.y+box.height).toBeLessThanOrEqual(1000);
  await panel.locator('.lote-selector-card').last().scrollIntoViewIfNeeded();await expect(panel.getByRole('button',{name:'Añadir Nueva Parcela',exact:true})).toBeVisible();await page.screenshot({path:`${output}/selector-${width}-${theme}.png`});
  await panel.getByRole('textbox',{name:'Buscar parcela',exact:true}).fill('Última parcela');await expect(panel.locator('.lote-selector-card')).toHaveCount(1);await panel.locator('.lote-selector-card').click();await expect(panel).toHaveCount(0);await expect(page.getByRole('button',{name:/Seleccionar parcela\. Actual: Última parcela/})).toBeFocused();expect(errors).toEqual([]);
});

test('el selector conserva filas y acciones con texto al doble en horizontal',async({page})=>{
  await prepare(page,{width:812,height:375});await page.addStyleTag({content:'html:has(.zeasys-workspace){font-size:32px;}'});await page.getByRole('button',{name:/Seleccionar parcela\. Actual:/}).click();const panel=page.getByRole('dialog',{name:'Seleccionar parcela',exact:true});await panel.locator('.lote-selector-card').last().scrollIntoViewIfNeeded();await expect(panel.getByRole('button',{name:'Añadir Nueva Parcela'})).toBeVisible();const b=await panel.boundingBox();expect(b.y+b.height).toBeLessThanOrEqual(375);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);
});

for(const theme of ['light','dark'])test(`accesibilidad del calendario y selector: ${theme}`,async({page})=>{
  test.skip(!existsSync(axe),'Sin axe-core local');await prepare(page,{theme});await expect(page.locator('.ag-calendar-soil')).toContainText('Franco limoso');await page.addScriptTag({path:axe});
  const audit=async selector=>{const violations=await page.evaluate(async selector=>(await window.axe.run(selector,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),selector);expect(violations).toEqual([]);};
  await audit('.ag-calendar');await page.getByRole('button',{name:/Seleccionar parcela\. Actual:/}).click();await audit('#selector-parcelas');
});
