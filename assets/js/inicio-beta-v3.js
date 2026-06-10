(function() {
  'use strict';

  // Reveal Animation on Scroll
  function initRevealCards() {
    var revealElements = document.querySelectorAll('[data-reveal]');
    if (revealElements.length === 0) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(function(el) {
      observer.observe(el);
    });
  }

  // Carousel Controls
  function initCarousel() {
    var carousel = document.querySelector('.v3-carousel');
    var prevBtn = document.getElementById('v3-carousel-prev');
    var nextBtn = document.getElementById('v3-carousel-next');

    if (!carousel || !prevBtn || !nextBtn) return;

    var scrollAmount = 280;

    prevBtn.addEventListener('click', function() {
      carousel.scrollBy({
        left: -scrollAmount,
        behavior: 'smooth'
      });
    });

    nextBtn.addEventListener('click', function() {
      carousel.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    });
  }

  // Menu FAB and Overlay
  function initMenu() {
    var fab = document.getElementById('v3-fab');
    var overlay = document.getElementById('v3-menu-overlay');
    var closeBtn = document.getElementById('v3-menu-close');

    if (!fab || !overlay || !closeBtn) return;

    fab.addEventListener('click', function() {
      overlay.classList.remove('d-none');
    });

    closeBtn.addEventListener('click', function() {
      overlay.classList.add('d-none');
    });

    overlay.addEventListener('click', function(event) {
      if (event.target === overlay) {
        overlay.classList.add('d-none');
      }
    });

    // Close on menu item click
    var menuItems = document.querySelectorAll('.v3-menu-item');
    menuItems.forEach(function(item) {
      item.addEventListener('click', function() {
        overlay.classList.add('d-none');
      });
    });
  }

  // Initialize all
  initRevealCards();
  initCarousel();
  initMenu();
})();
