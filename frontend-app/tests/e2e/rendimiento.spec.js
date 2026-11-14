import { test, expect } from '@playwright/test';

const plot = { id: 1, nombre_parcela: 'Parcela A', tipo_maiz: 'Duro Amarillo', variedad_maiz: 'INIAP H-551', area: 2, latitud: -1, longitud: -80, provincia: 'Manabí', ubicacion: 'Manabí' };
const secondPlot = { ...plot, id: 2, nombre_parcela: 'Parcela B' };
const registro = depth => ({ datos: { capacidad_campo_pct: 30, marchitez_pct: 10, profundidad_cm: depth, fecha_suelo: '2024-01-01' }, indicadores: { agua_medida: { valor: depth * 2, unidad: 'mm' } } });
const simulation = (id, value) => ({ id, fecha: '2026-11-09 10:00:00', rendimiento_t_ha: value, produccion_total_t: value * .5, area_simulada_ha: .5, version_modelo: 'prueba', entradas: { temperatura_c: 25, fertilizante_kg_ha: 100, tipo_suelo: 'franco' }, intervalo_rendimiento: { min: Math.max(0,value-1), max: value+1 }, impactos_modelo_shap: { temperatura: .1 }, escenarios_climaticos: { lluvioso: { rendimiento_t_ha: value+1, produccion_total_t: (value+1)*.5 } } });
const payload = () => ({ cultivo_activo: plot, simulaciones_count: 2, simulaciones_rendimiento: [simulation(101,4),simulation(102,3)], kpis: {}, referencias_publicas: {}, mediciones_campo: registro(100) });

