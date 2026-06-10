const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { createEmbedding, MODEL_NAME } = require('../ai/embedder');
const { resourceToSemanticText } = require('../ai/preprocess');

const RESOURCES_PATH = path.resolve(__dirname, '../metadata/resources.json');
const EMBEDDINGS_PATH = path.resolve(__dirname, '../metadata/embeddings.json');

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf-8');
}

function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

async function generateEmbeddings() {
  const resources = readJson(RESOURCES_PATH, []);
  if (!Array.isArray(resources)) {
    throw new Error('resources.json debe contener un arreglo de recursos.');
  }

  const existing = readJson(EMBEDDINGS_PATH, []);
  const existingById = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((item) => item && item.id)
      .map((item) => [item.id, item])
  );

  const output = [];
  let reused = 0;
  let created = 0;

  for (let i = 0; i < resources.length; i += 1) {
    const resource = resources[i];
    const id = resource?.id;

    if (!id) {
      console.warn(`[SKIP] Recurso sin id en indice ${i}.`);
      continue;
    }

    const semanticText = resourceToSemanticText(resource);
    const hash = hashText(semanticText);

    const current = existingById.get(id);
    if (current && current.hash === hash && Array.isArray(current.vector) && current.vector.length > 0) {
      output.push(current);
      reused += 1;
      continue;
    }

    try {
      const vector = await createEmbedding(semanticText);

      output.push({
        id,
        hash,
        model: MODEL_NAME,
        dimensions: vector.length,
        vector,
        updatedAt: new Date().toISOString(),
      });
      created += 1;

      if ((i + 1) % 25 === 0) {
        console.log(`[INFO] Procesados ${i + 1}/${resources.length}`);
      }
    } catch (error) {
      console.error(`[ERROR] No se pudo generar embedding para ${id}: ${error.message}`);
    }
  }

  writeJson(EMBEDDINGS_PATH, output);

  console.log('[DONE] Embeddings generados.');
  console.log(`- Total recursos: ${resources.length}`);
  console.log(`- Reutilizados: ${reused}`);
  console.log(`- Nuevos/actualizados: ${created}`);
  console.log(`- Guardado en: ${EMBEDDINGS_PATH}`);
}

generateEmbeddings().catch((error) => {
  console.error(`[FATAL] ${error.message}`);
  process.exitCode = 1;
});
