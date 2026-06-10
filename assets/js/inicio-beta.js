(function () {
  "use strict";

  var PROFILE_KEY = "maletinPrimariaTeacherProfile";
  var PROGRESS_KEY_PREFIX = "vizProgress_";
  var STATUS_KEY_PREFIX = "vizStatus_";
  var ASSISTANT_STATE_KEY = "maletinAssistantStateV1";
  var ASSISTANT_FLOW_KEY = "maletinAssistantFlowDraftV1";

  var CONTEXT_LABEL_BY_ID = {
    grupos_inquietos: "Grupo inquieto",
    alta_participacion: "Alta participacion",
    mucha_participacion: "Alta participacion",
    grupos_tranquilos: "Grupo tranquilo",
    trabajo_individual: "Trabajo individual guiado",
    poco_material: "Inicio rapido",
    introducir_tema: "Inicio rapido",
    material_manipulable: "Material manipulable",
    espacios_escolares: "Aprovecha espacios escolares",
    experimentacion: "Experimentacion",
    participacion_oral: "Participacion oral",
    resolucion_problemas: "Resolucion de problemas",
    conexion_comunidad: "Conexion con comunidad",
    expresion_artistica: "Expresion artistica",
    produccion_escrita: "Produccion escrita",
    activar_conocimientos: "Activa conocimientos previos",
    reforzar_aprendizajes: "Refuerza aprendizajes",
    cierre_socializacion: "Cierre y socializacion"
  };

  var CATEGORY_PRIORITY = [
    "Inicio rapido",
    "Grupo inquieto",
    "Alta participacion",
    "Experimentacion",
    "Conexion con comunidad"
  ];

  var TARGET_TITLE_MAX_CHARS = 36;

  function initRevealCards() {
    var revealTargets = document.querySelectorAll("[data-reveal]");
    if (!revealTargets.length) {
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.22 });

    revealTargets.forEach(function (item) {
      observer.observe(item);
    });
  }

  function initExperienceCarousel() {
    var carousel = document.getElementById("exp-carousel");
    var prev = document.getElementById("exp-prev");
    var next = document.getElementById("exp-next");

    if (!carousel || !prev || !next) {
      return;
    }

    var scrollStep = function () {
      return Math.round(carousel.clientWidth * 0.75);
    };

    prev.addEventListener("click", function () {
      carousel.scrollBy({ left: -scrollStep(), behavior: "smooth" });
    });

    next.addEventListener("click", function () {
      carousel.scrollBy({ left: scrollStep(), behavior: "smooth" });
    });
  }

  function safeGetLocalStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function parseJsonSafely(value, fallbackValue) {
    if (!value) {
      return fallbackValue;
    }

    try {
      return JSON.parse(value);
    } catch (_) {
      return fallbackValue;
    }
  }

  function getTeacherPhase() {
    var profile = parseJsonSafely(safeGetLocalStorage(PROFILE_KEY), {});
    var phase = parseInt(profile && profile.phase, 10);

    if (phase >= 3 && phase <= 5) {
      return phase;
    }

    return 3;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeStatus(status) {
    if (status === "completado") {
      return "Completado";
    }

    if (status === "en-curso") {
      return "En curso";
    }

    return "Pendiente";
  }

  function truncateTargetTitle(value) {
    var text = String(value || "").trim();
    if (text.length <= TARGET_TITLE_MAX_CHARS) {
      return text;
    }

    return text.slice(0, TARGET_TITLE_MAX_CHARS).trim() + "..";
  }

  function getContextLabels(resource) {
    var enrichment = resource && resource.enriquecimiento_ia ? resource.enriquecimiento_ia : {};
    var contextual = enrichment.descubrimiento_contextual || {};
    var labels = [];

    Object.keys(contextual).forEach(function (sectionName) {
      var items = contextual[sectionName];
      if (!Array.isArray(items)) {
        return;
      }

      items.forEach(function (item) {
        if (!item) {
          return;
        }

        var label = CONTEXT_LABEL_BY_ID[item.id] || item.titulo;
        if (label && labels.indexOf(label) === -1) {
          labels.push(label);
        }
      });
    });

    return labels;
  }

  function selectPrimaryCategory(labels) {
    var i;
    for (i = 0; i < CATEGORY_PRIORITY.length; i += 1) {
      if (labels.indexOf(CATEGORY_PRIORITY[i]) !== -1) {
        return CATEGORY_PRIORITY[i];
      }
    }

    return labels[0] || "Recomendado";
  }

  function getProgressResources(resources) {
    return resources
      .map(function (resource) {
        var id = resource && resource.id;
        var rawProgress = id ? safeGetLocalStorage(PROGRESS_KEY_PREFIX + id) : null;
        var progress = parseInt(rawProgress || "0", 10);
        var status = id ? (safeGetLocalStorage(STATUS_KEY_PREFIX + id) || "pendiente") : "pendiente";

        if (!(progress > 0 || status === "en-curso" || status === "completado")) {
          return null;
        }

        return {
          resource: resource,
          progress: Math.max(0, Math.min(100, isNaN(progress) ? 0 : progress)),
          status: status
        };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        if (b.progress !== a.progress) {
          return b.progress - a.progress;
        }

        return a.resource.id < b.resource.id ? -1 : 1;
      });
  }

  function getProgressPercent(item) {
    if (item && item.status === "completado") {
      return 100;
    }

    return item && typeof item.progress === "number" ? item.progress : 0;
  }

  function buildVisualizerUrl(resource) {
    var id = resource && resource.id ? resource.id : "";
    var fase = resource && resource.clasificacion ? resource.clasificacion.fase : "";
    var tipo = resource && resource.__resourceType ? resource.__resourceType : "planos";

    if (!id) {
      return "visualizador.html";
    }

    return "visualizador.html?id=" + encodeURIComponent(id) + "&fase=" + encodeURIComponent(String(fase || "")) + "&tipo=" + encodeURIComponent(tipo) + "&from=inicio";
  }

  function getRecommendedResources(resources) {
    return resources
      .map(function (resource) {
        var labels = getContextLabels(resource);
        return {
          resource: resource,
          labels: labels,
          category: selectPrimaryCategory(labels)
        };
      })
      .sort(function (a, b) {
        var aIndex = CATEGORY_PRIORITY.indexOf(a.category);
        var bIndex = CATEGORY_PRIORITY.indexOf(b.category);
        var aOrder = aIndex === -1 ? 999 : aIndex;
        var bOrder = bIndex === -1 ? 999 : bIndex;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return a.resource.id < b.resource.id ? -1 : 1;
      });
  }

  function renderProgressCards(carousel, items) {
    carousel.innerHTML = items.slice(0, 8).map(function (item) {
      var resource = item.resource || {};
      var content = resource.contenido || {};
      var title = truncateTargetTitle(content.titulo || content.nombre_proyecto || "Recurso sin titulo");
      var progressPercent = getProgressPercent(item);
      var visualizerUrl = buildVisualizerUrl(resource);
      var statusText = normalizeStatus(item.status);

      return [
        '<article class="beta-exp-card" data-reveal>',
        '<h4>' + escapeHtml(title) + '</h4>',
        '<p>Avance: ' + progressPercent + '% | Estado: ' + statusText + '</p>',
        '<div class="beta-progress"><span style="width: ' + progressPercent + '%;"></span></div>',
        '<a class="beta-exp-open" href="' + escapeHtml(visualizerUrl) + '">Abrir</a>',
        '</article>'
      ].join("");
    }).join("");
  }

  function renderRecommendedCards(carousel, items) {
    carousel.innerHTML = items.slice(0, 8).map(function (item) {
      var resource = item.resource || {};
      var content = resource.contenido || {};
      var title = truncateTargetTitle(content.titulo || content.nombre_proyecto || "Recurso recomendado");
      var subtitle = item.category || "Recomendado";
      var labelsText = item.labels.slice(0, 2).join(" · ");
      var visualizerUrl = buildVisualizerUrl(resource);

      return [
        '<article class="beta-exp-card" data-reveal>',
        '<h4>' + escapeHtml(title) + '</h4>',
        '<p>Categoria: ' + escapeHtml(subtitle) + '</p>',
        '<div class="beta-progress"><span style="width: 100%;"></span></div>',
        '<p>' + escapeHtml(labelsText || "Listo para iniciar") + '</p>',
        '<a class="beta-exp-open" href="' + escapeHtml(visualizerUrl) + '">Abrir</a>',
        '</article>'
      ].join("");
    }).join("");
  }

  function updateExperienceHeading(carousel, text) {
    var section = carousel.closest(".beta-section");
    var heading = section ? section.querySelector(".beta-section-head h3") : null;

    if (heading) {
      heading.textContent = text;
    }
  }

  function loadMetadataByType(phase, metadataFile, resourceType) {
    var basePath = "src/metadata/fase" + phase + "/" + metadataFile;
    return fetch(basePath)
      .then(function (response) {
        if (!response.ok) {
          return [];
        }

        return response.json();
      })
      .then(function (items) {
        if (!Array.isArray(items)) {
          return [];
        }

        return items.map(function (item) {
          var clone = Object.assign({}, item || {});
          clone.__resourceType = resourceType;
          return clone;
        });
      })
      .catch(function () {
        return [];
      });
  }

  function loadResourcesByPhase(phase) {
    return Promise.all([
      loadMetadataByType(phase, "planos_didacticos.json", "planos"),
      loadMetadataByType(phase, "cuadernillo_trabajo.json", "cuadernillos")
    ]).then(function (results) {
      var planos = results[0] || [];
      var cuadernillos = results[1] || [];
      return planos.concat(cuadernillos);
    });
  }

  function updateDashboardKPIs(progressItems) {
    var active = 0, completed = 0, sumProgress = 0;
    progressItems.forEach(function (item) {
      if (item.status === "completado") completed++;
      else active++;
      sumProgress += getProgressPercent(item);
    });
    var avg = progressItems.length ? Math.round(sumProgress / progressItems.length) : 0;
    var elActive = document.getElementById("kpiActiveExp");
    var elCompleted = document.getElementById("kpiCompletedExp");
    var elAvg = document.getElementById("kpiAvgProgress");
    if (elActive) elActive.textContent = active;
    if (elCompleted) elCompleted.textContent = completed;
    if (elAvg) elAvg.textContent = avg + "%";
  }

  function initExperienceFeed() {
    var carousel = document.getElementById("exp-carousel");
    if (!carousel) {
      return;
    }

    var phase = getTeacherPhase();

    loadResourcesByPhase(phase)
      .then(function (resources) {
        var progressItems = getProgressResources(resources);

        if (progressItems.length) {
          updateDashboardKPIs(progressItems);
          updateExperienceHeading(carousel, "Continuar experiencias");
          renderProgressCards(carousel, progressItems);
          initRevealCards();
          return;
        }

        updateDashboardKPIs([]);
        updateExperienceHeading(carousel, "Recomendados para hoy");
        renderRecommendedCards(carousel, getRecommendedResources(resources));
        initRevealCards();
      })
      .catch(function () {
        updateDashboardKPIs([]);
        updateExperienceHeading(carousel, "Continuar experiencias");
      });
  }

  function initScrollProgress() {
    var bar = document.getElementById("betaScrollProgressBar");
    if (!bar) {
      return;
    }

    var update = function () {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      var progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      bar.style.width = Math.max(0, Math.min(100, progress)) + "%";
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function initSearchFeedback() {
    var input = document.getElementById("beta-search");
    if (!input) {
      return;
    }

    input.addEventListener("focus", function () {
      input.setAttribute("placeholder", "Ej. STEAM, proyecto comunitario, evaluacion...");
    });

    input.addEventListener("blur", function () {
      input.setAttribute("placeholder", "Buscar proyectos, actividades o experiencias...");
    });
  }

  function initSemanticSearch() {
    var api = window.maletinAI;
    var input = document.getElementById("beta-search");
    var campo = document.getElementById("beta-filter-campo");
    var categoria = document.getElementById("beta-filter-categoria");
    var tipo = document.getElementById("beta-filter-tipo");
    var clearButton = document.getElementById("beta-search-clear");
    var section = document.getElementById("beta-semantic-section");
    var status = document.getElementById("beta-search-status");
    var results = document.getElementById("beta-search-results");
    var debounceId = null;
    var requestId = 0;

    if (!input || !section || !status || !results) {

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getAssistantState() {
    return parseJsonSafely(safeGetLocalStorage(ASSISTANT_STATE_KEY), {});
  }
          title: contenido.titulo || contenido.nombre_proyecto || "Experiencia",
          metodologia: (contenido.metodologias && contenido.metodologias[0]) || "Ruta pedagogica",
          product: contenido.producto_central || "Producto final",
          totalSessions: sesiones,
          currentSession: 1,
          progress: 0,
          calendarProgress: 0,
          plannedWeeks: weeks,
          classDuration: flow.classDuration,
          daysPerWeek: flow.daysPerWeek,
          estimatedEndLabel: formatDateLabel(finish),
          currentMoment: (firstMoment && firstMoment.nombre) || (firstSession && firstSession.momento_metodologico) || "Presentemos",
          todayObjective: (firstMoment && firstMoment.descripcion_completa) || "Introducir el reto de la experiencia.",
          todayTasks: tasks,
          remainingSessions: Math.max(0, sesiones - 1)
        }
      });
      clearAssistantFlowDraft();
    }

    function advanceActiveExperience() {
      var state = getAssistantState();
      var active = state && state.activeExperience ? state.activeExperience : null;
      if (!active) {
        return;
      }

      var nextSession = active.currentSession;
      if (flow.completed === "si" && active.currentSession < active.totalSessions) {
        nextSession += 1;
      }

      var resource = flow.resources.find(function (item) {
        return item && item.id === active.resourceId;
      }) || null;

      var sessionObj = resource ? getSession(resource, Math.max(0, nextSession - 1)) : null;
      var moment = resource ? getCurrentMoment(resource, sessionObj) : null;
      var progress = Math.round((nextSession / Math.max(1, active.totalSessions)) * 100);
      var calendarProgress = Math.min(100, Math.round(((nextSession - 1) / Math.max(1, active.totalSessions)) * 100));

      active.currentSession = nextSession;
      active.progress = progress;
      active.calendarProgress = calendarProgress;
      active.currentMoment = (moment && moment.nombre) || (sessionObj && sessionObj.momento_metodologico) || active.currentMoment;
      active.todayObjective = (moment && moment.descripcion_completa) || active.todayObjective;
      active.todayTasks = Array.isArray(sessionObj && sessionObj.actividades) ? sessionObj.actividades.slice(0, 3) : active.todayTasks;
      active.remainingSessions = Math.max(0, active.totalSessions - nextSession);

      setAssistantState({ activeExperience: active });
    }

    modalBody.addEventListener("click", function (event) {
      var target = event.target.closest("[data-action]");
      if (!target) {
        return;
      }

      var action = target.getAttribute("data-action");

      if (action === "start-discovery") return setFlowStep("discovery");
      if (action === "go-welcome") return setFlowStep("welcome");
      if (action === "pick-grade") {
        flow.selectedGrade = parseInt(target.getAttribute("data-grade"), 10) || flow.selectedGrade;
        return renderFlow();
      }
      if (action === "to-recommendation") {
        if (!flow.selectedArea) return;
        return setFlowStep("recommendation");
      }
      if (action === "pick-recommendation") {
        flow.selectedRecommendation = parseInt(target.getAttribute("data-index"), 10) || 0;
        return renderFlow();
      }
      if (action === "to-config") return setFlowStep("configuration");
      if (action === "pick-duration") {
        flow.classDuration = parseInt(target.getAttribute("data-duration"), 10) || flow.classDuration;
        return renderFlow();
      }
      if (action === "pick-days") {
        flow.daysPerWeek = parseInt(target.getAttribute("data-days"), 10) || flow.daysPerWeek;
        return renderFlow();
      }
      if (action === "create-route") {
        persistRouteFromSelection();
        updateHeroFromState();
        return setFlowStep("route");
      }
      if (action === "close-and-continue") {
        updateHeroFromState();
        if (assistantModal) {
          assistantModal.hide();
        }
        return;
      }
      if (action === "to-active-home") return setFlowStep("activeHome");
      if (action === "to-before-session") return setFlowStep("beforeSession");
      if (action === "to-adaptation") return setFlowStep("adaptation");
      if (action === "to-session") return setFlowStep("session");
      if (action === "to-closure") return setFlowStep("closure");
      if (action === "save-session") {
        var notesEl = document.getElementById("assistantNotes");
        flow.notes = notesEl ? notesEl.value.trim() : flow.notes;
        advanceActiveExperience();
        updateHeroFromState();
        return setFlowStep("updated");
      }
      if (action === "to-recommendation") return setFlowStep("recommendation");
    });

    modalBody.addEventListener("change", function (event) {
      var target = event.target;
      if (!target) return;

      if (target.name === "assistantArea") {
        flow.selectedArea = target.value;
        renderFlow();
      }
      if (target.name === "assistantIntensity") {
        flow.intensity = target.value;
      }
      if (target.name === "assistantMood") {
        flow.mood = target.value;
      }
      if (target.name === "assistantParticipation") {
        flow.participation = target.value;
      }
      if (target.name === "assistantUnderstanding") {
        flow.understanding = target.value;
      }
      if (target.name === "assistantCompleted") {
        flow.completed = target.value;
      }
    });

    modalElement.addEventListener("show.bs.modal", function () {
      var active = getActiveExperienceState();
      if (active) {
        flow.step = "activeHome";
      } else {
        flow.step = "welcome";
      }
      renderFlow();
    });

    loadAssistantResources().then(function () {
      updateHeroFromState();
    });
  }

  function fillUserHeader() {
    var profile = {};
    try {
      profile = JSON.parse(localStorage.getItem("maletinPrimariaTeacherProfile")) || {};
    } catch (_) {}
    var name = profile.nombre || profile.name || "Usuario";
    var avatar = profile.avatar || profile.foto || "assets/img/icons/users/default.png";
    var nameEl = document.getElementById("betaUserName");
    var avatarEl = document.getElementById("betaUserAvatar");
    if (nameEl) nameEl.textContent = name;
    if (avatarEl) avatarEl.src = avatar;

    function updateDateTime() {
      var now = new Date();
      var dateStr = now.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      var timeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      var dateEl = document.getElementById("betaUserDate");
      var timeEl = document.getElementById("betaUserTime");
      if (dateEl) dateEl.textContent = dateStr;
      if (timeEl) timeEl.textContent = timeStr;
    }
    updateDateTime();
    setInterval(updateDateTime, 30000);
  }

  fillUserHeader();
  initRevealCards();
  initExperienceFeed();
  initExperienceCarousel();
  initSearchFeedback();
  initSemanticSearch();
  initScrollProgress();
})();
