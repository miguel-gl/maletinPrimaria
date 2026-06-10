(function () {
  "use strict";

  function initCarouselControls() {
    var carousel = document.getElementById("beta2-carousel");
    var prevBtn = document.getElementById("beta2-prev");
    var nextBtn = document.getElementById("beta2-next");

    if (!carousel || !prevBtn || !nextBtn) {
      return;
    }

    var step = function () {
      return Math.round(carousel.clientWidth * 0.82);
    };

    prevBtn.addEventListener("click", function () {
      carousel.scrollBy({ left: -step(), behavior: "smooth" });
    });

    nextBtn.addEventListener("click", function () {
      carousel.scrollBy({ left: step(), behavior: "smooth" });
    });
  }

  initCarouselControls();
})();
