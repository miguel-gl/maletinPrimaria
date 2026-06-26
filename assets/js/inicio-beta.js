(function () {
  "use strict";

  var PROFILE_KEY = "maletinPrimariaTeacherProfile";
  var PROGRESS_KEY_PREFIX = "vizProgress_";
  var STATUS_KEY_PREFIX = "vizStatus_";
  var ASSISTANT_STATE_KEY = "maletinAssistantStateV1";
  var DISCOVERY_CATALOG_URL = "src/metadata/catalogo_descubrimiento_conceptual.json";

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

  var DISCOVERY_CATEGORY_LABELS = {
    energia: "Energia y dinamica",
    recursos: "Recursos y preparacion",
    experiencia: "Tipo de experiencia",
    intencion: "Intencion pedagogica",
    enfoque: "Enfoque metodologico",
    clima: "Clima emocional"
  };

  var DISCOVERY_CATEGORY_ICONS = {
    energia: "🔥",
    recursos: "🧰",
    experiencia: "🧩",
    intencion: "💡",
    enfoque: "🚀",
    clima: "😊"
  };

  var MAX_STEP3_CONFIGS = 3;

  var appState = {
    resources: [],
    discoveryCatalog: {},
    assistantEntryStep: null,
    selectedRecommendationId: ""
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeGetLocalStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeSetLocalStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
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

  function truncateText(value, maxChars) {
    var text = String(value || "").trim();
    if (text.length <= maxChars) {
      return text;
    }

    return text.slice(0, maxChars).trim() + "..";
  }

  function getTeacherProfile() {
    return parseJsonSafely(safeGetLocalStorage(PROFILE_KEY), {});
  }

  function getTeacherPhase() {
    var profile = getTeacherProfile();
    var phase = parseInt(profile && profile.phase, 10);
    if (phase >= 3 && phase <= 5) {
      return phase;
    }

    return 3;
  }

  function formatDateLabel(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) {
      return "Fecha estimada";
    }

    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
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

  function getContent(resource) {
    return (resource && resource.contenido) || {};
  }

  function getSessions(resource) {
    var content = getContent(resource);
    return Array.isArray(content.sesiones) ? content.sesiones : [];
  }

  function getTotalSessions(resource) {
    var content = getContent(resource);
    var declared = parseInt(content.sesiones_totales, 10);
    if (declared > 0) {
      return declared;
    }

    return Math.max(1, getSessions(resource).length);
  }

  function getSession(resource, index) {
    var sessions = getSessions(resource);
    return sessions[clamp(index, 0, Math.max(0, sessions.length - 1))] || null;
  }

  function getCurrentMoment(resource, sessionObj) {
    var content = getContent(resource);
    var moments = Array.isArray(content.momentos_metodologicos) ? content.momentos_metodologicos : [];
    var momentName = sessionObj && sessionObj.momento_metodologico;

    if (!momentName) {
      return moments[0] || null;
    }

    var match = moments.find(function (item) {
      return item && item.nombre === momentName;
    });

    return match || moments[0] || null;
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

        return (a.resource.id || "") < (b.resource.id || "") ? -1 : 1;
      });
  }

  function getUniqueGrados(resources) {
    var grades = [];
    (resources || []).forEach(function (r) {
      var g = r && r.clasificacion && r.clasificacion.grado;
      if (g && grades.indexOf(g) === -1) {
        grades.push(g);
      }
    });
    return grades.sort(function (a, b) { return a - b; });
  }

  function getUniqueCampos(resources, selectedGrado) {
    var filtered = selectedGrado
      ? (resources || []).filter(function (r) {
          return r && r.clasificacion && r.clasificacion.grado === selectedGrado;
        })
      : (resources || []);
    var campos = [];
    filtered.forEach(function (r) {
      var cf = r && r.contenido && Array.isArray(r.contenido.campos_formativos)
        ? r.contenido.campos_formativos : [];
      cf.forEach(function (c) {
        var name = c && c.campo;
        if (name && campos.indexOf(name) === -1) {
          campos.push(name);
        }
      });
    });
    return campos.sort();
  }

  function filterResourcesByGradoAndCampo(resources, selectedGrado, selectedCampo) {
    var selectedCampos = Array.isArray(selectedCampo)
      ? selectedCampo.filter(Boolean)
      : (selectedCampo ? [selectedCampo] : []);

    return (resources || []).filter(function (r) {
      if (selectedGrado && r && r.clasificacion && r.clasificacion.grado !== selectedGrado) {
        return false;
      }
      if (selectedCampos.length) {
        var cf = r && r.contenido && Array.isArray(r.contenido.campos_formativos)
          ? r.contenido.campos_formativos : [];
        var hasCampo = cf.some(function (c) {
          return c && selectedCampos.indexOf(c.campo) !== -1;
        });
        if (!hasCampo) {
          return false;
        }
      }
      return true;
    });
  }

  function buildDiscoveryFilterPayload(configRows) {
    return (configRows || []).reduce(function (acc, row) {
      if (!row || !row.category || !row.value) {
        return acc;
      }

      if (!Array.isArray(acc[row.category])) {
        acc[row.category] = [];
      }

      if (acc[row.category].indexOf(row.value) === -1) {
        acc[row.category].push(row.value);
      }

      return acc;
    }, {});
  }

  function resourceMatchesDiscoveryFilters(resource, discoveryPayload) {
    var rawContext = resource && resource.enriquecimiento_ia ? resource.enriquecimiento_ia.descubrimiento_contextual : null;
    if (!rawContext) {
      return false;
    }

    return Object.keys(discoveryPayload).every(function (category) {
      var selectedIds = Array.isArray(discoveryPayload[category]) ? discoveryPayload[category] : [];
      var metadataCategory = DISCOVERY_CATEGORY_MAP[category];
      var currentIds = Array.isArray(rawContext[metadataCategory])
        ? rawContext[metadataCategory].map(function (item) {
            return normalizeDiscoveryId(item && item.id);
          }).filter(Boolean)
        : [];

      if (!selectedIds.length) {
        return true;
      }

      return selectedIds.some(function (selectedId) {
        return currentIds.indexOf(selectedId) !== -1;
      });
    });
  }

  function getDiscoveryOptionsByCategory(resources) {
    var optionsByCategory = {};
    var catalog = appState.discoveryCatalog || {};

    Object.keys(DISCOVERY_CATEGORY_MAP).forEach(function (category) {
      optionsByCategory[category] = [];
    });

    (resources || []).forEach(function (resource) {
      var rawContext = resource && resource.enriquecimiento_ia ? resource.enriquecimiento_ia.descubrimiento_contextual : null;
      if (!rawContext) {
        return;
      }

      Object.keys(DISCOVERY_CATEGORY_MAP).forEach(function (category) {
        var metadataCategory = DISCOVERY_CATEGORY_MAP[category];
        var items = Array.isArray(rawContext[metadataCategory]) ? rawContext[metadataCategory] : [];

        items.forEach(function (item) {
          var id = normalizeDiscoveryId(item && item.id);
          if (!id) {
            return;
          }

          var exists = optionsByCategory[category].some(function (opt) {
            return opt.id === id;
          });

          if (!exists) {
            var catalogItem = (catalog[category] || []).find(function (entry) {
              return entry.id === id;
            });

            optionsByCategory[category].push({
              id: id,
              title: (catalogItem && catalogItem.titulo) || (item && item.titulo) || id.replace(/_/g, " "),
              icono: (catalogItem && catalogItem.icono) || ((item && item.icono) || "✨")
            });
          }
        });
      });
    });

    Object.keys(optionsByCategory).forEach(function (category) {
      optionsByCategory[category].sort(function (a, b) {
        return String(a.title || "").localeCompare(String(b.title || ""), "es");
      });
    });

    return optionsByCategory;
  }

  function loadDiscoveryCatalog() {
    return fetch(DISCOVERY_CATALOG_URL)
      .then(function (response) {
        if (!response.ok) {
          return {};
        }
        return response.json();
      })
      .then(function (data) {
        var catalogRoot = data && data.catalogo_descubrimiento_contextual
          ? data.catalogo_descubrimiento_contextual
          : {};
        var mapped = {};

        Object.keys(DISCOVERY_CATEGORY_MAP).forEach(function (category) {
          var metadataCategory = DISCOVERY_CATEGORY_MAP[category];
          var items = Array.isArray(catalogRoot[metadataCategory]) ? catalogRoot[metadataCategory] : [];

          mapped[category] = items.map(function (item) {
            return {
              id: normalizeDiscoveryId(item && item.id),
              icono: (item && item.icono) || "✨",
              titulo: (item && item.titulo) || ""
            };
          }).filter(function (entry) {
            return !!entry.id;
          });
        });

        return mapped;
      })
      .catch(function () {
        return {};
      });
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
      return (results[0] || []).concat(results[1] || []);
    });
  }

  function calculatePlan(totalSessions, classDuration, daysPerWeek) {
    var safeSessions = Math.max(1, totalSessions || 1);
    var safeDuration = Math.max(20, classDuration || 50);
    var safeDays = Math.max(1, daysPerWeek || 2);

    return {
      plannedWeeks: Math.max(1, Math.ceil(safeSessions / safeDays)),
      plannedMinutes: safeSessions * safeDuration
    };
  }

  function getAssistantState() {
    var state = parseJsonSafely(safeGetLocalStorage(ASSISTANT_STATE_KEY), {});
    return {
      activeExperience: state && state.activeExperience ? state.activeExperience : null,
      tempoMode: (state && state.tempoMode) || "normal",
      pendingConfig: !!(state && state.pendingConfig),
      lastLog: state && state.lastLog ? state.lastLog : null
    };
  }

  function setAssistantState(nextState) {
    var current = getAssistantState();
    var merged = Object.assign({}, current, nextState || {});
    safeSetLocalStorage(ASSISTANT_STATE_KEY, JSON.stringify(merged));
    return merged;
  }

  function findResourceById(resources, resourceId) {
    return (resources || []).find(function (item) {
      return item && item.id === resourceId;
    }) || null;
  }

  function computeCalendarProgress(active) {
    if (!active || !active.startedAt || !active.plannedWeeks) {
      return active && typeof active.calendarProgress === "number" ? active.calendarProgress : 0;
    }

    var start = new Date(active.startedAt);
    if (isNaN(start.getTime())) {
      return 0;
    }

    var elapsedDays = Math.max(0, (Date.now() - start.getTime()) / 86400000);
    var elapsedWeeks = elapsedDays / 7;
    return clamp(Math.round((elapsedWeeks / Math.max(1, active.plannedWeeks)) * 100), 0, 100);
  }

  function composeActiveExperience(resource, options) {
    var safeOptions = options || {};
    var content = getContent(resource);
    var totalSessions = getTotalSessions(resource);
    var classDuration = parseInt(safeOptions.classDuration, 10) || 50;
    var daysPerWeek = parseInt(safeOptions.daysPerWeek, 10) || 2;
    var plan = calculatePlan(totalSessions, classDuration, daysPerWeek);
    var now = new Date();
    var finish = new Date(now.getTime() + (plan.plannedWeeks * 7 * 24 * 60 * 60 * 1000));
    var firstSession = getSession(resource, 0);
    var firstMoment = getCurrentMoment(resource, firstSession);

    return {
      resourceId: resource.id,
      resourceType: resource.__resourceType || "planos",
      title: content.titulo || content.nombre_proyecto || "Experiencia",
      metodologia: (content.metodologias && content.metodologias[0]) || "Ruta pedagogica",
      product: content.producto_central || "Producto final",
      totalSessions: totalSessions,
      currentSession: 1,
      progress: 0,
      calendarProgress: 0,
      plannedWeeks: plan.plannedWeeks,
      classDuration: classDuration,
      daysPerWeek: daysPerWeek,
      estimatedEndLabel: formatDateLabel(finish),
      currentMoment: (firstMoment && firstMoment.nombre) || (firstSession && firstSession.momento_metodologico) || "Momento inicial",
      todayObjective: (firstMoment && firstMoment.descripcion_completa) || "Iniciar la experiencia con el grupo.",
      todayTasks: Array.isArray(firstSession && firstSession.actividades) ? firstSession.actividades.slice(0, 3) : [],
      remainingSessions: Math.max(0, totalSessions - 1),
      startedAt: now.toISOString()
    };
  }

  function saveActiveExperience(active, pendingConfig) {
    if (!active) {
      return;
    }

    safeSetLocalStorage(PROGRESS_KEY_PREFIX + active.resourceId, String(clamp(active.progress || 0, 0, 100)));
    safeSetLocalStorage(STATUS_KEY_PREFIX + active.resourceId, active.progress >= 100 ? "completado" : "en-curso");
    setAssistantState({
      activeExperience: active,
      pendingConfig: !!pendingConfig
    });
  }

  function getProgressItems(resources, assistantState) {
    var activeExperience = assistantState && assistantState.activeExperience;

    return resources
      .map(function (resource) {
        var id = resource && resource.id;
        if (!id) {
          return null;
        }

        var rawProgress = parseInt(safeGetLocalStorage(PROGRESS_KEY_PREFIX + id) || "0", 10);
        var status = safeGetLocalStorage(STATUS_KEY_PREFIX + id) || "pendiente";
        var progress = isNaN(rawProgress) ? 0 : clamp(rawProgress, 0, 100);

        if (activeExperience && activeExperience.resourceId === id) {
          status = activeExperience.progress >= 100 ? "completado" : "en-curso";
          progress = clamp(activeExperience.progress || 0, 0, 100);
        }

        if (!(progress > 0 || status === "en-curso" || status === "completado")) {
          return null;
        }

        return {
          resource: resource,
          status: status,
          progress: progress,
          isActive: !!(activeExperience && activeExperience.resourceId === id)
        };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        if (a.isActive && !b.isActive) {
          return -1;
        }
        if (!a.isActive && b.isActive) {
          return 1;
        }
        if (b.progress !== a.progress) {
          return b.progress - a.progress;
        }
        return (a.resource.id || "") < (b.resource.id || "") ? -1 : 1;
      });
  }

  function renderExperienceCards(items) {
    var carousel = document.getElementById("exp-carousel");
    if (!carousel) {
      return;
    }

    if (!items.length) {
      carousel.innerHTML = "<article class=\"beta-exp-card\"><h4>Sin experiencias activas</h4><p>Explora recomendaciones y activa tu primera experiencia desde el copiloto.</p></article>";
      return;
    }

    carousel.innerHTML = items.slice(0, 8).map(function (item) {
      var resource = item.resource || {};
      var content = getContent(resource);
      var title = truncateText(content.titulo || content.nombre_proyecto || "Experiencia", 42);
      var url = buildVisualizerUrl(resource);
      var statusText = normalizeStatus(item.status);
      var ribbon = item.isActive ? "<span class=\"beta-copilot-badge\">En continuidad</span>" : "";

      return [
        '<article class="beta-exp-card" data-reveal>',
        '<h4>' + escapeHtml(title) + '</h4>',
        '<p>Avance: ' + item.progress + '% | Estado: ' + escapeHtml(statusText) + '</p>',
        '<div class="beta-progress"><span style="width: ' + item.progress + '%;"></span></div>',
        '<div class="beta-copilot-actions">',
        '<a class="beta-exp-open" href="' + escapeHtml(url) + '">Abrir</a>',
        ribbon,
        '</div>',
        '</article>'
      ].join("");
    }).join("");
  }

  function updateDashboardKPIs(progressItems) {
    var activeCount = 0;
    var completedCount = 0;
    var progressSum = 0;

    progressItems.forEach(function (item) {
      if (item.status === "completado") {
        completedCount += 1;
      } else {
        activeCount += 1;
      }
      progressSum += item.progress;
    });

    var avgProgress = progressItems.length ? Math.round(progressSum / progressItems.length) : 0;

    var elActive = document.getElementById("kpiActiveExp");
    var elCompleted = document.getElementById("kpiCompletedExp");
    var elAvg = document.getElementById("kpiAvgProgress");

    if (elActive) elActive.textContent = String(activeCount);
    if (elCompleted) elCompleted.textContent = String(completedCount);
    if (elAvg) elAvg.textContent = avgProgress + "%";
  }

  function updateExperienceHeading(activeExists) {
    var section = document.getElementById("exp-carousel") ? document.getElementById("exp-carousel").closest(".beta-section") : null;
    var heading = section ? section.querySelector(".beta-section-head h3") : null;
    var subtitle = section ? section.querySelector(".beta-section-subtitle") : null;

    if (heading) {
      heading.textContent = activeExists ? "Continuar experiencias" : "Recomendadas para iniciar";
    }
    if (subtitle) {
      subtitle.textContent = activeExists
        ? "Retoma tu siguiente sesion sugerida o cambia de experiencia sin perder continuidad."
        : "Activa una experiencia valida NEM en minutos y el copiloto te acompana durante la implementacion.";
    }
  }

  function getTempoAlert(mode) {
    if (mode === "short") {
      return {
        type: "warning",
        text: "Hoy tienes poco tiempo. Se recomienda version esencial: conserva proposito y evidencia minima."
      };
    }

    if (mode === "extended") {
      return {
        type: "positive",
        text: "Hoy tienes tiempo adicional. Puedes profundizar sin alterar la secuencia pedagogica."
      };
    }

    return null;
  }

  function activeFromProgressItem(item) {
    var resource = item.resource;
    var content = getContent(resource);
    var totalSessions = getTotalSessions(resource);
    var progress = clamp(item.progress || 0, 0, 100);
    var sessionIdx = Math.max(0, Math.min(Math.ceil((progress / 100) * totalSessions) - 1, totalSessions - 1));
    var session = getSession(resource, sessionIdx);
    var moment = getCurrentMoment(resource, session);
    return {
      resourceId: resource.id,
      title: content.titulo || content.nombre_proyecto || "Experiencia",
      metodologia: (content.metodologias && content.metodologias[0]) || "Ruta pedagogica",
      totalSessions: totalSessions,
      currentSession: sessionIdx + 1,
      progress: progress,
      currentMoment: (moment && moment.nombre) || (session && session.momento_metodologico) || "En curso",
      todayTasks: Array.isArray(session && session.actividades) ? session.actividades.slice(0, 3) : [],
      remainingSessions: Math.max(0, totalSessions - (sessionIdx + 1)),
      estimatedEndLabel: "Proximas semanas"
    };
  }

  function renderHero(assistantState, progressItems) {
    var heroEl = document.getElementById("betaAssistantHero");
    if (!heroEl) return;

    var active = assistantState.activeExperience;
    var continueUrl = null;

    if (!active) {
      var inCurso = (progressItems || []).find(function (p) {
        return p.status === "en-curso" || (p.progress > 0 && p.status !== "completado");
      });
      if (inCurso) {
        active = activeFromProgressItem(inCurso);
        continueUrl = buildVisualizerUrl(inCurso.resource);
      }
    }

    if (!active) {
      return;
    }

    var progress    = clamp(active.progress || 0, 0, 100);
    var sessionNum  = clamp(active.currentSession, 1, active.totalSessions);
    var circumf     = 314;
    var dashOffset  = Math.round(circumf * (1 - progress / 100));
    var tasks       = (active.todayTasks || []).slice(0, 3);

    heroEl.className = "beta-hero beta-hero--active card border-0 mt-2 mt-lg-3";
    heroEl.innerHTML = [
      '<div class="beta-hero-active-content">',

      '<div class="beta-hero-active-meta">',
      '<span class="beta-hero-active-badge"><span class="beta-hero-active-dot" aria-hidden="true"></span>En continuidad</span>',
      '<span class="beta-hero-active-session">Sesion ' + sessionNum + ' de ' + active.totalSessions + '</span>',
      '</div>',

      '<h2 class="beta-hero-active-title">' + escapeHtml(active.title) + '</h2>',
      '<p class="beta-hero-active-method">' + escapeHtml(active.metodologia) + '</p>',

      '<div class="beta-hero-active-progress-wrap">',
      '<div class="beta-hero-active-track"><div class="beta-hero-active-fill" style="width:' + progress + '%"></div></div>',
      '<span class="beta-hero-active-pct">' + progress + '% completado</span>',
      '</div>',

      '<div class="beta-hero-active-moment">',
      '<span class="beta-hero-active-moment-label">Momento actual</span>',
      '<span class="beta-hero-active-moment-name">' + escapeHtml(active.currentMoment) + '</span>',
      '</div>',

      tasks.length ? [
        '<ul class="beta-hero-active-tasks">',
        tasks.map(function (t) {
          return '<li><span class="beta-hero-active-task-mark" aria-hidden="true">✦</span>' + escapeHtml(t) + '</li>';
        }).join(""),
        '</ul>'
      ].join("") : "",

      '<div class="beta-hero-active-actions">',
      continueUrl
        ? '<a class="btn beta-primary-btn beta-hero-cta-main" href="' + continueUrl + '">Continuar sesion &#8594;</a>'
        : '<button class="btn beta-primary-btn beta-hero-cta-main" type="button" data-home-action="continue-active">Continuar sesion &#8594;</button>',
      '</div>',

      '</div>',

      '<div class="beta-hero-active-ring-side">',
      '<div class="beta-hero-active-ring" role="img" aria-label="' + progress + '% de avance">',
      '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
      '<defs><linearGradient id="betaRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
      '<stop offset="0%" stop-color="#a78bfa"/>',
      '<stop offset="100%" stop-color="#ff8f3f"/>',
      '</linearGradient></defs>',
      '<circle cx="60" cy="60" r="50" fill="none" stroke="#eeecfb" stroke-width="9"/>',
      '<circle cx="60" cy="60" r="50" fill="none" stroke="url(#betaRingGrad)" stroke-width="9"',
      ' stroke-dasharray="' + circumf + '" stroke-dashoffset="' + dashOffset + '"',
      ' stroke-linecap="round" transform="rotate(-90 60 60)"/>',
      '</svg>',
      '<div class="beta-hero-active-ring-center">',
      '<strong>' + progress + '%</strong>',
      '<span>avance</span>',
      '</div>',
      '</div>',
      '<p class="beta-hero-active-stat"><span>' + active.remainingSessions + '</span> sesiones restantes</p>',
      '<p class="beta-hero-active-stat">Fin estimado: <span>' + escapeHtml(active.estimatedEndLabel) + '</span></p>',
      '</div>'
    ].join("");
  }

  function renderCopilotSurface(resources, assistantState) {
    var root = document.getElementById("betaCopilotSurface");
    if (!root) {
      return;
    }

    var active = assistantState.activeExperience;

    if (!active) {
      root.innerHTML = "";
      return;
    }

    var tempoAlert = getTempoAlert(assistantState.tempoMode);
    var remainingMinutes = Math.max(0, active.remainingSessions * active.classDuration);
    var calendarProgress = computeCalendarProgress(active);

    root.innerHTML = [
      '<div class="beta-copilot-head">',
      '<div><h3>Continuidad activa: ' + escapeHtml(active.title) + '</h3><p>Te sugiero la siguiente sesion y adapto la conduccion segun tu tiempo disponible.</p></div>',
      '<span class="beta-copilot-badge">En acompanamiento</span>',
      '</div>',
      '<div class="beta-copilot-grid">',
      '<article class="beta-copilot-card">',
      '<h4 class="beta-copilot-title">Siguiente sesion sugerida</h4>',
      '<p class="beta-copilot-text">Sesion ' + clamp(active.currentSession, 1, active.totalSessions) + ' de ' + active.totalSessions + '. Momento metodologico actual: ' + escapeHtml(active.currentMoment) + '.</p>',
      '<ul class="beta-copilot-list">' + (active.todayTasks || []).slice(0, 3).map(function (task) {
        return '<li>' + escapeHtml(task) + '</li>';
      }).join("") + '</ul>',
      '<div class="beta-copilot-actions">',
      '<button type="button" class="beta-copilot-btn is-primary" data-home-action="continue-active">Continuar experiencia</button>',
      '<button type="button" class="beta-copilot-btn" data-home-action="open-assistant">Ajustar conduccion</button>',
      '<button type="button" class="beta-copilot-btn" data-home-action="switch-experience">Cambiar experiencia</button>',
      '</div>',
      '</article>',
      '<article class="beta-copilot-card">',
      '<h4 class="beta-copilot-title">Avance y calendario</h4>',
      '<div class="beta-copilot-metrics">',
      '<article><strong>' + clamp(active.progress || 0, 0, 100) + '%</strong><span>Avance pedagogico</span></article>',
      '<article><strong>' + calendarProgress + '%</strong><span>Avance de calendario</span></article>',
      '<article><strong>' + remainingMinutes + ' min</strong><span>Tiempo restante estimado</span></article>',
      '</div>',
      '<div class="beta-copilot-actions">',
      '<button type="button" class="beta-copilot-btn ' + (assistantState.tempoMode === "short" ? "is-active" : "") + '" data-home-action="tempo-mode" data-mode="short">Tengo poco tiempo</button>',
      '<button type="button" class="beta-copilot-btn ' + (assistantState.tempoMode === "normal" ? "is-active" : "") + '" data-home-action="tempo-mode" data-mode="normal">Tiempo normal</button>',
      '<button type="button" class="beta-copilot-btn ' + (assistantState.tempoMode === "extended" ? "is-active" : "") + '" data-home-action="tempo-mode" data-mode="extended">Tengo mas tiempo</button>',
      '</div>',
      assistantState.pendingConfig ? '<div class="beta-copilot-alert is-warning">Iniciaste sin configuracion completa. Conviene ajustar semanas y dias para mejorar la conciliacion automatica. <button type="button" class="beta-copilot-btn" data-home-action="open-assistant" data-entry-step="select-grado">Completar configuracion</button></div>' : '',
      tempoAlert ? '<div class="beta-copilot-alert ' + (tempoAlert.type === "warning" ? "is-warning" : "is-positive") + '">' + escapeHtml(tempoAlert.text) + '</div>' : '',
      '</article>',
      '</div>'
    ].join("");
  }

  function setFlowKickerAndTitle(step) {
    var kicker = document.getElementById("betaAssistantFlowKicker");
    var title = document.getElementById("betaAssistantFlowLabel");
    if (!kicker || !title) {
      return;
    }

    if (step === "active") {
      kicker.textContent = "Continuidad inteligente";
      title.textContent = "Ajusta tu siguiente sesion";
      return;
    }
    if (step === "configuration") {
      kicker.textContent = "Ruta de implementacion";
      title.textContent = "Concilia sesiones con tu tiempo real";
      return;
    }

    kicker.textContent = "Copiloto pedagogico";
    title.textContent = "Activar experiencia en minutos";
  }

  function createAssistantFlow(resources, assistantState) {
    return {
      resources: resources,
      step: assistantState.activeExperience ? "active" : "welcome",
      selectedGrado: null,
      selectedCampos: [],
      discoveryConfigRows: [],
      nextConfigRowId: 1,
      step3PickerOpen: false,
      step3PickerCategory: "clima",
      step3PickerValue: "",
      selectedResourceId: appState.selectedRecommendationId || "",
      classDuration: assistantState.activeExperience ? assistantState.activeExperience.classDuration : 50,
      daysPerWeek: assistantState.activeExperience ? assistantState.activeExperience.daysPerWeek : 2,
      completed: "si",
      notes: ""
    };
  }

  function applyFlowActionDock(body) {
    var grid = body ? body.querySelector(".beta-assistant-grid") : null;
    if (!grid) {
      return;
    }

    var sourceActions = grid.querySelector(".beta-assistant-rail .beta-preview-actions");
    if (!sourceActions) {
      return;
    }

    var preview = grid.querySelector(".beta-assistant-preview");
    if (!preview) {
      preview = document.createElement("article");
      preview.className = "beta-assistant-preview beta-assistant-preview--actions-only";
      grid.appendChild(preview);
    }

    var dock = preview.querySelector(".beta-assistant-action-rail");
    if (!dock) {
      dock = document.createElement("div");
      dock.className = "beta-assistant-action-rail";
      preview.insertBefore(dock, preview.firstChild);
    }

    dock.innerHTML = [
      '<span class="beta-assistant-action-kicker">Acciones del paso</span>',
      '<div class="beta-assistant-action-buttons">' + sourceActions.innerHTML + '</div>'
    ].join("");

    sourceActions.classList.add("is-relocated");
    grid.classList.add("has-action-rail");
  }

  function renderAssistantFlow(flow, assistantState) {
    var body = document.getElementById("betaAssistantFlowBody");
    if (!body) {
      return;
    }

    body.classList.remove("beta-flow-disable-dock");

    var active = assistantState.activeExperience;
    var filteredByAcademic = filterResourcesByGradoAndCampo(flow.resources, flow.selectedGrado, flow.selectedCampos);
    var discoveryPayload = buildDiscoveryFilterPayload(flow.discoveryConfigRows);
    var hasDiscoveryFilters = Object.keys(discoveryPayload).length > 0;
    var filteredForRec = hasDiscoveryFilters
      ? filteredByAcademic.filter(function (resource) {
          return resourceMatchesDiscoveryFilters(resource, discoveryPayload);
        })
      : filteredByAcademic;

    var recommendationPool = filteredForRec;
    if (hasDiscoveryFilters && !recommendationPool.length) {
      recommendationPool = filteredByAcademic;
    }

    var planosPool = recommendationPool.filter(function (resource) {
      return resource && resource.__resourceType === "planos";
    });
    var prioritizedPool = planosPool.length ? planosPool : recommendationPool;
    var recommendations = getRecommendedResources(prioritizedPool).slice(0, 5);

    if (flow.step === "welcome") {
      setFlowKickerAndTitle("welcome");
      body.innerHTML = [
        '<div class="beta-assistant-grid">',
        '<article class="beta-assistant-rail">',
        '<div class="beta-assistant-card-head"><span class="beta-assistant-pill">Primera activacion</span><h3>Bienvenida docente</h3><p>Te recomiendo una experiencia alineada a NEM y configuro una ruta aplicable para tu grupo.</p></div>',
        '<div class="beta-assistant-checklist">',
        '<div><strong>1</strong><span>Descubrir necesidades del grupo</span></div>',
        '<div><strong>2</strong><span>Recomendar experiencia valida</span></div>',
        '<div><strong>3</strong><span>Iniciar ahora o configurar ruta completa</span></div>',
        '</div>',
        '<div class="beta-preview-actions mt-3"><button class="btn beta-primary-btn" type="button" data-flow-action="to-select-grado">Comenzar</button></div>',
        '</article>',
        '<article class="beta-assistant-preview">',
        '<div class="beta-preview-hero"><span class="beta-preview-kicker">Sin planeaciones manuales</span><h3>Tu experiencia ya viene validada</h3><p>La IA solo adapta conduccion, ritmo y tiempo disponible. No altera contenido, PDA, producto ni metodologia.</p></div>',
        '</article>',
        '</div>'
      ].join("");
      applyFlowActionDock(body);
      return;
    }

    if (flow.step === "select-grado") {
      setFlowKickerAndTitle("welcome");
      var ALL_GRADOS = [
        { g: 1, label: "1er grado" },
        { g: 2, label: "2do grado" },
        { g: 3, label: "3er grado" },
        { g: 4, label: "4to grado" },
        { g: 5, label: "5to grado" },
        { g: 6, label: "6to grado" }
      ];
      body.innerHTML = [
        '<div class="beta-assistant-grid">',
        '<article class="beta-assistant-rail">',
        '<div class="beta-assistant-card-head"><span class="beta-assistant-pill">Paso 1 de 3</span><h3>¿Con que grado trabajas hoy?</h3><p>Filtro las experiencias disponibles segun el grado de tu grupo.</p></div>',
        '<div class="beta-phase-stack">',
        ALL_GRADOS.map(function (item) {
          var count = flow.resources.filter(function (r) { return r && r.clasificacion && r.clasificacion.grado === item.g; }).length;
          var selected = flow.selectedGrado === item.g;
          var noResources = count === 0;
          return [
            '<article class="beta-phase-card ' + (selected ? "is-active" : "") + (noResources ? " is-disabled" : "") + '">',
            '<div class="beta-phase-topline"><strong>' + escapeHtml(item.label) + '</strong><span>' + (noResources ? "Sin experiencias" : count + " experiencia" + (count !== 1 ? "s" : "")) + '</span></div>',
            '<button class="beta-copilot-btn ' + (selected ? "is-active" : "") + '" type="button" data-flow-action="select-grado" data-value="' + item.g + '" ' + (noResources ? "disabled" : "") + '>' + (selected ? "Seleccionado ✓" : "Seleccionar") + '</button>',
            '</article>'
          ].join("");
        }).join(""),
        '</div>',
        '<div class="beta-preview-actions mt-3">',
        '<button class="btn beta-secondary-btn" type="button" data-flow-action="to-welcome">Regresar</button>',
        '<button class="btn beta-primary-btn" type="button" data-flow-action="to-select-campo" ' + (flow.selectedGrado !== null ? "" : "disabled") + '>Siguiente: Campo formativo</button>',
        '</div>',
        '</article>',
        '<article class="beta-assistant-preview"><div class="beta-preview-panel"><div class="beta-preview-panel-head"><span>Filtrado inteligente</span><p>Cada experiencia esta validada para el grado y fase correspondiente segun el plan de estudios NEM.</p></div></div></article>',
        '</div>'
      ].join("");
      applyFlowActionDock(body);
      return;
    }

    if (flow.step === "select-campo") {
      setFlowKickerAndTitle("welcome");
      var camposDisponibles = getUniqueCampos(flow.resources, flow.selectedGrado);
      var selectedCampos = Array.isArray(flow.selectedCampos) ? flow.selectedCampos : [];
      var campoFilteredCount = selectedCampos.length
        ? filterResourcesByGradoAndCampo(flow.resources, flow.selectedGrado, selectedCampos).length
        : 0;
      var selectedCamposLabel = selectedCampos.map(function (campo) {
        return '<strong>' + escapeHtml(campo) + '</strong>';
      }).join(', ');
      var campoInfoText = selectedCampos.length
        ? selectedCamposLabel + ' — ' + campoFilteredCount + ' experiencia' + (campoFilteredCount !== 1 ? 's' : '') + ' disponibles'
        : 'Selecciona hasta 3 campos para ver las experiencias';
      var nextBtnLabel = selectedCampos.length
        ? 'Ver ' + campoFilteredCount + ' experiencia' + (campoFilteredCount !== 1 ? 's' : '')
        : 'Ver experiencias';
      var maxCamposReached = selectedCampos.length >= 3;
      body.innerHTML = [
        '<div class="beta-assistant-grid">',
        '<article class="beta-assistant-rail">',
        '<div class="beta-assistant-card-head"><span class="beta-assistant-pill">Paso 2 de 3</span><h3>¿Que campo formativo quieres trabajar?</h3><p>Selecciona etiquetas (maximo 3). Solo aparecen los campos cubiertos por las experiencias del grado seleccionado.</p></div>',
        '<div class="beta-campo-info-inline"><span>Campos formativos NEM</span><p>Los campos articulan contenidos, PDA y ejes articuladores de forma transversal en el curriculo 2022.</p></div>',
        '<div class="beta-campo-search-wrap"><input class="beta-campo-search" id="assistantCampoSearch" type="search" placeholder="Buscar campo formativo..." autocomplete="off"></div>',
        '<div class="beta-campo-tags" id="assistantCampoTags">',
        camposDisponibles.map(function (campo) {
          var n = filterResourcesByGradoAndCampo(flow.resources, flow.selectedGrado, campo).length;
          var selected = selectedCampos.indexOf(campo) !== -1;
          var disabledByLimit = maxCamposReached && !selected;
          return '<button class="beta-campo-tag ' + (selected ? 'is-active' : '') + '" type="button" data-flow-action="select-campo" data-value="' + escapeHtml(campo) + '" title="' + n + ' experiencia' + (n !== 1 ? 's' : '') + '" ' + (disabledByLimit ? 'disabled' : '') + '>' + escapeHtml(campo) + '</button>';
        }).join(''),
        '</div>',
        '<p class="beta-campo-selected-info" id="assistantCampoInfo">' + campoInfoText + '</p>',
        '<div class="beta-preview-actions mt-3">',
        '<button class="btn beta-secondary-btn" type="button" data-flow-action="to-select-grado">Regresar</button>',
        '<button class="btn beta-primary-btn" type="button" data-flow-action="to-recommendation" ' + (selectedCampos.length ? '' : 'disabled') + '>' + escapeHtml(nextBtnLabel) + '</button>',
        '</div>',
        '</article>',
        '</div>'
      ].join('');
      applyFlowActionDock(body);
      return;
    }

    if (flow.step === "recommendation") {
      setFlowKickerAndTitle("welcome");
      var gradoLabelsRec = { 1: "1er grado", 2: "2do grado", 3: "3er grado", 4: "4to grado", 5: "5to grado", 6: "6to grado" };
      var optionsByCategory = getDiscoveryOptionsByCategory(filteredByAcademic);
      var configRows = Array.isArray(flow.discoveryConfigRows) ? flow.discoveryConfigRows : [];
      var maxConfigReached = configRows.length >= MAX_STEP3_CONFIGS;
      var pickerCategory = flow.step3PickerCategory || "clima";
      var pickerValue = flow.step3PickerValue || "";
      var pickerOptions = optionsByCategory[pickerCategory] || [];
      var selectedConfigBadges = configRows.filter(function (row) {
        return row && row.category && row.value;
      }).map(function (row) {
        var category = row.category;
        var options = optionsByCategory[category] || [];
        var selectedOpt = options.find(function (opt) {
          return opt.id === row.value;
        });
        var icon = selectedOpt && selectedOpt.icono ? selectedOpt.icono : (DISCOVERY_CATEGORY_ICONS[category] || "✨");
        var label = selectedOpt && selectedOpt.title ? selectedOpt.title : row.value;
        return '<button class="beta-step3-badge" type="button" data-flow-action="remove-config-filter" data-row-id="' + row.id + '" title="Quitar tag">' + escapeHtml(icon + ' ' + label) + ' <span aria-hidden="true">×</span></button>';
      }).join('');
      var activeFilters = [
        flow.selectedGrado ? (gradoLabelsRec[flow.selectedGrado] || flow.selectedGrado + "° grado") : null,
        Array.isArray(flow.selectedCampos) && flow.selectedCampos.length ? flow.selectedCampos.join(", ") : null
      ].filter(Boolean).join(" · ");
      body.innerHTML = [
        '<div class="beta-assistant-grid beta-assistant-grid--step3">',
        '<article class="beta-step3-experience-config">',
        '<div class="beta-assistant-card-head beta-step3-head"><span class="beta-assistant-pill">Paso 3 de 3</span><h3>Configura y elige tu experiencia</h3><p>' + (activeFilters ? 'Base academica: <strong>' + escapeHtml(activeFilters) + '</strong>. Ajusta con configuracion contextual para una sugerencia precisa.' : 'Ajusta la configuracion para obtener recomendaciones precisas.') + '</p></div>',
        '<section class="beta-step3-config-panel">',
        '<div class="beta-step3-config-toolbar">',
        '<button class="btn beta-secondary-btn" type="button" data-flow-action="add-config-filter" ' + (maxConfigReached ? 'disabled' : '') + '>' + (maxConfigReached ? 'Limite de 3 tags' : 'Agregar tag') + '</button>',
        '<span class="beta-step3-limit">' + configRows.length + '/' + MAX_STEP3_CONFIGS + ' tags</span>',
        '</div>',
        '<div class="beta-step3-config-rows">' + (configRows.length ? '<div class="beta-step3-tag-cloud">' + selectedConfigBadges + '</div>' : '<div class="beta-step3-empty">Empieza con clima 😊 y agrega hasta 3 tags precisos.</div>') + '</div>',
        '<div class="beta-step3-badges"><span class="beta-step3-badge beta-step3-badge--muted">' + configRows.length + ' de ' + MAX_STEP3_CONFIGS + ' tags activos</span></div>',
        (flow.step3PickerOpen ? [
          '<div class="beta-step3-mini-modal" role="dialog" aria-modal="true" aria-label="Agregar tag de configuracion">',
          '<div class="beta-step3-mini-card">',
          '<h5>Agregar tag</h5>',
          '<p>Elige categoria y criterio del catalogo para refinar resultados.</p>',
          '<select class="form-select" data-flow-picker="category">',
          Object.keys(DISCOVERY_CATEGORY_MAP).map(function (key) {
            var categoryLabel = (DISCOVERY_CATEGORY_ICONS[key] || "✨") + ' ' + (DISCOVERY_CATEGORY_LABELS[key] || key);
            return '<option value="' + key + '" ' + (pickerCategory === key ? 'selected' : '') + '>' + escapeHtml(categoryLabel) + '</option>';
          }).join(''),
          '</select>',
          '<select class="form-select mt-2" data-flow-picker="value">',
          '<option value="">Selecciona tag</option>',
          pickerOptions.map(function (opt) {
            return '<option value="' + escapeHtml(opt.id) + '" ' + (pickerValue === opt.id ? 'selected' : '') + '>' + escapeHtml((opt.icono || '✨') + ' ' + opt.title) + '</option>';
          }).join(''),
          '</select>',
          '<div class="beta-step3-mini-actions">',
          '<button class="btn beta-secondary-btn" type="button" data-flow-action="close-config-picker">Cancelar</button>',
          '<button class="btn beta-primary-btn" type="button" data-flow-action="save-config-filter" ' + (pickerValue ? '' : 'disabled') + '>Agregar tag</button>',
          '</div>',
          '</div>',
          '</div>'
        ].join('') : ''),
        '</section>',
        '<section class="beta-step3-results">',
        '<h4 class="beta-step3-results-title">Top 5 recomendaciones</h4>',
        '<div class="beta-phase-stack">',
        (recommendations.length ? recommendations.map(function (item) {
          var resource = item.resource || {};
          var content = getContent(resource);
          var selected = flow.selectedResourceId === resource.id;
          return [
            '<article class="beta-phase-card beta-step3-result-card ' + (selected ? "is-active" : "") + '">',
            '<div class="beta-phase-topline"><strong>' + escapeHtml(truncateText(content.titulo || content.nombre_proyecto || "Experiencia", 60)) + '</strong><span>' + escapeHtml(item.category) + '</span></div>',
            '<p class="mb-2">Producto final: ' + escapeHtml(content.producto_central || "Producto comunitario") + '</p>',
            '<button class="beta-copilot-btn ' + (selected ? "is-active" : "") + '" type="button" data-flow-action="select-resource" data-resource-id="' + escapeHtml(resource.id || "") + '">Seleccionar</button>',
            '</article>'
          ].join("");
        }).join("") : '<article class="beta-phase-card"><div class="beta-phase-topline"><strong>Sin resultados con esta configuracion</strong><span>Ajusta o quita criterios para ampliar opciones.</span></div></article>'),
        '</div>',
        '</section>',
        '<div class="beta-step3-actions">',
        '<button class="btn beta-secondary-btn" type="button" data-flow-action="to-select-campo">Regresar</button>',
        '<button class="btn beta-primary-btn" type="button" data-flow-action="to-configuration" ' + (flow.selectedResourceId ? "" : "disabled") + '>Configurar ruta</button>',
        '</div>',
        '</article>',
        '</div>'
      ].join("");
      return;
    }

    if (flow.step === "configuration") {
      setFlowKickerAndTitle("configuration");
      var selectedResource = findResourceById(flow.resources, flow.selectedResourceId);
      var totalSessions = selectedResource ? getTotalSessions(selectedResource) : 8;
      var plan = calculatePlan(totalSessions, flow.classDuration, flow.daysPerWeek);
      body.innerHTML = [
        '<div class="beta-assistant-grid">',
        '<article class="beta-assistant-rail">',
        '<div class="beta-assistant-card-head"><span class="beta-assistant-pill">Ruta de implementacion</span><h3>Ajusta a tu contexto real</h3><p>Concilio automaticamente sesiones, semanas y duracion planificada.</p></div>',
        '<div class="beta-assistant-checklist">',
        '<div><strong>T</strong><span>Duracion por sesion: ' + flow.classDuration + ' min</span></div>',
        '<div><strong>F</strong><span>Frecuencia semanal: ' + flow.daysPerWeek + ' sesion(es)</span></div>',
        '<div><strong>S</strong><span>Semanas estimadas: ' + plan.plannedWeeks + '</span></div>',
        '</div>',
        '<div class="beta-copilot-actions mt-3"><button class="beta-copilot-btn ' + (flow.classDuration === 30 ? "is-active" : "") + '" type="button" data-flow-action="duration" data-value="30">30 min</button><button class="beta-copilot-btn ' + (flow.classDuration === 50 ? "is-active" : "") + '" type="button" data-flow-action="duration" data-value="50">50 min</button><button class="beta-copilot-btn ' + (flow.classDuration === 70 ? "is-active" : "") + '" type="button" data-flow-action="duration" data-value="70">70 min</button></div>',
        '<div class="beta-copilot-actions"><button class="beta-copilot-btn ' + (flow.daysPerWeek === 1 ? "is-active" : "") + '" type="button" data-flow-action="days" data-value="1">1 dia/semana</button><button class="beta-copilot-btn ' + (flow.daysPerWeek === 2 ? "is-active" : "") + '" type="button" data-flow-action="days" data-value="2">2 dias/semana</button><button class="beta-copilot-btn ' + (flow.daysPerWeek === 3 ? "is-active" : "") + '" type="button" data-flow-action="days" data-value="3">3 dias/semana</button></div>',
        '<div class="beta-preview-actions mt-3"><button class="btn beta-secondary-btn" type="button" data-flow-action="to-recommendation">Regresar</button><button class="btn beta-primary-btn" type="button" data-flow-action="save-route" ' + (flow.selectedResourceId ? "" : "disabled") + '>Guardar ruta e iniciar</button></div>',
        '</article>',
        '<article class="beta-assistant-preview"><div class="beta-preview-panel"><div class="beta-preview-panel-head"><span>Regla automatica</span><p>Semanas requeridas = ceil(sesiones totales / sesiones por semana).</p></div></div></article>',
        '</div>'
      ].join("");
      applyFlowActionDock(body);
      return;
    }

    if (flow.step === "active" && active) {
      setFlowKickerAndTitle("active");
      body.innerHTML = [
        '<div class="beta-assistant-grid">',
        '<article class="beta-assistant-rail">',
        '<div class="beta-assistant-card-head"><span class="beta-assistant-pill">Continuidad activa</span><h3>' + escapeHtml(active.title) + '</h3><p>Sesion ' + clamp(active.currentSession, 1, active.totalSessions) + ' de ' + active.totalSessions + ' | Momento: ' + escapeHtml(active.currentMoment) + '</p></div>',
        '<ul class="beta-copilot-list">' + (active.todayTasks || []).slice(0, 3).map(function (task) {
          return '<li>' + escapeHtml(task) + '</li>';
        }).join("") + '</ul>',
        '<div class="beta-preview-actions mt-3"><button class="btn beta-primary-btn" type="button" data-flow-action="go-visualizer">Continuar sesion</button><button class="btn beta-secondary-btn" type="button" data-flow-action="to-log">Registrar cierre rapido</button></div>',
        '</article>',
        '<article class="beta-assistant-preview"><div class="beta-preview-panel"><div class="beta-preview-panel-head"><span>Adaptacion IA</span><p>Solo ajusto conduccion, ritmo y tiempo disponible. La secuencia pedagogica permanece intacta.</p></div></div></article>',
        '</div>'
      ].join("");
      applyFlowActionDock(body);
      return;
    }

    if (flow.step === "log" && active) {
      setFlowKickerAndTitle("active");
      body.innerHTML = [
        '<article class="beta-assistant-preview">',
        '<div class="beta-preview-panel">',
        '<div class="beta-preview-panel-head"><span>Bitacora automatica</span><p>Registra observaciones docentes y actualizo continuidad.</p></div>',
        '<div class="mb-3"><label for="assistantNotes" class="form-label">Observaciones de implementacion</label><textarea id="assistantNotes" class="form-control" rows="4" placeholder="Ej. El grupo participo mas al usar ejemplos de su comunidad."></textarea></div>',
        '<div class="mb-3"><label class="form-label">Sesion completada?</label><div><label><input type="radio" name="assistantCompleted" value="si" checked> Si</label> <label class="ms-2"><input type="radio" name="assistantCompleted" value="no"> No, avanzar parcial</label></div></div>',
        '<div class="beta-preview-actions"><button class="btn beta-secondary-btn" type="button" data-flow-action="to-active">Volver</button><button class="btn beta-primary-btn" type="button" data-flow-action="save-log">Guardar y recalcular</button></div>',
        '</div>',
        '</article>'
      ].join("");
      applyFlowActionDock(body);
      return;
    }

    flow.step = assistantState.activeExperience ? "active" : "welcome";
    renderAssistantFlow(flow, assistantState);
  }

  function updateAfterLog(flow, assistantState) {
    var active = assistantState.activeExperience;
    if (!active) {
      return assistantState;
    }

    var complete = flow.completed !== "no";
    var notes = (flow.notes || "").trim();
    var nextSession = active.currentSession;

    if (complete && active.currentSession < active.totalSessions) {
      nextSession += 1;
    }

    var resource = findResourceById(appState.resources, active.resourceId);
    var sessionObj = resource ? getSession(resource, Math.max(0, nextSession - 1)) : null;
    var momentObj = resource ? getCurrentMoment(resource, sessionObj) : null;
    var progress = clamp(Math.round((nextSession / Math.max(1, active.totalSessions)) * 100), 0, 100);

    var updated = Object.assign({}, active, {
      currentSession: nextSession,
      progress: progress,
      calendarProgress: computeCalendarProgress(active),
      currentMoment: (momentObj && momentObj.nombre) || active.currentMoment,
      todayObjective: (momentObj && momentObj.descripcion_completa) || active.todayObjective,
      todayTasks: Array.isArray(sessionObj && sessionObj.actividades) ? sessionObj.actividades.slice(0, 3) : active.todayTasks,
      remainingSessions: Math.max(0, active.totalSessions - nextSession)
    });

    var nextState = setAssistantState({
      activeExperience: updated,
      lastLog: {
        date: new Date().toISOString(),
        notes: notes,
        completed: complete
      }
    });

    safeSetLocalStorage(PROGRESS_KEY_PREFIX + updated.resourceId, String(updated.progress));
    safeSetLocalStorage(STATUS_KEY_PREFIX + updated.resourceId, updated.progress >= 100 ? "completado" : "en-curso");

    return nextState;
  }

  function initAssistantFlow() {
    var modalElement = document.getElementById("betaAssistantFlowModal");
    var modalBody = document.getElementById("betaAssistantFlowBody");

    if (!modalElement || !modalBody) {
      return;
    }

    var flow = createAssistantFlow(appState.resources, getAssistantState());

    function setStep(step) {
      flow.step = step;
      renderAssistantFlow(flow, getAssistantState());
    }

    modalBody.addEventListener("click", function (event) {
      var button = event.target.closest("[data-flow-action]");
      if (!button) {
        return;
      }

      var action = button.getAttribute("data-flow-action");
      var resourceId = button.getAttribute("data-resource-id") || "";
      var value = parseInt(button.getAttribute("data-value"), 10);

      if (action === "to-discovery" || action === "to-select-grado") return setStep("select-grado");
      if (action === "to-select-campo") {
        if (flow.selectedGrado === null) return;
        return setStep("select-campo");
      }
      if (action === "to-welcome") return setStep("welcome");
      if (action === "to-recommendation") {
        if (!flow.selectedCampos || !flow.selectedCampos.length) return;
        return setStep("recommendation");
      }
      if (action === "to-configuration") {
        if (!flow.selectedResourceId) return;
        return setStep("configuration");
      }
      if (action === "to-active") return setStep("active");
      if (action === "to-log") return setStep("log");
      if (action === "select-grado") {
        var gradoVal = parseInt(button.getAttribute("data-value"), 10);
        flow.selectedGrado = isNaN(gradoVal) ? null : gradoVal;
        flow.selectedCampos = [];
        flow.discoveryConfigRows = [];
        flow.selectedResourceId = "";
        return renderAssistantFlow(flow, getAssistantState());
      }
      if (action === "select-campo") {
        var campoValue = button.getAttribute("data-value") || "";
        var currentCampos = Array.isArray(flow.selectedCampos) ? flow.selectedCampos.slice() : [];
        var existingIndex = currentCampos.indexOf(campoValue);

        if (existingIndex !== -1) {
          currentCampos.splice(existingIndex, 1);
        } else if (campoValue && currentCampos.length < 3) {
          currentCampos.push(campoValue);
        }

        flow.selectedCampos = currentCampos;
        flow.selectedResourceId = "";
        return renderAssistantFlow(flow, getAssistantState());
      }
      if (action === "add-config-filter") {
        if (!Array.isArray(flow.discoveryConfigRows)) {
          flow.discoveryConfigRows = [];
        }
        if (flow.discoveryConfigRows.length >= MAX_STEP3_CONFIGS) {
          return;
        }
        flow.step3PickerOpen = true;
        flow.step3PickerCategory = flow.step3PickerCategory || "clima";
        flow.step3PickerValue = "";
        return renderAssistantFlow(flow, getAssistantState());
      }
      if (action === "close-config-picker") {
        flow.step3PickerOpen = false;
        flow.step3PickerValue = "";
        return renderAssistantFlow(flow, getAssistantState());
      }
      if (action === "save-config-filter") {
        var categoryToSave = flow.step3PickerCategory || "";
        var valueToSave = flow.step3PickerValue || "";
        if (!categoryToSave || !valueToSave) {
          return;
        }

        var duplicated = (flow.discoveryConfigRows || []).some(function (row) {
          return row && row.category === categoryToSave && row.value === valueToSave;
        });

        if (!duplicated && flow.discoveryConfigRows.length < MAX_STEP3_CONFIGS) {
          flow.discoveryConfigRows.push({ id: flow.nextConfigRowId++, category: categoryToSave, value: valueToSave });
        }

        flow.step3PickerOpen = false;
        flow.step3PickerValue = "";
        flow.selectedResourceId = "";
        return renderAssistantFlow(flow, getAssistantState());
      }
      if (action === "remove-config-filter") {
        var removeId = parseInt(button.getAttribute("data-row-id"), 10);
        flow.discoveryConfigRows = (flow.discoveryConfigRows || []).filter(function (row) {
          return row.id !== removeId;
        });
        flow.selectedResourceId = "";
        return renderAssistantFlow(flow, getAssistantState());
      }
      if (action === "duration") {
        flow.classDuration = isNaN(value) ? flow.classDuration : value;
        return renderAssistantFlow(flow, getAssistantState());
      }
      if (action === "days") {
        flow.daysPerWeek = isNaN(value) ? flow.daysPerWeek : value;
        return renderAssistantFlow(flow, getAssistantState());
      }
      if (action === "select-resource") {
        flow.selectedResourceId = resourceId;
        return renderAssistantFlow(flow, getAssistantState());
      }
      if (action === "start-now" || action === "save-route") {
        var selected = findResourceById(appState.resources, flow.selectedResourceId);
        if (!selected) return;

        var active = composeActiveExperience(selected, {
          classDuration: flow.classDuration,
          daysPerWeek: flow.daysPerWeek
        });
        var pending = action === "start-now";
        saveActiveExperience(active, pending);
        renderHome();
        if (window.bootstrap && window.bootstrap.Modal) {
          window.bootstrap.Modal.getOrCreateInstance(modalElement).hide();
        }
        return;
      }
      if (action === "go-visualizer") {
        var state = getAssistantState();
        var activeExperience = state.activeExperience;
        if (!activeExperience) return;
        var activeResource = findResourceById(appState.resources, activeExperience.resourceId);
        if (!activeResource) return;
        window.location.href = buildVisualizerUrl(activeResource);
        return;
      }
      if (action === "save-log") {
        var notesInput = document.getElementById("assistantNotes");
        flow.notes = notesInput ? notesInput.value.trim() : "";
        var next = updateAfterLog(flow, getAssistantState());
        setAssistantState(next);
        renderHome();
        setStep("active");
        return;
      }
    });

    modalBody.addEventListener("change", function (event) {
      var target = event.target;
      if (!target) return;
      if (target.name === "assistantCompleted") {
        flow.completed = target.value;
        return;
      }

      var pickerType = target.getAttribute("data-flow-picker");
      if (!pickerType) {
        return;
      }

      if (pickerType === "category") {
        flow.step3PickerCategory = target.value || "clima";
        flow.step3PickerValue = "";
        return renderAssistantFlow(flow, getAssistantState());
      }

      if (pickerType === "value") {
        flow.step3PickerValue = target.value || "";
        return renderAssistantFlow(flow, getAssistantState());
      }
    });

    modalBody.addEventListener("input", function (event) {
      var target = event.target;
      if (!target || target.id !== "assistantCampoSearch") return;
      var query = (target.value || "").trim().toLowerCase();
      var tags = modalBody.querySelectorAll(".beta-campo-tag");
      tags.forEach(function (tag) {
        var text = (tag.textContent || "").toLowerCase();
        tag.classList.toggle("is-hidden", !!(query && text.indexOf(query) === -1));
      });
    });

    modalElement.addEventListener("show.bs.modal", function () {
      var currentState = getAssistantState();
      flow = createAssistantFlow(appState.resources, currentState);

      if (appState.selectedRecommendationId) {
        flow.selectedResourceId = appState.selectedRecommendationId;
      }

      if (appState.assistantEntryStep) {
        flow.step = appState.assistantEntryStep;
      } else {
        flow.step = currentState.activeExperience ? "active" : "welcome";
      }

      renderAssistantFlow(flow, currentState);
      appState.assistantEntryStep = null;
      appState.selectedRecommendationId = "";
    });
  }

  function initHomeActions() {
    document.addEventListener("click", function (event) {
      var control = event.target.closest("[data-home-action]");
      if (!control) {
        return;
      }

      var action = control.getAttribute("data-home-action");
      var mode = control.getAttribute("data-mode");
      var resourceId = control.getAttribute("data-resource-id") || "";
      var entryStep = control.getAttribute("data-entry-step");

      if (action === "open-assistant") {
        appState.assistantEntryStep = entryStep || null;
        appState.selectedRecommendationId = resourceId || "";
        var modal = document.getElementById("betaAssistantFlowModal");
        if (modal && window.bootstrap && window.bootstrap.Modal) {
          window.bootstrap.Modal.getOrCreateInstance(modal).show();
        }
        return;
      }

      if (action === "quick-start") {
        var selected = findResourceById(appState.resources, resourceId);
        if (!selected) {
          return;
        }
        var active = composeActiveExperience(selected, {
          classDuration: 50,
          daysPerWeek: 2
        });
        saveActiveExperience(active, true);
        renderHome();
        return;
      }

      if (action === "continue-active") {
        var state = getAssistantState();
        var activeExperience = state.activeExperience;
        if (!activeExperience) {
          return;
        }
        var resource = findResourceById(appState.resources, activeExperience.resourceId);
        if (!resource) {
          return;
        }
        window.location.href = buildVisualizerUrl(resource);
        return;
      }

      if (action === "switch-experience") {
        var carousel = document.getElementById("exp-carousel");
        if (carousel) {
          carousel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }

      if (action === "tempo-mode") {
        setAssistantState({ tempoMode: mode || "normal" });
        renderHome();
      }
    });
  }

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
    }, { threshold: 0.18 });

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

  function initScrollProgress() {
    var bar = document.getElementById("betaScrollProgressBar");
    if (!bar) {
      return;
    }

    var update = function () {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      var progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      bar.style.width = clamp(progress, 0, 100) + "%";
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function fillUserHeader() {
    var profile = getTeacherProfile();
    var name = profile.nombre || profile.name || "Docente";
    var avatar = profile.avatar || profile.foto || "assets/img/icons/users/default.png";

    var nameEl = document.getElementById("betaUserName");
    var avatarEl = document.getElementById("betaUserAvatar");

    if (nameEl) nameEl.textContent = name;
    if (avatarEl) avatarEl.src = avatar;

    function updateDateTime() {
      var now = new Date();
      var dateStr = now.toLocaleDateString("es-MX", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      var timeStr = now.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit"
      });
      var dateEl = document.getElementById("betaUserDate");
      var timeEl = document.getElementById("betaUserTime");
      if (dateEl) dateEl.textContent = dateStr;
      if (timeEl) timeEl.textContent = timeStr;
    }

    updateDateTime();
    setInterval(updateDateTime, 30000);
  }

  function renderHome() {
    var assistantState = getAssistantState();
    var progressItems = getProgressItems(appState.resources, assistantState);
    updateDashboardKPIs(progressItems);
    updateExperienceHeading(progressItems.length > 0);
    renderExperienceCards(progressItems);
    renderHero(assistantState, progressItems);
    renderCopilotSurface(appState.resources, assistantState);
    initRevealCards();
  }

  function boot() {
    fillUserHeader();
    initExperienceCarousel();
    initScrollProgress();
    initHomeActions();

    var phase = getTeacherPhase();
    Promise.all([loadResourcesByPhase(phase), loadDiscoveryCatalog()])
      .then(function (results) {
        appState.resources = results[0] || [];
        appState.discoveryCatalog = results[1] || {};
        renderHome();
        initAssistantFlow();
      })
      .catch(function () {
        appState.resources = [];
        appState.discoveryCatalog = {};
        renderHome();
        initAssistantFlow();
      });
  }

  boot();
})();
