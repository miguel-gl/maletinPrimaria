function normalizeValue(value) {
  if (value == null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const DISCOVERY_ID_ALIASES = {
  mucha_participacion: 'alta_participacion',
};

const DISCOVERY_CATEGORY_MAP = {
  energia: 'energia_y_dinamica_grupo',
  recursos: 'recursos_y_preparacion',
  experiencia: 'tipo_experiencia_aprendizaje',
  intencion: 'intencion_pedagogica',
  enfoque: 'enfoque_metodologico_nem',
  clima: 'clima_emocional_aula',
};

function normalizeDiscoveryId(value) {
  const normalized = normalizeValue(value);
  return DISCOVERY_ID_ALIASES[normalized] || normalized;
}

function hasFilterValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => normalizeValue(item) !== '');
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => hasFilterValue(item));
  }

  return normalizeValue(value) !== '';
}

function getDiscoveryContextByCategory(resource) {
  const rawContext = resource?.enriquecimiento_ia?.descubrimiento_contextual || {};

  return Object.entries(DISCOVERY_CATEGORY_MAP).reduce((acc, [uiCategory, metadataCategory]) => {
    acc[uiCategory] = (rawContext?.[metadataCategory] || [])
      .map((item) => normalizeDiscoveryId(item?.id))
      .filter(Boolean);
    return acc;
  }, {});
}

function matchesDiscoveryContext(resource, expectedContext = {}) {
  const currentContext = getDiscoveryContextByCategory(resource);

  return Object.entries(expectedContext).every(([category, selectedIds]) => {
    const normalizedSelectedIds = (Array.isArray(selectedIds) ? selectedIds : [selectedIds])
      .map((item) => normalizeDiscoveryId(item))
      .filter(Boolean);

    if (normalizedSelectedIds.length === 0) {
      return true;
    }

    const currentIds = currentContext[category] || [];
    return normalizedSelectedIds.some((id) => currentIds.includes(id));
  });
}

function matchesFilter(resource, key, expected) {
  const expectedText = normalizeValue(expected);
  if (!expectedText) return true;

  const contenido = resource?.contenido || {};
  const clasificacion = resource?.clasificacion || {};

  const dictionary = {
    fase: clasificacion.fase,
    grado: clasificacion.grado,
    tipo_recurso: clasificacion.tipo_recurso,
    categoria_pedagogica: clasificacion.categoria_pedagogica,
    titulo: contenido.titulo,
    nombre_proyecto: contenido.nombre_proyecto,
  };

  if (key === 'campo_formativo') {
    const campos = (contenido.campos_formativos || []).map((c) => normalizeValue(c?.campo));
    return campos.some((c) => c.includes(expectedText));
  }

  const current = normalizeValue(dictionary[key]);
  return current.includes(expectedText);
}

function matchesAllFilters(resource, filters = {}) {
  return Object.entries(filters).every(([key, value]) => {
    if (!hasFilterValue(value)) {
      return true;
    }

    if (key === 'discoveryContext') {
      return matchesDiscoveryContext(resource, value);
    }

    return matchesFilter(resource, key, value);
  });
}

function metadataMatchCount(resource, filters = {}) {
  const entries = Object.entries(filters).filter(([, value]) => hasFilterValue(value));

  if (entries.length === 0) return 0;

  let score = 0;
  for (const [key, value] of entries) {
    if (key === 'discoveryContext') {
      const currentContext = getDiscoveryContextByCategory(resource);

      Object.entries(value || {}).forEach(([category, selectedIds]) => {
        const normalizedSelectedIds = (Array.isArray(selectedIds) ? selectedIds : [selectedIds])
          .map((item) => normalizeDiscoveryId(item))
          .filter(Boolean);

        if (normalizedSelectedIds.length === 0) {
          return;
        }

        const currentIds = currentContext[category] || [];
        if (normalizedSelectedIds.some((id) => currentIds.includes(id))) {
          score += 1;
        }
      });
      continue;
    }

    if (matchesFilter(resource, key, value)) {
      score += 1;
    }
  }

  return score;
}

function rankResults(results, filters = {}) {
  return results
    .map((item) => ({
      ...item,
      metadataScore: metadataMatchCount(item.resource, filters),
    }))
    .sort((a, b) => {
      // Prioridad 1: Similitud semántica (score)
      if (b.score !== a.score) return b.score - a.score;
      // Prioridad 2: Coincidencia de filtros de metadata (solo si hay filtros activos)
      if (b.metadataScore !== a.metadataScore) return b.metadataScore - a.metadataScore;
      return 0;
    });
}

module.exports = {
  matchesAllFilters,
  rankResults,
};
