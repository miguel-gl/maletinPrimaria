(function () {
  "use strict";

  var ACTIVATION_KEY = "maletinPrimariaActivation";

  try {
    var raw = localStorage.getItem(ACTIVATION_KEY);
    var data = raw ? JSON.parse(raw) : null;
    var activated = data && data.activated === true && typeof data.license === "string" && data.license.length === 19;

    if (!activated) {
      window.location.replace("activacion.html");
    }
  } catch (_e) {
    window.location.replace("activacion.html");
  }
})();
