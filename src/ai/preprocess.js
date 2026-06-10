function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function normalizeString(value) {
  // Normalizar a NFD (descomponer acentos) y eliminarlos
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickKeywords(resource) {
  const semantic = resource?.enriquecimiento_ia?.semantica || {};
  const pedag = resource?.enriquecimiento_ia?.pedagogico || {};

  return [
    ...toArray(semantic.tags),
    ...toArray(semantic.keywords),
    ...toArray(semantic.temas_detectados),
    ...toArray(pedag.habilidades_inferidas),
    ...toArray(pedag.competencias_inferidas),
  ]
    .map(normalizeString)
    .filter(Boolean);
}

function extractCampos(resource) {
  return toArray(resource?.contenido?.campos_formativos)
    .map((campoObj) => {
      const campo = normalizeString(campoObj?.campo);
      const contenidos = toArray(campoObj?.contenidos)
        .map((contenidoObj) => normalizeString(contenidoObj?.contenido))
        .filter(Boolean);

      return {
        campo,
        contenidos,
      };
    })
    .filter((item) => item.campo || item.contenidos.length > 0);
}

function resourceToSemanticText(resource) {
  const contenido = resource?.contenido || {};
  const clasificacion = resource?.clasificacion || {};
  const implementacion = resource?.implementacion || {};
  const recomendacion = resource?.enriquecimiento_ia?.recomendacion || {};

  const titulo = normalizeString(contenido.titulo || contenido.nombre_proyecto);
  const proposito = normalizeString(contenido.proposito);
  const problema = normalizeString(contenido.problema_contexto);
  const producto = normalizeString(contenido.producto_central);

  const fase = normalizeString(clasificacion.fase);
  const grado = normalizeString(clasificacion.grado);
  const tipoRecurso = normalizeString(clasificacion.tipo_recurso);
  const categoria = normalizeString(clasificacion.categoria_pedagogica);

  const metodologias = toArray(contenido.metodologias).map(normalizeString).filter(Boolean);
  const ejes = toArray(contenido.ejes_articuladores).map(normalizeString).filter(Boolean);
  const momentos = toArray(contenido.momentos_metodologicos)
    .map((m) => normalizeString(m?.nombre || m?.id))
    .filter(Boolean);
  const materiales = toArray(implementacion.materiales).map(normalizeString).filter(Boolean);
  const modos = toArray(implementacion.modos_trabajo).map(normalizeString).filter(Boolean);
  const contextos = toArray(recomendacion.contextos_recomendados).map(normalizeString).filter(Boolean);
  const agrupaciones = toArray(recomendacion.agrupaciones_sugeridas).map(normalizeString).filter(Boolean);

  const campos = extractCampos(resource);
  const camposText = campos
    .map((c) => `Campo formativo: ${c.campo}. Contenidos: ${c.contenidos.join('; ')}.`)
    .join(' ');

  const keywords = pickKeywords(resource);

  const parts = [
    // Título tres veces para mayor peso semántico
    `Titulo: ${titulo}.`,
    `Proyecto: ${titulo}.`,
    `Nombre del proyecto: ${titulo}.`,
     // Producto central (resumen ejecutivo, muy importante)
     `Producto central: ${producto}.`,
     `Producto: ${producto}.`,
     `Resultado: ${producto}.`,
    `Fase: ${fase}.`,
    `Grado: ${grado}.`,
    `Tipo de recurso: ${tipoRecurso}.`,
    `Categoria pedagogica: ${categoria}.`,
    `Proposito pedagogico: ${proposito}.`,
    `Problema de contexto: ${problema}.`,
    `Metodologias: ${metodologias.join(', ')}.`,
    `Ejes articuladores: ${ejes.join(', ')}.`,
    `Momentos metodologicos: ${momentos.join(', ')}.`,
    `Materiales: ${materiales.join(', ')}.`,
     `Materiales utilizados: ${materiales.join(', ')}.`,
    `Modos de trabajo: ${modos.join(', ')}.`,
    `Contextos recomendados: ${contextos.join(', ')}.`,
    `Agrupaciones sugeridas: ${agrupaciones.join(', ')}.`,
    camposText,
     // Keywords con más peso (los tags semánticos son críticos)
    `Palabras clave pedagogicas: ${keywords.join(', ')}.`,
     `Tags del proyecto: ${keywords.join(', ')}.`,
     `Temas: ${keywords.join(', ')}.`,
  ];

  return parts
    .map(normalizeString)
    .filter(Boolean)
    .join(' ');
}

module.exports = {
  resourceToSemanticText,
};
