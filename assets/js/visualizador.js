(function () {
  "use strict";
  
  console.log("DEBUG: visualizador.js IIFE executed at", new Date().toISOString());

  var PROFILE_KEY = "maletinPrimariaTeacherProfile";
  var SMART_MODE_KEY_PREFIX = "vizSmartMode_";
  var NOTES_KEY_PREFIX = "vizNotes_";
  var ACTIVITIES_KEY_PREFIX = "vizActivities_";
  var PROGRESS_KEY_PREFIX = "vizProgress_";
  var STATUS_KEY_PREFIX = "vizStatus_";
  var AI_RECOMMENDATIONS_KEY_PREFIX = "vizAiRecommendations_";
  var INSTRUMENT_RECOMMENDATIONS_KEY_PREFIX = "vizInstrumentRecommendations_";
  var INSTRUMENT_RECOMMENDATIONS_DATA_KEY_PREFIX = "vizInstrumentRecommendationsData_";

  var currentId = null;
  var smartActive = false;
  var currentItem = null;
  var currentInstrumentRecommendations = [];
  var currentEnrichment = {};
  var currentSessionOptions = [];
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
    renderActivities(savedActivities || [createDefaultActivity()]);

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
      if (downloadBtn && filePath) downloadBtn.href = filePath;
    }
  }

  // Ajusta parametros del visor para ocultar paneles laterales cuando el navegador lo soporta.
  function buildViewerPath(filePath) {
    return filePath + "#pagemode=none&navpanes=0";
  }

  // Construye la ruta al archivo en src/resources según fase, grado y categoria
  function buildFilePath(clasificacion, archivo, resourceConfig, item) {
    var nombre = archivo.nombre || archivo.ruta || "";
    if (!nombre) return null;

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

    var fase = parseInt(clasificacion.fase, 10);
    var grado = parseInt(clasificacion.grado, 10);
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
      var categoriaSegment = categoriaToCarpeta(clasificacion.categoria_pedagogica || "");
      return "src/resources/" + faseSegment + "/" + gradoSegment + "/planos_didacticos/" + categoriaSegment + "/" + nombre;
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

      if (filePath && downloadBtn) downloadBtn.href = filePath;

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
    var modalCopyEl = document.querySelector(".viz-modal-copy");
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
    var modalCopyEl = document.querySelector(".viz-modal-copy");
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
    var modalCopyEl = document.querySelector(".viz-modal-copy");
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
    // Instrucción clara para el usuario
    var modalCopyEl = document.querySelector('.viz-modal-copy');
    if (modalCopyEl) {
      modalCopyEl.textContent = 'Para guardar el archivo, haz clic derecho en el enlace y selecciona "Guardar enlace como..." o ábrelo directamente en el explorador de archivos de Windows.';
      modalCopyEl.style.color = '';
      modalCopyEl.style.fontWeight = '';
    }
  }

  function initInstrumentsModal() {
    var openBtn = document.getElementById("viz-open-instruments-btn");
    var modalEl = document.getElementById("viz-instrumentos-modal");
    if (!openBtn || !modalEl || !window.bootstrap || !bootstrap.Modal) return;

    instrumentsModalInstance = new bootstrap.Modal(modalEl);

    openBtn.addEventListener("click", function () {
      if (openBtn.disabled) return;
      instrumentsModalInstance.show();
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

  function getSessionOptionsFromItem(item) {
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

  function updateActivitiesSummary(activities) {
    var summaryEl = document.getElementById("viz-activities-card-resume");
    if (!summaryEl) return;

    var safeActivities = normalizeActivities(activities);
    var doneCount = safeActivities.filter(function (activity) { return activity.done; }).length;
    var labelActivities = safeActivities.length === 1 ? "actividad registrada" : "actividades registradas";
    var labelDone = doneCount === 1 ? "terminada" : "terminadas";

    summaryEl.textContent = safeActivities.length + " " + labelActivities + " · " + doneCount + " " + labelDone;
  }

  function readActivitiesFromUI() {
    var items = document.querySelectorAll(".viz-activity-item");
    var activities = [];

    items.forEach(function (item) {
      var nameInput = item.querySelector(".viz-activity-name");
      var progressInput = item.querySelector(".viz-activity-progress");
      var doneInput = item.querySelector(".viz-activity-done");
      var sessionInput = item.querySelector(".viz-activity-session");
      var parsedOrder = parseInt(sessionInput ? sessionInput.value : "", 10);

      activities.push({
        name: nameInput ? nameInput.value : "",
        progress: progressInput ? progressInput.value : "",
        done: !!(doneInput && doneInput.checked),
        sessionOrder: Number.isFinite(parsedOrder) ? parsedOrder : getDefaultSessionOrder()
      });
    });

    return normalizeActivities(activities);
  }

  function renderActivities(activities) {
    var list = document.getElementById("viz-activities-list");
    if (!list) return;

    var safeActivities = normalizeActivities(activities);
    list.innerHTML = safeActivities.map(function (activity, index) {
      var selectedOrder = Number.isFinite(parseInt(activity.sessionOrder, 10))
        ? parseInt(activity.sessionOrder, 10)
        : getDefaultSessionOrder();

      return [
        '<article class="viz-activity-item" data-index="' + index + '">',
          '<div class="viz-activity-top">',
            '<h5 class="viz-activity-title">Actividad ' + (index + 1) + '</h5>',
            '<label class="viz-activity-check">',
              '<input class="viz-activity-done" type="checkbox"' + (activity.done ? ' checked' : '') + '>',
              '<span>Terminada</span>',
            '</label>',
          '</div>',
          '<div class="viz-activity-session-row">',
            '<label class="viz-activity-session-label">Sesion asociada</label>',
            '<select class="viz-activity-session">' + buildSessionOptionsHtml(selectedOrder) + '</select>',
          '</div>',
          '<div class="viz-activity-session-chip">' + escapeHtml(getSessionLabel(selectedOrder)) + '</div>',
          '<input class="viz-activity-name" type="text" placeholder="Describe la actividad" value="' + escapeHtml(activity.name) + '">',
          '<textarea class="viz-activity-progress" placeholder="Agrega avance, observaciones o acuerdos..." rows="3">' + escapeHtml(activity.progress) + '</textarea>',
          '<button class="viz-activity-remove" type="button">Quitar actividad</button>',
        '</article>'
      ].join("");
    }).join("");

    updateActivitiesSummary(safeActivities);
    syncActivitiesInteractivity();
  }

  function persistActivitiesIfPossible() {
    if (!currentId || !smartActive) return;
    safeSetJson(ACTIVITIES_KEY_PREFIX + currentId, readActivitiesFromUI());
  }

  // --- Persiste y restaura estado ---
  function restoreState() {
    if (!currentId) return;

    // Seguimiento de actividades
    var activities = safeGetJson(ACTIVITIES_KEY_PREFIX + currentId);
    renderActivities(normalizeActivities(activities));

    // Progreso
    var progress = parseInt(safeGet(PROGRESS_KEY_PREFIX + currentId) || "0", 10);
    var range = document.getElementById("viz-progress-range");
    if (range) {
      range.value = progress;
      updateProgressUI(progress);
    }

    // Status
    var status = safeGet(STATUS_KEY_PREFIX + currentId) || "pendiente";
    document.querySelectorAll(".viz-status-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.status === status);
    });
  }

  function updateProgressUI(val) {
    var fill = document.getElementById("viz-progress-fill");
    var pct = document.getElementById("viz-progress-pct");
    if (fill) fill.style.width = val + "%";
    if (pct) pct.textContent = val + "%";
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

    // Gestion de seguimiento de actividades
    var activitiesList = document.getElementById("viz-activities-list");
    var addActivityBtn = document.getElementById("viz-add-activity-btn");
    var saveNotesBtn = document.getElementById("viz-save-notes-btn");

    if (activitiesList) {
      activitiesList.addEventListener("click", function (event) {
        var removeBtn = event.target.closest(".viz-activity-remove");
        if (!removeBtn || !smartActive) return;

        var item = removeBtn.closest(".viz-activity-item");
        if (!item) return;

        var next = readActivitiesFromUI().filter(function (_, index) {
          return index !== parseInt(item.dataset.index, 10);
        });

        renderActivities(next);
        persistActivitiesIfPossible();
      });

      activitiesList.addEventListener("change", function () {
        persistActivitiesIfPossible();
      });

      activitiesList.addEventListener("input", function () {
        persistActivitiesIfPossible();
      });
    }

    if (addActivityBtn) {
      addActivityBtn.addEventListener("click", function () {
        if (!smartActive) return;
        var activities = readActivitiesFromUI();
        activities.push(createDefaultActivity());
        renderActivities(activities);
        persistActivitiesIfPossible();
      });
    }

    if (saveNotesBtn) {
      saveNotesBtn.addEventListener("click", function () {
        if (!currentId || !smartActive) return;
        safeSetJson(ACTIVITIES_KEY_PREFIX + currentId, readActivitiesFromUI());
        saveNotesBtn.textContent = "✓ Guardado";
        setTimeout(function () {
          saveNotesBtn.textContent = "Guardar seguimiento";
        }, 2000);
      });
    }

    // Progreso
    var progressRange = document.getElementById("viz-progress-range");
    if (progressRange) {
      progressRange.addEventListener("input", function () {
        var val = parseInt(progressRange.value, 10);
        updateProgressUI(val);
        if (currentId && smartActive) {
          safeSet(PROGRESS_KEY_PREFIX + currentId, String(val));
        }
      });
    }

    // Status de seguimiento
    document.querySelectorAll(".viz-status-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!smartActive) return;
        document.querySelectorAll(".viz-status-btn").forEach(function (b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");
        if (currentId) {
          safeSet(STATUS_KEY_PREFIX + currentId, btn.dataset.status);
        }
      });
    });

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
