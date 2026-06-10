# Reglas de Extracción de Metadata Pedagógica

---

## ⛔ CONDICIÓN DE ARRANQUE — NO NEGOCIABLE

**Antes de escribir cualquier línea de código o generar cualquier registro JSON, leer obligatoriamente estos archivos en este orden:**

1. `context/schema_extraccion.json` — estructura exacta de cada campo y su ubicación jerárquica
2. `context/catalogo_descubrimiento_contextual.json` — IDs válidos (únicos permitidos)
3. `context/catalogo_descubrimiento_contextual_ui.json` — iconos y títulos para cada ID
4. `context/EXTRACTION_RULES.md` — este archivo (reglas, omisiones, validaciones)
5. Programa Sintético de la fase a procesar — PDA verbatim

**Nunca iniciar generación desde memoria de sesiones anteriores ni desde resúmenes de contexto compactado. La compactación degrada la precisión del schema. Siempre desde los archivos.**

Esta condición aplica al inicio de cada sesión, cada lote, y cada vez que se retoma un proceso interrumpido.

---

## Fuentes de verdad

| Recurso | Ruta | Uso |
|---|---|---|
| Schema template | `context/schema_extraccion.json` | Estructura base de todo JSON extraído |
| Catálogo descubrimiento contextual (ids) | `context/catalogo_descubrimiento_contextual.json` | Validar ids permitidos |
| Catálogo descubrimiento contextual (UI) | `context/catalogo_descubrimiento_contextual_ui.json` | Obtener icono y titulo de cada id |
| Programa Sintético Fase 3 | `context/Programa_Sintetico_Fase_3 (1).pdf` | Validación de campos formativos, contenidos y PDA |
| Programa Sintético Fase 4 | `context/Programa_Sintetico_Fase_4 (1).pdf` | Validación de campos formativos, contenidos y PDA |
| Programa Sintético Fase 5 | `context/Programa_Sintetico_Fase_5 (1).pdf` | Validación de campos formativos, contenidos y PDA |

> **No usar** archivos de `src/metadata/` como referencia de schema. Son datos de producción, no fuente de verdad estructural.

> Antes de cada sesión de extracción, leer el Programa Sintético correspondiente a la fase del lote que se va a procesar. Para Fase 3: `context/Programa_Sintetico_Fase_3 (1).pdf` (88 páginas).

---

## Archivos de salida

| Tipo de recurso | Archivo de salida |
|---|---|
| Planos didácticos Fase 3 (grado 1 y 2) | `src/metadata/fase3/planos_didacticos.json` |
| Cuadernillos Fase 3 | `src/metadata/fase3/cuadernillo_trabajo.json` |
| Imprimibles Fase 3 | `src/metadata/fase3/imprimibles.json` |

- Un solo archivo por tipo de recurso por fase, **independientemente del grado**.
- El grado queda identificado dentro de cada registro en `clasificacion.grado`.
- Al agregar documentos de un grado nuevo, **append** al array existente — no reemplazar el archivo.

---

## Identificador (`id`)

- Siempre **UUID v5 determinista** — mismo archivo siempre produce el mismo ID.
- Formato: `"xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx"`
- **Namespace fijo del proyecto:** `f8f0f460-9104-5b6d-856f-ad75af5db23c`
  (derivado de `uuid5(NAMESPACE_DNS, "maletinprimaria.nem.mx")` — no cambiar nunca)
- **Clave de entrada:** `"{fase}.{grado}.{subdirectorio}.{nombre_archivo}"`
  - `fase` → `"fase3"`, `"fase4"`, `"fase5"`
  - `grado` → `"grado1"`, `"grado2"`, `"grado3"`
  - `subdirectorio` → `"root"` si el PDF está directo en la carpeta, o el nombre del subdirectorio (`"servicio"`, `"steam"`, etc.)
  - `nombre_archivo` → nombre exacto con extensión, ej. `"p3_construyendo.pdf"`

**Ejemplo en Python:**
```python
import uuid
NAMESPACE = uuid.UUID("f8f0f460-9104-5b6d-856f-ad75af5db23c")
def get_id(fase, grado, subdirectorio, nombre_archivo):
    key = f"fase{fase}.grado{grado}.{subdirectorio}.{nombre_archivo}"
    return str(uuid.uuid5(NAMESPACE, key))
```

