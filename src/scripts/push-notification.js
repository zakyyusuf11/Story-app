// Push Notification utility
import CONFIG from './config.js';

/**
 * Konversi VAPID public key dari base64url ke Uint8Array
 * @param {string} base64String - VAPID key dalam format base64url
 * @returns {Uint8Array} - Array bytes untuk applicationServerKey
 */
function urlBase64ToUint8Array(base64String) {
  // Tambahkan padding jika diperlukan
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  // Konversi base64url ke base64 standar
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  // Decode base64 ke binary string
  const rawData = window.atob(base64);
  
  // Konversi ke Uint8Array
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

/**
 * Ambil VAPID public key dari config (sesuai dokumentasi Story API)
 * @returns {string} - VAPID public key
 */
function getVapidPublicKey() {
  // VAPID key sudah tersedia di config, gunakan langsung
  return CONFIG.VAPID_PUBLIC_KEY;
}

/**
 * Verifikasi format dan validitas VAPID key
 * @returns {boolean} - true jika valid, false jika tidak
 */
export function verifyVapidKey() {
  const key = getVapidPublicKey();
  
  if (!key) {
    console.error('❌ VAPID key tidak ditemukan di config');
    return false;
  }
  
  // Cek panjang key (tidak boleh terlalu panjang, biasanya ~87 karakter)
  if (key.length > 150) {
    console.warn('⚠️ VAPID key terlalu panjang, kemungkinan masih placeholder');
    console.warn('   Format VAPID key yang benar biasanya ~87 karakter (base64url)');
    return false;
  }
  
  // Cek format base64url (hanya alphanumeric, -, _)
  const base64urlPattern = /^[A-Za-z0-9_-]+$/;
  if (!base64urlPattern.test(key)) {
    console.error('❌ Format VAPID key tidak valid (harus base64url: A-Z, a-z, 0-9, -, _)');
    return false;
  }
  
  // Coba konversi ke Uint8Array untuk verifikasi
  try {
    const testArray = urlBase64ToUint8Array(key);
    if (testArray.length === 0 || testArray.length !== 65) {
      console.warn('⚠️ VAPID key length tidak sesuai (harus menghasilkan 65 bytes)');
      return false;
    }
    console.log('✅ VAPID key format valid');
    console.log(`   Key length: ${key.length} karakter`);
    console.log(`   Converted to: ${testArray.length} bytes`);
    return true;
  } catch (error) {
    console.error('❌ Error converting VAPID key:', error.message);
    console.error('   Pastikan key adalah format base64url yang valid');
    return false;
  }
}

/**
 * Subscribe ke push notifications
 * @returns {Promise<PushSubscription|null>} - Subscription object atau null jika gagal
 */
export async function subscribeToPushNotifications() {
  // Cek dukungan browser
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker tidak didukung di browser ini. Gunakan browser modern seperti Chrome, Firefox, atau Edge.');
  }
  
  if (!('PushManager' in window)) {
    throw new Error('Push Notification tidak didukung di browser ini. Gunakan browser modern seperti Chrome, Firefox, atau Edge.');
  }
  
  // Cek apakah di HTTPS atau localhost
  if (window.location.protocol !== 'https:' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1') {
    throw new Error('Push Notification hanya bekerja di HTTPS atau localhost. Aplikasi harus di-deploy dengan HTTPS.');
  }
  
  try {
    // Tunggu service worker siap (dengan timeout)
    let registration = null;
    const maxWaitTime = 10000; // 10 detik
    const startTime = Date.now();
    
    while (!registration && (Date.now() - startTime) < maxWaitTime) {
      try {
        registration = await navigator.serviceWorker.ready;
        if (registration) break;
      } catch (e) {
        // Service worker belum ready, tunggu sebentar
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!registration) {
      throw new Error('Service Worker belum siap. Pastikan Service Worker sudah ter-register dengan benar. Refresh halaman dan coba lagi.');
    }
    
    console.log('✅ Service Worker ready for push notification');
    
    // Cek apakah sudah subscribe
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('✅ Already subscribed to push notifications');
      return existingSubscription;
    }
    
    // Request izin notifikasi
    console.log('🔔 Requesting notification permission...');
    const permission = await Notification.requestPermission();
    
    if (permission === 'denied') {
      throw new Error('Izin notifikasi ditolak. Untuk mengaktifkan notifikasi:\n1. Klik icon gembok/kunci di address bar\n2. Set "Notifications" ke "Allow"\n3. Refresh halaman dan coba lagi');
    }
    
    if (permission === 'default') {
      throw new Error('Izin notifikasi belum diberikan. Silakan berikan izin notifikasi ketika diminta, kemudian coba lagi.');
    }
    
    if (permission !== 'granted') {
      throw new Error('Izin notifikasi tidak diberikan. Status: ' + permission);
    }
    
    console.log('✅ Notification permission granted');
    
    // Ambil VAPID public key dari config
    const vapidPublicKey = getVapidPublicKey();
    
    if (!vapidPublicKey) {
      throw new Error('VAPID public key tidak ditemukan di config');
    }
    
    // Konversi VAPID key - biarkan browser validasi, jangan throw error di sini
    let applicationServerKey;
    try {
      applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      console.log('🔍 VAPID key conversion:', {
        keyLength: vapidPublicKey.length,
        convertedBytes: applicationServerKey.length,
        expectedBytes: 65,
        keyPreview: vapidPublicKey.substring(0, 30) + '...'
      });
      
      if (applicationServerKey.length !== 65) {
        console.warn('⚠️ VAPID key converted to', applicationServerKey.length, 'bytes, expected 65');
        console.warn('   Continuing anyway - browser will validate');
      } else {
        console.log('✅ VAPID key format looks correct (65 bytes)');
      }
    } catch (keyError) {
      console.error('❌ Error converting VAPID key:', keyError);
      // Jangan throw di sini, biarkan browser coba subscribe dan lihat apa yang terjadi
      console.warn('⚠️ Will attempt subscription anyway - browser will validate');
      // Coba konversi lagi dengan error handling
      try {
        applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      } catch (e) {
        throw new Error('VAPID public key tidak dapat dikonversi. Pastikan format key benar (base64url). Error: ' + keyError.message);
      }
    }
    
    // Subscribe ke push dengan VAPID key
    let subscription;
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });
      console.log('✅ Push subscription created in browser');
    } catch (subscribeError) {
      console.error('❌ Error subscribing to push:', subscribeError);
      console.error('   Error name:', subscribeError.name);
      console.error('   Error message:', subscribeError.message);
      console.error('   VAPID key used:', vapidPublicKey.substring(0, 20) + '...');
      
      if (subscribeError.name === 'NotAllowedError') {
        throw new Error('Push subscription tidak diizinkan. Pastikan Service Worker sudah aktif dan browser mendukung push notification.');
      } else if (subscribeError.message && 
                 (subscribeError.message.includes('VAPID') || 
                  subscribeError.message.includes('Invalid') || 
                  subscribeError.message.includes('invalid'))) {
        console.error('⚠️ Browser rejected VAPID key. This usually means:');
        console.error('   1. The VAPID key does not match the server\'s private key');
        console.error('   2. The key format is incorrect');
        console.error('   3. The key has been revoked or expired');
        throw new Error('VAPID key tidak valid. Pastikan menggunakan VAPID key yang benar dari dokumentasi Story API. Error dari browser: ' + subscribeError.message);
      }
      throw new Error('Gagal subscribe ke push notification: ' + subscribeError.message);
    }
    
    // Kirim subscription ke server menggunakan endpoint sesuai dokumentasi Story API
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      console.warn('No auth token found');
      return null;
    }
    
    // Format subscription sesuai dokumentasi Story API
    const subscriptionJson = subscription.toJSON();
    
    // Simpan subscription ke localStorage terlebih dahulu
    localStorage.setItem('pushSubscription', JSON.stringify(subscriptionJson));
    console.log('✅ Push subscription saved to localStorage');
    
    // Kirim ke endpoint /notifications/subscribe sesuai dokumentasi
    try {
      const response = await fetch(`${CONFIG.BASE_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subscriptionJson.endpoint,
          keys: {
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth,
          },
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        const errorMessage = errorData.message || `Server responded with status ${response.status}`;
        console.warn('⚠️ Warning: Failed to send subscription to server:', errorMessage);
        console.warn('   Push notification masih bisa digunakan untuk testing via DevTools');
        // Jangan throw error, karena subscription sudah berhasil dibuat di browser
        // User masih bisa test via DevTools > Application > Service Workers > Push
      } else {
        const result = await response.json();
        console.log('✅ Push notification subscribed successfully to server:', result);
      }
    } catch (fetchError) {
      console.warn('⚠️ Warning: Error sending subscription to server:', fetchError.message);
      console.warn('   Push notification masih bisa digunakan untuk testing via DevTools');
      console.warn('   Buka DevTools > Application > Service Workers > Push untuk test manual');
      // Jangan throw error, karena subscription sudah berhasil dibuat di browser
    }
    
    console.log('✅ Push notification subscription ready');
    return subscription;
    
  } catch (error) {
    console.error('❌ Error subscribing to push notifications:', error);
    // Re-throw error dengan message yang lebih jelas
    if (error.message) {
      throw error;
    }
    throw new Error('Gagal mengaktifkan push notification: ' + (error.toString() || 'Unknown error'));
  }
}

/**
 * Unsubscribe dari push notifications
 * @returns {Promise<void>}
 */
export async function unsubscribeFromPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      const subscriptionJson = subscription.toJSON();
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      // Unsubscribe dari server menggunakan endpoint DELETE sesuai dokumentasi
      if (token && subscriptionJson.endpoint) {
        try {
          const response = await fetch(`${CONFIG.BASE_URL}/notifications/subscribe`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              endpoint: subscriptionJson.endpoint,
            }),
          });
          
          if (!response.ok) {
            console.warn('Failed to unsubscribe from server, but continuing with local unsubscribe');
          } else {
            const result = await response.json();
            console.log('✅ Unsubscribed from server:', result);
          }
        } catch (fetchError) {
          console.warn('Could not send unsubscribe to server:', fetchError.message);
        }
      }
      
      // Unsubscribe dari browser
      await subscription.unsubscribe();
      localStorage.removeItem('pushSubscription');
      console.log('✅ Push notification unsubscribed successfully');
    }
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    throw error;
  }
}

/**
 * Cek apakah user sudah subscribe
 * @returns {Promise<boolean>} - true jika sudah subscribe, false jika belum
 */
export async function isSubscribedToPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

/**
 * Test notification secara manual (untuk debugging)
 * @returns {Promise<void>}
 */
export async function testNotification() {
  if (!('serviceWorker' in navigator)) {
    console.error('❌ Service Worker tidak didukung');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Cek izin notifikasi
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.error('❌ Notification permission tidak diberikan');
        return;
      }
    }
    
    // Ambil base path untuk icon (sama seperti service worker)
    const getBasePath = () => {
      const pathname = window.location.pathname;
      if (pathname === '/' || pathname === '/index.html') {
        return '/';
      }
      const lastSlash = pathname.lastIndexOf('/');
      return lastSlash > 0 ? pathname.substring(0, lastSlash + 1) : '/';
    };
    
    const basePath = getBasePath();
    
    // Tampilkan test notification
    await registration.showNotification('Notifikasi Baru', {
      body: 'Ada data baru ditambahkan.',
      icon: basePath + 'images/logo.png',
      badge: basePath + 'images/logo.png',
      tag: 'test-notification',
      requireInteraction: false,
    });
    
    console.log('✅ Test notification sent!');
  } catch (error) {
    console.error('❌ Error showing test notification:', error);
  }
}

/**
 * Helper: Get base path for GitHub Pages
 */
function getBasePath() {
  const hostname = window.location.hostname;
  if (hostname.includes('github.io')) {
    const path = window.location.pathname;
    const pathParts = path.split('/').filter(p => p && p !== 'index.html' && p !== '');
    if (pathParts.length > 0) {
      const repoName = pathParts[0];
      if (repoName && !repoName.includes('.')) {
        return '/' + repoName;
      }
    }
  }
  return '';
}

/**
 * Buat tombol push notification yang selalu muncul
 */
export function createPushButton() {
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
    toggle.style.display = 'block';
    toggle.style.visibility = 'visible';
    toggle.textContent = '🔔 Aktifkan Notifikasi';
    toggle.setAttribute('aria-label', 'Toggle Push Notifications');
    
    // Pastikan body sudah ada sebelum append
    if (document.body) {
      document.body.appendChild(toggle);
      console.log('✅ Push notification button created');
    } else {
      // Tunggu body ready
      const observer = new MutationObserver((mutations, obs) => {
        if (document.body) {
          document.body.appendChild(toggle);
          console.log('✅ Push notification button created (after body ready)');
          obs.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      
      // Fallback timeout
      setTimeout(() => {
        if (document.body && !document.getElementById('push-toggle')) {
          document.body.appendChild(toggle);
          console.log('✅ Push notification button created (timeout fallback)');
        }
        observer.disconnect();
      }, 1000);
    }
  }
  return toggle;
}

/**
 * Inisialisasi fitur push notification dengan tombol UI
 * @param {ServiceWorkerRegistration} registration - Service worker registration
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
  
  // Update UI (tulisan tombol)
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
  
  // Pastikan tombol terlihat
  toggle.style.display = 'block';
  toggle.style.visibility = 'visible';
  toggle.style.opacity = '1';
  
  // Hapus event listener lama jika ada, lalu tambahkan yang baru
  const newToggle = toggle.cloneNode(true);
  if (toggle.parentNode) {
    toggle.parentNode.replaceChild(newToggle, toggle);
  }
  const finalToggle = document.getElementById('push-toggle');
  
  // Pastikan finalToggle juga terlihat
  if (finalToggle) {
    finalToggle.style.display = 'block';
    finalToggle.style.visibility = 'visible';
    finalToggle.style.opacity = '1';
  }
  
  finalToggle.addEventListener('click', async () => {
    try {
      console.log('🔔 Push notification button clicked');
      
      // Jika sudah granted — toggle unsubscribe atau test notification
      if (Notification.permission === 'granted') {
        const currentSub = await registration.pushManager.getSubscription();
        if (currentSub) {
          // Tampilkan test notification dulu sebelum unsubscribe
          console.log('🔔 Menampilkan test notification...');
          try {
            const basePath = getBasePath();
            const iconPath = window.location.origin + basePath + '/images/logo.png';
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
            await registration.showNotification('Test Notification', notificationOptions);
            console.log('✅ Test notification ditampilkan');
            
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
              await unsubscribeFromPushNotifications();
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
      
      // Request permission
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
        const basePath = getBasePath();
        const iconPath = window.location.origin + basePath + '/images/logo.png';
        console.log('Icon path:', iconPath);
        
        const notificationOptions = {
          body: 'Anda akan menerima notifikasi dari Story App.',
          icon: iconPath,
          badge: iconPath,
          tag: 'notification-enabled-' + Date.now(),
          vibrate: [200, 100, 200],
        };
        
        console.log('Notification options:', notificationOptions);
        await registration.showNotification('Notifikasi Diaktifkan!', notificationOptions);
        console.log('✅ Test notification ditampilkan setelah permission granted');
      } catch (notifErr) {
        console.error('❌ Gagal menampilkan test notification:', notifErr);
        // Jangan block flow, tetap lanjutkan
      }
      
      // Subscribe menggunakan fungsi subscribeToPushNotifications
      finalToggle.textContent = '⏳ Memproses...';
      finalToggle.disabled = true;
      
      try {
        await subscribeToPushNotifications();
        console.log('✅ Push notification subscription berhasil!');
        
        // Tampilkan notifikasi sukses
        console.log('🔔 Menampilkan notifikasi sukses...');
        try {
          const basePath = getBasePath();
          const iconPath = window.location.origin + basePath + '/images/logo.png';
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
        console.error('❌ Failed to subscribe:', err);
        alert('Terjadi kesalahan saat menyiapkan notifikasi: ' + err.message + '\n\nLihat console untuk detail.');
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

/**
 * Inisialisasi push notification saat app load
 */
export async function initializePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }
  
  // Verifikasi VAPID key saat inisialisasi
  verifyVapidKey();
  
  // Cek apakah sudah subscribe
  const isSubscribed = await isSubscribedToPushNotifications();
  if (!isSubscribed) {
    // Auto-subscribe saat login (akan dipanggil setelah user login)
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) {
      try {
        await subscribeToPushNotifications();
      } catch (err) {
        console.warn('Auto-subscribe failed:', err);
      }
    }
  }
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

// Panggil segera saat module di-load - BUAT TOMBOL SEGERA
if (typeof document !== 'undefined') {
  // Coba buat tombol segera tanpa menunggu
  const tryCreateButton = () => {
    if (!document.getElementById('push-toggle')) {
      createPushButton();
    }
  };
  
  // Coba buat tombol segera
  if (document.body) {
    tryCreateButton();
  } else if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(tryCreateButton, 0);
  } else {
    document.addEventListener('DOMContentLoaded', tryCreateButton);
  }
  
  // Juga panggil saat window load untuk memastikan
  window.addEventListener('load', () => {
    // Pastikan tombol ada dan terlihat
    const btn = document.getElementById('push-toggle');
    if (!btn) {
      console.log('⚠️ Push button not found on load, creating now...');
      createPushButton();
    } else {
      console.log('✅ Push button already exists');
      // Pastikan tombol terlihat
      btn.style.display = 'block';
      btn.style.visibility = 'visible';
      btn.style.opacity = '1';
    }
  });
  
  // Fallback: coba lagi setelah 1 detik, 2 detik, dan 3 detik
  [1000, 2000, 3000].forEach(delay => {
    setTimeout(() => {
      const btn = document.getElementById('push-toggle');
      if (!btn) {
        console.log(`⚠️ Push button still not found after ${delay}ms, creating now...`);
        createPushButton();
      } else {
        // Pastikan tombol terlihat
        btn.style.display = 'block';
        btn.style.visibility = 'visible';
        btn.style.opacity = '1';
      }
    }, delay);
  });
}
