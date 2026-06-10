/**
 * Script de prueba para validar búsqueda semántica
 * Uso: node test-search.js "tu query aquí"
 */

const { semanticSearch } = require('./src/ai/search');

async function testSearch() {
  const query = process.argv[2] || 'jardin en casa';

  console.log(`\n🔍 Buscando: "${query}"\n`);

  try {
    const results = await semanticSearch(query, { topK: 10 });

    if (results.length === 0) {
      console.log('❌ Sin resultados');
      return;
    }

    results.forEach((result, i) => {
      const score = (result.score * 100).toFixed(1);
      console.log(`${i + 1}. [${score}%] ${result.titulo}`);
      console.log(`   Fase: ${result.fase} | Grado: ${result.grado}`);
      console.log(`   ID: ${result.id}\n`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSearch();
