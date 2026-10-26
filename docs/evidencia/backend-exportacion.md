# Exportación y reproducción — T-10

Fecha: 26 de octubre de 2026. Rama feat/backend-contratos.
Windows x86_64, Python 3.12.14, NumPy 2.5.4, NetworkX 3.7, jsonschema 4.26.0.
Ref.: RF-13/19, CA-06/07/11, REQ-09.

## Implementación

`simulation.exports.export_experiment` convierte resultado real T-09 en documento CompareResponse con manifiesto (versiones reales, raíz, generador/RNG/canonización, entorno y hashes), UTC terminado en Z y requestId. El commit es el suministrado por build/CLI; si falta se declara unknown. El esquema compartido se valida localmente con formatos. No hay nuevas dependencias.

experimentHash usa configuration, graph, versions y resultados de réplicas según la proyección detallada en agreements.md §6. Excluye fechas/requestId/buildCommit, eventos/frames y hashes derivados. Se verifican graphHash/initialStateHash/resultHash por separado. Python/dependencias forman parte de versions para evitar prometer identidad entre entornos arbitrarios.

`load_export` limita entrada a 32 MiB y usa lector estricto (UTF-8 sin duplicados ni números no finitos), valida contrato/hashes y coherencia de manifiesto. `reproduce` exige versiones compatibles, reejecuta el mismo motor y verifica hash más datos derivados/eventos/frames presentes. No necesita frames para reproducir. No retorna éxito ante contenido alterado aunque esté fuera de la proyección del hash.

`scripts/reproduce.py` recibe un JSON y funciona desde cualquier cwd con el entorno backend. Imprime hash y sale 0 si coincide; falla sin traceback con código 1 ante documento/entorno/datos incompatibles. `scripts/export_experiment.py` acepta configuración directa, crea JSON y ZIP de análisis con rutas nuevas, no sobrescribe, y permite omitir frames/registrar commit.

El ZIP local es referencia para generación cliente T-15, sin endpoint nuevo. Incluye configuration.json, manifest.json, comparison-summary.json y ocho CSV con columnas acordadas. UTF-8, comas/escape estándar, null como celda vacía y arrays como JSON. Eventos solo de representativa, documentados con exportMetadata en el manifest ZIP sin mutar el manifiesto del experimento. Timestamps de entradas ZIP fijos; no hay metadatos volátiles adicionales.

## TDD y verificaciones observadas

Rojo: `pytest backend/tests/test_exports.py -x -q` devolvió código 1 por NotImplementedError en export_experiment. Durante integración, el schema rechazó la fecha ISO con +00:00; se corrigió a UTC Z según contrato. La suite nueva final pasó 17 pruebas antes de verificar la suite completa.

Desde raíz con prefijo `.\.tools\bin\uv.exe`:

| Argumentos | Resultado |
|---|---|
| `run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | **269 passed in 72.90s**, código 0; 17 pruebas nuevas |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests scripts` | Sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff format --check backend/src backend/tests scripts` | 24 archivos formateados |
| `run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src scripts` | 15 fuentes sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | OK |
| `lock --check --offline --project backend --cache-dir .uv-cache` | Lock coherente |

Pruebas usan experimentos reales N=50/T=2..3/R=2: CompareResponse completo con formatos, manifiesto real, hash no volátil sin mutación, reimportación y nuevo proceso desde carpeta temporal, CLI exportación→JSON/ZIP→reproducción, no sobrescritura, salida no cero ante hash diferente, alteraciones de configuración/grafo/métricas/versión/resumen/eventos/frames, metadatos duplicados incoherentes, tamaño, JSON duplicado/NaN/desbordamiento/UTF-8 inválido, frames omitidos/presentes con hash idéntico, ZIP estable, listas CSV reimportadas, filas diarias/eventos, null y comparison-summary. Se conservaron las 252 pruebas previas. pytest requirió temporales/subprocesos fuera del sandbox.

## Límites

No hay API desplegada ni descarga desde UI todavía: T-11 integrará handlers y límites HTTP/gzip y T-15 implementará el ZIP en cliente. No se verificó build Linux/Lambda, p95 AWS ni gate científico T-22. Las versiones se comparan estrictamente; para reproducir archivos de otras versiones hay que usar el entorno/commit correspondiente. El hash demuestra reproducibilidad del contenido y no sustituye el gate experimental. Los archivos de prueba se generaron en temporales y no se versionan como evidencia de superioridad.
