/**
 * Material para el Docente - Página dinámica
 * Carga y muestra todos los recursos del maletín docente
 */
(function () {
  'use strict';

  let allMaterials = [];
  let filteredMaterials = [];

  // Cargar datos del JSON
  async function loadMaterials() {
    try {
      const response = await fetch('src/metadata/material_docente.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      allMaterials = await response.json();
      filteredMaterials = [...allMaterials];

      renderMaterials(filteredMaterials);
      setupEventListeners();
    } catch (error) {
      console.error('Error cargando materiales:', error);
      showError('Error al cargar los recursos. Por favor, intenta más tarde.');
    }
  }

  // Renderizar grid de materiales
  function renderMaterials(materials) {
    const grid = document.getElementById('materialsGrid');
    if (!grid) return;

    if (materials.length === 0) {
      grid.innerHTML = '<div class="material-docente-empty"><p>No se encontraron recursos</p></div>';
      return;
    }

    grid.innerHTML = materials.map(material => `
      <div class="material-card" data-id="${material.id}">
        <div class="material-card-emoji">${material.contenido.emoji_recurso || '📚'}</div>
        <div class="material-card-content">
          <h3 class="material-card-title">${material.contenido.titulo}</h3>
          <p class="material-card-type">${material.archivo.tipo}</p>
          <p class="material-card-description">${material.contenido.para_que_te_sirve || ''}</p>
          <button class="material-card-btn" data-id="${material.id}">Ver detalles</button>
        </div>
      </div>
    `).join('');

    // Agregar event listeners a los botones
    document.querySelectorAll('.material-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const material = allMaterials.find(m => m.id === id);
        if (material) showModal(material);
      });
    });
  }

  // Mostrar modal con detalles
  function showModal(material) {
    const modal = document.getElementById('materialModal');
    const body = document.getElementById('modalBody');

    if (!modal || !body) return;

    const pedagogical = material.enriquecimiento_ia?.pedagogico || {};

    body.innerHTML = `
      <div class="modal-header">
        <div class="modal-emoji">${material.contenido.emoji_recurso || '📚'}</div>
        <div>
          <h2>${material.contenido.titulo}</h2>
          <p class="modal-type">${material.archivo.tipo}</p>
        </div>
      </div>

      <div class="modal-section">
        <h4>¿Para qué te sirve?</h4>
        <p>${material.contenido.para_que_te_sirve}</p>
      </div>

      <div class="modal-section">
        <h4>Resumen</h4>
        <p>${material.contenido.descripcion_slide}</p>
      </div>

      <div class="modal-section">
        <h4>Información del Archivo</h4>
        <p><strong>Nombre:</strong> ${material.archivo.nombre}</p>
        <p><strong>Tipo:</strong> ${material.archivo.tipo}</p>
      </div>

      ${pedagogical.competencias_docentes ? `
        <div class="modal-section">
          <h4>Competencias Docentes</h4>
          <div class="modal-tags">
            ${pedagogical.competencias_docentes.map(c => `<span class="tag">${c}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${pedagogical.habilidades_reforzadas ? `
        <div class="modal-section">
          <h4>Habilidades Reforzadas</h4>
          <div class="modal-tags">
            ${pedagogical.habilidades_reforzadas.map(h => `<span class="tag tag-secondary">${h}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${pedagogical.emociones_esperadas ? `
        <div class="modal-section">
          <h4>Emociones Esperadas</h4>
          <div class="modal-tags">
            ${pedagogical.emociones_esperadas.map(e => `<span class="tag tag-tertiary">${e}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${pedagogical.nivel_abstraccion ? `
        <div class="modal-section">
          <p><strong>Nivel de Abstracción:</strong> ${pedagogical.nivel_abstraccion}</p>
        </div>
      ` : ''}
    `;

    modal.classList.add('active');
  }

  // Cerrar modal
  function closeModal() {
    const modal = document.getElementById('materialModal');
    if (modal) modal.classList.remove('active');
  }

  // Buscar/filtrar materiales
  function filterMaterials(query) {
    if (!query) {
      filteredMaterials = [...allMaterials];
    } else {
      const lowerQuery = query.toLowerCase();
      filteredMaterials = allMaterials.filter(material =>
        material.contenido.titulo.toLowerCase().includes(lowerQuery) ||
        material.contenido.para_que_te_sirve.toLowerCase().includes(lowerQuery) ||
        material.archivo.tipo.toLowerCase().includes(lowerQuery)
      );
    }
    renderMaterials(filteredMaterials);
  }

  // Mostrar error
  function showError(message) {
    const grid = document.getElementById('materialsGrid');
    if (grid) {
      grid.innerHTML = `<div class="material-docente-error"><p>${message}</p></div>`;
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    // Botón de volver
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.history.back();
      });
    }

    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterMaterials(e.target.value);
      });
    }

    // Cerrar modal
    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    const modal = document.getElementById('materialModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMaterials);
  } else {
    loadMaterials();
  }
})();
