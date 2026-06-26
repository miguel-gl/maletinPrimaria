(function () {
  "use strict";

  var ACTIVATION_KEY = "maletinPrimariaActivation";
  var LICENSE_PATTERN = /^[A-Z0-9]{4}$/;
  var PHONE_MIN_LENGTH = 7;

  var ERROR_MESSAGES = {
    400: "Datos invalidos. Revisa los campos e intenta de nuevo.",
    404: "La licencia ingresada no existe. Verifica tu clave.",
    409: "Esta licencia ya esta en uso en otro equipo.",
    500: "Error del servidor. Intenta de nuevo en unos minutos.",
  };

  function getActivation() {
    try {
      var raw = localStorage.getItem(ACTIVATION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function isActivated() {
    var data = getActivation();
    return data && data.activated === true && typeof data.license === "string" && data.license.length === 19;
  }

  if (isActivated()) {
    window.location.replace("inicio.html");
    return;
  }

  var form = document.getElementById("activacionForm");
  var nombreInput = document.getElementById("actNombre");
  var lic1 = document.getElementById("actLic1");
  var lic2 = document.getElementById("actLic2");
  var lic3 = document.getElementById("actLic3");
  var lic4 = document.getElementById("actLic4");
  var telefonoInput = document.getElementById("actTelefono");
  var folioInput = document.getElementById("actFolio");
  var submitBtn = document.getElementById("actSubmitBtn");
  var submitText = document.getElementById("actSubmitText");
  var feedback = document.getElementById("actFeedback");
  var licenseBox = document.querySelector(".act-license-box");

  var licenseInputs = [lic1, lic2, lic3, lic4];

  function clearFieldError(fieldId) {
    var errorEl = document.getElementById(fieldId + "Error");
    if (errorEl) { errorEl.textContent = ""; }
  }

  function setFieldError(fieldId, message) {
    var errorEl = document.getElementById(fieldId + "Error");
    if (errorEl) { errorEl.textContent = message; }
  }

  function clearFeedback() {
    feedback.className = "act-feedback";
    feedback.textContent = "";
  }

  function showFeedback(message, type) {
    feedback.className = "act-feedback is-" + type;
    feedback.textContent = message;
  }

  function sanitize(value) {
    return String(value || "").trim();
  }

  function validateLicenseSegment(value) {
    return LICENSE_PATTERN.test(value.toUpperCase());
  }

  function buildLicense() {
    return licenseInputs.map(function (input) {
      return sanitize(input.value).toUpperCase();
    }).join("-");
  }

  function updateSegmentState(input) {
    var val = sanitize(input.value).toUpperCase();
    input.classList.remove("is-invalid", "is-filled");
    if (val.length === 4 && validateLicenseSegment(val)) {
      input.classList.add("is-filled");
    }
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    if (loading) {
      submitBtn.classList.add("is-loading");
      submitText.textContent = "Validando...";
    } else {
      submitBtn.classList.remove("is-loading");
      submitText.textContent = "Activar licencia";
    }
  }

  function validateForm() {
    var valid = true;
    clearFeedback();

    var nombre = sanitize(nombreInput.value);
    clearFieldError("actNombre");
    nombreInput.classList.remove("is-invalid");
    if (!nombre) {
      setFieldError("actNombre", "El nombre completo es obligatorio.");
      nombreInput.classList.add("is-invalid");
      valid = false;
    } else if (nombre.length < 5) {
      setFieldError("actNombre", "Ingresa tu nombre completo.");
      nombreInput.classList.add("is-invalid");
      valid = false;
    }

    clearFieldError("actLicencia");
    if (licenseBox) { licenseBox.classList.remove("is-invalid"); }
    var allFilled = true;
    for (var i = 0; i < licenseInputs.length; i++) {
      var seg = sanitize(licenseInputs[i].value).toUpperCase();
      if (!seg || !validateLicenseSegment(seg)) {
        allFilled = false;
        licenseInputs[i].classList.add("is-invalid");
      }
    }

    if (!allFilled) {
      setFieldError("actLicencia", "Completa los 4 bloques de la licencia (XXXX-XXXX-XXXX-XXXX).");
      if (licenseBox) { licenseBox.classList.add("is-invalid"); }
      valid = false;
    }

    var telefono = sanitize(telefonoInput.value).replace(/[\s\-\(\)]/g, "");
    clearFieldError("actTelefono");
    telefonoInput.classList.remove("is-invalid");
    if (!telefono) {
      setFieldError("actTelefono", "El telefono es obligatorio.");
      telefonoInput.classList.add("is-invalid");
      valid = false;
    } else if (telefono.length < PHONE_MIN_LENGTH || !/^\d+$/.test(telefono)) {
      setFieldError("actTelefono", "Ingresa un numero de telefono valido.");
      telefonoInput.classList.add("is-invalid");
      valid = false;
    }

    var folio = sanitize(folioInput.value);
    clearFieldError("actFolio");
    folioInput.classList.remove("is-invalid");
    if (!folio) {
      setFieldError("actFolio", "El folio de compra es obligatorio.");
      folioInput.classList.add("is-invalid");
      valid = false;
    }

    return valid;
  }

  licenseInputs.forEach(function (input, index) {
    input.addEventListener("input", function () {
      var val = input.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      input.value = val;
      updateSegmentState(input);

      if (licenseBox) { licenseBox.classList.remove("is-invalid"); }
      clearFieldError("actLicencia");

      if (val.length === 4 && index < licenseInputs.length - 1) {
        licenseInputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && input.value === "" && index > 0) {
        licenseInputs[index - 1].focus();
      }
    });

    input.addEventListener("paste", function (e) {
      e.preventDefault();
      var pasted = (e.clipboardData || window.clipboardData).getData("text");
      var cleaned = pasted.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      var parts = cleaned.match(/.{1,4}/g) || [];

      for (var i = 0; i < parts.length && (index + i) < licenseInputs.length; i++) {
        licenseInputs[index + i].value = parts[i];
        updateSegmentState(licenseInputs[index + i]);
      }

      var lastFilled = Math.min(index + parts.length, licenseInputs.length) - 1;
      if (lastFilled >= 0) {
        licenseInputs[lastFilled].focus();
      }
    });
  });

  [nombreInput, telefonoInput, folioInput].forEach(function (input) {
    input.addEventListener("input", function () {
      input.classList.remove("is-invalid");
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!validateForm()) { return; }

    setLoading(true);
    clearFeedback();

    var license = buildLicense();

    window.maletinLicense.activate({
      licencia: license,
      nombre_completo: sanitize(nombreInput.value),
      telefono: sanitize(telefonoInput.value),
      folio_compra: sanitize(folioInput.value),
    }).then(function (result) {
      if (result.ok && result.status === "ok") {
        var activation = {
          activated: true,
          name: sanitize(nombreInput.value),
          license: license,
          phone: sanitize(telefonoInput.value),
          purchaseReceipt: sanitize(folioInput.value),
          licenciaId: result.data ? result.data.licencia_id : null,
          clienteId: result.data ? result.data.cliente_id : null,
          activatedAt: (result.data && result.data.activada_en) || new Date().toISOString().slice(0, 19),
        };

        localStorage.setItem(ACTIVATION_KEY, JSON.stringify(activation));
        showFeedback("Licencia activada correctamente. Bienvenido/a!", "success");

        window.setTimeout(function () {
          window.location.replace("inicio.html");
        }, 1200);
        return;
      }

      setLoading(false);
      var msg = ERROR_MESSAGES[result.httpStatus] || result.message || "Ocurrio un error inesperado. Intenta de nuevo.";
      showFeedback(msg, "error");

    }).catch(function () {
      setLoading(false);
      showFeedback("No se pudo conectar al servidor. Verifica tu conexion a internet.", "error");
    });
  });
})();
