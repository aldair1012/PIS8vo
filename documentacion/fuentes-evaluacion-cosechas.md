# Fuentes para evaluar rendimiento de maíz

Revisión: 5 de noviembre de 2026. Las fuentes siguientes son candidatas para obtener evidencia; su publicación no valida por sí sola el modelo ni demuestra que sus observaciones puedan vincularse a parcelas del usuario.

| Fuente | Qué ofrece | Límite antes de utilizarla |
| --- | --- | --- |
| [INEC: ESPAC 2025, presentación oficial](https://www.ecuadorencifras.gob.ec/documentos/web-inec/Estadisticas_agropecuarias/espac/2025/Presentacion_de_resultados_ESPAC_2025.pdf) | Producción, superficie y rendimientos publicados para maíz duro seco. | Son cifras agregadas de encuesta. No son cosechas de las parcelas de ZeaSys ni un conjunto automáticamente adecuado para validar cada predicción. |
| [INEC: bases ESPAC](https://www.ecuadorencifras.gob.ec/encuesta-de-superficie-y-produccion-agropecuaria-continua-bbd/) | Acceso a bases oficiales históricas. | Revisar documentación, variables, cobertura, diseño muestral, unidades, tratamiento de privacidad y condiciones de uso antes de importar. |
| [INEC: guía de uso ESPAC 2024](https://www.ecuadorencifras.gob.ec/documentos/web-inec/Estadisticas_agropecuarias/espac/2024/Guia_de_usos_de_bases_de_datos_ESPAC_2024_rev.pdf) | Guía para interpretar bases de la encuesta. | Debe usarse con la edición correspondiente y no garantiza que existan todas las entradas que requiere XGBoost. |
| [MAG: estadísticas productivas SIPA](https://sipa.agricultura.gob.ec/index.php/sipa-estadisticas/estadisticas-descargas/estadisticas-productivas) | Estadísticas provinciales de superficie, producción y rendimiento. | Referencia territorial agregada; no sustituye observaciones de parcelas ni debe tratarse como etiqueta de una simulación individual. |
| [INIAP: ensayos de maíz de altura 1983–1984](https://repositorio.iniap.gob.ec/items/7d5c69fc-6f2f-42c5-a441-d0fd698584b4) | Ensayos a nivel de finca en seis provincias. | Datos antiguos y condiciones particulares; verificar tablas originales, derechos y compatibilidad antes de extraer valores. |

## Evaluación sin reentrenar

`python ml-engine/scripts/evaluar_cosechas_verificadas.py archivo.csv` calcula error absoluto medio, error cuadrático medio y sesgo por provincia/año y por versión. El formato original usa las columnas `parcela_id,provincia,fecha_prediccion,fecha_cosecha,modelo_version,fuente_observacion,prediccion_t_ha,cosecha_t_ha`. Las predicciones deben ser las guardadas antes de conocer la cosecha, en t/ha y con la misma base de humedad que la medición. Una fecha igual solo indica orden no verificable dentro de ese día. La fuente debe permitir auditar la observación; el programa no verifica por sí solo que el origen sea auténtico.

El informe indica el número de observaciones: una muestra pequeña o no representativa no valida el modelo. Rechaza duplicados de parcela y fecha, fechas de predicción posteriores a la cosecha, valores negativos y números no finitos. La herramienta no modifica el modelo ni publica resultados en la aplicación. No se incluyen datos de ejemplo como si fueran datos reales.

Si la predicción guardada incluye un intervalo, añade las columnas opcionales `rango_min_t_ha` y `rango_max_t_ha`. El informe cuenta las cosechas dentro de sus límites inclusivos y divide por las filas con ambos extremos disponibles. Las filas sin rango siguen contando para MAE, RMSE y sesgo. Se indica cuántas predicciones comparten día con la cosecha para comprobarlas contra la hora de registro original.

Para el piloto, registra antes de cosechar la ejecución, su fecha, versión, predicción e intervalo. Después anota la superficie **efectivamente cosechada**, el peso del grano seco, la base de humedad y una referencia al comprobante. Calcula t/ha como kilos de grano divididos por 1 000 y por hectáreas cosechadas. La biomasa de una muestra que se usa para el índice de cosecha requiere su propia superficie para calcular rendimiento. Usa identificadores seudónimos y selecciona las parcelas antes de conocer el resultado para incluir también pérdidas y rendimientos bajos.

En **Rendimiento → Registro de campo**, la ficha CSV de la simulación seleccionada conserva identificador, fecha, versión, predicción y límites disponibles. Completa provincia si falta, fecha de cosecha, `produccion_seca_kg`, `area_cosechada_ha`, base de humedad y `fuente_observacion`. El evaluador acepta peso y área como alternativa a `cosecha_t_ha`. Una fila debe tener una sola forma de expresar el rendimiento. Reúne las fichas con una sola cabecera y conserva los comprobantes por separado. Los registros anteriores que carecen de versión no ofrecen ficha desde la aplicación.

## Registro en ZeaSys

En **Rendimiento → Memoria de campañas**, registra una cosecha consolidada por parcela y fecha de siembra. Introduce el peso total del grano, las hectáreas efectivamente cosechadas, el porcentaje de humedad al que se expresa el peso y la referencia del pesaje y del área. Una cosecha de cero kg en superficie positiva cuenta como pérdida observada. La producción de una muestra aislada de biomasa sólo sirve para el registro de índice de cosecha.

El formulario ofrece las ejecuciones cargadas de la misma siembra con versión y fecha de ejecución anterior al día de cosecha. El servidor recupera y archiva el resultado original. Selecciona la ejecución prevista para el contraste antes de conocer el resultado. Marca la comparabilidad únicamente si puedes confirmar superficie y base de humedad con tus registros. Las métricas descriptivas por versión cuentan esos pares. La cobertura usa únicamente los pares con ambos extremos del intervalo archivado. También se pueden conservar cosechas sin predicción u observaciones fechadas con NDVI medido, fuente y foto o audio privado.

Las bandas personales suman a la predicción seleccionada los residuos de campañas anteriores de la misma parcela y versión. La cosecha y su registro en el sistema deben preceder a la predicción. Se usan estadísticas de orden bilaterales y se muestra el número de pares disponibles. La banda nominal del 50 % requiere al menos tres pares y la del 90 %, diecinueve. La cobertura futura depende de la comparabilidad de campañas. Ninguna de estas operaciones entrena ni publica pesos.

En **Mis parcelas → Acompañamiento técnico** el titular puede dar acceso de lectura a una cuenta existente por correo. El permiso comparte un resumen de la campaña y su motivo de seguimiento. El CSV se genera con los accesos vigentes en cada descarga. La revocación retira las lecturas posteriores, y las copias que el destinatario ya descargó quedan en su dispositivo.

Para bases existentes que ya usan la tabla `parcelas`, las migraciones aditivas son `database/migraciones/20261120_campanas_parcela.sql` y `database/migraciones/20261120_acompanamiento.sql`. El esquema vacío para instalaciones nuevas ya incluye las tres tablas.
