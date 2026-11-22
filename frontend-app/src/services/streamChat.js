function errorRespuesta(status, message) {
  const error = new Error(message || 'No se pudo completar la consulta.');
  error.response = { status };
  return error;
}

export async function leerRespuestaChat(response, onDelta) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = errorRespuesta(response.status, data.error);
    error.response.data = data;
    throw error;
  }
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) return response.json();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const lines = buffer.slice(0, boundary.index).split(/\r?\n/);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!event || !data) continue;
        const payload = JSON.parse(data);
        if (event === 'delta' && typeof payload.texto === 'string') onDelta(payload.texto);
        if (event === 'error') throw errorRespuesta(payload.codigo, payload.error);
        if (event === 'final') return payload;
      }
      if (done) throw Object.assign(new Error('Respuesta incompleta'), { incomplete: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
