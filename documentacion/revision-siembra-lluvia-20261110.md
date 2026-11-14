# Siembra y lluvia anual por ubicación

Revisión del 10 de noviembre de 2026. Cambios aplicados al código y a la compilación servida por XAMPP.

## Las ocho mejoras de Siembra

| Prioridad | Cambio | Resultado |
| --- | --- | --- |
| Alta | Resumen de campaña y edición permanente | «Mi campaña» reúne fecha, variedad, duración, fin orientativo y riego. Se puede editar aunque ya existan fechas. |
| Alta | Calendario propio como vista inicial | «Mi cultivo» se abre cuando existen fechas de la parcela; la referencia de catálogo queda como alternativa. El año de ejecución no reemplaza el año de la campaña. |
| Alta | Fecha prevista y fecha real declarada | Se guarda la clasificación explícita del productor. Las fechas antiguas sin clasificación conservan ese desconocimiento. No se admite declarar como realizada una siembra futura. |
| Media | Historial unificado | «Simulaciones de esta parcela» sustituye el ranking duplicado. Permite ordenar por fecha o rendimiento y explicar cada ejecución con clic o teclado. |
| Media | Estadísticas secundarias | Media, mediana, variación y percentiles quedan en «Análisis avanzado». El número de ejecuciones permanece visible. |
| Media | Ausencia de catálogo clara | Los meses sin ficha dicen «Sin referencia». No se equipara ausencia de referencia con riesgo del cultivo. |
| Baja | Una sola indicación de explicación | Se conserva un mensaje común y las superficies interactivas. Los controles y filtros siguen actuando por separado. |
| Baja | Distribución adaptable | Resumen y formulario usan columnas adaptables; los paneles respetan el contenido. Se revisaron 390, 944 y 1440 px en ambos temas. |

Los nuevos datos de planificación se conservan en `parcelas.tipo_fecha_siembra`, `ciclo_dias` y `riego_tipo`. La migración es aditiva e idempotente. En el equipo de desarrollo se conservaron las 25 parcelas y se generó un respaldo privado previo. Las otras bases de XAMPP no se modificaron. Una instalación nueva usa el esquema de demostración actualizado.

## Lluvia anual automática

El proveedor común es `backend-api/src/Dominios/Terreno/Infraestructura/ProveedorLluviaAnual.php`.

1. Usa las coordenadas de la parcela. Sin GPS puede consultar el centro de una localidad ecuatoriana mediante Open-Meteo Geocoding / GeoNames. Exige coincidencia exacta y única, admite el filtro provincial y etiqueta el resultado como aproximado.
2. Busca la estación INAMHI más cercana dentro de 100 km con al menos ocho años de doce meses reportados. Promedia los totales de esos años completos, dentro de 2000–2019. Un mes ausente no se convierte en cero.
3. Sin una estación con esa cobertura, consulta Open-Meteo Historical / ERA5 para 1991–2020. Requiere los treinta años completos, con todos sus días y unidades en milímetros. No mezcla modelos ni publica un promedio parcial como si tuviera cobertura completa.
4. Conserva valor, unidad, período, fuente, cobertura, distancia de estación o resolución de malla y momento de consulta. Usa caché por ubicación y reintento breve para indisponibilidad.

Se eliminó la anualización de treinta días multiplicados por doce y su recorte artificial a 200–3500 mm. Los treinta días recientes permanecen separados y se informa su intervalo disponible; el archivo reciente usa un margen de publicación de siete días.

La referencia está conectada a los valores de ubicación, el formulario de simulación, Rendimiento, Clima y el contexto del asistente. Las nuevas ejecuciones guardan una copia en `_zeasys_modelo.lluvia_anual_referencia`, que también viaja en el historial JSON. El comparador distingue esa copia de la referencia actual consultada para una ejecución antigua.

**La lluvia anual de referencia no sustituye la lluvia del ciclo ingresada al modelo.** Tampoco es un pronóstico de la campaña ni demuestra la precisión agrícola del modelo. No se reescribieron entradas ni resultados históricos y no se incorporaron datos ficticios a las cuentas.

## Procedencia comprobada

La copia local INAMHI contiene 5.768 filas. Se verificó que todas son filas sin modificación del archivo oficial descargado, filtradas a 2000–2019. Se corrigió la lectura del encabezado `anio`, antes esperado como `año`.

- Copia local SHA-256: `f3ccb2c1b18f20d2add3b0274d910cc125cf1bab66a476e15ef5178ae580356f`.
- Descarga oficial SHA-256: `1a7740828032630f26eec7e0e68443b50cc5ede06cd7a2164856bf442c0526fd`.
- [Recurso INAMHI del portal de datos abiertos](https://www.datosabiertos.gob.ec/dataset/eaa8894f-68d1-4a15-80f8-1a6f528f946c/resource/98c77d18-e863-4e00-8a22-eb47f2981d9c).
- [Documentación de Open-Meteo Historical / ERA5](https://open-meteo.com/en/docs/historical-weather-api).
- [Documentación de Open-Meteo Geocoding / GeoNames](https://open-meteo.com/en/docs/geocoding-api).

La prueba real de Portoviejo seleccionó PORTOVIEJO-UTM, con 18 años completos y 537,4 mm/año de promedio. Es una prueba de integración con coordenadas públicas, no un resultado añadido a una parcela del usuario. También se comprobó la consulta por nombre de ciudad y un respaldo ERA5 con los treinta años completos. ERA5-Land devolvió precipitación vacía en la prueba inicial; por eso el respaldo configurado es ERA5.

El Word existente de referencias, `documentacion/ZeaSys-referencias-datos-20261109.docx`, conserva su nombre para mantener los enlaces de entrega y tiene revisión interna del 10 de noviembre. Ahora documenta 30 fuentes, sus campos y usos, los cinco PDF y las 14 fichas del catálogo.

## Verificación

- Frontend: `npm run lint`, 48 pruebas unitarias y `npm run build`, con copia final a XAMPP.
- Navegador: 22 casos de Siembra, 7 de planificación, 8 de lluvia y revisión visual, 12 de Rendimiento y 9 de explicaciones. Los fallos de selectores de pruebas antiguas se adaptaron a la interfaz aprobada y se repitieron los casos afectados.
- Revisión sobre la compilación de XAMPP: 96 aperturas de explicación entre ambas pestañas, tres anchuras y dos temas; sin errores JavaScript, desbordamientos del panel ni infracciones de accesibilidad detectadas por la auditoría ejecutada. Los 96 contextos también pasaron el intérprete PHP.
- Backend: planificación 12, lluvia anual 18, validación 143, terreno 24, simulaciones 6, analítica 10, clima/escenarios 21, finanzas 16, explicaciones 212 y chat 47; todas aprobadas.
- Integración: 24 recorridos HTTP con MariaDB desechable y motor real, incluida persistencia de planificación y referencia anual. La base ficticia se eliminó al terminar.
- El Word se generó y se convirtió a PDF para revisar su composición.

El build conserva un aviso de tamaño del paquete de Rendimiento, superior a 500 kB antes de gzip. No bloquea la compilación; no se ocultó ajustando el umbral. Estas comprobaciones cubren los flujos revisados y no equivalen a una garantía de ausencia absoluta de errores.

Para comprobar otra ubicación sin modificar cuentas: `php tools/verificar_lluvia_anual.php LATITUD LONGITUD`.
