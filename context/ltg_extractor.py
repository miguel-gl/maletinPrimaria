"""
ltg_extractor.py — Extractor estandarizado de vinculacion_ltg (NEM)

Uso:
    from ltg_extractor import extract_ltg
    results = extract_ltg(pdf_path)
    # → list of { "grado": "", "libro": "", "seccion": "", "pagina": 0 }

Regla de arranque: leer context/EXTRACTION_RULES.md antes de usar.
"""

import re
import pdfplumber

# ── Títulos canónicos LTG (ordenados de más a menos específico) ───────────────
LIBROS_NEM = [
    "Nuestros saberes: Libro para alumnos, maestros y familia",
    "Nuestros saberes, libro para alumnos, maestros y familias",
    "Nuestros saberes",
    "Múltiples Lenguajes, Trazos y Números",
    "Múltiples Lenguajes: Trazos y Palabras",
    "Múltiples Lenguajes",
    "Proyectos Comunitarios",
    "Proyectos de Aula",
    "Proyectos Escolares",
]
LIBROS_SORTED = sorted(LIBROS_NEM, key=len, reverse=True)

# ── Marcadores que cortan el bloque LTG (ruido de firma/footer) ───────────────
NOISE_CUT = re.compile(
    r'(DEL\s*/\s*LA|NOMBRE\s+Y\s+FIRMA|ANEXO\s+\d|Vo\.\s*Bo\.'
    r'|Codiseño|INSTRUMENTO|Evaluaci[oó]n\b)',
    re.IGNORECASE
)

RE_GRADO = re.compile(r'(\d)[°º]')
RE_PAG   = re.compile(r'[Pp][áa]g(?:ina)?\.?\s*(\d+)')


# ─────────────────────────────────────────────────────────────────────────────

def _extract_text(pdf_path: str) -> str:
    with pdfplumber.open(pdf_path) as pdf:
        return "\n".join(p.extract_text() or "" for p in pdf.pages)


def _find_ltg_window(lines: list) -> list:
    for i, line in enumerate(lines):
        if "Vinculación con" in line:
            return lines[max(0, i-4) : min(len(lines), i+14)]
    return []


def _cut_noise(text: str) -> str:
    m = NOISE_CUT.search(text)
    return text[:m.start()].strip() if m else text.strip()


def _normalize_libro(raw: str) -> str:
    for lib in LIBROS_SORTED:
        if lib.lower() in raw.lower():
            return lib
    # quitar prefijo genérico "Libro "
    return re.sub(r'^[Ll]ibro\s+', '', raw).strip(' .,')


def _extract_seccion(rest_before_pag: str, rest_after_pag: str) -> str:
    """
    Intenta extraer la sección limpia.
    Prioriza texto antes de 'pág'; si está vacío usa texto después.
    """
    before = re.sub(r'^[\s,\.]+|[\s,\.]+$', '', rest_before_pag).strip()
    after  = re.sub(r'[Pp][áa]g\.?\s*\d+\.?', '', rest_after_pag)
    after  = _cut_noise(after).strip(' .,')

    # si before tiene contenido real (no solo ruido), usarlo
    if before and not re.fullmatch(r'[\d\s°º,.\'\"]+', before):
        candidate = before
    else:
        candidate = after

    # limpiar comillas residuales y espacios
    candidate = candidate.strip(' \t\n"\'«»“”‘’')
    return re.sub(r'\s+', ' ', candidate).strip()


def _parse_ltg_block(window: list) -> list:
    # Unir y limpiar marcadores de sección LTG
    block = " ".join(l.strip() for l in window if l.strip())
    for token in ["Vinculación con", "los Libros de", "Texto Gratuito"]:
        block = block.replace(token, " ")
    block = re.sub(r'\s+', ' ', block).strip()
    block = _cut_noise(block)

    results = []
    entries = re.split(r'(?=\d[°º])', block)

    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue

        grado_m = RE_GRADO.search(entry)
        if not grado_m:
            continue

        grado = f"{grado_m.group(1)}°"
        rest  = entry[grado_m.end():].strip()

        # ── Detectar libro ────────────────────────────────────────────────────
        libro_raw    = ""
        after_libro  = rest
        for lib in LIBROS_SORTED:
            if lib.lower() in rest.lower():
                idx = rest.lower().index(lib.lower())
                libro_raw   = lib
                after_libro = rest[idx + len(lib):].strip()
                break

        if not libro_raw:
            lm = re.search(r'[Ll]ibro\s+([^,\d]+)', rest)
            if lm:
                libro_raw  = lm.group(0).strip()
                after_libro = rest[lm.end():].strip()
            else:
                # todo antes de "pág" es el libro
                pag_pos = RE_PAG.search(rest)
                if pag_pos:
                    libro_raw   = rest[:pag_pos.start()].strip(' .,')
                    after_libro = rest[pag_pos.start():]
                else:
                    libro_raw   = rest
                    after_libro = ""

        # ── Detectar página ───────────────────────────────────────────────────
        pag_m  = RE_PAG.search(after_libro)
        pagina = int(pag_m.group(1)) if pag_m else 0

        # ── Sección: texto ANTES de pág y/o DESPUÉS ───────────────────────────
        if pag_m:
            before_pag = after_libro[:pag_m.start()]
            after_pag  = after_libro[pag_m.end():]
        else:
            before_pag = after_libro
            after_pag  = ""

        seccion = _extract_seccion(before_pag, after_pag)

        libro = _normalize_libro(libro_raw)
        if libro or pagina:
            results.append({
                "grado":   grado,
                "libro":   libro,
                "seccion": seccion,
                "pagina":  pagina,
            })

    # Deduplicar por (grado, libro, pagina)
    seen, unique = set(), []
    for r in results:
        key = (r["grado"], r["libro"], r["pagina"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


def extract_ltg(pdf_path: str) -> list:
    """Extrae vinculacion_ltg de un PDF de plano didáctico NEM."""
    lines  = _extract_text(pdf_path).split('\n')
    window = _find_ltg_window(lines)
    return _parse_ltg_block(window) if window else []


if __name__ == "__main__":
    import sys, json
    if len(sys.argv) < 2:
        print("Uso: python ltg_extractor.py <ruta_pdf>")
        sys.exit(1)
    print(json.dumps(extract_ltg(sys.argv[1]), ensure_ascii=False, indent=2))
# (variantes agregadas en patch — ver LIBROS_NEM original arriba)
