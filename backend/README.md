# Backend

Entorno T-02, contratos T-03 y configuración de dominio T-04. Python **3.12**, NumPy y NetworkX para el motor; pytest para TDD, Ruff para lint/formato y mypy en modo estricto. [OpenAPI, JSON Schema y ejemplos](../schemas/README.md) están disponibles. El motor y las políticas pareadas T-07/08 ya son ejecutables localmente; la exportación y reproducción T-10 ya están verificadas; los cuatro handlers Lambda T-11 ya están integrados y verificados localmente, sin despliegue AWS.

## Instalación en Windows (PowerShell)

La validación de respuestas recorre una sola vez el contrato con comprobación de formatos. Ante documentos inválidos conserva los errores detallados anteriores. Comparación valida el documento final dentro de `export_experiment`, incluido el identificador HTTP, y evita validarlo otra vez en el handler. No cambia el generador ni el motor.

Medición local del 2026-10-27: sobre el mismo documento N=60, T=7, R=2, la mediana de tres mediciones de validación pasó de 1,1616 s (dos validaciones estructurales más dos con formatos) a 0,3338 s (una con formatos). Es una medición de validación, no del tiempo total ni de AWS. Tres casos de integración real por Vite/API conservaron sus hashes científicos previos; consultar red y comparar tardaron juntos 760, 656 y 425 ms respectivamente. Los casos grandes todavía dependen del costo de simulación y del tamaño de respuesta.

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

## Benchmark local del motor

Desde la raíz, sin frames:

```sh
backend/.venv/bin/python scripts/benchmark_engine.py --repetitions 30 \
  --output docs/evidencia/benchmark-default-2026-10-27-after.json
```

La corrida del 2026-10-27 midió **44,3 s** para el escenario por defecto, con los mismos hashes y resultados que la versión anterior. Objetivo local de ≤60 s cumplido; el objetivo de ≤25 s backend sigue pendiente. [Evidencia I-01](../docs/evidencia/i01-rendimiento.md).

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

Los errores `ConfigurationError` exponen `code`, `status_code` y `fields` con rutas/reasons saneadas. No devuelven valores recibidos. Se distinguen 400 INVALID_JSON/UNKNOWN_FIELD, 413 REQUEST_TOO_LARGE y 422 VALIDATION_ERROR; T-11 construye respuestas HTTP con versiones y requestId.

Las rutas de los esquemas se resuelven desde el módulo, no desde el directorio actual. Se probó importar el dominio en un proceso aislado con `domain/` y `schemas/common.schema.json` copiados fuera del checkout; esto no sustituye probar el ZIP de Lambda en Linux.

Cuando se cambie una dependencia, actualizar su versión en `pyproject.toml`, ejecutar `uv lock`, sincronizar y verificar. No editar `uv.lock` manualmente ni actualizarlo silenciosamente al ejecutar checks. Cualquier cambio que altere resultados del motor necesitará evidencia y versión coherentes con el manifiesto.

## Reproducibilidad T-05

`domain.reproducibility` ofrece `create_rng(root_seed, domain, replicate_index=0)`, `seed_entropy(...)`, `canonical_json(value)` y `json_hash(value)`. Se fijan rng-v1, PCG64 y canonical-v1. Cada generador es nuevo e independiente; conservar la instancia mientras se consume un flujo. graph/layout/bootstrap usan índice 0.

La canonización conserva listas, normaliza floats integrales y cero negativo, rechaza no finitos y claves no textuales. No muta entradas. El llamador ordena entidades y construye la proyección sin campos volátiles ni su propio hash; no se eliminan claves automáticamente. Los hashes de grafo/resultados/matrices y manifiesto se conectarán con sus productores.

164 pruebas aprobadas y evidencia en [T-05](../docs/evidencia/backend-reproducibilidad.md).

## Siguiente tarea

El núcleo backend T-02..11 está verificado localmente. Falta integración con frontend T-16, build Linux y benchmark/despliegue T-19, y gate científico T-22. No hay URL pública todavía.

## API Lambda T-11

Handlers exactos: `api.health.handler`, `api.config.handler`, `api.preview.handler`, `api.compare.handler`. Aceptan eventos HTTP API payload 2.0 y context; no inician un servidor local ni crean recursos AWS.

| Método/ruta | Comportamiento |
|---|---|
| GET /v1/health | Estado, región configurada, build, versiones y fecha UTC |
| GET /v1/config | Defaults normalizados, límites efectivos, características y descripción del generador |
| POST /v1/scenarios/preview | Request validado, configuración, grafo/hash, posiciones y origen/hash |
| POST /v1/simulations/compare | Hash esperado obligatorio, experimento real completo y manifiesto |

