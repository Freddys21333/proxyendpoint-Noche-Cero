# P-05: datos reales de dengue en Manabí desde las gacetas del MSP

**Fecha:** 2026-10-27
**Rama:** `feat/backend-contratos`
**Iteración:** I-03 del [plan PRO](../plan-pro-iteraciones.md)
**Hito:** existe un dataset real, trazable y reproducible de casos semanales de dengue de Manabí (2025 y 2026) con procedencia completa, controles de totales y límites explícitos. **No** se conecta al motor SEIR, no se mezcla con OSM ni con casos sintéticos y **no** constituye calibración (P-06 sigue abierto).

## 1. Qué se entregó

| Pieza | Archivo | Función |
|---|---|---|
| Manifiesto de fuentes | `data/p05/sources.json` | URL, edición, corte, hash SHA-256, tamaño, página, controles y límites de cada gaceta. |
| Geometría extraída | `data/p05/geometry/*.json` | Etiquetas impresas, todas las polilíneas candidatas y la seleccionada, con la versión del extractor. Permite auditar sin PDF. |
| Tabla normalizada | `data/p05/manabi-dengue-weekly.csv` | 94 observaciones: `province,year,week,cases,snapshot_id`, ordenadas, sin duplicados. |
| Procedencia | `data/p05/manabi-dengue-provenance.json` | Metadatos, método, controles ejecutados, hash del CSV y límites. |
| Lógica pura | `backend/src/data/dengue.py` | Selección de polilínea, escala, derivación, controles y (de)serialización. Sin red ni PyMuPDF. |
| Importador | `scripts/p05_import_dengue.py` | `download`, `extract`, `build`, `verify`, `render`. |
| Pruebas | `backend/tests/test_p05_dengue.py` | 13 pruebas con geometría real y controles negativos. |
| Figura | `docs/evidencia/figuras/p05-dengue-manabi.svg` | Render determinista de la tabla normalizada (no del PDF). |
| LF garantizado | `.gitattributes` | El CSV conserva LF en cualquier clon; su hash no depende de `core.autocrlf`. |

Sin cambios de contrato científico, semillas, hashes base ni `specs/validation/t22-v1`.

## 2. Fuente y procedencia

| Campo | 2025 | 2026 |
|---|---|---|
| Publicación | Gaceta ETV, SE 53/2025 | Gaceta ETV, SE 41/2026 |
| URL | `https://www.salud.gob.ec/wp-content/uploads/2026/01/Enfermedades-Trasmitidas-por-Vectores-DNVE-SE-53.pdf` | `https://www.salud.gob.ec/wp-content/uploads/2026/10/ETV_Gaceta_41.pdf` |
| SHA-256 | `c44b829b5e74b71467f424922d0cd9b4142dab08cd31c74e1825f57ca5c5141b` | `decd710e03b4f2356b03981e2d35a34a9facc7a5208435f0eaa0da6fafd0f9d6` |
| Tamaño | 1 208 818 bytes | 1 182 136 bytes |
| Creación del PDF | 2026-01-08 13:29 UTC | 2026-10-21 13:06 UTC |
| Página del gráfico | 3 | 3 |
| Semanas | 1–53 | 1–41 |

- **Editor:** Ministerio de Salud Pública del Ecuador, Subsecretaría de Vigilancia, Prevención y Control de la Salud, Dirección Nacional de Vigilancia Epidemiológica.
- **Definición del caso:** casos de dengue notificados al Sistema VIEpi (DSSA + DCSA + DG). La propia gaceta advierte: *«Fuente: Sistema Viepi – Datos preliminares sujetos a validación»*.
- **Condiciones:** documento público oficial. No se redistribuye el PDF; solo se versionan el hash, la geometría extraída y la tabla normalizada.
- **Geografía:** agregado **provincial**. La fuente no publica datos cantonales ni de Manta.

## 3. Método de extracción

El gráfico provincial es vectorial: cada año es una polilínea de un color y el año en curso lleva una etiqueta numérica por semana. La extracción no se apoya en el título ni en la posición de la leyenda, porque son inconsistentes entre ediciones (el título de 2025 dice «hasta el año 2024» aunque la serie importada es la de 2025).

