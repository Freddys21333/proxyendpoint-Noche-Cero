# Verificación de contratos — T-03

Fecha: 26 de octubre de 2026. Rama: `feat/backend-contratos`. Entorno: Windows x86_64, Python 3.12.14 y uv 0.13.5. Sin acceso a AWS ni despliegue.

## Alcance comprobado

- OpenAPI 3.1.0 con health, config, preview y compare; JSON Schema Draft 2020-12 en un archivo compartido y ocho entradas específicas.
- 26 ejemplos catalogados: defaults, health/config, requests completos/mínimos, preview, cuatro variantes de compare y los 14 códigos de error acordados.
- Requests parciales frente a configuración normalizada completa, tipos/rangos/enums, campos desconocidos, políticas únicas, origen node, envoltorio de error y condiciones de bootstrap/eventos.
- Referencias locales de esquema y ejemplos conectados a operación/estado HTTP; fechas UTC con formato comprobado.
- Consistencia interna de mocks: conservación, dosis, tamaños diarios, frames, número de réplicas y medias de métricas.

## Ciclo rojo/verde observado

1. Antes de crear los contratos se ejecutó `pytest tests/test_contracts.py -x -q` desde backend: código 1, prueba de OpenAPI fallida porque `schemas/openapi.yaml` aún no existía. Las dependencias de prueba sí estaban instaladas; no se confundió una herramienta ausente con fase roja.
2. Después de crear los artefactos, la primera suite pasó con 56 casos. Se añadieron ejemplos de vacunas/bootstrap y restricciones de respuestas.
3. Se añadió un caso que cambia `summaryByPolicy.none.peakDay.mean` a −1: `pytest backend/tests/test_contracts.py -k responses_reject_invalid_data -x -q` desde la raíz falló por AssertionError porque el esquema todavía aceptaba ese valor (1 fallida, 5 pasadas, 57 deseleccionadas). Se restringieron los estadísticos de conteos/días a 0..2000, manteniendo las diferencias pareadas con signo.
4. La suite final pasó con **74 pruebas**. El contrato no implementa la simulación; los ejemplos son mocks.

## Verificación final

Comandos desde la raíz del repositorio, usando el entorno ya sincronizado:

| Comando | Resultado |
|---|---|
| `.\.tools\bin\uv.exe lock --check --offline --project backend --cache-dir .uv-cache` | Código 0; lock coherente. |
| `.\.tools\bin\uv.exe run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | Código 0; 74 passed. |
| `.\.tools\bin\uv.exe run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | Código 0; schemas/openapi.yaml: OK. |
| `.\.tools\bin\uv.exe run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests` | Código 0; sin errores. |
| `.\.tools\bin\uv.exe run --locked --offline --project backend --cache-dir .uv-cache ruff format --check backend/src backend/tests` | Código 0; seis archivos ya formateados. |
| `.\.tools\bin\uv.exe run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src` | Código 0; sin errores en cuatro módulos iniciales. |

## Límites

Todavía no hay handlers, normalizador, motor ni exportador. JSON Schema no modifica defaults ni compara campos: relaciones N/K/T/origen se implementan en T-04. Los hashes de ejemplos son marcadores de formato y no se verifican como hashes reales. El grafo de muestra no proviene del generador; los ejemplos no sirven como evidencia científica ni de reproducibilidad.

No se probó transporte gzip/base64 a través de AWS, generación de CSV/ZIP, quotas, despliegue, rendimiento ni política de vacunación real. El estado Budget sigue provisional. La suite no requiere red para resolver referencias de contratos: el registro de JSON Schema se carga desde archivos locales.
