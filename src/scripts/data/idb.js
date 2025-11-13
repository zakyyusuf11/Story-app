// src/scripts/data/idb.js
// Database configuration
const DB_NAME = 'StoryAppDB';
const DB_VERSION = 3; // Increment untuk memastikan semua store (termasuk outbox) dibuat

// Store names
const STORE_FAVORITES = 'favorites';
const STORE_OFFLINE_STORIES = 'offlineStories';
const STORE_CACHED_STORIES = 'cachedStories';
const STORE_OUTBOX = 'outbox';

/**
 * Membuka koneksi ke IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
export async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion || 0;

      // Store untuk story yang dibuat offline
      if (!db.objectStoreNames.contains(STORE_OFFLINE_STORIES)) {
        const offlineStore = db.createObjectStore(STORE_OFFLINE_STORIES, { keyPath: 'id' });
        offlineStore.createIndex('synced', 'synced', { unique: false });
        offlineStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Store untuk cache story dari API
      if (!db.objectStoreNames.contains(STORE_CACHED_STORIES)) {
        const cacheStore = db.createObjectStore(STORE_CACHED_STORIES, { 
          keyPath: 'id', 
          autoIncrement: false 
        });
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Store untuk favorite stories (bookmark) - ditambahkan di version 2
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
        const favStore = db.createObjectStore(STORE_FAVORITES, { 
          keyPath: 'id', 
          autoIncrement: false 
        });
        favStore.createIndex('savedAt', 'savedAt', { unique: false });
      } else if (oldVersion < 2) {
        // Jika store sudah ada tapi index belum ada, tambahkan index
        const transaction = event.target.transaction;
        const favStore = transaction.objectStore(STORE_FAVORITES);
        if (!favStore.indexNames.contains('savedAt')) {
          favStore.createIndex('savedAt', 'savedAt', { unique: false });
        }
      }

      // Store untuk outbox (sinkronisasi background) - ditambahkan di version 2
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const outboxStore = db.createObjectStore(STORE_OUTBOX, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        outboxStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// ========== FAVORITES OPERATIONS ==========

/**
 * Menyimpan story ke favorites (CREATE)
 * @param {Object} story - Story object untuk disimpan
 * @returns {Promise<Object>}
 */
export async function saveFavorite(story) {
  try {
    const db = await openDB();

    if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
      console.error('[idb] Favorites store tidak tersedia. Silakan refresh halaman.');
      throw new Error('Favorites store tidak tersedia.');
    }

    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    const store = tx.objectStore(STORE_FAVORITES);

    const favoriteData = {
      id: story.id,
      name: story.name || '',
      description: story.description || '',
      photoUrl: story.photoUrl || story.photo || '',
      createdAt: story.createdAt || new Date().toISOString(),
      lat: story.lat || null,
      lon: story.lon || null,
      savedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(favoriteData);
      request.onsuccess = () => resolve(favoriteData);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error saving favorite:', err);
    throw err;
  }
}

/**
 * Mengambil semua favorite stories (READ)
 * @returns {Promise<Array>}
 */
export async function getAllFavorites() {
  try {
    const db = await openDB();

    if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
      console.warn('[idb] Favorites store belum tersedia');
      return [];
    }

    const tx = db.transaction(STORE_FAVORITES, 'readonly');
    const store = tx.objectStore(STORE_FAVORITES);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const result = request.result;
        resolve(Array.isArray(result) ? result : []);
      };
      request.onerror = () => {
        console.error('[idb] Error getting favorites:', request.error);
        resolve([]); // Return empty array instead of rejecting
      };
    });
  } catch (err) {
    console.error('Error getting favorites:', err);
    return [];
  }
}

/**
 * Mengambil satu favorite story berdasarkan ID (READ)
 * @param {string} id - Story ID
 * @returns {Promise<Object|null>}
 */
export async function getFavorite(id) {
  try {
    const db = await openDB();

    if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
      return null;
    }

    const tx = db.transaction(STORE_FAVORITES, 'readonly');
    const store = tx.objectStore(STORE_FAVORITES);

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error getting favorite:', err);
    return null;
  }
}

/**
 * Menghapus story dari favorites (DELETE)
 * @param {string} id - Story ID
 * @returns {Promise<boolean>}
 */
export async function deleteFavorite(id) {
  try {
    const db = await openDB();

    if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
      console.warn('[idb] Favorites store tidak tersedia');
      return false;
    }

    const tx = db.transaction(STORE_FAVORITES, 'readwrite');
    const store = tx.objectStore(STORE_FAVORITES);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error deleting favorite:', err);
    throw err;
  }
}

/**
 * Mengecek apakah story sudah di-favorite
 * @param {string} storyId - Story ID
 * @returns {Promise<boolean>}
 */
