/**
 * sw.js — Dark Forge Vendor Manager Service Worker
 * Strategia: Cache First per assets statici, Network First per API/Functions
 */

const CACHE_NAME = 'df-vendor-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// ── Install ────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) return;
  const url = new URL(event.request.url);

  // API, Supabase, Scryfall API, Pokémon → Network Only (mai in cache)
  if (url.pathname.startsWith('/api/') ||
      url.hostname.includes('supabase.co') ||
      url.hostname.includes('api.scryfall.com') ||
      url.hostname.includes('api.pokemontcg.io') ||
      url.hostname.includes('api.cardtrader.com') ||
      url.hostname.includes('vercel.com')) {
    return;
  }

  // Immagini carte → Cache First
  if (url.hostname.includes('cards.scryfall.io') ||
      url.hostname.includes('images.pokemontcg.io')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Tutto il resto → Network First con fallback cache
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        
