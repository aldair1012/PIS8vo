# Revisión final de Rendimiento — 9 de noviembre de 2026

Se revisó el recorrido desde la selección de parcela y ejecución guardada hasta los
indicadores, escenarios, factores del modelo, mediciones, comparación, referencias y
contexto del asistente. Los cambios están en el código y en la compilación servida
por XAMPP. Se usaron cuentas y una base desechables; no se reimportó ni borró la base
personal.

## Fallos corregidos

| Hallazgo | Corrección | Comprobación |
| --- | --- | --- |
| Un fallo de carga obligaba a salir de la pantalla; una respuesta mal formada podía bloquearla. | Botón para reintentar y validación de la estructura, parcela y ejecuciones antes de renderizar. El cero sigue siendo un resultado válido. | Error HTTP recuperable; respuesta nula, historial inválido, parcela equivocada, cero y parcela sin simulaciones. |
| Guardar mediciones sólo actualizaba el diálogo. El resumen de Rendimiento conservaba valores antiguos. | El guardado avisa a la aplicación y vuelve a consultar el resumen de la parcela correspondiente. | Cambio de profundidad de 100 a 80 cm: capacidad de agua de 200 a 160 mm sin salir de Rendimiento. |
| «Ver todos» añadía factores SHAP sin dar espacio suficiente a todas sus barras. | Altura del gráfico según sus filas, con contenedor limitado y desplazamiento por teclado. | Prueba con 20 factores y revisión del modelo real, en móvil y escritorio. |
| La comparación omitía entradas exclusivas de una ejecución y podía bloquearse si la otra no tenía entradas registradas. | Unión de los campos, lectura opcional y «—» para ausencias; nombres y unidades legibles. | Registros incompletos y cambio de las columnas actual/comparación. |
| El navegador enviaba la ejecución elegida, pero el contexto final del chat podía dar prioridad a la más reciente. | El servidor recupera y autoriza la ejecución por ID, cuenta y parcela. Sus resultados y entradas tienen prioridad; no mezcla ingresos derivados de otra ejecución. | Cifra manipulada en el navegador descartada; ejecución antigua conservada; selección ajena o inexistente rechazada. |
| El contexto del asistente podía describir la calidad global interna del modelo como confianza de una predicción. | Campo explícito de calidad R² global e instrucción que lo distingue de una probabilidad de cosecha. | Revisión de la salida del predictor y del contexto enviado al proveedor. |
| La provincia de referencia podía depender del texto de la ubicación en lugar de las coordenadas disponibles. | El servicio resuelve la provincia con la cartografía local y la entrega también cuando no hay simulaciones. La pantalla respeta ese resultado. | Coordenadas de Manabí con texto «Guayas»; parcela sin simulaciones; ausencia de consultas Nominatim en el recorrido actualizado. |
| Las referencias desplegadas saltaban un nivel de títulos y sus enlaces tenían contraste insuficiente en tema oscuro. | Título de nivel 2 y enlaces con el color semántico del tema, subrayado y altura mínima de 44 px. | Auditoría automatizada y capturas de los paneles abiertos. |

Se corrigió también la selección visual de escenarios cuando una ejecución antigua
no conserva la alternativa elegida. La comparación conserva advertencias sobre
superficies y versiones diferentes del modelo. El historial aclara cuántas ejecuciones
muestra y que Rendimiento carga las 50 más recientes; el historial completo sigue
en «Simulaciones guardadas». El mapa se identifica como esquema de ubicación, sin
atribuirlo a una edición cartográfica no comprobada.

## Verificación

- `npm run lint` y `npm run build`: correctos; compilación copiada a XAMPP.
- `npm test`: 41 pruebas correctas.
- `npx playwright test rendimiento.spec.js --workers=1`: 12 pruebas correctas.
- Suite PHP de analítica de rendimiento: 10 pruebas correctas.
- Suite PHP de chat: 44 pruebas correctas.
- Integración HTTP con MariaDB desechable y el modelo local: 21 grupos de
  recorridos correctos antes de la revisión en navegador, más limpieza final.
  Incluye el rechazo de selecciones inválidas y el fallo controlado del proveedor
  del chat, desconectado deliberadamente en esa prueba.
- Pantalla principal: seis combinaciones de 390, 820 y 1440 px, en claro y oscuro.
- Paneles abiertos: 16 revisiones de referencias, todos los factores, comparación
  y registro de campo, a 390 y 1440 px en ambos temas.
- En las 22 revisiones visuales automatizadas: sin errores JavaScript,
  desbordamientos de la página ni infracciones detectadas por axe en las reglas
  ejecutadas. Las tablas y los factores pueden desplazarse dentro de su región.
- La verificación general previa de esta ronda también completó las 68 pruebas
  del motor Python. No se alteraron los pesos del modelo en esta revisión.

Las pruebas funcionales nuevas reprodujeron los fallos antes de corregirlos. Los
paneles desplegados se inspeccionaron además con capturas, incluyendo móvil en
claro y oscuro. Los enlaces externos se conservaron; no se verificó en esta ronda
el contenido de cada publicación externa ni se generaron respuestas reales del
proveedor de lenguaje.

## Reproducir las pruebas

Desde `frontend-app`, ejecutar `npm test`, `npm run lint` y `npm run build`.
Para las pruebas funcionales con API interceptada, usar
`VITE_API_BASE_URL=http://127.0.0.1:5500/backend-api/public/index.php` sólo durante
Playwright; retirar esa variable antes de compilar para XAMPP.

Para la revisión real, ejecutar `python backend-api/tests/integracion/ejecutar.py
--mantener` desde la raíz y usar la URL aleatoria que imprime como variable
`ZEASYS_E2E_ORIGIN`. `tools/auditar_ui.cjs` permite limitar las vistas a Rendimiento;
`tools/auditar_rendimiento.cjs` recorre sus paneles abiertos. Requieren Playwright,
Chrome y axe-core en la ruta indicada dentro de esos scripts. Pulsar Enter en la
integración al terminar elimina el entorno ficticio.

Los logs, JSON y capturas locales están en
`documentacion/fuentes-maiz/descargas/rendimiento-*20261109*`; esa carpeta temporal
no forma parte de la entrega académica. Los scripts y las pruebas sí se incluyen.

## Límites

Este resultado acredita los recorridos comprobados, no la ausencia universal de
bugs. No valida la precisión agrícola con cosechas independientes. Las cifras de
las capturas proceden de la parcela ficticia; no son nuevos datos del agricultor.
El compilador mantiene un aviso no bloqueante sobre el tamaño del módulo de
Rendimiento y su librería de gráficos, aproximadamente 612 kB antes de gzip; es una
posible optimización futura, sin impedir la compilación ni los recorridos probados.
