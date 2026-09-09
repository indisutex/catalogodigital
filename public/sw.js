const CACHE_NAME = 'indisutex-images-v4';
const IMAGE_CACHE_NAME = 'indisutex-media-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Interceptar solicitudes de manifest.json para aislar el PWA con el start_url del tenant actual
  if (url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('manifest.webmanifest')) {
    const tenantParam = url.searchParams.get('tenant') || '';
    const cleanTenant = tenantParam.replace(/^\/+|\/+$/g, '').trim().toLowerCase();

    // Logos y metadatos oficiales por tienda
    const KNOWN_STORE_LOGOS = {
      sublimados_majestic: 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1788193731295.webp',
      lucerito: 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1788197445120.webp',
      saramantha: 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1788197423178.webp',
      lovely: 'https://dowbsbxvxjzjjhyqmyfr.supabase.co/storage/v1/object/public/archivos/logo_1788197761050.webp'
    };

    const KNOWN_STORE_NAMES = {
      sublimados_majestic: 'Sublimados Majestic',
      lucerito: 'Pijamas Lucerito',
      saramantha: 'Saramantha',
      lovely: 'Lovely'
    };

    const KNOWN_STORE_COLORS = {
      sublimados_majestic: '#f50081',
      lucerito: '#cd8dff',
      saramantha: '#ff0fdf',
      lovely: '#d561ff'
    };

    const nameParam = url.searchParams.get('name') || KNOWN_STORE_NAMES[cleanTenant] || '';
    const colorParam = url.searchParams.get('color') || url.searchParams.get('theme') || KNOWN_STORE_COLORS[cleanTenant] || '#6366f1';
    const iconParam = url.searchParams.get('icon') || KNOWN_STORE_LOGOS[cleanTenant] || '/indisutex-logo.png';

    // Limpiar slug para determinar start_url y scope
    const appPath = cleanTenant ? `/${cleanTenant}` : '/';
    const displayName = nameParam || (cleanTenant ? cleanTenant.charAt(0).toUpperCase() + cleanTenant.slice(1).replace(/_/g, ' ') : 'Catálogo Digital');

    const iconType = iconParam.toLowerCase().endsWith('.svg')
      ? 'image/svg+xml'
      : (iconParam.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png');

    const dynamicManifest = {
      id: appPath,
      name: `${displayName} — Catálogo Digital`,
      short_name: displayName.length > 35 ? displayName.substring(0, 35).trim() : displayName,
      description: `Catálogo Digital e Interactivo de ${displayName}`,
      start_url: appPath,
      scope: appPath,
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#ffffff',
      theme_color: colorParam,
      icons: [
        {
          src: iconParam,
          sizes: '192x192',
          type: iconType,
          purpose: 'any'
        },
        {
          src: iconParam,
          sizes: '512x512',
          type: iconType,
          purpose: 'any'
        }
      ]
    };

    event.respondWith(
      new Response(JSON.stringify(dynamicManifest, null, 2), {
        headers: {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    );
    return;
  }

  // Solo interceptar peticiones GET
  if (request.method !== 'GET') return;

  // Interceptar imágenes (Supabase Storage, CDN, Unsplash o extensiones de imagen)
  const isImage = 
    request.destination === 'image' ||
    url.pathname.match(/\.(webp|jpg|jpeg|png|gif|svg|ico)$/i) ||
    url.hostname.includes('supabase.co') && url.pathname.includes('/storage/');

  if (isImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Si está en caché, devolverlo inmediatamente y revalidar en segundo plano (Stale-While-Revalidate)
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
