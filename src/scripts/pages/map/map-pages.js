let mapInstance = null;

export default class MapPage {
  async render() {
    return `
      <section class="container">
        <h1>Peta Story</h1>
        <div class="map-layout">
          <div id="map" style="height:500px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
          <aside class="map-list" aria-label="Daftar cerita dengan lokasi">
            <h2>Daftar Cerita</h2>
            <div id="story-list" class="story-list" role="list"></div>
          </aside>
        </div>
      </section>
    `;
  }

  async afterRender() {
    let markers = [];

    try {
      const token = localStorage.getItem('token');
      const storyList = document.getElementById('story-list');

      if (!token) {
        storyList.innerHTML = `<p>⚠ Silakan login terlebih dahulu untuk melihat cerita di peta.</p>`;
        return;
      }

      const res = await fetch('https://story-api.dicoding.dev/v1/stories?location=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.error) {
        storyList.innerHTML = `<p>Gagal memuat data: ${data.message}</p>`;
        return;
      }

      const stories = data.listStory.filter(story => story.lat && story.lon);

      this._renderList(stories);

      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }

      mapInstance = L.map('map').setView([-2.5489, 118.0149], 4);
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstance);

      const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap contributors',
      });

      L.control.layers({ 'OpenStreetMap': osm, 'Topographic': topo }).addTo(mapInstance);

      const bounds = [];

      stories.forEach((story, index) => {
        const lat = parseFloat(story.lat);
        const lon = parseFloat(story.lon);

        const popupContent = `
          <div style="max-width:180px;">
            <img src="${story.photoUrl}" alt="Foto ${story.name}" style="width:100%;border-radius:8px;margin-bottom:6px;">
            <strong>${story.name}</strong>
            <p style="font-size:0.9em; color:#555;">${story.description || 'Tidak ada deskripsi.'}</p>
          </div>
        `;

        const marker = L.marker([lat, lon]).addTo(mapInstance);
        marker.bindPopup(popupContent);

        // Klik marker → aktifkan list item
        marker.on('click', () => this._activate(index, markers, stories));

        markers.push(marker);
        bounds.push([lat, lon]);
      });

      // Fokus agar semua marker terlihat
      if (bounds.length > 0) {
        mapInstance.fitBounds(bounds, { padding: [20, 20] });
      }

      // Klik list → buka popup marker
      document.querySelectorAll('.story-item').forEach((item, index) => {
        item.addEventListener('click', () => this._activate(index, markers, stories));
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this._activate(index, markers, stories);
          }
        });
      });

    } catch (err) {
      console.error('Kesalahan memuat peta:', err);
      document.getElementById('story-list').innerHTML = `<p>Terjadi kesalahan koneksi saat memuat data cerita.</p>`;
    }
  }

  _renderList(stories) {
    const list = document.getElementById('story-list');

    if (stories.length === 0) {
      list.innerHTML = `<p>Tidak ada cerita dengan lokasi.</p>`;
      return;
    }

    list.innerHTML = stories.map((story, index) => `
      <article class="story-item" 
        data-index="${index}" 
        role="listitem" 
        tabindex="0" 
        aria-label="Cerita oleh ${story.name}">
        <img src="${story.photoUrl}" 
             alt="Foto ${story.name}" 
             class="story-image" 
             loading="lazy" 
             style="width:100%;border-radius:8px;">
        <div class="story-meta">
          <h3>${story.name}</h3>
          <p>${story.description ? story.description.slice(0, 100) + '...' : 'Tidak ada deskripsi.'}</p>
          <small>Lat: ${story.lat} | Lon: ${story.lon}</small>
        </div>
      </article>
    `).join('');
  }

  _activate(index, markers, stories) {
    document.querySelectorAll('.story-item').forEach(el => el.classList.remove('active'));

    const selectedCard = document.querySelector(`.story-item[data-index="${index}"]`);
    selectedCard?.classList.add('active');
    selectedCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const story = stories[index];
    const marker = markers[index];
    if (marker && story) {
      mapInstance.setView([story.lat, story.lon], 10, { animate: true });
      marker.openPopup();
    }
  }
}
