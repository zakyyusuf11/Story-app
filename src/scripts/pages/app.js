import routes from '../routes/routes.js';
import UrlParser from '../routes/url-parser.js';
import'./styles/styles.css';

class App {
  constructor({ button, drawer, content }) {
    this._button = button;
    this._drawer = drawer;
    this._content = content;

    this._initialAppShell();
  }

  _initialAppShell() {
    this._button.addEventListener('click', () => {
      this._drawer.classList.toggle('open');
    });

    // Menangani perubahan hash
    window.addEventListener('hashchange', () => {
      this.renderPage();
    });

    this._setupAuthButton();
    // Panggil renderPage() saat pertama kali dimuat
    this.renderPage(); 
  }

  _setupAuthButton() {
    const header = document.querySelector('header');
    if (!header.querySelector('#auth-container')) {
      const div = document.createElement('div');
      div.id = 'auth-container';
      header.appendChild(div);
    }
    this._renderAuthState();
    window.addEventListener('storage', () => this._renderAuthState());
  }

  _renderAuthState() {
    const authContainer = document.getElementById('auth-container');
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('userName');
    
    // Pastikan authContainer ditemukan sebelum memanipulasi DOM
    if (!authContainer) { 
        console.error("Elemen #auth-container tidak ditemukan saat _renderAuthState dipanggil.");
        return; 
    }
    if (token) {
      authContainer.innerHTML = `
        <span class="auth-welcome">👋 Hi, ${name || 'User'}</span>
        <button id="logout-btn" class="btn small danger">Logout</button>
      `;
      authContainer.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'logout-btn') {
          localStorage.removeItem('token');
          localStorage.removeItem('userName');
          this._renderAuthState();
          window.location.hash = '#/';
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      });
    } else {
      authContainer.innerHTML = `<a href="#/login" class="btn small">Login</a>`;
    }
  }

  async renderPage() {
    const url = UrlParser.getActiveRoute();
    const routeKey = UrlParser.getRoute(location.hash.replace('#', '') || '/');
    let page = routes[routeKey]; // Mendapatkan referensi Class atau Objek Literal

    // ✅ LOGIKA PERBAIKAN DI SINI:
    // Cek apakah 'page' adalah Class (function) yang perlu di-instantiate.
    // Ini menangani HomePage, MapPage, dll. yang merupakan Class.
    if (typeof page === 'function') {
      page = new page();
    }
    // Jika itu adalah LoginPage (Objek Literal), 'page' akan tetap menjadi objek tersebut.
    // Jika route tidak ditemukan
    if (!page) {
        this._content.innerHTML = '<h1>404: Halaman Tidak Ditemukan</h1>';
        return;
    }
    // END LOGIKA PERBAIKAN

    this._content.classList.add('fade-out');
    await new Promise((r) => setTimeout(r, 180));
    
    // Render konten dari instance/objek page yang sudah benar
    this._content.innerHTML = await page.render();
    
    this._content.classList.remove('fade-out');
    this._content.classList.add('fade-in');
    
    // Panggil afterRender hanya jika metode tersebut ada pada objek/instance page
    if (page.afterRender) {
        await page.afterRender();
    }

    setTimeout(() => this._content.classList.remove('fade-in'), 300);
  }
}

export default App;
