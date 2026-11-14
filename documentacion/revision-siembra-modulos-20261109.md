# Módulos de Siembra conectados a sus datos — 9 de noviembre de 2026

Esta revisión atiende los gráficos y calendarios que aparentaban estar vacíos en
la instalación existente. Se inspeccionaron los registros locales sin modificar
las parcelas, fechas ni simulaciones personales.

## Causas comprobadas

- Todas las simulaciones existentes se ejecutaron en 2026. Un filtro de otro año
  producía una muestra vacía, aunque la campaña tuviera fechas de 2027.
- El calendario abría el mes actual, que podía no contener ventanas de siembra.
- El cliente descartaba las ventanas de cosecha que el servidor ya entregaba.
- Una matriz cruzaba todas las ejecuciones y variedades: cada fila tenía un
  resultado y numerosos cruces sin datos.
- Con una única ejecución, P10, mediana y P90 coincidían y los puntos se
  superponían. Eso no constituye una distribución independiente de cosechas.
- El calendario de catálogo no cubre todas las combinaciones de zona y tipo de
  maíz; faltaba conectar la fecha registrada de la propia parcela.

En la consulta local había 23 parcelas activas, todas con ejecuciones de 2026;
22 conservaban una fecha utilizable de parcela, 19 tenían ventanas compatibles
de catálogo y una conservaba también un fin de ciclo estimado compatible con la
fecha de siembra actual. Estos recuentos describen esa consulta puntual y pueden
cambiar con el uso. No se exportaron cuentas ni datos personales al paquete.

## Comportamiento implementado

1. **Referencia de la zona:** conserva tanto siembras como cosechas del catálogo,
   con controles para ver ambas o cada tipo. Abre un mes con eventos y ofrece una
   lista desplazable por teclado de sus fechas, además del calendario mensual.
   El botón «Con fechas» vuelve al mes con información después de navegar.
   Los detalles conservan su anclaje al desplazarse la pantalla y la lista de
   fechas se puede recorrer con teclado.
2. **Mi cultivo:** muestra la fecha declarada de la parcela o la fecha planificada
   conservada en una simulación. Si existe un fin estimado de ciclo para esa misma
   siembra, lo muestra con el número de simulación y su procedencia. No se mezcla
   un fin antiguo con una nueva fecha registrada ni se convierte en cosecha real.
3. **Fecha ausente:** el módulo ofrece un formulario para que el productor
   introduzca la fecha registrada o prevista. El guardado usa la API de parcelas,
   recarga los eventos y actualiza la lista de parcelas. No se asigna una fecha
   automáticamente. Sigue disponible la acción para simular con fechas.
4. **Año sin muestra:** se ofrece abrir el último año que contiene simulaciones de
   esa parcela. Los datos del otro año no se suman silenciosamente a la muestra.
   El calendario conserva el año propio de la campaña.
5. **Comparación:** una fila por ejecución y una barra relativa a su rendimiento
   guardado. Se conservan el identificador, la fecha y la variedad sólo cuando
   quedó registrada. Se eliminan los cruces vacíos entre variedades.
6. **Estadística:** una única simulación tiene una lectura propia; varias permiten
   mostrar los percentiles. Si coinciden, se explica la superposición. Los paneles
   de comparación y orden de resultados no se dibujan vacíos si no hay muestra.
7. **Asistente:** recibe las ventanas de cosecha, las fechas de parcela y el origen
   de calendario seleccionado. Las fechas y resultados agrícolas siguen
   recuperándose del servidor autorizado.

## Comprobaciones

- 19 pruebas específicas de Siembra, junto a 12 de Rendimiento y dos de teclado:
  33 pruebas de navegador correctas. Se reprodujeron antes de corregir los cuatro
  fallos de módulos y la ausencia del formulario de fecha.
- 43 pruebas de utilidades del frontend; 21 de clima/escenarios y 47 de chat en PHP.
- Verificador general del proyecto correcto, incluidas las 68 pruebas del motor,
  lint y compilación para XAMPP.
- Integración HTTP con MariaDB y motor local en una base desechable: 23 grupos de
  recorridos, incluida la edición y recarga de una fecha de campaña distinta del
  año de ejecución. El proveedor de lenguaje se probó desconectado de forma
  intencional para comprobar su error controlado.
- Revisión visual en claro y oscuro: vista principal a 390, 820 y 1440 px y paneles
  abiertos a 390 y 1440 px. Incluye muestra grande, calendario, explicación,
  parcela sin simulaciones, formulario sin fecha y guardado real en la parcela
  ficticia. Las 30 revisiones terminaron sin errores JavaScript, desbordamiento de
  página ni infracciones detectadas por axe en las reglas ejecutadas.

Las capturas y logs locales se guardan en
`documentacion/fuentes-maiz/descargas/siembra-modulos-*20261109*` y en la carpeta
de estados de Siembra. El código de prueba y este informe se incluyen en la
entrega; los registros de usuarios y las capturas personales no se distribuyen.

## Límites de los datos

No se rellenan ventanas de catálogo inexistentes ni se deduce una cosecha real.
Una fecha prevista sigue siendo una declaración del productor. Un fin de ciclo
guardado como estimación conserva esa condición y su fuente, incluso cuando la
duración procedía de una referencia de entrenamiento. No se modificaron los
pesos del modelo ni se generaron simulaciones personales adicionales para llenar
paneles. Las pruebas reales de escritura utilizaron exclusivamente parcelas
ficticias que se eliminaron al finalizar.
