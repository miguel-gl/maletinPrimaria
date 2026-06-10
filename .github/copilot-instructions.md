# Instrucciones de desarrollo para este repositorio

## Reglas operativas obligatorias

### JavaScript por pagina

- No escribir JavaScript inline dentro de archivos HTML.
- Cada pagina HTML debe tener su logica en un archivo JS dedicado dentro de `assets/js/`.
- Convencion de nombres recomendada: `<nombre-pagina>.js`.
- En el HTML solo se permite enlazar scripts con `<script src="...">` al final del `body`.
- `assets/js/theme.js` se mantiene como script global del tema; la logica especifica de cada pagina va en su propio archivo.

### Validacion de formularios (pantallas de acceso/inicio)

- No usar bloques de texto de error debajo de cada campo (`invalid-feedback`).
- Mantener feedback visual en el control (estado/borde) y asterisco `*` en labels obligatorios.
- Si se requiere ayuda adicional, usar una nota general fuera del flujo de campos.

### Estilos y personalizacion

- No editar `assets/css/theme.min.css`.
- Toda personalizacion visual debe implementarse en `assets/css/user.min.css`.

## Objetivo

- Mantener separacion de responsabilidades (estructura en HTML, comportamiento en JS).
- Facilitar mantenimiento, pruebas y evolucion de cada pantalla sin mezclar codigo.