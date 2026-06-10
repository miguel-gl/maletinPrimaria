(function () {
  "use strict";

  var RESOURCE_CONFIG = {
    planos: {
      key: "planos",
      itemMetric: "planos",
      metadataFile: "planos_didacticos.json",
      expectedType: "planos",
      pageTitle: "Planos didacticos",
      heroTitle: "Encuentra el plano ideal para tu grupo en minutos",
      heroLead: "Filtra por fase, enfoque y dinamica del aula para elegir una ruta didactica clara y accionable.",
      sectionTitle: "Explora y prepara",
      searchLabel: "Buscar planos",
      searchPlaceholder: "Buscar por tema, grado o enfoque...",
      categoryMetric: "enfoques",
      icon: "assets/img/lineicons/plano.png"
    },
    cuadernillos: {
      key: "cuadernillos",
      itemMetric: "cuadernillos",
      metadataFile: "cuadernillo_trabajo.json",
      expectedType: "cuadernillo",
      pageTitle: "Cuadernillos de trabajo",
      heroTitle: "Encuentra el cuadernillo ideal para reforzar tu clase",
      heroLead: "Filtra por fase y categoria para elegir actividades listas para aplicar en aula o tarea.",
      sectionTitle: "Explora y descarga",
      searchLabel: "Buscar cuadernillos",
      searchPlaceholder: "Buscar por tema, grado o categoria...",
      categoryMetric: "categorias",
      icon: "assets/img/lineicons/docsa.png"
    },
    imprimibles: {
      key: "imprimibles",
      itemMetric: "imprimibles",
      metadataFile: "imprimibles.json",
      pageTitle: "Imprimibles",
      heroTitle: "Encuentra imprimibles listos para usar",
      heroLead: "Filtra por fase y categoria para seleccionar hojas de trabajo y actividades descargables.",
      sectionTitle: "Explora y descarga",
      searchLabel: "Buscar imprimibles",
      searchPlaceholder: "Buscar por tema, grado o actividad...",
      categoryMetric: "categorias",
      icon: "assets/img/lineicons/impresora.png",
      skipTypeFilter: true
    },
    examen: {
      key: "examen",
      itemMetric: "examenes",
      metadataPath: "src/metadata/instrumentos_evaluacion.json",
      expectedType: "instrumento de evaluacion",
      pageTitle: "Examenes e instrumentos",
      heroTitle: "Encuentra instrumentos de evaluacion listos para usar",
      heroLead: "Filtra por categoria para seleccionar el instrumento que mejor acompane tu evaluacion.",
      sectionTitle: "Explora y aplica",
      searchLabel: "Buscar examenes",
      searchPlaceholder: "Buscar por instrumento, area o categoria...",
      categoryMetric: "instrumentos",
      icon: "assets/img/lineicons/examen.png"
    },
    "material-docente": {
      key: "material-docente",
      itemMetric: "herramientas",
      metadataPath: "src/metadata/material_docente.json",
      expectedType: "recurso docente",
      pageTitle: "Material para el Docente",
      heroTitle: "Herramientas que te ayudan a mejorar tu practica",
      heroLead: "Explora todos los recursos administrativos y pedagogicos que potencian tu labor educativa y apoyan tu dia a dia.",
      sectionTitle: "Explora y utiliza",
      searchLabel: "Buscar recursos",
      searchPlaceholder: "Buscar por nombre, tipo o descripcion...",
      categoryMetric: "recursos",
      icon: "assets/img/lineicons/docente.png",
      isMaterialDocente: true
    }
  };

  var PROFILE_STORAGE_KEY = "maletinPrimariaTeacherProfile";
  var FALLBACK_MESSAGE = "No se pudieron cargar los recursos desde metadata local.";

  function getResourceConfig() {
    var params = new URLSearchParams(window.location.search);
    var tipo = String(params.get("tipo") || "planos").toLowerCase();
    return RESOURCE_CONFIG[tipo] || RESOURCE_CONFIG.planos;
  }

  function getPortadaParam() {
    var params = new URLSearchParams(window.location.search);
    return params.get("portada") || "";
  }

  var currentResource = getResourceConfig();

  var grid = document.getElementById("planos-grid");
  var cards = Array.from(document.querySelectorAll("#planos-grid .plano-card"));
  var chipsWrap = document.querySelector(".planos-filter-chips");
  var chips = Array.from(document.querySelectorAll(".planos-chip"));
  var search = document.getElementById("planos-search");
  var currentFilter = "all";

  if (!grid) {
    return;
  }

  function applyResourceCopy() {
    var heroTitle = document.getElementById("resource-hero-title");
    var heroLead = document.getElementById("resource-hero-lead");
    var sectionTitle = document.getElementById("resource-section-title");
    var searchLabel = document.getElementById("resource-search-label");
    var heroIcon = document.getElementById("resource-hero-icon");
    var portadaParam = getPortadaParam();

    document.title = "Maletin Primaria | " + currentResource.pageTitle;

    if (heroTitle) {
      heroTitle.textContent = currentResource.heroTitle;
    }

    if (heroLead) {
      heroLead.textContent = currentResource.heroLead;
    }

    if (sectionTitle) {
      sectionTitle.textContent = currentResource.sectionTitle;
    }

    if (searchLabel) {
      searchLabel.textContent = currentResource.searchLabel;
    }

    if (search) {
      search.placeholder = currentResource.searchPlaceholder;
    }

    if (heroIcon) {
      heroIcon.src = portadaParam || currentResource.icon;
    }
  }

  function createSlug(value) {
    return normalize(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function setQuickFilters(items) {
    if (!chipsWrap) {
      return;
    }

    if (currentResource.isMaterialDocente) {
      setMaterialQuickFilters(items);
      return;
    }

    var unique = {};
    items.forEach(function (item) {
      var clasificacion = item && item.clasificacion ? item.clasificacion : {};
      var categoria = clasificacion.categoria_pedagogica;
      if (!categoria) {
        return;
      }
      var slug = createSlug(categoria);
      if (!slug) {
        return;
      }
      unique[slug] = categoria;
    });

    var quickFilters = Object.keys(unique).slice(0, 6);
    chipsWrap.innerHTML = ['<button type="button" class="planos-chip is-active" data-filter="all">Todos</button>']
      .concat(quickFilters.map(function (slug) {
        return '<button type="button" class="planos-chip" data-filter="' + escapeHtml(slug) + '">' + escapeHtml(unique[slug]) + "</button>";
      }))
      .join("");

    chips = Array.from(document.querySelectorAll(".planos-chip"));
    bindChipEvents();
  }

  function getMaterialDiscoveryTerms(item) {
    var contexto = item && item.enriquecimiento_ia && item.enriquecimiento_ia.descubrimiento_contextual
      ? item.enriquecimiento_ia.descubrimiento_contextual
      : null;
    var terms = [];

    if (!contexto || typeof contexto !== "object") {
      return terms;
    }

    Object.keys(contexto).forEach(function (categoria) {
      var itemsCategoria = Array.isArray(contexto[categoria]) ? contexto[categoria] : [];
      itemsCategoria.forEach(function (entry) {
        var id = entry && entry.id ? String(entry.id) : "";
        var titulo = entry && entry.titulo ? String(entry.titulo) : "";
        var idSlug = id ? createSlug(id) : "";

        if (idSlug) {
          terms.push({
            token: "disc-" + idSlug,
            label: titulo || id.replace(/_/g, " "),
            categoria: categoria
          });
        }
      });
    });

    return terms;
  }

  function setMaterialQuickFilters(items) {
    var grouped = {};

    items.forEach(function (item) {
      getMaterialDiscoveryTerms(item).forEach(function (term) {
        if (!grouped[term.token]) {
          grouped[term.token] = {
            label: term.label,
            count: 0
          };
        }
        grouped[term.token].count += 1;
      });
    });

    var quickFilters = Object.keys(grouped)
      .sort(function (a, b) {
        if (grouped[b].count !== grouped[a].count) {
          return grouped[b].count - grouped[a].count;
        }
        return String(grouped[a].label).localeCompare(String(grouped[b].label), "es");
      });

    chipsWrap.innerHTML = ['<button type="button" class="planos-chip is-active" data-filter="all">Todos</button>']
      .concat(quickFilters.map(function (slug) {
        return '<button type="button" class="planos-chip" data-filter="' + escapeHtml(slug) + '">' + escapeHtml(grouped[slug].label) + "</button>";
      }))
      .join("");

    chips = Array.from(document.querySelectorAll(".planos-chip"));
    bindChipEvents();
  }

  function normalize(value) {
    return String(value || "").toLowerCase();
  }

  function toInt(value) {
    var parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function inferPhaseFromGrade(grade) {
    if (grade === 1 || grade === 2) {
      return 3;
    }

    if (grade === 3 || grade === 4) {
      return 4;
    }

    if (grade === 5 || grade === 6) {
      return 5;
    }

    return null;
  }

  function readStoredSelection() {
    var profileRaw = localStorage.getItem(PROFILE_STORAGE_KEY);
    var profile = null;
    var profileGrade = null;
    var profilePhase = null;
    var explicitGrade = null;
    var explicitPhase = null;

    if (profileRaw) {
      try {
        profile = JSON.parse(profileRaw);
      } catch (_error) {
        profile = null;
      }
    }

    if (profile && profile.level != null) {
      profileGrade = toInt(profile.level);
    }

    if (profile && profile.phase != null) {
      profilePhase = toInt(profile.phase);
    }

    ["maletinPrimariaGrado", "gradoSeleccionado", "grado", "nivel"].some(function (key) {
      var value = toInt(localStorage.getItem(key));
      if (value != null) {
        explicitGrade = value;
        return true;
      }
      return false;
    });

    ["maletinPrimariaFase", "faseSeleccionada", "fase"].some(function (key) {
      var value = toInt(localStorage.getItem(key));
      if (value != null) {
        explicitPhase = value;
        return true;
      }
      return false;
    });

    var grade = explicitGrade != null ? explicitGrade : profileGrade;
    var phase = explicitPhase != null ? explicitPhase : profilePhase;

    if (phase == null && grade != null) {
      phase = inferPhaseFromGrade(grade);
    }

    return {
      grado: grade,
      fase: phase
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildTagList(item) {
    var clasificacion = item && item.clasificacion ? item.clasificacion : {};
    var contenido = item && item.contenido ? item.contenido : {};
    var metodologia = Array.isArray(contenido.metodologias) ? contenido.metodologias[0] : "";
    var tags = [];

    if (clasificacion.fase != null) {
      tags.push("fase " + clasificacion.fase);
    }

    if (clasificacion.grado != null) {
      tags.push(clasificacion.grado + " grado");
    }

    if (clasificacion.categoria_pedagogica) {
      tags.push(clasificacion.categoria_pedagogica);
    }

    if (metodologia) {
      tags.push(metodologia);
    }

    return tags;
  }

  function buildDataTags(item) {
    if (currentResource.isMaterialDocente) {
      return buildMaterialDataTags(item);
    }

    var tags = buildTagList(item);
    var categoriaRaw = item && item.clasificacion ? item.clasificacion.categoria_pedagogica : "";
    var categoria = normalize(categoriaRaw);

    if (categoria.indexOf("comunit") !== -1) {
      tags.push("comunitario");
    }

    if (categoria.indexOf("problemas") !== -1) {
      tags.push("problemas");
    }

    if (categoria.indexOf("servicio") !== -1) {
      tags.push("servicio");
    }

    if (categoria.indexOf("steam") !== -1 || categoria.indexOf("cient") !== -1) {
      tags.push("steam");
    }

    if (categoriaRaw) {
      tags.push(createSlug(categoriaRaw));
    }

    return normalize(tags.join(" "));
  }

  function buildMaterialDataTags(item) {
    var tags = [];
    var tipo = item && item.archivo ? item.archivo.tipo : "";
    var contenido = item && item.contenido ? item.contenido : {};
    var discoveryTerms = getMaterialDiscoveryTerms(item);

    discoveryTerms.forEach(function (term) {
      tags.push(term.token);
      if (term.label) {
        tags.push(term.label);
      }
      if (term.categoria) {
        tags.push(term.categoria);
      }
    });

    if (tipo) {
      tags.push("tipo-" + createSlug(tipo));
      tags.push(tipo);
    }

    if (contenido.titulo) {
      tags.push(contenido.titulo);
    }

    if (contenido.para_que_te_sirve) {
      tags.push(contenido.para_que_te_sirve);
    }

    return normalize(tags.join(" "));
  }

  function renderEmpty(message) {
    grid.innerHTML = [
      '<article class="plano-card">',
      "<h4>Sin recursos disponibles</h4>",
      "<p>" + escapeHtml(message) + "</p>",
      "</article>"
    ].join("");
    cards = Array.from(document.querySelectorAll("#planos-grid .plano-card"));
  }

  function getPlanoProgress(id) {
    try {
      var val = localStorage.getItem("vizProgress_" + id);
      return val !== null ? parseInt(val, 10) : null;
    } catch (_) { return null; }
  }

  function getPlanoStatus(id) {
    try { return localStorage.getItem("vizStatus_" + id); } catch (_) { return null; }
  }

  function buildProgressBadge(id) {
    var progress = getPlanoProgress(id);
    var status = getPlanoStatus(id);
    if (progress === null && !status) return "";
    var pct = progress !== null ? progress : 0;
    var statusIcon = status === "completado" ? "🟢" : status === "en-curso" ? "🟡" : "⬜";
    return '<div class="plano-progress-row">' +
      '<span class="plano-progress-status" title="' + escapeHtml(status || "pendiente") + '">' + statusIcon + '</span>' +
      '<div class="plano-progress-bar"><div class="plano-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="plano-progress-pct">' + pct + '%</span>' +
      '</div>';
  }

  function renderCards(items) {
    if (currentResource.isMaterialDocente) {
      // Renderizar tarjetas especiales para material docente
      grid.innerHTML = items.map(function (item) {
        var titulo = item.contenido.titulo || "Recurso sin titulo";
        var tipo = item.archivo.tipo || "Recurso";
        var descripcion = item.contenido.para_que_te_sirve || "Sin descripcion disponible.";
        var emoji = item.contenido.emoji_recurso || "📚";
        var descripcionTruncada = truncateDescription(descripcion, 15);
        var dataTags = buildDataTags(item);
        var href = "visualizador.html?id=" + encodeURIComponent(item.id || "") +
          "&tipo=material_docente" +
          "&from=planos";

        return [
          '<article class="plano-card material-card" data-tags="' + escapeHtml(dataTags) + '">',
          '<div class="material-card-emoji">' + escapeHtml(emoji) + '</div>',
          '<div class="material-card-content">',
          '<p class="plano-meta material-card-type">' + escapeHtml(tipo) + '</p>',
          "<h4>" + escapeHtml(titulo) + "</h4>",
          "<p>" + escapeHtml(descripcionTruncada) + "</p>",
          '<a href="' + escapeHtml(href) + '" class="planos-link">Ver detalles \u2192</a>',
          '</div>',
          "</article>"
        ].join("");
      }).join("");

      cards = Array.from(document.querySelectorAll("#planos-grid .plano-card"));
      return;
    }

    // Código original para otros tipos de recursos
    grid.innerHTML = items.map(function (item) {
      var clasificacion = item && item.clasificacion ? item.clasificacion : {};
      var contenido = item && item.contenido ? item.contenido : {};
      var titulo = contenido.titulo || contenido.nombre_proyecto || "Recurso sin titulo";
      var descripcionCompleta = contenido.proposito || contenido.problema_contexto || contenido.sintesis || "Sin descripcion disponible.";
      var descripcion = truncateDescription(descripcionCompleta, 10);
      var categoria = clasificacion.categoria_pedagogica || "";
      var fase = clasificacion.fase != null ? clasificacion.fase : "-";
      var grado = clasificacion.grado != null ? clasificacion.grado : "-";
      var href = "visualizador.html?id=" + encodeURIComponent(item.id || "") +
        "&fase=" + encodeURIComponent(clasificacion.fase || "") +
        "&tipo=" + encodeURIComponent(currentResource.key) +
        "&from=planos";
      var progressBadge = item.id ? buildProgressBadge(item.id) : "";

      return [
        '<article class="plano-card" data-tags="' + escapeHtml(buildDataTags(item)) + '">',
        '<p class="plano-meta">Fase ' + escapeHtml(fase) + " | " + escapeHtml(grado) + " grado</p>",
        "<h4>" + escapeHtml(titulo) + "</h4>",
        "<p>" + escapeHtml(descripcion) + "</p>",
        progressBadge,
        categoria ? '<div class="beta-tags"><span>' + escapeHtml(categoria) + '</span></div>' : "",
        '<a href="' + escapeHtml(href) + '" class="planos-link">Leer m\u00e1s \u2192</a>',
        "</article>"
      ].join("");
    }).join("");

    cards = Array.from(document.querySelectorAll("#planos-grid .plano-card"));
  }

  function truncateDescription(text, maxWords) {
    var words = text.split(/\s+/);
    if (words.length <= maxWords) {
      return text;
    }
    return words.slice(0, maxWords).join(" ") + "...";
  }

  function filterBySelection(items, selection) {
    return items.filter(function (item) {
      var clasificacion = item && item.clasificacion ? item.clasificacion : {};
      var itemGrado = toInt(clasificacion.grado);
      var itemFase = toInt(clasificacion.fase);
      var matchGrado = selection.grado == null || itemGrado == null || itemGrado === selection.grado;
      var matchFase = selection.fase == null || itemFase == null || itemFase === selection.fase;
      return matchGrado && matchFase;
    });
  }

  function filterByResourceType(items) {
    if (currentResource.isMaterialDocente) {
      return items; // Material docente no tiene filtro de tipo
    }
    if (currentResource.skipTypeFilter) {
      return items;
    }
    return items.filter(function (item) {
      var clasificacion = item && item.clasificacion ? item.clasificacion : {};
      var tipoRecurso = normalize(clasificacion.tipo_recurso);
      return tipoRecurso.indexOf(currentResource.expectedType) !== -1;
    });
  }

  function loadMetadata() {
    if (currentResource.metadataPath) {
      return fetch(currentResource.metadataPath).then(function (response) {
        if (!response.ok) {
          throw new Error("metadata_not_found");
        }
        return response.json();
      });
    }

    var preferredFase = localStorage.getItem("maletinPrimariaFase") || "3";
    var basePath = "src/metadata/fase" + preferredFase + "/" + currentResource.metadataFile;
    var fallbackPath = "src/metadata/fase3/" + currentResource.metadataFile;

    return fetch(basePath).then(function (response) {
      if (!response.ok && basePath !== fallbackPath) {
        return fetch(fallbackPath);
      }
      return response;
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("metadata_not_found");
      }
      return response.json();
    });
  }

  function updateMetrics(items) {
    var metrics = document.querySelectorAll(".planos-metrics span");
    var metricStrong = document.querySelectorAll(".planos-metrics strong");
    if (!metricStrong.length) {
      return;
    }

    var uniqueGrades = {};
    var uniqueCategorias = {};

    items.forEach(function (item) {
      var clasificacion = item && item.clasificacion ? item.clasificacion : {};
      if (clasificacion.grado != null) {
        uniqueGrades[String(clasificacion.grado)] = true;
      }
      if (clasificacion.categoria_pedagogica) {
        uniqueCategorias[String(clasificacion.categoria_pedagogica)] = true;
      }
    });

    metricStrong[0].textContent = String(items.length);
    if (metrics[0]) {
      metrics[0].innerHTML = "<strong>" + escapeHtml(items.length) + "</strong> " + escapeHtml(currentResource.itemMetric || currentResource.key);
    }

    if (metricStrong[1]) {
      metricStrong[1].textContent = String(Object.keys(uniqueGrades).length || 0);
    }

    if (metricStrong[2]) {
      metricStrong[2].textContent = String(Object.keys(uniqueCategorias).length || 0);
      if (metrics[2]) {
        metrics[2].innerHTML = "<strong>" + escapeHtml(metricStrong[2].textContent) + "</strong> " + escapeHtml(currentResource.categoryMetric);
      }
    }
  }

  function showMaterialModal(material) {
    // Crear modal si no existe
    var existingModal = document.getElementById("materialDocenteModal");
    if (existingModal) {
      existingModal.remove();
    }

    var modal = document.createElement("div");
    modal.id = "materialDocenteModal";
    modal.className = "material-modal";
    modal.innerHTML = [
      '<div class="material-modal-backdrop"></div>',
      '<div class="material-modal-content">',
      '<button class="material-modal-close">✕</button>',
      '<div class="material-modal-header">',
      '<div class="material-modal-emoji">' + escapeHtml(material.contenido.emoji_recurso || "📚") + '</div>',
      '<div>',
      '<h2>' + escapeHtml(material.contenido.titulo) + '</h2>',
      '<p class="material-modal-type">' + escapeHtml(material.archivo.tipo) + '</p>',
      '</div>',
      '</div>',
      '<div class="material-modal-body">',
      '<div class="material-modal-section">',
      '<h4>¿Para qué te sirve?</h4>',
      '<p>' + escapeHtml(material.contenido.para_que_te_sirve) + '</p>',
      '</div>',
      '<div class="material-modal-section">',
      '<h4>Resumen</h4>',
      '<p>' + escapeHtml(material.contenido.descripcion_slide) + '</p>',
      '</div>',
      '<div class="material-modal-section">',
      '<h4>Archivo</h4>',
      '<p><strong>Nombre:</strong> ' + escapeHtml(material.archivo.nombre) + '</p>',
      '<p><strong>Tipo:</strong> ' + escapeHtml(material.archivo.tipo) + '</p>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");

    document.body.appendChild(modal);

    // Event listeners
    var closeBtn = modal.querySelector(".material-modal-close");
    var backdrop = modal.querySelector(".material-modal-backdrop");
    
    function closeModal() {
      modal.remove();
    }

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (backdrop) backdrop.addEventListener("click", closeModal);
  }

  function initFloatingMenu() {
    var menuFab = document.getElementById("beta-nav-fab");
    var menuOverlay = document.getElementById("beta-nav-overlay");

    if (!menuFab || !menuOverlay) {
      return;
    }

    function closeOverlay() {
      menuOverlay.classList.add("d-none");
      menuOverlay.setAttribute("aria-hidden", "true");
      menuFab.setAttribute("aria-expanded", "false");
    }

    function openOverlay() {
      menuOverlay.classList.remove("d-none");
      menuOverlay.setAttribute("aria-hidden", "false");
      menuFab.setAttribute("aria-expanded", "true");
    }

    menuFab.setAttribute("aria-expanded", "false");

    menuFab.addEventListener("click", function () {
      if (menuOverlay.classList.contains("d-none")) {
        openOverlay();
      } else {
        closeOverlay();
      }
    });

    menuOverlay.addEventListener("click", function (event) {
      var clickedLink = event.target.closest("a");
      var clickedDock = event.target.closest(".beta-dock");

      if (clickedLink) {
        closeOverlay();
        return;
      }

      if (!clickedDock) {
        closeOverlay();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeOverlay();
      }
    });
  }

  function applyFilters() {
    var term = search ? normalize(search.value.trim()) : "";

    cards.forEach(function (card) {
      var haystack = normalize(card.textContent + " " + card.getAttribute("data-tags"));
      var matchText = !term || haystack.indexOf(term) !== -1;
      var matchFilter = currentFilter === "all" || haystack.indexOf(currentFilter) !== -1;
      card.classList.toggle("is-hidden", !(matchText && matchFilter));
    });
  }

  function bindChipEvents() {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        currentFilter = chip.getAttribute("data-filter") || "all";
        chips.forEach(function (item) { item.classList.remove("is-active"); });
        chip.classList.add("is-active");
        applyFilters();
      });
    });
  }

  bindChipEvents();

  if (search) {
    search.addEventListener("input", applyFilters);
  }

  applyResourceCopy();

  loadMetadata().then(function (items) {
    var selection = readStoredSelection();
    var byType = filterByResourceType(Array.isArray(items) ? items : []);
    var filtered = filterBySelection(byType, selection);

    if (!filtered.length) {
      renderEmpty("No hay recursos para la fase/grado guardados en tu perfil.");
      return;
    }

    setQuickFilters(filtered);
    renderCards(filtered);
    updateMetrics(filtered);
    applyFilters();
  }).catch(function () {
    renderEmpty(FALLBACK_MESSAGE);
  });

  initFloatingMenu();
})();
