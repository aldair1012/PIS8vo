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

`python ml-engine/scripts/evaluar_cosechas_verificadas.py archivo.csv` calcula error absoluto medio, error cuadrático medio y sesgo por provincia/año y por versión. Requiere las columnas `parcela_id,provincia,fecha_prediccion,fecha_cosecha,modelo_version,fuente_observacion,prediccion_t_ha,cosecha_t_ha`. Las predicciones deben ser las guardadas antes de conocer la cosecha, en t/ha y con la misma base de humedad que la medición. Una fecha igual solo indica orden no verificable dentro de ese día. La fuente debe permitir auditar la observación; el programa no verifica por sí solo que el origen sea auténtico.

El informe indica el número de observaciones: una muestra pequeña o no representativa no valida el modelo. Rechaza duplicados de parcela y fecha, fechas de predicción posteriores a la cosecha, valores negativos y números no finitos. La herramienta no modifica el modelo ni publica resultados en la aplicación. No se incluyen datos de ejemplo como si fueran datos reales.
