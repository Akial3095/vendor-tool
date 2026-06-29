/**
 * sw.js — Dark Forge Vendor Manager Service Worker
 * Strategia: Cache First per assets statici, Network First per API/Functions
 */

const CACHE_NAME = 'df-vendor-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ── Install: pre-cacha assets fondamentali ────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate: rimuove cache vecchie ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: strategia ibrida ───────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Netlify Functions e Supabase → Network Only (mai in cache)
  if (url.pathname.startsWith('/.netlify/functions/') ||
      url.hostname.includes('supabase.co') ||
      url.hostname.includes('api.scryfall.com') ||
      url.hostname.includes('api.pokemontcg.io')) {
    return; // lascia passare senza intercettare
  }

  // Scryfall / PokéTCG immagini carte → Cache First con fallback network
  if (url.hostname.includes('cards.scryfall.io') ||
      url.hostname.includes('images.pokemontcg.io')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  // HTML / JS / CSS e CDN → Network First con fallback cache
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp.ok && event.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
