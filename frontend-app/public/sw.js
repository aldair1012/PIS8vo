// Service worker de ZeaSys. Alcance deliberadamente pequeño:
//  - Permite instalar la aplicación en el teléfono.
//  - Muestra una página clara cuando no hay conexión al abrir la aplicación.
//  - Conserva los recursos con hash (JS, CSS, imágenes) ya descargados para abrir más rápido.
// No intercepta la API ni otros orígenes, y no guarda respuestas con datos del usuario.
const SCOPE = self.registration.scope;
const PREFIX = `zeasys:${SCOPE}:`;
const VERSION = `${PREFIX}v2`;
const CACHE_BASE = `${VERSION}-base`;
const CACHE_ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = new URL('offline.html', SCOPE).href;
const MAX_ASSETS = 80;
// Archivos que genera Vite: nombre-hash8.ext dentro de /assets/.
const HASHED = /\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css|webp|svg|jpg|png|woff2?)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_BASE)
      .then((cache) => cache.addAll([OFFLINE_URL, './icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE_BASE && n !== CACHE_ASSETS).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function guardarAsset(request, response) {
  const cache = await caches.open(CACHE_ASSETS);
  await cache.put(request, response);
  const keys = await cache.keys();
  // Los builds anteriores dejan archivos obsoletos: se conservan solo los más recientes.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(SCOPE)) return;
  const path = url.pathname.slice(new URL(SCOPE).pathname.length);

  if (path === 'icons/icon-192.png' && !url.search) {
    event.respondWith(caches.open(CACHE_BASE).then(async cache => (await cache.match(request)) || fetch(request)));
    return;
  }

  if (request.mode === 'navigate' && ['', 'index.html', 'offline.html'].includes(path)) {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE_BASE)).match(OFFLINE_URL)));
    return;
  }

  if (!url.search && path.startsWith('assets/') && !path.slice(7).includes('/') && HASHED.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_ASSETS).then((cache) => cache.match(request)).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((response) => {
          if (response.ok && !response.redirected) event.waitUntil(guardarAsset(request, response.clone()).catch(() => {}));
          return response;
        });
      }),
    );
  }
});
