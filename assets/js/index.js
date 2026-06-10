document.addEventListener('DOMContentLoaded', function () {
  var menuButton = document.querySelector('.beta-menu-btn');
  var menuPanel = document.getElementById('betaDockPanel');
  var backdrop = document.getElementById('betaMenuBackdrop');

  if (!menuButton || !menuPanel || !backdrop) {
    return;
  }

  var openMenu = function () {
    document.body.classList.add('menu-open');
    document.body.classList.remove('menu-closed');
    menuPanel.classList.add('show');
    menuPanel.setAttribute('aria-hidden', 'false');
    backdrop.setAttribute('aria-hidden', 'false');
    menuButton.setAttribute('aria-expanded', 'true');
  };

  var closeMenu = function () {
    document.body.classList.add('menu-closed');
    document.body.classList.remove('menu-open');
    menuPanel.classList.remove('show');
    menuPanel.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
    menuButton.setAttribute('aria-expanded', 'false');
  };

  document.body.classList.add('menu-closed');
  menuButton.setAttribute('aria-expanded', 'false');

  menuButton.addEventListener('click', function (event) {
    event.preventDefault();
    if (menuPanel.classList.contains('show')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  backdrop.addEventListener('click', function () {
    closeMenu();
  });

  menuPanel.addEventListener('click', function (event) {
    var target = event.target.closest('a, .btn-close-boots');
    if (!target) {
      return;
    }
    closeMenu();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
});
