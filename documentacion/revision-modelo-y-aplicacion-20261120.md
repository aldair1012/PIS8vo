# Qué puede afirmar ZeaSys al planificar una siembra

**Revisión del 20 de noviembre de 2026.** Con las entradas de un formulario básico, el candidato de planificación obtuvo un error absoluto medio de **0,927 t/ha**. La media por zona obtuvo **0,939 t/ha**. La diferencia, 12 kg/ha, es pequeña y cambia de signo en uno de los cuatro pliegues. La prioridad es averiguar si esta ventaja se sostiene en parcelas con cosechas documentadas. La tabla local de mediciones de rendimiento estaba vacía al revisarla.

> **Actualización del 22 de noviembre de 2026.** Desde esta revisión se añadieron el registro de campañas y el acompañamiento técnico, los avisos de lluvia por WhatsApp, la consulta de precios por provincia, la transmisión del chat con consentimiento y cuota, y el servicio de salud conjunta. El frontend publica recursos con hash y gzip negociado, e instala una página de apertura sin conexión. Las migraciones correspondientes están en `database/migraciones/` y el estado vigente de los recorridos en [entrega de campo](entrega-campo-20261121.md). Las cifras de exactitud de este documento no han cambiado: estas incorporaciones no validan el modelo por sí solas.

## Qué cambia cuando sólo se usa información disponible al sembrar

Los cuatro pliegues reservan provincias completas. Se conservan `Loja` y `Loja Sierra` como categorías predictoras y ambas salen juntas al reservar Loja. Cada codificador, moda y mediana se ajusta con las filas de entrenamiento de su pliegue. Se aplicó la auditoría del proyecto al CSV original antes de comparar los modelos. El resultado principal usa 1 970 filas y 21 grupos provinciales. [Resultados por pliegue y versiones del entorno](evaluaciones/evaluacion-planificacion-20261120.json).

| Información disponible en la prueba | Variables del modelo | MAE (t/ha) | R² |
| --- | ---: | ---: | ---: |
| Media de rendimiento por zona | Sólo zona | 0,939 | 0,518 |
| Fila completa del CSV, incluidas observaciones posteriores | 36 | 0,828 | 0,627 |
| Se sustituyen por zona seis campos posteriores y las horas de luz | 36 | 0,929 | 0,522 |
| Se excluyen los seis campos y se sustituyen las horas de luz | 30 | 0,915 | 0,540 |
| También se excluyen las horas de luz | 29 | 0,919 | 0,534 |
| Formulario básico, modelo completo | 36 | 0,947 | 0,506 |
| Formulario básico, candidato de planificación | 30 | **0,927** | **0,520** |

El formulario básico supone conocidas la zona, provincia, variedad, altitud, tipo de grano, textura, pH, nitrógeno y condiciones climáticas del escenario. Estima las temperaturas extremas a partir de la media. Omite los campos opcionales de manejo y el proveedor de suelo. Para esos huecos usa la misma selección de referencias que el motor, empezando por variedad y buscando provincia o zona cuando hay registros. Tanto el clima como la altitud del ensayo proceden del CSV. Una parcela con ubicación incierta, peor información del clima u otro manejo puede obtener un error diferente.

El ensayo histórico usaba sobre todo imputación por zona y conservaba muchos datos de la fila. Es una prueba de sensibilidad a unas variables concretas. Tampoco ejecuta el archivo de pesos desplegado sobre productores nuevos. Con las dependencias locales, los resultados cambian en milésimas respecto de los de la rama original. La mejora al pasar de 36 a 30 en el formulario básico fue del 2,1 %. Frente a la media por zona fue del 1,3 %. [Ensayo histórico de noviembre](evaluacion-realismo-inferencia-20261115.md).

## Correcciones al diagnóstico

