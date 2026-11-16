# Revisión de la fase 2: rendimiento de entrega, instalación y orden (15/11/2026)

## Qué cambió

| Cambio | Archivos | Efecto |
|---|---|---|
| Compresión de texto | `.htaccess` (`mod_deflate`) | JS, CSS, HTML, JSON y SVG viajan comprimidos. El build informa tamaños comprimidos de 168 kB (ECharts), 117 kB (mapas) y 66 kB (Chart.js) frente a 506, 432 y 196 kB sin comprimir. |
| Caché larga para recursos con hash | `assets/.htaccess` | Los 58 archivos generados por Vite (`nombre-hash8.ext`) se conservan un año (`immutable`). Se limita a `assets/` para no afectar archivos subidos por usuarios. |
| Aplicación instalable | `frontend-app/public/manifest.webmanifest`, `icons/`, `index.html` | Se puede añadir a la pantalla de inicio con ícono propio (192, 512 y versión *maskable*). |
| Página sin conexión | `frontend-app/public/offline.html`, `sw.js` | Si se abre la aplicación sin internet se muestra una explicación y un botón para reintentar, en lugar del error del navegador. |
| Recursos ya descargados | `sw.js` | Se conservan en el dispositivo los archivos con hash (máximo 80). No se interceptan `backend-api/` ni otros orígenes, y no se guardan respuestas con datos del usuario. |
| Registro del service worker | `frontend-app/src/main.jsx` | Solo en producción y en contexto seguro (https o `localhost`). |
| `.env` fuera de Git | `.gitignore`, `frontend-app/.env.example` | El archivo local se conserva; cada instalación crea el suyo con su ID de cliente de Google. |
| Orden | `documentacion/prototipos/`, `documentacion/planes-internos/` | `maqueta-fertilizacion.html` salió de la raíz y `docs/` se unió a `documentacion/`. Ninguno tenía referencias. |

## Qué se revisó y no requirió cambios

- **Modelo 3D:** `CornCobModel` ya importa Three.js de forma diferida y solo al acercarse a la vista, con foto de respaldo.
- **ECharts:** ya usa importación modular (solo barras, líneas y los componentes necesarios). El tamaño restante es el núcleo de la librería.
- **Cálculos de Finanzas:** ya están en `financeBudget.js` con pruebas; las 1 272 líneas de `DashboardFinance.jsx` son sobre todo presentación.
- **Unificar Chart.js y ECharts:** no se hizo. Implica reescribir cuatro gráficos y perder las descripciones de accesibilidad de ECharts, y sin un navegador para comparar el resultado visual el riesgo es mayor que el beneficio. Ver recomendación abajo.

## Verificación realizada

- `npm test`: 61 pruebas correctas. `npm run lint`: sin avisos. `npm run build`: correcto y sincronizado con la raíz.
- Manifiesto: JSON válido, enlazado como `./manifest.webmanifest` en el `index.html` desplegado. `sw.js`: sintaxis válida.
- Las expresiones de caché se probaron con los nombres reales: 58 de 59 archivos de `assets/` quedan cubiertos (el restante es `zeasys-build-manifest.json`), y una ruta de avatar subido no coincide.

## Pendiente de comprobar en un navegador (no se pudo hacer en este entorno)

1. DevTools → Application → Manifest: sin errores, ícono visible y botón «Instalar».
2. Application → Service Workers: `sw.js` activo con alcance `/ZeaSys/`.
3. Con «Offline» activado, recargar: debe aparecer la página «No hay conexión».
4. Network → un archivo de `assets/`: `content-encoding: gzip` y `cache-control: public, max-age=31536000, immutable`. Si faltan, activar `mod_deflate` y `mod_headers` en `httpd.conf` de XAMPP.

## Recomendación sobre gráficos

Para decidir entre Chart.js y ECharts conviene un navegador y capturas antes/después de Finanzas, Clima y Rendimiento. Es preferible conservar ECharts (más accesible y ya cubre las vistas de datos) y migrar los cuatro gráficos de Chart.js, o dejar ambos si el uso de datos no es un problema real con la compresión activada.
