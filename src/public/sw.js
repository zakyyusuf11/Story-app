// Service Worker untuk Story App
const CACHE_NAME = 'story-app-zaky-v1';
const RUNTIME_CACHE = 'runtime-cache-v1';
const API_BASE = 'https://story-api.dicoding.dev/v1';

/**
 * Mendapatkan base path dari lokasi service worker
 * Berguna untuk deployment di GitHub Pages atau subdirectory
 */
function getBasePath() {
  const swLocation = self.location.pathname;
  console.log('[SW] Service Worker location:', swLocation);

  // Cek jika ada base path khusus (misal untuk GitHub Pages)
  // Contoh: /repo-name/sw.js -> base = /repo-name
  const pathSegments = swLocation.split('/').filter(segment => segment && segment !== 'sw.js');
  
  if (pathSegments.length > 0) {
    const base = '/' + pathSegments.join('/');
    console.log('[SW] Detected base path:', base);
    return base;
  }

  return '';
}

// App Shell files - file utama yang di-cache untuk offline access
function getAppShellFiles(basePath = '') {
  return [
    `${basePath}/index.html`,
    `${basePath}/`,
    `${basePath}/favicon.png`,
    `${basePath}/images/logo.png`,
    `${basePath}/manifest.json`,
  ];
}

/* ------------------------- IndexedDB Helper untuk Outbox ------------------------- */
const IDB_DB_NAME = 'service-worker-db';
const IDB_STORE_NAME = 'outbox';
const IDB_VERSION = 1;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbAdd(item) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const q = store.add(item);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}

async function idbGetAll() {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    const q = store.getAll();
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}

async function idbDelete(id) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const q = store.delete(id);
    q.onsuccess = () => resolve();
    q.onerror = () => reject(q.error);
  });
}

/* ------------------------- Install Event - Cache App Shell ------------------------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  const basePath = getBasePath();
  const appShellFiles = getAppShellFiles(basePath);

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log('[SW] Caching App Shell files:', appShellFiles);

        // Cache files dengan Promise.allSettled untuk error handling yang lebih baik
        const cacheResults = await Promise.allSettled(
          appShellFiles.map(async (url) => {
            try {
              const response = await fetch(url);
              if (response && response.ok) {
                await cache.put(url, response);
                console.log('[SW] ✓ Cached:', url);
                return { url, success: true };
              } else {
                console.warn(`[SW] ✗ Failed to cache ${url}: HTTP ${response.status}`);
                return { url, success: false };
              }
            } catch (error) {
              console.warn(`[SW] ✗ Error caching ${url}:`, error.message);
              return { url, success: false };
            }
          })
        );

        const successCount = cacheResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        console.log(`[SW] App Shell cached: ${successCount}/${appShellFiles.length} files`);
      } catch (error) {
        console.error('[SW] Install error:', error);
      }
    })()
  );

  // Aktifkan service worker segera tanpa menunggu tab ditutup
  self.skipWaiting();
});

/* ------------------------- Activate Event - Cleanup Old Caches ------------------------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE)
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });

        await Promise.all(deletePromises);
        console.log('[SW] Old caches cleaned up');
      } catch (error) {
        console.error('[SW] Activate cleanup error:', error);
      }

      // Ambil kontrol semua clients
      await self.clients.claim();
      console.log('[SW] Service worker activated and claimed clients');
    })()
  );
});

/* ------------------------- Helper: Safe Cache Put ------------------------- */
async function safeCachePut(cacheName, request, response) {
  try {
    if (!response || response.status !== 200 || response.type !== 'basic') {
      return;
    }
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('[SW] Cache put failed:', error);
  }
}

/* ------------------------- Helper: Parse Request Body ------------------------- */
async function parseRequestBody(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const clonedRequest = request.clone();
    
    if (contentType.includes('application/json')) {
      const text = await clonedRequest.text();
      return text ? JSON.parse(text) : null;
    }
    
    const text = await clonedRequest.text();
    return text || null;
  } catch (error) {
    console.warn('[SW] Failed to parse request body:', error);
    return null;
  }
}

