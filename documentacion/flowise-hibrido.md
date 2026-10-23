# ZeaSys + Gemini + Flowise

El chatbot usa **Flowise** como orquestador y **Google Gemini Flash Lite** como
generador. PHP no genera respuestas ni mantiene un catálogo de respuestas
predeterminadas: valida la sesión y la parcela, arma un contexto autorizado y lo
envía al chatflow. La clave del proveedor vive únicamente en la credencial de
Flowise.

## Flujo de una pregunta

1. El productor escribe una pregunta libre en el panel lateral.
2. ZeaSys valida sesión, parcela y año seleccionados.
3. El backend consulta y combina, cuando están disponibles:
   - clima observado y pronóstico de 7 días (Open-Meteo Forecast),
   - temperatura/humedad de los últimos 30 días (Open-Meteo Archive),
   - suelo (SoilGrids) y nutrición del catálogo agronómico,
   - precio de referencia del maíz (MAGP 2026),
   - rendimiento, finanzas y la simulación guardada más reciente,
   - el borrador visible del formulario de Nueva Simulación, si se está en esa vista.
4. El contexto se compacta y se envía a Flowise junto con la pregunta. El
   presupuesto es de 3.200 caracteres de JSON y 4.000 del mensaje completo; si
   hace falta, se retiran bloques opcionales en orden de prioridad, nunca se
   corta el JSON a ciegas. El borrador de simulación es un bloque prioritario.
5. `Conversation Summary Buffer Memory` conserva la conversación por
   `sessionId` y la resume cuando crece.
6. La `Conversation Chain` entrega el mensaje completo a Gemini. No hay
   recuperación vectorial en el camino principal.
7. El frontend muestra el texto devuelto por el flujo, sin respuestas de
   respaldo pregrabadas.

## Configuración local verificada

- Flowise: `%LOCALAPPDATA%\ZeaSys-Flowise-Local`.
- URL: `http://127.0.0.1:3000`.
- Chatflow: `ZeaSys Chat Bot`.
- ID: `27d477e0-66b5-4a51-aba0-dcfaf80728c1`.
- Credencial de Gemini en Flowise: `zeasys`.
- Modelo activo: `gemini-3.5-flash-lite`.
- Temperatura: `0.2`; salida máxima: `1200` tokens.
- Streaming: desactivado; el backend espera una respuesta JSON completa.
- Memoria: `Conversation Summary Buffer Memory`, límite de resumen 4.000
  tokens.
- Nodos activos: Gemini, memoria y `Conversation Chain`.
- Embeddings/RAG: fuera del camino principal. El corpus y los nodos anteriores
  se conservan en los respaldos de SQLite y en Chroma.

El chatflow anterior usaba `Conversational Retrieval QA Chain` con Ollama
`all-minilm`. El prompt combinado del dashboard supera la ventana de 512 tokens
de ese embedding y Flowise devuelve:

```text
the input length exceeds the context length
```

La `Conversation Chain` evita ese cuello de botella: recibe el contexto
directamente y no lo embebe. Para preguntas exclusivamente documentales se
puede mantener un chatflow RAG separado, pero no debe recibir el snapshot
completo del dashboard.

## Datos y etiquetas

### Clima

- `clima_hoy.actual`: observación de corto plazo (temperatura, humedad, lluvia,
  viento y descripción).
- `pronostico_7d`: estimación diaria. El chat recibe el formato
  `[fecha, tmax_c, tmin_c, lluvia_mm, prob_lluvia_pct]` y un `resumen_7d` con el
  acumulado y los rangos.
- `clima_promedio_30d`: temperatura y humedad son promedios observados de los
  últimos 30 días; no es una normal climatológica de largo plazo.
  - `precipitacion_30d`: acumulado real de los últimos 30 días.
  - `precipitacion` / `precipitacion_anual_estimada`: proyección anual
    (suma de 30 días × 12, limitada a un rango agronómico). **No es lluvia
    mensual.**
- El dashboard muestra ambas cifras de precipitación cuando están disponibles.
- `clima_actual` se conserva por compatibilidad, pero declara que es un
  promedio y no el clima de hoy.

### Precio del maíz

`backend-api/data/precio_maiz_referencia.json` contiene la franja oficial del
MAGP para la campaña 2026:

- piso: `USD 17,45/qq`
- techo: `USD 19,61/qq`
- promedio: `USD 18,53/qq`
- fecha de fuente: `2026-03-27`

