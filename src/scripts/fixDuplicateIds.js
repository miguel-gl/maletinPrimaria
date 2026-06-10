/**
 * Script para generar IDs únicos para todos los recursos
 * Los datos tienen IDs duplicados, esto lo corrige
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('crypto').randomUUID ? () => {
  // Implementación simple de UUID v4 sin dependencias externas
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
} : null;

const METADATA_DIR = path.resolve(__dirname, '../metadata');
const RESOURCES_PATH = path.join(METADATA_DIR, 'resources.json');

function generateSimpleUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function fixDuplicateIds() {
  console.log('[INFO] Reparando IDs duplicados en resources.json...');
  
  const raw = fs.readFileSync(RESOURCES_PATH, 'utf-8');
  let resources = JSON.parse(raw);

  const usedIds = new Set();
  let fixedCount = 0;

  resources = resources.map((resource) => {
    // Si el ID ya fue usado o está vacío, generar uno nuevo
    if (!resource.id || usedIds.has(resource.id)) {
      const oldId = resource.id;
      resource.id = generateSimpleUUID();
      usedIds.add(resource.id);
      fixedCount++;
      console.log(`  ✓ Generado nuevo ID para: ${resource.contenido?.titulo}`);
      if (oldId) console.log(`    Antes: ${oldId}`);
    } else {
      usedIds.add(resource.id);
    }
    
    return resource;
  });

  // Escribir los recursos corregidos
  fs.writeFileSync(RESOURCES_PATH, JSON.stringify(resources, null, 2), 'utf-8');
  
  console.log(`\n[DONE] Se corrigieron ${fixedCount} IDs duplicados.`);
  console.log(`Total de recursos con ID único: ${resources.length}`);
}

fixDuplicateIds();
