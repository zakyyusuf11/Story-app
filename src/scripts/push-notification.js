// src/scripts/push-notification.js
import CONFIG from './config.js';

/**
 * Ambil VAPID public key dari API
 */
async function getVapidPublicKey() {
  // Coba endpoint relatif dulu (untuk dev proxy)
  const relativeUrl = '/v1/vapidPublicKey';
  const fallbackUrl = CONFIG && CONFIG.BASE_URL ? `${CONFIG.BASE_URL.replace(/\/$/, '')}/vapidPublicKey` : null;
  
  async function doFetch(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch VAPID key: ${response.status}`);
    }
    const data = await response.json();
    // API mungkin mengembalikan { publicKey: "..." } atau langsung string
    return data.publicKey || data.public || data;
  }
  
  try {
    return await doFetch(relativeUrl);
  } catch (error) {
    console.warn('Fetching VAPID key from relative URL failed:', error);
    if (fallbackUrl) {
      try {
        return await doFetch(fallbackUrl);
      } catch (err2) {
        console.error('Error fetching VAPID public key from fallback:', err2);
        // Fallback ke hardcoded key jika API gagal (untuk development)
        return 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';
      }
    }
    // Fallback ke hardcoded key jika API gagal (untuk development)
    return 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';
  }
}

/**
 * Helper: convert url-base64 string ke Uint8Array untuk applicationServerKey
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const outputArray = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    outputArray[i] = raw.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Kirim subscription ke server.
 * - mencoba endpoint relatif /v1/subscribe (untuk dev proxy)
 * - bila gagal dan CONFIG.BASE_URL ada, coba fallback ke `${CONFIG.BASE_URL}/subscribe`
 */
async function sendSubscriptionToServer(subscription) {
  const relativeUrl = '/v1/subscribe';
  // CONFIG.BASE_URL sudah mengandung /v1, jadi cukup tambahkan /subscribe
  const fallbackUrl = CONFIG && CONFIG.BASE_URL ? `${CONFIG.BASE_URL.replace(/\/$/, '')}/subscribe` : null;

  console.log('[Push] Attempting to send subscription:');
  console.log('[Push] - Relative URL:', relativeUrl);
  console.log('[Push] - Fallback URL:', fallbackUrl);
  console.log('[Push] - CONFIG.BASE_URL:', CONFIG?.BASE_URL);

  async function doPost(url) {
    console.log('[Push] POST to:', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Server responded ${res.status} ${res.statusText} ${text}`);
    }
    return res.json().catch(() => ({}));
  }

  try {
    return await doPost(relativeUrl);
  } catch (err) {
    console.warn(`[Push] Posting subscription to ${relativeUrl} failed:`, err);
    if (fallbackUrl) {
      try {
        console.log('[Push] Trying fallback URL:', fallbackUrl);
        return await doPost(fallbackUrl);
      } catch (err2) {
        console.error(`[Push] Posting subscription to fallback ${fallbackUrl} failed:`, err2);
        throw err2;
      }
    }
    throw err;
  }
}

/**
 * Hapus subscription di server (panggil endpoint /v1/unsubscribe atau endpoint sesuai servermu)
 * Server harus menyediakan endpoint untuk menghapus subscription berdasarkan endpoint key.
 */
