// Löst die Community-Basis auf und setzt alle `a[data-community-link]`.
//
// Die Game-Plattform (:18080, server.js) serviert selbst kein /community —
// relative Links liefen dort ins 404 (N-05). Auflösung:
//   1. window.__SWOW_COMMUNITY_URL__ gewinnt (Deployment-Override),
//   2. lokal (localhost/127.0.0.1) absolut auf den Community-Host :13000,
//   3. sonst relativ (Production-Edge routet /community* selbst).
(function () {
  function base() {
    if (window.__SWOW_COMMUNITY_URL__) {
      return String(window.__SWOW_COMMUNITY_URL__).replace(/\/+$/, '');
    }
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return window.location.protocol + '//' + host + ':13000';
    }
    return '';
  }
  function apply() {
    var prefix = base();
    var links = document.querySelectorAll('a[data-community-link]');
    for (var i = 0; i < links.length; i++) {
      var path = links[i].getAttribute('data-community-link') || '/community';
      if (path.charAt(0) !== '/') path = '/' + path;
      links[i].setAttribute('href', prefix + path);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
