// src/scripts/index.js
import '../styles/styles.css';
import routes from './routes/routes.js';
import UrlParser from './routes/url-parser.js';
import { getOutboxAll, clearOutbox } from './data/idb.js'; // pastikan file ini ada
import { postStory } from './data/api.js'; // fungsi untuk POST story ke API (sesuaikan)

// Utility: try an async op with timeout
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Registrasi Service Worker (safely) & inisialisasi Push (di-load saat window 'load')
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Daftarkan SW di root /sw.js, tapi batasi waktu tunggu
      const reg = await withTimeout(navigator.serviceWorker.register('/sw.js'), 7000);
      console.log('ServiceWorker registered:', reg);

      // Optional: init push (non-blocking)
      if ('PushManager' in window) {
        import('./push-notification.js')
          .then((module) => {
            if (module && typeof module.initPush === 'function') {
              try { module.initPush(reg); } catch (e) { console.warn('initPush failed', e); }
            }
          })
          .catch((err) => console.warn('Could not load push-notification module:', err));
      }

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
window.addEventListener('load', renderPage);

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
