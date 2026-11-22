# Calendario agrícola y selector de parcelas

Revisión: 15 de noviembre de 2026. React, Vite y CSS existentes. Criterios de UI UX Pro Max aplicados al espacio interno, sin reutilizar los selectores de la portada.

## Selector de parcelas

La lista permitía que Flexbox comprimiera todas las tarjetas para intentar hacerlas caber. Además, reutilizaba clases de las tarjetas de otra página. Los textos desbordaban sus filas. Ahora las filas no se encogen, crecen con nombres o ubicaciones largos y tienen una estructura propia: icono, nombre, ubicación, superficie/variedad y marca de selección. La lista se desplaza entre el buscador y el pie fijo. El panel respeta el ancho y alto disponibles; en horizontal reducido se coloca cerca del borde superior.

Se mantienen búsqueda, selección, creación y cierre con Escape. Después de elegir una parcela se devuelve el foco al selector tras la actualización de React. Los botones conservan nombre accesible y estado de selección. Los colores proceden de los tokens internos compartidos; no se cambian los estilos de la portada.

Archivos principales: `frontend-app/src/templates/Common/LoteSelector.jsx` y `frontend-app/src/assets/plot-selector.css`. En el borde de compatibilidad de `styles.css` sólo se cambia el anclaje del panel para respetar la posición calculada.

## Calendario de Siembra

Debajo del plan propio aparece **Calendario agrícola de tu zona**. Los doce meses se pueden consultar sin modificar ni guardar datos. Las celdas distinguen mediante texto la época publicada, los meses sin referencia y las fechas propias. El detalle conserva los límites parciales de los meses. El calendario es anual y recurrente; las marcas del plan sí incluyen su año.

Las filas mensuales tienen altura consistente. Una regla global antigua con `:is(input:not(...))` elevaba la especificidad de la altura mínima de todos los botones: se corrige mediante una regla de componente suficientemente específica, sin añadir `!important`.

El plan sigue siendo la fuente de la siembra propia y del fin aproximado calculado con la duración. Una fecha de simulación o una fecha sin clasificar no se presenta como siembra real. La consulta de meses no decide una fecha ni altera la variedad o la simulación XGBoost.

### Selección territorial y varietal

El servidor resuelve la provincia mediante el mecanismo existente de coordenadas y ubicación. La ficha identificada determina el grupo agrícola; el canguil de altura no se clasifica como maíz duro de Costa por pertenecer a un grupo legado del formulario. Una altitud fuera del intervalo documentado impide asignar una ventana automática.

Cuando la variedad es genérica, los grupos inequívocos «Duro Amarillo» y «Suave Harinoso» permiten consultar una guía general con aviso explícito. No se les atribuye una ficha varietal. El grupo mixto «Duro Amarillo / Blanco», o un canguil no identificado, requieren identificar la variedad antes de asignar una región. Sin cobertura se muestran datos ausentes, no meses desfavorables inventados.

### Fuentes y usos

Los hechos están en `backend-api/data/referencias/calendario-agricola-ecuador.json`; los selecciona `GuiaCalendarioAgricola.php` y los expone `ServicioAnaliticaScenario` en `guia_agricola`. La selección es reproducible y no requiere red para leer los meses, requisitos o antecedentes. Los enlaces y las páginas permiten revisar cada referencia.

| Fuente | Uso visible | Alcance conservado |
|---|---|---|
| INIAP / KOPIA, Guía para la producción sustentable de maíz en la Sierra ecuatoriana, 2021 | Ventana general septiembre–mediados de enero, referencias del Austro, suelo y antecedentes regionales | PDF pp. 36, 122, 126, 128, 129, 131 y 137. Con riego, otras épocas para choclo son una condición específica, no una extensión automática a grano seco o canguil. |
| Agrocalidad, Guía de BPA para maíz duro, edición 2014 | Texturas, pH, drenaje y comienzo de lluvias | PDF pp. 14 y 17; el año 2022 del alojamiento web no es la edición. No se implementan recetas de plaguicidas. |
| MAG / SIPA, Informe de rendimientos de maíz amarillo, invierno 2022 | Enero/febrero como práctica declarada y problemas fitosanitarios por seis provincias | PDF pp. 4, 8 y 16. Encuesta histórica de 630 productores, no vigilancia actual ni óptimo de una variedad. No se usan sus porcentajes como riesgo de una parcela. |
| Agrocalidad, Dirección de Vigilancia Fitosanitaria | Enlace oficial de vigilancia y notificación | Sin un feed integrado y verificado de brotes actuales por parcela. |
| ISRIC SoilGrids, mediante el servicio existente del terreno | Consulta de textura estimada y pH de apoyo de la parcela | Mapa de 250 m, profundidad 0–5 cm. El pH registrado se distingue del obtenido por proveedor. No equivale a laboratorio ni describe todo el perfil. |

