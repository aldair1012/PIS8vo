import {test,expect} from '@playwright/test';
import {mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {plot,yieldData} from '../fixtures/explanationData.mjs';
import {waitForWorkspace} from './workspace-ready.js';
const output='../documentacion/fuentes-maiz/descargas/chatbot-20261115';
const axe=path.resolve('../documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js');
const answer={texto:'## Qué significa el pH\nEl **pH** indica qué tan ácido o alcalino es el suelo. Ayuda a entender si las raíces pueden aprovechar los nutrientes.\n\n1. Revisa el valor que tienes registrado.\n2. Confírmalo con un análisis de suelo antes de decidir una corrección.\n\nLa dosis depende del análisis; no se puede determinar sólo por el nombre del terreno.',fuente_datos:{conversacion_id:'ux-chat-prueba',busqueda_realizada:true,fuentes_web:[{url:'https://www.iniap.gob.ec/',titulo:'INIAP · Información del cultivo'}],sugerencias_busqueda_html:'<!DOCTYPE html><html lang="es"><head><title>Google</title></head><body><a href="https://www.google.com/search?q=maiz" target="_blank">Consultar en Google</a></body></html>'}};
async function prepare(page,{theme='light',width=1440,height=1000,respond=answer}={}){
 await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(theme=>{if(window.top!==window)return;localStorage.setItem('theme',theme);localStorage.setItem('onboarding_done_987','true');},theme);
 await page.route('**/api/**',r=>r.fulfill({json:{}}));await page.route('**/api/auth/yo',r=>r.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
 await page.route('**/api/parcelas',r=>r.fulfill({json:[plot]}));await page.route('**/api/rendimiento?*',r=>r.fulfill({json:yieldData}));await page.route('**/api/chat/preguntar',r=>r.fulfill({json:respond}));
 await page.goto('/');await waitForWorkspace(page);await page.getByRole('button',{name:'Abrir asistente ZeaSys'}).click();await expect(page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'})).toBeFocused();
}
async function ask(page){await page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'}).fill('¿Qué significa pH y qué puedo revisar?');await page.getByRole('button',{name:'Enviar pregunta',exact:true}).click();await expect(page.locator('.from-assistant .zeasys-chat-answer')).toBeVisible();}

for(const width of [375,768,1440])for(const theme of ['light','dark'])test(`lectura y fuentes del chat: ${width}px ${theme}`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,{width,theme});const panel=page.getByRole('dialog',{name:'Asistente de ZeaSys',exact:true});const before=await panel.boundingBox();expect(before.x).toBeGreaterThanOrEqual(0);expect(before.x+before.width).toBeLessThanOrEqual(width);expect(before.y+before.height).toBeLessThanOrEqual(1000);
 mkdirSync(output,{recursive:true});await page.screenshot({path:`${output}/welcome-${width}-${theme}.png`});await ask(page);await expect(panel.locator('ol li')).toHaveCount(2);await expect(panel.getByText('Información web consultada',{exact:true})).toBeVisible();
 await panel.locator('.zeasys-chat-sources summary').click();await expect(panel.getByRole('link',{name:/INIAP · Información/})).toHaveAttribute('href','https://www.iniap.gob.ec/');const iframe=panel.getByTitle('Sugerencias de búsqueda de Google');await expect(iframe).toHaveAttribute('sandbox','allow-popups allow-popups-to-escape-sandbox');
 const geometry=await panel.evaluate(node=>({overflow:node.scrollWidth>node.clientWidth,logHeight:node.querySelector('.zeasys-chat-messages').clientHeight,textSize:getComputedStyle(node.querySelector('.zeasys-chat-bubble')).fontSize}));expect(geometry.overflow).toBe(false);expect(geometry.logHeight).toBeGreaterThan(120);expect(parseFloat(geometry.textSize)).toBeGreaterThanOrEqual(16);expect(errors).toEqual([]);await page.screenshot({path:`${output}/answer-${width}-${theme}.png`});
});

test('explica sin documentos ni búsqueda disponible y no atribuye una consulta que no ocurrió',async({page})=>{
 await prepare(page,{respond:{texto:'Puedo explicarte el concepto y qué revisar. El pH no permite calcular por sí solo una dosis.',fuente_datos:{busqueda_no_disponible:true,busqueda_realizada:false,fuentes_web:[]}}});await ask(page);await expect(page.getByText('Orientación sin comprobación web',{exact:true})).toBeVisible();await expect(page.getByText('Información web consultada',{exact:true})).toHaveCount(0);await expect(page.locator('.zeasys-chat-sources')).toHaveCount(0);
});
test('una respuesta vacía se puede reintentar sin duplicar la pregunta',async({page})=>{
 await prepare(page,{respond:{texto:''}});await page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'}).fill('Explica el pH');await page.getByRole('button',{name:'Enviar pregunta'}).click();await expect(page.getByText('La respuesta llegó incompleta. Tu pregunta sigue guardada; pulsa Reintentar.',{exact:true})).toBeVisible();
 await page.route('**/api/chat/preguntar',r=>r.fulfill({json:answer}));await page.getByRole('dialog',{name:'Asistente de ZeaSys'}).getByRole('button',{name:'Reintentar',exact:true}).click();await expect(page.locator('.from-user')).toHaveCount(1);await expect(page.locator('.from-assistant .zeasys-chat-answer')).toContainText('El pH');
});
test('el chat cerrado no roba el foco y abierto contiene el recorrido de teclado',async({page})=>{
 await prepare(page);const close=page.getByRole('button',{name:'Cerrar asistente ZeaSys',exact:true});await close.click();await expect(page.getByRole('button',{name:'Abrir asistente ZeaSys'})).toBeFocused();await expect(page.locator('#zeasys-chat-panel')).toHaveAttribute('inert','');
 await page.getByRole('button',{name:'Abrir asistente ZeaSys'}).click();await page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'}).fill('Texto');await page.getByRole('button',{name:'Enviar pregunta'}).focus();await page.keyboard.press('Tab');await expect(close).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Abrir asistente ZeaSys'})).toBeFocused();
});
test('texto al doble y pantalla horizontal conservan conversación y entrada',async({page})=>{
 await prepare(page,{width:812,height:375});await page.addStyleTag({content:'html:has(.zeasys-workspace){font-size:32px;}'});await ask(page);const panel=page.locator('#zeasys-chat-panel');expect(await panel.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);await expect(page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'})).toBeVisible();await expect(page.getByRole('button',{name:'Enviar pregunta'})).toBeVisible();expect(await panel.locator('.zeasys-chat-messages').evaluate(node=>node.clientHeight)).toBeGreaterThan(40);
});
test('el HTML de sugerencias no ejecuta scripts en la aplicación',async({page})=>{
 await prepare(page,{respond:{...answer,fuente_datos:{...answer.fuente_datos,sugerencias_busqueda_html:'<script>parent.document.body.dataset.chatInjection="si"</script><p>Fuente externa</p>'}}});await ask(page);await expect(page.getByTitle('Sugerencias de búsqueda de Google')).toBeVisible();expect(await page.evaluate(()=>document.body.dataset.chatInjection)).toBeUndefined();
});
test('la marca útil se conserva al recargar la conversación y se elimina al limpiarla', async ({ page }) => {
 await prepare(page); await ask(page); await page.getByRole('button', { name: 'Marcar útil', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Útil', exact: true })).toHaveAttribute('aria-pressed', 'true');
 await page.reload(); await waitForWorkspace(page); await page.getByRole('button', { name: 'Abrir asistente ZeaSys', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Útil', exact: true })).toHaveAttribute('aria-pressed', 'true');
 await page.getByRole('button', { name: 'Limpiar conversación', exact: true }).click(); await expect(page.getByRole('button', { name: 'Útil', exact: true })).toHaveCount(0);
});
for(const theme of ['light','dark'])test(`accesibilidad del panel y respuesta ${theme}`,async({page})=>{
 test.skip(!existsSync(axe),'Sin axe-core local');await prepare(page,{theme,respond:{...answer,fuente_datos:{...answer.fuente_datos,sugerencias_busqueda_html:null}}});await ask(page);await page.addScriptTag({path:axe});const violations=await page.evaluate(async()=>(await window.axe.run('#zeasys-chat-panel',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));expect(violations).toEqual([]);
});
