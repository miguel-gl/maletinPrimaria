const fs = require('fs');
const path = require('path');

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const CACHE_DIR = path.resolve(__dirname, '../../.cache/transformers');

let extractorPromise = null;

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      ensureCacheDir();
      process.env.TRANSFORMERS_CACHE = CACHE_DIR;

      const { pipeline } = await import('@xenova/transformers');
      return pipeline('feature-extraction', MODEL_NAME, {
        quantized: true,
      });
    })();
  }

  return extractorPromise;
}

function sanitizeText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

async function createEmbedding(text) {
  const cleanText = sanitizeText(text);

  if (!cleanText) {
    throw new Error('createEmbedding requiere un texto no vacio.');
  }

  const extractor = await getExtractor();
  const output = await extractor(cleanText, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}

module.exports = {
  MODEL_NAME,
  createEmbedding,
  getExtractor,
};