| Hallazgo | Lectura verificable |
| --- | --- |
| Calidad del archivo | Hay 2 366 filas, 100 duplicados adicionales y 296 filas con incidencias. El entrenamiento publicado informa 2 266 filas tras deduplicar. La auditoría actual excluye además las inválidas del experimento. Se conserva el original y su huella. |
| Cobertura geográfica y temporal | En el archivo bruto hay 6 filas de `Costa_Verano` y 18 de `Sierra_Verano`. Un resultado global no caracteriza esas zonas. Faltan año y fecha de campaña para probar generalización temporal o reconstruir el clima que se habría conocido antes de sembrar. |
| Horas de luz | En el CSV completo van de **5,5 a 9,5** y promedian 7,05. Los valores 6,7 y 8,3 figuran entre los ejemplos del catálogo. Faltan instrumento, definición física y procedencia. La inferencia usa una mediana histórica. La diferencia entre los ensayos de 29 y 30 entradas es pequeña. |
| Importancia del modelo | En el regresor desplegado, la importancia de XGBoost es 16,73 % para tipo de riego, 14,54 % para altitud, 9,93 % para luz y 13,98 % para los seis campos posteriores juntos. Estos son pesos globales del ajuste. La vista de Rendimiento muestra los aportes SHAP de cada ejecución en t/ha, con riego y altitud visibles cuando tienen aporte registrado. |
| Métricas publicadas | El MAE de 0,817 t/ha y el R² de 0,582 proceden de cinco pliegues y del contrato completo. El R² varía de 0,356 a 0,690. La exactitud de clasificación es 58,0 %. Dividir el MAE por la media bruta de 4,24 t/ha da una razón descriptiva cercana al 19 %. Para conocer el error porcentual de cada parcela se necesitan sus observaciones. |
| Intervalos | Al aplicar la función del motor, sus métricas publicadas, recortes y redondeo a las predicciones de prueba del formulario básico completo, entran **1 789 de 1 970 filas (90,8 %)**. El ancho medio es 4,08 t/ha. Es una comprobación interna sobre la misma fuente usada para estimar el margen. El ensayo histórico del 91–92 % usó otro perfil, otro margen y omitió el recorte. La banda experimental por residuos tiene cobertura observada propia y carece de garantía para una provincia nueva. |

## Cómo obtener la primera métrica de campo

En **Rendimiento → Registro de campo**, descarga la ficha CSV de la ejecución antes de la cosecha. Reúne de forma prospectiva 20–50 campañas como piloto, incluyendo pérdidas y parcelas con rendimientos bajos. Guarda el comprobante de peso, la superficie efectivamente cosechada, fecha y base de humedad. Si el área es cero, documenta la pérdida por separado porque el cociente t/ha queda indefinido. Mantén la misma superficie y base de humedad para predicción y observación. La ficha deja vacíos los datos que requieren medición.

El evaluador acepta tanto t/ha observadas como kg de grano seco y hectáreas cosechadas. Informa MAE, RMSE, sesgo, número de observaciones y cobertura con sus propios denominadores. Identifica las predicciones hechas el día de la cosecha para que se pueda verificar el orden. Con varias campañas de una parcela, reserva las posteriores para evaluar cualquier corrección personal. El dato usado para ajustar una corrección ya no es una prueba independiente de ella. [Formato y procedimiento](fuentes-evaluacion-cosechas.md).

```powershell
python ml-engine/scripts/experimento_realismo_inferencia.py
python ml-engine/scripts/evaluar_cosechas_verificadas.py cosechas.csv
```

