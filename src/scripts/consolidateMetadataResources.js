const fs = require('fs');
const path = require('path');

/**
 * Script para consolidar todos los planos_didacticos.json de las fases
 * ubicadas en src/metadata/ en un único archivo resources.json
 * 
 * Uso: node src/scripts/consolidateMetadataResources.js
 */

const METADATA_DIR = path.resolve(__dirname, '../metadata');
const RESOURCES_OUTPUT = path.resolve(METADATA_DIR, 'resources.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf-8');
}

async function consolidateResources() {
  console.log('[INFO] Iniciando consolidación de recursos desde metadata...');
  console.log(`[INFO] Carpeta de búsqueda: ${METADATA_DIR}`);

  const resources = [];
  let processedFiles = 0;
  let totalResources = 0;

  // Buscar todas las carpetas de fases (fase1, fase2, fase3, etc.)
  const dirs = fs.readdirSync(METADATA_DIR).filter(name => {
    const fullPath = path.join(METADATA_DIR, name);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log(`[INFO] Fases encontradas: ${dirs.join(', ')}`);

  for (const dir of dirs.sort()) {
    const faseDir = path.join(METADATA_DIR, dir);
    const planosPath = path.join(faseDir, 'planos_didacticos.json');

    if (!fs.existsSync(planosPath)) {
      console.warn(`[SKIP] No existe planos_didacticos.json en ${dir}`);
      continue;
    }

    try {
      const planos = readJson(planosPath);
      
      if (!Array.isArray(planos)) {
        console.warn(`[SKIP] ${dir}/planos_didacticos.json no es un arreglo`);
        continue;
      }

      resources.push(...planos);
      processedFiles += 1;
      totalResources += planos.length;

      console.log(`[OK] ${dir}: ${planos.length} recursos agregados`);
    } catch (error) {
      console.error(`[ERROR] Error procesando ${planosPath}: ${error.message}`);
    }
  }

  // Escribir el archivo de recursos consolidado
  writeJson(RESOURCES_OUTPUT, resources);

  console.log('\n[DONE] Consolidación completada.');
  console.log(`- Archivos procesados: ${processedFiles}`);
  console.log(`- Total de recursos: ${totalResources}`);
  console.log(`- Guardado en: ${RESOURCES_OUTPUT}`);

  return resources;
}

consolidateResources().catch((error) => {
  console.error(`[FATAL] ${error.message}`);
  process.exitCode = 1;
});
