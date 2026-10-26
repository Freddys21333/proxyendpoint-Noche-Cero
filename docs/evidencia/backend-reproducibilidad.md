# Semillas y canonización — T-05

Fecha: 26 de octubre de 2026. Rama: feat/backend-contratos.
Python 3.12.14, NumPy 2.5.4, Windows x86_64. Ref.: CA-06/07, D-06.

## Implementación

`domain.reproducibility` deriva entropy con SHA-256 de la etiqueta dividido en ocho uint32 little-endian, precedidos de raíz e índice. Generator/PCG64/SeedSequence explícitos, sin RNG global ni spawn. graph/layout/bootstrap fijan índice 0; el resto conserva índice de réplica. Raíz uint32 e índice no negativo, booleanos rechazados.

canonical-v1 serializa árboles JSON en UTF-8 con claves ordenadas, sin espacios ni salto final, Unicode conservado, floats integrales convertidos a enteros y -0.0 a 0. Rechaza no finitos y valores ajenos a JSON, sin modificar la entrada. SHA-256 lleva prefijo sha256:. El productor ordena listas y selecciona el contenido no volátil; la primitiva no elimina claves por nombre.

## TDD observado y verificaciones

Rojo: `pytest backend/tests/test_reproducibility.py -q` devolvió código 1, ModuleNotFoundError para domain.reproducibility antes de crear el módulo. Verde/refactor: implementación y formato, suite completa final con **164 passed in 11.60s**, código 0 (25 pruebas nuevas).

Desde raíz, prefijo `.\.tools\bin\uv.exe`:

| Argumentos | Resultado |
|---|---|
| `run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | 164 aprobadas |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests` | Sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff format --check backend/src backend/tests` | 12 archivos formateados |
| `run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src` | 8 fuentes sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | OK |
| `lock --check --offline --project backend --cache-dir .uv-cache` | Lock coherente |

Pruebas verifican bytes canónicos conocidos, SHA-256 de objeto vacío, algoritmo de derivación contra construcción independiente, vector fijo de cuatro uniformes, aislamiento de consumo/dominio/réplica y tres procesos nuevos con PYTHONHASHSEED 1/42/random desde otro directorio. No se cambia el resultado al invertir orden de claves; sí al invertir listas. pytest se ejecutó fuera del sandbox para permitir temporales.

## Límites

No hay grafo, matrices potenciales, políticas, métricas ni manifiesto ejecutable todavía. Sus proyecciones específicas graphHash/randomnessHash/resultHash/experimentHash se integrarán y probarán en T-06..11, sin fabricar resultados ni declarar completada la aceptación integral CA-06/07 del motor. Garantía limitada al entorno fijado; no se promete identidad entre serializadores o versiones arbitrarias. Sin AWS, commit ni push en este incremento.
