# ZeaSys: guía del sistema

Actualización: 15 de noviembre de 2026. Este archivo es la descripción central del proyecto. Debe actualizarse al cambiar una función, una conexión o una limitación relevante.

## Qué es y para quién sirve

ZeaSys es una aplicación web de apoyo a decisiones sobre parcelas de maíz en Ecuador. Está dirigida a agricultores y a quienes los acompañan: permite ubicar una parcela, preparar una campaña, consultar el clima, simular escenarios y entender los resultados con ayuda de un asistente.

La información debe responder tres preguntas: **qué está ocurriendo, qué puede significar para el cultivo y qué se puede revisar o hacer a continuación**. Los nombres de variables, estadísticas y detalles de infraestructura no deben ser necesarios para usarla.

La aplicación reúne información del productor, referencias públicas, estimaciones meteorológicas y resultados de modelos. Esas clases de datos tienen distinto alcance: un pronóstico no es una medición en la parcela; una simulación no es una cosecha real; una guía provincial no confirma una enfermedad presente en el lote.

## Recorrido habitual

1. El productor inicia sesión y crea o selecciona una parcela.
2. Revisa su ubicación, superficie, tipo de maíz y variedad.
3. En **Siembra** organiza la fecha, la duración y el agua o riego previsto.
4. En **Clima y cultivo** consulta el tiempo disponible y lo que conviene observar en campo.
5. En **Simular cosecha** confirma las entradas y calcula un escenario.
6. En **Rendimiento** interpreta el resultado y compara ejecuciones guardadas.
7. Usa **Finanzas** si desea valorar un presupuesto y el precio referencial.
8. Registra observaciones reales y consulta el asistente cuando no entiende un dato o necesita orientación.

## Qué contiene cada pantalla

| Pantalla | Para qué sirve | Información y acciones principales |
|---|---|---|
| Página pública y acceso | Explicar el servicio y entrar a la cuenta | Presentación, capacidades, datos/modelos, contacto, acceso con correo y Google según configuración. |
| Mis parcelas | Mantener los datos propios del agricultor | Nombre, ubicación, superficie, límites o coordenadas, variedad y datos de apoyo del terreno. La información autocompletada se identifica y puede corregirse cuando corresponde. |
| Simular cosecha | Preparar un escenario de producción | Área, temperatura, humedad, lluvia del ciclo, nitrógeno como nutriente, pH, textura, fecha, duración, riego y datos opcionales. Los decimales y unidades se validan antes de enviar al motor. |
| Rendimiento | Entender una simulación y revisar pruebas anteriores | Rendimiento por hectárea, producción total para el área utilizada, rango orientativo, alternativas climáticas, aportes del modelo e historial de la parcela. Las comparaciones muestran sus entradas y límites. |
| Siembra | Organizar el cultivo antes de simular | Plan editable, fecha prevista o real declarada, duración, riego, fin aproximado y calendario propio. Calendario agrícola por zona/grupo de maíz con fuentes institucionales, suelo y antecedentes sanitarios. |
| Clima y cultivo | Consultar el tiempo y relacionarlo con las observaciones del productor | Condiciones actuales disponibles, pronóstico, evolución reciente, referencias históricas y estimaciones del suelo. La información regional se distingue de la correspondiente a la ubicación de la parcela. |
| Finanzas | Explorar el resultado económico de un escenario | Precio referencial, costos declarados, producción estimada, ingresos, margen y sensibilidad. No equivale a una cotización de compra garantizada. |
| Mapa de parcelas | Ubicar y consultar las parcelas guardadas | Localización y geometría de la cuenta. Las capas o mapas públicos se identifican como referencias, no catastros certificados del productor. |
| Simulaciones guardadas | Recuperar y comparar cálculos anteriores | Historial con fechas, entradas y resultados conservados. No son registros de cosecha real. |
| Registro de campo | Incorporar lo que el productor sí ha observado o medido | Observaciones del cultivo y de plagas, fechas, datos de cosecha y de agua del suelo cuando existen. Se guardan como datos declarados por el productor. |
| Configuración | Administrar la cuenta y obtener una copia de los datos | Perfil, foto, nombre, acceso, sesión, tema claro/oscuro y descarga selectiva de información en JSON/PDF. |
| Asistente | Aclarar términos, cifras, dudas y próximos pasos | Conversación con contexto de la parcela y la pantalla; explicaciones de Gemini, búsqueda pública cuando está disponible, documentos de apoyo y favoritos. |

## Cómo se utilizan los datos

En **Clima y cultivo**, el recorrido es: tiempo disponible ahora, próximos siete días, observaciones registradas, historia reciente y referencias adicionales. Los botones de las tarjetas y el título del gráfico abren el asistente con la pregunta correspondiente. «Registrar observación» abre el registro de campo; la última etapa se muestra con la fecha declarada y no se deduce de un número fijo de días desde la siembra.