Es una **referencia oficial**, no una cotización de mercado en tiempo real. El
chat aclara esa condición cuando responde sobre precio y cita fuente y fecha
sólo si el usuario las pide. El módulo financiero usa su propio precio de
cálculo; el contexto incluye `impacto_precio`, que es un
cálculo mecánico sobre la producción guardada y no descuenta cambios de costos
ni penalizaciones por calidad. Incluye `delta_por_qq`, `delta_ingreso_estimado`
y una `lectura` breve para que el chat no sustituya ese efecto por el margen
actual de la parcela.

### Nutrición y “vitaminas”

- “Vitaminas” se interpreta como nutrientes vegetales (N, P, K y
  micronutrientes), no vitaminas de uso humano.
- El catálogo aporta la recomendación de nitrógeno y fraccionamiento para la
  zona y el pH del suelo.
- No se prescriben dosis de P, K ni micronutrientes sin análisis de suelo.
- La dosis de nitrógeno debe validarse con análisis y asistencia técnica local.
- Las recomendaciones de una simulación guardada se atribuyen a esa simulación;
  no se generalizan a otras parcelas.

### Simulación en edición

Nueva Simulación tiene su propio selector de parcela. El chat no debe usar la
parcela que quedó seleccionada en el navbar para los dashboards: mientras esa
vista está abierta, React envía `cultivo_id` y `simulacion` con el sujeto y los
valores del formulario.

El bloque `simulacion_borrador` incluye, cuando están disponibles:

- `estado: borrador_no_ejecutado` y `origen: Formulario Nueva Simulación`;
- parcela y área autorizadas desde la base de datos;
- `temperatura_entrada_c`, `humedad_entrada_pct` y
  `precipitacion_anual_entrada_mm`;
- `fertilizante_n_entrada_kg_ha`, `ph_suelo_entrada` y
  `textura_suelo_entrada`;
- `campos_faltantes` para que el asistente pida completar el formulario sin
  inventar valores;
- `area_excede_parcela` y `cargando_ubicacion` como señales de validación.

El backend valida rangos y descarta campos desconocidos. Si el borrador trae pH
o textura, reemplaza el valor de SoilGrids dentro de `nutricion` para que el
modelo no mezcle dos suelos en la recomendación. El borrador **no es una
simulación ejecutada**: el asistente puede orientar sobre fertilizante con el
catálogo, pero no debe afirmar que el rendimiento ya fue calculado. Si no hay
parcela seleccionada en esta vista, el backend no asume la primera parcela del
usuario; pide seleccionar una.

## Memoria compartida y conversaciones favoritas

### Memoria entre pestañas

Los paneles del dashboard (Rendimiento, Siembra, Clima, Finanzas, Mapa e
Historial) comparten **una sola conversación por parcela y año**. Cambiar de
pestaña ya no borra el hilo: React usa una clave de sesión común y el backend
sólo reinicia la memoria cuando cambia la parcela, el año o el ámbito. La
`sessionId` de Flowise se compone con usuario, parcela, año, ámbito e
identificador de conversación, sin incluir la vista.

Nueva Simulación conserva una memoria aparte porque trabaja con el borrador del
formulario. Además, la pestaña del asistente no se muestra en **Mis lotes** ni
en **Configuración**.

### Favoritos

La estrella del encabezado del chat guarda la conversación visible en la tabla
`chat_favoritos` como un registro propiedad del usuario:

- identificador de la conversación (`conversacion_id`), que evita duplicados;
- parcela, año, ámbito y panel visibles;
- título tomado del primer mensaje del usuario;
- mensajes de usuario y asistente almacenados como JSON;
- fotografía mínima del contexto (parcela, año, ámbito, vista y fecha).

Volver a pulsar la estrella elimina el favorito. El asistente recibe
`conversaciones_favoritas` sólo cuando la pregunta se refiere a conversaciones
guardadas, a lo hablado antes o pide recordar algo; nunca las ofrece por
iniciativa propia. El backend compacta cada favorito a su título y a la última
respuesta.

Endpoints: `POST /api/chat/favorito` (guardar o actualizar) y
`POST /api/chat/favorito/eliminar`.

### Migración de base de datos

`database/migraciones/20261019_chat_favoritos.sql` crea la tabla con
`CREATE TABLE IF NOT EXISTS`. El dump inicial ya la incluye; la migración se
ejecuta una sola vez sobre una base creada antes de este cambio:

```bash
mysql -u root agropredict_db < database/migraciones/20261019_chat_favoritos.sql
```

## Estilo de respuesta

El asistente responde por defecto de forma directa y concreta: sólo la
respuesta, las cifras necesarias y ninguna fuente, fecha, advertencia ni sección
que el usuario no haya pedido. No usa plantillas fijas. Cuando la interfaz
necesita más contexto, muestra botones de seguimiento debajo de la última
respuesta:

