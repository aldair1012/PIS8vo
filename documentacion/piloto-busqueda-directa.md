# Piloto de recuperación directa de documentos

El backend utiliza por defecto recuperación directa e intenta recuperar documentos de la colección `zeasys_cinco_pdf_v1` mediante Chroma y embeddings locales Ollama `all-minilm`. La respuesta principal sigue siendo generada por el flujo principal de Flowise. El piloto no modifica ni borra el flujo documental ni la colección.

Pruebas con respuestas simuladas comprueban la ruta directa, el retorno al flujo anterior ante fallo y la desactivación mediante configuración. La búsqueda directa tiene un presupuesto total de ocho segundos. Ante fallo de conexión, colección ausente, vector o respuesta inválidos, se recurre al flujo documental anterior. Una respuesta vacía válida no inventa documentos. Los documentos se filtran por lista permitida, página y texto, y la regla regional existente permanece activa. Los servicios se consultan exclusivamente en localhost.

En la máquina local se compararon 15 preguntas sin filtro regional previo: los tres fragmentos (archivo, página y texto) coincidieron en 15/15 y la mediana observada fue de 0,641 s para la ruta directa y 2,219 s para el flujo auxiliar. Son mediciones de una muestra pequeña, con servicios calientes; no son garantías ni demuestran pertinencia agronómica. En cuatro preguntas adicionales se contrastó la implementación PHP con Flowise y coincidieron las tres referencias. En consultas regionales pueden cambiar los resultados si los primeros fragmentos se excluyen por la regla regional.

Para repetir la comparación de referencias y tiempos:

```powershell
python tools/comparar_recuperacion_documental.py tools/preguntas_comparacion_15.json --sin-filtro-regional
```

Requiere Chroma, Ollama y Flowise activos y usa el proveedor configurado en el flujo documental, lo que puede consumir cuota. La variable debe configurarse en el entorno del proceso PHP/Apache, no solo en una consola que no herede el servidor. Definirla con valor `0` desactiva la búsqueda directa y devuelve la consulta al flujo anterior. Sin definirla o con valor `1`, usa la ruta directa. No se recomienda retirar el flujo anterior hasta evaluar cobertura más amplia, pertinencia, fuentes con OCR y recuperación ante fallos en el entorno real.