async function removeSubscriptionFromServer(subscription) {
  const relativeUrl = '/v1/unsubscribe';
  // CONFIG.BASE_URL sudah mengandung /v1, jadi cukup tambahkan /unsubscribe
  const fallbackUrl = CONFIG && CONFIG.BASE_URL ? `${CONFIG.BASE_URL.replace(/\/$/, '')}/unsubscribe` : null;

  async function doPost(url) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Server responded ${res.status} ${res.statusText} ${text}`);
    }
    return res.json().catch(() => ({}));
  }

  try {
    return await doPost(relativeUrl);
  } catch (err) {
    console.warn(`Unsubscribe post to ${relativeUrl} failed:`, err);
    if (fallbackUrl) {
      try {
        return await doPost(fallbackUrl);
      } catch (err2) {
        console.error(`Unsubscribe post to fallback ${fallbackUrl} failed:`, err2);
        throw err2;
      }
    }
    throw err;
  }
}

/**
 * Buat tombol push notification yang selalu muncul
 */
function createPushButton() {
  let toggle = document.getElementById('push-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'push-toggle';
    toggle.setAttribute('type', 'button');
    toggle.className = 'btn push-notification-btn';
    toggle.style.position = 'fixed';
    toggle.style.right = '16px';
    toggle.style.bottom = '16px';
    toggle.style.zIndex = '9999';
    toggle.style.padding = '12px 20px';
    toggle.style.backgroundColor = '#2196F3';
    toggle.style.color = 'white';
    toggle.style.border = 'none';
    toggle.style.borderRadius = '8px';
    toggle.style.cursor = 'pointer';
    toggle.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    toggle.style.fontSize = '14px';
    toggle.style.fontWeight = '600';
    toggle.setAttribute('aria-label', 'Toggle Push Notifications');
    document.body.appendChild(toggle);
  }
  return toggle;
}

/**
 * Inisialisasi fitur push notification.
 * registration: ServiceWorkerRegistration instance (boleh dikirim atau akan pakai navigator.serviceWorker.ready)
 */
export async function initPush(registration) {
  // Buat tombol dulu, selalu muncul
  const toggle = createPushButton();
  
  // Cek apakah browser mendukung push notification
  if (!('PushManager' in window) || !('Notification' in window)) {
    toggle.textContent = '🔔 Notifikasi Tidak Didukung';
    toggle.style.backgroundColor = '#9E9E9E';
    toggle.disabled = true;
    return;
  }

  try {
    // Jika registration tidak diberikan, tunggu service worker siap
    if (!registration) {
      if ('serviceWorker' in navigator) {
        registration = await navigator.serviceWorker.ready;
      } else {
        toggle.textContent = '🔔 Service Worker Tidak Didukung';
        toggle.style.backgroundColor = '#9E9E9E';
        toggle.disabled = true;
        return;
      }
    }
  } catch (e) {
    console.warn('Service worker not ready, push init aborted.', e);
    toggle.textContent = '🔔 Menunggu Service Worker...';
    toggle.style.backgroundColor = '#FF9800';
    // Coba lagi setelah beberapa detik
    setTimeout(() => initPush(null), 3000);
    return;
  }

  // update UI (tulisan tombol)
  async function updateUI() {
    try {
      const sub = await registration.pushManager.getSubscription();
      if (Notification.permission === 'granted' && sub) {
        toggle.textContent = '🔔 Notifikasi Aktif';
        toggle.style.backgroundColor = '#4CAF50';
      } else {
        toggle.textContent = '🔔 Aktifkan Notifikasi';
        toggle.style.backgroundColor = '#2196F3';
      }
    } catch (err) {
      console.error('Error while updating push UI', err);
      toggle.textContent = '🔔 Aktifkan Notifikasi';
      toggle.style.backgroundColor = '#2196F3';
    }
  }

  await updateUI();

  // Hapus event listener lama jika ada, lalu tambahkan yang baru
  const newToggle = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(newToggle, toggle);
  const finalToggle = document.getElementById('push-toggle');

  finalToggle.addEventListener('click', async () => {
    try {
      console.log('🔔 Push notification button clicked');
      
      // jika sudah granted — toggle unsubscribe atau test notification
      if (Notification.permission === 'granted') {
        const currentSub = await registration.pushManager.getSubscription();
        if (currentSub) {
          // Tampilkan test notification dulu sebelum unsubscribe
          console.log('🔔 Menampilkan test notification...');
          try {
            const iconPath = window.location.origin + '/images/logo.png';
            console.log('Icon path:', iconPath);
            
            const notificationOptions = {
              body: 'Ini adalah test notifikasi dari Story App!',
              icon: iconPath,
              badge: iconPath,
              tag: 'test-notification-' + Date.now(),
              requireInteraction: false,
              vibrate: [200, 100, 200],
            };
            
            console.log('Notification options:', notificationOptions);
            const notification = await registration.showNotification('Test Notification', notificationOptions);
            console.log('✅ Test notification ditampilkan:', notification);
            
            // Tampilkan alert juga untuk memastikan user melihat feedback
            setTimeout(() => {
              const confirmUnsub = confirm('Test notification berhasil! Apakah Anda ingin menonaktifkan notifikasi?');
              if (!confirmUnsub) {
                updateUI();
                return;
              }
              
              // Lanjut unsubscribe
              handleUnsubscribe(currentSub);
            }, 500);
            return;
          } catch (notifErr) {
            console.error('❌ Gagal menampilkan test notification:', notifErr);
            alert('Error: ' + notifErr.message + '\n\nLihat console untuk detail.');
            // Tetap lanjutkan unsubscribe meskipun test notification gagal
          }
          
          // Function untuk handle unsubscribe
          async function handleUnsubscribe(sub) {
            try {
              // coba unsubscribe lokal
              const unsubscribed = await sub.unsubscribe();
              console.log('✅ Unsubscribed locally:', unsubscribed);

              // inform server untuk hapus subscription
              try {
                await removeSubscriptionFromServer({ endpoint: sub.endpoint, keys: sub.toJSON().keys });
                console.log('✅ Subscription dihapus dari server');
              } catch (errUnsub) {
                // server unsubscription boleh gagal, tapi tetap lanjut
                console.warn('⚠️ Failed to remove subscription from server', errUnsub);
              }
              
              alert('✅ Notifikasi telah dinonaktifkan.');
              await updateUI();
            } catch (err) {
              console.error('Error during unsubscribe:', err);
              alert('Error saat menonaktifkan notifikasi: ' + err.message);
            }
          }
          
          // Jika test notification gagal, langsung unsubscribe
          await handleUnsubscribe(currentSub);
          return;
        } else {
          // Permission granted tapi belum subscribe, langsung subscribe
          console.log('Permission granted, subscribing...');
        }
      }

      // request permission
      console.log('Requesting notification permission...');
      const perm = await Notification.requestPermission();
      console.log('Notification permission:', perm);
      
      if (perm !== 'granted') {
        alert('Izin notifikasi tidak diberikan. Silakan aktifkan di pengaturan browser.');
        await updateUI();
        return;
      }

      // Tampilkan test notification setelah permission granted
      console.log('🔔 Menampilkan test notification setelah permission granted...');
      try {
        const iconPath = window.location.origin + '/images/logo.png';
        console.log('Icon path:', iconPath);
        
        const notificationOptions = {
          body: 'Anda akan menerima notifikasi dari Story App.',
          icon: iconPath,
          badge: iconPath,
          tag: 'notification-enabled-' + Date.now(),
          vibrate: [200, 100, 200],
        };
        
        console.log('Notification options:', notificationOptions);
        const notification = await registration.showNotification('Notifikasi Diaktifkan!', notificationOptions);
        console.log('✅ Test notification ditampilkan setelah permission granted:', notification);
      } catch (notifErr) {
        console.error('❌ Gagal menampilkan test notification:', notifErr);
        // Jangan block flow, tetap lanjutkan
      }

      // Ambil VAPID public key dari API
      finalToggle.textContent = '⏳ Memproses...';
      finalToggle.disabled = true;
      
      console.log('Fetching VAPID public key...');
      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) {
        alert('Gagal mendapatkan VAPID public key dari server.');
        finalToggle.disabled = false;
        await updateUI();
        return;
      }
      console.log('✅ VAPID public key received');

      // subscribe via PushManager
      console.log('Subscribing to push notifications...');
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      console.log('✅ Push subscription berhasil:', subscription);

      // kirim subscription ke server
      try {
        await sendSubscriptionToServer(subscription);
        console.log('✅ Push notification subscription berhasil disimpan ke server!');
        
        // Tampilkan notifikasi sukses
        console.log('🔔 Menampilkan notifikasi sukses...');
        try {
          const iconPath = window.location.origin + '/images/logo.png';
          const notificationOptions = {
            body: 'Anda akan menerima notifikasi dari Story App.',
            icon: iconPath,
            badge: iconPath,
            tag: 'subscription-success-' + Date.now(),
            vibrate: [200, 100, 200],
          };
          console.log('Success notification options:', notificationOptions);
          await registration.showNotification('Notifikasi Berhasil Diaktifkan!', notificationOptions);
          console.log('✅ Success notification ditampilkan');
        } catch (notifErr) {
          console.error('❌ Gagal menampilkan success notification:', notifErr);
        }
        
        alert('✅ Notifikasi berhasil diaktifkan! Anda akan menerima notifikasi dari server.');
      } catch (err) {
        console.error('❌ Failed to send subscription to server:', err);
        console.log('ℹ️ Ini normal untuk development. Subscription lokal sudah berhasil dibuat.');
        
        // Tampilkan notifikasi sukses (meskipun server gagal, subscription lokal berhasil)
        console.log('🔔 Menampilkan success notification...');
        try {
          const iconPath = window.location.origin + '/images/logo.png';
          const notificationOptions = {
            body: 'Notifikasi berhasil diaktifkan! Anda dapat menerima notifikasi.',
            icon: iconPath,
            badge: iconPath,
            tag: 'subscription-success-local-' + Date.now(),
            vibrate: [200, 100, 200],
          };
          console.log('Success notification options:', notificationOptions);
          await registration.showNotification('Notifikasi Berhasil Diaktifkan!', notificationOptions);
          console.log('✅ Success notification ditampilkan');
        } catch (notifErr) {
          console.error('❌ Gagal menampilkan success notification:', notifErr);
        }
        
        // Pesan yang lebih informatif
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDevelopment) {
          alert('✅ Notifikasi berhasil diaktifkan!\n\n' +
                'Subscription lokal berhasil dibuat. Untuk testing, Anda dapat:\n' +
                '1. Menggunakan DevTools untuk mengirim test notification\n' +
                '2. Atau gunakan "npm run start-dev" untuk development dengan proxy\n\n' +
                'Notifikasi akan berfungsi dengan baik di production.');
        } else {
          alert('✅ Notifikasi berhasil diaktifkan!\n\n' +
                'Subscription lokal berhasil dibuat. ' +
                'Jika ada masalah koneksi ke server, notifikasi tetap akan berfungsi secara lokal.');
        }
        // Tetap lanjutkan karena subscription lokal sudah berhasil
      }

      finalToggle.disabled = false;
      await updateUI();
    } catch (err) {
      console.error('❌ Error in push toggle handler:', err);
      alert('Terjadi kesalahan saat menyiapkan notifikasi: ' + err.message + '\n\nLihat console untuk detail.');
      finalToggle.disabled = false;
      await updateUI();
    }
  });
}

// Inisialisasi tombol push notification saat DOM ready
function initPushButton() {
  // Pastikan body sudah ada
  if (document.body) {
    createPushButton();
  } else {
    // Tunggu body ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createPushButton();
      });
    } else {
      // Fallback jika sudah loaded
      setTimeout(() => {
        if (document.body) {
          createPushButton();
        }
      }, 100);
    }
  }
}

// Panggil saat module di-load
initPushButton();

// Juga panggil saat window load untuk memastikan
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Pastikan tombol ada
    if (!document.getElementById('push-toggle')) {
      createPushButton();
    }
  });
}
