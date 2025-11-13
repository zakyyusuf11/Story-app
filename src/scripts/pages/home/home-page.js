// src/scripts/pages/home/home-page.js
import { saveFavorite, getAllFavorites, deleteFavorite } from '../../data/idb';

export default class HomePage {
  async render() {
    return `
      <section class="container">
        <h1>Home Page</h1>
        <p>
          <button type="button" class="btn" data-hash="#/add" aria-label="Tambah story baru">+ Tambah Story</button>
          <button type="button" class="btn" data-hash="#/map" aria-label="Lihat peta cerita">Lihat Peta</button>
        </p>

        <h2>Story</h2>
        <div id="stories-list" class="stories-list" aria-live="polite"></div>

        <h2>Favorit Anda</h2>
        <div id="favorites-list" class="stories-list" aria-live="polite"></div>
      </section>
    `;
  }

  async afterRender() {
    // Pastikan elemen tersedia lalu render content
    await this._renderStories();
    await this._renderFavorites();

    // global handler: semua tombol dengan data-hash akan mengubah hash (SPA navigation)
    // delegasi di body agar tombol yang dibuat dinamis tetap tertangani
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-hash]');
      if (!btn) return;
      const hash = btn.getAttribute('data-hash');
      if (hash) {
        // ubah hash untuk navigasi SPA; gunakan replace kalau mau mengganti history
        location.hash = hash;
      }
    });

    // event delegation: tombol simpan (di dalam #stories-list)
    const storiesList = document.getElementById('stories-list');
    if (storiesList) {
      storiesList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.save-btn');
        if (!btn) return;
        // Ambil data-story yang sudah di-encode saat render
        const enc = btn.getAttribute('data-story');
        if (!enc) return;
        let storyData = null;
        try {
          storyData = JSON.parse(decodeURIComponent(enc));
        } catch (err) {
          console.error('Gagal parse data-story', err);
          return;
        }

        try {
          await saveFavorite(storyData);
          await this._renderFavorites();
          btn.textContent = 'Tersimpan';
          btn.disabled = true;
        } catch (err) {
          console.error('Gagal menyimpan favorit', err);
        }
      });
    }

    // event delegation: tombol hapus favorit
    const favList = document.getElementById('favorites-list');
    if (favList) {
      favList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-fav-btn');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        try {
          await deleteFavorite(id);
          await this._renderFavorites();
          await this._renderStories(); // refresh agar tombol "Simpan" kembali aktif jika dihapus
        } catch (err) {
          console.error('Gagal menghapus favorit', err);
        }
      });
    }
  }

  async _renderStories() {
    const container = document.getElementById('stories-list');
    if (!container) return;
    container.innerHTML = '<p>Memuat story...</p>';

    try {
      const token = localStorage.getItem('token');
      const favs = await getAllFavorites();
      const favIds = new Set((favs || []).map(f => String(f.id)));

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Panggil endpoint termasuk lokasi agar lat/lon tersedia
      const res = await fetch('https://story-api.dicoding.dev/v1/stories?location=1', { headers });
      const data = await res.json();

      const stories = data.listStory || data.list || [];

      if (!Array.isArray(stories) || stories.length === 0) {
        container.innerHTML = '<p>Tidak ada story.</p>';
        return;
      }

      container.innerHTML = stories
        .map(story => {
          const id = story.id;
          const name = story.name || 'Tanpa Nama';
          const description = story.description || '';
          const createdAt = story.createdAt;
          const photoUrl = story.photoUrl || '';
          const lat = (typeof story.lat !== 'undefined' && story.lat !== null) ? story.lat : null;
          const lon = (typeof story.lon !== 'undefined' && story.lon !== null) ? story.lon : null;

          // stringify story untuk disimpan di atribut data-story,
          // lalu encodeURIComponent supaya aman di HTML attribute
          const storyObj = {
            id,
            name,
            description,
            createdAt,
            photoUrl,
            lat,
            lon,
          };
          const storyAttrEncoded = encodeURIComponent(JSON.stringify(storyObj));

          const isFav = favIds.has(String(id));
          const savedText = isFav ? 'Tersimpan' : 'Simpan';
          const disabledAttr = isFav ? 'disabled' : '';

          return `
            <article class="story-card" role="article" aria-labelledby="story-${this._escapeHtml(String(id))}">
              <div class="story-content">
                ${photoUrl
                  ? `<img src="${this._escapeHtml(photoUrl)}" alt="Foto ${this._escapeHtml(name)}" class="story-image" loading="lazy" style="width:100%;border-radius:8px;margin-bottom:8px;">`
                  : ''
                }
                <h2 id="story-${this._escapeHtml(String(id))}">${this._escapeHtml(name)}</h2>
                <p>${description ? this._escapeHtml(description.substring(0, 150)) + (description.length > 150 ? '...' : '') : 'Tidak ada deskripsi'}</p>
                <small>Dibuat pada: ${createdAt ? new Date(createdAt).toLocaleDateString('id-ID') : '—'}</small>
                ${lat !== null && lon !== null
                  ? `<p><small>📍 Lokasi: ${this._escapeHtml(String(lat))}, ${this._escapeHtml(String(lon))}</small></p>`
                  : ''
                }
                <p>
                  <button class="save-btn btn" data-id="${this._escapeHtml(String(id))}" data-story="${storyAttrEncoded}" aria-label="Simpan story ${this._escapeHtml(name)}" ${disabledAttr}>${savedText}</button>
                </p>
              </div>
            </article>
          `;
        })
        .join('');
    } catch (err) {
      container.innerHTML = `<p>Gagal memuat story: ${this._escapeHtml(String(err))}</p>`;
      console.error(err);
    }
  }

  async _renderFavorites() {
    const container = document.getElementById('favorites-list');
    if (!container) return;
    container.innerHTML = '<p>Memuat favorit...</p>';
    try {
      const favs = await getAllFavorites();
      if (!favs || favs.length === 0) {
        container.innerHTML = '<p>Tidak ada favorit.</p>';
        return;
      }

      container.innerHTML = favs
        .map(f => `
          <article class="story-card" role="article" aria-labelledby="fav-${this._escapeHtml(String(f.id))}">
            <div class="story-content">
              ${f.photoUrl
                ? `<img src="${this._escapeHtml(f.photoUrl)}" alt="Foto ${this._escapeHtml(f.name)}" class="story-image" loading="lazy" style="width:100%;border-radius:8px;margin-bottom:8px;">`
                : ''
              }
              <h3 id="fav-${this._escapeHtml(String(f.id))}">${this._escapeHtml(f.name)}</h3>
              <p>${f.description ? (this._escapeHtml(f.description.substring(0, 150)) + (f.description.length > 150 ? '...' : '')) : 'Tidak ada deskripsi'}</p>
              <small>Dibuat pada: ${f.createdAt ? new Date(f.createdAt).toLocaleDateString('id-ID') : '—'}</small>
              ${f.lat && f.lon
                ? `<p><small>📍 Lokasi: ${this._escapeHtml(String(f.lat))}, ${this._escapeHtml(String(f.lon))}</small></p>`
                : ''
              }
              <p>
                <button class="delete-fav-btn btn" data-id="${this._escapeHtml(String(f.id))}" aria-label="Hapus favorit ${this._escapeHtml(f.name)}">Hapus</button>
              </p>
            </div>
          </article>
        `)
        .join('');
    } catch (err) {
      container.innerHTML = `<p>Gagal memuat favorit: ${this._escapeHtml(String(err))}</p>`;
      console.error(err);
    }
  }

  _escapeHtml(str) {
    if (str === null || typeof str === 'undefined') return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
