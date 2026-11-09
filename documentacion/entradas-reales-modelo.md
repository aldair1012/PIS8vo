# Qué datos utiliza realmente XGBoost en ZeaSys

Actualización del 8 de noviembre de 2026 sobre `ml-engine/src/feature_builder.py`, `predictor.py` y `backend-api/src/Dominios/Simulaciones/Infraestructura/ClienteMotorFlask.php`.

El modelo recibe 36 variables. Que una variable aparezca en un panel no implica que forme parte del cálculo de rendimiento. XGBoost es el algoritmo: los datos son las observaciones y variables con las que se entrenó y las entradas de cada predicción.

| Dato | Uso actual comprobado | Mejora pendiente |
| --- | --- | --- |
| Temperatura media, humedad, lluvia del ciclo, nitrógeno, pH, textura | Son entradas del escenario enviadas al modelo. El formulario puede precargar referencias de ubicación. | Mantener fecha, periodo y fuente; priorizar mediciones cuando existan. |
| Ubicación y variedad | Seleccionan categorías y referencias del conjunto de entrenamiento. Las coordenadas se usan para consultar proveedores. Una variedad no reconocida utiliza una referencia y genera advertencia. | Confirmar variedad, provincia y cobertura del conjunto de entrenamiento. |
| Tamaño de parcela | Convierte rendimiento por hectárea en producción total; no es una de las 36 columnas predictoras. | Conservar la superficie realmente simulada y distinguirla de la superficie total. |
| Arcilla, arena, limo y materia orgánica | Pueden entrar desde el proveedor de suelo por coordenadas; en ausencia de respuesta quedan referencias del dataset. | Registrar incertidumbre y contrastar con análisis de suelo. |
| Clima actual e histórico | Se consulta como referencia y contexto del periodo solicitado; los valores del escenario prevalecen en la predicción y se informa la cobertura de lluvia. | Vincular series al ciclo concreto y diferenciar observado, reanálisis, pronóstico y escenario. |
| Día, mes y año de siembra/cosecha | La fecha de siembra se transmite y sitúa el periodo histórico y el calendario. No es una columna nueva del modelo. | Definir un contrato de campaña y ventanas de clima sin usar información futura que no estaba disponible al predecir. |
| Duración del cultivo (`ciclo_dias`) | Se puede ingresar en el formulario, enviar por PHP y utilizar como columna del modelo; si falta, conserva una referencia asumida. | Permitir un valor documentado por variedad/campaña, validarlo y conservar su fuente. |
| Agua medida en el campo | Se guarda en el registro de campo y puede mostrarse en indicadores; no se envía directamente a XGBoost. La lámina de riego se puede declarar separadamente en mm y llega al modelo; no se deduce de la capacidad de agua del suelo. | Diseñar la relación entre mediciones, profundidad, fechas y riego; no confundir capacidad del suelo con agua aplicada o humedad actual. |
| Otros nutrientes, NDVI, manejo y plagas | Varias entradas provienen de medianas o categorías del dataset si no se registran. | Integrar mediciones y manejo con validación y revisar el modelo si se cambia el significado o conjunto de variables. |
| Cosecha real obtenida | No disponible actualmente según el usuario. | Comparar predicciones previas con producción real, superficie y base de humedad compatibles para medir error. |

## Evidencia disponible y límites

`maiz_ecuador_training_data.csv` contiene 2.366 filas y 38 columnas: 36 entradas y dos columnas de resultado. Las métricas guardadas informan validación agrupada por provincia y 2.266 filas utilizadas tras retirar 100 duplicados. La procedencia verificable de esas observaciones está pendiente de confirmación del usuario; no se concluye que sean sintéticas ni que sean cosechas verificadas.

Actualización: el usuario no recuerda el origen. La búsqueda de procedencia y el perfil numérico están documentados en `procedencia-dataset-20261107.md`; se encontraron inconsistencias que requieren el diccionario y las fuentes originales antes de acreditar sus etiquetas.

El R² del archivo de métricas describe esa evaluación. No es una probabilidad de acertar la cosecha de una parcela. El formulario ya identifica la métrica y permite desplegar los valores y fuentes realmente enviados al modelo.

## Fuentes oficiales consultadas

- [Open-Meteo: datos históricos](https://open-meteo.com/en/docs/historical-weather-api): distingue reanálisis y modelos históricos, con resoluciones y periodos documentados.
- [Open-Meteo: pronóstico](https://open-meteo.com/en/features): el pronóstico meteorológico estándar llega hasta 16 días. No permite conocer como hecho el clima de toda una campaña futura; los periodos posteriores requieren escenarios o referencias claramente identificados.
- [ISRIC: SoilGrids](https://docs.isric.org/globaldata/soilgrids/index.html): mapas de propiedades del suelo a 250 m y estimaciones de incertidumbre. En la consulta, ISRIC anuncia su API REST temporalmente pausada y sin fecha de restauración; no se debe depender de disponibilidad continua ni tratar sus valores como un análisis de la parcela.

## Avance y siguientes integraciones

Fechas, duración, agua aplicada y nueve variables adicionales/relacionadas ya tienen contrato compartido, validación, procedencia y persistencia. El detalle exacto de once campos está en [conexiones y experimento de XGBoost](conexion-simulacion-20261108.md). La precisión agrícola externa sigue pendiente de cosechas verificadas.

La secuencia inicial se conserva como referencia; los puntos 2 y 3 ya tienen una primera implementación comprobada:

1. Confirmar origen y documentación del dataset de entrenamiento.
2. Definir fechas de campaña y duración, con fuentes y unidades.
3. Incorporar los datos que ya tienen una variable compatible en el modelo, con pruebas del contrato y trazabilidad.
4. Para nuevas variables o cambios de significado, preparar entrenamiento y validación independientes antes de sustituir el modelo.
5. Obtener cosechas observadas y evaluar errores por región, campaña y versión con `ml-engine/scripts/evaluar_cosechas_verificadas.py`.
