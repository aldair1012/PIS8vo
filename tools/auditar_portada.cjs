const fs=require('node:fs/promises');
const path=require('node:path');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../frontend-app/package.json'))('@playwright/test');
const origin=process.env.ZEASYS_E2E_ORIGIN;
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin||''))throw Error('Usa el entorno desechable.');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'documentacion/fuentes-maiz/descargas/portada-20261109');
(async()=>{
  await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
  try{
    for(const width of [390,820,1440])for(const theme of ['light','dark']){
      const context=await browser.newContext({viewport:{width,height:1000},bypassCSP:true,reducedMotion:'reduce'});
      await context.addInitScript(value=>localStorage.setItem('theme',value),theme);
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin);await page.locator('.zeasys-home').waitFor();await page.waitForTimeout(500);
      await page.addScriptTag({path:path.join(root,'documentacion/fuentes-maiz/descargas/ui-audit/node_modules/axe-core/axe.min.js')});
      const axe=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}));
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      for(const [name,selector] of [['hero','.zeasys-home-hero'],['capacidades','#capacidades'],['datos','#datos']]){
        await page.locator(selector).scrollIntoViewIfNeeded();await page.waitForTimeout(200);
        await page.screenshot({path:path.join(out,`${width}-${theme}-${name}.png`),animations:'disabled'});
      }
      report.push({width,theme,overflow,errors,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),incomplete:axe.incomplete.map(v=>v.id)});
      await fs.writeFile(path.join(out,'auditoria.json'),JSON.stringify(report,null,2));console.log(width,theme,axe.violations.length,'incidencias');await context.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
