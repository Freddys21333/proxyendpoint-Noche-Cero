# Backend

Entorno T-02, contratos T-03 y configuración de dominio T-04. Python **3.12**, NumPy y NetworkX para el motor; pytest para TDD, Ruff para lint/formato y mypy en modo estricto. [OpenAPI, JSON Schema y ejemplos](../schemas/README.md) están disponibles. Todavía no hay endpoints ni simulación implementados.

## Instalación en Windows (PowerShell)

Desde la raíz del repositorio, instalar uv localmente. `.tools/`, `.uv-cache/` y `.venv/` están excluidos de Git:

```powershell
python -m pip install --target .tools uv==0.13.5
cd backend
..\.tools\bin\uv.exe sync --locked --python 3.12 --cache-dir ../.uv-cache
```

Si no encuentra Python 3.12, uv puede descargarlo; también se puede indicar un intérprete existente con `--python 'C:\ruta\a\python.exe'`. No usar el Python 3.15 predeterminado para el backend. La instalación verificada en este equipo usa Python 3.12.14 con la ruta explícita del runtime disponible.

En Linux/macOS, con uv 0.13.5 disponible y Python 3.12, ejecutar `uv sync --locked` desde `backend/`. Esta variante no se ha ejecutado en esta preparación; el empaquetado Linux de Lambda se verificará por separado.

`pyproject.toml` fija las dependencias directas. `uv.lock` fija las versiones transitivas y hashes de los artefactos para los distintos sistemas soportados. Ambos se versionan. Los paquetes de desarrollo no forman parte del futuro artefacto Lambda.

## Verificaciones

Desde `backend/`, sin activar manualmente el entorno virtual:

```powershell
..\.tools\bin\uv.exe lock --check --offline --cache-dir ../.uv-cache
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache ruff check src tests
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache ruff format --check src tests
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache mypy
..\.tools\bin\uv.exe run --locked --offline --cache-dir ../.uv-cache pytest tests
```

El modo offline requiere haber instalado las dependencias primero. `pytest tests` ejecuta las pruebas de contrato y debe devolver código **0**. T-02 todavía no tenía pruebas; T-03 incorpora la suite estática de esquemas y ejemplos, sin pruebas de un motor que aún no existe. Para inspeccionar la colección se puede ejecutar `pytest --collect-only tests` con el mismo prefijo uv.

La estructura `src/domain`, `src/simulation`, `src/strategies` y `src/api` es importable. Pytest agrega `src` a su ruta de importación; no hace falta instalar un paquete editable. La distribución de Lambda conservará esos módulos en la raíz del ZIP.

## Dependencias y actualizaciones

Dependencias principales verificadas: NumPy 2.5.4 y NetworkX 3.7. Herramientas: pytest 9.1.1, Ruff 0.17.2, mypy 1.20.2 y types-networkx 3.6.1.20261024. uv usado: 0.13.5.

Desde T-04, jsonschema 4.26.0 es dependencia de runtime para reutilizar el contrato compartido. Los extras de formatos, openapi-spec-validator 0.9.0, PyYAML 6.0.3, referencing como herramienta directa de tests y types-jsonschema 4.26.0.20261006 son dependencias de desarrollo. El ZIP futuro incluye dependencias transitivas de runtime y `schemas/common.schema.json`, además de los módulos de `src/`; no incluye herramientas de desarrollo.

## Configuración de dominio

Desde el código del backend o pruebas con `src/` en la ruta de importación:

```python
from domain.configuration import normalize_configuration, parse_request

configuration = normalize_configuration({
    "scenario": {"populationSize": 50, "beta": 0},
    "intervention": {"vaccines": 10},
})
assert configuration.scenario.population_size == 50
wire_configuration = configuration.to_dict()  # Copia completa con claves camelCase.
request = parse_request('{"schemaVersion":"1.0"}', operation="preview")
```

Los modelos son dataclasses inmutables; las políticas siempre quedan como `none`, `random`, `targeted`. Los defaults provienen del JSON Schema compartido, no de una segunda tabla mantenida en Python. Omitir configuración permite defaults; pasar null explícito es error. No se limita K silenciosamente: N=50 sin vacunas explícitas conserva el default 100 y se rechaza.

`parse_request` acepta texto o bytes UTF-8, aplica 64 KiB de límite y rechaza JSON inválido, claves duplicadas, NaN/Infinity y desbordamiento numérico. `normalize_configuration` valida tipos/rangos y relaciones K≤N, intervención≤T y nodo<N, sin mutar la entrada ni consultar la red. Aún no puede verificar `ORIGIN_EMPTY` ni hashes reales: esas reglas requieren generador/API.

Los errores `ConfigurationError` exponen `code`, `status_code` y `fields` con rutas/reasons saneadas. No devuelven valores recibidos. Se distinguen 400 INVALID_JSON/UNKNOWN_FIELD, 413 REQUEST_TOO_LARGE y 422 VALIDATION_ERROR; la construcción de respuestas HTTP con versiones y requestId se implementará en T-11.

Las rutas de los esquemas se resuelven desde el módulo, no desde el directorio actual. Se probó importar el dominio en un proceso aislado con `domain/` y `schemas/common.schema.json` copiados fuera del checkout; esto no sustituye probar el ZIP de Lambda en Linux.

Cuando se cambie una dependencia, actualizar su versión en `pyproject.toml`, ejecutar `uv lock`, sincronizar y verificar. No editar `uv.lock` manualmente ni actualizarlo silenciosamente al ejecutar checks. Cualquier cambio que altere resultados del motor necesitará evidencia y versión coherentes con el manifiesto.

## Siguiente tarea

T-05 implementa derivación de semillas por dominio, canonización JSON y hashes versionados. La configuración T-04 ya produce una representación completa y estable, pero no calcula hashes ni implementa aleatoriedad. El motor se incorpora después de semillas y generación de grafo.

Resultado observado de esta preparación: [evidencia de T-02](../docs/evidencia/backend-entorno.md).

Validación de contratos: [evidencia de T-03](../docs/evidencia/backend-contratos.md).

Configuración y entrada estricta: [evidencia de T-04](../docs/evidencia/backend-configuracion.md).
