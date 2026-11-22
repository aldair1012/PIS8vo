# Portada: estabilidad entre temas — 9 de noviembre de 2026

## Problema reproducido

Al alternar entre oscuro y claro con el mismo tamaño de ventana, el título
«Decisiones mejores para cada parcela.» cambiaba de cuatro a tres líneas.
El cambio de altura de la cabecera desplazaba la tarjeta de acceso y todas
las secciones siguientes.

La causa era una regla tardía para `.zeasys-home-hero-copy h1`: tenía la misma
especificidad que la regla oscura y menor especificidad que la clara. Por eso
solo el modo oscuro recibía otro interlineado y espaciado entre letras.
En Chrome, a 1920 × 1000, se observaron 451,94 px frente a 304,08 px de altura
del título, y un desplazamiento de aproximadamente 49,53 px de la tarjeta.

## Corrección

- Se eliminó la regla tipográfica duplicada. Ambos temas usan la misma
  declaración para el título y su `span`, incluidos sus ajustes adaptables.
- La superficie de navegación se controla con tokens de la portada:
  primitivos de color → superficie semántica → alias del componente.
- La barra clara tiene un 82 % de opacidad (18 % de transparencia), con
  desenfoque de fondo y texto oscuro. El modo oscuro conserva un 94 %.
- El selector de esa superficie supera la especificidad del CSS heredado;
  las medidas y los puntos de cambio adaptables siguen compartidos.
- Se conserva la fotografía, la difusión oscura y el panel de acceso en
  ambos temas. Los cambios se limitan a `landing-system.css`.
- Se declara el mismo `color-scheme: dark` en el hero para mantener
  coherentes los controles nativos del panel. El recorte del marco del
  iframe oficial de Google sigue su forma de píldora y elimina las esquinas
  blancas del contenedor sin modificar el botón ni su lógica de acceso.

## Verificación reproducible

`frontend-app/tests/e2e/landing.spec.js` compara dimensiones, coordenadas y
métricas tipográficas al cambiar oscuro → claro → oscuro, en portada, acceso
y registro, a 390, 768, 1440 y 1920 px. También comprueba la transparencia y
el desenfoque de la barra, el menú móvil y la ausencia de desbordamiento.
La nueva prueba reprodujo el defecto antes de corregirlo.

- `npm run lint`: aprobado.
- `npx playwright test landing.spec.js --workers=1`: 7 pruebas aprobadas.
- `npm run build`: aprobado y copiado al directorio servido por XAMPP.

La revisión visual del compilado se ejecuta con
`node tools/auditar_portada_temas.cjs`. Produce capturas y un JSON en
`documentacion/fuentes-maiz/descargas/portada-temas-20261109/`.
Compara ambos temas en los tres estados y cuatro anchos; en escritorio
grande conserva las animaciones normales y carga el botón oficial de Google
sin iniciar sesión. En los otros anchos verifica el estado de proveedor no
disponible. Incluye comprobaciones automáticas de accesibilidad con axe.

Resultado del compilado final: **24 casos**, sin diferencias de geometría
entre temas (tolerancia visual de 0,05 px), sin desbordamiento horizontal,
sin errores de JavaScript y sin infracciones detectadas por axe en las
reglas WCAG A/AA ejecutadas. El botón oficial de Google estuvo cargado en
los cuatro casos de acceso/registro del escritorio grande; se revisó
visualmente la desaparición de las esquinas blancas. No se inició sesión
ni se modificaron cuentas o datos personales durante estas comprobaciones.
