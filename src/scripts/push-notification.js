// src/scripts/push-notification.js
import CONFIG from './config.js';

/**
 * Ambil VAPID public key dari API
 */
async function getVapidPublicKey() {
  try {
    const response = await fetch(`${CONFIG.BASE_URL}/vapidPublicKey`);
    if (!response.ok) {
      throw new Error(`Failed to fetch VAPID key: ${response.status}`);
    }
    const data = await response.json();
    // API mungkin mengembalikan { publicKey: "..." } atau langsung string
    return data.publicKey || data.public || data;
  } catch (error) {
    console.error('Error fetching VAPID public key:', error);
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
 * - bila gagal dan CONFIG.BASE_URL ada, coba fallback ke `${CONFIG.BASE_URL}/v1/subscribe`
 */
async function sendSubscriptionToServer(subscription) {
  const relativeUrl = '/v1/subscribe';
  const fallbackUrl = CONFIG && CONFIG.BASE_URL ? `${CONFIG.BASE_URL.replace(/\/$/, '')}/v1/subscribe` : null;

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
    console.warn(`Posting subscription to ${relativeUrl} failed:`, err);
    if (fallbackUrl) {
      try {
        return await doPost(fallbackUrl);
      } catch (err2) {
        console.error(`Posting subscription to fallback ${fallbackUrl} failed:`, err2);
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
  const fallbackUrl = CONFIG && CONFIG.BASE_URL ? `${CONFIG.BASE_URL.replace(/\/$/, '')}/v1/unsubscribe` : null;

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
 * Inisialisasi fitur push notification.
 * registration: ServiceWorkerRegistration instance (boleh dikirim atau akan pakai navigator.serviceWorker.ready)
 */
export async function initPush(registration) {
  try {
    // Jika registration tidak diberikan, tunggu service worker siap
    if (!registration) {
      registration = await navigator.serviceWorker.ready;
    }
  } catch (e) {
    console.warn('Service worker not ready, push init aborted.', e);
    return;
  }

  // Buat tombol toggle jika belum ada
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
    toggle.style.backgroundColor = '#4CAF50';
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

  toggle.addEventListener('click', async () => {
    try {
      // jika sudah granted — toggle unsubscribe
      if (Notification.permission === 'granted') {
        const currentSub = await registration.pushManager.getSubscription();
        if (currentSub) {
          // coba unsubscribe lokal
          const unsubscribed = await currentSub.unsubscribe();
          console.log('Unsubscribed locally:', unsubscribed);

          // inform server untuk hapus subscription
          try {
            await removeSubscriptionFromServer({ endpoint: currentSub.endpoint, keys: currentSub.toJSON().keys });
          } catch (errUnsub) {
            // server unsubscription boleh gagal, tapi tetap lanjut
            console.warn('Failed to remove subscription from server', errUnsub);
          }
        }
        await updateUI();
        return;
      }

      // request permission
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        alert('Permission for notifications was not granted.');
        return;
      }

      // Ambil VAPID public key dari API
      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) {
        alert('Gagal mendapatkan VAPID public key dari server.');
        return;
      }

      // subscribe via PushManager
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      console.log('Push subscription object:', subscription);

      // kirim subscription ke server (menggunakan relative path /v1/subscribe yang diproxy oleh devServer)
      try {
        await sendSubscriptionToServer(subscription);
        alert('Subscription saved to server.');
      } catch (err) {
        console.error('Failed to send subscription to server:', err);
        alert('Gagal mengirim subscription ke server. Cek console.');
        // kamu mungkin ingin unsubscribe karena subscription tidak tersimpan di server
        try {
          await subscription.unsubscribe();
        } catch (uErr) {
          console.warn('Failed to unsubscribe after failed server save', uErr);
        }
      }

      await updateUI();
    } catch (err) {
      console.error('Error in push toggle handler', err);
      alert('Terjadi kesalahan saat menyiapkan notifikasi. Lihat console.');
    }
  });
}
