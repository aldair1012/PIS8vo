import { test, expect } from '@playwright/test';

const plot = { id:1,nombre_parcela:'Parcela A',area:2,ubicacion:'Manabí',latitud:-1,longitud:-80,fecha_siembra:'2024-01-01' };
const otherPlot = { ...plot,id:2,nombre_parcela:'Parcela B' };
const windowRow = {rango:'1–29 FEB',estado:'Siembra: Manabí',fuente:'Catálogo agronómico local',tipo:'ventana_catalogo_no_pronostico',nota:'Referencia provincial'};
const payload = (value=4) => ({cultivo_activo:plot,años_disponibles:[2001,2024,2025,2026],kpis:{rendimiento_esperado:value,riesgo_agronomico:{nivel:null,texto:null,motivo:'No existe un modelo calibrado de riesgo.'}},percentiles:{p10:value,p50:value,p90:value,muestra:2},resumen_descriptivo:{muestra:2,coeficiente_variacion_pct:0},simulaciones_count:2,heatmap:[{tipo:'resultado_guardado',simulacion_id:101,fecha:'Simulación #101',hibrido:'INIAP H-551',valor:value}],ranking:[{tipo:'resultado_guardado',simulacion_id:101,estrategia:'Prueba guardada',combinacion:'INIAP H-551 · Simulación #101',valor:value,unidad:'t/ha',badge:'Resultado guardado',porque:'Orden descriptivo de resultados guardados.'}],viabilidad_siembra:[windowRow],recomendaciones:[],procedencia:{rendimiento:{limite:50,año:2024}}});

async function prepare(page,{data=payload(),handler}={}) {
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>{localStorage.setItem('onboarding_done_987','true');localStorage.setItem('theme','light');});
  await page.route('**/api/**',route=>route.fulfill({json:{}}));
  await page.route('**/api/auth/yo',route=>route.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas',route=>route.fulfill({json:[plot,otherPlot]}));
  await page.route('**/api/escenarios?*',route=>handler?handler(route):route.fulfill({json:data}));
  await page.goto('/');await page.getByRole('button',{name:'Siembra',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tu plan de siembra',exact:true}).or(page.getByRole('alert'))).toBeVisible();
  if (await page.getByRole('button',{name:/Consultar simulaciones guardadas/}).isVisible()) await openResults(page);
}

test('cambiar el año consulta Siembra sin excepciones y actualiza los indicadores',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await prepare(page,{handler:route=>route.fulfill({json:payload(new URL(route.request().url()).searchParams.get('año')==='2024'?3:4)})});
  await expect(page.getByRole('region',{name:'Indicadores avanzados de siembra'}).locator('.ydp-metric').first()).toContainText('4');
  await page.getByLabel('Año de las simulaciones').selectOption('2024');
  await expect(page.getByRole('region',{name:'Indicadores avanzados de siembra'}).locator('.ydp-metric').first()).toContainText('3');expect(errors).toEqual([]);
});

test('un fallo de conexión puede reintentarse desde Siembra',async({page})=>{
  let available=false;await prepare(page,{handler:route=>available?route.fulfill({json:payload()}):route.fulfill({status:503,json:{error:'fuera de línea'}})});
  await expect(page.getByRole('alert')).toContainText('No se pudieron cargar');
  available=true;await page.getByRole('button',{name:'Reintentar siembra'}).click();await openResults(page);await expect(page.getByRole('region',{name:'Indicadores avanzados de siembra'}).locator('.ydp-metric').first()).toContainText('4');
});

for(const [name,data] of [['nula',null],['parcela equivocada',{...payload(),cultivo_activo:otherPlot}],['resumen incompleto',{cultivo_activo:plot,kpis:{}}]]){
  test(`respuesta ${name} se informa como error recuperable`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await prepare(page,{data});
    await expect(page.getByRole('alert')).toContainText('No se pudieron cargar');expect(errors).toEqual([]);
  });
}

