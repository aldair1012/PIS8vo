// Auditoría local sobre cuenta ficticia del entorno de integración; no toca sesiones personales.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../frontend-app/package.json'))('@playwright/test');
const origin = process.env.ZEASYS_E2E_ORIGIN || '';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('Requiere el entorno desechable.');
const output = path.resolve(process.argv[2] || 'documentacion/fuentes-maiz/descargas/ui-antes');
const axePath = path.resolve('documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js');
const widths = (process.env.ZEASYS_AUDIT_WIDTHS || '390,820,1440').split(',').map(Number);
const themes = (process.env.ZEASYS_AUDIT_THEMES || 'light,dark').split(',');
const views = ['Mis parcelas','Simular cosecha','Rendimiento','Siembra','Clima y cultivo','Finanzas','Mapa de parcelas','Simulaciones guardadas','Configuración'];
(async () => {
  await fs.mkdir(output, { recursive:true });
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  const rows=[];
  try {
    for(const width of widths) for(const theme of themes) {
      const context=await browser.newContext({viewport:{width,height:1000},bypassCSP:true});
      const response=await context.request.post(origin+'/backend-api/public/index.php/api/auth/login',{data:{correo:'a@example.test',contrasena:' ClavePrueba-2026! '}});
      if(!response.ok()) throw Error('Falló el acceso ficticio.');
      await context.addInitScript(value=>localStorage.setItem('theme',value),theme);
      const page=await context.newPage(); const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin+'/');
      await page.locator('.navbar').waitFor();
      for(const name of views) {
        if(name==='Configuración') await page.getByRole('button',{name:/Configuración de cuenta de/}).click();
        else {
          if(await page.locator('#workspace-sidebar').evaluate(node=>node.inert)) await page.getByRole('button',{name:'Expandir barra lateral'}).click();
          await page.getByRole('button',{name,exact:true}).click();
        }
        await page.waitForFunction(()=>!document.querySelector('.content-body')?.textContent.trim().startsWith('Cargando'),{timeout:30000});
        await page.waitForTimeout(650);
        await page.addScriptTag({path:axePath});
        const results=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}));
        const layout=await page.evaluate(()=>{
          const body=document.querySelector('.content-body');
          const small=[...document.querySelectorAll('button,select,input:not([type=checkbox]):not([type=radio]),textarea')].filter(node=>{
            const r=node.getBoundingClientRect(); return r.width>0&&r.height>0&&!node.closest('[inert]')&&(r.height<40||r.width<40);
          }).map(node=>({tag:node.tagName,css:node.className,label:node.getAttribute('aria-label')||node.textContent.trim().slice(0,60)}));
          return {documentOverflow:document.documentElement.scrollWidth>innerWidth+1,contentOverflow:body?body.scrollWidth>body.clientWidth+1:false,smallTargets:small};
        });
        const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll(' ','-');
        await page.screenshot({path:path.join(output,`${width}-${theme}-${slug}.png`),animations:'disabled'});
        rows.push({view:name,width,theme,layout,violations:results.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),incomplete:results.incomplete.map(v=>({id:v.id,nodes:v.nodes.length})),errors:[...errors]});
        console.log(width,theme,name,'incidencias',results.violations.length,'targets',layout.smallTargets.length);
        await fs.writeFile(path.join(output,'auditoria.json'),JSON.stringify(rows,null,2));
      }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
