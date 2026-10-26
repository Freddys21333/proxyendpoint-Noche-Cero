# Configuración y validación — T-04

Fecha: 26 de octubre de 2026. Rama: `feat/backend-contratos`. Windows x86_64, Python 3.12.14. Alcance: dominio local y lectura de JSON; sin handlers ni AWS.

## Cambio verificado

Modelos de configuración inmutables, defaults recursivos desde el JSON Schema, salida camelCase y políticas en orden estable. Validación de tipos/límites del contrato y relaciones vacunas≤población, intervención≤horizonte y nodo<población. Se conserva la entrada original y no se recorta el inventario silenciosamente.

`parse_request` devuelve un PreviewRequest o CompareRequest tipado. Acepta texto/bytes UTF-8, mide el límite de 64 KiB en bytes y rechaza claves duplicadas, JSON inválido y números no finitos. Los errores incluyen código, estado previsto y rutas saneadas; no contienen los valores recibidos.

jsonschema 4.26.0 pasa a ser dependencia de runtime; types-jsonschema 4.26.0.20261006 se incorpora al grupo de desarrollo para mantener mypy estricto. El contrato compartido se carga localmente. Se probó el dominio en otro proceso con carpetas domain/ y schemas/ copiadas fuera del checkout, sin depender del directorio de trabajo.

## Ciclo TDD observado

Antes de implementar, `pytest backend/tests/test_configuration.py -x -q` falló en el caso de defaults porque normalize_configuration aún lanzaba NotImplementedError (código 1, una prueba fallida). Después se implementaron los modelos, normalización y lector estricto; las primeras 56 pruebas nuevas pasaron. Se añadieron verificaciones de límites inclusivos, orígenes, empaquetado local y profundidad de entrada.

Resultado final: **65 pruebas nuevas de T-04 y 139 pruebas totales aprobadas**. Las pruebas de configuración cubren entrada omitida frente a null, defaults anidados, no mutación, inmutabilidad, orden de políticas, números integrales, cero/−0, errores por campo, límites/relaciones, JSON estricto, tamaño real de 64 KiB y carga fuera del checkout. Se conservan las 74 pruebas de contrato de T-03.

## Comandos finales

Desde la raíz, con entorno sincronizado:

| Comando (prefijo `.\.tools\bin\uv.exe`) | Resultado observado |
|---|---|
| `lock --check --offline --project backend --cache-dir .uv-cache` | Código 0; lock coherente. |
| `run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | Código 0; 139 passed. |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests` | Código 0; sin errores. |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff format --check backend/src backend/tests` | Código 0; diez archivos ya formateados. |
| `run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src` | Código 0; siete archivos fuente sin errores. |
| `run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | Código 0; OpenAPI válido. |

## Límites de la evidencia

No se ha ejecutado Lambda ni un servidor HTTP. La carga de recurso empaquetado se verifica en Python local, no equivale al build Linux del ZIP completo. ORIGIN_EMPTY y graphHash real necesitan grafo/API y quedan pendientes. Todavía no se generan semillas, hashes, curvas, resultados ni exportaciones de experimentos. La canonización binaria/JSON para hashes se implementa en T-05; T-04 normaliza la configuración y su representación de contrato.