Preview/compare devuelven body base64 de gzip (mtime=0), isBase64Encoded=true y Content-Encoding:gzip. El consumidor local primero decodifica base64 y luego gzip; API Gateway entrega bytes gzip al navegador, que los descomprime. Health/config/errores son JSON ordinario. El cliente de exportación T-10 consume el JSON ya descomprimido.

Configuración: AWS_REGION del runtime (default local us-east-2), BUILD_COMMIT (unknown si falta), ENGINE_VERSION=0.1.0 y SCHEMA_VERSION=1.0. Si se especifican versiones incompatibles se devuelve 503 COMPUTE_UNAVAILABLE; no se inventan versiones. Los límites MAX_REQUEST_BYTES=65536, MAX_RESPONSE_BYTES=5242880, MAX_DECODED_RESPONSE_BYTES=33554432, MAX_EDGES=100000 y MAX_FRAME_STATES=400000 se pueden reducir mediante entorno, sin exceder los máximos del contrato. MAX_RESPONSE_BYTES requiere al menos 1024 para informar errores. Los errores pequeños conservan JSON ordinario para poder explicar un exceso del límite de datos.

El adapter limita bytes UTF-8/base64 antes del dominio, usa la validación compartida, rechaza grafo desactualizado con 409 antes de simular y aplica límites de frames/grafo/JSON/envoltorio (medición conservadora con JSON ASCII y espacios). El grafo generado y validado en compare se reutiliza al experimentar. Solo devuelve 200 si las réplicas están completas y el schema valida. Devuelve 400/404/409/413/422/500/503 saneados según el fallo; el motor no genera progreso ficticio. Un contexto Lambda con menos de un segundo disponible impide empezar trabajo pesado; esto no sustituye el benchmark de timeout real.

CORS pertenece a HTTP API, sin wildcard en handlers. Logs JSON incluyen requestId, versión, fase, estado/error, duración y conteos cuando están disponibles; no contienen cuerpos, grafos, semillas ni secretos. Para verificar localmente:

```powershell
.\.tools\bin\uv.exe run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests/test_api.py -q
```

Las pruebas recorren preview→compare→descompresión→schema→reproducción real. [Evidencia T-11](../docs/evidencia/backend-api.md). El ZIP Linux, CORS real, roles y latencia en API Gateway/Lambda se verificarán con infraestructura; el test local no cierra CA-13 público ni CA-15 desplegado.

## Exportación y reproducción T-10

Desde la raíz, con el entorno instalado, se pueden exportar los defaults versionados (N=1000, T=90, R=30). Para un smoke pequeño usar un archivo de configuración con N=50, days=3, repetitions=2 y vaccines=10, como hacen las pruebas CLI.

```powershell
New-Item -ItemType Directory -Force build
.\backend\.venv\Scripts\python.exe scripts/export_experiment.py schemas/examples/configuration-default.json build/experiment.json --no-frames --build-commit (git rev-parse HEAD)
.\backend\.venv\Scripts\python.exe scripts/reproduce.py build/experiment.json
```

La primera orden produce JSON completo más experiment.zip con CSV; requiere rutas nuevas y no sobrescribe archivos existentes. La configuración es un objeto configuration directo, sin envolver en request. Se registra el commit proporcionado o BUILD_COMMIT; sin ambos se declara unknown. Ambos CLI funcionan desde otro directorio con rutas absolutas. La salida exitosa incluye experimentHash; un error devuelve código no cero sin traza interna. build/ está excluido de Git.

`simulation.exports.export_experiment(result, build_commit=...)` agrega manifiesto y metadatos reales, valida CompareResponse y aplica 32 MiB al JSON. `load_export(bytes)` exige JSON estricto, sin claves duplicadas/no finitos, hashes coherentes y tamaño permitido. `reproduce(document)` exige las mismas versiones de Python/dependencias/motor y vuelve a ejecutar; compara hash y derivados/eventos/frames presentes. Frames omitidos no impiden reproducción.

experimentHash cubre configuration, graph, versiones semánticas/entorno y resultados por réplica; excluye fechas, requestId, buildCommit, frames, eventos opcionales y hashes derivados. Los resultados estadísticos fuera de la proyección también se verifican al reproducir.

`export_zip(document)` es la referencia local de archivos/columnas para el futuro cliente T-15, sin endpoint nuevo. Incluye configuration.json, manifest.json, comparison-summary.json y ocho CSV (nodes, edges, daily, metrics, selections, events, summary, comparisons). Null es celda vacía; arrays son JSON; eventos solo de representativa y su alcance se declara en exportMetadata dentro del manifest del ZIP. Timestamps ZIP fijos hacen la salida estable para el mismo documento/entorno. [Evidencia T-10](../docs/evidencia/backend-exportacion.md).

