import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerRespuestaChat } from '../services/streamChat.js';

test('emite deltas antes del fin aunque UTF-8 y CRLF estén partidos entre lecturas', async () => {
  let enviar;
  const stream = new ReadableStream({ start(controller) { enviar = controller; } });
  const response = new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  const primerDelta = Promise.withResolvers();
  const final = leerRespuestaChat(response, primerDelta.resolve);
  for (const byte of new TextEncoder().encode('event: delta\r\ndata: {"texto":"maíz"}\r\n\r\n')) {
    enviar.enqueue(Uint8Array.of(byte));
  }
  assert.equal(await primerDelta.promise, 'maíz');
  enviar.enqueue(new TextEncoder().encode('event: final\ndata: {"texto":"maíz de prueba"}\n\n'));
  enviar.close();
  assert.deepEqual(await final, { texto: 'maíz de prueba' });
});

test('un flujo truncado o un error nunca se trata como respuesta completa', async () => {
  const truncada = new Response('event: delta\ndata: {"texto":"Parcial"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  await assert.rejects(leerRespuestaChat(truncada, () => {}), { incomplete: true });
  await assert.rejects(leerRespuestaChat(Response.json({ error: 'Cuota agotada' }, { status: 429 }), () => {}), { message: 'Cuota agotada' });
});
