# Consulta documental de los cinco PDF

El asistente conserva su flujo principal con Gemini, memoria y datos autorizados de la parcela. Antes de responder, el backend envía una consulta corta a un segundo flujo de Flowise, **ZeaSys — Consulta documental PDF**. Ese flujo conecta Gemini, memoria, `Document Store (Vector)` y `Conversational Retrieval QA Chain`. El almacén consulta la colección Chroma `zeasys_cinco_pdf_v1` mediante embeddings locales `all-minilm` de Ollama. El backend incorpora hasta tres fragmentos recuperados, con archivo y página, al contexto del flujo principal; no usa la respuesta generada por el flujo auxiliar como evidencia.

Los documentos aportan referencias generales. No son mediciones de la parcela ni sustituyen las simulaciones o el contexto actual. Las fechas y la zona de aplicación de cada guía deben respetarse, y las dosis requieren análisis de suelo y validación técnica local. Las páginas escaneadas se procesaron con OCR de Windows: el resultado puede contener errores, en particular en tablas, números y unidades. La página identificada es la página física del PDF, que puede diferir de la numeración impresa.

## Corpus local y cobertura de la indexación inicial

| Archivo | Páginas con texto recuperado | Total de páginas |
| --- | ---: | ---: |
| `inec-espac-resultados-2025.pdf` | 52 | 52 |
| `iniap-guia-maiz-amarillo-litoral-2014.pdf` | 26 | 26 |
| `iniap-guia-produccion-maiz-sierra-2021.pdf` | 148 | 149 |
| `iniap-manual-produccion-maiz-2007.pdf` | 23 | 23 |
| `mag-guia-productores-maiz-amarillo-2026.pdf` | 8 | 8 |

La colección inicial tiene 1.755 fragmentos de hasta aproximadamente 200 caracteres, con solapamiento. La cobertura indica que se recuperó algún texto, no que cada tabla, imagen o página haya sido transcrita perfectamente. Los PDF originales permanecen en `rag-sources/`; sus procedencias se describen en `rag-sources/SOURCES.md`.

## Funcionamiento y límites

- El flujo principal consulta el flujo documental con un máximo de 200 caracteres de la pregunta, sin enviar a embeddings todo el contexto del dashboard. Esto evita exceder la ventana pequeña de `all-minilm`.
- El flujo documental tiene su propia sesión, separada de la conversación principal; sus nodos se pueden inspeccionar en Flowise. Su ID es `168a813e-e9ad-5d20-90b8-537fd98825f8`, configurable mediante `ZEASYS_FLOWISE_DOCUMENTAL_ID`.
- El servidor acepta solo fuentes de la lista de los cinco PDF, páginas positivas y texto no vacío. La respuesta puede señalar el documento y la página cuando corresponda o el usuario pida la fuente.
- Si Flowise, Chroma, Ollama o el flujo documental fallan o no responden dentro de 20 segundos, el chat principal continúa sin referencias documentales. Si faltan datos, el asistente debe indicarlo.
- Esta arquitectura ejecuta una consulta documental adicional que incluye una generación del modelo; puede aumentar el tiempo y el consumo respecto al chat sin recuperación.
- La lista de documentos y las etiquetas de fuente son locales; no se garantiza que la búsqueda encuentre siempre el fragmento más relevante ni que OCR preserve cada cifra. Para decisiones o citas importantes hay que revisar el PDF original.

## Preparación y recuperación

Requisitos: Flowise, Chroma y Ollama activos; modelo `all-minilm`; cinco PDF en `rag-sources/`; Python con `pypdf` y `pypdfium2`; Windows PowerShell 5 con un idioma OCR instalado. En el equipo de desarrollo puede usarse el Python del runtime de Codex:

```powershell
& 'C:\Users\aldai\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' tools\indexar_cinco_pdf.py
python tools\crear_flujo_documental.py
```

La primera herramienta no borra la colección previa y usa IDs estables para los fragmentos sin cambios. Si se modifica un PDF, los fragmentos antiguos de esta colección no se retiran automáticamente; hay que preparar una colección nueva y actualizar la configuración después de validarla. La segunda herramienta conserva el flujo principal, crea un almacén y un flujo auxiliar separados y hace un respaldo SQLite antes de escribir. Si el flujo auxiliar ya existe, se detiene sin sobrescribirlo.

## Verificación efectuada

Se confirmó que los cinco archivos tienen fragmentos en la nueva colección. Una pregunta enviada al flujo documental devolvió cinco documentos con metadatos de archivo y página; una pregunta enviada mediante `GeminiFlowise::responder` utilizó la guía de INIAP sobre producción de maíz en la Sierra e indicó páginas del archivo. La suite PHP del chat incluye una regresión de validación de fuentes y metadatos. Esta comprobación no evalúa exhaustivamente la exactitud agronómica ni el rendimiento de búsqueda para todas las preguntas.
