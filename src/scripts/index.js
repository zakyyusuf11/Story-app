// src/scripts/index.js
import '../styles/styles.css';
import routes from './routes/routes.js';
import UrlParser from './routes/url-parser.js';
import { getOutboxAll, clearOutbox } from './data/idb.js'; // pastikan file ini ada
import { postStory } from './data/api.js'; // fungsi untuk POST story ke API (sesuaikan)

// Fix logo path untuk GitHub Pages
function fixLogoPath() {
  const logoImg = document.getElementById('logo-img');
  if (logoImg) {
    const basePath = getBasePath();
    // Set path logo berdasarkan base path
    if (basePath) {
      // Jika di GitHub Pages, gunakan path dengan base path
      logoImg.src = basePath + '/images/logo.png';
      console.log('✅ Logo path fixed to:', logoImg.src);
    } else {
      // Untuk localhost atau root, gunakan path relatif
      logoImg.src = './images/logo.png';
      console.log('✅ Logo path set to:', logoImg.src);
    }
    
    // Pastikan logo ter-load dengan error handler
    logoImg.onerror = function() {
      console.warn('⚠️ Logo failed to load, trying fallback paths...');
      // Coba beberapa fallback path
      const fallbacks = [
        './images/logo.png',
        '/images/logo.png',
        'images/logo.png',
        basePath ? basePath + '/images/logo.png' : null
      ].filter(Boolean);
      
      let currentIndex = 0;
      const tryNext = () => {
        if (currentIndex < fallbacks.length) {
          this.src = fallbacks[currentIndex];
          console.log('🔄 Trying logo path:', this.src);
          currentIndex++;
        } else {
          console.error('❌ All logo paths failed');
        }
      };
      
      this.onerror = tryNext;
      tryNext();
    };
    
    // Force reload jika sudah ada src
    if (logoImg.src) {
      logoImg.src = logoImg.src;
    }
  }
}

// Utility: try an async op with timeout
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Fungsi untuk mendapatkan base path (untuk GitHub Pages)
function getBasePath() {
  // Jika di GitHub Pages, path akan seperti /repo-name/ atau /repo-name/index.html
  const path = window.location.pathname;
  const hostname = window.location.hostname;
  
  console.log('[BasePath] Detecting base path:', { path, hostname });
  
  // Jika hostname adalah github.io, berarti ini GitHub Pages
  if (hostname.includes('github.io')) {
    // Ambil path dan filter
    const pathParts = path.split('/').filter(p => p && p !== 'index.html' && p !== '');
    
    console.log('[BasePath] Path parts:', pathParts);
    
    // Jika ada path parts (misal: /Story-app/), return base path
    if (pathParts.length > 0) {
      const repoName = pathParts[0];
      // Pastikan bukan file extension
      if (repoName && !repoName.includes('.')) {
        const basePath = '/' + repoName;
        console.log('[BasePath] Detected base path:', basePath);
        return basePath;
      }
    }
  }
  
  // Untuk localhost atau domain lain, return empty (root)
  console.log('[BasePath] No base path detected, using root');
  return '';
}

// Registrasi Service Worker (safely) & inisialisasi Push (di-load saat window 'load')
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Dapatkan base path untuk GitHub Pages
      const basePath = getBasePath();
      const swPath = basePath ? `${basePath}/sw.js` : '/sw.js';
      console.log('Registering service worker at:', swPath, '(basePath:', basePath, ')');
      
      // Daftarkan SW dengan base path yang benar, tapi batasi waktu tunggu
      const reg = await withTimeout(navigator.serviceWorker.register(swPath), 7000);
      console.log('ServiceWorker registered:', reg);

      // Init push notification (tombol akan muncul terus)
      // Load module push notification
      import('./push-notification.js')
        .then((module) => {
          console.log('✅ Push notification module loaded');
          // Pastikan tombol sudah dibuat
          if (!document.getElementById('push-toggle')) {
            console.log('⚠️ Push button not found, creating...');
            if (module && typeof module.createPushButton === 'function') {
              module.createPushButton();
            }
          }
          
          if (module && typeof module.initPush === 'function') {
            try { 
              module.initPush(reg);
              console.log('✅ Push notification initialized with registration');
            } catch (e) { 
              console.warn('⚠️ initPush failed, retrying without registration:', e);
              // Tetap coba init tanpa registration
              try { 
                module.initPush(null);
                console.log('✅ Push notification initialized without registration');
              } catch (e2) { 
                console.warn('❌ initPush retry failed:', e2);
              }
            }
          }
        })
        .catch((err) => {
          console.warn('⚠️ Could not load push-notification module:', err);
          // Tetap coba load untuk membuat tombol
          import('./push-notification.js').catch((e) => {
            console.error('❌ Failed to load push notification module:', e);
          });
        });
      
      // Pastikan tombol dibuat bahkan jika module belum load
      setTimeout(() => {
        if (!document.getElementById('push-toggle')) {
          console.log('⚠️ Push button still missing, creating fallback button...');
          const btn = document.createElement('button');
          btn.id = 'push-toggle';
          btn.textContent = '🔔 Aktifkan Notifikasi';
          btn.style.position = 'fixed';
          btn.style.right = '16px';
          btn.style.bottom = '16px';
          btn.style.zIndex = '9999';
          btn.style.padding = '12px 20px';
          btn.style.backgroundColor = '#2196F3';
          btn.style.color = 'white';
          btn.style.border = 'none';
          btn.style.borderRadius = '8px';
          btn.style.cursor = 'pointer';
          btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          btn.style.fontSize = '14px';
          btn.style.fontWeight = '600';
          if (document.body) {
            document.body.appendChild(btn);
            console.log('✅ Fallback push button created');
          }
        }
      }, 1000);

      // Don't aggressively unregister other registrations here.
      // If you still want to clean stray registrations, do it manually from DevTools
      // or provide a separate dev-only routine triggered by a button.

    } catch (err) {
      console.error('ServiceWorker registration failed or timed out:', err);
      // continue app bootstrap even if SW failed
    }
  });
}

