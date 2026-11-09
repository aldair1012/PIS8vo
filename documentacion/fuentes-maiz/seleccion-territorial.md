# Selección de referencias cercanas a la parcela

Requisito confirmado por el usuario: utilizar la ubicación de la parcela para localizar registros cercanos y mejorar el contexto de la simulación. Este documento diferencia el comportamiento ya corregido de la integración territorial que todavía requiere datos y validación.

## Regla de producto

La provincia organiza la búsqueda y permite referencias generales cuando no hay coordenadas. Para localizar una estación o muestra cercana se necesita la ubicación de la parcela. Si solo se conoce la provincia, mostrar una referencia provincial y su escala, sin inventar la distancia a la parcela.

Cada variable necesita su propia selección: una estación para clima, un perfil o celda cartográfica para suelo y observaciones compatibles para contraste de cosecha. No existe obligación de que el mismo registro sea la mejor fuente para todo.

| Paso | Comportamiento requerido |
| --- | --- |
| Ubicar | Usar coordenadas válidas del punto o del polígono de la parcela y conservar su procedencia. |
| Filtrar por significado | Igual variable, unidad, producto y profundidad cuando corresponda. Una muestra de suelo no es una cosecha. |
| Filtrar por tiempo | Una observación del ciclo necesita fechas coincidentes. Un histórico se identifica como histórico, y un pronóstico como pronóstico. |
| Comprobar cobertura | Meses o días informados, periodo disponible, valores ausentes y calidad de las mediciones. |
| Comparar territorio | Distancia, altitud y relieve. La provincia no debe ocultar una estación pertinente al otro lado de un límite administrativo. |
| Elegir o abstenerse | Seleccionar una referencia compatible o indicar que falta información local. No asignar automáticamente una lejana para completar una tarjeta. |
| Explicar | Mostrar fuente, estación o perfil, distancia, periodo, cobertura y si el dato es medido, cartografiado o supuesto. |

La cercanía aumenta la pertinencia espacial, pero no prueba la precisión del rendimiento predicho. Su efecto se debe evaluar frente a cosechas observadas.

## Qué quedó corregido en el motor actual

`ml-engine/src/inamhi_climate.py` ya busca la estación más cercana **con lluvia y temperatura disponibles en al menos un mismo año**, dentro de un radio operativo predeterminado de 100 km. El radio es configurable en el método y no constituye un umbral científico de representatividad. Si no existe referencia compatible, devuelve ausencia. También admite filtrar años: no devuelve registros de 2019 para una consulta restringida a 2025.

La respuesta incluye distancia, criterio y radio de búsqueda. Las estadísticas incluyen años disponibles, cantidad de años completos y cobertura mensual. Se corrigieron dos problemas: los meses sin dato se conservan como ausentes, y los totales o medias anuales requieren los doce meses. Una desviación con una única observación permanece ausente, sin fabricar variabilidad cero.

El constructor de entradas advierte que INAMHI es contexto histórico de una estación, no medición del lote ni clima observado del ciclo actual. Estos datos no reemplazan silenciosamente el escenario introducido por el productor. Los campos previos de año de mayor/menor precipitación se conservan por compatibilidad y no identifican el mejor/peor año agrícola.

Nueve pruebas comprueban selección por disponibilidad, distancia máxima, años compatibles, coordenadas inválidas, conservación del cero real, meses ausentes, años incompletos y JSON sin NaN.

## Qué sigue pendiente

- El selector actual no comprueba similitud de altitud o relieve. No debe usar la altitud predeterminada de la aplicación como si fuera una medición fiable. Hace falta obtener la elevación de la parcela con procedencia documentada y fijar criterios validados.
- La selección conjunta actual exige ambas variables de una estación para conservar el contrato existente. Una futura selección independiente puede ofrecer lluvia de una estación y temperatura de otra, indicando sus distancias y periodos por separado.
- INAMHI local termina en 2019. Para campañas actuales hacen falta series recientes o proveedores de datos estimados identificados. El tiempo observado al final de una cosecha futura todavía no se conoce.
- Se descargaron archivos completos históricos del INAMHI para investigación, pero las copias operativas 2000–2019 se conservaron. Migrar datos exige comprobar cambios de cobertura y de resultados.
- Incorporar perfiles o rásteres oficiales de suelo requiere descargar capas, verificar unidades y profundidad y comprobar la consulta espacial. El perfil de ejemplo de Carchi no se asigna a otras parcelas.
- El CSV ESPAC seleccionado no contiene coordenadas exactas de cada campo como columnas. Sus claves administrativas no permiten afirmar que una cosecha encuestada es la parcela más cercana en kilómetros.
- No se ha reentrenado XGBoost ni sustituido el archivo de entrenamiento. La integración de fuentes nuevas necesita un contrato de entradas y una evaluación independiente.

## Ejemplo de explicación para el productor

Usar valores realmente devueltos por la consulta, sin fijar cifras de ejemplo en la aplicación:

> Para esta parcela usamos la estación [nombre], situada a [distancia] km. Tiene registros de [periodo] y [cobertura]. Esta información describe el clima histórico de la estación. El suelo procede de [análisis o mapa], con [fecha y profundidad]. Los datos pendientes aparecen como sin información.

No mostrar un porcentaje de confianza construido únicamente a partir de los kilómetros de distancia.