export async function isFavorite(storyId) {
  try {
    const db = await openDB();

    if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
      return false;
    }

    const tx = db.transaction(STORE_FAVORITES, 'readonly');
    const store = tx.objectStore(STORE_FAVORITES);

    const favorite = await new Promise((resolve, reject) => {
      const request = store.get(storyId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return !!favorite;
  } catch (err) {
    console.error('Error checking favorite:', err);
    return false;
  }
}

// ========== OFFLINE STORIES OPERATIONS ==========

/**
 * Menambahkan story ke offline storage (CREATE)
 * @param {Object} storyData - Data story
 * @returns {Promise<Object>}
 */
export async function addOfflineStory(storyData) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_OFFLINE_STORIES, 'readwrite');
    const store = tx.objectStore(STORE_OFFLINE_STORIES);

    const offlineStory = {
      id: storyData.id || `offline_${Date.now()}`,
      description: storyData.description || '',
      photo: storyData.photo,
      photoName: storyData.photoName || 'photo.jpg',
      photoType: storyData.photoType || 'image/jpeg',
      lat: storyData.lat || null,
      lon: storyData.lon || null,
      createdAt: storyData.createdAt || new Date().toISOString(),
      synced: storyData.synced || false,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(offlineStory);
      request.onsuccess = () => resolve(offlineStory);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error adding offline story:', err);
    throw err;
  }
}

/**
 * Mengambil semua offline stories (READ)
 * @returns {Promise<Array>}
 */
export async function getAllOfflineStories() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_OFFLINE_STORIES, 'readonly');
    const store = tx.objectStore(STORE_OFFLINE_STORIES);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error getting offline stories:', err);
    return [];
  }
}

/**
 * Mengambil story yang belum di-sync (READ)
 * @returns {Promise<Array>}
 */
export async function getUnsyncedStories() {
  try {
    const allStories = await getAllOfflineStories();
    return allStories.filter(story => story.synced === false || !story.synced);
  } catch (err) {
    console.error('Error getting unsynced stories:', err);
    return [];
  }
}

/**
 * Menandai story sebagai sudah di-sync
 * @param {string} id - Story ID
 * @returns {Promise<void>}
 */
export async function markStoryAsSynced(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_OFFLINE_STORIES, 'readwrite');
    const store = tx.objectStore(STORE_OFFLINE_STORIES);

    const story = await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (story) {
      story.synced = true;
      await new Promise((resolve, reject) => {
        const request = store.put(story);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch (err) {
    console.error('Error marking story as synced:', err);
  }
}

/**
 * Menghapus offline story (DELETE)
 * @param {string} id - Story ID
 * @returns {Promise<void>}
 */
export async function deleteOfflineStory(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_OFFLINE_STORIES, 'readwrite');
    const store = tx.objectStore(STORE_OFFLINE_STORIES);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error deleting offline story:', err);
    throw err;
  }
}

// ========== CACHED STORIES OPERATIONS ==========

/**
 * Menyimpan cache stories dari API (CREATE)
 * @param {Array} stories - Array of stories
 * @returns {Promise<void>}
 */
export async function cacheStories(stories) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHED_STORIES, 'readwrite');
    const store = tx.objectStore(STORE_CACHED_STORIES);

    // Hapus cache lama
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Tambahkan stories baru dengan timestamp
    const timestamp = Date.now();
    for (const story of stories) {
      await new Promise((resolve, reject) => {
        const request = store.add({ ...story, timestamp });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch (err) {
    console.error('Error caching stories:', err);
  }
}

/**
 * Mengambil cached stories (READ)
 * @returns {Promise<Array>}
 */
export async function getCachedStories() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CACHED_STORIES, 'readonly');
    const store = tx.objectStore(STORE_CACHED_STORIES);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error getting cached stories:', err);
    return [];
  }
}

// ========== OUTBOX OPERATIONS (untuk sinkronisasi background) ==========

/**
 * Menambahkan item ke outbox (CREATE)
 * @param {Object} payload - Data untuk di-sync
 * @returns {Promise<number>}
 */
export async function addToOutbox(payload) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    const store = tx.objectStore(STORE_OUTBOX);

    return new Promise((resolve, reject) => {
      const request = store.add(payload);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error adding to outbox:', err);
    throw err;
  }
}

/**
 * Mengambil semua item dari outbox (READ)
 * @returns {Promise<Array>}
 */
export async function getOutboxAll() {
  try {
    const db = await openDB();
    
    // Pastikan store outbox ada
    if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
      console.warn('[idb] Outbox store tidak tersedia');
      return [];
    }
    
    const tx = db.transaction(STORE_OUTBOX, 'readonly');
    const store = tx.objectStore(STORE_OUTBOX);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.error('[idb] Error getting outbox:', request.error);
        resolve([]); // Return empty array instead of rejecting
      };
    });
  } catch (err) {
    console.error('[idb] Error getting outbox:', err);
    return [];
  }
}

/**
 * Menghapus semua item dari outbox (DELETE)
 * @returns {Promise<void>}
 */
export async function clearOutbox() {
  try {
    const db = await openDB();
    
    // Pastikan store outbox ada
    if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
      console.warn('[idb] Outbox store tidak tersedia untuk clear');
      return;
    }
    
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    const store = tx.objectStore(STORE_OUTBOX);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[idb] Error clearing outbox:', request.error);
        resolve(); // Resolve instead of reject untuk tidak crash app
      };
    });
  } catch (err) {
    console.error('[idb] Error clearing outbox:', err);
    // Jangan throw error, biarkan app tetap berjalan
  }
}