// Fungsi utama untuk render halaman SPA
async function renderPage() {
  const url = UrlParser.parseActiveUrl();
  const page = routes[url] || routes['/']; // fallback ke halaman home

  const mainContent = document.getElementById('main-content');

  if (document.startViewTransition) {
    document.startViewTransition(async () => {
      mainContent.innerHTML = await page.render();
      await page.afterRender?.();
    });
  } else {
    mainContent.innerHTML = await page.render();
    await page.afterRender?.();
  }

  setActiveNav(url);
  updateNavigation();
}

// Fungsi untuk highlight menu aktif
function setActiveNav(path) {
  const links = document.querySelectorAll('#nav-list a');
  links.forEach((link) => {
    const target = link.getAttribute('href').replace('#', '');
    link.classList.toggle('active', target === path);
  });
}

// Fungsi untuk menampilkan login/register atau logout
function updateNavigation() {
  const token = localStorage.getItem('token');
  const loginLink = document.getElementById('login-link');
  const registerLink = document.getElementById('register-link');
  const logoutLink = document.getElementById('logout-link');

  if (!loginLink || !registerLink || !logoutLink) return;
  if (token) {
    loginLink.style.display = 'none';
    registerLink.style.display = 'none';
    logoutLink.style.display = 'inline-block';
  } else {
    loginLink.style.display = 'inline-block';
    registerLink.style.display = 'inline-block';
    logoutLink.style.display = 'none';
  }
}

// Event Logout (melalui hash change)
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#/logout') {
    localStorage.removeItem('token');
    alert('Anda telah logout');
    window.location.hash = '/';
    updateNavigation();
  }
});

// Register event listeners untuk navigasi SPA
window.addEventListener('hashchange', renderPage);
window.addEventListener('load', () => {
  renderPage();
  fixLogoPath(); // Fix logo path setelah load
});

// Fix logo path saat DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fixLogoPath);
} else {
  fixLogoPath();
}

// Drawer untuk mobile (pastikan elemen ada di HTML)
const drawerButton = document.getElementById('drawer-button');
const drawer = document.getElementById('navigation-drawer');
drawerButton?.addEventListener('click', () => drawer?.classList.toggle('open'));

// expose updateNavigation agar bisa dipanggil dari halaman lain
window.updateNavigation = updateNavigation;

// Fungsi Logout (dipakai oleh event click)
function handleLogout() {
  localStorage.removeItem('token'); // hapus token
  alert('Anda telah logout');
  updateNavigation(); // update navbar
  window.location.hash = '/'; // kembali ke halaman utama
}

// Event Listener untuk tombol Logout (mencegah default & panggil handleLogout)
window.addEventListener('click', (event) => {
  if (event.target.matches('a[href="#/logout"]')) {
    event.preventDefault();
    handleLogout();
  }
});

// ======================================================
// Offline → online sync: jika ada data di outbox (IndexedDB), kirim ke API
// ======================================================
async function syncOutbox() {
  try {
    const outbox = await getOutboxAll(); // ambil semua data dari outbox (idb)
    if (!outbox || outbox.length === 0) return;

    console.log('Syncing outbox items:', outbox.length);
    for (const item of outbox) {
      try {
        // sesuaikan postStory dengan format API Anda
        await postStory(item);
      } catch (err) {
        console.error('Failed to sync item, will retry later:', item, err);
      }
    }
    // jika semua berhasil (atau setelah percobaan), bersihkan outbox
    await clearOutbox();
    console.log('Outbox sync finished.');
  } catch (err) {
    console.error('Error during outbox sync:', err);
  }
}

// Ketika koneksi kembali online, jalankan sync
window.addEventListener('online', () => {
  console.log('Network status: online — attempting to sync outbox');
  // jalankan async tanpa memblokir UI
  setTimeout(() => syncOutbox(), 0);
});

// Jika saat startup sudah online, jalankan sync juga (non-blocking)
if (navigator.onLine) {
  setTimeout(() => {
    syncOutbox().catch(err => console.warn('Initial outbox sync error:', err));
  }, 1000);
}
