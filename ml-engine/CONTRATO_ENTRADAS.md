# Entradas y periodos de precipitación

## Nombres de variedades y alcance de las fichas

La aplicación web homologa alias documentados de la misma variedad en
`CatalogoMaiz` antes de consultar el motor. Por ejemplo, el nombre del formulario
`INIAP 101 Blanco Harinoso Precoz` se envía como la etiqueta existente
`INIAP 101 Blanco Harinoso`. El nombre original de la parcela se conserva.
La respuesta web añade `trazabilidad.variedad_simulada` con el nombre registrado,
enviado y realmente utilizado, y guarda una evaluación documental separada.

El catálogo activo contiene 14 fichas: 13 materiales priorizados con nombre homologable a una etiqueta utilizable, más INIAP 198 Canguil como ficha de consulta sin cálculo específico habilitado. Quedan 24 opciones retiradas; el detalle y sus motivos están en `documentacion/seleccion-variedades-20261107.md`. Las otras etiquetas entrenadas se conservan en los artefactos por compatibilidad.
Tener una ficha no agrega muestras ni una categoría entrenada a XGBoost. Los
materiales sin etiqueta específica conservan el aviso de referencia general.
Esta homologación se realiza en PHP: los clientes que consultan Flask
directamente deben mantener el contrato de nombres aceptados por el motor.
Ver `documentacion/catalogo-variedades-20261107.md` para fuentes y límites.

## Fechas, agua y manejo opcionales

`parametros_campo` es un objeto opcional. Sus campos y límites se comparten en `backend-api/data/referencias/entradas-campo.json`. PHP, JavaScript y Python validan valores y preservan cero; los campos vacíos deben omitirse. Los once parámetros se asignan a columnas que ya existen en el modelo. No se agregan nuevas columnas al artefacto entrenado.

`fecha_siembra` acepta AAAA-MM-DD, entre 1950 y 2100. Sitúa el calendario y la consulta histórica; XGBoost recibe la duración mediante `parametros_campo.ciclo_dias`. El fin orientativo incluye el día de siembra. Calendario y fuentes quedan en trazabilidad e historial. El motor activo debe anunciar `contrato_campo: 1.0`; PHP no guarda una ejecución con campos nuevos si un proceso anterior los ignoró.

`incluir_historico: true` solicita contexto del periodo por coordenadas. Los días futuros se excluyen y una serie incompleta no se presenta como lluvia total. Las entradas declaradas del escenario prevalecen. La consulta no genera lluvia futura ni transforma reanálisis de malla en observación del lote.

Las referencias para imputar faltantes excluyen duplicados y contradicciones detectadas; conservan la advertencia de origen no acreditado. `retrain_models.py` exige calidad y procedencia verificada para publicar; los ensayos se ejecutan aislados con `scripts/optimizar_xgboost.py --depuracion-experimental`.

Ver `documentacion/conexion-simulacion-20261108.md` para resultados y límites.

## Periodos de precipitación

El catálogo `config/feature_info.json` describe `precipitacion_mm` del modelo
como precipitación acumulada del ciclo, expresada en milímetros. El contrato
histórico de la aplicación rotulaba `precipitacion` como mm/año. No hay una
conversión anual a ciclo justificable solo con el total anual.

## Simulaciones con periodo explícito

`POST /predict` acepta `precipitacion_ciclo_mm` opcional, numérico, finito y
mayor o igual a cero. Cuando se envía, ese valor se usa en el feature
`precipitacion_mm`, en los datos de entrada de las recomendaciones y en la
comparación con el catálogo agronómico en mm/ciclo. No modifica los artefactos
entrenados ni aplica una regla de tres por días del ciclo.

La respuesta indica `trazabilidad.periodo_precipitacion = "mm/ciclo"`, la fuente
del feature y el valor original de `precipitacion` en
`trazabilidad.precipitacion_payload_mm`. Los ceros explícitos se conservan.
Los clientes nuevos deben solicitar el acumulado del ciclo y enviar el campo
explícito; pueden repetirlo en `precipitacion` por compatibilidad del payload.

## Compatibilidad con clientes anteriores

Si falta `precipitacion_ciclo_mm`, el motor conserva el valor histórico de
`precipitacion` sin convertirlo ni reetiquetarlo. La trazabilidad declara
`mm/año` y advierte la incompatibilidad con el periodo descrito por el catálogo
del modelo; por ello el rendimiento de esas entradas tiene esa limitación.
La recomendación de lluvia queda como no evaluable y no se disparan reglas
hídricas a partir de un total anual, una variedad o una dosis baja de nitrógeno.

Los escenarios alternativos mantienen sus valores y calibración, pero las
condiciones nuevas usan `precipitacion_mm_ciclo` para reflejar el periodo
del catálogo del modelo. No son una conversión del dato anual de la parcela.
Al leer simulaciones anteriores, el cliente debe conservar la advertencia
del periodo legado en vez de renombrar sus datos anuales como mm/ciclo.

## Suelos y límites técnicos

Se mantienen las homologaciones `franco` → `Franco limoso`, `arcilloso` →
`Franco arcilloso`, y `arenoso` → `Franco arenoso`. También se aceptan nombres
presentes en el dataset del modelo y variantes con guiones, mayúsculas o
espacios, como `Franco-Arcilloso`. Un nombre desconocido devuelve HTTP 400
con el campo y el catálogo admitido; no se sustituye por un suelo arbitrario.

Los valores que exceden la representación float32 de las features o la
capacidad float64 de la producción máxima (12 t/ha por el área) se rechazan
antes de invocar XGBoost. Estos son límites de representación del programa,
no rangos agronómicos recomendados. Las advertencias por salir del rango de
entrenamiento se conservan.
