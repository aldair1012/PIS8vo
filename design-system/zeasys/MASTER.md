# ZeaSys: decisiones de interfaz

Revisión del 10 de noviembre de 2026 con la skill UI UX Pro Max.

## Público y objetivo

Productores agrícolas que necesitan entender su parcela y actuar sin conocimientos de tecnología o estadística. Cada pantalla debe indicar para qué sirve, qué datos utiliza y cuál es la acción principal.

## Dirección verificada

La consulta `agriculture --domain product` de UI UX Pro Max identifica Agriculture/Farm Tech y recomienda diseño orgánico, plano y accesible. Se aplica esa combinación con superficies sencillas, iconos Lucide, jerarquía por tareas y ayudas breves.

La búsqueda de sistema visual también devolvió patrones de landing y una combinación de fuentes orientada a código. Esas recomendaciones no encajan con la planificación de un cultivo: se conserva la familia sans serif existente y la arquitectura React + Vite + CSS.

## Colores y componentes

- Primitivas HSL compartidas: `frontend-app/src/assets/palette.css`.
- Semántica interna y compatibilidad: `frontend-app/src/assets/internal-system.css`.
- La landing mantiene su capa específica en `frontend-app/src/assets/landing-system.css`.
- Los componentes de cada pantalla consumen los tokens compartidos, sin crear una paleta independiente.
- Verde agrícola para acciones, superficies neutras para lectura e información azul cuando corresponde. Los colores de peligro sólo acompañan errores o estados que los justifican.
- Los calendarios compartidos utilizan los mismos tokens en claro, oscuro y en sus ventanas de detalle.

## Reglas aplicadas

Una acción principal por tarea; texto cotidiano; detalles técnicos opcionales; controles de al menos 44 px donde corresponde; etiquetas visibles; errores junto a los campos y un resumen enfocable; navegación con teclado; ayudas que no dependan de hover; contraste comprobado por tema; movimiento reducido; texto ampliable; datos ausentes identificados; ausencia de datos sin cifras inventadas.

Las comprobaciones automáticas se complementan con capturas y revisión visual. No sustituyen una prueba de comprensión con agricultores.