/* ------------------------- Fetch Event Handler ------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (kecuali untuk API POST yang ditangani khusus)
  if (request.method !== 'GET') {
    // Handle API POST/PUT/DELETE requests
    if (url.origin === new URL(API_BASE).origin) {
      event.respondWith(handleNonGETApiRequest(request));
    }
    return;
  }

  // Skip dev server endpoints
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const devPaths = ['/sockjs-node', '/ws', '/webpack-dev-server', '/__webpack', '/hot-update'];
  if (isLocalhost && devPaths.some(path => url.pathname.includes(path))) {
    return;
  }

  // API requests - Network First dengan cache fallback
  if (url.origin === new URL(API_BASE).origin) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // HTML navigation requests - Network First dengan App Shell fallback
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Static assets (CSS, JS, images, fonts) - Cache First
  event.respondWith(handleStaticAssetRequest(request));
});

/**
 * Handle API requests dengan Network First strategy
 */
async function handleApiRequest(request) {
  try {
    // Coba network dulu
    const networkResponse = await fetch(request);
    
    // Cache response jika berhasil
    if (networkResponse && networkResponse.ok) {
      safeCachePut(RUNTIME_CACHE, request, networkResponse);
    }
    
    return networkResponse;
  } catch (error) {
    // Network gagal, coba dari cache
    console.log('[SW] Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    // Tidak ada di cache, return offline response
    return new Response(
      JSON.stringify({ 
        error: true, 
        message: 'Offline: Data tidak tersedia',
        offline: true 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Handle navigation requests dengan Network First dan App Shell fallback
 */
async function handleNavigationRequest(request) {
  const basePath = getBasePath();
  
  try {
    // Coba network dulu
    const networkResponse = await fetch(request);
    
    // Cache HTML response jika berhasil
    if (networkResponse && networkResponse.ok) {
      safeCachePut(CACHE_NAME, request, networkResponse);
    }
    
    return networkResponse;
  } catch (error) {
    // Network gagal, return cached App Shell
    console.log('[SW] Offline - returning cached App Shell');
    
    // Coba beberapa fallback paths
    const fallbackPaths = [
      `${basePath}/index.html`,
      `${basePath}/`,
      '/index.html',
      '/',
    ];

    for (const path of fallbackPaths) {
      const cached = await caches.match(path);
      if (cached) {
        console.log('[SW] Found cached App Shell at:', path);
        return cached;
      }
    }

    // Last resort - return basic offline page
    return new Response(
      '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Offline</title></head><body><h1>Aplikasi sedang offline</h1><p>Silakan cek koneksi internet Anda dan refresh halaman.</p></body></html>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

/**
 * Handle static asset requests dengan Cache First strategy
 */
async function handleStaticAssetRequest(request) {
  // Cek cache dulu
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Tidak ada di cache, fetch dari network
  try {
    const networkResponse = await fetch(request);
    
    // Cache jika response valid
    if (networkResponse && networkResponse.ok) {
      safeCachePut(RUNTIME_CACHE, request, networkResponse);
    }
    
    return networkResponse;
  } catch (error) {
    // Network error - return cached version jika ada
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Tidak ada cache, return error
    return new Response('Resource tidak tersedia', { status: 503 });
  }
}

/**
 * Handle non-GET API requests (POST, PUT, DELETE) dengan offline queue
 */
async function handleNonGETApiRequest(request) {
  const requestClone = request.clone();
  
  try {
    // Coba network dulu
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (networkError) {
    // Network gagal, queue request untuk sync nanti
    try {
      const body = await parseRequestBody(requestClone);
      const headers = {};
      for (const [key, value] of requestClone.headers.entries()) {
        headers[key] = value;
      }

      const queuedItem = {
        url: requestClone.url,
        method: requestClone.method,
        headers,
        body,
        timestamp: Date.now(),
      };

      const id = await idbAdd(queuedItem);
      console.log('[SW] Request queued in outbox, id:', id);

      // Register background sync jika tersedia
      if ('sync' in self.registration) {
        try {
          await self.registration.sync.register('outbox-sync');
          console.log('[SW] Background sync registered');
        } catch (syncError) {
          console.warn('[SW] Background sync registration failed:', syncError);
        }
      }

      return new Response(
        JSON.stringify({ queued: true, id, message: 'Request akan di-sync saat online' }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (queueError) {
      console.error('[SW] Failed to queue request:', queueError);
      return new Response(
        JSON.stringify({ error: 'Failed to queue request' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
}

/* ------------------------- Background Sync Event ------------------------- */
self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncOutbox());
  }
});

/**
 * Sync queued requests dari outbox
 */
async function syncOutbox() {
  try {
    const queuedItems = await idbGetAll();
    if (!queuedItems || queuedItems.length === 0) {
      console.log('[SW] No items to sync');
      return;
    }

    console.log(`[SW] Syncing ${queuedItems.length} queued items`);

    for (const item of queuedItems) {
      try {
        const headers = new Headers(item.headers || {});
        let body = null;

        if (item.body !== null && item.body !== undefined) {
          if (typeof item.body === 'object') {
            body = JSON.stringify(item.body);
            if (!headers.has('content-type')) {
              headers.set('content-type', 'application/json');
            }
          } else {
            body = String(item.body);
          }
        }

        const response = await fetch(item.url, {
          method: item.method,
          headers,
          body,
        });

        if (response.ok) {
          // Success - hapus dari outbox
          await idbDelete(item.id);
          console.log('[SW] ✓ Synced and removed item:', item.id);
        } else {
          // Server error - hapus jika 4xx, keep jika 5xx untuk retry
          if (response.status >= 400 && response.status < 500) {
            await idbDelete(item.id);
            console.log('[SW] ✗ Removed item (client error):', item.id);
          } else {
            console.warn('[SW] ✗ Server error, will retry later:', item.id);
            throw new Error('Server error');
          }
        }
      } catch (error) {
        console.warn('[SW] ✗ Sync failed for item, will retry later:', item.id, error);
        throw error; // Abort sync untuk retry nanti
      }
    }
  } catch (error) {
    console.error('[SW] Outbox sync error:', error);
  }
}

/* ------------------------- Push Notification Event ------------------------- */
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let notificationData = {
    title: 'Story App',
    body: 'Anda mendapat notifikasi baru',
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || data.notification?.title || 'Story App',
        body: data.body || data.notification?.body || data.message || 'Anda mendapat notifikasi baru',
        icon: data.icon || data.notification?.icon,
        image: data.image || data.notification?.image,
        badge: data.badge,
        tag: data.tag || 'story-notification',
        data: data.data || data,
        requireInteraction: data.requireInteraction || false,
        vibrate: data.vibrate || [200, 100, 200],
        timestamp: data.timestamp || Date.now(),
      };
    } catch (error) {
      // Jika bukan JSON, gunakan sebagai text
      notificationData.body = event.data.text();
    }
  }

  const basePath = getBasePath();
  const defaultIcon = basePath ? `${basePath}/images/logo.png` : '/images/logo.png';

  const options = {
    body: notificationData.body,
    icon: notificationData.icon || defaultIcon,
    badge: notificationData.badge || defaultIcon,
    image: notificationData.image,
    data: notificationData.data || {},
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    timestamp: notificationData.timestamp,
    vibrate: notificationData.vibrate,
    actions: notificationData.data?.storyId ? [
      {
        action: 'view',
        title: 'Lihat Detail',
        icon: defaultIcon,
      },
      {
        action: 'close',
        title: 'Tutup',
      },
    ] : [],
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

/* ------------------------- Notification Click Event ------------------------- */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked, action:', event.action);

  event.notification.close();

  const data = event.notification.data || {};
  const basePath = getBasePath();
  const homePath = basePath ? `${basePath}/#/` : '/#/';

  // Handle action buttons
  if (event.action === 'view' && data.storyId) {
    // Navigate ke story detail
    event.waitUntil(
      clients.openWindow(`${homePath}?storyId=${data.storyId}`)
    );
  } else if (event.action === 'close') {
    // Hanya tutup notifikasi
    return;
  } else if (data.storyId) {
    // Default click - navigate ke story
    event.waitUntil(
      clients.openWindow(`${homePath}?storyId=${data.storyId}`)
    );
  } else if (data.url) {
    // Navigate ke URL yang ditentukan
    event.waitUntil(
      clients.openWindow(data.url)
    );
  } else {
    // Default - navigate ke home
    event.waitUntil(
      clients.openWindow(homePath)
    );
  }
});

/* ------------------------- Message Handler ------------------------- */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  const port = event.ports?.[0];
  
  if (port) {
    // Handle message dengan port
    (async () => {
      try {
        let result;
        
        if (event.data && event.data.cmd === 'PING') {
          result = { pong: Date.now() };
        } else {
          result = { ok: true, received: event.data };
        }
        
        port.postMessage({ ok: true, result });
      } catch (error) {
        port.postMessage({ ok: false, error: String(error) });
      }
    })();
  } else {
    // Broadcast ke semua clients
    clients.matchAll({ includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          client.postMessage({ info: 'Message received', data: event.data });
        } catch (error) {
          // Ignore
        }
      }
    });
  }
});
