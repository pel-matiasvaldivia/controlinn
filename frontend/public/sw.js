// ControlInn - Service Worker para soporte offline PWA
const CACHE_NAME = 'controlinn-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/index.css',
];

// Instalación: pre-cachear el shell de la aplicación
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-cacheando app shell...');
      // Intentar cachear pero no fallar si alguno no está disponible en dev
      return Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

// Activación: limpiar caches viejos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando nuevo Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Eliminando cache obsoleto:', name);
            return caches.delete(name);
          })
      );
    })
  );
  return self.clients.claim();
});

// Fetch: Estrategia mixta
// - API: Network First (siempre intenta la red, cae a cache si falla)
// - Streams HLS: Network Only (no cacheamos streams de video)
// - Assets estáticos: Cache First (rápido, offline-first)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptar requests a chrome-extension ni otras extensiones
  if (!url.protocol.startsWith('http')) return;

  // Streams HLS: Network Only
  if (url.pathname.startsWith('/streams')) {
    return; // Dejar pasar sin interceptar
  }

  // Llamadas API: Network First
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => {
          // Si falla la red, retornar respuesta offline JSON
          return new Response(
            JSON.stringify({ error: 'Sin conexión. Usando modo offline.' }),
            { headers: { 'Content-Type': 'application/json' }, status: 503 }
          );
        })
    );
    return;
  }

  // Assets estáticos: Cache First, con fallback a red
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((response) => {
        // Cachear respuesta exitosa de la red para uso futuro
        if (response.ok && request.method === 'GET') {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
        }
        return response;
      });
    })
  );
});
