
const UrlParser = {
  parseActiveUrl() {
    const hash = window.location.hash || '#/';
    let path = hash.replace('#', '');

    // normalize path 
    if (!path.startsWith('/')) path = `/${path}`;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path || '/';
  },
};

export default UrlParser;
