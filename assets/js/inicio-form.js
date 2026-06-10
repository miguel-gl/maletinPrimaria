(function () {
  "use strict";

  var STORAGE_KEY = "maletinPrimariaTeacherProfile";
  var SPLASH_FIRST_TIME_MS = 20000;
  var SPLASH_RETURNING_MS = 1200;
  var DEFAULT_PREFERENCES = {
    theme: "light",
    showRecommendations: true,
    defaultView: "dashboard"
  };

  var selectedIcono = null;
  var selectedNiveles = [];

  function getSplashTextElement() {
    return document.getElementById("inicioSplashText");
  }

  function setSplashText(message) {
    var el = getSplashTextElement();
    if (!el) { return; }
    el.textContent = message;
  }

  function startSplashNarration(isFirstTime) {
    var messages = isFirstTime
      ? [
        "Configurando tu entorno docente...",
        "Activando asistente de IA pedagogica...",
        "Ajustando recomendaciones por nivel y fase...",
        "Sincronizando recursos clave para tu clase...",
        "Preparando accesos rapidos y herramientas...",
        "Casi listo: afinando tu experiencia inicial..."
      ]
      : [
        "Cargando tu espacio de trabajo...",
        "Actualizando recursos recientes..."
      ];

    var messageIndex = 0;
    setSplashText(messages[0]);

    var intervalMs = isFirstTime ? 3000 : 650;
    return window.setInterval(function () {
      messageIndex = (messageIndex + 1) % messages.length;
      setSplashText(messages[messageIndex]);
    }, intervalMs);
  }

  function startSplashProgress(totalMs) {
    var progressEl = document.querySelector(".inicio-splash-bar");
    if (!progressEl) { return null; }

    progressEl.style.width = "0%";
    var startedAt = Date.now();

    var intervalId = window.setInterval(function () {
      var elapsed = Date.now() - startedAt;
      var percent = Math.min(100, Math.round((elapsed / totalMs) * 100));
      progressEl.style.width = percent + "%";
    }, 100);

    return {
      intervalId: intervalId,
      complete: function () {
        progressEl.style.width = "100%";
      }
    };
  }

  function parseStoredProfile(rawValue) {
    if (!rawValue) { return null; }
    try {
      return JSON.parse(rawValue);
    } catch (_error) {
      return null;
    }
  }

  function getStoredProfile() {
    var parsed = parseStoredProfile(localStorage.getItem(STORAGE_KEY));
    if (!parsed) {
      return null;
    }

    if (typeof parsed.is_first_time !== "boolean") {
      parsed.is_first_time = !isProfileComplete(parsed);
    }

    return parsed;
  }

  function isProfileComplete(profile) {
    if (!profile || typeof profile !== "object") {
      return false;
    }

    return Boolean(
      String(profile.name || "").trim() &&
      String(profile.schoolCycle || "").trim() &&
      String(profile.avatar || "").trim() &&
      (
        String(profile.level || "").trim() ||
        (Array.isArray(profile.levels) && profile.levels.length > 0)
      )
    );
  }

  function uniqueNumbers(values) {
    var map = {};
    var result = [];

    values.forEach(function (value) {
      var parsed = parseInt(value, 10);
      if (isNaN(parsed) || map[parsed]) { return; }
      map[parsed] = true;
      result.push(parsed);
    });

    result.sort(function (a, b) { return a - b; });
    return result;
  }

  function isFirstTimeProfile(profile) {
    if (!profile) {
      return true;
    }

    if (typeof profile.is_first_time === "boolean") {
      return profile.is_first_time;
    }

    return !isProfileComplete(profile);
  }

  function markTimeline(step) {
    var items = document.querySelectorAll("#inicioTimeline .inicio-timeline-item");
    items.forEach(function (item) {
      var itemStep = parseInt(item.getAttribute("data-step"), 10);
      var isComplete = step > itemStep;
      var isActive = step === itemStep;

      item.classList.toggle("is-complete", isComplete);
      item.classList.toggle("is-active", isActive);
    });
  }

  function showOnboardingShell() {
    var shell = document.getElementById("inicioShell");
    if (!shell) { return; }
    shell.classList.add("is-ready");
  }

  function hideSplash() {
    var splash = document.getElementById("inicioSplash");
    if (!splash) {
      showOnboardingShell();
      return;
    }

    splash.classList.add("is-hidden");
    showOnboardingShell();
  }

  function goToIndex() {
    window.location.replace("index.html");
  }

  function runBootFlow() {
    var profile = getStoredProfile();
    var isFirstTime = !profile || isFirstTimeProfile(profile);
    var complete = profile ? isProfileComplete(profile) : false;
    var splashTimer = isFirstTime ? SPLASH_FIRST_TIME_MS : SPLASH_RETURNING_MS;
    var narrationIntervalId = startSplashNarration(isFirstTime);
    var progressControl = startSplashProgress(splashTimer);

    window.setTimeout(function () {
      if (narrationIntervalId) {
        window.clearInterval(narrationIntervalId);
      }

      if (progressControl && progressControl.intervalId) {
        window.clearInterval(progressControl.intervalId);
        progressControl.complete();
      }

      if (!isFirstTime && complete) {
        goToIndex();
        return;
      }

      hideSplash();
    }, splashTimer);
  }

  function inferPhaseFromLevel(level) {
    var parsedLevel = parseInt(level, 10);

    if (isNaN(parsedLevel)) {
      return "";
    }

    if (parsedLevel >= 1 && parsedLevel <= 2) {
      return 3;
    }

    if (parsedLevel >= 3 && parsedLevel <= 4) {
      return 4;
    }

    if (parsedLevel >= 5 && parsedLevel <= 6) {
      return 5;
    }

    return "";
  }

  function renderPhasePreview(levels) {
    var gradeLabel = document.getElementById("selectedGradeLabel");
    var phaseLabel = document.getElementById("selectedPhaseLabel");
    if (!gradeLabel || !phaseLabel) { return; }

    var normalizedLevels = Array.isArray(levels) ? uniqueNumbers(levels) : [];

    if (normalizedLevels.length === 0) {
      gradeLabel.textContent = "-";
      phaseLabel.textContent = "-";
      return;
    }

    var phases = uniqueNumbers(normalizedLevels.map(inferPhaseFromLevel).filter(function (value) {
      return value !== "";
    }));

    gradeLabel.textContent = normalizedLevels.join(", ");
    phaseLabel.textContent = phases.length ? ("Fase " + phases.join(", ")) : "Sin fase";
  }

  function mapShift(rawShift) {
    var shiftMap = {
      matutino: "morning",
      vespertino: "afternoon",
      mixto: "mixed"
    };
    return shiftMap[rawShift] || "";
  }

  function buildTeacherProfile(form) {
    return {
      id: "teacher_001",
      name: (form.nombreDocente.value || "").trim(),
      displayName: (form.nombreVisible.value || "").trim(),
      schoolCycle: form.cicloEscolar.value || "",
      schoolName: (form.escuela.value || "").trim(),
      shift: mapShift(form.turno.value || ""),
      avatar: "",
      level: "",
      levels: [],
      phase: "",
      phases: [],
      is_first_time: true,
      createdAt: new Date().toISOString().slice(0, 19),
      preferences: DEFAULT_PREFERENCES
    };
  }

  function saveTeacherProfile(profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }

  function updateAvatar(iconoPath) {
    var profile = getStoredProfile();
    if (!profile) { return; }
    profile.avatar = iconoPath;
    saveTeacherProfile(profile);
  }

  function updateLevel(levels) {
    var profile = getStoredProfile();
    if (!profile) { return; }

    var normalizedLevels = uniqueNumbers(levels);
    if (normalizedLevels.length === 0) { return; }

    var normalizedPhases = uniqueNumbers(normalizedLevels.map(inferPhaseFromLevel).filter(function (value) {
      return value !== "";
    }));

    // Keep single-value fields for backward compatibility across screens.
    profile.level = normalizedLevels[0];
    profile.phase = normalizedPhases.length ? normalizedPhases[0] : "";
    profile.levels = normalizedLevels;
    profile.phases = normalizedPhases;
    profile.is_first_time = false;
    saveTeacherProfile(profile);
  }

  function showPasoIcono() {
    document.getElementById("paso-datos").classList.add("d-none");
    document.getElementById("paso-nivel").classList.add("d-none");
    document.getElementById("paso-icono").classList.remove("d-none");
    markTimeline(2);
  }

  function showPasoDatos() {
    document.getElementById("paso-icono").classList.add("d-none");
    document.getElementById("paso-nivel").classList.add("d-none");
    document.getElementById("paso-datos").classList.remove("d-none");
    markTimeline(1);
  }

  function showPasoNivel() {
    document.getElementById("paso-icono").classList.add("d-none");
    document.getElementById("paso-datos").classList.add("d-none");
    document.getElementById("paso-nivel").classList.remove("d-none");
    markTimeline(3);
  }

  function initIconoPicker() {
    var items = document.querySelectorAll(".icono-item");
    var btnConfirmar = document.getElementById("btn-confirmar-icono");

    items.forEach(function (item) {
      item.addEventListener("click", function () {
        items.forEach(function (i) {
          i.classList.remove("border-primary");
        });
        item.classList.add("border-primary");
        selectedIcono = item.getAttribute("data-icono");
        btnConfirmar.disabled = false;
      });
    });

    btnConfirmar.addEventListener("click", function () {
      if (!selectedIcono) { return; }
      updateAvatar(selectedIcono);
      showPasoNivel();
    });
  }

  function initNivelPicker() {
    var items = document.querySelectorAll(".nivel-item");
    var btnConfirmarNivel = document.getElementById("btn-confirmar-nivel");
    var btnVolverIcono = document.getElementById("btn-volver-icono");

    items.forEach(function (item) {
      item.addEventListener("click", function () {
        var nivel = parseInt(item.getAttribute("data-nivel"), 10);
        if (isNaN(nivel)) { return; }

        var idx = selectedNiveles.indexOf(nivel);
        if (idx >= 0) {
          selectedNiveles.splice(idx, 1);
          item.classList.remove("active");
        } else {
          selectedNiveles.push(nivel);
          item.classList.add("active");
        }

        renderPhasePreview(selectedNiveles);
        btnConfirmarNivel.disabled = selectedNiveles.length === 0;
      });
    });

    if (btnVolverIcono) {
      btnVolverIcono.addEventListener("click", function () {
        showPasoIcono();
      });
    }

    btnConfirmarNivel.addEventListener("click", function () {
      if (selectedNiveles.length === 0) { return; }
      updateLevel(selectedNiveles);

      if (btnConfirmarNivel) {
        btnConfirmarNivel.disabled = true;
        btnConfirmarNivel.textContent = "Entrando a Mi Maletin...";
      }

      markTimeline(4);
      window.setTimeout(goToIndex, 350);
    });

    renderPhasePreview(selectedNiveles);
  }

  function initTurnoSelector() {
    var input = document.getElementById("turno");
    var buttons = document.querySelectorAll(".inicio-turno-btn");

    if (!input || buttons.length === 0) { return; }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var turno = btn.getAttribute("data-turno") || "";
        input.value = turno;

        buttons.forEach(function (otherBtn) {
          otherBtn.classList.remove("is-selected");
        });

        btn.classList.add("is-selected");
      });
    });
  }

  function initForm() {
    var form = document.getElementById("form-inicio");
    var btnVolverDatos = document.getElementById("btn-volver-datos");
    if (!form) { return; }

    if (btnVolverDatos) {
      btnVolverDatos.addEventListener("click", function () {
        showPasoDatos();
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!form.checkValidity()) {
        event.stopPropagation();
        form.classList.add("was-validated");
        return;
      }

      var profile = buildTeacherProfile(form);
      saveTeacherProfile(profile);
      showPasoIcono();
    });
  }

  initForm();
  initIconoPicker();
  initNivelPicker();
  initTurnoSelector();
  markTimeline(1);
  runBootFlow();
})();