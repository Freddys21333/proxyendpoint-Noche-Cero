# Vacunación y políticas pareadas — T-08

Fecha: 26 de octubre de 2026. Rama feat/backend-contratos.
Windows x86_64, Python 3.12.14, NumPy 2.5.4 y NetworkX 3.7.
Ref.: RF-05/06/12; CA-02/03/05/07; REQ-04/08.

## Implementación

`strategies.vaccination` separa selección y eficacia. none no selecciona. random realiza choice uniforme sin reemplazo desde elegibles ordenados, conserva rank original y serializa por nodeId. targeted suma pesos de aristas activas hacia S desde un único snapshot, usa math.fsum y orden (-score,id), sin recalcular tras cada dosis. contexts registra capas activas hacia S. No se reciben sorteos futuros al seleccionar.

`vaccinate` aplica eficacia mediante U[d,nodeId]<efficacy; cada fila consume dosis, falle o tenga éxito. Solo éxito genera evento S→R y fallo conserva S. Nunca se seleccionan E/I/R. No hay reintento posterior ni dosis repetidas. Se usa min(K,elegibles), sin rellenar con estados no elegibles. Ambos métodos trabajan sin modificar la entrada.

`simulate_policy` integra la intervención después de transiciones y antes del registro de su día, incluyendo 0 y T. Comparte el mismo motor con simulate_none. La traza incorpora selections e inventario assigned/effective/unused. Vacunados no cuentan como nuevas infecciones. none conserva K dosis sin usar.

`simulate_paired` crea potenciales una vez por réplica y ejecuta las tres políticas sobre la misma red e inicialización. Puede invertir ejecución y retorna orden none/random/targeted; rechaza políticas faltantes, duplicadas o desconocidas. No implementa aún resumen Monte Carlo, métricas derivadas ni recomendación.

## TDD y verificaciones

Rojo observado: `pytest backend/tests/test_vaccination.py -x -q` devolvió código 1 con NotImplementedError en select_candidates. Verde/refactor: selección, eficacia, integración y pruebas adicionales.

Desde raíz con prefijo `.\.tools\bin\uv.exe`:

| Argumentos | Resultado |
|---|---|
| `run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | **230 passed in 38.33s**, código 0; 20 pruebas nuevas |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests` | Sin errores tras ordenar imports |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff format --check backend/src backend/tests` | 18 archivos formateados |
| `run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src` | 11 fuentes sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | OK |
| `lock --check --offline --project backend --cache-dir .uv-cache` | Lock coherente |

Cobertura observada: E/I/R no elegibles, score/desempate, snapshot único, capas inactivas y vecinos no S, rank random, K=0 con trazas idénticas, K>elegibles, eficacia 0/1/parcial y umbral estricto, dosis fallida consumida una sola vez, origen común y potenciales iguales por nodo, intervención 0/T, decisiones retrasadas desde mismo snapshot, inventario y conservación, schemas Selection/Event, orden invertido de políticas/réplicas y tres procesos nuevos con PYTHONHASHSEED distinto. Se conservaron las 210 pruebas previas. pytest requirió acceso a temporales/subprocesos fuera del sandbox.

Smoke local default N=1000/T=90: las tres políticas generaron 91 estados, conservaron N cada día y tuvieron randomnessHash idéntico. Inventario observado: none assigned=0/effective=0/unused=100; random y targeted assigned=100/effective=100/unused=0, coherente con eficacia base 1. El smoke verifica integración e inventario, no superioridad de la estrategia ni p95 AWS.

## Pendientes

T-09 implementará experimentos, métricas/estadísticas/bootstrap y recomendación; T-10 exportación y T-11 API. No se afirma que targeted gane ni que la aceptación científica final esté cerrada. No hay endpoints, despliegue ni auditoría AWS. Checkov permanece instalado en su entorno aislado; este incremento no añade IaC.
