(function () {
  "use strict";

  var RESOURCE_CONFIG = {
    planos: {
      metadataFile: "planos_didacticos.json",
      folderName: "planos_didacticos",
      backHref: "planos-didacticos.html?tipo=planos",
      backLabel: "Planos"
    },
    cuadernillos: {
      metadataFile: "cuadernillo_trabajo.json",
      folderName: "cuadernillos_trabajo",
      backHref: "planos-didacticos.html?tipo=cuadernillos",
      backLabel: "Cuadernillos"
    },
    examen: {
      metadataPath: "src/metadata/instrumentos_evaluacion.json",
      folderName: "instrumentos_evaluacion",
      backHref: "planos-didacticos.html?tipo=examen&portada=assets/img/lineicons/examen.png",
      backLabel: "Examenes"
    },
    material_docente: {
      metadataPath: "src/metadata/material_docente.json",
      folderName: "material_docente",
      backHref: "planos-didacticos.html?tipo=material-docente",
      backLabel: "Material Docente"
    },
    imprimibles: {
      metadataFile: "imprimibles.json",
      folderName: "imprimibles",
      backHref: "planos-didacticos.html?tipo=imprimibles&portada=assets/img/lineicons/impresora.png",
      backLabel: "Imprimibles"
    }
  };

  var SESSION_KEY_PREFIX = "expSessionState_";

  var currentItem = null;
  var currentId = null;
  var currentState = null;
  var routeModal = null;

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function getResourceConfig() {
    var tipo = String(getParam("tipo") || "planos").toLowerCase();
    return RESOURCE_CONFIG[tipo] || RESOURCE_CONFIG.planos;
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (!element) return;
    element.textContent = value == null || value === "" ? "-" : String(value);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toLabel(key) {
    return String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function loadMetadata(id, fase, resourceConfig) {
    if (resourceConfig.metadataPath) {
      return fetch(resourceConfig.metadataPath)
        .then(function (response) { return response.json(); })
        .then(function (items) {
          return Array.isArray(items) ? items.find(function (item) { return item.id === id; }) : null;
        });
    }

    var urls = [
      "src/metadata/fase3/" + resourceConfig.metadataFile,
      "src/metadata/fase4/" + resourceConfig.metadataFile,
      "src/metadata/fase5/" + resourceConfig.metadataFile
    ];

    var faseNum = parseInt(fase, 10);
    if (faseNum >= 3 && faseNum <= 5) {
      urls = ["src/metadata/fase" + faseNum + "/" + resourceConfig.metadataFile];
    }

    return fetch(urls[0])
      .then(function (response) { return response.json(); })
      .then(function (items) {
        return Array.isArray(items) ? items.find(function (item) { return item.id === id; }) : null;
      });
  }

  function categoriaToCarpeta(categoria) {
    var norm = String(categoria || "").toLowerCase();
    if (norm.indexOf("comunitario") !== -1 || norm.indexOf("comunidad") !== -1) return "comunitarios";
    if (norm.indexOf("problema") !== -1) return "problemas";
    if (norm.indexOf("servicio") !== -1) return "servicio";
    if (norm.indexOf("steam") !== -1) return "steam";
    return "comunitarios";
  }

  function getImprimiblesSubfolder(item, clasificacion) {
    var id = String(item && item.id ? item.id : "").toLowerCase();
    var categoria = String(clasificacion && clasificacion.categoria_pedagogica ? clasificacion.categoria_pedagogica : "").toLowerCase();

    if (id.indexOf("spc-") === 0) return "saberes_pensamiento_cientifico";
    if (id.indexOf("len-") === 0 || id.indexOf("leng-") === 0) return "Lenguajes";
    if (id.indexOf("ens-") === 0 || id.indexOf("ety-") === 0 || id.indexOf("soc-") === 0) return "etica_naturaleza_sociedades";
    if (categoria.indexOf("lengua") !== -1 || categoria.indexOf("lect") !== -1 || categoria.indexOf("comunic") !== -1) return "Lenguajes";
    if (categoria.indexOf("etica") !== -1 || categoria.indexOf("naturaleza") !== -1 || categoria.indexOf("sociedad") !== -1) return "etica_naturaleza_sociedades";

    return "saberes_pensamiento_cientifico";
  }

  function buildFilePath(item, resourceConfig) {
    var clasificacion = item && item.clasificacion ? item.clasificacion : {};
    var archivo = item && item.archivo ? item.archivo : {};
    var nombre = archivo.nombre || archivo.ruta || "";
    if (!nombre) return null;

    if (resourceConfig.folderName === "material_docente") {
      return "src/resources/MATERIAL PARA EL DOCENTE/" + nombre;
    }

    if (resourceConfig.folderName === "instrumentos_evaluacion") {
      if (archivo.ruta) return "src/resources/" + archivo.ruta;
      return "src/resources/instrumentos_evaluacion/" + nombre;
    }

    if (resourceConfig.folderName === "imprimibles") {
      if (archivo.ruta) return "src/resources/" + archivo.ruta;
      var imprimiblesSubfolder = getImprimiblesSubfolder(item, clasificacion);
      return "src/resources/material_alumno/Imprimibles/" + imprimiblesSubfolder + "/" + nombre;
    }

    var fase = parseInt(clasificacion.fase, 10);
    var grado = parseInt(clasificacion.grado, 10);
    if (!fase || !grado) return null;

    var faseSegment = "FASE " + fase;
    var gradoSegment = fase === 3 ? (grado + " GRADO") : (grado + "_grado");

    if (resourceConfig.folderName === "planos_didacticos") {
      return "src/resources/" + faseSegment + "/" + gradoSegment + "/planos_didacticos/" + categoriaToCarpeta(clasificacion.categoria_pedagogica || "") + "/" + nombre;
    }

    return "src/resources/" + faseSegment + "/" + gradoSegment + "/" + resourceConfig.folderName + "/" + nombre;
  }

  function getSessionStateKey(id) {
    return SESSION_KEY_PREFIX + id;
  }

  function getSessions(item) {
    var contenido = item && item.contenido ? item.contenido : {};
    return Array.isArray(contenido.sesiones) ? contenido.sesiones : [];
  }

  function createSessionSnapshot(session) {
    var activities = Array.isArray(session.actividades) ? session.actividades : [];
    var evidencias = Array.isArray(session.evidencias) ? session.evidencias : [];

    return {
      activities: activities.map(function (text) {
        return { text: text, done: false, comment: "" };
      }),
      sessionComment: "",
      evidencePhotos: evidencias.reduce(function (acc, _entry, index) {
        acc[index] = "";
        return acc;
      }, {})
    };
  }

  function createInitialState(item) {
    var sessions = getSessions(item);

    return {
      currentSession: 0,
      sessions: sessions.map(function (session) {
        return createSessionSnapshot(session);
      })
    };
  }

  function safeParseState(raw) {
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  function getStoredState(item, id) {
    var sessions = getSessions(item);
    var fallback = createInitialState(item);

    if (!id) return fallback;

    var raw = localStorage.getItem(getSessionStateKey(id));
    if (!raw) return fallback;

    var parsed = safeParseState(raw);
    if (!parsed || !Array.isArray(parsed.sessions)) {
      return fallback;
    }

    // Reconciliar por si el metadata cambió
    var normalizedSessions = sessions.map(function (session, index) {
      var snapshot = parsed.sessions[index];
      var base = createSessionSnapshot(session);
      if (!snapshot) return base;

      var act = Array.isArray(snapshot.activities) ? snapshot.activities : [];
      base.activities = act.map(function (a) {
        return {
          text: a && a.text ? a.text : "Actividad",
          done: Boolean(a && a.done),
          comment: a && a.comment ? String(a.comment) : ""
        };
      });

      base.sessionComment = snapshot.sessionComment ? String(snapshot.sessionComment) : "";
      if (snapshot.evidencePhotos && typeof snapshot.evidencePhotos === "object") {
        Object.keys(base.evidencePhotos).forEach(function (key) {
          if (snapshot.evidencePhotos[key]) {
            base.evidencePhotos[key] = String(snapshot.evidencePhotos[key]);
          }
        });
      }

      return base;
    });

    return {
      currentSession: typeof parsed.currentSession === "number" ? Math.max(0, Math.min(parsed.currentSession, sessions.length - 1)) : 0,
      sessions: normalizedSessions
    };
  }

  function saveState() {
    if (!currentId || !currentState) return;
    localStorage.setItem(getSessionStateKey(currentId), JSON.stringify(currentState));
  }

  function getCurrentSessionMeta() {
    var sessions = getSessions(currentItem);
    var index = currentState ? currentState.currentSession : 0;
    return sessions[index] || null;
  }

  function getCurrentSessionState() {
    if (!currentState || !Array.isArray(currentState.sessions)) return null;
    return currentState.sessions[currentState.currentSession] || null;
  }

  function getProgressPercent(sessionState) {
    if (!sessionState || !Array.isArray(sessionState.activities) || !sessionState.activities.length) {
      return 0;
    }

    var doneCount = sessionState.activities.filter(function (activity) { return activity.done; }).length;
    return Math.round((doneCount / sessionState.activities.length) * 100);
  }

  function renderFacts(item) {
    var clasificacion = item && item.clasificacion ? item.clasificacion : {};
    var contenido = item && item.contenido ? item.contenido : {};
    var evaluacion = item && item.evaluacion ? item.evaluacion : {};

    var facts = [
      ["Fase", clasificacion.fase != null ? "Fase " + clasificacion.fase : "-"],
      ["Grado", clasificacion.grado != null ? clasificacion.grado + " grado" : "-"],
      ["Categoria", clasificacion.categoria_pedagogica || "-"],
      ["Sesiones", contenido.sesiones_totales != null ? contenido.sesiones_totales : "-"],
      ["Instrumento", evaluacion.instrumento || "-"]
    ];

    var container = document.getElementById("exp-facts");
    if (!container) return;

    container.innerHTML = facts.map(function (pair) {
      return '<div class="exp-fact"><dt>' + escapeHtml(pair[0]) + '</dt><dd>' + escapeHtml(pair[1]) + "</dd></div>";
    }).join("");
  }

  function renderNarrative(item) {
    var contenido = item && item.contenido ? item.contenido : {};
    var blocks = [
      ["Sintesis", contenido.sintesis],
      ["Proposito", contenido.proposito],
      ["Problema del contexto", contenido.problema_contexto],
      ["Producto central", contenido.producto_central]
    ].filter(function (entry) { return entry[1]; });

    var container = document.getElementById("exp-narrative");
    if (!container) return;

    if (!blocks.length) {
      container.innerHTML = '<p class="exp-empty">No hay narrativa disponible.</p>';
      return;
    }

    container.innerHTML = blocks.map(function (block) {
      return '<section class="exp-narrative-block"><h3>' + escapeHtml(block[0]) + '</h3><p>' + escapeHtml(block[1]) + "</p></section>";
    }).join("");
  }

  function renderList(items) {
    if (!Array.isArray(items) || !items.length) return '<p class="exp-empty">Sin datos.</p>';
    return '<ul class="exp-list">' + items.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join("") + '</ul>';
  }

  function renderResources() {
    var meta = getCurrentSessionMeta();
    var container = document.getElementById("exp-resources");
    if (!container) return;

    if (!meta || !Array.isArray(meta.recursos) || !meta.recursos.length) {
      container.innerHTML = '<p class="exp-empty">No hay recursos para esta sesión.</p>';
      return;
    }

    container.innerHTML = renderList(meta.recursos);
  }

  function renderRouteList() {
    var list = document.getElementById("exp-route-list");
    if (!list || !currentItem || !currentState) return;

    var sessions = getSessions(currentItem);

    list.innerHTML = sessions.map(function (session, index) {
      var st = currentState.sessions[index];
      var progress = getProgressPercent(st);
      var stateLabel = index < currentState.currentSession
        ? "Vista"
        : index === currentState.currentSession
          ? "Actual"
          : "Siguiente";

      return [
        '<button class="exp-route-item ' + (index === currentState.currentSession ? "is-active" : "") + '" data-index="' + index + '" type="button">',
        '<div class="exp-route-main">',
        '<span class="exp-route-pill">Sesion ' + escapeHtml(session.numero_sesion || (index + 1)) + '</span>',
        '<strong>' + escapeHtml(session.titulo || "Sin titulo") + '</strong>',
        '<small>' + escapeHtml(session.momento_metodologico || "") + '</small>',
        '</div>',
        '<div class="exp-route-side">',
        '<span>' + escapeHtml(stateLabel) + '</span>',
        '<span>' + progress + '%</span>',
        '</div>',
        '</button>'
      ].join("");
    }).join("");

    list.querySelectorAll(".exp-route-item").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = parseInt(button.getAttribute("data-index"), 10);
        if (Number.isNaN(index)) return;

        currentState.currentSession = index;
        saveState();
        renderSessionArea();
        renderRouteList();

        if (routeModal) {
          routeModal.hide();
        }
      });
    });
  }

  function renderActivities() {
    var container = document.getElementById("exp-activities");
    var state = getCurrentSessionState();

    if (!container || !state) return;

    if (!Array.isArray(state.activities) || !state.activities.length) {
      container.innerHTML = '<p class="exp-empty">No hay actividades en esta sesión.</p>';
      return;
    }

    container.innerHTML = state.activities.map(function (activity, index) {
      return [
        '<article class="exp-activity">',
        '<div class="exp-activity-top">',
        '<label class="exp-check">',
        '<input type="checkbox" class="exp-activity-done" data-index="' + index + '" ' + (activity.done ? "checked" : "") + '>',
        '<span>Actividad ' + (index + 1) + '</span>',
        '</label>',
        '<button class="exp-link-btn" type="button" data-remove-index="' + index + '">Quitar</button>',
        '</div>',
        '<input class="exp-input" type="text" data-text-index="' + index + '" value="' + escapeHtml(activity.text || "") + '" placeholder="Describe la actividad">',
        '<textarea class="exp-textarea exp-textarea--small" data-comment-index="' + index + '" rows="2" placeholder="Comentario breve de avance...">' + escapeHtml(activity.comment || "") + '</textarea>',
        '</article>'
      ].join("");
    }).join("");

    bindActivityEvents(container);
  }

  function bindActivityEvents(container) {
    var state = getCurrentSessionState();
    if (!state) return;

    container.querySelectorAll(".exp-activity-done").forEach(function (input) {
      input.addEventListener("change", function () {
        var index = parseInt(input.getAttribute("data-index"), 10);
        if (Number.isNaN(index) || !state.activities[index]) return;
        state.activities[index].done = input.checked;
        saveState();
        renderSessionProgress();
        renderRouteList();
      });
    });

    container.querySelectorAll("[data-text-index]").forEach(function (input) {
      input.addEventListener("input", function () {
        var index = parseInt(input.getAttribute("data-text-index"), 10);
        if (Number.isNaN(index) || !state.activities[index]) return;
        state.activities[index].text = input.value;
        saveState();
      });
    });

    container.querySelectorAll("[data-comment-index]").forEach(function (input) {
      input.addEventListener("input", function () {
        var index = parseInt(input.getAttribute("data-comment-index"), 10);
        if (Number.isNaN(index) || !state.activities[index]) return;
        state.activities[index].comment = input.value;
        saveState();
      });
    });

    container.querySelectorAll("[data-remove-index]").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = parseInt(button.getAttribute("data-remove-index"), 10);
        if (Number.isNaN(index) || !state.activities[index]) return;

        if (state.activities.length <= 1) return;

        state.activities.splice(index, 1);
        saveState();
        renderActivities();
        renderSessionProgress();
        renderRouteList();
      });
    });
  }

  function renderSessionProgress() {
    var state = getCurrentSessionState();
    var element = document.getElementById("exp-session-progress");
    if (!element) return;

    var progress = getProgressPercent(state);
    element.textContent = progress + "% completado";
  }

  function renderSessionHeader() {
    var meta = getCurrentSessionMeta();
    var state = getCurrentSessionState();
    if (!meta || !state) return;

    var sessionNum = meta.numero_sesion != null ? meta.numero_sesion : (currentState.currentSession + 1);

    setText("exp-current-session-title", "Sesion " + sessionNum + " - " + (meta.titulo || "Sin titulo"));
    setText("exp-current-session-sub", meta.momento_metodologico || "Sin momento metodologico");

    var commentInput = document.getElementById("exp-session-comment");
    if (commentInput) {
      commentInput.value = state.sessionComment || "";
      commentInput.oninput = function () {
        state.sessionComment = commentInput.value;
        saveState();
      };
    }

    renderSessionProgress();
  }

  function bindEvidenceUpload(input) {
    input.addEventListener("change", function () {
      var state = getCurrentSessionState();
      if (!state) return;

      var index = parseInt(input.getAttribute("data-evidence-index"), 10);
      if (Number.isNaN(index)) return;

      var file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        alert("La imagen es muy pesada. Usa una menor a 2MB.");
        input.value = "";
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        state.evidencePhotos[index] = String(reader.result || "");
        saveState();
        renderEvidencias();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderEvidencias() {
    var meta = getCurrentSessionMeta();
    var state = getCurrentSessionState();
    var container = document.getElementById("exp-evidencias");

    if (!container || !state) return;

    var evidencias = meta && Array.isArray(meta.evidencias) ? meta.evidencias : [];

    if (!evidencias.length) {
      container.innerHTML = '<p class="exp-empty">No hay evidencias registradas para esta sesión.</p>';
      return;
    }

    container.innerHTML = evidencias.map(function (evidencia, index) {
      var image = state.evidencePhotos[index] || "";
      return [
        '<article class="exp-evidence">',
        '<h4>' + escapeHtml(evidencia) + '</h4>',
        '<label class="exp-upload">',
        '<span>Subir foto</span>',
        '<input type="file" accept="image/*" data-evidence-index="' + index + '">',
        '</label>',
        image ? '<img class="exp-evidence-preview" src="' + image + '" alt="Evidencia ' + (index + 1) + '">' : '<p class="exp-empty">Sin foto cargada.</p>',
        image ? '<button class="exp-link-btn mt-2" type="button" data-clear-evidence-index="' + index + '">Quitar foto</button>' : "",
        '</article>'
      ].join("");
    }).join("");

    container.querySelectorAll("input[type='file'][data-evidence-index]").forEach(bindEvidenceUpload);

    container.querySelectorAll("[data-clear-evidence-index]").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = parseInt(button.getAttribute("data-clear-evidence-index"), 10);
        if (Number.isNaN(index)) return;

        state.evidencePhotos[index] = "";
        saveState();
        renderEvidencias();
      });
    });
  }

  function renderSessionArea() {
    renderSessionHeader();
    renderActivities();
    renderResources();
    renderEvidencias();
  }

  function renderEvaluacion(item) {
    var evaluacion = item && item.evaluacion ? item.evaluacion : {};
    var criterios = Array.isArray(evaluacion.criterios) ? evaluacion.criterios : [];
    var container = document.getElementById("exp-evaluacion");

    if (!container) return;
    if (!criterios.length) {
      container.innerHTML = '<p class="exp-empty">No hay criterios de evaluacion cargados.</p>';
      return;
    }

    container.innerHTML = [
      '<div class="exp-table-wrap">',
      '<table class="exp-table">',
      '<thead><tr><th>#</th><th>Criterio</th></tr></thead>',
      '<tbody>',
      criterios.map(function (criterio) {
        return '<tr>' +
          '<td>' + escapeHtml(criterio.numero || "") + '</td>' +
          '<td>' + escapeHtml(criterio.criterio || "") + '</td>' +
          '</tr>';
      }).join(""),
      '</tbody></table></div>'
    ].join("");
  }

  function renderRecursive(value, depth) {
    if (value === null || typeof value !== "object") {
      return '<span class="exp-leaf">' + escapeHtml(value == null ? "-" : String(value)) + '</span>';
    }

    if (Array.isArray(value)) {
      if (!value.length) return '<p class="exp-empty">Arreglo vacio</p>';

      return '<div class="exp-node-list">' + value.map(function (entry, index) {
        if (entry === null || typeof entry !== "object") {
          return '<div class="exp-node-row"><span class="exp-node-key">Item ' + (index + 1) + '</span><span class="exp-node-value">' + escapeHtml(String(entry)) + '</span></div>';
        }
        return '<details class="exp-node"' + (depth < 1 ? " open" : "") + '><summary>Item ' + (index + 1) + '</summary><div class="exp-node-body">' + renderRecursive(entry, depth + 1) + '</div></details>';
      }).join("") + '</div>';
    }

    var keys = Object.keys(value);
    if (!keys.length) return '<p class="exp-empty">Objeto vacio</p>';

    return '<div class="exp-node-list">' + keys.map(function (key) {
      var entry = value[key];
      if (entry === null || typeof entry !== "object") {
        return '<div class="exp-node-row"><span class="exp-node-key">' + escapeHtml(toLabel(key)) + '</span><span class="exp-node-value">' + escapeHtml(String(entry == null ? "-" : entry)) + '</span></div>';
      }
      return '<details class="exp-node"' + (depth < 1 ? " open" : "") + '><summary>' + escapeHtml(toLabel(key)) + '</summary><div class="exp-node-body">' + renderRecursive(entry, depth + 1) + '</div></details>';
    }).join("") + '</div>';
  }

  function renderJson(item) {
    var container = document.getElementById("exp-json");
    if (!container) return;
    container.innerHTML = renderRecursive(item, 0);
  }

  function setupStaticInfo(item, resourceConfig, id, fase) {
    var clasificacion = item && item.clasificacion ? item.clasificacion : {};
    var contenido = item && item.contenido ? item.contenido : {};
    var archivo = item && item.archivo ? item.archivo : {};
    var titulo = contenido.titulo || contenido.nombre_proyecto || archivo.nombre || "Experiencia didactica";

    setText("exp-title", titulo);
    setText("exp-bc-titulo", titulo);
    setText("exp-bc-fase", clasificacion.fase != null ? "Fase " + clasificacion.fase : "Fase -");
    setText("exp-bc-grado", clasificacion.grado != null ? clasificacion.grado + " grado" : "Grado -");
    setText("exp-lead", contenido.sintesis || contenido.proposito || "Sin sintesis disponible para este recurso.");
    setText("exp-proposito", contenido.proposito || "No se registro proposito para este recurso.");

    var chips = document.getElementById("exp-chips");
    if (chips) {
      var metodologias = Array.isArray(contenido.metodologias) ? contenido.metodologias : [];
      var temas = Array.isArray(contenido.temas_clave) ? contenido.temas_clave : [];
      var chipValues = [
        clasificacion.categoria_pedagogica,
        metodologias[0],
        contenido.sesiones_totales != null ? (contenido.sesiones_totales + " sesiones") : "",
        temas.length ? (temas.length + " temas clave") : ""
      ].filter(Boolean);

      chips.innerHTML = chipValues.map(function (chip) {
        return '<span class="exp-chip">' + escapeHtml(chip) + '</span>';
      }).join("");
    }

    var backBtn = document.getElementById("exp-back-btn");
    if (backBtn) {
      backBtn.href = resourceConfig.backHref;
      backBtn.textContent = "<- " + resourceConfig.backLabel;
    }

    var visualizadorHref = "visualizador.html?id=" + encodeURIComponent(id || "") +
      "&fase=" + encodeURIComponent(String(fase || clasificacion.fase || "")) +
      "&tipo=" + encodeURIComponent(String(getParam("tipo") || "planos")) +
      "&from=planos";

    var pdfBtn = document.getElementById("exp-open-pdf");
    var visualizadorBtn = document.getElementById("exp-open-visualizador");
    var filePath = buildFilePath(item, resourceConfig);

    if (pdfBtn) {
      if (filePath) {
        pdfBtn.href = filePath;
        pdfBtn.target = "_blank";
        pdfBtn.rel = "noopener";
      } else {
        pdfBtn.classList.add("is-disabled");
        pdfBtn.setAttribute("aria-disabled", "true");
      }
    }

    if (visualizadorBtn) {
      visualizadorBtn.href = visualizadorHref;
    }
  }

  function bindGlobalActions() {
    var addButton = document.getElementById("exp-add-activity");
    if (addButton) {
      addButton.addEventListener("click", function () {
        var state = getCurrentSessionState();
        if (!state) return;

        state.activities.push({ text: "Nueva actividad", done: false, comment: "" });
        saveState();
        renderActivities();
        renderSessionProgress();
        renderRouteList();
      });
    }

    var routeButton = document.getElementById("exp-open-route");
    if (routeButton) {
      routeButton.addEventListener("click", function () {
        renderRouteList();
        if (routeModal) {
          routeModal.show();
        }
      });
    }
  }

  function renderError(message) {
    setText("exp-title", "No se pudo cargar la experiencia");
    setText("exp-lead", message || "Verifica el recurso e intenta nuevamente.");

    var layout = document.querySelector(".exp-layout");
    if (layout) {
      layout.innerHTML = '<article class="exp-card card border-0"><p class="exp-empty">' + escapeHtml(message || "No fue posible cargar datos.") + '</p></article>';
    }
  }

  function hydrate(item, resourceConfig, id, fase) {
    currentItem = item;
    currentId = id;
    currentState = getStoredState(item, id);

    if (typeof bootstrap !== "undefined") {
      var modalElement = document.getElementById("exp-route-modal");
      if (modalElement) {
        routeModal = new bootstrap.Modal(modalElement);
      }
    }

    setupStaticInfo(item, resourceConfig, id, fase);
    renderFacts(item);
    renderNarrative(item);
    renderEvaluacion(item);
    renderJson(item);
    renderSessionArea();
    renderRouteList();
    bindGlobalActions();
    saveState();
  }

  function init() {
    var id = getParam("id");
    var fase = getParam("fase");
    var resourceConfig = getResourceConfig();

    if (!id) {
      renderError("Falta el identificador del recurso.");
      return;
    }

    loadMetadata(id, fase, resourceConfig)
      .then(function (item) {
        if (!item) {
          renderError("No encontramos el recurso solicitado en metadata.");
          return;
        }

        hydrate(item, resourceConfig, id, fase);
      })
      .catch(function () {
        renderError("Ocurrio un error al leer el archivo de metadata.");
      });
  }

  init();
})();
