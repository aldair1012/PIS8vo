# Sistema visual de la landing de ZeaSys

## Alcance

Esta fase cubre únicamente la página pública de acceso (`Login.jsx`). Los dashboards, mapas, simuladores y el chatbot mantienen su sistema visual actual hasta una fase posterior.

## Dirección visual

La landing sigue una composición **Organic Systems**: fondos agrícolas, geometría contenida, líneas de cultivo y superficies estructuradas. La fotografía del hero es una pieza de marca estable y conserva el mismo tratamiento oscuro y difuminado en los modos claro y oscuro.

La distribución cromática usa el principio 60/30/10:

- **60 % — base:** bosque profundo en oscuro y verde papel en claro.
- **30 % — superficies:** tarjetas, paneles y secciones elevadas.
- **10 % — acento:** verde lima para acciones y estados; dorado maíz para navegación activa y detalles.

## Arquitectura de tokens

La fuente de verdad está en `frontend-app/src/assets/landing-system.css` y usa tres niveles:

1. **Primitivos:** colores, espacios, radios y duraciones (`--zs-forest-950`, `--zs-space-4`).
2. **Semánticos:** función dentro del tema (`--zs-page-bg`, `--zs-text`, `--zs-action`).
3. **Componentes:** compatibilidad y necesidades específicas (`--home-bg`, `--home-green`).

El modo claro sustituye valores semánticos. Los componentes no deben redefinir colores directos salvo cuando una pieza mantiene una dirección artística deliberadamente fija, como el hero o el footer.

## Reglas de componentes

- Navbar de altura normal, conectado al borde superior y animado al mostrarse u ocultarse.
- Botones y controles táctiles de al menos 44 px.
- Estados `hover`, `focus-visible`, activo y reducido movimiento.
- Tarjetas de capacidades giratorias mediante cursor o foco de teclado.
- Secciones principales con una presencia cercana al alto completo de la pantalla, sin forzar recortes cuando el contenido necesita crecer.
- Patrón agrícola visible detrás del contenido, con contraste moderado y sin interferir con la lectura.

## Validación mínima

- Modos claro y oscuro.
- Anchos de 390, 768, 1024 y 1440 px.
- Navegación con teclado.
- Zoom del navegador y preferencia de movimiento reducido.
- `npm run lint` y `npm run build`.

## Recursos y mantenimiento

- Las fotografías activas tienen una sola fuente en `frontend-app/src/assets/landing/` y se importan desde React. Vite genera sus rutas con hash para desarrollo y XAMPP bajo `/ZeaSys/`.
- La imagen de respaldo de la mazorca 3D reutiliza `field-decisions.jpg`. No duplicar fotografías en `public/images/` o `images/`.
- `public/models/` contiene el modelo y sus texturas; sus copias desplegadas son necesarias.
- Los archivos de `assets/` y `index.html` en la raíz son el despliegue XAMPP, no fuentes duplicadas que deban borrarse manualmente.
- `copy-build.js` registra los recursos compilados en `assets/zeasys-build-manifest.json`. Solo retira recursos de la compilación anterior; conserva archivos ajenos y SVG de la raíz, e informa los fallos con código de salida distinto de cero.
- La limpieza retiró 194 selectores de componentes abandonados (collage, métricas decorativas, etiquetas y antigua sección de acceso) y 91 reglas idénticas. Se conserva la última copia de cada regla en su contexto CSS para respetar la cascada.
- Se archivaron 14 imágenes antiguas o duplicadas fuera del proyecto, conservando copia recuperable. No se modificaron bases de datos, registros de usuarios, modelos predictivos ni fuentes RAG.
