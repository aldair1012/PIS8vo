# Preparación y resultado de simulación

Actualización del 8 de noviembre de 2026. Interfaz React/Vite y CSS propio; no se agregó un framework de componentes.

## Recorrido aplicado

1. **Preparar escenario:** elegir parcela, revisar los datos precargados y usar «Modificar datos» para corregirlos. Las correcciones pertenecen al escenario y no editan la parcela registrada. Los campos sin referencia siempre se pueden completar. Una respuesta externa tardía no sustituye valores que ya se editaron.
2. **Agua y manejo:** el sistema de riego está en el formulario principal. «Solo lluvia» fija en cero el agua aplicada por riego. La lámina de riego no incluye lluvia. Fechas, duración y demás datos de campo se completan en un bloque opcional antes de calcular; las casillas vacías no equivalen a cero.
3. **Resultado:** una segunda pestaña presenta rendimiento, producción para el área efectivamente simulada, rango orientativo, observaciones y escenarios recibidos del motor. Permite modificar el escenario o abrir el análisis de la parcela. Editar un dato invalida el resultado anterior. El guardado se identifica solo si el servidor devuelve un ID.

La consulta de variedades se presenta como ayuda opcional para comprobar requisitos y uso de la semilla. No cambia automáticamente la variedad ni elige una semilla por el mayor rendimiento predicho. El cálculo sigue siendo de grano seco; no se presenta como producción comercial de choclo.

## Suelo por ubicación

El REST público de SoilGrids está pausado según [ISRIC](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html). Se usan sus [servicios cartográficos OGC](https://maps.isric.org/) con cinco consultas paralelas WMS GetFeatureInfo: arcilla, arena, limo, pH y carbono orgánico, medias de 0–5 cm, malla aproximada de 250 m. Se validan unidades, valores ausentes y consistencia de las fracciones. La materia orgánica es una aproximación a partir del carbono; se identifica como estimación.

La clasificación de textura sigue las 12 clases del [USDA Soil Survey Manual, capítulo 3](https://www.nrcs.usda.gov/sites/default/files/2022-09/SSM-ch3.pdf). La pantalla explica la clase cartográfica y su correspondencia con uno de los cinco grupos admitidos por el modelo. Las tres claves antiguas conservan su significado; se agregaron Franco y Arcillo limoso mediante nuevas claves. Si faltan fracciones válidas, no se asigna una textura arbitraria.

Al solicitar el uso del suelo de ubicación, PHP obtiene las fracciones de su propia caché y de las coordenadas de la parcela autenticada. El cliente no puede enviar libremente las fracciones como si fueran del proveedor. Flask valida el objeto, utiliza las fracciones reales suministradas y devuelve una confirmación. Un dato de campo declarado explícitamente prevalece sobre la estimación. Si el motor no reconoce el contrato, no se guarda una simulación que finja haber utilizado esos datos. Caché de terreno: versión 6. Motor: 2.4.0.

Una referencia cartográfica no es un análisis de laboratorio. Valores válidos fuera de la cobertura del entrenamiento siguen generando advertencias; no se reemplazan por valores «ideales».

## Provincia

Se resuelve por punto dentro del polígono de la provincia usando una copia local simplificada [INEC/HDX distribuida por geoBoundaries, ADM1 humanitarian](https://www.geoboundaries.org/api/current/gbHumanitarian/ECU/ADM1/), año 2018, licencia CC BY 3.0 IGO. El archivo conserva atribución, año y huella de origen. No se consulta un geocodificador en cada predicción.

Las coordenadas tienen prioridad sobre el texto. Se conserva el texto registrado por el productor. Cuando una provincia identificada no tiene una categoría entrenada, se distingue esa falta de cobertura de una provincia desconocida. El conjunto cartográfico es una referencia histórica simplificada, no un deslinde catastral actual.

## Números y trazabilidad

`0,83` pasa a `0.83`; `26,7` pasa a `26.7`. También se admiten formatos completos inequívocos como `3.500,25`. Una entrada ambigua como `3,500` se pide escribir como `3500` o `3.5`: no se convierte silenciosamente en una lluvia mil veces menor. La normalización ocurre al salir del campo y se vuelve a validar antes de enviar.

Los supuestos se calculan a partir del origen de cada variable. El riego declarado no sigue apareciendo entre los datos supuestos. El detalle contiene las entradas efectivas, su origen y las advertencias; no se inventan nuevas cifras de resultados ni una precisión individual. R² permanece bajo el detalle técnico.

## Verificación

- Lint, 36 pruebas de utilidades frontend, tipado piloto y build con copia a XAMPP: correctos.
- Conjunto PHP y 62 pruebas Python del motor: correctos; se agregaron 24 comprobaciones de terreno y casos para contrato y propagación real del suelo.
- Integración HTTP: 19 recorridos con MySQL desechable y XGBoost real. Incluye una ubicación cuyo texto no menciona la provincia y fracciones de suelo suministradas desde una caché aislada.
- Navegador: 18 pruebas de portada, variedades y simulación en ambos temas y móvil/tableta/escritorio. Otras tres pruebas contra PHP/MySQL reales verificaron simulación guardada, descarga JSON con más de 100 registros y edición de registro de campo.
- Inspección visual de preparación móvil clara y resultado de escritorio oscuro. Datos de las capturas y fixtures exclusivamente ficticios.
- Salud del motor local: `2.4.0`, estado `ok`.

Estas pruebas verifican conexiones y comportamiento. No demuestran precisión agrícola con cosechas independientes ni constituyen una instalación comprobada en otro equipo.