El historial alterna lluvia y temperatura, con períodos de 30 días o doce meses completos de calendario. Puede consultarse también como tabla. Un día sin datos queda vacío: no se suma como cero, y no se publica un total semanal o mensual de lluvia si está incompleto. La diferencia lluvia menos ET₀ requiere días coincidentes y completos; no es una dosis de riego. Las estimaciones de agua en los primeros 10 cm se expresan como porcentaje del volumen, sin clasificar todas las texturas como secas u óptimas por el mismo límite.

La referencia de NOAA utiliza **RONI**, el índice empleado para el seguimiento oficial desde febrero de 2026. Se muestra el trimestre y su alcance regional; la aplicación no declara un episodio oficial ni convierte el índice en un riesgo para la parcela. Si falla una actualización de clima, se conserva la consulta anterior con sus fechas y se ofrece reintentar.

La tarjeta **El Niño y La Niña** presenta esa referencia del Pacífico, que suele influir en el clima de Ecuador, y la relaciona con la fecha de siembra declarada: si el cultivo está en campo, muestra la condición del Pacífico que rodea a esa siembra; si la siembra es futura, advierte que la fase puede haber cambiado para esa fecha y sugiere volver a consultar cerca de la siembra; si no hay fecha registrada, invita a completarla en Siembra; si el ciclo terminó, sirve para comparar con lo observado. La nota aclara siempre que el pronóstico de 7 días sigue siendo la guía de la parcela y que la referencia no pronostica la lluvia local.

| Clase | Ejemplos | Interpretación correcta |
|---|---|---|
| Declarados por el productor | Fecha real de siembra, riego, observación, peso cosechado | Se conservan con su contexto y fecha; el sistema no los verifica de forma independiente. |
| Referencias institucionales | INIAP, MAG/SIPA, INAMHI, INEC, Agrocalidad, FAO/IIASA, NOAA | Se conserva edición, periodo, territorio, unidad y fuente. No se trasladan automáticamente a una parcela. |
| Estimaciones por ubicación | Open-Meteo, SoilGrids | Son resultados de modelos o mapas. No sustituyen sensores o análisis de laboratorio en el lote. |
| Cálculos del sistema | Producción por área, balance descriptivo, presupuesto, fechas aproximadas | Debe indicarse qué entradas se utilizaron. Un dato ausente no se convierte en cero. |
| Resultados de IA | Predicción XGBoost y explicación del asistente | Se distinguen de una cosecha medida y de una afirmación institucional. La explicación generativa puede requerir comprobación. |

La referencia anual de lluvia no es la lluvia de toda una campaña. Temperatura de hoy, pronóstico y promedio de los últimos treinta días se presentan por separado. Una posibilidad de lluvia no es un porcentaje de riesgo de perder la cosecha.

El catálogo de maíz contiene catorce fichas identificadas. Se diferencian los usos documentados de grano, choclo y canguil. Una ficha de variedad no convierte automáticamente el modelo de grano seco en un modelo validado para otro producto.

El inventario detallado de fuentes y de los lugares del código que las utilizan está en [el documento Word](ZeaSys-referencias-datos-20261109.docx) y en [su inventario JSON](referencias-datos-sistema-20261109.json).

## Qué hace el asistente y cómo responde

El asistente combina cuatro elementos:

1. La pregunta y la conversación de la parcela.
2. Datos autorizados reconstruidos por el servidor: parcela, pantalla, simulación seleccionada y referencias disponibles.
3. Conocimiento general de Gemini y búsqueda pública cuando la consulta la necesita y el proveedor la permite.
4. Fragmentos documentales cuando se solicita una guía, manual, documento o fuente concreta del corpus.

La falta de una respuesta en los PDF no debe bloquear una explicación general. Si falta una medición propia, el asistente debe aclararlo, explicar lo que sí se sabe y proponer un siguiente paso útil. No debe fabricar el peso de una cosecha, un diagnóstico, una alerta vigente o una dosis para aparentar una respuesta completa.

Los enlaces web se muestran cuando el proveedor devuelve fuentes. Los documentos de apoyo se identifican con archivo y página. Las sugerencias de Google se presentan en un marco aislado, sin insertar HTML del proveedor dentro de la aplicación.

**Estado comprobado el 15/11/2026:** Gemini respondió a preguntas generales y a casos con datos faltantes. Google devolvió cuota excedida (HTTP 429) para solicitudes con búsqueda. En ese caso el asistente conserva la orientación general y no afirma haber verificado información actual en internet. Restablecer esa cuota depende de la cuenta del proveedor.

La conversación se conserva por cuenta, parcela, año y ámbito. El borrador de una simulación mantiene un ámbito propio. Los favoritos se guardan en la cuenta; limpiar la conversación elimina el historial visible correspondiente y reinicia su memoria.

## Componentes técnicos y conexiones

