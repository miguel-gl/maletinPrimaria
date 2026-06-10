/**
 * Tools Slider - Herramientas que podrían ayudarte hoy
 * Rota automáticamente entre herramientas del maletín docente
 */
(function () {
  'use strict';

  let allTools = [];
  let currentIndex = 0;
  let autoplayInterval = null;
  const AUTOPLAY_DELAY = 8000; // 8 segundos

  // Cargar datos del JSON
  async function loadToolsData() {
    try {
      const response = await fetch('src/metadata/material_docente.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      allTools = await response.json();
      
      if (allTools.length > 0) {
        initSlider();
      }
    } catch (error) {
      console.error('Error cargando herramientas:', error);
      // Fallback silencioso
      allTools = [];
    }
  }

  // Inicializar el slider
  function initSlider() {
    const slider = document.getElementById('toolsSlider');
    if (!slider) return;

    // Crear indicadores (dots)
    createDots();

    // Event listeners
    const prevBtn = slider.querySelector('.beta-tool-btn-prev');
    const nextBtn = slider.querySelector('.beta-tool-btn-next');

    if (prevBtn) prevBtn.addEventListener('click', () => goToPrevious());
    if (nextBtn) nextBtn.addEventListener('click', () => goToNext());

    // Mostrar la primera herramienta
    showTool(0);

    // Iniciar autoplay
    startAutoplay();

    // Pausar autoplay al hover
    slider.addEventListener('mouseenter', () => stopAutoplay());
    slider.addEventListener('mouseleave', () => startAutoplay());
    
      // Hacer la tarjeta clickeable: abre el recurso en el visualizador
      const card = document.getElementById('toolCard');
      if (card) {
        card.addEventListener('click', function () {
          const id = card.dataset.resourceId;
          if (id) {
            window.location.href =
              'visualizador.html?tipo=material_docente&id=' + encodeURIComponent(id) + '&from=inicio';
          }
        });
      }
    
      // Enlace "ir al material docente"
      const materialLink = document.createElement('a');
      materialLink.href = 'planos-didacticos.html?tipo=material-docente';
      materialLink.className = 'beta-tools-material-link';
      materialLink.textContent = 'Ver todo el material para el docente →';
      slider.appendChild(materialLink);
  }

  // Crear indicadores (dots)
  function createDots() {
    const dotsContainer = document.getElementById('toolsDots');
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';
    
    allTools.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.className = `beta-tool-dot ${index === 0 ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Ir a herramienta ${index + 1}`);
      dot.addEventListener('click', () => goToTool(index));
      dotsContainer.appendChild(dot);
    });
  }

  // Mostrar herramienta específica con transición de derecha a izquierda
  function showTool(index) {
    if (allTools.length === 0) return;

    index = ((index % allTools.length) + allTools.length) % allTools.length;
    currentIndex = index;

    const tool = allTools[index];
    const card = document.getElementById('toolCard');
    if (!card) return;

    // Salida hacia la izquierda (movimiento visual de derecha a izquierda)
    card.classList.add('fade-out');

    // Cambiar contenido después de la animación de salida
    setTimeout(() => {
      card.classList.remove('fade-in', 'fade-out');
      
      // Actualizar contenido
      card.querySelector('.beta-tool-emoji').textContent = tool.contenido.emoji_recurso || '📚';
      card.querySelector('.beta-tool-title').textContent = tool.contenido.titulo || '';
      card.querySelector('.beta-tool-type').textContent = tool.archivo.tipo || '';
      card.querySelector('.beta-tool-description').textContent = tool.contenido.descripcion_slide || '';

      // Actualizar dots
      updateDots(index);

        // Guardar id para la navegación al visualizador
        card.dataset.resourceId = tool.id || '';

      // Agregar clase de entrada
      card.classList.add('fade-in');
    }, 200);
  }

  // Actualizar indicadores
  function updateDots(index) {
    const dots = document.querySelectorAll('.beta-tool-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  // Navegación
  function goToNext() {
    stopAutoplay();
    showTool(currentIndex + 1);
    startAutoplay();
  }

  function goToPrevious() {
    stopAutoplay();
    showTool(currentIndex - 1);
    startAutoplay();
  }

  function goToTool(index) {
    stopAutoplay();
    showTool(index);
    startAutoplay();
  }

  // Autoplay
  function startAutoplay() {
    if (autoplayInterval) clearInterval(autoplayInterval);
    autoplayInterval = setInterval(() => {
      showTool(currentIndex + 1);
    }, AUTOPLAY_DELAY);
  }

  function stopAutoplay() {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
      autoplayInterval = null;
    }
    // Guardar id del recurso actual para la navegación al hacer click
    function storeCardId(id) {
      const card = document.getElementById('toolCard');
      if (card) card.dataset.resourceId = id || '';
    }
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadToolsData);
  } else {
    loadToolsData();
  }
})();
