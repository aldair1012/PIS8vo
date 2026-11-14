# Explicaciones directas de gráficos y tarjetas — 10 de noviembre de 2026

## Interacción

Se eliminan los botones visibles «Explicar gráfico» de Siembra, los accesos
redundantes de sus filas y calendario, y el botón de explicación adicional
del componente de indicadores utilizado en Finanzas. Las tarjetas y los
gráficos de Siembra y Rendimiento permiten abrir la explicación pulsando
su superficie. El título mantiene un botón semántico con aspecto de texto
para que la misma acción funcione mediante Tab, Enter y Espacio.

Los filtros, enlaces, selectores, campos y controles internos conservan
su acción. Seleccionar texto no abre una explicación accidentalmente.
El panel de información se cierra con Escape o su control de cierre y
devuelve el foco al título que lo abrió. Es un diálogo no modal, con
desplazamiento propio en ventanas bajas y controles de 44 px.

## Claridad y datos

Las guías de Siembra y Rendimiento se presentan en lenguaje sencillo:

1. Qué muestra el dato o gráfico.
2. Cómo leer sus valores, unidades, barras y puntos.
3. Qué límites tiene esa información.

La lectura básica usa los valores que ya están visibles y aparece sin
esperar al servidor. El intérprete PHP conserva el detalle complementario,
que se puede desplegar. Si falla esa consulta, se mantiene la guía local.
Las demás tarjetas que ya usaban el intérprete conservan su contenido y
ganan secciones claras de significado, contexto y revisión.

No se recalculan predicciones, probabilidades ni indicadores. Se mantienen
los ceros y las ausencias. Los percentiles de una muestra no se presentan
como probabilidades futuras; una sola simulación se identifica como tal.
Los aportes SHAP explican el modelo y no se convierten en causas de campo.

Los gráficos envían al intérprete sus series en formatos compatibles,
con magnitudes separadas. Las guías de presentación no se envían al API.
Las consultas duplicadas mientras carga comparten una petición. Cambiar
de parcela, año o ejecución cierra el diálogo anterior, incluso si luego
se vuelve a la selección original.

La tarjeta de información se monta mediante un portal en la raíz interna
de la aplicación: conserva los tokens de tema y queda por encima del
lanzador del asistente, que antes podía cubrir parte del texto.

## Verificación

- Se reprodujo la presencia de los dos botones originales con una prueba
  que falló antes del cambio.
- Se reprodujo y corrigió la reapertura de una explicación antigua al
  volver a una ejecución consultada anteriormente.
- `npm run lint` y `npm run build` aprobados; compilado copiado a XAMPP.
- Nueve pruebas específicas de interacción: clic en gráfico y tarjeta,
  teclado, foco, valor cero, ausencia, muestra única, fallo de conexión,
  consultas duplicadas, cambio de ejecución, controles y tarjetas financieras.
- Regresión de las funciones de Siembra y Rendimiento con sus pruebas
  existentes.
- Auditoría del compilado en 390, 944 y 1440 px, claro y oscuro. Recorre
  los títulos interactivos, verifica foco y registra capturas y accesibilidad.
- Los cuerpos JSON capturados en esa auditoría se validan con el servicio
  PHP real y repositorios en memoria. La suite del intérprete comprende
  212 pruebas de evidencia, ausencia y contrato.

Resultado final: **9 pruebas de interacción + 34 de regresión aprobadas**.
Se abrieron **96 explicaciones** en el compilado, sin desbordamiento,
errores de JavaScript ni infracciones en las comprobaciones WCAG A/AA
ejecutadas sobre el diálogo. Los **96 cuerpos JSON** fueron aceptados por
el intérprete real; sus **212 pruebas** también terminaron sin fallos.
Se verificó visualmente la eliminación de los botones y que el lanzador
del asistente no tape el texto del panel.

Evidencia local:
`documentacion/fuentes-maiz/descargas/explicaciones-20261110/`.
Para repetir la auditoría del compilado:

```powershell
node tools/auditar_explicaciones.cjs
```

La auditoría utiliza datos representativos definidos sólo en
`frontend-app/tests/fixtures/explanationData.mjs` y rutas interceptadas en
un navegador aislado. No escribe en bases de datos ni modifica las cuentas
o las simulaciones del usuario. El cambio del ejecutor de pruebas PHP
permite añadir esos contextos después de la suite; conserva el código de
salida de error si falla una comprobación.