test('las tarjetas y el resultado guardado se pueden consultar con teclado',async({page})=>{
  let explained;await prepare(page);await page.route('**/api/simulaciones/explicar',r=>{explained=r.request().postDataJSON();return r.fulfill({json:{titulo:'Media guardada',explicacion_breve:'Detalle de prueba'}});});
  const metric=page.getByRole('button',{name:/Rendimiento medio guardado/});await metric.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:/Información de/})).toBeVisible();await expect(page.getByRole('dialog').getByRole('heading',{name:'Qué muestra',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cerrar información'}).click();await expect(metric).toBeFocused();
  const toggle=page.getByRole('button',{name:'Ver explicación de simulación #101',exact:true});await toggle.focus();await page.keyboard.press('Space');
  await expect(page.getByRole('dialog',{name:/Información de/})).toBeVisible();await expect(page.getByRole('button',{name:'Análisis Detallado'})).toHaveCount(0);expect(explained.valor).toBe(4);expect(explained.unidad).toBe('t/ha');
});

test('un calendario de catálogo no se presenta como evaluación favorable ni riesgo calculado',async({page})=>{
  await prepare(page);await expect(page.locator('.dashboard-view--scenario')).not.toContainText('Evento favorable');
  await page.locator('.sowing-methodology > summary').click();await expect(page.locator('.sowing-risk-note')).toHaveCount(0);
});

test('un resultado cero conserva sus indicadores y datos de comparación',async({page})=>{
  await prepare(page,{data:payload(0)});await expect(page.getByRole('region',{name:'Indicadores avanzados de siembra'}).locator('.ydp-metric').first()).toContainText('0');
  await expect(page.locator('.sowing-history-list')).toContainText('0,0');
});

async function openResults(page) { const trigger=page.getByRole('button',{name:/Consultar simulaciones guardadas/});if(await trigger.getAttribute('aria-expanded')==='false')await trigger.click();if(await page.locator('.sowing-advanced > summary').isVisible())await page.locator('.sowing-advanced > summary').click(); }
async function year2024(page) {
  await page.getByLabel('Año de las simulaciones').selectOption('2024');
  await page.getByRole('button',{name:/Consultar meses habituales/}).click();
  await page.locator('.sowing-reference-calendar > summary').click();
}

test('el calendario sigue el mes anual, conserva el año bisiesto y cierra su detalle con Escape',async({page})=>{
  await prepare(page);await year2024(page);
  const day=page.getByRole('button',{name:'29 de febrero de 2024: Siembra: Manabí',exact:true});
  await day.focus();await page.keyboard.press('Enter');await expect(page.getByRole('status',{name:'Detalle de la referencia de siembra'})).toContainText('Referencia provincial');
  await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));await expect(page.getByRole('status',{name:'Detalle de la referencia de siembra'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('status',{name:'Detalle de la referencia de siembra'})).toHaveCount(0);await expect(day).toBeFocused();
  await page.getByRole('button',{name:'Mes anterior',exact:true}).click();await expect(page.getByRole('button',{name:'Mes anterior',exact:true})).toBeDisabled();
  for(let month=0;month<11;month++)await page.getByRole('button',{name:'Mes siguiente',exact:true}).click();await expect(page.getByRole('button',{name:'Mes siguiente',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Con fechas',exact:true}).click();await expect(page.locator('.sowing-reference-calendar h3')).toContainText('Febrero');await expect(page.locator('.sowing-reference-calendar h3')).toContainText('2024');
});

test('un año sin simulaciones mantiene referencias y no inventa indicadores',async({page})=>{
  const data={...payload(),sin_datos:true,sin_simulaciones:true,kpis:{rendimiento_esperado:null},percentiles:{p10:null,p50:null,p90:null,muestra:0},resumen_descriptivo:{muestra:0},simulaciones_count:0,heatmap:[],ranking:[]};
  await prepare(page,{data});await year2024(page);await expect(page.getByRole('heading',{name:'No hay simulaciones guardadas en 2024',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Indicadores avanzados de siembra'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'29 de febrero de 2024: Siembra: Manabí',exact:true})).toBeVisible();
});

test('una respuesta tardía de otra parcela no sustituye la selección actual',async({page})=>{
  await prepare(page,{handler:async route=>{if(new URL(route.request().url()).searchParams.get('parcela_id')==='1'){await new Promise(resolve=>setTimeout(resolve,600));return route.fulfill({status:503,json:{error:'fallo anterior'}});}return route.fulfill({json:{...payload(7),cultivo_activo:otherPlot}});}});
  await page.getByRole('button',{name:'Seleccionar parcela. Actual: Parcela A'}).click();await page.getByRole('button',{name:/Parcela B/}).click();
  await expect(page.getByRole('heading',{name:'Parcela B',exact:true})).toBeVisible();await page.waitForTimeout(750);await openResults(page);await expect(page.getByRole('region',{name:'Indicadores avanzados de siembra'}).locator('.ydp-metric').first()).toContainText('7');await expect(page.getByRole('alert')).toHaveCount(0);
});

test('cambiar de año cierra una explicación pendiente del periodo anterior',async({page})=>{
  await prepare(page);let requested=false;
  await page.route('**/api/simulaciones/explicar',async route=>{requested=true;await new Promise(resolve=>setTimeout(resolve,600));return route.fulfill({json:{titulo:'Detalle anterior',explicacion_breve:'Periodo anterior'}});});
  await page.getByRole('button',{name:/Rendimiento medio guardado/}).click();await expect.poll(()=>requested).toBe(true);await year2024(page);await page.waitForTimeout(750);await expect(page.locator('.simulation-info-card')).toHaveCount(0);
});

test('el chat recibe el resumen visible y todos los meses de referencia',async({page})=>{
  const data=payload();data.viabilidad_siembra=Array.from({length:12},(_,i)=>({...windowRow,rango:`1 ${['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][i]}`}));await prepare(page,{data});
  let sent;await page.route('**/api/chat/preguntar',r=>{sent=r.request().postDataJSON();return r.fulfill({json:{texto:'Resumen recibido'}});});
  await page.getByRole('button',{name:'Abrir asistente ZeaSys'}).click();await page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'}).fill('Explica mi calendario');await page.getByRole('button',{name:'Enviar pregunta'}).click();await expect(page.getByText('Resumen recibido',{exact:true})).toBeVisible();
  expect(sent.vista).toBe('scenarios');expect(sent.dashboard.resumen_descriptivo.muestra).toBe(2);expect(sent.dashboard.viabilidad_siembra).toHaveLength(12);
});

test('el selector incluye años guardados aunque no coincidan con la fecha de siembra del lote',async({page})=>{
  const data={...payload(),años_disponibles:[2001,2024,2025]};let requestedYear;
  await prepare(page,{handler:route=>{requestedYear=new URL(route.request().url()).searchParams.get('año');return route.fulfill({json:data});}});
  await expect(page.getByRole('region',{name:'Indicadores avanzados de siembra'}).locator('.ydp-metric').first()).toBeVisible();await page.getByLabel('Año de las simulaciones').selectOption('2001');
  await expect.poll(()=>requestedYear).toBe('2001');
});

test('el calendario abre un mes con información y permite consultar las ventanas de cosecha',async({page})=>{
  const data=payload();data.viabilidad_siembra=[{...windowRow,rango:'1–28 FEB'},{...windowRow,rango:'1–31 AGO',estado:'Cosecha: Manabí'}];await prepare(page,{data});
  await page.getByRole('button',{name:/Consultar meses habituales/}).click();
  await page.locator('.sowing-reference-calendar > summary').click();await expect(page.locator('.sowing-reference-calendar h3')).toContainText('Febrero');
  await page.getByLabel('Tipo de referencia agrícola').selectOption('cosecha');
  await expect(page.getByRole('button',{name:/^1 de agosto de .*: Cosecha: Manabí$/})).toBeVisible();
});

test('sin catálogo se utiliza la fecha registrada de la parcela y se explica que falta un fin de ciclo',async({page})=>{
  const data={...payload(),cultivo_activo:{...plot,fecha_siembra:'2027-03-12'},viabilidad_siembra:[],calendario_parcela:{eventos:[{fecha:'2027-03-12',tipo:'siembra_registrada',titulo:'Siembra registrada de la parcela',fuente:'Fecha guardada por el productor'}],nota:'No hay una fecha de fin de ciclo conservada.'}};await prepare(page,{data});
  await page.getByRole('button',{name:'Ver mis fechas en calendario',exact:true}).click();await expect(page.locator('#siembra-calendar h3')).toContainText('Marzo');await expect(page.locator('#siembra-calendar h3')).toContainText('2027');
  await expect(page.getByRole('button',{name:'12 de marzo de 2027: Siembra: fecha por confirmar',exact:true})).toBeVisible();
  await expect(page.locator('.sowing-dates')).toContainText('Añade la duración');
});

test('la comparación no crea cruces vacíos de variedades y una sola ejecución tiene una lectura propia',async({page})=>{
  const data=payload();data.simulaciones_count=1;data.resumen_descriptivo.muestra=1;data.percentiles.muestra=1;data.heatmap.push({...data.heatmap[0],simulacion_id:102,fecha:'Simulación #102',hibrido:'Variedad B',valor:3});await prepare(page,{data});
  const table=page.locator('.sowing-history-list');await expect(table).toContainText('INIAP H-551');
  await expect(table).not.toContainText('—');await expect(page.getByText('Una simulación no permite comparar la variación de rendimientos.',{exact:true})).toBeVisible();
});

test('un año sin resultados ofrece abrir el último año que tiene ejecuciones de la parcela',async({page})=>{
  await prepare(page,{handler:route=>{const y=new URL(route.request().url()).searchParams.get('año');return route.fulfill({json:y==='2024'?payload():{...payload(),sin_datos:true,simulaciones_count:0,resumen_descriptivo:{muestra:0},kpis:{rendimiento_esperado:null},percentiles:{},heatmap:[],ranking:[],año_ultima_simulacion:2024}});}});
  await page.getByRole('button',{name:'Ver simulaciones de 2024',exact:true}).click();await page.locator('.sowing-advanced > summary').click();await expect(page.getByRole('region',{name:'Indicadores avanzados de siembra'}).locator('.ydp-metric').first()).toContainText('4');
});

test('una parcela sin fechas puede completarse desde el calendario y recarga sus eventos',async({page})=>{
  const data={...payload(),viabilidad_siembra:[],calendario_parcela:{eventos:[],nota:'Registra una fecha de siembra.'}};await prepare(page,{handler:r=>r.fulfill({json:data})});
  let saved;await page.route('**/api/parcelas',r=>{if(r.request().method()!=='PUT')return r.fulfill({json:[plot,otherPlot]});saved=r.request().postDataJSON();data.cultivo_activo={...data.cultivo_activo,...saved};data.calendario_parcela.eventos=[{fecha:saved.fecha_siembra,tipo:'siembra_registrada',titulo:'Siembra registrada de la parcela',fuente:'Fecha guardada por el productor'}];return r.fulfill({json:{success:true}});});
  await page.getByRole('button',{name:'Editar mi plan',exact:true}).click();await page.getByLabel('Fecha de siembra',{exact:true}).fill('2027-03-15');await page.getByLabel('¿Ya sembraste en esa fecha?').selectOption('prevista');await page.getByRole('button',{name:'Guardar mi plan',exact:true}).click();
  await page.getByRole('button',{name:'Ver mis fechas en calendario',exact:true}).click();await expect(page.getByRole('button',{name:'15 de marzo de 2027: Siembra prevista',exact:true})).toBeVisible();expect(saved).toMatchObject({id:1,fecha_siembra:'2027-03-15',tipo_fecha_siembra:'prevista'});
});

test('Siembra utiliza la cabecera, las tarjetas y los paneles comunes de Rendimiento',async({page})=>{
  await prepare(page);await expect(page.locator('.dashboard-view--scenario .ydp-page-header')).toBeVisible();
  const metrics=page.getByRole('region',{name:'Indicadores avanzados de siembra'});await expect(metrics.locator('.ydp-metric')).toHaveCount(4);await expect(metrics.locator('.ydp-metric--feature')).toHaveCount(1);
  await expect(page.locator('.dss-unified-card')).toHaveCount(0);await expect(page.locator('#sowing-main-plan.ydp-panel')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tu plan de siembra',exact:true})).toBeVisible();await page.locator('.sowing-methodology > summary').click();await expect(page.locator('.sowing-methodology')).toContainText('indicadores');
});

test('el gráfico de percentiles actualiza sus colores al cambiar de tema',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);
  const chart=page.getByRole('img',{name:'Percentiles descriptivos P10, mediana y P90 de las simulaciones guardadas'});
  await chart.scrollIntoViewIfNeeded();await expect.poll(()=>chart.evaluate(node=>node.toDataURL().length)).toBeGreaterThan(2000);
  const signature=node=>{const value=node.toDataURL();let hash=0;for(let i=0;i<value.length;i++)hash=(Math.imul(hash,31)+value.charCodeAt(i))|0;return hash;};
  const before=await chart.evaluate(signature);await page.getByRole('button',{name:'Activar modo oscuro',exact:true}).click();
  await expect.poll(()=>chart.evaluate(signature)).not.toBe(before);
});

test('la comparación móvil mantiene el rendimiento visible junto a la ejecución',async({page})=>{
  await prepare(page);await page.setViewportSize({width:390,height:1000});
  const region=page.locator('.sowing-history-list');await region.scrollIntoViewIfNeeded();
  const frame=await region.boundingBox(), value=await region.locator('.sowing-result-value strong').first().boundingBox();
  expect(value.x).toBeGreaterThanOrEqual(frame.x);expect(value.x+value.width).toBeLessThanOrEqual(frame.x+frame.width);
});
