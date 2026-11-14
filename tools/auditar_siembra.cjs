// Revisión con cuenta y parcelas ficticias: requiere ejecutar la integración con --mantener.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium, expect } = createRequire(path.resolve(__dirname,'../frontend-app/package.json'))('@playwright/test');
const origin = process.env.ZEASYS_E2E_ORIGIN || '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Requiere el entorno desechable de integración.');
const root = path.resolve(__dirname,'..');
const out = path.resolve(process.argv[2] || path.join(root,'documentacion/fuentes-maiz/descargas/siembra-estados-20261109'));
const api = origin + '/backend-api/public/index.php/api/';

(async()=>{
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});const rows=[];
  try {
    for(const width of [390,1440]) for(const theme of ['light','dark']) {
      const context=await browser.newContext({viewport:{width,height:1000},bypassCSP:true});let emptyId;
      try {
        const login=await context.request.post(api+'auth/iniciar-sesion',{data:{correo:'a@example.test',contrasena:' ClavePrueba-2026! '}});assert(login.ok());
        const plots=await (await context.request.get(api+'parcelas')).json();
        const main=plots.find(p=>p.nombre_parcela==='Parcela actualizada');assert(main,'Parcela principal ficticia disponible');
        const created=await context.request.post(api+'parcelas',{data:{nombre_parcela:'Parcela sin simulaciones de auditoría',area:1,ubicacion:'Guayas',latitud:-1,longitud:-80,tipo_maiz:'Duro Amarillo',variedad_maiz:'INIAP H-551'}});assert(created.ok());emptyId=(await created.json()).cultivo.id;
        await context.addInitScript(t=>localStorage.setItem('theme',t),theme);
        const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(origin);await page.locator('.navbar').waitFor();
        if(await page.locator('#workspace-sidebar').evaluate(n=>n.inert))await page.getByRole('button',{name:'Expandir barra lateral'}).click();
        await page.getByRole('button',{name:'Siembra',exact:true}).click();
        const choosePlot=async name=>{await page.getByRole('button',{name:/^Seleccionar parcela\. Actual:/}).click();await page.locator('.lote-selector-card').filter({hasText:name}).click();};
        await choosePlot(main.nombre_parcela);await page.getByRole('heading',{name:main.nombre_parcela,exact:true}).waitFor();
        await page.getByRole('button',{name:/^Seleccionar parcela\. Actual:/}).click();await page.getByRole('button',{name:'2024',exact:true}).click();await page.keyboard.press('Escape');
        await page.locator('.siembra-sample-note').filter({hasText:'50 simulaciones'}).waitFor();
        const check=async state=>{
          await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
          await page.addScriptTag({path:path.join(root,'documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js')});
          const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
          const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth>innerWidth+1,content:document.querySelector('.content-body').scrollWidth>document.querySelector('.content-body').clientWidth+1}));
          rows.push({width,theme,state,violations,overflow,errors:[...errors]});await page.screenshot({path:path.join(out,`${width}-${theme}-${state}.png`),animations:'disabled'});await fs.writeFile(path.join(out,'auditoria.json'),JSON.stringify(rows,null,2));
          assert.equal(violations.length,0,`Accesibilidad ${state}`);assert.deepEqual(overflow,{document:false,content:false});assert.deepEqual(errors,[]);console.log(width,theme,state,'correcto');
        };
        const matrix=page.getByRole('region',{name:'Comparación de simulaciones guardadas, tabla desplazable'});await matrix.scrollIntoViewIfNeeded();
        const size=await matrix.evaluate(n=>({visible:n.clientHeight,total:n.scrollHeight}));assert(size.visible<=420&&size.total>size.visible,'La matriz grande se desplaza dentro de un panel limitado');
        await matrix.focus();await page.keyboard.press('End');assert(await matrix.evaluate(n=>n.scrollTop>0));await check('muestra-grande');
        await page.getByRole('button',{name:'FEB Catálogo',exact:true}).click();
        const day=page.getByRole('button',{name:/^29 de febrero de 2024: Siembra:/});await day.focus();await page.keyboard.press('Enter');await expect(day).toHaveAttribute('aria-expanded','true');await page.getByRole('status',{name:'Detalle de la referencia de siembra'}).waitFor();await check('calendario');await page.keyboard.press('Escape');
        await page.locator('.siembra-result-toggle').first().click();await page.getByRole('button',{name:'Análisis Detallado',exact:true}).click();await page.locator('.simulation-info-card-loading').waitFor({state:'hidden',timeout:60000});await page.locator('.simulation-info-card').waitFor();await check('resultado-y-explicacion');await page.getByRole('button',{name:'Cerrar información',exact:true}).click();
        await choosePlot('Parcela sin simulaciones de auditoría');await page.getByRole('heading',{name:'Sin simulaciones guardadas en 2024',exact:true}).waitFor();await page.locator('.siembra-empty').scrollIntoViewIfNeeded();await check('sin-simulaciones');
        await page.getByRole('button',{name:'Mi cultivo',exact:true}).click();await page.getByLabel('Fecha de siembra registrada o prevista').scrollIntoViewIfNeeded();await check('sin-fecha');
        await page.getByLabel('Fecha de siembra registrada o prevista').fill('2027-03-15');await page.getByRole('button',{name:'Guardar fecha de siembra',exact:true}).click();await page.getByRole('button',{name:'15 de marzo de 2027: Siembra registrada de la parcela',exact:true}).waitFor();await page.locator('#siembra-calendar').scrollIntoViewIfNeeded();await check('fecha-guardada');
        const response=await (await context.request.get(api+`escenarios?parcela_id=${emptyId}&a%C3%B1o=2024`)).json();assert.equal(response.cultivo_activo.provincia,'Manabí');assert.equal(response.kpis.rendimiento_esperado,null);assert(response.viabilidad_siembra.length>0);
      } finally {
        if(emptyId){const removed=await context.request.delete(api+`parcelas?id=${emptyId}`);assert(removed.ok(),'Limpieza de parcela ficticia');}
        await context.close();
      }
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
