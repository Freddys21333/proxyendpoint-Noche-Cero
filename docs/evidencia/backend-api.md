# API base integrada — T-11

Fecha: 26 de octubre de 2026. Rama feat/backend-contratos.
Windows x86_64, Python 3.12.14; dependencias del lock sin cambios.
Ref.: REQ-01..09/11, RF-19/20 y CA-13/15 en su parte local. URL pública y permisos desplegados siguen pendientes.

## Implementación

Cuatro handlers exactos `api.health/config/preview/compare.handler` para eventos HTTP API v2, con rutas GET health/config y POST scenarios/preview/simulations/compare bajo /v1. `api.common` comparte validación/transporte/errores. No hay framework, servidor local ni llamadas AWS.

Health publica región configurada, build real proporcionado o unknown, fecha UTC Z y versiones. Config publica defaults, límites efectivos y descripción de grupos/calendario/supuestos sintéticos. Versiones de entorno deben coincidir con motor/schema; límites inválidos dan COMPUTE_UNAVAILABLE 503. MAX_RESPONSE_BYTES mínimo 1024 permite respuestas de error; solo se aceptan reducciones de los máximos acordados.

Preview normaliza request y genera grafo/origen reales. Compare aplica límite de frames, genera la misma red limitada y verifica expectedGraphHash antes de simular (409 si no coincide). Reutiliza esa red en run_experiment y exige todas las réplicas válidas antes del 200. T-10 completa manifiesto/hashes; la respuesta valida CompareResponse. No se acepta selección incompleta de políticas ni resultado parcial presentado como éxito.

Preview/compare usan JSON UTF-8→gzip mtime=0→base64 con isBase64Encoded=true y Content-Encoding:gzip. La suite simula decodificación Lambda/Gateway y descompresión cliente. Health/config/errores son JSON ordinario. El límite incluye el envoltorio completo, medido conservadoramente con JSON ASCII y espacios, además del JSON sin comprimir. Se limita petición por bytes UTF-8 y por longitud base64 antes de decodificar. Errores 400/404/409/413/422/500/503 saneados, con campos acotados para no exceder transporte; errores pequeños pueden explicar límites de datos reducidos usando JSON ordinario.

CORS se deja a HTTP API; no hay wildcard. Logs JSON incluyen requestId/version/fase/estado/error/duración y N/aristas/R cuando hay resultado disponible. No incluyen cuerpo, grafo, rootSeed ni trazas internas. Si Lambda informa menos de un segundo restante no se empieza preview/compare, devolviendo 503; no se garantiza con esto completar cualquier preset dentro del timeout.

## TDD y verificaciones observadas

Rojo: `pytest backend/tests/test_api.py -x -q` devolvió código 1 con NotImplementedError en health.handler antes de implementar. Verde/refactor: handlers/adapters compartidos, integración real y casos de límites/errores. Se verificó primero la suite API y luego regresión completa tras ajustes de transporte/logs.

Desde raíz con prefijo `.\.tools\bin\uv.exe`:

| Argumentos | Resultado |
|---|---|
| `run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | **300 passed in 79.49s**, código 0; 31 pruebas API nuevas |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests scripts` | Sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff format --check backend/src backend/tests scripts` | 30 archivos formateados |
| `run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src scripts` | 20 fuentes sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | OK |
| `lock --check --offline --project backend --cache-dir .uv-cache` | Lock coherente |

Casos reales N=50/T=3/R=2: health/config con metadatos, preview/compare con/sin frames, cuatro schemas y error schema, gzip/base64 y mtime=0, reproducción de compare mediante T-10, cambio de vacunas conservando graphHash, rechazo de hash ajeno antes del motor, políticas incompletas, claves desconocidas/duplicadas/NaN/JSON inválido, límites de N y UTF-8, base64/UTF-8 inválidos, grafo/JSON/envoltorio/frames limitados, frames=false permite omisión, errores internos sin secreto inyectado, resultado parcial rechazado, versiones/límites incompatibles, contexto Lambda insuficiente/requestId, rutas/métodos inválidos, detalles de error dentro de 1024 bytes y logs sin cuerpo/grafo/semilla. Se conservaron las 269 pruebas previas, incluidas exportación CLI y reproducibilidad entre procesos. pytest requirió permisos para temporales/subprocesos fuera del sandbox.

## Límites y siguientes frentes

No se creó infraestructura ni se inició HTTP público/local. No se verificó ZIP Linux con NumPy/NetworkX/jsonschema, permisos IAM/CORS real, cuotas ni latencia de Lambda/API Gateway. Estas verificaciones pertenecen a T-17..20; CA-13 público y CA-15 desplegado permanecen abiertos. El presupuesto de tiempo 28 s para compare y p95 del escenario de 30 réplicas requieren benchmark T-19; los tests locales no demuestran esos objetivos.

Núcleo backend T-02..11 verificado localmente. Quedan frontend T-12..16, infraestructura T-17..20, documentación final T-21 y validación científica T-22/23. No se declara superioridad científica de targeted ni producto listo para pitch por cerrar handlers.