Esto garantiza:
- No colisiones entre fases, grados, subdirectorios ni archivos con mismo nombre
- Regenerar un registro preserva el mismo ID
- No requiere registro externo ni estado persistente

---

## Campos de `archivo`

| Campo | Valor esperado |
|---|---|
| `tipo` | `"Planeación Didáctica"` / `"Plano Didáctico"` / `"Cuadernillo"` / etc. — texto descriptivo, no MIME type |
| `extension` | Con punto: `".pdf"`, `".docx"` |
| `ruta` | Nombre de archivo únicamente (sin ruta absoluta) |

---

## Campos de `clasificacion`

| Campo | Valores válidos |
|---|---|
| `tipo_recurso` | `"Planos didácticos"` / `"Cuadernillos de trabajo"` / `"Imprimibles"` / `"Evaluaciones"` / `"Material del alumno"` |
| `categoria_pedagogica` | `"Aprendizaje Basado en Proyectos Comunitarios"` / `"Aprendizaje Basado en Problemas (ABP)"` / `"Proyecto STEAM"` / `"Cuadernillo de Ejercicios"` / etc. |

---

## Reglas de omisión por tipo de documento

### Planeación Didáctica / Proyecto Comunitario / ABP / STEAM

Incluir **todos** los bloques del schema.

### Cuadernillo de trabajo / Material del alumno / Imprimible

**Omitir** los siguientes bloques salvo que existan explícitamente en el documento:

- `problema_contexto`
- `producto_central`
- `momentos_metodologicos`
- `sesiones` / `sesiones_totales`

### Evaluación (instrumento independiente)

**Omitir:**
- `momentos_metodologicos`
- `sesiones` / `sesiones_totales`
- `problema_contexto`
- `producto_central`
- `vinculacion_ltg`

**Incluir siempre:**
- `evaluacion` con criterios completos

---

## Reglas específicas de campos

### Jerarquía del objeto `contenido` — campos que van DENTRO

Los siguientes campos pertenecen **dentro de `contenido`**, no al nivel raíz del registro:

- `momentos_metodologicos`
- `sesiones_totales`
- `sesiones`
- `anexos`
- `vinculacion_ltg`
- `ejes_articuladores`

La estructura raíz del registro es únicamente: `id`, `archivo`, `clasificacion`, `contenido`, `evaluacion` (cuando aplica), `implementacion`, `enriquecimiento_ia`.

### `ejes_articuladores`

Array de strings. Los 7 ejes articuladores oficiales de la NEM son:
`"Inclusión"`, `"Pensamiento crítico"`, `"Interculturalidad crítica"`, `"Igualdad de género"`, `"Vida saludable"`, `"Apropiación de las culturas a través de la lectura y la escritura"`, `"Artes y experiencias estéticas"`.

Incluir solo los que tienen presencia real y explícita en el proyecto.

### `campos_formativos`

- Extraer **todos** los campos formativos presentes.
- Cada contenido debe tener **al menos un PDA**.
- Copiar texto **exacto** — no parafrasear, no resumir.
- No cerrar la extracción si algún contenido no tiene PDA asignado.

### `momentos_metodologicos`

- `descripcion_completa` no puede ser igual ni paráfrasis del `nombre`.
- Debe contener la explicación pedagógica completa de las actividades del momento.

### `sesiones_totales` y `sesiones`

- `sesiones_totales` es un entero que debe coincidir exactamente con `sesiones.length`.
- Si el documento no numera sesiones explícitamente, derivarlas lógicamente de los momentos metodológicos y sus actividades.

### `vinculacion_ltg`

Usar estructura de objeto, no string plano:

```json
{
  "grado": "2°",
  "libro": "Nuestros saberes: Libro para alumnos, maestros y familia",
  "seccion": "Registro de datos",
  "pagina": 117
}
```

Si hay múltiples referencias, generar un objeto por cada una.

