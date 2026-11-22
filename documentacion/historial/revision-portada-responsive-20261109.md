# Portada adaptable sin recortes — 9 de noviembre de 2026

## Defecto reproducido

La ventana del usuario (aproximadamente 944 × 994 píxeles útiles) activaba
una sola columna, pero la tarjeta conservaba 800 píxeles de altura. La
portada medía 1433,95 px y la tarjeta terminaba a 1354,66 px, fuera del
encuadre. Las caras del giro eran absolutas, por lo que su contenido no
podía determinar la altura. También había variantes de 820–940 px para
móvil y un desplazamiento automático que podía saltar el final de las
secciones largas.

## Cambios

- Las dos columnas se aprovechan desde 900 px, con proporciones y tipografía
  ajustadas para ventanas medianas. En ventanas más estrechas se apilan.
- La cara activa de la tarjeta determina la altura en el flujo normal:
  vista de parcela, acceso y registro. Se conservan el giro y las caras
  inactivas, sin reservar alturas ficticias ni cortar campos o botones.
- Se eliminan las alturas mínimas de 630–940 px. Los márgenes superiores
  consideran la altura de la navegación y el espacio vertical disponible.
- La vista ilustrativa deja de inclinarse, para mantener sus bordes y filas
  dentro de la tarjeta. Se conserva el contenido y no se incorporan datos.
- Los títulos de varias partes heredan el tamaño adaptable de su encabezado.
- En ventanas pequeñas, bajas, con movimiento reducido o con secciones más
  altas que la pantalla, el desplazamiento es libre y no salta contenido.
- El control de cerrar el acceso tiene un objetivo de 44 × 44 px y espacio
  superior propio.

Cambios limitados a `landing-system.css` y `views/landing/useSectionSnap.js`.
No se modifican los paneles internos ni las funciones de autenticación.

## Validación

La prueba de 944 × 994 reprodujo el defecto antes de aplicar los cambios.
La comprobación exige ahora que la tarjeta completa termine dentro del
encuadre, además de verificar ausencia de contenido cortado en ambos temas.

- `npm run lint`: aprobado.
- `npm run build`: aprobado y copiado a XAMPP.
- Playwright: **17 pruebas aprobadas**, con nueve tamaños de ventana
  (320 × 568 a 1920 × 1080), orientación horizontal, acceso y registro,
  navegación, desplazamiento libre y estabilidad entre claro y oscuro.

Las capturas del compilado y los resultados automáticos están en
`documentacion/fuentes-maiz/descargas/portada-responsive-20261109/`.
La captura `944-portada-light-viewport.png` reproduce el encuadre solicitado.
En ese caso, la tarjeta ahora termina a 834,58 px dentro de los 994 px de
alto disponibles. La revisión del compilado completó **24 casos** sin
recortes, diferencias de geometría entre temas, desbordamiento horizontal,
errores de JavaScript ni infracciones de las reglas WCAG A/AA ejecutadas
por axe. Incluye ambos temas y los estados de portada, acceso y registro.
Para repetir la auditoría visual en PowerShell:

```powershell
$env:ZEASYS_AUDIT_PROFILE = 'responsive'
node tools/auditar_portada_temas.cjs 944 390 1366 844
```

En móviles y ventanas muy bajas el contenido conserva su tamaño legible y
continúa mediante desplazamiento vertical normal. No se encoge toda la
página para forzar su entrada en una única pantalla.
