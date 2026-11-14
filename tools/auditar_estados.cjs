const fs=require('node:fs/promises');const path=require('node:path');const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../frontend-app/package.json'))('@playwright/test');
const origin=process.env.ZEASYS_E2E_ORIGIN;if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin||''))throw Error('Usa la cuenta ficticia de integración.');
const root=path.resolve(__dirname,'..'),out=path.join(root,'documentacion/fuentes-maiz/descargas/estados-20261109');
(async()=>{await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const rows=[];
try{for(const width of [390,1440])for(const theme of ['light','dark']){
 const ctx=await browser.newContext({viewport:{width,height:1000},bypassCSP:true});await ctx.request.post(origin+'/backend-api/public/index.php/api/auth/iniciar-sesion',{data:{correo:'a@example.test',contrasena:' ClavePrueba-2026! '}});
 await ctx.addInitScript(t=>localStorage.setItem('theme',t),theme);const page=await ctx.newPage();await page.goto(origin);await page.locator('.navbar').waitFor();
 const navigate=async name=>{if(await page.locator('#workspace-sidebar').evaluate(n=>n.inert))await page.getByRole('button',{name:'Expandir barra lateral'}).click();await page.getByRole('button',{name,exact:true}).click();};
 const check=async state=>{await page.addScriptTag({path:path.join(root,'documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js')});const r=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));rows.push({width,theme,state,violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))}))});await page.screenshot({path:path.join(out,`${width}-${theme}-${state}.png`),animations:'disabled'});await fs.writeFile(path.join(out,'auditoria.json'),JSON.stringify(rows,null,2));console.log(width,theme,state,r.violations.length);};
 await navigate('Mis parcelas');await page.getByRole('button',{name:'Registro de campo',exact:true}).click();await page.getByRole('dialog').getByLabel('Profundidad evaluada (cm)').waitFor();await check('registro');await page.getByRole('button',{name:'Cerrar registro de campo'}).click();
 await navigate('Simular cosecha');const select=page.locator('#simular-parcela');await select.waitFor();const id=await select.locator('option').evaluateAll(ns=>ns.find(n=>n.value)?.value);await select.selectOption(id);await page.getByRole('button',{name:'Urea 46-0-0',exact:true}).click();await check('fertilizante');
 await page.getByRole('button',{name:/Otros/}).click();await check('producto-propio');await ctx.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
