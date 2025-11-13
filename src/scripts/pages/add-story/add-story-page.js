// src/scripts/pages/add-story/add-story-page.js
import { postStory } from '../../data/api';

export default class AddStoryPage {
  constructor() {
    this._map = null;
    this._marker = null;
    this._stream = null;
  }

  render() {
    return `
      <section class="add-story-page container">
        <h1>Tambah Cerita</h1>
        <form id="add-story-form" aria-label="Form Tambah Cerita">
          <div class="form-group">
            <label for="photo">Foto Cerita</label>
            <input type="file" id="photo" name="photo" accept="image/*" />
          </div>

          <div class="form-group camera-controls">
            <button type="button" id="open-camera" class="btn">📷 Gunakan Kamera</button>
            <button type="button" id="take-photo" class="btn" style="display:none;">Ambil Foto</button>
            <button type="button" id="close-camera" class="btn" style="display:none;">Tutup Kamera</button>
            <div id="camera-preview" style="display:none;margin-top:8px;">
              <video id="camera-video" autoplay playsinline style="max-width:100%;border-radius:8px;"></video>
              <canvas id="camera-canvas" style="display:none;"></canvas>
            </div>
          </div>

          <div class="form-group">
            <label for="description">Deskripsi</label>
            <textarea id="description" name="description" rows="4" required></textarea>
          </div>

          <div class="form-group">
            <label for="coords">Koordinat (klik peta untuk memilih)</label>
            <input type="text" id="coords" name="coords" readonly placeholder="Belum dipilih" />
          </div>

          <div id="mini-map" style="height:300px;border-radius:8px;"></div>

          <div class="form-actions">
            <button type="submit" id="submit-btn" class="btn">Kirim</button>
          </div>

          <div id="message" role="status" aria-live="polite"></div>
        </form>
      </section>
    `;
  }

  async afterRender() {
    // Map init (expects Leaflet L available globally)
    const L = window.L;
    if (!L) {
      document.getElementById('message').textContent = 'Leaflet tidak tersedia.';
      return;
    }
    this._map = L.map('mini-map').setView([-6.2, 106.816666], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this._map);

    this._map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (this._marker) this._marker.remove();
      this._marker = L.marker([lat, lng]).addTo(this._map);
      document.getElementById('coords').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    });

    // Camera controls
    const openCameraBtn = document.getElementById('open-camera');
    const takePhotoBtn = document.getElementById('take-photo');
    const closeCameraBtn = document.getElementById('close-camera');
    const cameraPreview = document.getElementById('camera-preview');
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const photoInput = document.getElementById('photo');
    let stream = null;

    openCameraBtn && openCameraBtn.addEventListener('click', async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this._stream = stream;
        video.srcObject = stream;
        cameraPreview.style.display = 'block';
        takePhotoBtn.style.display = 'inline-block';
        closeCameraBtn.style.display = 'inline-block';
        openCameraBtn.style.display = 'none';
      } catch (err) {
        console.error('Camera open failed', err);
        document.getElementById('message').textContent = 'Tidak dapat mengakses kamera: ' + err.message;
      }
    });

    takePhotoBtn && takePhotoBtn.addEventListener('click', () => {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob((blob) => {
        const file = new File([blob], 'camera-capture.png', { type: blob.type });
        const dt = new DataTransfer();
        dt.items.add(file);
        photoInput.files = dt.files;
        document.getElementById('message').textContent = 'Foto diambil, siap dikirim.';
      }, 'image/png');
    });

    closeCameraBtn && closeCameraBtn.addEventListener('click', () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        this._stream = null;
      }
      cameraPreview.style.display = 'none';
      takePhotoBtn.style.display = 'none';
      closeCameraBtn.style.display = 'none';
      openCameraBtn.style.display = 'inline-block';
    });

    // Form submit
    const form = document.getElementById('add-story-form');
    const message = document.getElementById('message');

    form.addEventListener('submit', async (evt) => {
      evt.preventDefault();
      message.textContent = '';

      const fileInput = document.getElementById('photo');
      const description = document.getElementById('description').value.trim();
      const coordsVal = document.getElementById('coords').value.trim();
      let lat = null, lon = null;
      if (coordsVal) {
        const sp = coordsVal.split(',').map(s => s.trim());
        lat = parseFloat(sp[0]); lon = parseFloat(sp[1]);
      }

      if (!fileInput.files.length) {
        message.textContent = 'Pilih foto atau ambil lewat kamera.';
        return;
      }
      const photoFile = fileInput.files[0];

      const token = localStorage.getItem('token');
      if (!token) {
        message.textContent = 'Anda harus login sebelum mengirim story.';
        return;
      }

      try {
        message.textContent = 'Mengirim...';
        await postStory({
          photoFile,
          description,
          lat: isNaN(lat) ? null : lat,
          lon: isNaN(lon) ? null : lon,
          token,
        });
        message.textContent = 'Story berhasil dikirim!';
        form.reset();
        if (this._marker) { this._marker.remove(); this._marker = null; }
        if (this._stream) { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
      } catch (err) {
        console.error(err);
        message.textContent = 'Gagal mengirim story: ' + (err.message || err);
      }
    });
  }
}
