# Bloque 1: documentos y chatbot

Se aplicó la skill `rag-architect`. Se conservan los cinco PDF originales y las colecciones anteriores para comparar y recuperar versiones.

## Correcciones aplicadas

- Se extrajeron las 258 páginas. El control de calidad ahora detecta caracteres de control y fuentes mal codificadas además de texto escaso. Se aplicó OCR a 84 páginas, incluidas las ocho del MAG cuyo texto nativo contenía caracteres ilegibles.
- Se cotejaron visualmente 15 páginas críticas de los cinco documentos y se registraron 17 extractos con archivo, página PDF, año y SHA-256. En páginas cotejadas se utilizan los extractos revisados en lugar de su OCR contradictorio. Ejemplo: en el manual de 2007, `100C/200C` corresponde visualmente a `10 °C/20 °C`; la germinación indica `15 °C a 20 °C`.
- Fragmentos de aproximadamente 650 caracteres y solapamiento de 90, sin mezclar páginas. Los extractos revisados de una misma página se reúnen cuando caben completos: una tabla no queda separada de su explicación.
- Índice nuevo: 616 fragmentos y embeddings locales `embeddinggemma:300m`, dimensión 768. Se probó el modelo anterior sobre fragmentos completos, pero rechazó un lote por exceder su contexto; no se habilitó truncamiento silencioso.
- Recuperación híbrida: BM25 sobre todo el corpus permitido, búsqueda vectorial, fusión de rankings y reordenamiento por cobertura y cotejo. Filtros por fuente explícita y regiones; las comparaciones conservan ambas regiones. Si falla la búsqueda vectorial, queda la recuperación local por palabras.
- Se ampliaron los presupuestos de contexto de forma acotada, se conserva JSON completo y se retiran reglas contradictorias sobre citas. Se validan páginas existentes, se identifica la página PDF y se distinguen extractos cotejados, OCR y año de la fuente.
- El flujo principal conserva el modelo generador y sus credenciales; el almacén del flujo documental auxiliar apunta al índice nuevo. SQLite y configuraciones anteriores se copiaron a una ubicación privada antes de activar.
- Se retiró el valor fijo de confianza `1.0`: no existía una probabilidad calibrada por respuesta. La API incluye metadatos de referencias consultadas, que no se presentan como prueba de que el modelo haya utilizado todas.

## Evaluación

24 preguntas con páginas y hechos de referencia cotejados; 18 de desarrollo y seis de validación. Resultados reproducibles en [evaluacion-rag-20261108.json](evaluacion-rag-20261108.json).

| Medida sobre esta muestra | Anterior | Nuevo |
| --- | ---: | ---: |
| Página esperada en primer lugar | 12,5 % | 95,83 % |
| Página esperada entre tres resultados | 29,17 % | 100 % |
| MRR@3 | 0,2014 | 0,9792 |
| NDCG@3 | 0,2247 | 0,9846 |
| Hechos anotados presentes en el contexto | 30,56 % | 100 % |

Se probaron 27 respuestas reales del flujo: 24 preguntas y tres límites (cosecha sin datos, dosis actual a partir de guía histórica y precio actual ausente). No hubo errores HTTP; mediana 1,725 s, máximo 8,704 s. Se cotejaron cifras, unidades y citas. Se corrigió un fallo encontrado en la prueba: el primer envío de ESPAC omitía la tabla nacional al seleccionar otro extracto de la misma página. Se retiraron 70 mensajes de las sesiones ficticias de evaluación, sin borrar conversaciones personales.

40 comprobaciones PHP de chat y diez pruebas Python de herramientas correctas. Incluyen metadatos, páginas inválidas, fuentes, dimensiones, filtros, contexto de cifras y degradación hacia el flujo anterior simulado.

## Reproducción

La extracción requiere `pypdf`, `pypdfium2` y OCR de Windows; el índice de un corpus ya preparado usa únicamente Python estándar, Chroma y Ollama:

```powershell
ollama pull embeddinggemma:300m
python tools/indexar_corpus_rag.py backend-api/data/referencias/rag-corpus.json --model embeddinggemma:300m --salida indice-candidato.json
python tools/evaluar_recuperacion_rag.py --indice indice-candidato.json --corpus backend-api/data/referencias/rag-corpus.json --hibrida --salida evaluacion-candidato.json
```

La activación comprueba el corpus, modelo, dimensión, colección, recuento y evaluación antes de cambiar la configuración. No se activa una indexación parcial.

## Límites

No se cotejaron visualmente todas las cifras de las 258 páginas. El modelo generador puede interpretar o redactar mal una referencia; las pruebas no garantizan toda respuesta futura. La ausencia en fragmentos recuperados no demuestra ausencia en el documento completo. La evaluación cambia extracción, fragmentación, embeddings y ranking, por lo que no atribuye la mejora a un solo componente. Las cifras nacionales y guías históricas no se convierten en mediciones de parcela, normas vigentes ni precisión del predictor.