| Componente | Función | Ubicación principal |
|---|---|---|
| React, Vite y CSS | Pantallas, formularios, navegación, temas y visualizaciones | `frontend-app/src/` |
| API PHP | Autenticación, permisos, validación, datos de parcelas, simulaciones, exportaciones y contexto del asistente | `backend-api/src/` |
| MariaDB/MySQL de XAMPP | Persistencia de cuentas, parcelas, simulaciones y registros | Esquema en `database/schema-demo.sql`; migraciones en `database/migraciones/` |
| Motor Flask + XGBoost | Calcular el escenario y devolver sus resultados y trazabilidad | `ml-engine/` |
| Flowise | Conectar el modelo Gemini y la memoria del asistente | Lanzador `scripts/iniciar_flowise.bat` |
| Nodo Gemini de ZeaSys | Responder con Gemini y conservar metadatos de búsqueda; respaldo sin búsqueda si ésta falla | `flowise-nodes/ZeaSysGeminiSearch/` |
| Chroma | Búsqueda de fragmentos documentales por vectores | Configuración RAG del backend y herramientas de indexación |
| Ollama | Embeddings locales para recuperación documental | Herramientas e infraestructura del corpus RAG |
| Servicios públicos | Meteorología, suelo, lluvia histórica, catálogos y referencias regionales | Proveedores bajo `backend-api/src/Dominios/Terreno/` y referencias en `backend-api/data/referencias/` |

El chat no necesita pasar por el motor de simulación para responder. La API PHP reúne su contexto y llama a Flowise; éste utiliza Gemini. El motor Flask se consulta para las simulaciones y sus explicaciones asociadas.

## Ejecución y puertos locales

| Servicio | Dirección habitual |
|---|---|
| Aplicación web | `http://localhost/ZeaSys/` |
| Apache/XAMPP | Puerto 80 |
| MariaDB/MySQL | Puerto 3306 |
| Motor de simulación | `http://127.0.0.1:5000/` |
| Editor/API de Flowise | `http://127.0.0.1:3000/` |
| Chroma | Puerto 8000 |
| Ollama | Puerto 11434 |

El lanzador conjunto es `scripts/iniciar_sistemas.bat`. La instalación académica se explica en [REVISION_DOCENTES.md](REVISION_DOCENTES.md) y la instalación general en [GUIA_INSTALACION.md](GUIA_INSTALACION.md).

Las credenciales son propias del entorno que ejecuta el proyecto. No deben incluirse en una entrega. Tampoco debe distribuirse la base personal `database/agropredict_db.sql`, los archivos subidos por usuarios, sesiones o copias privadas de Flowise. La entrega de revisión utiliza un esquema y datos de prueba independientes.

## Organización de archivos y mantenimiento

- El código del frontend se modifica en `frontend-app/src/`. La raíz `assets/`, `index.html`, `images/` y `models/` contiene el resultado desplegado para XAMPP.
- `npm run build`, desde `frontend-app`, compila y sincroniza ese despliegue. Los archivos generados no se editan a mano.
- Las pruebas de navegador deben compilar su copia en `frontend-app/dist/` sin reemplazar el despliegue de XAMPP con una configuración de prueba.
- Los cambios de base se aplican mediante migraciones incrementales. No se reemplaza una base existente para actualizar una pantalla.
- Los documentos históricos de revisión conservan su fecha; esta guía y el inventario de fuentes reflejan el funcionamiento vigente.
- Las páginas internas usan la semántica de color compartida. La página pública mantiene su propia capa de componentes.
- Los estados de espera usan el componente unificado `PantallaCarga` (`frontend-app/src/components/PantallaCarga.jsx` con su capa en `frontend-app/src/assets/pantalla-carga.css`): brote de maíz animado, puntos en secuencia y esqueletos con brillo en los colores del tema, con soporte de movimiento reducido. Las cargas de vista completa emplean la variante `pantalla`.

## Qué se comprueba y qué requiere evidencia adicional

Se utilizan lint, compilación, pruebas unitarias de frontend/PHP/Python, recorridos HTTP con cuentas y base desechables, y pruebas de navegador en claro/oscuro y distintos tamaños. Las respuestas reales de Gemini se revisan aparte de las pruebas con proveedores simulados.

La precisión agrícola del modelo no puede darse por demostrada sólo porque el código funcione o sus métricas internas sean altas. Para contrastarla se requieren cosechas reales independientes, con fecha, área y producción. El CSV histórico de entrenamiento conserva una procedencia no acreditada completamente. Las fuentes oficiales añadidas como contexto no certifican por sí solas cada predicción.

Los límites de datos externos, sus cuotas y la falta de observaciones reales se deben comunicar con una orientación útil. No son motivo para rellenar gráficos o campos con cifras inventadas.

## Documentación relacionada

- [Arquitectura técnica](arquitectura.md)
- [Datos y proveedores](proveedores-datos.md)
- [Modelos de simulación](modelos_simulacion.md)
- [Variedades de maíz](variedades-maiz-ecuador.md)
- [Calendario y selector de parcelas](revision-calendario-selector-20261115.md)
- [Revisión de Clima y cultivo y del asistente](revision-clima-chatbot-20261115.md)
- [Revisión del corpus documental](chatbot-pdf-20261108.md)
- [Instalación y revisión académica](REVISION_DOCENTES.md)