> **Nota Fase 4:** Los PDFs de planos didácticos de Fase 4 NO incluyen sección "Vinculación con los Libros de Texto Gratuito". `vinculacion_ltg: []` es correcto para todos los registros de Fase 4. No buscar ni inferir referencias LTG en esta fase.

### `evaluacion`

- Extraer siempre que el documento contenga un instrumento de evaluación (rúbrica, lista de cotejo, escala, etc.).
- Incluir todos los criterios con sus niveles completos.
- Si no hay evaluación en el documento, omitir el bloque completo.

### `implementacion`

- `duracion_horas`: usar `0` si no está especificado en el documento.
- `modos_trabajo`: array de strings descriptivos (no un solo valor genérico).
  - Ejemplos: `"Individual (registro semanal)"`, `"8 equipos de investigación"`, `"Plenaria grupal"`

### `descubrimiento_contextual`

- Usar **exclusivamente** ids del catálogo oficial (`catalogo_descubrimiento_contextual.json`).
- Cada item debe ser objeto completo: `{ "id": "", "icono": "", "titulo": "" }`.
- Obtener `icono` y `titulo` del catálogo UI (`catalogo_descubrimiento_contextual_ui.json`).
- Mapear solo cuando existe evidencia pedagógica real en el documento.
- **Es un objeto con 6 categorías fijas como keys — NO un array plano.** Estructura obligatoria:

```json
"descubrimiento_contextual": {
  "energia_y_dinamica_grupo": [],
  "recursos_y_preparacion": [],
  "tipo_experiencia_aprendizaje": [],
  "intencion_pedagogica": [],
  "enfoque_metodologico_nem": [],
  "clima_emocional_aula": []
}
```

IDs válidos por categoría (únicos permitidos):
- `energia_y_dinamica_grupo`: `grupos_inquietos`, `grupos_tranquilos`, `actividad_rapida`, `proyecto_largo`, `alta_participacion`, `trabajo_individual`
- `recursos_y_preparacion`: `poco_material`, `material_manipulable`, `apoyo_digital`, `listo_imprimir`, `espacios_escolares`
- `tipo_experiencia_aprendizaje`: `participacion_oral`, `produccion_escrita`, `exploracion_investigacion`, `resolucion_problemas`, `expresion_artistica`, `experimentacion`, `trabajo_colaborativo`, `conexion_comunidad`
- `intencion_pedagogica`: `activar_conocimientos`, `introducir_tema`, `reforzar_aprendizajes`, `generar_reflexion`, `cierre_socializacion`
- `enfoque_metodologico_nem`: `comunitario`, `basado_problemas`, `aprendizaje_servicio`, `steam`
- `clima_emocional_aula`: `motivadora_divertida`, `relajada_creativa`, `favorece_convivencia`, `fortalece_confianza`

### `enriquecimiento_ia.curricular.continuidad`

- `fase_anterior` y `fase_siguiente` son **arrays**, no strings.

---

## Decisiones de implementación (sesión 2026-06-10)

| Decisión | Detalle |
|---|---|
| `sesiones` array detallado | Se conserva además de `sesiones_totales`. Permite granularidad para búsqueda semántica. |
| `vinculacion_ltg` estructurado | Se usa objeto en lugar de string. Permite filtrado por grado, libro y página. |
| `evaluacion` como bloque propio | Está en el schema base. Se incluye en el registro cuando el PDF contiene instrumento de evaluación. Se omite completamente cuando no existe en el documento. |
| `habilidades_reforzadas` | Añadido a `pedagogico` para distinguir habilidades nuevas de habilidades practicadas. |
| `sintesis` | Máximo dos párrafos. Describe propósito, habilidades trabajadas y experiencia educativa. |

---

## Validación final antes de entregar

- [ ] Documento clasificado
- [ ] Campos formativos completos
- [ ] Todos los contenidos detectados con texto exacto
- [ ] Todos los PDA detectados con texto exacto
- [ ] Cada contenido tiene al menos un PDA
- [ ] `sesiones_totales` == `sesiones.length`
- [ ] Temas clave generados (máximo 20)
- [ ] Recursos detectados
- [ ] Implementación completa
- [ ] Enriquecimiento IA completo
- [ ] `descubrimiento_contextual` solo con ids del catálogo oficial
- [ ] JSON válido