1. Se localiza el título del gráfico provincial y el marco rectangular situado justo debajo.
2. Se recogen las etiquetas numéricas del año en curso (tamaño 7,5–9 pt) dentro del marco, descartando las filas de leyenda por su estructura (≥3 valores de año consecutivos en la misma línea).
3. Se extraen **todas** las polilíneas de color del marco como candidatas.
4. Se ajusta la escala `y = a + b·valor` con el valor máximo y mínimo de las etiquetas y los vértices extremos de la polilínea.
5. Se deriva el valor de cada vértice y se exige que el **multiconjunto** derivado sea exactamente el de las etiquetas impresas. Solo una polilínea lo cumple; si hay cero o más de una, la importación falla.

Resultado de la selección:

| Año | Polilíneas candidatas | Color elegido | Vértices | Semanas | Escala (pt/caso) |
|---|---|---|---|---|---|
| 2025 | 5 | `0.9294,0.4000,0.3647` | 53 | 1–53 | 0.3773 |
| 2026 | 6 | `0.7843,0.3216,0.0000` | 41 | 1–41 | 0.3235 |

El eje de semanas es estrictamente creciente y equiespaciado (17,1509 pt), lo que confirma un punto por semana sin huecos.

### Etiquetas solapadas (2025, semanas 26 y 27)

Las etiquetas `164` y `113` se imprimen solapadas y su orden horizontal está invertido respecto al eje. La geometría resuelve el orden: la semana 26 vale 164 y la 27 vale 113. La diferencia queda registrada en `provenance.snapshots[0].extraction.positional_label_mismatches`; el multiconjunto se reproduce completo y el total no cambia.

## 4. Controles de totales

### 2026 — control directo

La tabla provincial de la página 2, fila `MANABI`, columna `Total Casos`, publica **11 946**. La suma de las 41 semanas del gráfico da **11 946**. Control exacto, sin tolerancia.

Además, la misma fila desglosa el total y el desglose también cierra: `2 249 (DCSA SE1-40) + 72 (DG SE1-40) + 9 261 (DSSA SE1-40) + 11 (DCSA SE41) + 353 (DSSA SE41) = 11 946`.

### 2025 — control indirecto

La tabla provincial de 2025 publica **tasas por 100 000 habitantes**, no casos. El control usa las cuatro tasas de la fila `MANABI`:

```
DCSA SE1-52 64,40 + DG SE1-52 2,77 + DSSA SE1-52 311,72 + DSSA SE53 1,08 = 379,97 (tasa total)
```

Con la población implícita (6 313 casos / 379,97 × 100 000 = 1 661 446,96 habitantes), cada tasa reconstruye un entero y los cuatro vuelven a sumar el total semanal:

```
1 070 + 46 + 5 179 + 18 = 6 313
```

Es un control indirecto, no una tabla de casos; queda declarado así en la procedencia. La población implícita es coherente con la proyección poblacional de Manabí, pero **no se usa como dato**: no hay tasas en el CSV normalizado.

## 5. Resultado

| Año | Semanas | Total | Mínimo | Máximo |
|---|---|---|---|---|
| 2025 | 1–53 | 6 313 | 18 (S53) | 279 (S14) |
| 2026 | 1–41 | 11 946 | 51 (S2) | 517 (S28) |
| **Conjunto** | **94** | **18 259** | — | — |

- SHA-256 del CSV: `e51b0858624ccd32349e86fcee57777bc1834579b80416e21ce54b1b11d1913a`.
- `data/p05/manabi-dengue-weekly.csv`: 3 463 bytes.
- Figura: [p05-dengue-manabi.svg](figuras/p05-dengue-manabi.svg).

## 6. Verificación automática

Backend, desde `backend/`:

| Comando | Resultado |
|---|---|
| `pytest -q` | **369 pruebas, 0 fallos** (13 nuevas de P-05) |
| `ruff check src tests` | All checks passed |
| `ruff format --check src tests` | 42 files already formatted |
| `mypy` | Success: no issues found in 23 source files |

