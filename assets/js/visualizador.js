(function () {
  "use strict";
  
  console.log("DEBUG: visualizador.js IIFE executed at", new Date().toISOString());

  var PROFILE_KEY = "maletinPrimariaTeacherProfile";
  var ALUMNOS_STORAGE_KEY = "maletinPrimariaAlumnos";
  var GROUP_EXPERIENCE_STORAGE_KEY = "maletinPrimariaGroupExperiences";
  var SMART_MODE_KEY_PREFIX = "vizSmartMode_";
  var NOTES_KEY_PREFIX = "vizNotes_";
  var ACTIVITIES_KEY_PREFIX = "vizActivities_";
  var ACTIVITIES_HISTORY_KEY_PREFIX = "vizActivitiesHistory_";
  var CURRENT_SESSION_KEY_PREFIX = "vizCurrentSession_";
  var PROGRESS_KEY_PREFIX = "vizProgress_";
  var PROGRESS_MANUAL_KEY_PREFIX = "vizProgressManual_";
  var STATUS_KEY_PREFIX = "vizStatus_";
  var AI_RECOMMENDATIONS_KEY_PREFIX = "vizAiRecommendations_";
  var INSTRUMENT_RECOMMENDATIONS_KEY_PREFIX = "vizInstrumentRecommendations_";
  var INSTRUMENT_RECOMMENDATIONS_DATA_KEY_PREFIX = "vizInstrumentRecommendationsData_";
  var IA_CUSTOM_PARAMS_KEY_PREFIX = "vizIaCustomCriterionParams_";
  var IA_CUSTOM_CRITERIA_KEY_PREFIX = "vizIaCustomCriteria_";
  var ASSISTANT_STATE_KEY = "maletinAssistantStateV1";

  var currentId = null;
  var smartActive = false;
  var currentItem = null;
  var currentInstrumentRecommendations = [];
  var currentEnrichment = {};
  var currentSessionOptions = [];
  var currentActivitiesCache = [];
  var aiTypingTimer = null;
  var instrumentCatalogPromise = null;
  var instrumentsModalInstance = null;
  var activitiesModalInstance = null;
  var instrumentRecommendationsPending = false;
  var currentResourceConfig = null;

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
    }
  };

  RESOURCE_CONFIG.material_docente = {
    metadataPath: "src/metadata/material_docente.json",
    folderName: "material_docente",
    backHref: "planos-didacticos.html?tipo=material-docente",
    backLabel: "Material Docente"
  };

  RESOURCE_CONFIG.imprimibles = {
    metadataFile: "imprimibles.json",
    folderName: "imprimibles",
    backHref: "planos-didacticos.html?tipo=imprimibles&portada=assets/img/lineicons/impresora.png",
    backLabel: "Imprimibles"
  };

  // --- Lectura de params de URL ---
  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function getResourceConfig() {
    var tipo = String(getParam("tipo") || "planos").toLowerCase();
    return RESOURCE_CONFIG[tipo] || RESOURCE_CONFIG.planos;
  }

  function inferBackTarget(resourceConfig) {
    var from = String(getParam("from") || "").toLowerCase();
    var referrer = String(document.referrer || "").toLowerCase();

    if (from === "inicio") {
      return { href: "index.html", label: "Inicio" };
    }

    if (from === "planos") {
      return { href: resourceConfig.backHref, label: resourceConfig.backLabel };
    }

    if (referrer.indexOf("index.html") !== -1 || referrer.indexOf("inicio-beta") !== -1) {
      return { href: "index.html", label: "Inicio" };
    }

    return { href: resourceConfig.backHref, label: resourceConfig.backLabel };
  }

  // --- Metadata JSON ---
  function loadMetadata(id, fase, resourceConfig) {
    if (resourceConfig.metadataPath) {
      return fetch(resourceConfig.metadataPath)
        .then(function (r) { return r.json(); })
        .then(function (items) {
          return Array.isArray(items) ? items.find(function (i) { return i.id === id; }) : null;
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
      .then(function (r) { return r.json(); })
      .then(function (items) {
        return Array.isArray(items) ? items.find(function (i) { return i.id === id; }) : null;
      });
  }

  function loadInstrumentCatalog() {
    if (!instrumentCatalogPromise) {
      instrumentCatalogPromise = fetch("src/metadata/instrumentos_evaluacion.json")
        .then(function (response) {
          if (!response.ok) {
            throw new Error("No se pudo cargar el catalogo de instrumentos.");
          }
          return response.json();
        })
        .then(function (items) {
          return Array.isArray(items) ? items : [];
        })
        .catch(function () {
          return [];
        });
    }

    return instrumentCatalogPromise;
  }

  // --- Render metadata panel ---
  function renderMeta(item, resourceConfig) {
    if (!item) return;
      if (isMaterialDocente(resourceConfig)) {
        renderMetaMaterialDocente(item, resourceConfig);
        return;
      }
    var clasificacion = item.clasificacion || {};
    var contenido = item.contenido || {};
    var archivo = item.archivo || {};

    currentItem = item;
    currentSessionOptions = getSessionOptionsFromItem(item);

    var faseLabel = clasificacion.fase != null
      ? "Fase " + clasificacion.fase
      : (Array.isArray(clasificacion.fases_aplicables) && clasificacion.fases_aplicables.length
        ? "Fases " + clasificacion.fases_aplicables.join(", ")
        : "Fase ?");
    var gradoLabel = clasificacion.grado != null ? clasificacion.grado + "° grado" : "Multinivel";

    set("viz-bc-fase", faseLabel);
    set("viz-bc-grado", gradoLabel);
    set("viz-bc-titulo", contenido.titulo || archivo.nombre || "Recurso");
    set("viz-file-title", archivo.nombre || contenido.titulo || "Archivo");
    set("viz-meta-titulo", contenido.titulo || contenido.nombre_proyecto || "—");
    set("viz-meta-fase", clasificacion.fase != null ? "Fase " + clasificacion.fase : (Array.isArray(clasificacion.fases_aplicables) ? "Fases " + clasificacion.fases_aplicables.join(", ") : "—"));
    set("viz-meta-grado", clasificacion.grado != null ? clasificacion.grado + "° grado" : (clasificacion.nivel_educativo || "—"));
    set("viz-meta-categoria", clasificacion.categoria_pedagogica || "—");
    set("viz-meta-proposito", contenido.proposito || "—");
    set("viz-meta-producto", contenido.producto_central || "—");
    currentEnrichment = item.enriquecimiento_ia || {};
    renderInstrumentCard([]);

    var savedRecommendations = currentId ? safeGet(AI_RECOMMENDATIONS_KEY_PREFIX + currentId) : null;
    if (savedRecommendations && savedRecommendations.indexOf("Instrumentos sugeridos para ") !== 0) {
      set("viz-meta-ai-recomendaciones", savedRecommendations);
      set("viz-ai-status", "Recomendaciones listas");
    } else {
      set("viz-ai-status", smartActive ? "Listo para generar" : "Activa el modo inteligente");
      set("viz-meta-ai-recomendaciones", "Pulsa el boton para generar recomendaciones.");
    }

    updateEvaluationRecommendations(false);
    refreshEvaluationModalContent();

    var metsTags = document.getElementById("viz-meta-metodologias");
    if (metsTags && Array.isArray(contenido.metodologias)) {
      metsTags.innerHTML = contenido.metodologias.map(function (m) {
        return '<span class="viz-meta-tag">' + escapeHtml(m) + "</span>";
      }).join("");
    }

    // Campos formativos
    var camposList = document.getElementById("viz-campos-list");
    if (camposList && Array.isArray(item.contenido && item.contenido.campos_formativos ? item.contenido.campos_formativos : [])) {
      var campos = item.contenido.campos_formativos || [];
      if (campos.length) {
        camposList.innerHTML = campos.map(function (cf) {
          return '<li class="viz-campo-item"><strong>' + escapeHtml(cf.campo || "") + '</strong></li>';
        }).join("");
      }
    }

    // Refresca el resumen/selector de sesiones de actividades con la metadata del plano
    var savedActivities = currentId ? safeGetJson(ACTIVITIES_KEY_PREFIX + currentId) : null;
    renderActivities(savedActivities || createActivitiesFromItem(item));

    // Visor PDF
    if (archivo.nombre) {
      var iframe = document.getElementById("viz-iframe");
      var placeholder = document.getElementById("viz-viewer-placeholder");
      var downloadBtn = document.getElementById("viz-download-btn");
      var filePath = buildFilePath(clasificacion, archivo, resourceConfig, item);
      var viewerPath = filePath ? buildViewerPath(filePath) : null;

      if (iframe && viewerPath) {
        iframe.src = viewerPath;
        iframe.classList.remove("d-none");
      }
      if (placeholder) placeholder.classList.add("d-none");
      if (downloadBtn && filePath) downloadBtn.href = toAbsoluteUrl(filePath);
    }
  }

  // Ajusta parametros del visor para ocultar paneles laterales cuando el navegador lo soporta.
  function buildViewerPath(filePath) {
    return toAbsoluteUrl(filePath) + "#pagemode=none&navpanes=0";
  }

  function toAbsoluteUrl(path) {
    try {
      return new URL(path, window.location.href).href;
    } catch (error) {
      return encodeURI(path);
    }
  }

  function getTeacherProfileSelection() {
    var profile = {};

    try {
      profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") || {};
    } catch (_) {
      profile = {};
    }

    var phase = parseInt(profile.phase, 10);
    var grade = parseInt(profile.level, 10);

    if (isNaN(phase) && Array.isArray(profile.phases) && profile.phases.length) {
      phase = parseInt(profile.phases[0], 10);
    }

    if (isNaN(grade) && Array.isArray(profile.levels) && profile.levels.length) {
      grade = parseInt(profile.levels[0], 10);
    }

    return {
      phase: isNaN(phase) ? null : phase,
      grade: isNaN(grade) ? null : grade
    };
  }

  function safeParseJson(rawValue, fallbackValue) {
    try {
      return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch (_) {
      return fallbackValue;
    }
  }

  function getTeacherProfileRaw() {
    return safeParseJson(localStorage.getItem(PROFILE_KEY), {}) || {};
  }

  function normalizeGroupText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");
  }

  function resolveGroupContext() {
    var profile = getTeacherProfileRaw();
    var selection = getTeacherProfileSelection();
    var phase = selection.phase || parseInt(profile.phase, 10) || parseInt(getParam("fase"), 10) || null;
    var grade = selection.grade || parseInt(profile.level, 10) || null;
    var group = profile.group || profile.grupo || profile.groupName || profile.levelGroup || "A";
    var shift = profile.shift || profile.turno || "";

    return {
      phase: phase,
      grade: grade,
      group: String(group || "A"),
      shift: String(shift || "")
    };
  }

  function getGroupExperienceKey() {
    var ctx = resolveGroupContext();
    return [
      "fase" + (ctx.phase || "x"),
      "grado" + (ctx.grade || "x"),
      "grupo" + (normalizeGroupText(ctx.group) || "a"),
      normalizeGroupText(ctx.shift) || "sin-turno"
    ].join("_");
  }

  function loadStudentsDataset() {
    var raw = safeParseJson(localStorage.getItem(ALUMNOS_STORAGE_KEY), []);

    if (Array.isArray(raw)) {
      return raw;
    }

    // Compatibilidad: algunas versiones guardan un objeto con `students`.
    if (raw && Array.isArray(raw.students)) {
      return raw.students;
    }

    return [];
  }

  function saveStudentsDataset(students) {
    try {
      localStorage.setItem(ALUMNOS_STORAGE_KEY, JSON.stringify(Array.isArray(students) ? students : []));
    } catch (_) {}
  }

  function buildExperienceSnapshot(statusLabel) {
    var ctx = resolveGroupContext();
    var progressRange = document.getElementById("viz-progress-range");
    var progressValue = parseInt((progressRange && progressRange.value) || "0", 10);
    var safeActivities = normalizeActivities(currentActivitiesCache);
    var doneCount = safeActivities.filter(function (activity) { return !!activity.done; }).length;

    return {
      id: currentId,
      title: currentItem && currentItem.contenido ? (currentItem.contenido.titulo || currentItem.contenido.nombre_proyecto || "Experiencia") : "Experiencia",
      fase: ctx.phase,
      grado: ctx.grade,
      grupo: ctx.group,
      turno: ctx.shift,
      status: statusLabel || safeGet(STATUS_KEY_PREFIX + currentId) || "pendiente",
      progress: Number.isFinite(progressValue) ? progressValue : 0,
      completedActivities: doneCount,
      totalActivities: safeActivities.length,
      currentSession: getCurrentSessionOrder(),
      updatedAt: Date.now()
    };
  }

  function syncHomeActiveExperience(snapshot) {
    if (!currentId || !currentItem || !smartActive) return;

    var content = currentItem.contenido || {};
    var sesiones = Array.isArray(content.sesiones) ? content.sesiones : [];
    var totalSessions = parseInt(content.sesiones_totales, 10) || sesiones.length || 1;
    var currentSession = Math.max(1, parseInt((snapshot && snapshot.currentSession) || getCurrentSessionOrder() || 1, 10) || 1);
    var sessionIndex = Math.max(0, Math.min(currentSession - 1, Math.max(0, sesiones.length - 1)));
    var sessionObj = sesiones[sessionIndex] || null;
    var moments = Array.isArray(content.momentos_metodologicos) ? content.momentos_metodologicos : [];
    var momentObj = moments.find(function (item) {
      return item && sessionObj && item.nombre === sessionObj.momento_metodologico;
    }) || moments[0] || null;

    var rawState = safeParseJson(localStorage.getItem(ASSISTANT_STATE_KEY), {});
    var previousActive = rawState && rawState.activeExperience && rawState.activeExperience.resourceId === currentId
      ? rawState.activeExperience
      : null;
    var startedAt = previousActive && previousActive.startedAt ? previousActive.startedAt : new Date().toISOString();
    var classDuration = parseInt(previousActive && previousActive.classDuration, 10) || 50;
    var daysPerWeek = parseInt(previousActive && previousActive.daysPerWeek, 10) || 2;
    var plannedWeeks = parseInt(previousActive && previousActive.plannedWeeks, 10) || Math.max(1, Math.ceil(totalSessions / Math.max(1, daysPerWeek)));

    rawState = rawState && typeof rawState === "object" ? rawState : {};
    rawState.activeExperience = {
      resourceId: currentId,
      resourceType: String(getParam("tipo") || "planos").toLowerCase(),
      title: content.titulo || content.nombre_proyecto || "Experiencia",
      metodologia: (content.metodologias && content.metodologias[0]) || "Ruta pedagogica",
      product: content.producto_central || "Producto final",
      totalSessions: totalSessions,
      currentSession: currentSession,
      progress: Math.max(0, Math.min(100, parseInt((snapshot && snapshot.progress) || "0", 10) || 0)),
      calendarProgress: previousActive && typeof previousActive.calendarProgress === "number" ? previousActive.calendarProgress : 0,
      plannedWeeks: plannedWeeks,
      classDuration: classDuration,
      daysPerWeek: daysPerWeek,
      estimatedEndLabel: previousActive && previousActive.estimatedEndLabel ? previousActive.estimatedEndLabel : "Fecha estimada",
      currentMoment: (momentObj && momentObj.nombre) || (sessionObj && sessionObj.momento_metodologico) || "Momento inicial",
      todayObjective: (momentObj && momentObj.descripcion_completa) || "Continuar la experiencia con el grupo.",
      todayTasks: Array.isArray(sessionObj && sessionObj.actividades) ? sessionObj.actividades.slice(0, 3) : [],
      remainingSessions: Math.max(0, totalSessions - currentSession),
      startedAt: startedAt
    };

    try {
      localStorage.setItem(ASSISTANT_STATE_KEY, JSON.stringify(rawState));
    } catch (_) {}
  }

  function persistExperienceToGroupAndStudents(statusLabel) {
    if (!currentId || !currentItem) return;

    var snapshot = buildExperienceSnapshot(statusLabel);
    syncHomeActiveExperience(snapshot);
    var groupKey = getGroupExperienceKey();

    var groupStore = safeParseJson(localStorage.getItem(GROUP_EXPERIENCE_STORAGE_KEY), {});
    if (!groupStore || typeof groupStore !== "object") {
      groupStore = {};
    }

    if (!groupStore[groupKey]) {
      groupStore[groupKey] = {
        context: {
          fase: snapshot.fase,
          grado: snapshot.grado,
          grupo: snapshot.grupo,
          turno: snapshot.turno
        },
        resources: {}
      };
    }

    groupStore[groupKey].resources[currentId] = snapshot;

    try {
      localStorage.setItem(GROUP_EXPERIENCE_STORAGE_KEY, JSON.stringify(groupStore));
    } catch (_) {}

    var students = loadStudentsDataset();
    if (!students.length) return;

    var enrichedStudents = students.map(function (student) {
      var safeStudent = Object.assign({}, student);
      var tracking = safeStudent.experienceTracking && typeof safeStudent.experienceTracking === "object"
        ? Object.assign({}, safeStudent.experienceTracking)
        : {};

      if (!tracking[groupKey]) {
        tracking[groupKey] = { resources: {} };
      }

      tracking[groupKey].resources = tracking[groupKey].resources || {};
      tracking[groupKey].resources[currentId] = snapshot;
      safeStudent.experienceTracking = tracking;
      return safeStudent;
    });

    saveStudentsDataset(enrichedStudents);
  }

  // Construye la ruta al archivo en src/resources según fase, grado y categoria
  function buildFilePath(clasificacion, archivo, resourceConfig, item) {
    var nombre = archivo.nombre || "";
    var ruta = String(archivo.ruta || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!ruta && !archivo.nombre) return null;

    if (resourceConfig.folderName === "material_docente") {
      return "src/resources/MATERIAL PARA EL DOCENTE/" + nombre;
    }

    if (resourceConfig.folderName === "instrumentos_evaluacion") {
      if (archivo.ruta) {
        return "src/resources/" + archivo.ruta;
      }
      return "src/resources/instrumentos_evaluacion/" + nombre;
    }

    if (resourceConfig.folderName === "imprimibles") {
      if (archivo.ruta) {
        return "src/resources/" + archivo.ruta;
      }

      var imprimiblesSubfolder = getImprimiblesSubfolder(item, clasificacion);
      return "src/resources/material_alumno/Imprimibles/" + imprimiblesSubfolder + "/" + nombre;
    }

    var profileSelection = getTeacherProfileSelection();
    var fase = profileSelection.phase || parseInt(clasificacion.fase, 10);
    var grado = profileSelection.grade || parseInt(clasificacion.grado, 10);
    if (!fase || !grado) return null;

    var faseSegment = "FASE " + fase;

    // El formato de carpeta de grado difiere entre fases
    var gradoSegment;
    if (fase === 3) {
      gradoSegment = grado + " GRADO";
    } else {
      gradoSegment = grado + "_grado";
    }

    if (resourceConfig.folderName === "planos_didacticos") {
      if (!ruta) return null;
      var relativeRuta = ruta.replace(/^planos_didacticos\//i, "");
      return "src/resources/" + faseSegment + "/" + gradoSegment + "/planos_didacticos/" + relativeRuta;
    }

    return "src/resources/" + faseSegment + "/" + gradoSegment + "/" + resourceConfig.folderName + "/" + nombre;
  }

  // Mapea categoria_pedagogica al nombre de carpeta
  function categoriaToCarpeta(categoria) {
    var norm = categoria.toLowerCase();
    if (norm.indexOf("comunitario") !== -1 || norm.indexOf("comunidad") !== -1) return "comunitarios";
    if (norm.indexOf("problema") !== -1) return "problemas";
    if (norm.indexOf("servicio") !== -1) return "servicio";
    if (norm.indexOf("steam") !== -1) return "steam";
    return "comunitarios"; // fallback
  }

  // --- Helpers ---
    // --- Helpers para material_docente ---
    function isMaterialDocente(rc) {
      return rc && (rc.folderName === "material_docente" || rc.folderName === "imprimibles");
    }

    function isImprimibles(rc) {
      return rc && rc.folderName === "imprimibles";
    }

    function getImprimiblesSubfolder(item, clasificacion) {
      var id = String(item && item.id ? item.id : "").toLowerCase();
      var categoria = String(clasificacion && clasificacion.categoria_pedagogica ? clasificacion.categoria_pedagogica : "").toLowerCase();

      if (id.indexOf("spc-") === 0) {
        return "saberes_pensamiento_cientifico";
      }

      if (id.indexOf("len-") === 0 || id.indexOf("leng-") === 0) {
        return "Lenguajes";
      }

      if (id.indexOf("ens-") === 0 || id.indexOf("ety-") === 0 || id.indexOf("soc-") === 0) {
        return "etica_naturaleza_sociedades";
      }

      if (categoria.indexOf("lengua") !== -1 || categoria.indexOf("lect") !== -1 || categoria.indexOf("comunic") !== -1) {
        return "Lenguajes";
      }

      if (categoria.indexOf("etica") !== -1 || categoria.indexOf("naturaleza") !== -1 || categoria.indexOf("sociedad") !== -1) {
        return "etica_naturaleza_sociedades";
      }

      return "saberes_pensamiento_cientifico";
    }

    function setMetaLabel(labelId, labelText, valueId, valueText) {
      var labelEl = document.getElementById(labelId);
      var valueEl = document.getElementById(valueId);
      if (labelEl) labelEl.textContent = labelText;
      if (valueEl) valueEl.textContent = valueText;
    }

    function categoryFromMaterialDocenteId(id) {
      if (!id) return "Material docente";
      if (id.indexOf("adm-") === 0) return "Administración escolar";
      if (id.indexOf("ped-") === 0) return "Seguimiento pedagógico";
      if (id.indexOf("leg-") === 0) return "Marco legal";
      if (id.indexOf("diag-") === 0) return "Diagnóstico";
      if (id.indexOf("plan-") === 0) return "Planeación";
      if (id.indexOf("mu-") === 0) return "Guía de uso";
      return "Material docente";
    }

    // Narrativa IA especializada para material_docente
    function buildAiNarrativeMaterialDocente(item) {
      if (!item) return "No hay datos disponibles para este recurso.";

      var contenido = item.contenido || {};
      var archivo = item.archivo || {};
      var pedagogico = ((item.enriquecimiento_ia || {}).pedagogico) || {};

      var lines = [];

      var tipo = archivo.tipo || "Recurso docente";
      var titulo = contenido.titulo || tipo;

      lines.push("✦ " + titulo);
      lines.push("");

      var paraQue = contenido.para_que_te_sirve;
      if (paraQue) {
        lines.push("📌 ¿Para qué te sirve?");
        lines.push(paraQue);
        lines.push("");
      }

      var competencias = pedagogico.competencias_docentes || [];
      if (competencias.length) {
        lines.push("🎯 Competencias docentes que refuerza:");
        competencias.forEach(function (c) { lines.push("  • " + c); });
        lines.push("");
      }

      var habilidades = pedagogico.habilidades_reforzadas || [];
      if (habilidades.length) {
        lines.push("💡 Habilidades que fortalece:");
        habilidades.forEach(function (h) { lines.push("  • " + h); });
        lines.push("");
      }

      var emociones = pedagogico.emociones_esperadas || [];
      if (emociones.length) {
        lines.push("✨ Impacto esperado en tu práctica:");
        lines.push("  " + emociones.join("  ·  "));
        lines.push("");
      }

      var nivel = pedagogico.nivel_abstraccion;
      if (nivel) {
        lines.push("📊 Nivel de aplicación: " + nivel);
      }

      if (lines.length <= 2) {
        lines.push("Este recurso está diseñado para fortalecer tu práctica docente y facilitar la gestión del aula.");
      }

      return lines.join("\n").trim();
    }

    // Render especializado para material_docente
    function renderMetaMaterialDocente(item, resourceConfig) {
      var contenido = item.contenido || {};
      var archivo = item.archivo || {};
      var clasificacion = item.clasificacion || {};
      var pedagogico = ((item.enriquecimiento_ia || {}).pedagogico) || {};
      var isImprimible = isImprimibles(resourceConfig);

      currentItem = item;
      currentEnrichment = item.enriquecimiento_ia || {};

      // Breadcrumb
      set("viz-bc-fase", isImprimible ? "Imprimibles" : "Material Docente");
      set("viz-bc-grado", archivo.tipo || "Recurso");
      set("viz-bc-titulo", contenido.titulo || archivo.nombre || "Recurso");
      set("viz-file-title", archivo.nombre || contenido.titulo || "Archivo");

      // Panel de metadatos
      set("viz-meta-heading", "Sobre este recurso");
      set("viz-meta-titulo", contenido.titulo || "—");

      setMetaLabel("viz-label-fase", "Tipo de recurso", "viz-meta-fase", archivo.tipo || "—");
      setMetaLabel("viz-label-grado", "Aplicación", "viz-meta-grado", isImprimible ? (clasificacion.grado || "Primaria") : "Docentes de todos los grados");
      setMetaLabel("viz-label-categoria", "Categoría", "viz-meta-categoria", isImprimible ? (clasificacion.categoria_pedagogica || "Imprimibles") : categoryFromMaterialDocenteId(item.id));
      setMetaLabel("viz-label-proposito", "¿Para qué te sirve?", "viz-meta-proposito", contenido.para_que_te_sirve || "—");

      // Ocultar "Producto central" (no aplica aquí)
      var productoItem = document.getElementById("viz-meta-item-producto");
      if (productoItem) productoItem.style.display = "none";

      // Panel IA
      var aiBtn = document.getElementById("viz-ai-generate-btn");
      if (aiBtn) aiBtn.textContent = "Analizar con IA";

      var savedRec = currentId ? safeGet(AI_RECOMMENDATIONS_KEY_PREFIX + currentId) : null;
      if (savedRec) {
        set("viz-meta-ai-recomendaciones", savedRec);
        set("viz-ai-status", "Análisis listo");
      } else {
        set("viz-ai-status", smartActive ? "Listo para generar" : "Activa el modo inteligente");
        set("viz-meta-ai-recomendaciones", "Pulsa el botón para analizar este recurso con IA.");
      }

      // Rellenar lista de competencias/habilidades
      var camposList = document.getElementById("viz-campos-list");
      if (camposList) {
        var skills = (pedagogico.competencias_docentes || pedagogico.competencias_inferidas || [])
          .concat(pedagogico.habilidades_reforzadas || pedagogico.habilidades_inferidas || []);
        if (skills.length) {
          camposList.innerHTML = skills.map(function (c) {
            return '<li class="viz-campo-item"><strong>' + escapeHtml(c) + '</strong></li>';
          }).join("");
        } else {
          camposList.innerHTML = '<li class="viz-campo-placeholder">Sin datos de competencias registrados.</li>';
        }
      }

      // Ocultar tarjetas que no aplican a material docente
      var instrumentosCard = document.getElementById("viz-card-instrumentos");
      if (instrumentosCard) instrumentosCard.style.display = "none";

      var seguimientoCard = document.getElementById("viz-card-seguimiento");
      if (seguimientoCard) seguimientoCard.style.display = "none";

      var progresoCard = document.getElementById("viz-card-progreso");
      if (progresoCard) progresoCard.style.display = "none";

      var camposCard2 = document.getElementById("viz-card-campos");
      if (camposCard2) camposCard2.style.display = "none";

      // Visor del archivo
      var filePath = buildFilePath(clasificacion, archivo, resourceConfig, item);
      var iframe = document.getElementById("viz-iframe");
      var placeholder = document.getElementById("viz-viewer-placeholder");
      var downloadBtn = document.getElementById("viz-download-btn");

      if (filePath && downloadBtn) downloadBtn.href = toAbsoluteUrl(filePath);

      var ext = archivo.nombre ? archivo.nombre.split(".").pop().toLowerCase() : "";
      if (ext === "pdf" && iframe && filePath) {
        iframe.src = buildViewerPath(filePath);
        iframe.classList.remove("d-none");
        if (placeholder) placeholder.classList.add("d-none");
      } else if (placeholder) {
        placeholder.innerHTML =
          '<div class="viz-placeholder-icon" aria-hidden="true">' + escapeHtml(contenido.emoji_recurso || "📄") + '</div>' +
          '<p style="margin-bottom:0.75rem">' + escapeHtml(archivo.tipo || "Documento") + '</p>' +
          (filePath
            ? '<a class="btn beta-primary-btn btn-sm" href="' + escapeHtml(filePath) + '" download>Descargar archivo</a>'
            : "");
        placeholder.classList.remove("d-none");
        if (iframe) iframe.classList.add("d-none");
      }
    }

  function buildAiNarrative(enriquecimiento) {
    var pedagogico = enriquecimiento.pedagogico || {};
    var semantica = enriquecimiento.semantica || {};
    var recomendacion = enriquecimiento.recomendacion || {};
    var descubrimiento = enriquecimiento.descubrimiento_contextual || {};

    var competencias = joinTop(pedagogico.competencias_inferidas, 3);
    var habilidades = joinTop(pedagogico.habilidades_inferidas || pedagogico.habilidades_reforzadas, 3);
    var temas = joinTop(semantica.temas_detectados, 3);
    var contextos = joinTop(recomendacion.contextos_recomendados, 2);
    var agrupaciones = joinTop(recomendacion.agrupaciones_sugeridas, 2);

    var lines = [];

    if (competencias) lines.push("• Competencias sugeridas: " + competencias + ".");
    if (habilidades) lines.push("• Habilidades foco: " + habilidades + ".");
    if (temas) lines.push("• Temas detectados: " + temas + ".");
    if (contextos) lines.push("• Contexto recomendado: " + contextos + ".");
    if (agrupaciones) lines.push("• Agrupaciones sugeridas: " + agrupaciones + ".");

    var discoveryLines = buildDiscoveryLines(descubrimiento);
    if (discoveryLines.length) {
      lines.push("");
      lines.push("🔎 Hallazgos contextuales:");
      lines = lines.concat(discoveryLines);
    }

    if (!lines.length) {
      lines.push("No hay datos de enriquecimiento IA para este recurso.");
    }

    return lines.join("\n");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includesAny(text, tokens) {
    var haystack = normalizeText(text);
    return tokens.some(function (token) {
      return haystack.indexOf(normalizeText(token)) !== -1;
    });
  }

  function collectPlanoSignals(item) {
    var contenido = item && item.contenido ? item.contenido : {};
    var clasificacion = item && item.clasificacion ? item.clasificacion : {};
    var campos = Array.isArray(contenido.campos_formativos) ? contenido.campos_formativos : [];
    var campoNombres = campos.map(function (campo) {
      return campo && campo.campo ? campo.campo : "";
    }).filter(Boolean);

    return {
      fase: clasificacion.fase,
      grado: clasificacion.grado,
      categoria: clasificacion.categoria_pedagogica || "",
      metodologias: Array.isArray(contenido.metodologias) ? contenido.metodologias : [],
      campos: campoNombres,
      titulo: contenido.titulo || contenido.nombre_proyecto || "",
      proposito: contenido.proposito || "",
      producto: contenido.producto_central || "",
      text: normalizeText([
        contenido.titulo,
        contenido.nombre_proyecto,
        contenido.proposito,
        contenido.producto_central,
        clasificacion.categoria_pedagogica,
        (Array.isArray(contenido.metodologias) ? contenido.metodologias.join(" ") : ""),
        campoNombres.join(" ")
      ].join(" "))
    };
  }

  function scoreInstrumentForPlano(item, instrument) {
    var signals = collectPlanoSignals(item);
    var instrumentClas = instrument && instrument.clasificacion ? instrument.clasificacion : {};
    var instrumentContent = instrument && instrument.contenido ? instrument.contenido : {};
    var score = 0;
    var reasons = [];

    if (Array.isArray(instrumentClas.fases_aplicables) && instrumentClas.fases_aplicables.indexOf(signals.fase) !== -1) {
      score += 1;
    }

    if (instrumentClas.nivel_educativo === "multinivel") {
      score += 3;
      reasons.push("se puede aplicar en distintas fases");
    } else if (instrumentClas.nivel_educativo === "secundaria") {
      score -= 5;
    }

    if (signals.text.indexOf("proyecto") !== -1 || includesAny(signals.categoria, ["comunitario", "servicio", "problemas", "steam"]) || includesAny(signals.metodologias.join(" "), ["proyectos", "nem", "abp"])) {
      if (instrument.id === "instrumento-autoevaluacion-proyectos-nem") {
        score += 8;
        reasons.push("el plano trabaja con metodologia de proyecto");
      }
      if (instrument.id === "instrumento-evaluacion-formativa") {
        score += 5;
        reasons.push("permite seguimiento y retroalimentacion del proceso");
      }
    }

    if (includesAny(signals.text, ["exposicion", "exponer", "presentacion", "socializacion", "dialogo oral"]) && instrument.id === "instrumento-exposiciones-nem") {
      score += 8;
      reasons.push("el producto o cierre requiere presentacion oral");
    }

    if (includesAny(signals.producto + " " + signals.text, ["ensayo"]) && instrument.id === "instrumento-rubrica-ensayo") {
      score += 10;
      reasons.push("el producto central coincide con un ensayo");
    }

    if (includesAny(signals.producto + " " + signals.text, ["informe"]) && instrument.id === "instrumento-lista-informe") {
      score += 10;
      reasons.push("el producto central coincide con un informe");
    }

    if (includesAny(signals.producto + " " + signals.text, ["resena", "reseña"]) && instrument.id === "instrumento-rubrica-resena") {
      score += 10;
      reasons.push("el producto central coincide con una resena");
    }

    if (includesAny(signals.text, ["analisis de texto", "comprension lectora", "texto", "lectura"]) && instrument.id === "instrumento-guia-analisis-texto") {
      score += 6;
      reasons.push("ayuda a revisar comprension y analisis de textos");
    }

    if (includesAny(signals.text, ["reflexion", "metacognicion", "autoevaluacion"]) && instrument.id === "instrumento-rubrica-reflexion") {
      score += 7;
      reasons.push("el plano invita a la reflexion del aprendizaje");
    }

    if (includesAny(signals.campos.join(" "), ["lenguajes"])) {
      if (includesAny(signals.text, ["texto", "escrit", "relato", "cuento", "lectura"]) && instrument.id === "instrumento-guia-analisis-texto") {
        score += 3;
      }
      if (includesAny(signals.text, ["exposicion", "presentacion"]) && instrument.id === "instrumento-exposiciones-nem") {
        score += 3;
      }
    }

    if (instrument.id === "instrumento-evaluacion-formativa" && score > 0) {
      reasons.push("sirve como apoyo transversal para observar avances");
    }

    return {
      score: score,
      reasons: reasons.filter(Boolean)
    };
  }

  function buildInstrumentRecommendations(item, instruments) {
    var ranked = (Array.isArray(instruments) ? instruments : [])
      .map(function (instrument) {
        var scored = scoreInstrumentForPlano(item, instrument);
        return {
          instrument: instrument,
          score: scored.score,
          reasons: scored.reasons
        };
      })
      .filter(function (entry) {
        return entry.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 3);

    if (!ranked.length) {
      ranked = (Array.isArray(instruments) ? instruments : [])
        .filter(function (instrument) {
          return instrument && instrument.clasificacion && instrument.clasificacion.nivel_educativo === "multinivel";
        })
        .slice(0, 2)
        .map(function (instrument) {
          return {
            instrument: instrument,
            score: 1,
            reasons: ["funciona como apoyo general de evaluacion para este tipo de plano"]
          };
        });
    }

    return ranked;
  }

  function buildInstrumentRecommendationsText(item, ranked) {
    var contenido = item && item.contenido ? item.contenido : {};
    var titulo = contenido.titulo || contenido.nombre_proyecto || "este plano";

    if (!Array.isArray(ranked) || !ranked.length) {
      return "No se encontraron sugerencias claras de instrumentos para " + titulo + ".";
    }

    var lines = ["Instrumentos sugeridos para " + titulo + ":", ""];

    ranked.forEach(function (entry, index) {
      var instrument = entry.instrument || {};
      var instrumentContent = instrument.contenido || {};
      var reasons = entry.reasons.slice(0, 2).join("; ");

      lines.push((index + 1) + ". " + (instrumentContent.titulo || "Instrumento sugerido"));
      lines.push("   Tipo: " + (instrumentContent.instrumento || "Instrumento de evaluacion") + ".");
      lines.push("   Proposito: " + (instrumentContent.proposito || "Sin proposito definido.") + ".");
      if (reasons) {
        lines.push("   Por que: " + reasons + ".");
      }
      lines.push("");
    });

    return lines.join("\n").trim();
  }

  function buildInstrumentFilePath(instrument) {
    var archivo = instrument && instrument.archivo ? instrument.archivo : {};
    var ruta = archivo.ruta || "";
    if (!ruta) return "#";
    return "src/resources/" + ruta;
  }

  function setInstrumentGenerationState(isGenerating, message) {
    var summaryEl = document.getElementById("viz-instrumentos-summary");
    var modalCopyEl = document.getElementById("viz-modal-copy");
    if (summaryEl) {
      summaryEl.classList.toggle("is-generating", !!isGenerating);
      if (message) {
        summaryEl.textContent = message;
      }
    }

    if (modalCopyEl) {
      modalCopyEl.classList.toggle("is-generating", !!isGenerating);
      modalCopyEl.textContent = isGenerating
        ? "La IA esta analizando el plano para sugerir instrumentos pertinentes."
        : "Selecciona un instrumento sugerido para abrirlo.";
    }
  }

  function setInstrumentOpenFeedback(message, isError) {
    var modalCopyEl = document.getElementById("viz-modal-copy");
    if (!modalCopyEl) return;

    modalCopyEl.classList.remove("is-generating");
    modalCopyEl.textContent = message;
    modalCopyEl.style.color = isError ? "#b42318" : "#2d7d46";
    modalCopyEl.style.fontWeight = isError ? "700" : "600";
  }

  function getInstrumentSaveHandler() {
    if (!window.maletinAI) return null;

    if (typeof window.maletinAI.saveLocalResource === "function") {
      return {
        type: "save",
        run: function (relativePath) {
          return window.maletinAI.saveLocalResource(relativePath);
        }
      };
    }

    if (typeof window.maletinAI.openLocalResource === "function") {
      return {
        type: "open-fallback",
        run: function (relativePath) {
          return window.maletinAI.openLocalResource(relativePath);
        }
      };
    }

    return null;
  }

  function resetInstrumentOpenFeedback() {
    var modalCopyEl = document.getElementById("viz-modal-copy");
    if (!modalCopyEl) return;

    modalCopyEl.style.color = "";
    modalCopyEl.style.fontWeight = "";
    modalCopyEl.textContent = "Selecciona un instrumento sugerido para abrirlo.";
  }

  function handleOpenInstrumentClick(event) {
    var trigger = event.target.closest("[data-instrument-path]");
    if (!trigger) return;

    event.preventDefault();

    if (trigger.dataset.instrumentAction !== "save") {
      return;
    }

    var handler = getInstrumentSaveHandler();
    if (!handler) {
      setInstrumentOpenFeedback("Esta sesion no cargo la API local. Reinicia la app para habilitar guardado y apertura.", true);
      return;
    }

    var originalText = trigger.textContent;
    resetInstrumentOpenFeedback();
    trigger.innerHTML = '<span class="viz-modal-open-link-icon">...</span>';
    trigger.disabled = true;
    trigger.setAttribute("aria-disabled", "true");

    handler.run(trigger.dataset.instrumentPath)
      .then(function (result) {
        if (!result || !result.ok) {
          if (result && result.cancelled) {
            trigger.innerHTML = originalText;
            trigger.disabled = false;
            trigger.removeAttribute("aria-disabled");
            setInstrumentOpenFeedback("Guardado cancelado.", true);
            return;
          }

          trigger.innerHTML = '<span class="viz-modal-open-link-icon">!</span>';
          setInstrumentOpenFeedback(result && result.error ? result.error : "No se pudo guardar el archivo en este equipo.", true);
          setTimeout(function () {
            trigger.innerHTML = originalText;
            trigger.disabled = false;
            trigger.removeAttribute("aria-disabled");
          }, 1400);
          return;
        }

        trigger.innerHTML = '<span class="viz-modal-open-link-icon">✓</span>';
        setInstrumentOpenFeedback(
          handler.type === "save"
            ? "Archivo guardado y abierto correctamente en el equipo."
            : "La sesion uso apertura directa porque el guardado aun no esta disponible aqui.",
          false
        );
        setTimeout(function () {
          trigger.innerHTML = originalText;
          trigger.disabled = false;
          trigger.removeAttribute("aria-disabled");
        }, 1400);
      })
      .catch(function (error) {
        trigger.innerHTML = '<span class="viz-modal-open-link-icon">!</span>';
        setInstrumentOpenFeedback(error && error.message ? error.message : "No se pudo guardar el archivo en este equipo.", true);
        setTimeout(function () {
          trigger.innerHTML = originalText;
          trigger.disabled = false;
          trigger.removeAttribute("aria-disabled");
        }, 1400);
      });
  }

  function renderInstrumentCard(ranked) {
    var summaryEl = document.getElementById("viz-instrumentos-summary");
    var modalListEl = document.getElementById("viz-modal-instrumentos-list");
    var openBtn = document.getElementById("viz-open-instruments-btn");
    if (!summaryEl || !modalListEl || !openBtn) return;

    if (!Array.isArray(ranked) || !ranked.length) {
      setInstrumentGenerationState(false, "No hay instrumentos sugeridos para este plano.");
      modalListEl.innerHTML = '<li class="viz-campo-placeholder">No hay recomendaciones disponibles para este plano.</li>';
      openBtn.disabled = true;
      return;
    }

    setInstrumentGenerationState(false, ranked.length === 1
      ? "La IA encontro 1 instrumento sugerido listo para revisar."
      : "La IA encontro " + ranked.length + " instrumentos sugeridos listos para revisar.");
    openBtn.disabled = false;

    modalListEl.innerHTML = ranked.map(function (entry, index) {
      var instrument = entry && entry.instrument ? entry.instrument : {};
      var content = instrument.contenido || {};
      var clasificacion = instrument.clasificacion || {};
      var reason = Array.isArray(entry.reasons) ? entry.reasons.slice(0, 1).join(". ") : "";
      var href = buildInstrumentFilePath(instrument);
      var badges = [
        content.instrumento || "Instrumento",
        content.area || clasificacion.categoria_pedagogica || "Evaluacion"
      ].filter(Boolean).slice(0, 2);

      return [
        '<li class="viz-modal-instrumento-item">',
          '<div class="viz-modal-instrumento-main">',
            '<img class="viz-modal-instrumento-icon" src="assets/img/lineicons/excel.png" alt="Excel">',
            '<div class="viz-modal-instrumento-copy">',
              '<div class="viz-modal-instrumento-title">' + (index + 1) + '. ' + escapeHtml(content.titulo || "Instrumento sugerido") + '</div>',
              '<div class="viz-modal-instrumento-badges">' + badges.map(function (badge) {
                return '<span class="viz-modal-instrumento-badge">' + escapeHtml(badge) + '</span>';
              }).join("") + '</div>',
              '<div class="viz-modal-instrumento-meta"><strong>Aplicacion:</strong> ' + escapeHtml(clasificacion.nivel_educativo || "multinivel") + '</div>',
              '<div class="viz-modal-instrumento-meta"><strong>Proposito:</strong> ' + escapeHtml(content.proposito || "Sin proposito definido") + '</div>',
              (reason ? '<div class="viz-modal-instrumento-reason"><strong>Coincidencia:</strong> ' + escapeHtml(reason) + '.</div>' : ''),
              '<div class="viz-modal-instrumento-link mt-2"><a href="' + href + '" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary">Ver archivo Excel</a></div>',
            '</div>',
          '</div>',
        '</li>'
      ].join("");
    }).join("");
  }

  function getJsonCriteriaSuggestions() {
    var evaluacion = currentItem && currentItem.evaluacion ? currentItem.evaluacion : null;
    var suggestions = [];

    if (evaluacion && Array.isArray(evaluacion.criterios) && evaluacion.criterios.length) {
      evaluacion.criterios.forEach(function (c) {
        if (c.criterio) suggestions.push(String(c.criterio));
      });
    } else {
      var sesiones = currentItem && currentItem.contenido && Array.isArray(currentItem.contenido.sesiones)
        ? currentItem.contenido.sesiones
        : [];
      sesiones.slice(0, 4).forEach(function (sesion) {
        var actividades = Array.isArray(sesion.actividades) ? sesion.actividades : [];
        if (actividades[0]) suggestions.push(String(actividades[0]));
      });
    }

    return suggestions;
  }

  function getPlanoEvaluationCriteria() {
    var evaluacion = currentItem && currentItem.evaluacion ? currentItem.evaluacion : null;
    var base = [];

    if (evaluacion && Array.isArray(evaluacion.criterios) && evaluacion.criterios.length) {
      base = evaluacion.criterios.slice();
    } else {
      var sesiones = currentItem && currentItem.contenido && Array.isArray(currentItem.contenido.sesiones)
        ? currentItem.contenido.sesiones
        : [];
      sesiones.slice(0, 4).forEach(function (sesion) {
        var actividades = Array.isArray(sesion.actividades) ? sesion.actividades : [];
        if (actividades[0]) {
          base.push({
            numero: base.length + 1,
            criterio: String(actividades[0])
          });
        }
      });
    }

    var custom = getStoredCustomCriteria();
    custom.forEach(function (text) {
      base.push({
        numero: base.length + 1,
        criterio: text,
        excelente_4: "Excelente",
        bueno_3: "Bueno",
        satisfactorio_2: "Satisfactorio",
        necesita_mejorar_1: "Necesita mejorar"
      });
    });

    return base;
  }

  function getCurrentPlanoPdfPath() {
    if (!currentItem || !currentResourceConfig) return null;
    var clasificacion = currentItem.clasificacion || {};
    var archivo = currentItem.archivo || {};
    return buildFilePath(clasificacion, archivo, currentResourceConfig, currentItem);
  }

  function renderPdfEvaluationPane() {
    var summaryEl = document.getElementById("viz-pdf-eval-summary");
    var openPdfBtn = document.getElementById("viz-open-plano-pdf-btn");
    if (!summaryEl || !openPdfBtn) return;

    var criterios = getPlanoEvaluationCriteria();
    var evaluacion = currentItem && currentItem.evaluacion ? currentItem.evaluacion : {};
    var instrumento = evaluacion.instrumento || "Instrumento del plano";

    if (!criterios.length) {
      summaryEl.textContent = "Este plano no tiene criterios de evaluacion en la metadata. Puedes agregar criterios en la pestaña de evaluacion personalizada.";
    } else {
      summaryEl.textContent = "Instrumento: " + instrumento + ". " + criterios.length + " criterios listos para evaluar.";
    }

    var filePath = getCurrentPlanoPdfPath();
    if (filePath) {
      openPdfBtn.href = toAbsoluteUrl(filePath);
      openPdfBtn.classList.remove("disabled");
      openPdfBtn.setAttribute("aria-disabled", "false");
    } else {
      openPdfBtn.href = "#";
      openPdfBtn.classList.add("disabled");
      openPdfBtn.setAttribute("aria-disabled", "true");
    }
  }

  function getStudentsForEvaluation() {
    var students = loadStudentsDataset();
    if (!students.length) return [];

    var ctx = resolveGroupContext();
    var gradeText = ctx.grade ? String(ctx.grade) : "";

    if (!gradeText) {
      return students;
    }

    var filtered = students.filter(function (student) {
      var gradeValue = String(student.grade || student.grado || student.level || "");
      return gradeValue.indexOf(gradeText) !== -1;
    });

    // Si no hay coincidencias por grado, no bloquear la evaluacion.
    return filtered.length ? filtered : students;
  }

  function getCriterionScaleOptions(criterion) {
    var customParams = getStoredGlobalParameters();
    var options = [];

    customParams.forEach(function (param, idx) {
      options.push({ value: String(5 + idx), label: param });
    });

    options.push({ value: "4", label: "Excelente" });
    options.push({ value: "3", label: "Bueno" });
    options.push({ value: "2", label: "Satisfactorio" });
    options.push({ value: "1", label: "Necesita mejorar" });

    return options.map(function (option) {
      return {
        value: option.value,
        label: String(option.label || "").trim() || ("Nivel " + option.value)
      };
    });
  }

  function getMaxScaleValue() {
    var customParams = getStoredGlobalParameters();
    return 4 + customParams.length;
  }

  function getCriterionCode(index) {
    return "C" + (index + 1);
  }

  function normalizeCriterionParameter(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getStoredGlobalParameters() {
    if (!currentId) return [];
    var stored = safeGetJson(IA_CUSTOM_PARAMS_KEY_PREFIX + currentId);
    return Array.isArray(stored) ? stored : [];
  }

  function saveGlobalParameters(list) {
    if (!currentId) return;
    safeSetJson(IA_CUSTOM_PARAMS_KEY_PREFIX + currentId, list || []);
  }

  function getCriterionParameterOptions(criterion, index) {
    var custom = getStoredGlobalParameters();
    var merged = custom.filter(function (item) {
      return normalizeCriterionParameter(item);
    }).map(function (item) {
      return normalizeCriterionParameter(item);
    }).filter(function (item, idx, arr) {
      return arr.indexOf(item) === idx;
    });

    if (!merged.length) {
      return [{ id: "", label: "Sin parametro" }];
    }

    return merged.map(function (label, idx) {
      return {
        id: "P" + (idx + 1),
        label: label
      };
    });
  }

  function addGlobalParameter(rawValue) {
    var value = normalizeCriterionParameter(rawValue);
    if (!value) return false;

    var list = getStoredGlobalParameters().slice();
    if (list.map(function (item) { return item.toLowerCase(); }).indexOf(value.toLowerCase()) !== -1) {
      return false;
    }

    list.push(value);
    saveGlobalParameters(list);
    return true;
  }

  function getStoredCustomCriteria() {
    if (!currentId) return [];
    var stored = safeGetJson(IA_CUSTOM_CRITERIA_KEY_PREFIX + currentId);
    return Array.isArray(stored) ? stored : [];
  }

  function saveCustomCriteria(list) {
    if (!currentId) return;
    safeSetJson(IA_CUSTOM_CRITERIA_KEY_PREFIX + currentId, list || []);
  }

  function addCustomCriterion(rawText) {
    var text = normalizeCriterionParameter(rawText);
    if (!text) return false;

    var list = getStoredCustomCriteria().slice();
    if (list.map(function (item) { return item.toLowerCase(); }).indexOf(text.toLowerCase()) !== -1) {
      return false;
    }

    list.push(text);
    saveCustomCriteria(list);
    return true;
  }

  function removeCustomCriterion(index) {
    var list = getStoredCustomCriteria().slice();
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    saveCustomCriteria(list);
  }

  function removeGlobalParameter(index) {
    var list = getStoredGlobalParameters().slice();
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    saveGlobalParameters(list);
  }

  function readEvaluationDraftFromDom() {
    var draft = {};
    var cards = Array.prototype.slice.call(document.querySelectorAll(".viz-ia-student-card"));

    cards.forEach(function (card) {
      var studentId = String(card.getAttribute("data-student-id") || "");
      if (!studentId) return;
      draft[studentId] = {};

      var rows = Array.prototype.slice.call(card.querySelectorAll(".viz-ia-criterion"));
      rows.forEach(function (row) {
        var criterionIndex = String(row.getAttribute("data-criterion-index") || "");
        if (!criterionIndex) return;

        var scoreSelect = row.querySelector(".viz-ia-criterion-select");
        var noteInput = row.querySelector(".viz-ia-observation-input");

        draft[studentId][criterionIndex] = {
          score: scoreSelect ? String(scoreSelect.value || "") : "",
          observation: noteInput ? String(noteInput.value || "") : ""
        };
      });
    });

    return draft;
  }

  function applyEvaluationDraftToDom(draft) {
    if (!draft || typeof draft !== "object") return;

    var cards = Array.prototype.slice.call(document.querySelectorAll(".viz-ia-student-card"));
    cards.forEach(function (card) {
      var studentId = String(card.getAttribute("data-student-id") || "");
      if (!studentId || !draft[studentId]) return;

      var rows = Array.prototype.slice.call(card.querySelectorAll(".viz-ia-criterion"));
      rows.forEach(function (row) {
        var criterionIndex = String(row.getAttribute("data-criterion-index") || "");
        var saved = draft[studentId][criterionIndex];
        if (!saved) return;

        var scoreSelect = row.querySelector(".viz-ia-criterion-select");
        var noteInput = row.querySelector(".viz-ia-observation-input");

        if (scoreSelect && saved.score) scoreSelect.value = saved.score;
        if (noteInput && typeof saved.observation === "string") noteInput.value = saved.observation;
      });
    });
  }

  function getSavedEvaluationDraftForCurrentResource(students, criteriaCount) {
    if (!currentId || !Array.isArray(students) || !students.length) return {};

    var draft = {};
    students.forEach(function (student) {
      var evaluations = Array.isArray(student.personalizedEvaluations)
        ? student.personalizedEvaluations
        : [];
      if (!evaluations.length) return;

      var match = null;
      for (var i = evaluations.length - 1; i >= 0; i -= 1) {
        var candidate = evaluations[i];
        if (String(candidate.resourceId || "") === String(currentId)) {
          match = candidate;
          break;
        }
      }
      if (!match || !Array.isArray(match.grades)) return;

      var studentId = String(student.id || "");
      if (!studentId) return;

      draft[studentId] = {};
      match.grades.forEach(function (grade) {
        var criterionIndex = Number.isFinite(grade.criterionIndex)
          ? grade.criterionIndex
          : parseInt(String(grade.criterionCode || "").replace(/^C/i, ""), 10) - 1;

        if (!Number.isFinite(criterionIndex) || criterionIndex < 0 || criterionIndex >= criteriaCount) return;

        draft[studentId][String(criterionIndex)] = {
          score: String(grade.score || ""),
          observation: String(grade.observation || "")
        };
      });
    });

    return draft;
  }

  function renderTagsList(items, dataType) {
    if (!items.length) return '<p class="viz-ia-empty-hint">Aun no has agregado ' + (dataType === "criterion" ? "criterios" : "parametros") + '.</p>';
    return '<div class="viz-ia-tags-list">' + items.map(function (text, idx) {
      return '<span class="viz-ia-tag">' +
        '<span class="viz-ia-tag-text">' + escapeHtml(text) + '</span>' +
        '<button class="viz-ia-tag-delete" type="button" data-tag-type="' + dataType + '" data-tag-index="' + idx + '" title="Eliminar">&times;</button>' +
      '</span>';
    }).join("") + '</div>';
  }

  function renderCriterionParameterManager() {
    var storedCriteria = getStoredCustomCriteria();
    var storedParams = getStoredGlobalParameters();
    var jsonCount = getJsonCriteriaSuggestions().length;

    return [
      '<section class="viz-ia-parameter-manager">',
        '<h6 class="viz-ia-parameter-manager-title">Criterios adicionales' + (jsonCount ? ' <span style="font-weight:400;font-size:0.7rem;color:#6c7390">(' + jsonCount + ' del plano + ' + storedCriteria.length + ' adicionales)</span>' : '') + '</h6>',
        '<p class="viz-ia-parameter-manager-copy">Agrega criterios extra o escribe para buscar.</p>',
        renderTagsList(storedCriteria, "criterion"),
        '<div class="viz-ia-parameter-item-row">',
          '<div class="viz-ia-autocomplete-wrap">',
            '<input class="viz-ia-parameter-input" type="text" id="viz-ia-criterion-input" placeholder="Ej. Trabaja de forma colaborativa" autocomplete="off">',
            '<div class="viz-ia-autocomplete-list" id="viz-ia-criterion-autocomplete"></div>',
          '</div>',
          '<button class="btn btn-sm btn-outline-primary viz-ia-criterion-add" type="button">Agregar</button>',
        '</div>',
        '<h6 class="viz-ia-parameter-manager-title" style="margin-top:0.65rem">Parametros de evaluacion</h6>',
        '<p class="viz-ia-parameter-manager-copy">Agrega parametros para incluirlos en la escala de calificacion.</p>',
        renderTagsList(storedParams, "parameter"),
        '<div class="viz-ia-parameter-item-row">',
          '<div class="viz-ia-autocomplete-wrap">',
            '<input class="viz-ia-parameter-input" type="text" id="viz-ia-global-param-input" placeholder="Ej. Argumenta con evidencia" autocomplete="off">',
            '<div class="viz-ia-autocomplete-list" id="viz-ia-param-autocomplete"></div>',
          '</div>',
          '<button class="btn btn-sm btn-outline-primary viz-ia-parameter-add" type="button">Agregar</button>',
        '</div>',
      '</section>'
    ].join("");
  }

  function renderPersonalizedAiPlan() {
    var planEl = document.getElementById("viz-ia-plan");
    if (!planEl) return;

    var contenido = currentItem && currentItem.contenido ? currentItem.contenido : {};
    var criterios = getPlanoEvaluationCriteria();
    var alumnos = getStudentsForEvaluation();

    var jsonCount = getJsonCriteriaSuggestions().length;
    var customCount = getStoredCustomCriteria().length;
    var planCopy = 'Evaluacion basada en <strong>' + escapeHtml(contenido.titulo || "el plano") + '</strong>. '
      + '<strong>' + jsonCount + '</strong> criterios del plano'
      + (customCount ? ' + <strong>' + customCount + '</strong> adicionales' : '')
      + ' para <strong>' + alumnos.length + '</strong> alumnos.';

    planEl.innerHTML = [
      '<div class="viz-ia-plan-title">Evaluacion personalizada</div>',
      '<p class="viz-ia-plan-copy">' + planCopy + '</p>'
    ].join("");
  }

  function renderAiStudentEvaluationForm() {
    var studentsWrap = document.getElementById("viz-ia-students");
    if (!studentsWrap) return;

    var alumnos = getStudentsForEvaluation();
    var criterios = getPlanoEvaluationCriteria();

    if (!alumnos.length) {
      studentsWrap.innerHTML = '<div class="viz-campo-placeholder">No hay alumnos registrados para este grupo. Ve a la pantalla de alumnos y agrega al grupo primero.</div>';
      return;
    }

    var studentCards = "";
    if (criterios.length) {
      studentCards = alumnos.map(function (student) {
        return [
          '<article class="viz-ia-student-card" data-student-id="' + escapeHtml(student.id || "") + '">',
            '<h6 class="viz-ia-student-name">' + escapeHtml(student.name || "Alumno") + '</h6>',
            '<div class="viz-ia-criteria-grid">',
              criterios.map(function (criterio, index) {
                var scale = getCriterionScaleOptions(criterio);
                return [
                  '<div class="viz-ia-criterion" data-criterion-index="' + index + '">',
                    '<span class="viz-ia-criterion-label">' + getCriterionCode(index) + '. ' + escapeHtml(criterio.criterio || "Criterio") + '</span>',
                    '<select class="viz-ia-criterion-select" data-criterion-index="' + index + '">',
                      scale.map(function (option) {
                        return '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</option>';
                      }).join(""),
                    '</select>',
                    '<textarea class="viz-ia-observation-input" data-criterion-index="' + index + '" rows="2" placeholder="Observacion para ' + getCriterionCode(index) + '"></textarea>',
                  '</div>'
                ].join("");
              }).join(""),
            '</div>',
          '</article>'
        ].join("");
      }).join("");
    } else {
      studentCards = '<div class="viz-campo-placeholder">Agrega al menos un criterio de evaluacion para comenzar a evaluar.</div>';
    }

    studentsWrap.innerHTML = [
      renderCriterionParameterManager(),
      studentCards
    ].join("");

    bindAutocompleteEvents();

    if (criterios.length) {
      var savedDraft = getSavedEvaluationDraftForCurrentResource(alumnos, criterios.length);
      applyEvaluationDraftToDom(savedDraft);
    }
  }

  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    var lower = text.toLowerCase();
    var qLower = query.toLowerCase();
    var idx = lower.indexOf(qLower);
    if (idx === -1) return escapeHtml(text);
    return escapeHtml(text.substring(0, idx)) + '<mark>' + escapeHtml(text.substring(idx, idx + query.length)) + '</mark>' + escapeHtml(text.substring(idx + query.length));
  }

  function showAutocomplete(inputEl, listEl, suggestions, query) {
    if (!query || !suggestions.length) {
      listEl.classList.remove("is-open");
      listEl.innerHTML = "";
      return;
    }

    var qLower = query.toLowerCase();
    var existing = getStoredCustomCriteria().map(function (s) { return s.toLowerCase(); });
    var filtered = suggestions.filter(function (s) {
      return s.toLowerCase().indexOf(qLower) !== -1 && existing.indexOf(s.toLowerCase()) === -1;
    });

    if (!filtered.length) {
      listEl.classList.remove("is-open");
      listEl.innerHTML = "";
      return;
    }

    listEl.innerHTML = filtered.map(function (item) {
      return '<div class="viz-ia-autocomplete-item" data-value="' + escapeHtml(item) + '">' + highlightMatch(item, query) + '</div>';
    }).join("");
    listEl.classList.add("is-open");
  }

  function bindAutocompleteEvents() {
    var criterionInput = document.getElementById("viz-ia-criterion-input");
    var criterionList = document.getElementById("viz-ia-criterion-autocomplete");

    if (criterionInput && criterionList) {
      var suggestions = getJsonCriteriaSuggestions();

      criterionInput.addEventListener("input", function () {
        showAutocomplete(criterionInput, criterionList, suggestions, criterionInput.value.trim());
      });

      criterionInput.addEventListener("focus", function () {
        if (criterionInput.value.trim()) {
          showAutocomplete(criterionInput, criterionList, suggestions, criterionInput.value.trim());
        }
      });

      criterionList.addEventListener("click", function (e) {
        var item = e.target.closest(".viz-ia-autocomplete-item");
        if (!item) return;
        var value = item.getAttribute("data-value");
        if (value) {
          var draft = readEvaluationDraftFromDom();
          addCustomCriterion(value);
          criterionInput.value = "";
          criterionList.classList.remove("is-open");
          renderPersonalizedAiPlan();
          renderAiStudentEvaluationForm();
          applyEvaluationDraftToDom(draft);
        }
      });
    }
  }

  function readPersonalizedEvaluationPayload() {
    var criterios = getPlanoEvaluationCriteria();
    var cards = Array.prototype.slice.call(document.querySelectorAll(".viz-ia-student-card"));

    return cards.map(function (card) {
      var studentId = card.getAttribute("data-student-id");
      var studentName = (card.querySelector(".viz-ia-student-name") || {}).textContent || "Alumno";
      var rows = Array.prototype.slice.call(card.querySelectorAll(".viz-ia-criterion"));

      var grades = rows.map(function (row) {
        var criterionIndex = parseInt(row.getAttribute("data-criterion-index"), 10);
        var criterion = criterios[criterionIndex] || {};
        var scoreSelect = row.querySelector(".viz-ia-criterion-select");
        var noteInput = row.querySelector(".viz-ia-observation-input");
        var score = parseInt(scoreSelect ? scoreSelect.value : "0", 10);

        return {
          criterionIndex: criterionIndex,
          criterionCode: getCriterionCode(criterionIndex),
          criterion: criterion.criterio || "Criterio",
          score: Number.isFinite(score) ? score : 0,
          observation: noteInput ? String(noteInput.value || "").trim() : ""
        };
      });

      var total = grades.reduce(function (sum, item) { return sum + item.score; }, 0);
      var maxVal = getMaxScaleValue();
      var max = grades.length ? grades.length * maxVal : 0;
      var percent = max ? Math.round((total / max) * 100) : 0;

      return {
        studentId: studentId,
        studentName: studentName,
        grades: grades,
        total: total,
        max: max,
        percent: percent,
        criterios: criterios.map(function (c) {
          return { criterio: c.criterio || "", numero: c.numero || 0 };
        }),
        parametros: getStoredGlobalParameters().slice()
      };
    });
  }

  function persistPersonalizedEvaluation(payload) {
    var students = loadStudentsDataset();
    if (!students.length || !Array.isArray(payload)) return;

    var byStudent = {};
    payload.forEach(function (entry) {
      byStudent[String(entry.studentId)] = entry;
    });

    var now = Date.now();
    var updated = students.map(function (student) {
      var match = byStudent[String(student.id)];
      if (!match) return student;

      var next = Object.assign({}, student);
      var evaluations = Array.isArray(next.personalizedEvaluations)
        ? next.personalizedEvaluations.slice()
        : [];

      var savedCriterios = getPlanoEvaluationCriteria().map(function (c) {
        return { criterio: c.criterio || "", numero: c.numero || 0 };
      });
      var savedParametros = getStoredGlobalParameters().slice();

      evaluations.push({
        resourceId: currentId,
        resourceTitle: currentItem && currentItem.contenido ? (currentItem.contenido.titulo || "Plano") : "Plano",
        updatedAt: now,
        total: match.total,
        max: match.max,
        percent: match.percent,
        grades: match.grades,
        criterios: savedCriterios,
        parametros: savedParametros
      });

      next.personalizedEvaluations = evaluations.slice(-30);
      return next;
    });

    saveStudentsDataset(updated);
  }

  function escapeHtmlForDocument(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function buildEvaluationReportHtml(payload) {
    var contenido = currentItem && currentItem.contenido ? currentItem.contenido : {};
    var evaluacion = currentItem && currentItem.evaluacion ? currentItem.evaluacion : {};
    var instrumentName = String(evaluacion.instrumento || "");
    var isRubricInstrument = /rubrica/i.test(instrumentName);
    var isChecklistInstrument = /lista de cotejo|autoevaluacion|preguntas de autoevaluacion/i.test(instrumentName);
    var ctx = resolveGroupContext();
    var nowLabel = new Date().toLocaleString("es-MX");
    var criterios = getPlanoEvaluationCriteria();
    var avgPercent = payload.length
      ? Math.round(payload.reduce(function (sum, row) { return sum + row.percent; }, 0) / payload.length)
      : 0;
    var avgCompletion = payload.length
      ? Math.round(payload.reduce(function (sum, row) {
          var achieved = row.grades.reduce(function (count, item) {
            return count + (Number(item.score) >= 3 ? 1 : 0);
          }, 0);
          var completion = row.grades.length ? Math.round((achieved / row.grades.length) * 100) : 0;
          return sum + completion;
        }, 0) / payload.length)
      : 0;

    var scaleOptionsMap = {};
    getCriterionScaleOptions({}).forEach(function (opt) {
      scaleOptionsMap[opt.value] = opt.label;
    });

    function getScoreLabel(score) {
      var key = String(score);
      return scaleOptionsMap[key] || key;
    }

    function getChecklistScoreLabel(score) {
      var value = Number(score);
      if (value >= 4) return "Cumple";
      if (value >= 3) return "Parcial";
      if (value >= 2) return "En proceso";
      if (value >= 1) return "Requiere apoyo";
      return "-";
    }

    return [
      '<!doctype html>',
      '<html lang="es">',
      '<head>',
        '<meta charset="utf-8">',
        '<title>Evaluacion personalizada</title>',
        '<style>',
          'body{font-family:Arial,sans-serif;margin:0;background:#f2f4fb;color:#1d2338;}',
          '.sheet{max-width:980px;margin:24px auto;background:#fff;border-radius:18px;padding:26px 30px;box-shadow:0 18px 45px rgba(26,35,68,.15);}',
          '.hero{padding:18px;border-radius:14px;color:#fff;margin-bottom:18px;}',
          '.hero--rubric{background:linear-gradient(135deg,#103f91,#2f7ad3);}',
          '.hero--checklist{background:linear-gradient(135deg,#1f5f43,#2f8b62);}',
          '.hero h1{margin:0 0 6px;font-size:24px;line-height:1.2;}',
          '.hero p{margin:0;font-size:14px;opacity:.92;}',
          '.meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 20px;}',
          '.meta-item{background:#f7f9ff;border:1px solid #dde5fb;border-radius:10px;padding:10px;}',
          '.meta-item strong{display:block;font-size:11px;color:#64719a;text-transform:uppercase;margin-bottom:4px;}',
          '.meta-item span{font-size:13px;font-weight:700;color:#223056;}',
          'table{width:100%;border-collapse:collapse;font-size:12px;}',
          'th,td{border:1px solid #dfe6fb;padding:8px;vertical-align:top;}',
          'th{background:#eef3ff;text-align:left;color:#2a3c66;font-size:11px;text-transform:uppercase;}',
          '.pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#eaf6ee;border:1px solid #cae8d4;color:#1f6e3a;font-weight:700;font-size:11px;}',
          '.block{margin-top:16px;}',
          '.block h3{margin:0 0 8px;font-size:14px;color:#20345e;}',
          '.glossary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}',
          '.glossary-item{border:1px solid #dbe5fb;border-radius:10px;background:#f8fbff;padding:8px;}',
          '.glossary-item strong{display:block;font-size:12px;color:#1f4a86;margin-bottom:4px;}',
          '.glossary-item p{margin:0;font-size:11px;color:#455780;line-height:1.45;}',
          '.scale-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;}',
          '.scale-table th,.scale-table td{border:1px solid #dfe6fb;padding:5px 7px;text-align:left;}',
          '.scale-table th{background:#f0f5ff;color:#2a3c66;font-size:10px;}',
          '.obs-card{border:1px solid #dde7fb;border-radius:10px;padding:10px;margin-bottom:8px;background:#fcfdff;}',
          '.obs-card h4{margin:0 0 7px;font-size:12px;color:#22335d;}',
          '.obs-row{margin:0 0 5px;font-size:11px;color:#3c4e77;line-height:1.45;}',
          '.foot{margin-top:16px;font-size:12px;color:#4a587f;}',
          '@media print{body{background:#fff}.sheet{margin:0;box-shadow:none;border-radius:0}.meta{grid-template-columns:repeat(2,minmax(0,1fr));}.glossary{grid-template-columns:1fr;}}',
        '</style>',
      '</head>',
      '<body>',
        '<div class="sheet">',
          '<section class="hero ' + (isRubricInstrument ? 'hero--rubric' : 'hero--checklist') + '">',
            '<h1>' + (isRubricInstrument ? 'Reporte de rubrica del grupo' : 'Reporte de lista de cotejo/autoevaluacion') + '</h1>',
            '<p>' + escapeHtmlForDocument(contenido.titulo || "Plano didactico") + '</p>',
          '</section>',
          '<section class="meta">',
            '<div class="meta-item"><strong>Fecha</strong><span>' + escapeHtmlForDocument(nowLabel) + '</span></div>',
            '<div class="meta-item"><strong>Fase</strong><span>' + escapeHtmlForDocument(String(ctx.phase || "-")) + '</span></div>',
            '<div class="meta-item"><strong>Grado / Grupo</strong><span>' + escapeHtmlForDocument(String(ctx.grade || "-") + " / " + String(ctx.group || "A")) + '</span></div>',
            '<div class="meta-item"><strong>' + (isRubricInstrument ? 'Promedio grupal' : 'Cumplimiento grupal') + '</strong><span>' + escapeHtmlForDocument(String(isRubricInstrument ? avgPercent : avgCompletion) + "%") + '</span></div>',
          '</section>',
          '<section>',
            '<p><span class="pill">Instrumento: ' + escapeHtmlForDocument(evaluacion.instrumento || "Personalizado IA") + '</span></p>',
            '<table>',
              '<thead>',
                '<tr>',
                  '<th>Alumno</th>',
                  criterios.map(function (_, index) { return '<th>' + getCriterionCode(index) + '</th>'; }).join(""),
                  '<th>' + (isRubricInstrument ? 'Resultado' : 'Cumplimiento') + '</th>',
                '</tr>',
              '</thead>',
              '<tbody>',
                payload.map(function (row) {
                  var criteriaCells = row.grades.map(function (g) {
                    if (isRubricInstrument) {
                      return '<td>' + escapeHtmlForDocument(getScoreLabel(g.score)) + '</td>';
                    }
                    return '<td>' + escapeHtmlForDocument(getChecklistScoreLabel(g.score)) + '</td>';
                  }).join("");
                  if (isRubricInstrument) {
                    return '<tr><td>' + escapeHtmlForDocument(row.studentName) + '</td>' + criteriaCells + '<td><strong>' + escapeHtmlForDocument(String(row.percent) + '%') + '</strong></td></tr>';
                  }
                  var achievedCount = row.grades.reduce(function (count, item) {
                    return count + (Number(item.score) >= 3 ? 1 : 0);
                  }, 0);
                  return '<tr><td>' + escapeHtmlForDocument(row.studentName) + '</td>' + criteriaCells + '<td><strong>' + escapeHtmlForDocument(String(achievedCount) + '/' + String(row.grades.length) + ' criterios') + '</strong></td></tr>';
                }).join(""),
              '</tbody>',
            '</table>',
          '</section>',
          '<section class="block">',
            '<h3>Glosario de criterios</h3>',
            '<div class="glossary">',
              criterios.map(function (criterio, index) {
                return '<div class="glossary-item"><strong>' + getCriterionCode(index) + '</strong><p>' + escapeHtmlForDocument(criterio.criterio || "Criterio") + '</p></div>';
              }).join(""),
            '</div>',
          '</section>',
          (isRubricInstrument ? [
            '<section class="block">',
              '<h3>Glosario de parametros de calificacion</h3>',
              '<div class="glossary">',
                getCriterionScaleOptions({}).map(function (item) {
                  return '<div class="glossary-item"><strong>' + escapeHtmlForDocument(item.value) + '</strong><p>' + escapeHtmlForDocument(item.label) + '</p></div>';
                }).join(""),
              '</div>',
            '</section>'
          ].join("") : (isChecklistInstrument ? [
            '<section class="block">',
              '<h3>Escala de cumplimiento</h3>',
              '<div class="glossary">',
                '<div class="glossary-item"><strong>Cumple</strong><p>Logra el criterio de forma consistente.</p></div>',
                '<div class="glossary-item"><strong>Parcial</strong><p>Logra el criterio con apoyo o de forma intermitente.</p></div>',
                '<div class="glossary-item"><strong>En proceso</strong><p>Muestra avances iniciales en el criterio.</p></div>',
                '<div class="glossary-item"><strong>Requiere apoyo</strong><p>Necesita acompanamiento para lograr el criterio.</p></div>',
              '</div>',
            '</section>'
          ].join("") : "")),
          '<section class="block">',
            '<h3>Observaciones por alumno</h3>',
            payload.map(function (row) {
              return [
                '<article class="obs-card">',
                  '<h4>' + escapeHtmlForDocument(row.studentName) + ' (' + escapeHtmlForDocument(String(row.percent) + '%') + ')</h4>',
                  row.grades.map(function (g) {
                    var observation = g.observation || "";
                    if (!observation) return '';
                    var parts = ['<strong>' + escapeHtmlForDocument(g.criterionCode || "C") + '</strong>'];
                    if (observation) parts.push('<strong>Observacion:</strong> ' + escapeHtmlForDocument(observation));
                    return '<p class="obs-row">' + parts.join(' | ') + '</p>';
                  }).join(""),
                '</article>'
              ].join("");
            }).join(""),
          '</section>',
          '<p class="foot">Reporte generado desde el visualizador inteligente. Usa "Guardar como PDF" en el dialogo de impresion.</p>',
        '</div>',
      '</body>',
      '</html>'
    ].join("");
  }

  function generatePersonalizedEvaluationPdf() {
    var payload = readPersonalizedEvaluationPayload();
    if (!payload.length) {
      setInstrumentOpenFeedback("No hay evaluaciones por alumno para exportar.", true);
      return;
    }

    persistPersonalizedEvaluation(payload);
    persistExperienceToGroupAndStudents("en-curso");

    var reportHtml = buildEvaluationReportHtml(payload);
    var reportWindow = window.open("", "_blank", "width=1200,height=850");
    if (!reportWindow) {
      setInstrumentOpenFeedback("Tu navegador bloqueo la ventana del reporte. Habilita popups para generar el PDF.", true);
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(reportHtml);
    reportWindow.document.close();
    reportWindow.focus();
    setTimeout(function () {
      reportWindow.print();
    }, 240);

    setInstrumentOpenFeedback("Reporte listo. Se abrio la impresion para guardar el PDF.", false);
  }

  function switchEvaluationPane(pane) {
    var optionButtons = document.querySelectorAll(".viz-eval-option");
    var panes = document.querySelectorAll(".viz-eval-pane");

    optionButtons.forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-eval-pane") === pane);
    });

    panes.forEach(function (section) {
      section.classList.toggle("is-active", section.getAttribute("data-pane") === pane);
    });
  }

  function refreshEvaluationModalContent() {
    renderPdfEvaluationPane();
    renderPersonalizedAiPlan();
    renderAiStudentEvaluationForm();
  }

  function initInstrumentsModal() {
    var openBtn = document.getElementById("viz-open-instruments-btn");
    var modalEl = document.getElementById("viz-instrumentos-modal");
    var optionButtons = document.querySelectorAll(".viz-eval-option");
    var generatePdfBtn = document.getElementById("viz-generate-eval-pdf-btn");
    if (!openBtn || !modalEl || !window.bootstrap || !bootstrap.Modal) return;

    instrumentsModalInstance = new bootstrap.Modal(modalEl);

    openBtn.addEventListener("click", function () {
      if (openBtn.disabled) return;
      refreshEvaluationModalContent();
      switchEvaluationPane("pdf");
      instrumentsModalInstance.show();
    });

    optionButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var pane = button.getAttribute("data-eval-pane");
        switchEvaluationPane(pane);
      });
    });

    modalEl.addEventListener("click", function (event) {
      var target = event.target;

      var tagDelete = target && target.closest ? target.closest(".viz-ia-tag-delete") : null;
      if (tagDelete) {
        var tagType = tagDelete.getAttribute("data-tag-type");
        var tagIndex = parseInt(tagDelete.getAttribute("data-tag-index"), 10);
        if (!Number.isFinite(tagIndex)) return;

        var draft = readEvaluationDraftFromDom();
        if (tagType === "criterion") {
          removeCustomCriterion(tagIndex);
        } else if (tagType === "parameter") {
          removeGlobalParameter(tagIndex);
        }
        renderPersonalizedAiPlan();
        renderAiStudentEvaluationForm();
        applyEvaluationDraftToDom(draft);
        setInstrumentOpenFeedback(tagType === "criterion" ? "Criterio eliminado." : "Parametro eliminado.", false);
        return;
      }

      var trigger = target && target.closest ? target.closest(".viz-ia-parameter-add, .viz-ia-criterion-add") : null;
      if (!trigger) return;

      var isCriterion = trigger.classList.contains("viz-ia-criterion-add");

      if (isCriterion) {
        var inputEl = modalEl.querySelector("#viz-ia-criterion-input");
        if (!inputEl) return;
        var val = String(inputEl.value || "").trim();
        if (!val) {
          setInstrumentOpenFeedback("Escribe el texto del criterio antes de agregar.", true);
          return;
        }
        var draft2 = readEvaluationDraftFromDom();
        var created = addCustomCriterion(val);
        if (!created) {
          setInstrumentOpenFeedback("Ese criterio ya existe.", true);
          return;
        }
        inputEl.value = "";
        renderPersonalizedAiPlan();
        renderAiStudentEvaluationForm();
        applyEvaluationDraftToDom(draft2);
        setInstrumentOpenFeedback("Criterio agregado.", false);
        return;
      }

      var input = modalEl.querySelector("#viz-ia-global-param-input");
      if (!input) return;

      var value = String(input.value || "").trim();
      if (!value) {
        setInstrumentOpenFeedback("Escribe un parametro antes de agregarlo.", true);
        return;
      }

      var draft3 = readEvaluationDraftFromDom();
      var created2 = addGlobalParameter(value);
      if (!created2) {
        setInstrumentOpenFeedback("Ese parametro ya existe.", true);
        return;
      }

      input.value = "";
      renderAiStudentEvaluationForm();
      applyEvaluationDraftToDom(draft3);
      setInstrumentOpenFeedback("Parametro agregado.", false);
    });

    var saveEvalBtn = document.getElementById("viz-save-eval-btn");
    if (saveEvalBtn) {
      saveEvalBtn.addEventListener("click", function () {
        var criterios = getPlanoEvaluationCriteria();
        if (!criterios.length) {
          setInstrumentOpenFeedback("Agrega al menos un criterio antes de guardar.", true);
          return;
        }
        var payload = readPersonalizedEvaluationPayload();
        if (!payload.length) {
          setInstrumentOpenFeedback("No hay datos de evaluacion para guardar.", true);
          return;
        }
        persistPersonalizedEvaluation(payload);
        setInstrumentOpenFeedback("Evaluacion guardada correctamente.", false);
      });
    }

    if (generatePdfBtn) {
      generatePdfBtn.addEventListener("click", function () {
        generatePersonalizedEvaluationPdf();
      });
    }

    document.addEventListener("click", function (e) {
      var autocompletes = document.querySelectorAll(".viz-ia-autocomplete-list.is-open");
      autocompletes.forEach(function (list) {
        if (!list.contains(e.target) && e.target !== document.getElementById("viz-ia-criterion-input")) {
          list.classList.remove("is-open");
        }
      });
    });

    document.addEventListener("click", handleOpenInstrumentClick);
  }

  function initActivitiesModal() {
    var openBtn = document.getElementById("viz-open-activities-btn");
    var modalEl = document.getElementById("viz-activities-modal");
    if (!openBtn || !modalEl || !window.bootstrap || !bootstrap.Modal) return;

    activitiesModalInstance = new bootstrap.Modal(modalEl);

    openBtn.addEventListener("click", function () {
      if (openBtn.disabled) return;
      activitiesModalInstance.show();
    });

    modalEl.addEventListener("shown.bs.modal", function () {
      syncActivitiesInteractivity();
    });
  }

  function typeAiOutput(text) {
    var outputEl = document.getElementById("viz-meta-ai-recomendaciones");
    if (!outputEl) return;

    if (aiTypingTimer) {
      clearInterval(aiTypingTimer);
      aiTypingTimer = null;
    }

    var pointer = 0;
    outputEl.textContent = "";
    outputEl.classList.add("is-typing");

    aiTypingTimer = setInterval(function () {
      pointer += 3;
      outputEl.textContent = text.slice(0, pointer);

      if (pointer >= text.length) {
        clearInterval(aiTypingTimer);
        aiTypingTimer = null;
        outputEl.classList.remove("is-typing");
      }
    }, 14);
  }

  function updateEvaluationRecommendations(forceRefresh) {
    if (!currentItem || !currentId) return Promise.resolve();
      if (isMaterialDocente(currentResourceConfig)) return Promise.resolve();

    var cached = !forceRefresh ? safeGet(INSTRUMENT_RECOMMENDATIONS_KEY_PREFIX + currentId) : null;
    var cachedData = !forceRefresh ? safeGetJson(INSTRUMENT_RECOMMENDATIONS_DATA_KEY_PREFIX + currentId) : null;

    if (cached && cachedData) {
      instrumentRecommendationsPending = false;
      currentInstrumentRecommendations = cachedData;
      renderInstrumentCard(cachedData);
      return Promise.resolve(cached);
    }

    instrumentRecommendationsPending = true;
    currentInstrumentRecommendations = [];
    setInstrumentGenerationState(true, forceRefresh
      ? "La IA esta actualizando la recomendacion de instrumentos..."
      : "La IA esta generando la recomendacion de instrumentos...");

    return loadInstrumentCatalog().then(function (instruments) {
      var ranked = buildInstrumentRecommendations(currentItem, instruments);
      var text = buildInstrumentRecommendationsText(currentItem, ranked);
      instrumentRecommendationsPending = false;
      currentInstrumentRecommendations = ranked;

      if (currentId) {
        safeSet(INSTRUMENT_RECOMMENDATIONS_KEY_PREFIX + currentId, text);
        safeSetJson(INSTRUMENT_RECOMMENDATIONS_DATA_KEY_PREFIX + currentId, ranked);
      }

      renderInstrumentCard(ranked);
      return text;
    }).catch(function () {
      instrumentRecommendationsPending = false;
      renderInstrumentCard([]);
      return "No se pudieron calcular sugerencias de instrumentos en este momento.";
    });
  }

  function buildDiscoveryLines(descubrimiento) {
    if (!descubrimiento || typeof descubrimiento !== "object") return [];

    var lines = [];
    Object.keys(descubrimiento).forEach(function (sectionKey) {
      var items = descubrimiento[sectionKey];
      if (!Array.isArray(items)) return;

      items.forEach(function (item) {
        if (!item || !item.titulo) return;
        var icono = item.icono || "✨";
        var titulo = item.titulo;
        lines.push(icono + " " + titulo + " (" + titleCaseKey(sectionKey) + ")");
      });
    });

    return lines;
  }

  function titleCaseKey(key) {
    return String(key || "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); });
  }

  function joinTop(arr, max) {
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr
      .filter(function (v) { return !!v; })
      .slice(0, max)
      .join(", ");
  }

  function set(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function startAiTyping() {
    var outputEl = document.getElementById("viz-meta-ai-recomendaciones");
    var statusEl = document.getElementById("viz-ai-status");
    var buttonEl = document.getElementById("viz-ai-generate-btn");
    if (!outputEl || !statusEl || !buttonEl) return;
    if (!smartActive) return;

    if (aiTypingTimer) {
      clearInterval(aiTypingTimer);
      aiTypingTimer = null;
    }

      var text = isMaterialDocente(currentResourceConfig)
        ? buildAiNarrativeMaterialDocente(currentItem)
        : buildAiNarrative(currentEnrichment || {});
    var pointer = 0;

    buttonEl.disabled = true;
    statusEl.textContent = "Generando...";
    outputEl.textContent = "";
    outputEl.classList.add("is-typing");

    aiTypingTimer = setInterval(function () {
      pointer += 2;
      outputEl.textContent = text.slice(0, pointer);

      if (pointer >= text.length) {
        clearInterval(aiTypingTimer);
        aiTypingTimer = null;
        outputEl.classList.remove("is-typing");
        buttonEl.disabled = !smartActive;
        statusEl.textContent = "Recomendaciones listas";
        if (currentId) {
          safeSet(AI_RECOMMENDATIONS_KEY_PREFIX + currentId, text);
        }
      }
    }, 18);
  }

  function escapeHtml(v) {
    return String(v || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // --- Modo inteligente ---
  function setSmartMode(active) {
    smartActive = active;
    var btn = document.getElementById("viz-smart-toggle");
    var hint = document.getElementById("viz-smart-hint");
    var cards = document.querySelectorAll(".viz-smart-card");
    var aiGenerateBtn = document.getElementById("viz-ai-generate-btn");
    var aiStatus = document.getElementById("viz-ai-status");

    if (btn) {
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("is-active", active);
      btn.querySelector(".viz-smart-toggle-label").textContent = active
        ? "Modo inteligente activo"
        : "Activar modo inteligente";
    }

    if (hint) hint.classList.toggle("viz-hint-hidden", active);

    cards.forEach(function (card) {
      card.classList.toggle("viz-locked", !active);
      card.querySelectorAll("button, textarea, input").forEach(function (el) {
        el.disabled = !active;
      });
    });

    if (!active && aiTypingTimer) {
      clearInterval(aiTypingTimer);
      aiTypingTimer = null;
      var outputEl = document.getElementById("viz-meta-ai-recomendaciones");
      if (outputEl) outputEl.classList.remove("is-typing");
    }

    if (aiGenerateBtn) {
      aiGenerateBtn.disabled = !active;
    }

    if (aiStatus) {
      if (!active) {
        aiStatus.textContent = "Activa el modo inteligente";
      } else {
        var savedRecommendations = currentId ? safeGet(AI_RECOMMENDATIONS_KEY_PREFIX + currentId) : null;
        aiStatus.textContent = savedRecommendations && savedRecommendations.indexOf("Instrumentos sugeridos para ") !== 0
          ? "Recomendaciones listas"
          : "Listo para generar";
      }
    }

    syncActivitiesInteractivity();

    if (active && currentId) {
      restoreState();
      syncHomeActiveExperience(buildExperienceSnapshot("en-curso"));
    }

    if (currentId) {
      try {
        localStorage.setItem(SMART_MODE_KEY_PREFIX + currentId, active ? "1" : "0");
      } catch (_) {}
    }
  }

  function createDefaultActivity() {
    return {
      name: "",
      progress: "",
      done: false,
      sessionOrder: getDefaultSessionOrder()
    };
  }

  function createActivitiesFromItem(item) {
    var sesiones = item && item.contenido && Array.isArray(item.contenido.sesiones)
      ? item.contenido.sesiones
      : [];

    if (!sesiones.length) {
      return [createDefaultActivity()];
    }

    var activities = [];

    sesiones.forEach(function (sesion, index) {
      var sessionNumber = parseInt(sesion && sesion.numero_sesion, 10);
      var sessionOrder = Number.isFinite(sessionNumber) ? sessionNumber : (index + 1);
      var sessionActivities = Array.isArray(sesion && sesion.actividades) ? sesion.actividades : [];

      sessionActivities.forEach(function (activityText) {
        activities.push({
          name: String(activityText || ""),
          progress: "",
          done: false,
          sessionOrder: sessionOrder
        });
      });
    });

    return activities.length ? activities : [createDefaultActivity()];
  }

  function getSessionOptionsFromItem(item) {
    var sesiones = item && item.contenido && Array.isArray(item.contenido.sesiones)
      ? item.contenido.sesiones
      : [];

    if (sesiones.length) {
      return sesiones.map(function (sesion, index) {
        var parsedOrder = parseInt(sesion && sesion.numero_sesion, 10);
        var order = Number.isFinite(parsedOrder) ? parsedOrder : (index + 1);
        var title = String(sesion && sesion.titulo ? sesion.titulo : ("Sesion " + order));

        return {
          order: order,
          name: title
        };
      }).sort(function (a, b) {
        return a.order - b.order;
      });
    }

    var momentos = item && item.contenido && Array.isArray(item.contenido.momentos_metodologicos)
      ? item.contenido.momentos_metodologicos
      : [];

    var options = momentos.map(function (momento, index) {
      var parsedOrder = parseInt(momento && momento.orden, 10);
      var order = Number.isFinite(parsedOrder) ? parsedOrder : (index + 1);
      return {
        order: order,
        name: String(momento && momento.nombre ? momento.nombre : ("Sesion " + order))
      };
    });

    options.sort(function (a, b) { return a.order - b.order; });
    return options;
  }

  function getDefaultSessionOrder() {
    if (!Array.isArray(currentSessionOptions) || !currentSessionOptions.length) return null;
    return currentSessionOptions[0].order;
  }

  function getCurrentSessionOrder() {
    var defaultOrder = getDefaultSessionOrder();
    if (!currentId) return defaultOrder;

    var raw = safeGet(CURRENT_SESSION_KEY_PREFIX + currentId);
    var parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return defaultOrder;

    var isValid = (currentSessionOptions || []).some(function (option) {
      return option.order === parsed;
    });

    return isValid ? parsed : defaultOrder;
  }

  function setCurrentSessionOrder(order) {
    if (!currentId) return;
    var parsed = parseInt(order, 10);
    if (!Number.isFinite(parsed)) return;
    safeSet(CURRENT_SESSION_KEY_PREFIX + currentId, String(parsed));
  }

  function getSessionLabel(sessionOrder) {
    var order = parseInt(sessionOrder, 10);
    var found = (currentSessionOptions || []).find(function (option) {
      return option.order === order;
    });

    if (!found) return "Sin sesion";
    return "Sesion " + found.order + ": " + found.name;
  }

  function buildSessionOptionsHtml(selectedOrder) {
    var order = parseInt(selectedOrder, 10);
    if (!Array.isArray(currentSessionOptions) || !currentSessionOptions.length) {
      return '<option value="">Sin sesiones detectadas</option>';
    }

    return currentSessionOptions.map(function (option) {
      return '<option value="' + option.order + '"' + (option.order === order ? ' selected' : '') + '>' +
        escapeHtml('Sesion ' + option.order + ' - ' + option.name) +
      '</option>';
    }).join('');
  }

  function normalizeActivities(rawActivities) {
    if (!Array.isArray(rawActivities) || !rawActivities.length) {
      return [createDefaultActivity()];
    }

    var validSessionOrders = (currentSessionOptions || []).map(function (option) {
      return option.order;
    });
    var defaultSessionOrder = getDefaultSessionOrder();

    var normalized = rawActivities.map(function (activity) {
      var parsedOrder = parseInt(activity && activity.sessionOrder, 10);
      var resolvedOrder = Number.isFinite(parsedOrder) ? parsedOrder : defaultSessionOrder;

      if (validSessionOrders.length && validSessionOrders.indexOf(resolvedOrder) === -1) {
        resolvedOrder = defaultSessionOrder;
      }

      return {
        name: String(activity && activity.name ? activity.name : ""),
        progress: String(activity && activity.progress ? activity.progress : ""),
        done: !!(activity && activity.done),
        sessionOrder: resolvedOrder
      };
    });

    return normalized.length ? normalized : [createDefaultActivity()];
  }

  function syncActivitiesInteractivity() {
    var modal = document.getElementById("viz-activities-modal");
    if (!modal) return;

    modal.querySelectorAll("button, textarea, input").forEach(function (el) {
      el.disabled = !smartActive;
    });

    var openBtn = document.getElementById("viz-open-activities-btn");
    if (openBtn) openBtn.disabled = !smartActive;
  }

  function updateActivitiesSummary(allActivities) {
    var summaryEl = document.getElementById("viz-activities-card-resume");
    if (!summaryEl) return;

    var safeActivities = normalizeActivities(allActivities);
    var currentSessionOrder = getCurrentSessionOrder();
    var sessionActivities = safeActivities.filter(function (activity) {
      return parseInt(activity.sessionOrder, 10) === currentSessionOrder;
    });

    var doneCount = sessionActivities.filter(function (activity) { return activity.done; }).length;
    var labelActivities = sessionActivities.length === 1 ? "actividad" : "actividades";
    var labelDone = doneCount === 1 ? "terminada" : "terminadas";

    summaryEl.textContent = "Sesion " + currentSessionOrder + " · " + sessionActivities.length + " " + labelActivities + " · " + doneCount + " " + labelDone;
    updateTrackingStatusText(safeActivities);
  }

  function formatHistoryDate(timestamp) {
    var date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return "Fecha desconocida";
    return date.toLocaleString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getHistoryEntryKey(activityIndex, sessionOrder) {
    return String(activityIndex) + "|" + String(sessionOrder);
  }

  function normalizeHistoryEntries(rawHistory) {
    if (!Array.isArray(rawHistory) || !rawHistory.length) return [];

    // Compatibilidad con formato anterior por eventos: conserva solo los palomeos activos.
    var hasLegacyEvents = rawHistory.some(function (entry) {
      return Object.prototype.hasOwnProperty.call(entry || {}, "nextDone");
    });

    if (hasLegacyEvents) {
      var byKey = {};
      rawHistory.slice().sort(function (a, b) {
        return (a && a.timestamp ? a.timestamp : 0) - (b && b.timestamp ? b.timestamp : 0);
      }).forEach(function (entry) {
        var activityIndex = parseInt(entry && entry.activityIndex, 10);
        var sessionOrder = parseInt(entry && entry.sessionOrder, 10) || getDefaultSessionOrder();
        if (!Number.isFinite(activityIndex)) return;

        var key = getHistoryEntryKey(activityIndex, sessionOrder);
        if (entry && entry.nextDone) {
          byKey[key] = {
            id: entry.id || (String(Date.now()) + "_" + key),
            key: key,
            timestamp: entry.timestamp || Date.now(),
            activityIndex: activityIndex,
            sessionOrder: sessionOrder,
            activityName: String(entry.activityName || ("Actividad " + (activityIndex + 1))),
            done: true
          };
        } else {
          delete byKey[key];
        }
      });

      return Object.keys(byKey).map(function (key) { return byKey[key]; });
    }

    return rawHistory.filter(function (entry) {
      return entry && entry.done;
    }).map(function (entry) {
      var activityIndex = parseInt(entry.activityIndex, 10);
      var sessionOrder = parseInt(entry.sessionOrder, 10) || getDefaultSessionOrder();
      var key = getHistoryEntryKey(activityIndex, sessionOrder);
      return {
        id: entry.id || (String(Date.now()) + "_" + key),
        key: key,
        timestamp: entry.timestamp || Date.now(),
        activityIndex: activityIndex,
        sessionOrder: sessionOrder,
        activityName: String(entry.activityName || ("Actividad " + (activityIndex + 1))),
        done: true
      };
    }).filter(function (entry) {
      return Number.isFinite(entry.activityIndex);
    });
  }

  function getActivitiesHistory() {
    if (!currentId) return [];
    var raw = safeGetJson(ACTIVITIES_HISTORY_KEY_PREFIX + currentId);
    return normalizeHistoryEntries(raw);
  }

  function setActivitiesHistory(history) {
    if (!currentId) return;
    var safeHistory = normalizeHistoryEntries(history).slice(-250);
    safeSetJson(ACTIVITIES_HISTORY_KEY_PREFIX + currentId, safeHistory);
  }

  function syncActivitiesHistory(beforeActivities, afterActivities) {
    if (!currentId) return;

    var before = normalizeActivities(beforeActivities);
    var after = normalizeActivities(afterActivities);
    var history = getActivitiesHistory();
    var byKey = {};

    history.forEach(function (entry) {
      if (!entry || !entry.key) return;
      byKey[entry.key] = entry;
    });

    var now = Date.now();

    for (var i = 0; i < after.length; i++) {
      var prev = before[i] || {};
      var next = after[i] || {};
      var prevDone = !!prev.done;
      var nextDone = !!next.done;
      if (prevDone === nextDone) continue;

      var sessionOrder = parseInt(next.sessionOrder, 10) || parseInt(prev.sessionOrder, 10) || getDefaultSessionOrder();
      var key = getHistoryEntryKey(i, sessionOrder);

      if (nextDone) {
        byKey[key] = {
          id: key + "_" + now,
          key: key,
          timestamp: now,
          activityIndex: i,
          sessionOrder: sessionOrder,
          activityName: String(next.name || prev.name || ("Actividad " + (i + 1))),
          done: true
        };
      } else {
        // Al despalomear eliminamos su registro para evitar historial basura.
        delete byKey[key];
      }
    }

    setActivitiesHistory(Object.keys(byKey).map(function (key) {
      return byKey[key];
    }));
  }

  function isProgressManualOverride() {
    if (!currentId) return false;
    return safeGet(PROGRESS_MANUAL_KEY_PREFIX + currentId) === "1";
  }

  function setProgressManualOverride(isManual) {
    if (!currentId) return;
    safeSet(PROGRESS_MANUAL_KEY_PREFIX + currentId, isManual ? "1" : "0");
  }

  function updateProgressFromActivities(activities, force) {
    if (!currentId || !smartActive) return;
    if (!force && isProgressManualOverride()) return;

    var safeActivities = normalizeActivities(activities);
    var doneCount = safeActivities.filter(function (activity) { return !!activity.done; }).length;
    var total = safeActivities.length;
    var pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    var range = document.getElementById("viz-progress-range");
    if (range) {
      range.value = pct;
      updateProgressUI(pct);
    }

    safeSet(PROGRESS_KEY_PREFIX + currentId, String(pct));
  }

  function updateTrackingStatusText(allActivities) {
    var statusEl = document.getElementById("viz-status-text");
    if (!statusEl) return;

    if (!smartActive) {
      statusEl.textContent = "Activa el modo inteligente para ver el estado de la clase.";
      return;
    }

    var safeActivities = normalizeActivities(allActivities || currentActivitiesCache);
    var doneCount = safeActivities.filter(function (activity) { return !!activity.done; }).length;
    var total = safeActivities.length;
    var progressValue = parseInt((document.getElementById("viz-progress-range") || {}).value || "0", 10);
    var pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    var explicitStatus = currentId ? safeGet(STATUS_KEY_PREFIX + currentId) : null;
    var startBtn = document.getElementById("viz-start-experience-btn");

    if (pct === 100) {
      if (currentId) safeSet(STATUS_KEY_PREFIX + currentId, "completado");
      if (startBtn) startBtn.textContent = "Experiencia completada";
      statusEl.textContent = "Clase completada. Todas las actividades estan palomeadas.";
      if (currentId && smartActive) {
        persistExperienceToGroupAndStudents("completado");
      }
      return;
    }

    if (explicitStatus === "en-curso" || pct > 0 || progressValue > 0) {
      if (startBtn) startBtn.textContent = "Experiencia en curso";
      statusEl.textContent = "Clase en avance: " + doneCount + " de " + total + " actividades completadas.";
      if (currentId && smartActive) {
        persistExperienceToGroupAndStudents("en-curso");
      }
      return;
    }

    if (startBtn) startBtn.textContent = "Iniciar experiencia";
    statusEl.textContent = "Clase pendiente por iniciar.";
    if (currentId && smartActive) {
      persistExperienceToGroupAndStudents("pendiente");
    }
  }

  function renderActivitiesHistory() {
    var list = document.getElementById("viz-activities-history-list");
    if (!list) return;

    var history = getActivitiesHistory();
    if (!history.length) {
      list.innerHTML = '<li class="viz-history-empty">Aun no hay movimientos registrados.</li>';
      return;
    }

    var sorted = history.slice().sort(function (a, b) {
      return (b.timestamp || 0) - (a.timestamp || 0);
    }).slice(0, 40);

    list.innerHTML = sorted.map(function (entry) {
      var session = Number.isFinite(parseInt(entry.sessionOrder, 10))
        ? ("Sesion " + parseInt(entry.sessionOrder, 10))
        : "Sesion";

      return [
        '<li class="viz-history-item">',
          '<div class="viz-history-main">',
            '<div class="viz-history-title">' + escapeHtml('Palomeada: ' + (entry.activityName || 'Actividad')) + '</div>',
            '<div class="viz-history-meta">' + escapeHtml(session + ' · ' + formatHistoryDate(entry.timestamp)) + '</div>',
          '</div>',
          '<button class="viz-history-undo" type="button" data-history-id="' + escapeHtml(entry.id || '') + '">Quitar</button>',
        '</li>'
      ].join("");
    }).join("");
  }

  function undoHistoryEntry(historyId) {
    if (!smartActive || !currentId) return;
    var history = getActivitiesHistory();
    var target = history.find(function (entry) {
      return String(entry.id) === String(historyId);
    });
    if (!target) return;

    var before = normalizeActivities(currentActivitiesCache);
    var index = parseInt(target.activityIndex, 10);
    if (!Number.isFinite(index) || !before[index]) return;

    var after = before.slice();
    after[index] = {
      name: String(before[index].name || ""),
      progress: String(before[index].progress || ""),
      done: false,
      sessionOrder: before[index].sessionOrder
    };

    currentActivitiesCache = normalizeActivities(after);
    safeSetJson(ACTIVITIES_KEY_PREFIX + currentId, currentActivitiesCache);
    syncActivitiesHistory(before, currentActivitiesCache);
    updateProgressFromActivities(currentActivitiesCache, false);

    setCurrentSessionOrder(parseInt(after[index].sessionOrder, 10));
    renderActivities(currentActivitiesCache);
    renderActivitiesHistory();
  }

  function readActivitiesFromUI() {
    var items = document.querySelectorAll(".viz-activity-item");
    var activities = normalizeActivities(currentActivitiesCache);

    items.forEach(function (item) {
      var globalIndex = parseInt(item.getAttribute("data-activity-index"), 10);
      var doneInput = item.querySelector(".viz-activity-done");

      if (!Number.isFinite(globalIndex) || !activities[globalIndex]) return;
      activities[globalIndex].done = !!(doneInput && doneInput.checked);
    });

    return normalizeActivities(activities);
  }

  function renderActivities(activities) {
    var list = document.getElementById("viz-activities-list");
    if (!list) return;

    var safeActivities = normalizeActivities(activities);
    currentActivitiesCache = safeActivities;

    var currentSessionOrder = getCurrentSessionOrder();
    if (Number.isFinite(currentSessionOrder)) {
      setCurrentSessionOrder(currentSessionOrder);
    }

    var visibleActivities = safeActivities.map(function (activity, index) {
      return { activity: activity, index: index };
    }).filter(function (entry) {
      return parseInt(entry.activity.sessionOrder, 10) === currentSessionOrder;
    });

    if (!visibleActivities.length) {
      list.innerHTML = '<p class="exp-empty mb-0">No hay actividades para la sesion actual.</p>';
      updateActivitiesSummary(safeActivities);
      syncActivitiesInteractivity();
      return;
    }

    list.innerHTML = visibleActivities.map(function (entry, localIndex) {
      var activity = entry.activity;
      var globalIndex = entry.index;

      return [
        '<article class="viz-activity-item exp-activity" data-index="' + localIndex + '" data-activity-index="' + globalIndex + '">',
          '<div class="exp-activity-top">',
            '<label class="exp-check">',
              '<input class="viz-activity-done" type="checkbox"' + (activity.done ? ' checked' : '') + '>',
              '<span>' + escapeHtml(activity.name || ('Actividad ' + (localIndex + 1))) + '</span>',
            '</label>',
          '</div>',
        '</article>'
      ].join("");
    }).join("");

    updateActivitiesSummary(safeActivities);
    syncActivitiesInteractivity();
  }

  function getNextPendingSessionOrder(allActivities) {
    var safeActivities = normalizeActivities(allActivities);
    var currentOrder = getCurrentSessionOrder();
    if (!Number.isFinite(currentOrder)) return null;

    var currentSessionActivities = safeActivities.filter(function (activity) {
      return parseInt(activity.sessionOrder, 10) === currentOrder;
    });

    if (!currentSessionActivities.length) return null;

    var currentIsCompleted = currentSessionActivities.every(function (activity) {
      return !!activity.done;
    });

    if (!currentIsCompleted) return null;

    var orderedSessions = (currentSessionOptions || [])
      .map(function (option) { return option.order; })
      .sort(function (a, b) { return a - b; });

    var currentIndex = orderedSessions.indexOf(currentOrder);
    if (currentIndex === -1) return null;

    for (var i = currentIndex + 1; i < orderedSessions.length; i++) {
      var candidateOrder = orderedSessions[i];
      var hasPending = safeActivities.some(function (activity) {
        return parseInt(activity.sessionOrder, 10) === candidateOrder && !activity.done;
      });

      if (hasPending) {
        return candidateOrder;
      }
    }

    return null;
  }

  function persistActivitiesIfPossible() {
    if (!currentId || !smartActive) return normalizeActivities(currentActivitiesCache);
    var before = normalizeActivities(currentActivitiesCache);
    var updated = readActivitiesFromUI();
    currentActivitiesCache = updated;
    safeSetJson(ACTIVITIES_KEY_PREFIX + currentId, updated);
    syncActivitiesHistory(before, updated);
    updateProgressFromActivities(updated, false);
    persistExperienceToGroupAndStudents("en-curso");
    return updated;
  }

  function resetExperienceProgress() {
    if (!currentId) return;

    try {
      localStorage.removeItem(ACTIVITIES_KEY_PREFIX + currentId);
      localStorage.removeItem(ACTIVITIES_HISTORY_KEY_PREFIX + currentId);
      localStorage.removeItem(CURRENT_SESSION_KEY_PREFIX + currentId);
      localStorage.removeItem(PROGRESS_KEY_PREFIX + currentId);
      localStorage.removeItem(PROGRESS_MANUAL_KEY_PREFIX + currentId);
      localStorage.removeItem(STATUS_KEY_PREFIX + currentId);
      localStorage.removeItem(NOTES_KEY_PREFIX + currentId);
    } catch (_) {}

    var baseActivities = currentItem
      ? createActivitiesFromItem(currentItem)
      : [createDefaultActivity()];

    currentActivitiesCache = normalizeActivities(baseActivities);
    renderActivities(currentActivitiesCache);
    renderActivitiesHistory();

    var range = document.getElementById("viz-progress-range");
    if (range) {
      range.value = 0;
      updateProgressUI(0);
    }

    updateTrackingStatusText(currentActivitiesCache);
    persistExperienceToGroupAndStudents("pendiente");
  }

  // --- Persiste y restaura estado ---
  function restoreState() {
    if (!currentId) return;

    // Seguimiento de actividades
    var activities = safeGetJson(ACTIVITIES_KEY_PREFIX + currentId);
    renderActivities(normalizeActivities(activities || createActivitiesFromItem(currentItem)));
    renderActivitiesHistory();

    // Progreso
    var progress = parseInt(safeGet(PROGRESS_KEY_PREFIX + currentId) || "0", 10);
    var range = document.getElementById("viz-progress-range");
    if (range) {
      range.value = progress;
      updateProgressUI(progress);
    }

    if (!isProgressManualOverride()) {
      updateProgressFromActivities(currentActivitiesCache, false);
    }

    updateTrackingStatusText(currentActivitiesCache);
  }

  function updateProgressUI(val) {
    var fill = document.getElementById("viz-progress-fill");
    var pct = document.getElementById("viz-progress-pct");
    if (fill) fill.style.width = val + "%";
    if (pct) pct.textContent = val + "%";
    updateTrackingStatusText(currentActivitiesCache);
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeGetJson(key) {
    try {
      var value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (_) {
      return null;
    }
  }

  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (_) {}
  }

  function safeSetJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }

  // --- Pantalla completa ---
  function initFullscreen() {
    var btn = document.getElementById("viz-fullscreen-btn");
    var body = document.getElementById("viz-viewer-body");
    if (!btn || !body) return;

    btn.addEventListener("click", function () {
      if (body.requestFullscreen) {
        body.requestFullscreen();
      } else if (body.webkitRequestFullscreen) {
        body.webkitRequestFullscreen();
      }
    });
  }

  // --- Inicialización ---
  function init() {
    var id = getParam("id");
    var fase = getParam("fase");
    var resourceConfig = getResourceConfig();

    currentId = id;
      currentResourceConfig = resourceConfig;

    var backBtn = document.querySelector(".viz-back-btn");
    if (backBtn) {
      var backTarget = inferBackTarget(resourceConfig);
      backBtn.href = backTarget.href;
      backBtn.innerHTML = '<span aria-hidden="true">&#8592;</span> ' + backTarget.label;
    }

    // Toggle modo inteligente
    var toggleBtn = document.getElementById("viz-smart-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        setSmartMode(!smartActive);
      });
    }

    // Recuperar modo inteligente guardado por plano (no global)
    var savedMode = id ? safeGet(SMART_MODE_KEY_PREFIX + id) : null;
    setSmartMode(savedMode === "1");

    // Estado visual inicial de actividades
    currentSessionOptions = [];
    renderActivities([createDefaultActivity()]);
    renderActivitiesHistory();

    // Gestion de seguimiento de actividades
    var activitiesList = document.getElementById("viz-activities-list");
    var activitiesHistoryList = document.getElementById("viz-activities-history-list");

    if (activitiesHistoryList) {
      activitiesHistoryList.addEventListener("click", function (event) {
        var undoBtn = event.target.closest(".viz-history-undo");
        if (!undoBtn) return;
        undoHistoryEntry(undoBtn.getAttribute("data-history-id"));
      });
    }

    if (activitiesList) {
      activitiesList.addEventListener("change", function () {
        var updated = persistActivitiesIfPossible();
        var nextSessionOrder = getNextPendingSessionOrder(updated);
        if (Number.isFinite(nextSessionOrder)) {
          setCurrentSessionOrder(nextSessionOrder);
        }
        renderActivities(updated);
        renderActivitiesHistory();
      });
    }

    // Progreso
    var progressRange = document.getElementById("viz-progress-range");
    if (progressRange) {
      progressRange.addEventListener("input", function () {
        var val = parseInt(progressRange.value, 10);
        if (currentId && smartActive) {
          setProgressManualOverride(true);
          safeSet(STATUS_KEY_PREFIX + currentId, "en-curso");
        }
        updateProgressUI(val);
        if (currentId && smartActive) {
          safeSet(PROGRESS_KEY_PREFIX + currentId, String(val));
          persistExperienceToGroupAndStudents("en-curso");
        }
      });
    }

    var startExperienceBtn = document.getElementById("viz-start-experience-btn");
    if (startExperienceBtn) {
      startExperienceBtn.addEventListener("click", function () {
        if (!smartActive || !currentId) return;
        safeSet(STATUS_KEY_PREFIX + currentId, "en-curso");
        setProgressManualOverride(false);
        updateProgressFromActivities(currentActivitiesCache, true);
        updateTrackingStatusText(currentActivitiesCache);
        persistExperienceToGroupAndStudents("en-curso");
      });
    }

    var resetExperienceBtn = document.getElementById("viz-reset-experience-btn");
    if (resetExperienceBtn) {
      resetExperienceBtn.addEventListener("click", function () {
        if (!smartActive || !currentId) return;
        var shouldReset = window.confirm("Se borrara todo el avance de esta experiencia. ¿Deseas continuar?");
        if (!shouldReset) return;
        resetExperienceProgress();
      });
    }

    initFullscreen();
    initInstrumentsModal();
    initActivitiesModal();

    // Generador de recomendaciones IA
    var aiGenerateBtn = document.getElementById("viz-ai-generate-btn");
    if (aiGenerateBtn) {
      aiGenerateBtn.textContent = "Generar recomendaciones";
      aiGenerateBtn.addEventListener("click", startAiTyping);
    }

    // Cargar metadata si hay id
    if (id) {
      console.log("DEBUG: Loading metadata for id=" + id + ", fase=" + fase + ", resourceConfig.metadataFile=" + resourceConfig.metadataFile);
      loadMetadata(id, fase, resourceConfig)
        .then(function (item) {
          console.log("DEBUG: loadMetadata returned item:", item ? item.id : "NULL");
          if (item) {
            console.log("DEBUG: Calling renderMeta with item:", item.contenido?.titulo);
            renderMeta(item, resourceConfig);
            if (smartActive) restoreState();
          } else {
            console.log("DEBUG: Item is null or undefined");
            set("viz-file-title", "Recurso no encontrado");
          }
        })
        .catch(function (err) {
          console.error("DEBUG: loadMetadata error:", err);
          set("viz-file-title", "No se pudo cargar el recurso: " + err.message);
        });
    } else {
      console.log("DEBUG: No id parameter found in URL");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
