# Bloque 7: datos oficiales, disponibilidad y XGBoost

Se aplicó `ml-pipeline` con validación previa, separación de investigación y producción, semilla fija y registro de parámetros, versiones, métricas y huellas. Docker continúa fuera del alcance por decisión del propietario.

## Ensayo oficial nuevo

Se verificó el SHA-256 de la copia de maíz seleccionada de [INEC ESPAC 2025](https://www.ecuadorencifras.gob.ec/documentos/web-inec/Estadisticas_agropecuarias/espac/2025/2_DD_DATOS_ABIERTOS_ESPAC_2025.zip). El diccionario declara 115 variables y `ct_prod` en toneladas métricas. Su metadato identifica ESPAC III cuatrimestre 2025; el límite de año 25–26 del diccionario no coincide con códigos 24–25 de la descarga. Se documentó esa discrepancia; no se utilizó el año como predictor ni se inventaron fechas diarias.

De 4.976 registros de maíz se conservaron 2.787 para el ensayo: 2.060 de duro seco y 727 de suave seco, 756 segmentos de muestreo y 23 provincias. Se excluyeron productos choclo, asociaciones, estado diferente de grano seco, ocho pesos de expansión nulos y dos registros de zona no delimitada. No se rellenaron datos ausentes ni se fabricaron dosis, variedades o clima. El objetivo es producción declarada en toneladas dividida por área cosechada, sin corrección adicional de humedad. El análisis no estima pérdida total de un cultivo sin área cosechada.

Se usaron seis entradas: provincia, grupo duro/suave, clase de semilla, seno y coseno del mes de siembra y área sembrada. No son las 36 entradas del modelo activo. Se compararon dos configuraciones de XGBoost con una mediana ponderada por tipo de maíz. Las categorías se ajustaron únicamente con entrenamiento. Cuatro particiones por segmento y otras cuatro por provincia mantienen grupos separados. Factores de expansión se usaron como pesos; no se calcularon intervalos del diseño muestral.

| Evaluación | RMSE referencia t/ha | RMSE XGBoost 0 | RMSE XGBoost 1 |
| --- | ---: | ---: | ---: |
| Segmentos separados | 1,9352 | 1,7667 | 1,7587 |
| Provincias no vistas | 2,0036 | 1,8953 | 1,9171 |

El ensayo y los parámetros completos están en [evaluacion-espac2025-20261108.json](evaluacion-espac2025-20261108.json). Predicciones de cada partición, líneas de origen, grupos y huellas quedan en `ml-engine/experimentos/espac2025-*/`. La comparación no establece superioridad frente al modelo activo: cambian los datos, etiquetas y entradas. No se publicó un reemplazo.

## Conexión con la aplicación

- Ficha de evidencia ligada a SHA-256 de los cuatro artefactos activos. Cambiar un artefacto sin actualizar la ficha se identifica como ficha desactualizada.
- Registro de disponibilidad para las 36 variables: ubicación/mediciones previas, manejo planeado, clima del ciclo como escenario y seis observaciones o manejos de etapas posteriores.
- La respuesta identifica qué variables posteriores se completaron con referencias, sin presentarlas como observaciones del futuro. Conserva la advertencia de procedencia no acreditada del CSV original y la falta de validación con cosechas independientes.
- El contexto del chatbot distingue puntaje de clasificación de precisión agrícola e incorpora la evidencia del modelo cuando existe en la instantánea.
- Motor 2.5.0; el algoritmo y los artefactos del predictor activo se conservan. Las mejoras de contrato y evidencia no se presentan como una mejora ya demostrada de exactitud.

64 pruebas Python correctas. El nuevo ensayo termina sin modificar el CSV ni los modelos activos.

## Lo que requiere evidencia adicional

La procedencia del CSV original sigue sin resolverse. ESPAC proporciona observaciones oficiales documentadas, pero no incluye todas las entradas de la parcela ni nombres comerciales de variedades. Falta un conjunto independiente compatible por campaña, producto de cosecha, ubicación y manejo. Vincular clima provincial o un perfil de suelo cercano no los convierte en mediciones de cada parcela. Canguil continúa sin predicción específica respaldada. Los controles de publicación no se deshabilitaron para sustituir el modelo.
