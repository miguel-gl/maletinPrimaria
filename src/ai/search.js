const fs = require('fs');
const path = require('path');

const { createEmbedding } = require('./embedder');
const { matchesAllFilters, rankResults } = require('./ranker');

const EMBEDDINGS_CANDIDATES = [
  path.resolve(__dirname, '../metadata/fase3/embeddings.json'),
  path.resolve(__dirname, '../metadata/embeddings.fase3.json'),
  path.resolve(__dirname, '../metadata/embeddings.json'),
];

const RESOURCES_CANDIDATES = [
  path.resolve(__dirname, '../metadata/resources.json'),
  path.resolve(__dirname, '../metadata/fase3/planos_didacticos.json'),
];

const DISCOVERY_CONTEXT_CANDIDATES = [
  path.resolve(__dirname, '../metadata/fase3/planos_didacticos.json'),
];

let cache = {
  resourcesPath: '',
  embeddingsPath: '',
  resourcesMtime: 0,
  embeddingsMtime: 0,
  resources: [],
  embeddings: [],
};

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function pickExistingPath(candidates, label) {
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`No existe archivo de ${label}. Se intentó en: ${candidates.join(', ')}`);
  }
  return found;
}

function mergeDiscoveryContext(resources, discoverySource) {
  if (!Array.isArray(resources) || !Array.isArray(discoverySource)) {
    return resources;
  }

  const discoveryById = new Map();
  const discoveryByFile = new Map();

  discoverySource.forEach((resource) => {
    const discoveryContext = resource?.enriquecimiento_ia?.descubrimiento_contextual;
    if (!discoveryContext || Object.keys(discoveryContext).length === 0) {
      return;
    }

    if (resource.id) {
      discoveryById.set(resource.id, discoveryContext);
    }

    const routeKey = resource?.archivo?.ruta || resource?.archivo?.nombre;
    if (routeKey) {
      discoveryByFile.set(routeKey, discoveryContext);
    }
  });

  return resources.map((resource) => {
    const currentDiscoveryContext = resource?.enriquecimiento_ia?.descubrimiento_contextual;
    if (currentDiscoveryContext && Object.keys(currentDiscoveryContext).length > 0) {
      return resource;
    }

    const fileKey = resource?.archivo?.ruta || resource?.archivo?.nombre;
    const fallbackDiscoveryContext = discoveryById.get(resource.id) || discoveryByFile.get(fileKey);
    if (!fallbackDiscoveryContext || Object.keys(fallbackDiscoveryContext).length === 0) {
      return resource;
    }

    return {
      ...resource,
      enriquecimiento_ia: {
        ...(resource.enriquecimiento_ia || {}),
        descubrimiento_contextual: fallbackDiscoveryContext,
      },
    };
  });
}

function loadData() {
  const resourcesPath = pickExistingPath(RESOURCES_CANDIDATES, 'resources');
  const embeddingsPath = pickExistingPath(EMBEDDINGS_CANDIDATES, 'embeddings');

  const resourceStats = fs.statSync(resourcesPath);
  const embeddingsStats = fs.statSync(embeddingsPath);

  const mustReload =
    cache.resourcesPath !== resourcesPath ||
    cache.embeddingsPath !== embeddingsPath ||
    cache.resourcesMtime !== resourceStats.mtimeMs ||
    cache.embeddingsMtime !== embeddingsStats.mtimeMs;

  if (mustReload) {
    const resources = readJson(resourcesPath);
    const discoveryContextPath = DISCOVERY_CONTEXT_CANDIDATES.find((candidate) => fs.existsSync(candidate));
    const discoverySource = discoveryContextPath ? readJson(discoveryContextPath) : [];

    cache.resources = mergeDiscoveryContext(resources, discoverySource);
    cache.embeddings = readJson(embeddingsPath);
    cache.resourcesPath = resourcesPath;
    cache.embeddingsPath = embeddingsPath;
    cache.resourcesMtime = resourceStats.mtimeMs;
    cache.embeddingsMtime = embeddingsStats.mtimeMs;
  }

  return {
    resources: cache.resources,
    embeddings: cache.embeddings,
  };
}

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(vector) {
  let total = 0;
  for (let i = 0; i < vector.length; i += 1) {
    total += vector[i] * vector[i];
  }
  return Math.sqrt(total);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;

  return dotProduct(a, b) / (magA * magB);
}

async function semanticSearch(query, options = {}) {
  const {
    topK = 10,
    minScore = -1,
    filters = {},
  } = options;

  const hasDiscoveryContextFilters = filters?.discoveryContext && Object.values(filters.discoveryContext).some((values) => Array.isArray(values) && values.length > 0);

  if ((!query || !String(query).trim()) && !hasDiscoveryContextFilters) {
    throw new Error('semanticSearch requiere un query no vacio.');
  }

  const { resources, embeddings } = loadData();
  const byId = new Map(resources.map((r) => [r.id, r]));
  const normalizedQuery = String(query || '').trim();
  const queryEmbedding = normalizedQuery ? await createEmbedding(normalizedQuery) : null;

  const scored = [];

  if (queryEmbedding) {
    for (const item of embeddings) {
      const resource = byId.get(item.id);
      if (!resource) continue;
      if (!matchesAllFilters(resource, filters)) continue;

      const score = cosineSimilarity(queryEmbedding, item.vector);
      if (score < minScore) continue;

      scored.push({
        id: item.id,
        score,
        resource,
      });
    }
  } else {
    for (const resource of resources) {
      if (!matchesAllFilters(resource, filters)) continue;

      scored.push({
        id: resource.id,
        score: 0,
        resource,
      });
    }
  }

  const ranked = rankResults(scored, filters)
    .slice(0, topK)
    .map((item) => ({
      id: item.id,
      score: item.score,
      metadataScore: item.metadataScore,
      titulo: item.resource?.contenido?.titulo || item.resource?.contenido?.nombre_proyecto || '',
      fase: item.resource?.clasificacion?.fase,
      grado: item.resource?.clasificacion?.grado,
      recurso: item.resource,
    }));

  return ranked;
}

module.exports = {
  cosineSimilarity,
  semanticSearch,
};
