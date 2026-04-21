// sw.js - MODO DESENVOLVIMENTO (SEM CACHE)
// Este service worker não armazena nada em cache

self.addEventListener('install', event => {
    console.log('Service Worker instalado - Modo desenvolvimento');
    self.skipWaiting(); // Força ativação imediata
});

self.addEventListener('activate', event => {
    console.log('Service Worker ativado - Limpando caches');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    console.log('Deletando cache:', cache);
                    return caches.delete(cache);
                })
            );
        })
    );
    return self.clients.claim(); // Toma controle imediato
});

self.addEventListener('fetch', event => {
    // SEMPRE buscar da rede, nunca do cache
    event.respondWith(fetch(event.request));
});