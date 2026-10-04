const CACHE_NAME = 'kjv-reader-offline-v2';
const ALLOWED_RESOURCE_ORIGINS = new Set([
  self.location.origin,
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);

const shellUrls = [
  new URL('./', self.registration.scope).href,
  new URL('./index.html', self.registration.scope).href,
  new URL('./kjv-scripture.js', self.registration.scope).href,
  new URL('./apocrypha-scripture.js', self.registration.scope).href,
  new URL('./manifest.webmanifest', self.registration.scope).href,
  new URL('./icons/icon-192.png', self.registration.scope).href,
  new URL('./icons/icon-512.png', self.registration.scope).href,
  new URL('./icons/icon-maskable-192.png', self.registration.scope).href,
  new URL('./icons/icon-maskable-512.png', self.registration.scope).href,
  new URL('./icons/apple-touch-icon.png', self.registration.scope).href,
  new URL('./icons/favicon-32.png', self.registration.scope).href
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(shellUrls))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('kjv-reader-offline-') && cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'PREPARE_OFFLINE' || !event.ports[0]) return;

  const replyPort = event.ports[0];
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const warnings = [];
    const resourceUrls = [...new Set(event.data.urls || [])];

    for (const resourceUrl of resourceUrls) {
      let url;
      try {
        url = new URL(resourceUrl);
      } catch {
        warnings.push('An invalid resource URL was skipped.');
        continue;
      }

      if (!ALLOWED_RESOURCE_ORIGINS.has(url.origin) || url.protocol !== 'https:' && url.origin !== self.location.origin) {
        continue;
      }

      try {
        const request = new Request(url.href, {
          mode: url.origin === self.location.origin ? 'same-origin' : 'no-cors',
          credentials: 'omit'
        });
        const response = await fetch(request);
        if (!response.ok && response.type !== 'opaque') {
          warnings.push(`An optional resource could not be downloaded (${url.hostname}).`);
          continue;
        }
        await cache.put(request, response);
      } catch (error) {
        console.warn('Could not cache an optional offline resource:', url.href, error);
        warnings.push(`An optional resource could not be downloaded (${url.hostname}).`);
      }
    }

    replyPort.postMessage({ success: true, warnings });
  })().catch(error => {
    console.error('Could not prepare the Bible reader for offline use:', error);
    replyPort.postMessage({
      success: false,
      error: 'The reader or scripture files could not be downloaded. Check your connection and try again.'
    });
  }));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (!ALLOWED_RESOURCE_ORIGINS.has(requestUrl.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        await cache.put(new URL('./index.html', self.registration.scope), response.clone());
        return response;
      } catch (error) {
        const cachedPage = await caches.match(request)
          || await caches.match(new URL('./index.html', self.registration.scope));
        if (cachedPage) return cachedPage;
        throw error;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cachedResource = await caches.match(request);
    if (cachedResource) return cachedResource;

    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
