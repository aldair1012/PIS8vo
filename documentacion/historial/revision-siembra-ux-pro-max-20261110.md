# Siembra: claridad para productores agrícolas

Revisión del 10 de noviembre de 2026. Skill aplicada: `C:/Users/aldai/.codex/skills/ui-ux-pro-max/SKILL.md`.

## Problema observado

La pantalla daba un peso similar al plan del productor, las referencias de catálogo y los análisis estadísticos. Había controles duplicados, un selector de año que parecía cambiar el cultivo y textos técnicos que exigían interpretar la estructura interna del sistema.

## Organización aplicada

| Lectura | Contenido | Comportamiento |
| --- | --- | --- |
| Principal | Tu plan de siembra | Fecha prevista o realizada, fin aproximado, variedad, duración y agua o riego; una acción principal para completar o editar. |
| Opcional | Ver mis fechas en calendario | Se abre a petición; las fechas principales se pueden leer sin interpretar una cuadrícula. |
| Opcional | Consultar meses habituales de la zona | Meses de catálogo con su alcance explicado; no modifican el plan ni predicen el clima futuro. |
| Opcional | Consultar simulaciones guardadas | Resultados anteriores, filtro de año y orden. Cada resultado se puede pulsar para entenderlo. |
| Detalle | Estadísticas de las simulaciones | Requieren una segunda apertura explícita. Los promedios, la variación y los percentiles conservan su carácter descriptivo. |

Se usan frases cotidianas, etiquetas visibles y fechas completas. El año se elige dentro de las simulaciones; el selector superior de parcelas ya no mezcla año e identidad del cultivo en Siembra. La página ofrece una salida directa a Rendimiento para el análisis de resultados.

## Criterios UI UX Pro Max

La búsqueda específica de producto devolvió Agriculture/Farm Tech: diseño orgánico, plano y accesible. Se aplicaron las reglas pertinentes de jerarquía, acción principal, navegación, contraste, teclado, tamaño de controles, formularios y carga progresiva. Las recomendaciones de landing y tipografía de código no se trasladaron a la planificación agrícola.

La vista consume los colores compartidos de la aplicación: primitivas HSL en `palette.css` y semántica interna en `internal-system.css`. Los calendarios compartidos también consumen esos tokens en lugar de usar combinaciones aisladas. Se mantienen la familia tipográfica existente y React + Vite + CSS.

Las decisiones reutilizables se registraron en `design-system/zeasys/MASTER.md` y las reglas de esta pantalla en `design-system/zeasys/pages/siembra.md`.

## Fallos funcionales y de accesibilidad corregidos

- Cambiar el año reiniciaba el componente y cerraba la sección consultada. El componente conserva su estado para la misma parcela; el año filtra los cálculos.
- Guardar vaciaba la pantalla y perdía el foco. El plan se actualiza, se confirma el guardado y se devuelve el foco al botón de edición.
- Un fallo al refrescar después de guardar podía ocultar el plan confirmado. Ahora conserva el plan y ofrece volver a cargar la información.
- El formulario sólo mostraba un error general. Ahora valida los campos, conserva su contenido, presenta errores asociados y enfoca un resumen con enlaces a cada campo.
- Los valores usados en simulaciones podían confundirse con datos confirmados del plan. Se identifican y se copian sólo mediante una acción explícita del productor.
- Una fecha o duración de una campaña distinta podía mezclarse en la presentación. Se utiliza la fecha propia y se calcula el fin con una duración compatible.
- La lista de definiciones tenía una estructura HTML incorrecta. Las descripciones secundarias ahora están dentro de sus definiciones.
- Los controles de navegación del calendario eran pequeños. Se ampliaron a 44 × 44 px y se mejoró su distribución y lectura.
- La ventana de detalle del calendario quedaba fuera del ámbito de los colores internos. Ahora hereda el tema del espacio de trabajo.
- Cuando dos eventos coincidían en un día, sólo se podía leer el primero. El detalle muestra todos los eventos y el nombre accesible del día los identifica.
- El calendario tenía rótulos de tamaño muy reducido. Los días marcados muestran «Ver» y una indicación explica la interacción.

Los calendarios y gráficos secundarios se cargan al consultarlos. Los estados de carga, las ayudas y las confirmaciones emplean mensajes visibles. La paleta y el tamaño de los bloques se mantienen al cambiar de tema.

## Verificación realizada

- `npm run lint`: aprobado.
- Pruebas unitarias del frontend: 52 aprobadas.
- Nueva batería de UX: 20 casos distintos aprobados, incluidos formularios, errores, guardado, persistencia de la vista, calendarios, contraste y eventos simultáneos.
- Regresión de Siembra, planificación, explicaciones y referencia anual: 46 casos aprobados tras adaptar los selectores a la nueva organización.
- Dos casos de teclado aprobados.
- Revisión visual en 375, 768 y 1440 px, claro y oscuro; orientación horizontal y texto al doble de tamaño sin desbordamiento horizontal.
- Auditoría de accesibilidad del plan, formulario y contenido opcional en ambos temas: sin infracciones detectadas en las reglas ejecutadas.
- Comprobación de geometría al cambiar de tema: posiciones y tamaños de los bloques principales conservados, con tolerancia inferior a un píxel.
- Navegación real por las pestañas y configuración con cuenta ficticia: seis combinaciones de anchura y tema aprobadas.
- Guardado por la interfaz con API y MariaDB reales: el plan conserva duración y riego después de recargar.
- Integración HTTP: 24 recorridos correctos. El entorno, sus cuentas y su base desechable se eliminaron al terminar.
- Sobre la compilación de XAMPP: 84 aperturas de explicaciones entre Rendimiento y Siembra; sin errores JavaScript ni desbordamientos en esos paneles. Los 84 contextos pasaron el intérprete PHP, además de sus 212 pruebas.
- `npm run build`: aprobado y copiado a XAMPP. Se conserva el aviso previo sobre el tamaño del paquete de Rendimiento; no bloquea la compilación.

La revisión combina automatización y capturas con datos de prueba. Queda por hacer una prueba de comprensión con agricultores reales; no se atribuye a estas comprobaciones una garantía de comprensión inmediata para todas las personas.
