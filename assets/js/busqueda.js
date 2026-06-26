(function () {
  "use strict";

  var CATALOGO_URL = "src/metadata/catalogo_descubrimiento_conceptual.json";
  var DESCUBRIMIENTO_MAP = {};
  var RESOURCE_DATASET_CACHE_BY_PHASE = {};
  var VISUAL_ONLY_CATEGORIES = {
    campo: true
  };
  var CATEGORY_SELECTION_LIMITS = {
    campo: 3
  };
  var FILTROS_ACTIVOS = {
    energia: [],
    recursos: [],
    experiencia: [],
    intencion: [],
    enfoque: [],
    clima: [],
    campo: [],
    busqueda: ""
  };

  var DISCOVERY_ID_ALIASES = {
    mucha_participacion: "alta_participacion"
  };

  var DISCOVERY_CATEGORY_MAP = {
    energia: "energia_y_dinamica_grupo",
    recursos: "recursos_y_preparacion",
    experiencia: "tipo_experiencia_aprendizaje",
    intencion: "intencion_pedagogica",
    enfoque: "enfoque_metodologico_nem",
    clima: "clima_emocional_aula"
  };

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeDiscoveryId(value) {
    var normalized = String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return DISCOVERY_ID_ALIASES[normalized] || normalized;
  }

  function parseStoredProfile(rawValue) {
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue);
    } catch (_err) {
      return null;
    }
  }

  function getTeacherProfile() {
    try {
      return parseStoredProfile(localStorage.getItem("maletinPrimariaTeacherProfile")) || {};
    } catch (_err) {
      return {};
    }
  }

  function getTeacherPhase() {
    var profile = getTeacherProfile();
    var phase = parseInt(profile && profile.phase, 10);

    if (phase >= 3 && phase <= 5) {
      return phase;
    }

    return 3;
  }

  function getTeacherLevel() {
    var profile = getTeacherProfile();
    var candidates = [
      profile && profile.level,
      Array.isArray(profile && profile.levels) ? profile.levels[0] : null,
      profile && profile.grado,
      profile && profile.selectedGrado
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      var parsed = parseInt(candidates[i], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return null;
  }

  function getPhasePlanosUrl(phase) {
    var phaseNum = parseInt(phase, 10);
    if (phaseNum < 3 || phaseNum > 5) {
      phaseNum = getTeacherPhase();
    }

    return "src/metadata/fase" + phaseNum + "/planos_didacticos.json";
  }

  function resourceMatchesLevel(resource, level) {
    if (!level) {
      return true;
    }

    var grado = resource && resource.clasificacion ? parseInt(resource.clasificacion.grado, 10) : NaN;
    return grado === level;
  }

  function getNormalizedActiveIds(category) {
    return toArray(FILTROS_ACTIVOS[category]).map(normalizeDiscoveryId).filter(Boolean);
  }

  function isVisualOnlyCategory(category) {
    return !!VISUAL_ONLY_CATEGORIES[category];
  }

  function getCategorySelectionLimit(category) {
    return CATEGORY_SELECTION_LIMITS[category] || 0;
  }

  function updateCategorySelectionState(category) {
    var limit = getCategorySelectionLimit(category);
    if (!limit) {
      return;
    }

    var activeCount = Array.isArray(FILTROS_ACTIVOS[category]) ? FILTROS_ACTIVOS[category].length : 0;
    var chips = document.querySelectorAll(".explorador-chip[data-category='" + category + "']");
    var hint = document.getElementById("campo-formativo-hint");

    chips.forEach(function (chip) {
      var chipDiscoveryId = normalizeDiscoveryId(chip.getAttribute("data-discovery-id"));
      var isActive = FILTROS_ACTIVOS[category].indexOf(chipDiscoveryId) > -1;
      chip.disabled = !isActive && activeCount >= limit;
    });

    if (hint) {
      hint.textContent = activeCount >= limit
        ? "Ya seleccionaste 3 de 3 campos formativos."
        : "Puedes seleccionar hasta 3 campos formativos.";
    }
  }

  function buildShortDiscoveryLabel(desc) {
    return String((desc && desc.titulo) || "")
      .replace(/^Ideal para\s+/i, "")
      .replace(/^Para\s+/i, "")
      .replace(/^Puede\s+/i, "")
      .replace(/^Promueve\s+/i, "")
      .replace(/^Incluye\s+/i, "")
      .replace(/^Usa\s+/i, "")
      .replace(/^Aprovecha\s+/i, "")
      .trim();
  }

  function getDiscoveryFilterPayload() {
    return Object.keys(DISCOVERY_CATEGORY_MAP).reduce(function (acc, category) {
      var values = toArray(FILTROS_ACTIVOS[category]).map(normalizeDiscoveryId).filter(Boolean);
      if (values.length > 0) {
        acc[category] = values;
      }
      return acc;
    }, {});
  }

  function buildDiscoveryContextQuery() {
    var terms = [];

    Object.keys(DISCOVERY_CATEGORY_MAP).forEach(function (category) {
      toArray(FILTROS_ACTIVOS[category]).forEach(function (filterId) {
        var normalizedId = normalizeDiscoveryId(filterId);
        var discovery = DESCUBRIMIENTO_MAP[normalizedId];

        if (!discovery) {
          return;
        }

        if (discovery.titulo) {
          terms.push(discovery.titulo);
        }

        if (Array.isArray(discovery.tags)) {
          terms = terms.concat(discovery.tags);
        }
      });
    });

    return terms.join(" ").trim();
  }

  function isDiscoveryActive(desc) {
    if (!desc || !desc.categoria || !Array.isArray(FILTROS_ACTIVOS[desc.categoria])) {
      return false;
    }

    return getNormalizedActiveIds(desc.categoria).indexOf(normalizeDiscoveryId(desc.id)) > -1;
  }

  function getResourceDiscoveryHints(resource) {
    var rawContext = resource && resource.enriquecimiento_ia && resource.enriquecimiento_ia.descubrimiento_contextual
      ? resource.enriquecimiento_ia.descubrimiento_contextual
      : {};
    var hints = [];
    var seenHints = {};

    Object.keys(DISCOVERY_CATEGORY_MAP).forEach(function (category) {
      var metadataCategory = DISCOVERY_CATEGORY_MAP[category];
      var items = toArray(rawContext[metadataCategory]);

      items.forEach(function (item) {
        var normalizedId = normalizeDiscoveryId(item && item.id);
        var catalogItem = DESCUBRIMIENTO_MAP[normalizedId] || {};
        var mergedItem = {
          id: normalizedId,
          icono: item && item.icono ? item.icono : (catalogItem.icono || "•"),
          titulo: item && item.titulo ? item.titulo : (catalogItem.titulo || ""),
          descripcion: catalogItem.descripcion || "",
          categoria: category,
          label: buildShortDiscoveryLabel(item && item.titulo ? item : catalogItem),
          isActive: getNormalizedActiveIds(category).indexOf(normalizedId) > -1
        };

        if (!mergedItem.id || !mergedItem.titulo) {
          return;
        }

        if (seenHints[mergedItem.id]) {
          return;
        }

        seenHints[mergedItem.id] = true;

        hints.push(mergedItem);
      });
    });

    var sortedHints = hints
      .sort(function (a, b) {
        if (a.isActive !== b.isActive) {
          return a.isActive ? -1 : 1;
        }
        return a.titulo.localeCompare(b.titulo, "es");
      });

    var activeHints = sortedHints.filter(function (hint) {
      return hint.isActive;
    });
    var inactiveHints = sortedHints.filter(function (hint) {
      return !hint.isActive;
    });

    return activeHints.concat(inactiveHints).slice(0, 3);
  }

  function renderDiscoveryHints(resource) {
    var hints = getResourceDiscoveryHints(resource);

    if (!hints.length) {
      return "";
    }

    return [
      '<div class="beta-tags" aria-label="Filtros sugeridos para este recurso">',
      hints.map(function (hint) {
        return '<span class="' + (hint.isActive ? 'is-filter-match' : '') + '" title="' + escapeHtml(hint.titulo + (hint.descripcion ? ': ' + hint.descripcion : '')) + '">' + escapeHtml(hint.icono) + ' ' + escapeHtml(hint.label) + '</span>';
      }).join(""),
      '</div>'
    ].join("");
  }

  function cargarCatalogo() {
    return fetch(CATALOGO_URL)
      .then(function (response) {
        if (!response.ok) throw new Error("No se pudo cargar catálogo");
        return response.json();
      })
      .then(function (data) {
        var catalogo = data.catalogo_descubrimiento_contextual || {};
        
        // Mapear todos los descubridores por ID
        Object.keys(catalogo).forEach(function (categoria) {
          if (Array.isArray(catalogo[categoria])) {
            catalogo[categoria].forEach(function (item) {
              var normalizedId = normalizeDiscoveryId(item.id);
              DESCUBRIMIENTO_MAP[normalizedId] = {
                categoria: categoria,
                ...item
              };
            });
          }
        });
        
        return DESCUBRIMIENTO_MAP;
      })
      .catch(function (err) {
        console.error("Error cargando catálogo:", err);
        return {};
      });
  }

  function cargarPlanosPorFase(phase) {
    var phaseNum = parseInt(phase, 10);
    if (RESOURCE_DATASET_CACHE_BY_PHASE[phaseNum]) {
      return Promise.resolve(RESOURCE_DATASET_CACHE_BY_PHASE[phaseNum]);
    }

    var url = getPhasePlanosUrl(phaseNum);

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("No se pudo cargar " + url);
        }
        return response.json();
      })
      .then(function (dataset) {
        RESOURCE_DATASET_CACHE_BY_PHASE[phaseNum] = toArray(dataset);
        return RESOURCE_DATASET_CACHE_BY_PHASE[phaseNum];
      })
      .catch(function (err) {
        console.error("Error cargando planos por fase:", err);
        RESOURCE_DATASET_CACHE_BY_PHASE[phaseNum] = [];
        return [];
      });
  }

  function resourceMatchesDiscoveryFilters(resource, discoveryContext) {
    var rawContext = resource && resource.enriquecimiento_ia ? resource.enriquecimiento_ia.descubrimiento_contextual : null;

    if (!rawContext) {
      return false;
    }

    return Object.keys(discoveryContext).every(function (category) {
      var selectedIds = toArray(discoveryContext[category]).map(normalizeDiscoveryId).filter(Boolean);
      var metadataCategory = DISCOVERY_CATEGORY_MAP[category];
      var currentIds = toArray(rawContext[metadataCategory]).map(function (item) {
        return normalizeDiscoveryId(item && item.id);
      }).filter(Boolean);

      if (!selectedIds.length) {
        return true;
      }

      return selectedIds.some(function (selectedId) {
        return currentIds.indexOf(selectedId) > -1;
      });
    });
  }

  function initChips() {
    var chips = document.querySelectorAll(".explorador-chip");
    
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var discoveryId = normalizeDiscoveryId(chip.getAttribute("data-discovery-id"));
        var category = chip.getAttribute("data-category");
        
        if (!discoveryId || !category) return;
        
        var index = FILTROS_ACTIVOS[category].indexOf(discoveryId);
        
        if (index > -1) {
          FILTROS_ACTIVOS[category].splice(index, 1);
          chip.classList.remove("is-active");
        } else {
          var limit = getCategorySelectionLimit(category);
          if (limit && FILTROS_ACTIVOS[category].length >= limit) {
            updateCategorySelectionState(category);
            return;
          }

          FILTROS_ACTIVOS[category].push(discoveryId);
          chip.classList.add("is-active");
        }
        
        // Sincronizar chips en main y modal
        sincronizarChips(discoveryId, category);
        updateCategorySelectionState(category);
        actualizarPillBadges();

        if (isVisualOnlyCategory(category)) {
          return;
        }

        buscarRecursos();
      });
    });
  }

  function sincronizarChips(discoveryId, category) {
    var allChips = document.querySelectorAll(".explorador-chip[data-category='" + category + "']");
    
    allChips.forEach(function (chip) {
      var chipDiscoveryId = normalizeDiscoveryId(chip.getAttribute("data-discovery-id"));
      if (FILTROS_ACTIVOS[category].indexOf(chipDiscoveryId) > -1) {
        chip.classList.add("is-active");
      } else {
        chip.classList.remove("is-active");
      }
    });

    updateCategorySelectionState(category);
  }

  function initSearch() {
    var searchInput = document.getElementById("planos-search");
    var clearButton = document.getElementById("planos-search-clear");
    var debounceId = null;
    
    if (searchInput) {
      searchInput.addEventListener("focus", function () {
        searchInput.placeholder = "Ej. resolución de problemas, STEAM, movimiento...";
      });
      
      searchInput.addEventListener("blur", function () {
        searchInput.placeholder = "Buscar por tema, actividad, habilidad...";
      });
      
      searchInput.addEventListener("input", function () {
        FILTROS_ACTIVOS.busqueda = searchInput.value.trim();
        clearTimeout(debounceId);
        debounceId = setTimeout(function () {
          buscarRecursos();
        }, 300);
      });
      
      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          clearTimeout(debounceId);
          buscarRecursos();
        }
      });
    }
    
    if (clearButton) {
      clearButton.addEventListener("click", function () {
        if (searchInput) {
          searchInput.value = "";
          FILTROS_ACTIVOS.busqueda = "";
        }
        FILTROS_ACTIVOS.energia = [];
        FILTROS_ACTIVOS.recursos = [];
        FILTROS_ACTIVOS.experiencia = [];
        FILTROS_ACTIVOS.intencion = [];
        FILTROS_ACTIVOS.enfoque = [];
        FILTROS_ACTIVOS.clima = [];
        FILTROS_ACTIVOS.campo = [];
        
        document.querySelectorAll(".explorador-chip.is-active").forEach(function (chip) {
          chip.classList.remove("is-active");
        });

        document.querySelectorAll(".explorador-chip:disabled").forEach(function (chip) {
          chip.disabled = false;
        });
        
        actualizarPillBadges();
        updateCategorySelectionState("campo");
        mostrarTopActividades();
        if (searchInput) searchInput.focus();
      });
    }

    // Sincronizar chips al abrir cualquier modal de categoría
    var categoryModalIds = ["modalEnergia", "modalRecursos", "modalExperiencia", "modalIntencion", "modalEnfoque", "modalClima", "modalCampo"];
    categoryModalIds.forEach(function (modalId) {
      var modal = document.getElementById(modalId);
      if (modal) {
        modal.addEventListener("show.bs.modal", function () {
          actualizarEstadoVisualsChips();
        });
      }
    });
  }

  function actualizarEstadoVisualsChips() {
    // Actualizar visualmente todos los chips basado en FILTROS_ACTIVOS
    Object.keys(FILTROS_ACTIVOS).forEach(function (category) {
      if (category === "busqueda") return;
      
      FILTROS_ACTIVOS[category].forEach(function (filtroId) {
        var chipsToActivate = document.querySelectorAll(".explorador-chip[data-category='" + category + "']");
        chipsToActivate.forEach(function (chip) {
          if (normalizeDiscoveryId(chip.getAttribute("data-discovery-id")) !== filtroId) {
            return;
          }
          chip.classList.add("is-active");
        });
      });
    });
  }

  function actualizarPillBadges() {
    document.querySelectorAll(".explorador-cat-pill[data-category]").forEach(function (pill) {
      var category = pill.getAttribute("data-category");
      var count = Array.isArray(FILTROS_ACTIVOS[category]) ? FILTROS_ACTIVOS[category].length : 0;
      var badge = pill.querySelector(".cat-pill-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "cat-pill-badge";
        pill.appendChild(badge);
      }
      if (count > 0) {
        pill.classList.add("has-active");
        badge.textContent = count;
      } else {
        pill.classList.remove("has-active");
        badge.textContent = "";
      }
    });
  }

  function buscarRecursos() {
    var tieneFilter = Object.keys(FILTROS_ACTIVOS).some(function (key) {
      if (key === "busqueda") {
        return FILTROS_ACTIVOS[key].length > 0;
      }
      if (isVisualOnlyCategory(key)) {
        return false;
      }
      return Array.isArray(FILTROS_ACTIVOS[key]) && FILTROS_ACTIVOS[key].length > 0;
    });
    
    if (!tieneFilter) {
      mostrarTopActividades();
      return;
    }
    
    console.log("FILTROS_ACTIVOS:", FILTROS_ACTIVOS);
    console.log("window.maletinAI disponible:", !!window.maletinAI);
    console.log("semanticSearch disponible:", !!(window.maletinAI && typeof window.maletinAI.semanticSearch === "function"));
    
    // Si hay búsqueda semántica disponible y hay texto
    if (FILTROS_ACTIVOS.busqueda && window.maletinAI && typeof window.maletinAI.semanticSearch === "function") {
      buscarSemantico();
      return;
    }

    if (FILTROS_ACTIVOS.busqueda && (!window.maletinAI || typeof window.maletinAI.semanticSearch !== "function")) {
      mostrarError("La búsqueda semántica no está disponible en esta ventana. Recarga la app Electron y vuelve a entrar al explorador.");
      return;
    }
    
    // Si solo hay filtros por descubrimiento
    if (FILTROS_ACTIVOS.busqueda === "") {
      buscarPorDescubrimiento();
    } else if (FILTROS_ACTIVOS.busqueda) {
      // Si hay texto pero no hay API semántica, hacer búsqueda por texto
      buscarPorTexto();
    }
  }

  function buscarPorDescubrimiento() {
    var discoveryContext = getDiscoveryFilterPayload();
    var phase = getTeacherPhase();
    var level = getTeacherLevel();
    var statusEl = document.getElementById("beta-search-status");
    var gridEl = document.getElementById("planos-grid");

    if (!Object.keys(discoveryContext).length) {
      mostrarEstadoVacio();
      return;
    }

    if (statusEl) {
      statusEl.textContent = "Aplicando filtros...";
    }

    if (gridEl) {
      gridEl.innerHTML = '<div class="explorador-empty"><p>Buscando recursos que coincidan con los filtros seleccionados...</p></div>';
    }

    cargarPlanosPorFase(phase)
      .then(function (resources) {
        var filteredResources = toArray(resources).filter(function (resource) {
          if (!resourceMatchesLevel(resource, level)) {
            return false;
          }

          return resourceMatchesDiscoveryFilters(resource, discoveryContext);
        });

        if (filteredResources.length > 0) {
          mostrarResultadosSemanticos(filteredResources.map(function (resource) {
            return {
              id: resource.id,
              score: 1,
              recurso: resource
            };
          }));
          return;
        }

        mostrarEstadoVacio("No hay recursos que coincidan con esos filtros.");
      })
      .catch(function (err) {
        console.error("Error filtrando por descubrimiento:", err);
        mostrarError("Error al aplicar filtros: " + (err.message || "desconocido"));
      });
  }

  function buscarSemantico() {
    var query = FILTROS_ACTIVOS.busqueda;
    var statusEl = document.getElementById("beta-search-status");
    var gridEl = document.getElementById("planos-grid");
    
    if (!query) {
      mostrarEstadoVacio();
      return;
    }
    
    if (statusEl) {
      statusEl.textContent = "🔍 Buscando: " + query + "...";
    }
    
    if (gridEl) {
      gridEl.innerHTML = '<div class="explorador-empty"><p>Consultando índice semántico local...</p></div>';
    }
    
    var filtrosSemanticos = {
      topK: 12,
      minScore: -1,
      filters: {
        discoveryContext: getDiscoveryFilterPayload()
      }
    };
    
    window.maletinAI.semanticSearch(query, filtrosSemanticos)
      .then(function (response) {
        console.log("Respuesta semántica:", response);
        
        if (response && response.ok !== false && Array.isArray(response.results) && response.results.length > 0) {
          mostrarResultadosSemanticos(response.results);
        } else {
          var mensaje = response && response.error 
            ? response.error 
            : "No se encontraron recursos relacionados con '" + query + "'";
          mostrarError(mensaje);
        }
      })
      .catch(function (err) {
        console.error("Error en búsqueda semántica:", err);
        mostrarError("Error al consultar índice: " + (err.message || "desconocido"));
      });
  }

  function buscarPorTexto() {
    var query = (FILTROS_ACTIVOS.busqueda || "").toLowerCase();
    var statusEl = document.getElementById("beta-search-status");
    
    if (statusEl) {
      statusEl.textContent = "Buscando: " + query;
    }

    mostrarError("La búsqueda semántica no está disponible en esta ventana. Recarga la app Electron y vuelve a entrar al explorador.");
  }

  function mostrarTopActividades() {
    var statusEl = document.getElementById("beta-search-status");
    var gridEl = document.getElementById("planos-grid");
    var phase = getTeacherPhase();
    var level = getTeacherLevel();

    if (statusEl) {
      statusEl.textContent = "Mostrando top 10 de actividades de fase " + phase + (level ? " y grado " + level : "") + "...";
    }

    if (gridEl) {
      gridEl.innerHTML = '<div class="explorador-empty"><p>Armando el top 10 de actividades...</p></div>';
    }

    cargarPlanosPorFase(phase)
      .then(function (resources) {
        var filtered = toArray(resources).filter(function (resource) {
          return resourceMatchesLevel(resource, level);
        }).slice(0, 10);

        if (filtered.length > 0) {
          mostrarResultadosSemanticos(filtered.map(function (resource) {
            return {
              id: resource.id,
              score: 0,
              recurso: resource
            };
          }));
          return;
        }

        mostrarEstadoVacio("No hay actividades disponibles para mostrar.");
      });
  }

  function mostrarResultadosSemanticos(results) {
    var gridEl = document.getElementById("planos-grid");
    var statusEl = document.getElementById("beta-search-status");
    
    if (!Array.isArray(results)) {
      mostrarError("Formato de respuesta inválido");
      return;
    }
    
    if (results.length === 0) {
      mostrarEstadoVacio("No se encontraron recursos para esa búsqueda. Prueba con otras palabras o elige otros filtros.");
      return;
    }
    
    var html = results.map(function (item, index) {
      try {
        return renderResultadoSemantico(item);
      } catch (e) {
        console.error("Error renderizando resultado " + index + ":", e, item);
        return "";
      }
    }).filter(function (html) { return html.length > 0; }).join("");
    
    if (!html) {
      mostrarError("No se pudieron renderizar los resultados");
      return;
    }
    
    gridEl.innerHTML = html;
    if (statusEl) {
      statusEl.textContent = "✅ Se encontraron " + results.length + " resultados";
    }
    
    console.log("Resultados mostrados:", results.length);
  }

  function renderDescubridorCard(desc) {
    var icono = desc.icono || "✨";
    var titulo = desc.titulo || "";
    var descripcion = desc.descripcion || "";
    var tags = Array.isArray(desc.tags) ? desc.tags : [];
    
    return [
      '<article class="plano-card" data-discovery="' + desc.id + '">',
      '  <p class="plano-meta">Descubridor pedagógico</p>',
      '  <h4>' + icono + ' ' + titulo + '</h4>',
      '  <p>' + descripcion + '</p>',
      tags.length ? '  <div class="beta-tags">' + 
        tags.slice(0, 3).map(function (tag) {
          return '<span>#' + tag + '</span>';
        }).join("") + '</div>' : '',
      '  <a href="#" class="planos-link" onclick="return false;">Explorar →</a>',
      '</article>'
    ].join("");
  }

  function getVizTipo(resource) {
    var tipoRaw = String((resource && resource.clasificacion && resource.clasificacion.tipo_recurso) || "").toLowerCase();
    if (tipoRaw.indexOf("cuadernillo") > -1) return "cuadernillos";
    if (tipoRaw.indexOf("examen") > -1 || tipoRaw.indexOf("instrumento") > -1 || tipoRaw.indexOf("evaluaci") > -1) return "examen";
    if (tipoRaw.indexOf("material") > -1 && tipoRaw.indexOf("docente") > -1) return "material_docente";
    return "planos";
  }

  function getVizProgress(id) {
    if (!id) return 0;
    try { return parseInt(localStorage.getItem("vizProgress_" + id) || "0", 10) || 0; } catch (_) { return 0; }
  }

  function renderProgressBar(progress) {
    if (!progress || progress <= 0) return "";
    return [
      '<div class="explorador-progress-wrap" title="Progreso: ' + progress + '%">',
      '  <div class="explorador-progress-track">',
      '    <div class="explorador-progress-bar" style="width:' + progress + '%"></div>',
      '  </div>',
      '  <span class="explorador-progress-label">' + progress + '%</span>',
      '</div>'
    ].join("");
  }

  function renderResultadoSemantico(item) {
    if (!item) return "";
    
    // Manejar diferentes formatos de respuesta
    var resource = item.recurso || item;
    var contenido = resource.contenido || resource;
    var clasificacion = resource.clasificacion || {};
    
    var titulo = contenido.titulo || contenido.nombre_proyecto || contenido.nombre || "Recurso sin título";
    var resumen = contenido.proposito || contenido.problema_contexto || contenido.descripcion || "Sin descripción disponible";
    
    // Limitar resumen a 120 caracteres
    if (resumen.length > 120) {
      resumen = resumen.substring(0, 120) + "...";
    }
    
    var fase = clasificacion.fase || clasificacion.grado_escolar || "";
    var grado = clasificacion.grado || "";
    var tipo = clasificacion.tipo_recurso || clasificacion.tipo || "";
    var score = item.score ? Math.round(item.score * 100) : 0;
    var discoveryHintsHtml = renderDiscoveryHints(resource);

    var resourceId = resource.id || "";
    var progress = getVizProgress(resourceId);
    var vizTipo = getVizTipo(resource);
    var vizHref = resourceId
      ? "visualizador.html?id=" + encodeURIComponent(resourceId) + "&tipo=" + encodeURIComponent(vizTipo) + "&from=busqueda"
      : "#";
    var progressHtml = renderProgressBar(progress);
    var inProgressBadge = progress > 0 ? '<span class="explorador-progress-badge">En progreso</span>' : "";
    
    var metaText = [];
    if (fase) metaText.push("Fase " + fase);
    if (grado) metaText.push(grado + " grado");
    if (tipo) metaText.push(tipo);
    if (score > 0) metaText.push("Relevancia " + score + "%");
    
    return [
      '<article class="plano-card' + (progress > 0 ? ' has-progress' : '') + '">',
      '  <p class="plano-meta">' + (metaText.length > 0 ? metaText.join(" | ") : "Recurso educativo") + (inProgressBadge ? ' ' + inProgressBadge : '') + '</p>',
      '  <h4>' + escapeHtml(titulo) + '</h4>',
      '  <p>' + escapeHtml(resumen) + '</p>',
      progressHtml,
      discoveryHintsHtml,
      '  <a href="' + escapeHtml(vizHref) + '" class="planos-link">Ver recurso →</a>',
      '</article>'
    ].join("");
  }

  function mostrarEstadoVacio(mensaje) {
    var gridEl = document.getElementById("planos-grid");
    var statusEl = document.getElementById("beta-search-status");
    var texto = mensaje || "Selecciona filtros o busca para ver recursos";
    
    gridEl.innerHTML = '<div class="explorador-empty"><p>' + texto + '</p></div>';
    
    if (statusEl) {
      statusEl.textContent = texto;
    }
  }

  function mostrarError(mensaje) {
    var gridEl = document.getElementById("planos-grid");
    var statusEl = document.getElementById("beta-search-status");
    
    var msgDefault = mensaje || "No hay resultados";
    
    gridEl.innerHTML = [
      '<article class="plano-card" style="border: 1px dashed var(--beta-accent); background: rgba(255, 143, 63, 0.05);">',
      '  <p class="plano-meta">Sin resultados</p>',
      '  <h4>⚠️ ' + msgDefault + '</h4>',
      '  <p>Intenta con palabras diferentes o selecciona otros filtros.</p>',
      '</article>'
    ].join("");
    
    if (statusEl) {
      statusEl.textContent = "❌ " + msgDefault;
    }
    
    console.warn("Error de búsqueda:", msgDefault);
  }

  // Inicialización
  cargarCatalogo().then(function () {
    initChips();
    initSearch();
    mostrarTopActividades();
  });

})();