ESPAC ofrece datos oficiales de superficie y producción. ZeaSys ya tiene un ensayo retrospectivo con 2 787 registros de maíz seco y seis entradas distintas de las del regresor activo. Sirve como contraste territorial. Para medir la precisión del sistema entregado hace falta identificar la predicción previa que corresponde a cada cosecha. [Ensayo local ESPAC](evaluaciones/evaluacion-espac2025-20261108.json) · [Microdatos oficiales del INEC](https://anda.inec.gob.ec/anda5/index.php/catalog/1319).

## Qué cambia para el productor

- **Al simular**, ve si falta validación independiente y cuántos campos posteriores se asumieron. La tabla de entradas distingue valores del escenario, estimaciones y referencias con texto y color. La trazabilidad de nuevas ejecuciones incluye la versión de la ficha y la huella del CSV de entrenamiento asociada al modelo.
- **En Siembra**, puede comparar dos fechas con la ventana institucional de la zona y el fin aproximado con la misma duración. La guía conserva sus límites de mes parcial. La fecha por sí sola no permite asignar una ganancia en t/ha con este modelo.
- **Sin señal**, tras una primera visita en línea en un contexto seguro, se abre un formulario de fecha, grano y biomasa seca de la misma muestra. El productor descarga el archivo en su dispositivo. Al volver a tener señal, elige la parcela, importa el archivo, revisa los valores y pulsa **Guardar mediciones**. Así puede registrar el índice de cosecha. Para validar rendimiento debe completar también la ficha de peso total y hectáreas. La sincronización requiere revisión y una sesión iniciada.
- **En la portada**, un teléfono, el ahorro de datos y las conexiones identificadas como lentas usan la fotografía local. En los demás equipos, Three.js y el modelo sólo se solicitan al acercarse a la sección. Las imágenes de 232 y 308 kB pertenecen a las tarjetas de capacidades y usan carga diferida.
- **En los tableros**, costes, ROI y percentiles usan ECharts junto con Clima y Rendimiento. El cálculo financiero ya tenía su módulo y pruebas. Ahora la composición de costes tiene un componente propio. El paquete de gráficos compartido mide 524 kB sin comprimir, unos 174 kB gzip según Vite. Se eliminaron Chart.js y su adaptador de React. Los recursos con hash se publican con caché larga y gzip negociado por `assets/.htaccess`; la compresión de Apache sigue siendo necesaria para el HTML y las respuestas de la API.
- **En el repositorio**, la configuración local del frontend sale del índice Git y se conserva en disco. La plantilla está en `frontend-app/.env.example`. Los planes internos y la maqueta quedan bajo `documentacion/`. El build de Vite sigue siendo la fuente de los archivos servidos por XAMPP.

## Prioridades que quedan abiertas

| Decisión | Evidencia o criterio para avanzar |
| --- | --- |
| Publicar un modelo de planificación y otro de seguimiento | Evaluar el candidato simple con las cosechas pareadas. Para seguimiento ya se pueden declarar etapa, plaga e incidencia. Faltan series NDVI y observaciones fechadas enlazadas al desenlace, con un corte explícito de lo conocido en cada etapa. Mantener el control de procedencia para publicar pesos. |
| Mostrar bandas del 50 % y 90 %, calibración personal y sensibilidad | Medir por campaña la cobertura, el ancho y el número de casos. Los percentiles de simulaciones guardadas describen esas simulaciones. Separar los efectos de cambiar entradas en un escenario de la importancia global o los aportes locales SHAP. |
| Grados-día, balance hídrico y altitud | Evaluar umbrales por variedad con fechas de etapa observada. Para balance hídrico se necesitan ET de referencia, coeficientes por etapa, lluvia efectiva, riego y capacidad de suelo. Identificar fuente, resolución y fecha para las elevaciones y estimaciones de suelo. Marcar días sin datos antes de acumular. |
| Precio y finanzas | El presupuesto reúne supuestos editables y sensibilidad. Una serie provincial mensual debe distinguir producto, humedad, unidad, mercado y meses sin cotización. Mantener el precio oficial de referencia identificado por su naturaleza. |
| Chat, búsqueda y arquitectura | Medir tiempo al primer contenido y tiempo total en consultas comparables. Probar SSE de proveedor a navegador, cancelación, errores parciales y guardado único de la respuesta. Hay recuperación documental, memoria, manejo de 429 y un aviso cuando falta búsqueda. Comparar recuperación y costo antes de retirar Flowise, Chroma u Ollama. Una caché de búsquedas necesita separar contexto privado y fuentes públicas, ámbito territorial y caducidad. Las dos latencias citadas no son una distribución. |
| Operación con señal intermitente | El sistema tiene cachés, llamadas con tiempos máximos, Docker de demostración y salud del motor. Medir proveedores por separado antes de paralelizar. Quedan el respaldo con fecha del último dato válido, la salud conjunta, la verificación de índices con consultas reales y una restauración completa ensayada. [Estado de rendimiento](historial/rendimiento-estabilidad-20261108.md) · [Respaldo local](respaldo-local.md). |
| Diseño y funciones de acompañamiento | Probar con productores el recorrido parcela → plan → simulación → campo. Priorizar tareas que completen sin ayuda antes de reagrupar toda la navegación. La vista de cooperativa, fotos y voz, memoria entre campañas, WhatsApp y localización lingüística requieren flujos definidos con sus usuarios, permisos por parcela y preferencias de contacto. El tema interno tiene estilos propios y deuda con estilos heredados. Conviene migrar por pantalla. |

La exposición de un token y la configuración de Google son asuntos distintos. Si el token citado sigue activo, el titular puede revocarlo desde su cuenta. El trabajo local no requiere enviar credenciales por chat. [Administración de tokens en GitHub](https://docs.github.com/es/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

## Verificación local

Pasaron 75 pruebas del motor, 62 pruebas unitarias del frontend y 16 pruebas seleccionadas en Chrome. También pasaron las suites PHP de analítica y mediciones, finanzas y simulaciones. ESLint y la compilación de producción terminaron correctamente. Vite advierte sobre el paquete de gráficos de más de 500 kB antes de compresión.

En Chrome se comprobaron los temas claro y oscuro a anchos de móvil, tableta y escritorio, los gráficos financieros, el comparador de fechas y el paso de un archivo sin señal al formulario autenticado con una API de prueba. En una sesión separada contra XAMPP se verificaron el manifiesto y la apertura del formulario con la red desactivada bajo el alcance `/ZeaSys/`. La prueba de navegador usó datos ficticios y la consulta a la base local sólo contó registros. La latencia de Gemini y la exactitud frente a cosechas independientes siguen sin medición nueva.
