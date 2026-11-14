// Network-first Service Worker for WarungKu POS Realtime
const CACHE_NAME = 'warungku-pos-v3.0-realtime';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Let browser handle all requests directly over network to prevent ERR_FAILED from empty cache
  return;
});
