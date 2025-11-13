import HomePage from '../pages/home/home-page';
import AboutPage from '../pages/about/about-page';
import MapPage from '../pages/map/map-pages';
import AddStoryPage from '../pages/add-story/add-story-page';
import LoginPage from '../pages/login/login-pages'; // pastikan ada ini
import RegisterPage from '../pages/register/register-pages';
const routes = {
  '/': new HomePage(),
  '/about': new AboutPage(),
  '/map': new MapPage(),
  '/add': new AddStoryPage(),
  '/login': new LoginPage(),
  '/register': new RegisterPage(), // ✅ tambahkan jika belum ada
};

export default routes;
