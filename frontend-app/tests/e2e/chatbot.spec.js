import { test, expect } from '@playwright/test';
import { waitForWorkspace } from './workspace-ready.js';

test('los documentos consultados conservan la página PDF y descartan referencias desconocidas',async({page})=>{
  await page.route('**/backend-api/public/index.php/api/**',r=>r.fulfill({json:{}}));
  await page.route('**/api/auth/yo',r=>r.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas',r=>r.fulfill({json:[{id:1,nombre_parcela:'Prueba',area:1}]}));
  await page.route('**/api/chat/preguntar',r=>r.fulfill({json:{texto:'Consulta el manual en la página indicada.',fuente_datos:{referencias_consultadas:[{archivo:'iniap-manual-produccion-maiz-2007.pdf',pagina_pdf:7},{archivo:'archivo-ajeno.pdf',pagina_pdf:1},{archivo:'iniap-manual-produccion-maiz-2007.pdf',pagina_pdf:24}]}}}));
  await page.goto('/');await waitForWorkspace(page);
  await page.getByRole('button',{name:'Abrir asistente ZeaSys'}).click();
  await page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'}).fill('Consulta una referencia');
  await page.getByRole('button',{name:'Enviar pregunta'}).click();
  await page.getByText('Documentos de apoyo (1)').click();
  await expect(page.locator('.zeasys-chat-sources')).toContainText('2007 · página PDF 7');
  await expect(page.locator('.zeasys-chat-sources')).not.toContainText('archivo-ajeno');
});

test('limpiar una conversación descarta la respuesta que seguía en curso', async ({ page }) => {
  await page.route('**/backend-api/public/index.php/api/**', route=>route.fulfill({json:{}}));
  await page.route('**/api/auth/yo', route=>route.fulfill({json:{autenticado:true,usuario:{id:987,nombre:'Prueba'}}}));
  await page.route('**/api/parcelas', route=>route.fulfill({json:[{id:1,nombre_parcela:'Prueba',area:1}]}));
  let release;
  let started;
  const pending = new Promise(resolve => { started=resolve; });
  const gate = new Promise(resolve => { release=resolve; });
  await page.route('**/api/chat/preguntar',async route=>{
    started(); await gate;
    await route.fulfill({json:{texto:'Respuesta antigua que debe descartarse'}}).catch(()=>{});
  });
  await page.goto('/');await waitForWorkspace(page);
  await page.getByRole('button',{name:'Abrir asistente ZeaSys'}).click();
  await page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'}).fill('Explica mi parcela');
  await page.getByRole('button',{name:'Enviar pregunta'}).click();
  await pending;
  await page.getByRole('button',{name:'Limpiar conversación'}).click();
  release();
  await expect(page.getByRole('textbox',{name:'Escribe tu pregunta al asistente'})).toBeEnabled();
  await page.waitForTimeout(350);
  await expect(page.getByText('Respuesta antigua que debe descartarse')).toHaveCount(0);
  await expect(page.locator('.zeasys-chat-message')).toHaveCount(0);
});

test('el asistente ofrece follow-ups contextuales y permite marcar la respuesta como útil', async ({ page }) => {
  await page.route('**/backend-api/public/index.php/api/**', r => r.fulfill({ json: {} }));
  await page.route('**/api/auth/yo', r => r.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/api/parcelas', r => r.fulfill({ json: [{ id: 1, nombre_parcela: 'Prueba', area: 1 }] }));
  await page.route('**/api/chat/preguntar', r => r.fulfill({ json: { texto: 'El rendimiento proyectado es favorable según los datos del panel.', fuente_datos: { conversacion_id: 'conv-1', referencias_consultadas: [] } } }));
  await page.goto('/');
  await waitForWorkspace(page);
  await page.getByRole('button', { name: 'Abrir asistente ZeaSys' }).click();
  const textbox = page.getByRole('textbox', { name: 'Escribe tu pregunta al asistente' });
  await expect(textbox).toHaveAttribute('maxlength', '2000');
  await textbox.fill('¿Cómo está el rendimiento?');
  await page.getByRole('button', { name: 'Enviar pregunta' }).click();
  await expect(page.getByText('El rendimiento proyectado es favorable')).toBeVisible();
  await expect(page.getByRole('button', { name: '¿Cuántas toneladas estima mi simulación para este lote?' })).toBeVisible();
  await expect(page.getByRole('button', { name: '¿Cómo cambian los escenarios climáticos de mi simulación?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver fuente' })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar útil' }).click();
  await expect(page.getByRole('button', { name: 'Útil' })).toHaveAttribute('aria-pressed', 'true');
});

test('reintenta la pregunta cuando el flujo falla y conserva la conversación', async ({ page }) => {
  await page.route('**/backend-api/public/index.php/api/**', r => r.fulfill({ json: {} }));
  await page.route('**/api/auth/yo', r => r.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/api/parcelas', r => r.fulfill({ json: [{ id: 1, nombre_parcela: 'Prueba', area: 1 }] }));
  let llamadas = 0;
  await page.route('**/api/chat/preguntar', async (route) => {
    llamadas += 1;
    if (llamadas === 1) await route.fulfill({ status: 502, json: {} });
    else await route.fulfill({ json: { texto: 'Respuesta recuperada tras reintentar la consulta.', fuente_datos: { referencias_consultadas: [] } } });
  });
  await page.goto('/');
  await waitForWorkspace(page);
  await page.getByRole('button', { name: 'Abrir asistente ZeaSys' }).click();
  await page.getByRole('textbox', { name: 'Escribe tu pregunta al asistente' }).fill('Explica mi parcela');
  await page.getByRole('button', { name: 'Enviar pregunta' }).click();
  await expect(page.getByText('Se interrumpió la respuesta. Tu pregunta sigue guardada; pulsa Reintentar.')).toBeVisible();
  await page.locator('.zeasys-chat-retry').click();
  await expect(page.getByText('Respuesta recuperada tras reintentar la consulta.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Escribe tu pregunta al asistente' })).toBeEnabled();
});

test('al cerrar el asistente el foco vuelve al botón de apertura', async ({ page }) => {
  await page.route('**/backend-api/public/index.php/api/**', r => r.fulfill({ json: {} }));
  await page.route('**/api/auth/yo', r => r.fulfill({ json: { autenticado: true, usuario: { id: 987, nombre: 'Prueba' } } }));
  await page.route('**/api/parcelas', r => r.fulfill({ json: [{ id: 1, nombre_parcela: 'Prueba', area: 1 }] }));
  await page.goto('/');
  await waitForWorkspace(page);
  await page.getByRole('button', { name: 'Abrir asistente ZeaSys' }).click();
  await page.getByRole('textbox', { name: 'Escribe tu pregunta al asistente' }).waitFor();
  await page.getByRole('button', { name: /cerrar asistente zeasys/i }).click();
  await expect(page.getByRole('button', { name: /abrir asistente/i })).toBeFocused();
});
