# Revisión de Siembra — 9 de noviembre de 2026

Se revisó la pestaña que sigue a Rendimiento: selección de parcela y año, resumen,
percentiles, matriz de ejecuciones, calendario, resultados desplegables,
explicaciones y contexto del asistente. Se mantuvo React, Vite y CSS. Las pruebas
reales usaron una cuenta y bases desechables, sin importar la base personal.

## Hallazgos y correcciones

| Problema comprobado | Resultado de la corrección |
| --- | --- |
| Cambiar de año producía `setAnioSeleccionado is not a function`. | Se conectó el setter que recibe Navbar. El año elegido llega a la consulta y cambia los datos. |
| Los años disponibles procedían de las fechas de las parcelas. Una ejecución guardada en otro año podía quedar inaccesible desde el selector. | Siembra aporta los años del historial de la cuenta. Se conservan también los años de las parcelas y la selección actual; un año sin ejecuciones de este lote se muestra como muestra vacía. |
| Un fallo de conexión no ofrecía reintento. Una respuesta nula, incompleta o de otra parcela se confundía con ausencia de resultados. | Validación de la respuesta, aviso accesible y reintento desde la misma pestaña. Se descartan respuestas antiguas al cambiar de selección. |
| La provincia del calendario se deducía sólo del texto de ubicación. | Se usa el mismo resolver de coordenadas local que en Rendimiento, con su procedencia y el respaldo textual existente cuando corresponde. |
| En provincias como Loja se mezclaban ventanas del catálogo para maíz duro y suave. | Se excluyen familias incompatibles cuando están identificadas en el registro y el catálogo; se conserva la familia de la referencia en su explicación. No se construyen ventanas nuevas. |
| Sin simulaciones de un año desaparecía también el calendario. | El calendario conserva las referencias disponibles. Media y percentiles quedan nulos; la muestra vale cero. No se transforma la ausencia de registros en un rendimiento cero. |
| La presentación insinuaba una viabilidad o evento favorable sin un modelo de riesgo. | La pestaña se identifica como Siembra, el riesgo indica «No evaluado», las ventanas son referencias de catálogo y su leyenda no afirma condiciones futuras favorables. Se retiró una barra redundante que podía parecer un porcentaje de aptitud. |
| El calendario podía salir del año consultado; «Hoy» trasladaba a otro periodo. | La navegación de Siembra queda dentro de enero–diciembre del año seleccionado. «Mes actual» conserva ese año. Los meses de la vista anual abren el mes correspondiente en el calendario. Se conserva febrero de 29 días cuando corresponde. |
| Algunas tarjetas y resultados desplegables dependían del ratón. | Controles nativos con teclado, estado expandido, foco visible y cierre con Escape de los detalles. Las explicaciones devuelven el foco al control que las abrió. |
| Cambiar de año podía conservar una explicación pendiente del periodo anterior. | El estado de la pestaña y sus explicaciones se reinicia con la clave de parcela y año. El contexto de la vista anterior se limpia al cargar o fallar. |
| La explicación de un resultado podía mostrar la unidad dos veces. | Se envía un valor numérico y su unidad en campos separados. La comparación y los percentiles usan formato numérico `es-EC`. |
| El chat no conservaba los percentiles y calendario de Siembra al combinar el contexto agrícola. | El servidor construye el resumen de la parcela y año autorizados. El contexto final conserva su media, percentiles, muestra y ventanas; una muestra vacía no se reemplaza con el último rendimiento de otro año. El navegador conserva hasta 24 ventanas y el resumen descriptivo. |
| Con muchas ejecuciones la matriz podía crecer demasiado y comprimir columnas. | Región desplazable de hasta 420 px, columnas con anchura suficiente y foco de teclado. Los encabezados móviles heredaban una altura mínima de 200 px destinada a gráficos. Se corrigió esa excepción en la capa CSS de Siembra. |
| Los paneles abiertos tenían problemas adicionales de accesibilidad. | Se corrigieron el contraste de selección y del botón de análisis, y los contenedores con rol de anuncio. Los detalles abiertos se comprobaron con axe y capturas. |

El límite de consulta permanece en 50 ejecuciones guardadas recientes por año y
parcela y ahora es visible. La muestra incluye sus rendimientos válidos. Los
percentiles y el CV describen esa muestra; no son
probabilidades de cosecha ni mediciones de variación entre campañas.

## Validación

- 14 pruebas funcionales específicas de Siembra. Las ocho iniciales reprodujeron
  fallos antes de las correcciones. Las restantes comprueban calendario bisiesto,
  muestras vacías, respuestas tardías, cambio de explicación, contexto del chat y
  años del historial.
- Regresión de navegador: 12 pruebas de Rendimiento y dos de navegación con
  teclado; 28 pruebas correctas en el recorrido combinado. Después de los últimos
  ajustes de presentación y unidades se repitieron las 14 de Siembra.
- 41 pruebas de utilidades del frontend y verificación general del proyecto.
- 19 pruebas PHP de clima/escenarios y 46 de chat, además de las restantes suites
  del verificador; 68 pruebas del motor Python.
- Integración HTTP nueva con MariaDB desechable y motor local: 22 grupos de
  recorridos correctos y limpieza final. Se comprobó la provincia por coordenadas,
  años del historial, calendario sin simulaciones y conexión del resumen al chat.
  El proveedor de lenguaje estuvo desconectado de forma intencional: su fallo
  devolvió el error controlado previsto.
- `npm run lint`, `npm run build` y copia de la compilación a XAMPP.
- Seis revisiones de la vista principal a 390, 820 y 1440 px, en claro y oscuro.
- Otras 16 revisiones en móvil y escritorio, en ambos temas: muestra de 50
  ejecuciones, detalle del calendario, resultado con explicación y parcela sin
  simulaciones. Sin infracciones detectadas por axe en las reglas ejecutadas,
  errores JavaScript ni desbordamiento de la página al finalizar la revisión.

## Reproducción y evidencias

1. Desde `frontend-app`, ejecutar `npm test` y `npm run lint`.
2. Para las pruebas con API interceptada, definir temporalmente
   `VITE_API_BASE_URL=http://127.0.0.1:5500/backend-api/public/index.php` y ejecutar
   `npx playwright test siembra.spec.js rendimiento.spec.js keyboard.spec.js
   --workers=1`. Retirar esa variable antes de `npm run build` para XAMPP.
3. Desde la raíz, ejecutar
   `python backend-api/tests/integracion/ejecutar.py --mantener` y usar la URL
   aleatoria como `ZEASYS_E2E_ORIGIN`. Ejecutar `tools/auditar_ui.cjs` con
   `ZEASYS_AUDIT_VIEWS=Siembra` y después `node tools/auditar_siembra.cjs`.
   Estas herramientas requieren Chrome, Playwright y la instalación temporal de
   axe-core indicada en sus fuentes. Al terminar, pulsar Enter en la integración.

Logs y capturas locales: `documentacion/fuentes-maiz/descargas/siembra-*20261109*`.
La carpeta temporal no se incluye en el paquete docente; el informe, código,
scripts y pruebas sí se incluyen.

## Alcance y límites

No se modificaron los pesos de XGBoost ni se agregaron resultados agrícolas. La
referencia de siembra procede del catálogo local existente; no se presenta como
validación de una fecha óptima para una variedad, riego o campaña concretos. No se
realizó en esta ronda una consulta real al proveedor de lenguaje. Las pruebas
acreditan los recorridos comprobados y no una ausencia universal de errores ni
precisión agronómica validada con cosechas independientes.
