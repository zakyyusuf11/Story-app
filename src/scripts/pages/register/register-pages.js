export default class RegisterPage {
  async render() {
    return `
      <section class="container page">
        <h1 id="register-title">Daftar Akun Baru</h1>
        <p>Silahkan isi form di bawah ini untuk membuat akun baru.</p>

        <form id="register-form" aria-labelledby="register-title">
          <div class="form-group">
            <label for="name">Nama Lengkap</label>
            <input 
              type="text" 
              id="name" 
              name="name"
              placeholder="Masukkan nama lengkap Anda"
              aria-required="true"
              required
            />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input 
              type="email" 
              id="email" 
              name="email"
              placeholder="Masukkan email aktif"
              aria-required="true"
              required
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input 
              type="password" 
              id="password" 
              name="password"
              placeholder="Buat password minimal 8 karakter"
              aria-required="true"
              required
            />
          </div>

          <button type="submit" class="btn-primary">Daftar</button>
        </form>

        <p>Sudah punya akun? <a href="#/login">Login</a></p>
      </section>
    `;
  }

  async afterRender() {
    const form = document.getElementById('register-form');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();

      if (password.length < 8) {
        alert('Password minimal 8 karakter.');
        return;
      }

      try {
        const response = await fetch('https://story-api.dicoding.dev/v1/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });

        const result = await response.json();

        if (response.ok && !result.error) {
          alert('Registrasi berhasil! Silakan login.');
          window.location.hash = '/login';
        } else {
          alert('Registrasi gagal: ' + result.message);
        }
      } catch (error) {
        alert('Terjadi kesalahan koneksi. Coba lagi.');
        console.error(error);
      }
    });
  }
}
