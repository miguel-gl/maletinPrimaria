(function () {
  "use strict";

  var JSON_URL = "src/metadata/goals.json";
  var LS_CYCLE_KEY = "gp_ciclo_activo";
  var LS_MICRO_PREFIX = "gp_micro_";
  var MS_WEEK = 7 * 24 * 60 * 60 * 1000;

  var CHIP_CLASS = {
    "Lenguajes": "gp-chip-blue",
    "Saberes y Pensamiento Científico": "gp-chip-teal",
    "Ética, Naturaleza y Sociedades": "gp-chip-purple",
    "De lo Humano y lo Comunitario": "gp-chip-coral"
  };

  var MOMENTO_LABELS = {
    inicio_de_semana: "Inicio de semana — Lunes",
    mitad_de_semana: "Mitad de semana — Miércoles",
    cierre_de_semana: "Cierre de semana — Viernes"
  };

  var TIPO_COLOR = {
    "diagnóstico": "#185FA5",
    "vinculación": "#1D9E75",
    "planeación": "#7B61FF",
    "organización": "#EF9F27",
    "seguimiento": "#E05E5E",
    "evaluación": "#185FA5",
    "comunidad": "#1D9E75",
    "reflexión": "#7B61FF"
  };

  var state = {
    data: null,
    cicloId: null,
    semana: 1,
    totalSemanas: 44,
    momento: "inicio_de_semana"
  };

  /* ── Utils ── */

  function safeLS(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, String(val));
    } catch (_) { return null; }
  }

  function esc(v) {
    return String(v || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── Cycle / week math ── */

  function weeksInCycle(ciclo) {
    return Math.max(1, Math.ceil((new Date(ciclo.fin) - new Date(ciclo.inicio)) / MS_WEEK));
  }

  function currentWeek(ciclo) {
    var start = new Date(ciclo.inicio);
    var end = new Date(ciclo.fin);
    var now = new Date();
    if (now < start) return 1;
    if (now > end) return weeksInCycle(ciclo);
    return Math.max(1, Math.floor((now - start) / MS_WEEK) + 1);
  }

  function weekStartDate(ciclo, semana) {
    return new Date(new Date(ciclo.inicio).getTime() + (semana - 1) * MS_WEEK);
  }

  function getMomento() {
    var d = new Date().getDay();
    if (d === 0 || d === 1) return "inicio_de_semana";
    if (d <= 3)             return "mitad_de_semana";
    return "cierre_de_semana";
  }

  /* ── Data resolvers ── */

  function getPeriodo(ciclo, semana) {
    var date = weekStartDate(ciclo, semana);
    return ciclo.periodos.find(function (p) {
      return date >= new Date(p.inicio) && date <= new Date(p.fin);
    }) || ciclo.periodos[ciclo.periodos.length - 1];
  }

  function getPeriodoIndex(ciclo, periodo) {
    return Math.max(0, ciclo.periodos.indexOf(periodo));
  }

  function getAccionClave(ciclo, periodo, semana) {
    var acciones = (periodo && periodo.acciones_clave) || [];
    if (!acciones.length) return null;
    var pStart = new Date(periodo.inicio);
    var wDate  = weekStartDate(ciclo, semana);
    var semEnP = Math.max(1, Math.floor((wDate - pStart) / MS_WEEK) + 1);
    var best = acciones[0];
    var bestDiff = Math.abs((best.semana_sugerida || 1) - semEnP);
    acciones.forEach(function (a) {
      var diff = Math.abs((a.semana_sugerida || 1) - semEnP);
      if (diff < bestDiff) { best = a; bestDiff = diff; }
    });
    return best;
  }

  function getMetaActiva(ciclo, periodoIdx) {
    var metas = ciclo.metas_generales || [];
    return metas.length ? metas[periodoIdx % metas.length] : null;
  }

  function getFechaProxima(ciclo, semana, ventana) {
    var from = weekStartDate(ciclo, semana).getTime();
    var to   = from + ventana * 24 * 60 * 60 * 1000;
    return (ciclo.fechas_importantes || []).find(function (f) {
      var t = new Date(f.fecha).getTime();
      return t >= from && t <= to;
    }) || null;
  }

  function getMicros(ciclo, momento) {
    var acc = (ciclo.acciones_semanales_sugeridas || {});
    return acc[momento] || [];
  }

  function microKey(cicloId, semana, momento, idx) {
    return LS_MICRO_PREFIX + cicloId + "_s" + semana + "_" + momento + "_" + idx;
  }

  /* ── HTML builders ── */

  function chipHtml(campo) {
    var cls = CHIP_CLASS[campo] || "gp-chip-amber";
    return '<span class="gp-chip ' + cls + '">' + esc(campo) + '</span>';
  }

  function buildAlert(fecha) {
    if (!fecha) return "";
    return [
      '<div class="gp-alert-wrap">',
      '<div class="gp-alert">',
      '<span class="gp-alert-icon" aria-hidden="true">&#9733;</span>',
      '<div style="flex:1;min-width:0">',
      '<strong>' + esc(fecha.nombre) + '</strong>',
      '<p>' + esc(fecha.accion_sugerida) + '</p>',
      '<span class="gp-alert-chip">' + chipHtml(fecha.campo_formativo) + '</span>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");
  }

  function buildMetaCard(meta) {
    if (!meta) return "";
    return [
      '<article class="gp-card gp-card--meta">',
      '<div class="gp-section-hd"><span class="gp-badge-dot" style="background:var(--gp-accent-meta)"></span>Meta general activa</div>',
      chipHtml(meta.campo_formativo),
      '<p class="gp-card-title">' + esc(meta.meta) + '</p>',
      '<ul class="gp-indicators">',
      meta.indicadores.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join(""),
      '</ul>',
      '</article>'
    ].join("");
  }

  function buildAccionCard(accion) {
    if (!accion) return "";
    var tipoCss = TIPO_COLOR[accion.tipo] || "#5e647b";
    return [
      '<article class="gp-card gp-card--accion">',
      '<div class="gp-section-hd"><span class="gp-badge-dot" style="background:var(--gp-accent-accion)"></span>Accion clave del periodo</div>',
      '<span class="gp-tipo-badge" style="border-color:' + tipoCss + ';color:' + tipoCss + '">' + esc(accion.tipo) + '</span>',
      '<p class="gp-card-title">' + esc(accion.titulo) + '</p>',
      '</article>'
    ].join("");
  }

  function buildPasoCard(accion, semana) {
    if (!accion) return "";
    return [
      '<article class="gp-card gp-card--paso">',
      '<div class="gp-section-hd"><span class="gp-badge-dot" style="background:var(--gp-accent-paso)"></span>Paso semanal · Semana ' + semana + '</div>',
      '<p class="gp-card-title">Esta semana</p>',
      '<p class="gp-card-desc">' + esc(accion.descripcion) + '</p>',
      '</article>'
    ].join("");
  }

  function buildMicrosCard(micros, cicloId, semana, momento) {
    return [
      '<article class="gp-card gp-card--micro">',
      '<div class="gp-section-hd"><span class="gp-badge-dot" style="background:var(--gp-accent-micro)"></span>Micro-acciones de hoy</div>',
      '<p class="gp-momento-label">' + esc(MOMENTO_LABELS[momento] || momento) + '</p>',
      '<div class="gp-micros-list" id="gp-micros-list">',
      micros.map(function (text, idx) {
        var key  = microKey(cicloId, semana, momento, idx);
        var done = safeLS(key) === "1";
        return [
          '<div class="gp-micro-item" role="checkbox" aria-checked="' + done + '" tabindex="0" data-micro="' + esc(key) + '">',
          '<div class="gp-check-circle' + (done ? " is-done" : "") + '" aria-hidden="true">',
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
          '</div>',
          '<span class="gp-micro-text' + (done ? " is-done" : "") + '">' + esc(text) + '</span>',
          '</div>'
        ].join("");
      }).join(""),
      '</div>',
      '</article>'
    ].join("");
  }

  /* ── Render ── */

  function render() {
    var mainEl   = document.getElementById("gp-main");
    var fillEl   = document.getElementById("gp-progress-fill");
    var labelEl  = document.getElementById("gp-week-label");
    var ctxEl    = document.getElementById("gp-context-label");
    var prevBtn  = document.getElementById("gp-prev-btn");
    var nextBtn  = document.getElementById("gp-next-btn");
    if (!mainEl) return;

    var data   = state.data;
    var ciclo  = data.ciclos.find(function (c) { return c.id === state.cicloId; });
    if (!ciclo) { mainEl.innerHTML = '<p class="gp-placeholder">Ciclo no encontrado.</p>'; return; }

    var semana  = state.semana;
    var total   = state.totalSemanas;
    var momento = state.momento;

    if (fillEl)  fillEl.style.width = Math.round((semana / total) * 100) + "%";
    if (labelEl) labelEl.textContent = "Semana " + semana + " / " + total;

    var periodo    = getPeriodo(ciclo, semana);
    var periodoIdx = getPeriodoIndex(ciclo, periodo);

    if (ctxEl) {
      ctxEl.innerHTML = esc(ciclo.id) + ' &middot; <span class="gp-context-periodo">' + esc(periodo ? periodo.nombre : "") + '</span>';
    }
    if (prevBtn) prevBtn.disabled = semana <= 1;
    if (nextBtn) nextBtn.disabled = semana >= total;

    var meta   = getMetaActiva(ciclo, periodoIdx);
    var accion = getAccionClave(ciclo, periodo, semana);
    var fecha  = getFechaProxima(ciclo, semana, 7);
    var micros = getMicros(ciclo, momento);

    mainEl.innerHTML = [
      buildAlert(fecha),
      buildMetaCard(meta),
      buildAccionCard(accion),
      buildPasoCard(accion, semana),
      buildMicrosCard(micros, state.cicloId, semana, momento)
    ].join("");
  }

  /* ── Event wiring ── */

  function bindCycleSelect() {
    var sel = document.getElementById("gp-cycle-select");
    if (!sel || !state.data) return;
    state.data.ciclos.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = "Ciclo " + c.id;
      if (c.id === state.cicloId) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
      state.cicloId = sel.value;
      safeLS(LS_CYCLE_KEY, state.cicloId);
      var ciclo = state.data.ciclos.find(function (c) { return c.id === state.cicloId; });
      if (ciclo) {
        state.totalSemanas = weeksInCycle(ciclo);
        state.semana       = currentWeek(ciclo);
      }
      render();
    });
  }

  function bindNavButtons() {
    var prev = document.getElementById("gp-prev-btn");
    var next = document.getElementById("gp-next-btn");
    if (prev) {
      prev.addEventListener("click", function () {
        if (state.semana > 1) { state.semana--; render(); }
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        if (state.semana < state.totalSemanas) { state.semana++; render(); }
      });
    }
  }

  function bindMicroActions() {
    var main = document.getElementById("gp-main");
    if (!main) return;
    main.addEventListener("click", function (e) {
      var item = e.target.closest("[data-micro]");
      if (!item) return;
      toggleMicro(item);
    });
    main.addEventListener("keydown", function (e) {
      if (e.key !== " " && e.key !== "Enter") return;
      var item = e.target.closest("[data-micro]");
      if (!item) return;
      e.preventDefault();
      toggleMicro(item);
    });
  }

  function toggleMicro(item) {
    var key  = item.getAttribute("data-micro");
    var done = safeLS(key) === "1";
    safeLS(key, done ? "0" : "1");
    var circle = item.querySelector(".gp-check-circle");
    var text   = item.querySelector(".gp-micro-text");
    if (circle) circle.classList.toggle("is-done", !done);
    if (text)   text.classList.toggle("is-done", !done);
    item.setAttribute("aria-checked", String(!done));
  }

  /* ── Boot ── */

  function boot() {
    var mainEl = document.getElementById("gp-main");
    if (!mainEl) return;

    mainEl.innerHTML = '<p class="gp-placeholder">Cargando panel de metas…</p>';

    fetch(JSON_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        state.data = data;

        var saved = safeLS(LS_CYCLE_KEY);
        var ciclo = (saved && data.ciclos.find(function (c) { return c.id === saved; }))
                  || data.ciclos[0];

        state.cicloId      = ciclo.id;
        state.totalSemanas = weeksInCycle(ciclo);
        state.semana       = currentWeek(ciclo);
        state.momento      = getMomento();

        bindCycleSelect();
        bindNavButtons();
        bindMicroActions();
        render();
      })
      .catch(function () {
        var el = document.getElementById("gp-main");
        if (el) el.innerHTML = '<p class="gp-placeholder">No se pudo cargar el panel de metas docentes.</p>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
