# Estructura y visualización comunes de Rendimiento y Siembra

Revisión del 9 de noviembre de 2026. Se aplicó a Siembra la organización visual
de Rendimiento y se conservaron las fuentes y operaciones conectadas en las
revisiones anteriores.

## Organización resultante

- Cabecera con parcela, provincia, variedad, año de ejecución y acción principal
  «Nueva simulación», con la misma jerarquía de Rendimiento.
- Cuatro indicadores principales: media, mediana, coeficiente de variación y
  cantidad de simulaciones consultadas. Cada uno permite solicitar una explicación.
  Los valores ausentes se muestran como «—» y una muestra vacía no crea tarjetas.
- Barra de acciones para ir al calendario o abrir «Cómo leer estos datos».
  Las fuentes, el límite de consulta y la ausencia de un modelo de riesgo quedan
  en ese bloque desplegable, disponibles bajo demanda.
- Primer grupo de paneles: calendario de la parcela o zona y hasta cinco resultados
  guardados de mayor rendimiento. Se mantienen los filtros de siembra/cosecha,
  fechas conservadas, guardado de una fecha faltante y explicaciones de registros.
- Segundo grupo: comparación por ejecución y resumen estadístico. Una ejecución
  única conserva su lectura propia. No se dibujan estos paneles sin muestra.
- La comparación móvil muestra ejecución, variedad y rendimiento dentro del ancho
  disponible, con desplazamiento vertical para listas largas.

## Implementación

`frontend-app/src/templates/Common/DashboardPrimitives.jsx` concentra las tarjetas
y paneles usados por ambas vistas. Conserva el marcado de Rendimiento y sus
estilos internos. Las extensiones están en `assets/dashboard-primitives.css`;
Siembra conserva sus reglas específicas en `assets/siembra-dashboard.css`.
Se utiliza la paleta semántica existente para ambos temas, sin añadir un framework.

Se retiraron de la vista de Siembra los contenedores y la mayor parte de estilos
en línea heredados. El calendario se integra en el panel común sin una segunda
tarjeta exterior, y las listas completas de fechas quedan en un desplegable.
Se unificaron también los estados de carga, error recuperable y ausencia de parcela.

La prueba de cambio de tema detectó que el gráfico de percentiles conservaba los
colores anteriores. Ahora observa el tema aplicado al documento y actualiza el
gráfico; se verificó que cambia el contenido pintado del canvas, con animación
reducida. No se alteraron los datos ni los cálculos del gráfico.

## Comprobaciones

- 22 pruebas de Siembra, 12 de Rendimiento y dos de navegación con teclado:
  36 pruebas de navegador correctas.
- Las pruebas nuevas reprodujeron previamente la ausencia de componentes comunes,
  el color obsoleto del gráfico al cambiar de tema y el rendimiento fuera del ancho
  visible en móvil.
- Verificador general correcto: lint, 43 pruebas de utilidades del frontend,
  suites PHP (incluidas 21 de clima/escenarios y 47 de chat), 68 pruebas del motor
  Python y compilación copiada a XAMPP.
- Integración real en base desechable: 23 grupos de recorridos correctos, con
  lectura y edición autorizada de fechas y respuesta controlada ante la caída
  intencional del proveedor de lenguaje.
- Revisión visual principal de Rendimiento y Siembra a 390, 820 y 1440 px, en claro
  y oscuro: 12 combinaciones. Otras 24 revisiones de Siembra a 390 y 1440 px incluyen
  muestra grande, calendario, explicación, muestra vacía y formulario de fecha.
  Se añaden cuatro revisiones del bloque de fuentes desplegado en móvil y escritorio,
  en ambos temas: 40 revisiones visuales en total.
- Las comprobaciones visuales finalizaron sin errores JavaScript, desbordamientos
  de página ni infracciones detectadas por axe en las reglas ejecutadas. Se
  inspeccionaron además capturas de las tarjetas y paneles.

Las evidencias locales están en `documentacion/fuentes-maiz/descargas/siembra-estructura-*20261109*`.
La compilación y el código actualizado se incluyen en el paquete docente.

## Alcance

No se añadieron valores de rendimiento, eventos agrícolas ni fechas a los registros
personales. Las escrituras de comprobación se hicieron únicamente en parcelas
ficticias. Los límites científicos siguen siendo los descritos en los informes
anteriores: una predicción guardada no es una cosecha observada y las referencias
de catálogo no certifican una fecha óptima. Las pruebas acreditan los recorridos
ejecutados, sin garantizar ausencia universal de errores.