- **Más detalle:** pide ampliar la respuesta anterior con razonamiento y cifras.
- **Ver fuente:** pregunta explícitamente por la fuente y la fecha de los datos.

Las fuentes sólo se muestran en el texto cuando el usuario las pide; el botón
"Contexto enviado" del panel sigue disponible para auditar qué datos recibió el
flujo.

## Variables del backend

```text
ZEASYS_FLOWISE_URL=http://127.0.0.1:3000
ZEASYS_FLOWISE_CHATFLOW_ID=27d477e0-66b5-4a51-aba0-dcfaf80728c1
ZEASYS_FLOWISE_API_KEY=<api-key-de-flowise-si-se-configura>
ZEASYS_FLOWISE_TIMEOUT=30
```

`ZEASYS_FLOWISE_TIMEOUT` se expresa en segundos y tiene un mínimo de 5. Gemini
Flash Lite suele responder en pocos segundos; el valor de respaldo es 30.

La clave de Gemini se guarda únicamente en Flowise; nunca debe entrar en React,
PHP, los PDF del corpus ni Git. El ID del chatflow no es una credencial, pero si
se protege la API de Flowise hay que definir `ZEASYS_FLOWISE_API_KEY`.

## Migración reproducible

`tools/switch_flowise_conversation_chain.py` convierte el chatflow en
`Conversation Chain`, actualiza el modelo, desconecta los nodos RAG/xAI y
actualiza el system prompt con las reglas de clima, precio, nutrición, estilo de
respuesta y memoria guardada. Es idempotente y crea una copia `.bak` de SQLite
antes de modificar:

```bash
python tools/switch_flowise_conversation_chain.py
python tools/switch_flowise_conversation_chain.py --model gemini-3.5-flash-lite
```

Si Flowise ya estaba iniciado, la siguiente predicción recarga el flujo. Si la
interfaz muestra el grafo anterior, reinicia Flowise con
`scripts/iniciar_flowise.bat`.

Los scripts `tools/configure_flowise_grok.py`, `tools/switch_flowise_gemini.py`
y `tools/enable_flowise_rag.py` pertenecen a la etapa anterior con Grok/RAG. No
son necesarios para el flujo actual; se conservan para recuperar la variante
documental desde un respaldo.

## Diagnóstico rápido

- `the input length exceeds the context length`: el chatflow sigue usando la
  cadena RAG con Ollama. Ejecuta
  `python tools/switch_flowise_conversation_chain.py`.
- `403 permission-denied` o “no credits”: es un error de xAI Grok, no de
  Gemini. El flujo actual no usa xAI.
- `404 model not found`: el modelo de Gemini fue retirado. Actualiza
  `--model` con uno vigente de la cuenta.
- `El flujo de IA no respondió (HTTP 500)`: revisa
  `%LOCALAPPDATA%\ZeaSys-Flowise-Local\logs` y el estado de la credencial
  `zeasys`.
- `El flujo de IA no respondió (sin respuesta)`: Flowise no está iniciado o no
  es accesible en `127.0.0.1:3000`.
- La interfaz sigue diciendo Gemini: reconstruye el frontend con
  `npm run build` desde `frontend-app`.

## Verificación

Desde `frontend-app`:

```bash
npm run lint
npm run build
```

Desde la raíz:

```bash
php backend-api/tests/chat/ejecutar.php
```

La prueba funcional del chat debe usar una parcela real y preguntar por clima,
precio, margen y nutrientes en una sola consulta. La respuesta debe distinguir
observación, pronóstico, promedio de los últimos 30 días, referencia oficial de precio y
datos faltantes. Para validar el impacto de precio, pregunta explícitamente
cómo afecta al ingreso o al margen: la respuesta debe citar la diferencia por
quintal y el cambio estimado de ingreso, no sólo el margen actual.

Para validar Nueva Simulación, selecciona en el formulario una parcela distinta
a la del navbar, revisa que el encabezado del chat muestre esa parcela y pregunta
por fertilizante o pH. La respuesta debe citar los valores del formulario, no los
de la parcela anterior, y aclarar que el borrador aún no fue ejecutado. Si no hay
parcela seleccionada, debe pedir seleccionar una en lugar de asumir la primera.

Para validar la memoria compartida y los favoritos:

1. Pregunta en Rendimiento, cambia a Clima y verifica que el hilo y la respuesta
   anterior siguen visibles.
2. Pulsa la estrella del encabezado y confirma el registro en
   `SELECT * FROM chat_favoritos\G`.
3. Pregunta "¿qué conversación guardé?" y verifica que el asistente recuerde el
   tema sin ofrecerlo por iniciativa propia en otras preguntas.
4. Abre Mis lotes y Configuración: la pestaña del asistente no debe aparecer.
