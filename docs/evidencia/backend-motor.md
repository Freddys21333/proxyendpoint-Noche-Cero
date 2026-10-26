# Motor SEIR y eventos diarios — T-07

Fecha: 26 de octubre de 2026. Rama feat/backend-contratos.
Windows x86_64, Python 3.12.14, NumPy 2.5.4, NetworkX 3.7.
Referencias: RF-04, CA-01/04, REQ-03, D-02/05.

## Comportamiento implementado

`step_day` calcula S→E, E→I e I→R desde el mismo snapshot. Un nuevo E/I no progresa dos veces y un nuevo I no contagia en ese intervalo. R permanece R. Cada arista activa tiene su propio umbral U<clamp(beta*weight,0,1); no hay sorteo agregado adicional. Ante varias aristas exitosas se conserva como causal la menor edgeId, independiente del orden de entrada de las aristas. Un infeccioso que se recupera en d+1 todavía puede contagiar durante [d,d+1).

`simulate_none` usa la selección inicial de T-06 y registra día 0..T, incluyendo exactamente T intervalos. Devuelve frames, daily S/E/I/R/acumulados, eventos y tiempos individuales de entrada. Los casos iniciales se registran una sola vez mediante eventos I→I iniciales. Acumulados cuentan iniciales y nuevas exposiciones. No aplica vacunas: su nombre representa explícitamente la referencia none; T-08 incorporará la intervención.

`generate_potentials` crea matrices (T,edgeCount), (T,N,2), (T+1,N), orden C, mediante dominios transmission/progression/vaccine. Son de solo lectura y se reutilizan sin consumo. Incluye potenciales de aristas inactivas. La simulación verifica dimensiones, valores finitos y uniformes en [0,1). randomnessHash usa nombres, shapes y bytes float64 little-endian con encuadre descrito en agreements.md §3. Solo se genera una réplica por llamada.

## TDD y verificaciones observadas

Rojo: `pytest backend/tests/test_engine.py -x -q` devolvió código 1 con NotImplementedError en step_day. Luego se implementó el mínimo motor, se formateó y se ampliaron pruebas.

Desde raíz con prefijo `.\.tools\bin\uv.exe`:

| Argumentos | Resultado |
|---|---|
| `run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | **210 passed in 29.60s**, código 0; 25 pruebas nuevas |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests` | Sin errores tras ordenar imports |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff format --check backend/src backend/tests` | 16 archivos formateados |
| `run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src` | 10 fuentes sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | OK |
| `lock --check --offline --project backend --cache-dir .uv-cache` | Lock coherente |

Pruebas: conservación, no mutación de grafo/snapshot, R absorbente, beta/peso cero, sin aristas/contactos inactivos, tasas 0/1, canales de progresión, umbral estricto, transmisión en ambos sentidos, causal mínimo, nuevos E/I, eventos iniciales, frontera T, schemas Daily/Event, dimensiones y RNG por dominio, hash little-endian equivalente, potenciales inválidos y tres procesos con PYTHONHASHSEED diferente.

El fixture exhaustivo de dos aristas con p=0.2 y p=0.5 evalúa 100 pares de uniformes equiprobables y obtiene 60 exposiciones: p=0.6. La frontera T=1 con red completa produce 49 E y un I en B[1], sin progresión extra ni día T+1.

Smoke local con configuración base N=1000/T=90: `simulate_none(c, generate_graph(c))` produjo 91 frames y conservó población 1000 en todos los días. Se verificó con asserts en proceso Python y PYTHONPATH=backend/src. No se midió p95 ni se ejecutó AWS. pytest usó permisos para temporales y subprocesos.

## Pendientes

Vacunas/estrategias T-08, métricas/resúmenes T-09, exportación/reproducción T-10 y API T-11. La traza interna no es todavía PolicyResult completo. No hay afirmación de superioridad targeted ni comparación pareada ejecutable. El rendimiento final y memoria en Lambda deben medirse en T-19; este smoke no los certifica.
