# Guía complementaria de interfaz (basada en index.html)

Este documento complementa [repository-analysis.md](repository-analysis.md) y fija la estructura de interfaz que ya está preparada para que cualquier cambio futuro se mantenga consistente.

## 0) Qué es Maletín Primaria y para qué sirve

Con base en el contenido visible de [index.html](../index.html#L57-L61), este software se entiende como una plataforma web de apoyo docente para primaria.

### Definición funcional
Maletín Primaria es un “maletín digital” para maestras y maestros que centraliza planeación y materiales de clase en un mismo lugar.

### Propósito principal
- Organizar la planeación docente por fases y grados.
- Facilitar acceso rápido a documentos curriculares y normativos.
- Reunir recursos de apoyo didáctico para preparar clases más dinámicas.
- Mostrar materiales en formatos prácticos para consulta (modal/visor embebido), como se observa en [index.html](../index.html#L653-L688).

### Alcance temático observado en la interfaz
Las categorías principales del menú inicial indican 4 frentes de uso:
1. Documentos de la estructura curricular: [index.html](../index.html#L68-L70)
2. Documentos de apoyo didáctico: [index.html](../index.html#L75-L77)
3. Documentos normativos: [index.html](../index.html#L82-L84)
4. Planos didácticos: [index.html](../index.html#L88-L88)

### Perfil de usuario objetivo
Docentes de educación primaria que requieren consultar, organizar y reutilizar recursos pedagógicos durante su planeación y ejecución de clase.

## 1) Estructura base que se debe respetar

### Layout principal
- Contenedor de aplicación: [index.html](../index.html#L48-L646) dentro de `main.main#top`.
- Home dividido en dos paneles `offcanvas`:
  - Panel de contenido/inicio: [index.html](../index.html#L52-L62) (`#offcanvasStart`).
  - Panel de navegación visual: [index.html](../index.html#L63-L94) (`#offcanvasEnd`).
- Páginas internas por secciones con clase `page d-none`:
  - Curricular: [index.html](../index.html#L97-L307)
  - Services (plantilla): [index.html](../index.html#L309-L476)
  - Portfolio (plantilla): [index.html](../index.html#L480-L544)
  - Contact (plantilla): [index.html](../index.html#L547-L646)

### Modales de recursos
- Modal PDF/local: [index.html](../index.html#L653-L669) (`#modalFullscreen`).
- Modal externo: [index.html](../index.html#L672-L688) (`#modalFullscreen2`).

## 2) Contrato de navegación actual

### Estado observado
- Las 4 tarjetas del menú principal redirigen a la misma sección `#curricular`:
  - [index.html](../index.html#L68-L69)
  - [index.html](../index.html#L75-L76)
  - [index.html](../index.html#L82-L83)
  - [index.html](../index.html#L88-L88)

### Regla para próximos cambios
- Si se mantienen 4 categorías funcionales, cada tarjeta debe terminar en su sección propia (`#curricular`, `#apoyo`, `#normativos`, `#planos`) o en filtros internos claramente diferenciados.
- Evitar crear nuevas rutas si el contenido seguirá siendo one-page; priorizar anclas y filtros para mantener el comportamiento del tema.

## 3) Patrones UI que sí debemos conservar

- Composición visual por bloques Bootstrap (`row`, `col-*`, `card`, `offcanvas`, `modal`).
- Estilo tipográfico y gradientes existentes (`text-gradient-*`, `btn-boots-*`).
- Sidebar vertical en secciones internas (`sticky-area` + `sidebar-rounded`) como patrón de identidad visual.
- Galería/filtros por `data-isotope` y clases de categoría (`photography`, `studio`, `interior`): [index.html](../index.html#L172-L193).

## 4) Puntos a normalizar sin romper la interfaz

- CTA “Regresar al Menu Principal” no navega todavía (`href="#!"`): [index.html](../index.html#L276-L276).
- Hay secciones heredadas de la plantilla en inglés (`services`, `portfolio`, `contact`) que deben:
  1) reutilizarse para contenido pedagógico real, o
  2) ocultarse/eliminarse en una etapa de limpieza.
- Dependencias externas con rutas de mirror HTTrack (polyfills/smtp) deben revisarse antes de producción: [index.html](../index.html#L700-L703).
- API key pública de Google Maps detectada: [index.html](../index.html#L709-L709). Debe restringirse por dominio y rotarse.

## 5) Convención recomendada para ampliar contenido

### Secciones nuevas
- Reutilizar el patrón de sección existente:
  - `section.page.d-none`
  - columna principal de contenido
  - columna lateral sticky con identidad visual

### Recursos didácticos
- Para documentos: mantener apertura en modal (`data-bs-target`) o visor embebido (`iframe`) según peso/compatibilidad.
- Para catálogos por fase: mantener `data-filter` y mapear fases a clases semánticas consistentes.

### Naming
- IDs de secciones en español y consistentes con el menú.
- Clases utilitarias del tema sin sobrescribir `theme.min.css`; personalizaciones solo en `assets/css/user.min.css`.

## 6) Checklist de control antes de cambios grandes

1. Validar que el home (`offcanvasStart` y `offcanvasEnd`) siga visible y estable.
2. Confirmar que cada tarjeta principal navega al destino correcto.
3. Probar modales (`#modalFullscreen`, `#modalFullscreen2`) en desktop y móvil.
4. Verificar filtros de galería y carga de imágenes.
5. Revisar que scripts vendor sigan cargando en orden: [index.html](../index.html#L694-L712).
6. Evitar romper clases visuales del tema; encapsular cambios en `user.min.css`.

## 7) Reglas operativas del repositorio

- Las reglas de implementacion (JS por pagina, validacion de formularios y personalizacion de estilos) se mantienen centralizadas en `../.github/copilot-instructions.md`.
- Esta guia conserva contexto funcional y de interfaz para evitar duplicidad con instrucciones operativas.

---

Si se desea, el siguiente paso recomendado es crear una matriz de mapeo “Tarjeta principal → Sección → Recursos” para que el equipo capture contenido sin alterar la arquitectura visual ya aprobada.
