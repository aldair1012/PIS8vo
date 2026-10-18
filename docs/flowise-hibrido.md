# ZeaSys + Gemini mediante Flowise

El chatbot funciona con un único generador: Google Gemini dentro del chatflow local de Flowise. PHP no clasifica la pregunta, no busca una respuesta guardada y no redacta una respuesta alternativa. Sólo valida la sesión y la parcela, reúne el dashboard visible y envía ese contexto al flujo.

## Flujo de una pregunta

1. El usuario escribe cualquier pregunta libre en el panel lateral.
2. ZeaSys valida sesión, parcela y año seleccionados.
3. ZeaSys envía a Flowise la pregunta, la conversación reciente, la parcela autorizada, las simulaciones y el snapshot del dashboard. También envía un `sessionId` estable para esa conversación.
4. `Buffer Window Memory` recupera los últimos 6 intercambios de ese `sessionId` y `Conversation Chain` los entrega a Gemini junto con la pregunta actual.
5. Gemini responde directamente en español con conclusión, impacto, datos del dashboard y acciones.
6. El frontend muestra exactamente el texto recibido desde el flujo.

Si Flowise o Gemini no responden, el backend devuelve un error 502 para que el usuario reintente. No existe fallback de respuestas predeterminadas.

## Configuración local

- Flowise: `%LOCALAPPDATA%\ZeaSys-Flowise-Local`, `http://127.0.0.1:3000`.
- Chatflow: `ZeaSys Gemini Directo`.
- ID: `27d477e0-66b5-4a51-aba0-dcfaf80728c1`.
- Credencial Gemini: `zeasys`.
- Modelo configurado: `gemini-3.1-flash-lite-preview` (alternativa gratuita verificada).

El nodo Google Gemini está conectado a `Conversation Chain`, y `Buffer Window Memory` también está conectado a esa cadena. La ventana conserva los últimos 6 intercambios de la misma conversación. Al pulsar **Limpiar conversación**, ZeaSys genera un nuevo identificador y no reutiliza el historial anterior. Streaming está desactivado para evitar respuestas parciales. Si se cambia el modelo o la credencial, guardar el chatflow y probar desde **Chat** en Flowise.

El flujo sólo contiene `Google Gemini`, `Buffer Window Memory` y `Conversation Chain`. Chroma, Ollama, `Prompt Template`, `LLM Chain`, cadenas QA y documentos recuperados no se ejecutan. El backend ya no contiene catálogo agronómico ni reglas de intención.

## Variables del backend

```text
ZEASYS_FLOWISE_URL=http://127.0.0.1:3000
ZEASYS_FLOWISE_CHATFLOW_ID=27d477e0-66b5-4a51-aba0-dcfaf80728c1
ZEASYS_FLOWISE_API_KEY=<api-key-de-flowise-si-se-configura>
```

La clave de Gemini se guarda únicamente en Flowise. No se debe poner en React, PHP ni Git.

## Formato solicitado a Gemini

El prompt del backend exige una respuesta breve y útil:

- Conclusión directa en negrita.
- **Impacto en el cultivo**.
- **Datos del Dashboard** con cifras y unidades exactas.
- **Acciones requeridas**, normalmente entre 2 y 4 pasos.

Si falta una medición, Gemini debe escribir `No disponible en el dashboard`; no puede inventar porcentajes, diagnósticos o valores de rendimiento.