async function prepare(page, { data=payload(), handler, width=1440, expectError=false }={}) {
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(()=>{localStorage.setItem('onboarding_completed','true');localStorage.setItem('theme','light');});
  await page.route('**/api/**',r=>r.fulfill({json:{}}));
  await page.route('**/api/auth/yo',r=>r.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas',r=>r.fulfill({json:[plot,secondPlot]}));
  await page.route('**/api/rendimiento?*', async r=>{
    const id=new URL(r.request().url()).searchParams.get('parcela_id');
    if(id==='2')return r.fulfill({json:{sin_datos:true,cultivo_activo:secondPlot,simulaciones_rendimiento:[]}});
    return handler ? handler(r) : r.fulfill({json:data});
  });
  await page.goto('/');
  if(expectError)await expect(page.getByRole('alert')).toContainText('No se pudieron cargar');
  else await expect(page.getByRole('heading',{name:'Parcela A',exact:true})).toBeVisible();
}

test('Rendimiento permite recuperar un fallo de conexión sin salir de la pestaña',async({page})=>{
  await page.route('**/api/**',r=>r.fulfill({json:{}}));
  await page.route('**/api/auth/yo',r=>r.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas',r=>r.fulfill({json:[plot]}));
  let available=false;
  await page.route('**/api/rendimiento?*',r=>available?r.fulfill({json:payload()}):r.fulfill({status:503,json:{error:'sin conexión'}}));
  await page.goto('/');await expect(page.getByRole('alert')).toContainText('No se pudieron cargar');
  const retry=page.getByRole('button',{name:'Reintentar rendimiento'});await expect(retry).toBeVisible({timeout:1500});
  available=true;await retry.click();await expect(page.getByRole('heading',{name:'Parcela A',exact:true})).toBeVisible();
});

test('Ver todos los factores conserva espacio para cada barra SHAP',async({page})=>{
  const data=payload();data.simulaciones_rendimiento[0].explicacion_modelo={aportes:Object.fromEntries(Array.from({length:20},(_,i)=>[`factor_${i}`,(i+1)/100]))};
  await prepare(page,{data,width:390});
  const panel=page.locator('.ydp-panel').filter({has:page.getByRole('heading',{name:'Qué influyó en la estimación',exact:true})});
  await panel.getByRole('button',{name:'Ver todos',exact:true}).click();
  const chart=await panel.locator('[role=img]').boundingBox();expect(chart.height).toBeGreaterThan(20*24);
  const region=panel.getByRole('region',{name:'Aportes del modelo, gráfico desplazable'});await region.focus();await page.keyboard.press('End');
  await expect.poll(()=>region.evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
});

test('guardar una medición actualiza el resumen de Rendimiento al cerrar el registro',async({page})=>{
  const data=payload();await prepare(page,{handler:r=>r.fulfill({json:data})});
  await page.route('**/api/rendimiento/mediciones',r=>{data.mediciones_campo=registro(80);return r.fulfill({json:{exito:true,mediciones:data.mediciones_campo}});});
  await expect(page.locator('.ydp-record-summary')).toContainText('200,00 mm');
  await page.getByRole('button',{name:'Ver o actualizar mediciones'}).click();
  const dialog=page.getByRole('dialog',{name:'Registro de campo'});
  await dialog.getByLabel('Profundidad evaluada (cm)').fill('80');await dialog.getByRole('button',{name:'Guardar mediciones',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('Mediciones guardadas');await dialog.getByRole('button',{name:'Cerrar registro de campo'}).click();
  await expect(page.locator('.ydp-record-summary')).toContainText('160,00 mm',{timeout:1500});
});

test('seleccionar una ejecución cambia indicadores, comparación y el contexto enviado al chat',async({page})=>{
  await prepare(page);
  await page.locator('.ydp-run-bar').filter({hasText:'#102'}).click();
  await expect(page.locator('.ydp-metric').first()).toContainText('3,00');
  await expect(page.getByRole('heading',{name:'Comparar simulaciones'}).locator('xpath=ancestor::section[1]')).toContainText('Seleccionada · #102');
  let sent;
  await page.route('**/api/chat/preguntar',r=>{sent=r.request().postDataJSON();return r.fulfill({json:{texto:'Respuesta de prueba'}});});
  await page.getByRole('button',{name:'Abrir asistente ZeaSys'}).click();await page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'}).fill('Explica la ejecución seleccionada');await page.getByRole('button',{name:'Enviar pregunta'}).click();
  await expect(page.getByText('Respuesta de prueba',{exact:true})).toBeVisible();
  expect(sent.dashboard.simulacion_seleccionada.id).toBe(102);expect(sent.dashboard.kpis.rendimiento_predicho).toBe(3);
});

test('un fallo tardío de otra parcela no reemplaza la selección actual',async({page})=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await prepare(page,{handler:r=>r.fulfill({json:payload()})});
  await page.route('**/api/rendimiento?*',async r=>{
    if(new URL(r.request().url()).searchParams.get('parcela_id')==='2'){await gate;return r.fulfill({status:503,json:{error:'error antiguo'}});}
    return r.fulfill({json:payload()});
  });
  const choose=async name=>{await page.getByRole('button',{name:/Seleccionar parcela. Actual:/}).click();await page.getByRole('button',{name:new RegExp(name+' ')}).click();};
  await choose('Parcela B');await choose('Parcela A');release();await expect(page.getByRole('heading',{name:'Parcela A',exact:true})).toBeVisible();await expect(page.locator('.ydp-metric').first()).toContainText('4,00');await expect(page.getByRole('alert')).toHaveCount(0);
});

test('un resultado de cero se conserva y la falta de ejecuciones se muestra sin inventar métricas',async({page})=>{
  const data=payload();data.simulaciones_rendimiento=[simulation(101,0)];await prepare(page,{data});await expect(page.locator('.ydp-metric').first()).toContainText('0,00');
  await page.getByRole('button',{name:/Seleccionar parcela. Actual:/}).click();await page.getByRole('button',{name:/Parcela B /}).click();
  await expect(page.getByRole('heading',{name:'Aún no hay una simulación para esta parcela'})).toBeVisible();await expect(page.locator('.ydp-metrics')).toHaveCount(0);
});

for(const [name,data] of [['respuesta nula',null],['historial malformado',{cultivo_activo:plot,simulaciones_rendimiento:{}}],['parcela incorrecta',{cultivo_activo:secondPlot,simulaciones_rendimiento:[]}]]){
  test(`una ${name} se trata como fallo recuperable, sin romper la aplicación`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await prepare(page,{data,expectError:true});
    await expect(page.getByRole('button',{name:'Reintentar rendimiento'})).toBeVisible();expect(errors).toEqual([]);
    await expect(page.getByRole('heading',{name:'Elige una parcela para empezar'})).toHaveCount(0);
  });
}

test('el comparador permite intercambiar ejecuciones y conserva entradas presentes solo en una de ellas',async({page})=>{
  const data=payload();data.simulaciones_rendimiento[1].entradas.humedad_pct=65;await prepare(page,{data});
  const section=page.locator('.ydp-panel').filter({has:page.getByRole('heading',{name:'Comparar simulaciones',exact:true})});
  await expect(section.getByRole('row').filter({hasText:'Humedad relativa (%)'})).toContainText('65,00');
  await section.getByRole('combobox',{name:'Comparar con'}).selectOption('101');
  await expect(section).toContainText('Seleccionada · #102');await expect(section).toContainText('Comparación · #101');await expect(page.locator('.ydp-metric').first()).toContainText('3,00');
});

test('comparar una ejecución antigua sin entradas registradas muestra ausencias sin bloquear la pantalla',async({page})=>{
  const data=payload();delete data.simulaciones_rendimiento[0].entradas;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,{data});
  const section=page.locator('.ydp-panel').filter({has:page.getByRole('heading',{name:'Comparar simulaciones',exact:true})});
  const row=section.getByRole('row').filter({hasText:'Fertilización registrada (kg/ha)'});
  await expect(row.getByRole('cell').first()).toHaveText('—');await expect(row.getByRole('cell').last()).toHaveText('100,00');expect(errors).toEqual([]);
});

test('el año de referencia cambia SIPA y el contexto del chat, conservando los indicadores de la ejecución',async({page})=>{
  await prepare(page);await page.getByRole('combobox',{name:'Año de referencia provincial'}).selectOption('2024');
  await expect(page.locator('.ydp-reference-stats')).toContainText('Provincia · 2024');await expect(page.locator('.ydp-metric').first()).toContainText('4,00');
  let sent;await page.route('**/api/chat/preguntar',r=>{sent=r.request().postDataJSON();return r.fulfill({json:{texto:'Referencia de prueba'}});});
  await page.getByRole('button',{name:'Abrir asistente ZeaSys'}).click();await page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'}).fill('¿Qué año comparas?');await page.getByRole('button',{name:'Enviar pregunta'}).click();await expect(page.getByText('Referencia de prueba',{exact:true})).toBeVisible();
  expect(sent.dashboard.referencia_sipa.año_visible).toBe(2024);expect(sent.dashboard.simulacion_seleccionada.id).toBe(101);
});
