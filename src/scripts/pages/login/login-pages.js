import { login } from '../../data/api.js';

export default class LoginPage {
  async render() {
    return `
      <section class="login-section">
        <h1>Masuk ke Aplikasi Story</h1>
        <form id="login-form" aria-label="Login form">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required />

          <label for="password">Password</label>
          <input type="password" id="password" name="password" required />

          <button type="submit" class="btn primary">Login</button>
          <p id="login-message" role="alert" aria-live="polite"></p>
        </form>
      </section>
    `;
  }

  async afterRender() {
    const form = document.getElementById('login-form');
    const message = document.getElementById('login-message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const password = form.password.value.trim();

      if (!email || !password) {
        message.textContent = 'Email dan Password harus diisi.';
        return;
      }

      message.textContent = 'Memproses login...';

      try {
        const res = await login({ email, password });

        const token = res?.loginResult?.token || null;
        
        if (!token) {
          // Penanganan error jika API mengembalikan kegagalan
          const errorMessage = res?.message || 'Token tidak ditemukan.';
          message.textContent = `Login gagal: ${errorMessage}`;
          return;
        }

        // Jika berhasil
        localStorage.setItem('token', token);
        
        // Simpan nama pengguna jika tersedia
        const name = res?.loginResult?.name || '';
        if (name) localStorage.setItem('userName', name);

        message.textContent = 'Login berhasil! Mengalihkan...';
        
        // Mengalihkan ke halaman beranda/home
        setTimeout(() => {
          window.location.hash = '#/';
        }, 1000);
      } catch (err) {
        message.textContent = `Error: ${err.message}`;
      }
    });
  }
};