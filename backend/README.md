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

## Reproducibilidad T-05

`domain.reproducibility` ofrece `create_rng(root_seed, domain, replicate_index=0)`, `seed_entropy(...)`, `canonical_json(value)` y `json_hash(value)`. Se fijan rng-v1, PCG64 y canonical-v1. Cada generador es nuevo e independiente; conservar la instancia mientras se consume un flujo. graph/layout/bootstrap usan índice 0.

La canonización conserva listas, normaliza floats integrales y cero negativo, rechaza no finitos y claves no textuales. No muta entradas. El llamador ordena entidades y construye la proyección sin campos volátiles ni su propio hash; no se eliminan claves automáticamente. Los hashes de grafo/resultados/matrices y manifiesto se conectarán con sus productores.

164 pruebas aprobadas y evidencia en [T-05](../docs/evidencia/backend-reproducibilidad.md).

## Siguiente tarea

T-07 implementa el motor SEIR y eventos diarios sobre la red T-06. Todavía no hay simulador ni endpoints.

## Red y origen T-06

`simulation.network.generate_graph(configuration)` devuelve grupos y contactos hasta T inclusive. `select_initial(configuration, graph, replicate_index=0)` selecciona infectados sin reemplazo. `build_preview(configuration)` devuelve payload de dominio con configuración, grafo, posiciones y hashes reales; el adapter HTTP se implementará en T-11.

El límite de unión es 100.000 aristas; un exceso genera GRAPH_TOO_LARGE (413), sin truncar. initialStateHash cubre graphHash e IDs iniciales ordenados, antes de vacunar. Los supuestos y orden de muestreo están en agreements.md §2. [Evidencia T-06](../docs/evidencia/backend-grafo.md).

## Checkov local

Checkov 3.3.30 se instala en un entorno separado porque sus dependencias difieren del motor (por ejemplo NetworkX). Desde la raíz, después de preparar el backend:

```powershell
.\.tools\bin\uv.exe venv .tools/checkov-env --python backend/.venv/Scripts/python.exe
.\.tools\bin\uv.exe pip install --python .tools/checkov-env/Scripts/python.exe checkov==3.3.30 --cache-dir .uv-cache
.\scripts\checkov.ps1 --version
.\scripts\checkov.ps1 -d infra --framework terraform --skip-download
```

Se verificó instalación y versión. infra aún no contiene Terraform; no se declara infraestructura segura ni una auditoría aprobada por instalar la herramienta. El wrapper usa Python explícito, sin depender de la asociación .py de Windows. Ningún token ni conexión a una plataforma es necesario para el uso local.

Resultado observado de esta preparación: [evidencia de T-02](../docs/evidencia/backend-entorno.md).

Validación de contratos: [evidencia de T-03](../docs/evidencia/backend-contratos.md).

Configuración y entrada estricta: [evidencia de T-04](../docs/evidencia/backend-configuracion.md).