Importación y verificación, desde la raíz:

```sh
backend/.venv/bin/python scripts/p05_import_dengue.py verify
```

Salida real (2026-10-27):

```json
{"status":"passed","dataset_id":"manabi-dengue-weekly-v1","csv_sha256":"e51b0858624ccd32349e86fcee57777bc1834579b80416e21ce54b1b11d1913a","rows":94,"years":[2025,2026],"weeks":94,"total_cases":18259,"snapshots":[{"snapshot_id":"msp-etv-se53-2025","weeks":53,"sum_cases":6313,"controls":["rate-components"],"positional_label_mismatches":2},{"snapshot_id":"msp-etv-se41-2026","weeks":41,"sum_cases":11946,"controls":["official-total","case-components"],"positional_label_mismatches":0}]}
```

`verify` recalcula todo desde `data/p05/geometry/`, exige que el CSV sea byte a byte idéntico y que la procedencia coincida con la recomputada.

## 7. Reproducción completa

```sh
# 1. Descarga y comprobación de hash (red)
backend/.venv/bin/python scripts/p05_import_dengue.py download

# 2. Extracción del gráfico (requiere PyMuPDF; solo este paso)
python -m pip install pymupdf            # 1.28.2 en la ejecución registrada
backend/.venv/bin/python scripts/p05_import_dengue.py extract

# 3. Construcción de la tabla y la procedencia (solo stdlib)
backend/.venv/bin/python scripts/p05_import_dengue.py build --imported-at 2026-10-27T00:00:00Z

# 4. Comprobación sin red ni PDF
backend/.venv/bin/python scripts/p05_import_dengue.py verify
```

`build` reescribe la marca `imported_at_utc`; `verify` la ignora a propósito. Si el MSP publica una revisión del PDF en la misma URL, el hash falla y la importación se detiene: el cambio exige revisión explícita, no se absorbe en silencio.

## 8. Límites

1. **Granularidad provincial.** No hay datos de Manta ni cantonales. Los 94 puntos describen Manabí completo.
2. **Datos preliminares.** Una gaceta posterior puede revisar semanas ya publicadas; esta versión es una instantánea, no la verdad final.
3. **2026 está incompleto.** Cubre hasta la SE 41, no el año completo.
4. **Sin fechas calendario.** La fuente no publica la fecha de cada semana epidemiológica; el CSV usa año y semana.
5. **Solo 2025 y 2026.** Las series 2021–2024 aparecen en el gráfico sin etiquetas impresas y no se importan en esta versión.
6. **No alimenta el simulador.** `provenance.usage.wired_into_simulator = false`. No se mezcla con posiciones OSM ni con casos sintéticos, y no hay reparto de casos provinciales entre personas o nodos.
7. **No es calibración.** P-06 (variable observada, función de observación, ajuste/validación separados) sigue pendiente. La serie disponible permite intentarlo, pero eso se decide y se evidencia en su propia iteración.
8. **La extracción depende de PyMuPDF.** Se registra la versión (`1.28.2`); la geometría versionada permite auditar el resultado sin repetir el paso.

## 9. Estado de P-05

- [x] Publicaciones concretas con observaciones utilizables de Manabí.
- [x] URL, edición, fecha de creación, corte, período, condiciones, hash y tamaño.
- [x] Tabla normalizada con geografía, semana, casos, definición y unidad.
- [x] Incidencia frente a acumulados: `value_kind = weekly_cases`, `is_cumulative = false`.
- [x] Ceros frente a ausencias: las 94 semanas tienen vértice y etiqueta; no hay huecos declarados como cero.
- [x] Correcciones y duplicados: detección de semana duplicada; instantánea por edición.
- [x] Controles de totales: directo (2026) e indirecto por tasas (2025).
- [x] Límite de granularidad documentado.
- [x] Descarga/extracción repetible y `verify` sin red.
- [x] Datos reales separados de OSM y de los casos sintéticos.
