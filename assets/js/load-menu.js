(function () {
  'use strict';

  function loadMenu() {
    var container = document.getElementById('beta-menu-container');
    if (!container) {
      console.error('Menu container not found');
      return;
    }

    fetch('components/menu.html')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to load menu: ' + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        container.innerHTML = html;
        console.log('Menu loaded successfully');
        initMenu();
      })
      .catch(function (err) {
        console.error('Error loading menu:', err);
        // Crear botón de fallback si falla el fetch
        createFallbackMenu(container);
      });
  }

  function createFallbackMenu(container) {
    var fab = document.createElement('button');
    fab.className = 'beta-fab';
    fab.id = 'beta-nav-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Abrir menú de navegación');
    
    var overlay = document.createElement('div');
    overlay.className = 'beta-nav-overlay d-none';
    overlay.id = 'beta-nav-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    
    var nav = document.createElement('nav');
    nav.className = 'beta-dock';
    nav.setAttribute('aria-label', 'Accesos rápidos');
    nav.innerHTML = '<a class="beta-dock-item" href="#top" data-label="Inicio" aria-label="Inicio"><span class="beta-dock-label">Inicio</span></a>';
    
    overlay.appendChild(nav);
    container.appendChild(fab);
    container.appendChild(overlay);
    
    console.log('Fallback menu created');
    initMenu();
  }

  function initMenu() {
    var fab = document.getElementById('beta-nav-fab');
    var overlay = document.getElementById('beta-nav-overlay');
    var dock = overlay ? overlay.querySelector('.beta-dock') : null;
    var dockItems = dock ? dock.querySelectorAll('.beta-dock-item') : [];
    var profileAvatar = document.querySelector('.beta-profile-btn img');
    var dockAvatar = document.getElementById('beta-dock-avatar');

    if (!fab || !overlay || !dock) {
      console.error('Menu elements not found', {fab, overlay, dock});
      return;
    }

    var syncDockAvatar = function () {
      if (!profileAvatar || !dockAvatar) return;
      var avatarSrc = profileAvatar.getAttribute('src');
      if (avatarSrc) {
        dockAvatar.style.backgroundImage = "url('" + avatarSrc + "')";
      }
    };

    syncDockAvatar();

    if (profileAvatar && typeof MutationObserver !== 'undefined') {
      var avatarObserver = new MutationObserver(function () {
        syncDockAvatar();
      });
      avatarObserver.observe(profileAvatar, {
        attributes: true,
        attributeFilter: ['src', 'alt']
      });
    }

    var resetMagnify = function () {
      dockItems.forEach(function (item) {
        item.style.setProperty('--dock-scale', '1');
      });
    };

    var applyMagnify = function (clientX) {
      dockItems.forEach(function (item) {
        var rect = item.getBoundingClientRect();
        var center = rect.left + rect.width / 2;
        var distance = Math.abs(clientX - center);
        var strength = Math.max(0, 1 - distance / 150);
        var scale = 1 + strength * 0.48;
        item.style.setProperty('--dock-scale', scale.toFixed(3));
      });
    };

    dock.addEventListener('mousemove', function (event) {
      applyMagnify(event.clientX);
    });

    dock.addEventListener('mouseleave', function () {
      resetMagnify();
    });

    fab.addEventListener('click', function () {
      syncDockAvatar();
      var isOpen = !overlay.classList.contains('d-none');
      overlay.classList.toggle('d-none', isOpen);
      overlay.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
      fab.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      if (isOpen) {
        resetMagnify();
      }
    });

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        overlay.classList.add('d-none');
        overlay.setAttribute('aria-hidden', 'true');
        fab.setAttribute('aria-expanded', 'false');
        resetMagnify();
      }
    });

    dockItems.forEach(function (item) {
      item.addEventListener('click', function () {
        overlay.classList.add('d-none');
        overlay.setAttribute('aria-hidden', 'true');
        fab.setAttribute('aria-expanded', 'false');
        resetMagnify();
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !overlay.classList.contains('d-none')) {
        overlay.classList.add('d-none');
        overlay.setAttribute('aria-hidden', 'true');
        fab.setAttribute('aria-expanded', 'false');
        resetMagnify();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMenu);
  } else {
    loadMenu();
  }
})();