## Experimentos y agregación T-09

`simulation.experiments.run_experiment(configuration, include_representative_frames=True)` genera una red fija y ejecuta todas las réplicas. Devuelve datos de dominio: configuración, grafo/hash, resultados por réplica, métricas, resúmenes, curvas agregadas, diferencias pareadas, representativa y recomendación. T-10 completa estos datos con manifiesto y envoltorio de exportación; T-11 integra el adapter HTTP.

`statistics` usa percentiles linear, omite duraciones null y devuelve n efectivo. `metrics` toma el primer pico, exige E+I=0 para extinción y conserva inventario. `aggregate` calcula diferencias que pueden ser negativas y utiliza una matriz bootstrap (2000,R) compartida cuando R≥30; para R<30 devuelve bootstrap=null. Las tasas de victoria solo cuentan diferencias positivas.

La recomendación usa menor media con empate absoluto 1e-9 y confidence supported solo si los dos intervalos frente a competidores tienen límite inferior positivo. Esto no garantiza superioridad en otras semillas. La representativa es la más cercana a la mediana targeted con desempate por índice, no el promedio. Solo esa réplica transporta eventos/frames; puede omitirse frames sin alterar resultHash. Se procesa una réplica a la vez y se regenera la representativa para evitar conservar todos los frames. Un fallo aborta con SIMULATION_FAILED, sin resultado parcial.

`replicate_order` y `policy_order` permiten verificar invariancia del orden; los resultados siempre se ordenan canónicamente. [Evidencia T-09](../docs/evidencia/backend-experimentos.md): 252 pruebas aprobadas, incluidos contratos con 2/30 réplicas y tres procesos.

## Vacunación y ejecución pareada T-08

`simulation.engine.simulate_paired(configuration, graph, replicate_index=0)` devuelve las tres trazas con condiciones y potenciales compartidos. `simulate_policy(..., policy="targeted")` ejecuta una política individual; `simulate_none` conserva su interfaz previa. `policy_order` en simulate_paired permite invertir ejecución y debe incluir las tres políticas exactamente una vez. El resultado siempre se ordena none/random/targeted.

Cada SimulationTrace agrega selections, vaccines_assigned, vaccines_effective y vaccines_unused. La intervención se aplica una sola vez en interventionDay, después de transiciones y antes del registro del día. Solo S es elegible; una dosis fallida queda consumida. efficacy=0 conserva las curvas none y K=0 conserva trazas idénticas. No se añaden vacunados al acumulado de infectados.

`strategies.vaccination.select_candidates` decide sin ver el futuro. targeted calcula scores desde un único snapshot; random conserva el rank del muestreo, aunque las filas se serializan por ID. `vaccinate` aplica el sorteo por nodo y genera únicamente eventos de éxitos. contexts identifica capas activas hacia vecinos S. [Evidencia T-08](../docs/evidencia/backend-vacunacion.md). Los resúmenes, métricas y recomendación están implementados en T-09.

## Motor SEIR T-07

`simulation.engine.simulate_none(configuration, graph, replicate_index=0)` ejecuta la referencia sin intervención. Devuelve SimulationTrace con daily, events, frames, entry_days y randomness_hash; registra T+1 estados. No aplica las vacunas de configuration: esta función representa exclusivamente none. La ejecución pareada está implementada en T-08; el resumen estadístico está implementado en T-09.

`generate_potentials(configuration, edge_count, replicate_index=0)` crea matrices de transmisión, progresión y eficacia por dominio con acceso de solo lectura. Pueden compartirse entre ejecuciones mediante potentials=; no se consumen ni modifican. `step_day` permite probar la transición desde un snapshot, sin mutarlo. Los eventos iniciales son I→I; contactos y progresiones se etiquetan con d+1 y la menor arista exitosa explica cada contacto.

randomnessHash incluye nombres, dimensiones y bytes float64 little-endian según agreements.md §3. Entrada de uniformes incompatible se rechaza. La traza conserva tiempos individuales sin incluirlos en el contrato HTTP todavía. [Evidencia T-07](../docs/evidencia/backend-motor.md): 210 pruebas aprobadas y smoke N=1000/T=90. Esto no verifica rendimiento AWS ni impacto de estrategias.

## Red y origen T-06

`simulation.network.generate_graph(configuration)` devuelve grupos y contactos hasta T inclusive. `select_initial(configuration, graph, replicate_index=0)` selecciona infectados sin reemplazo. `build_preview(configuration)` devuelve payload de dominio con configuración, grafo, posiciones y hashes reales; T-11 integra este payload con HTTP API v2.

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