INIAP mantiene la misma copia revisada en su nueva API de repositorio. Se verificó respuesta HTTP 200, tipo PDF, 9.679.874 bytes y SHA256 `cc41ccee362b5c597011b55a06ad9423da4b40afaa01490a5cc6d1d2f9122a84`. El informe MAG tiene SHA256 `d8d6380a04a75d2b004c20d114b4699445e5f209a75d6bdfe08b6156a87fe14a`. El gráfico provincial del MAG se contrastó visualmente con el PDF, no sólo con su texto extraído.

Se revisó también la publicación SIPA de maíz duro de 2026, ofrecida como tablero Power BI. No se la convirtió en una supuesta API de brotes. La pantalla indica expresamente el periodo 2022 de los antecedentes que sí se han contrastado.

La respuesta antigua `viabilidad_siembra` se conserva por compatibilidad. El calendario agrícola nuevo no la usa ni presenta la compilación generada `agronomia_data.json` como fuente institucional certificada.

### Suelo, sanidad y asistente

La consulta del terreno es independiente de la guía y se cancela al cambiar de parcela. Su fallo deja disponibles el calendario y las fuentes, muestra ausencia de estimación y permite reintentar. La guía separa requisitos generales de la referencia del terreno.

Los problemas sanitarios aparecen como antecedentes con provincia, grupo y periodo. «Quemazón» es un síntoma reportado. No hay diagnóstico automático ni afirmaciones de presencia actual. El asistente recibe la guía reconstruida en el servidor y conserva estos límites, el periodo de los antecedentes y sus nombres/tipos al compactar el contexto.

El inventario Word se regeneró con **34 fuentes**, **14 variedades** y los **5 PDF** originales. CAL-01 a CAL-04 documentan los campos y archivos nuevos. Su JSON y el script de generación se conservan en el proyecto.

## Comprobaciones

- Lint y compilación de producción del frontend.
- 52 pruebas unitarias del frontend.
- 67 casos de navegador de calendario, planificación, Siembra, teclado y explicaciones; los 14 casos del calendario/selector se repitieron tras el último ajuste de tamaños y enlaces.
- 375, 768 y 1440 px en claro y oscuro; horizontal de 812 × 375 con texto al doble; lista de 25 parcelas con nombres largos, búsqueda, desplazamiento y devolución del foco.
- Auditorías axe del calendario y selector en ambos temas, además de la pantalla de planificación y estadísticas.
- 18 comprobaciones del proveedor agrícola; 21 regresiones de analítica; 51 comprobaciones del chat.
- 24 recorridos HTTP con cuentas y MariaDB desechables, incluido `guia_agricola` y su estado de vigilancia. No se usan datos personales para generar resultados de prueba.
- 7 recorridos adicionales con el frontend compilado y la API/MariaDB reales: navegación de todas las pestañas a 390, 768 y 1440 px en ambos temas, y guardado/recarga persistente del plan.
- XAMPP devuelve HTTP 200 para la portada y sus recursos compilados actuales.
- Word renderizado a PDF y revisado visualmente.

Continúa el aviso de Vite sobre el paquete compartido de gráficos EChart (aproximadamente 506 kB sin comprimir). Es independiente del calendario y no impide compilar. No se requiere importar nuevamente la base de datos personal ni modificar sus permisos para estas mejoras.
