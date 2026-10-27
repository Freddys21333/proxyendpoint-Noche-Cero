# Experimentos y agregación — T-09

Fecha: 26 de octubre de 2026. Rama feat/backend-contratos.
Windows x86_64, Python 3.12.14, NumPy 2.5.4, NetworkX 3.7.
Ref.: REQ-05/06/07/08; CA-09/10; D-05/06.

## Implementación

`simulation.experiments.metrics` calcula acumulados, pico y primer día del pico, infecciosos finales, duración hasta E+I=0 e inventario desde la traza del motor. Los vacunados no se suman a infectados. `statistics` calcula media, mediana y P05/P95 linear; omite null censurados y conserva n efectivo, con todos los estadísticos null cuando n=0.

`aggregate` ordena réplicas y calcula resúmenes por política, curvas por día y diferencias pareadas none−random, none−targeted y random−targeted. Conserva diferencias negativas y tasas de victoria estricta. Para R≥30 genera una matriz bootstrap (2000,R) con dominio bootstrap y comparte índices en todas las comparaciones; percentiles 2.5/97.5 linear sobre medias. Para R<30 el bootstrap es null.

Recomendación: menor media de acumulados, empate absoluto 1e-9. Para ganador único, supported requiere R≥30 y lower>0 frente a ambos competidores; de lo contrario descriptive con R<30 o inconclusive con R≥30. Empates no se declaran supported. Se incluyen razones y limitaciones sin prometer victoria universal.

`run_experiment` genera red fija una sola vez, procesa una réplica a la vez y retiene resultados compactos con resultHash de metrics/daily/selections. Elige representativa por distancia a mediana targeted y menor índice; la regenera y verifica sus resultHash para conservar solo sus eventos/frames. Frames puede ser null sin alterar resultados. Un fallo, incluso en regeneración, aborta con SIMULATION_FAILED 500 saneado; no devuelve resumen parcial ni éxito ficticio.

El resultado es de dominio. No contiene aún manifiesto/exportación completa ni envoltorio HTTP. Estos pertenecen a T-10/11.

## TDD y verificación observada

Rojo: `pytest backend/tests/test_experiments.py -x -q` devolvió código 1 por NotImplementedError en statistics antes de implementar. Verde/refactor: estadísticas, agregación, ejecución e incorporación de casos de aceptación adicionales.

Desde raíz con prefijo `.\.tools\bin\uv.exe`:

| Argumentos | Resultado |
|---|---|
| `run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | **252 passed in 48.43s**, código 0; 22 pruebas nuevas |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests` | Sin errores tras ordenar imports y retirar imports sin uso |
| `run --locked --offline --project backend --cache-dir .uv-cache ruff format --check backend/src backend/tests` | 20 archivos formateados |
| `run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src` | 12 fuentes sin errores |
| `run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | OK |
| `lock --check --offline --project backend --cache-dir .uv-cache` | Lock coherente |

Casos: vector [0,10] con P05=0.5/mediana=5/P95=9.5; duraciones null; extinción E+I; primer pico; ganancia/empate/pérdida y los tres ganadores; R=29/30; bootstrap contrastado con matriz independiente; confianza supported/inconclusive; tasas y diferencias negativas; representativa y desempate; resultHash real; vacunados fuera de acumulados mediante recuento de eventos; error de réplica inyectado sin información privada; órdenes de políticas/réplicas invertidos; todas las propiedades de dominio contrastadas con CompareResponse del schema usando 2/30 réplicas reales; tres procesos con PYTHONHASHSEED diferente. Se conservaron las 230 pruebas anteriores. pytest necesitó temporales y subprocesos fuera del sandbox.

Smoke local N=1000/T=90/R=2: progress total=2/succeeded=2/failed=0, red de 59.373 aristas, 91 días en cada curva agregada, medias S+E+I+R=1000 por día. Representativa índice 0, frames omitidos. Se ejecutó `run_experiment(replace(normalize_configuration(), repetitions=2), include_representative_frames=False)` con PYTHONPATH=backend/src. No se presenta este smoke de dos réplicas como evidencia del gate científico ni del rendimiento base de 30 réplicas.

## Pendientes y límites

T-10: manifiesto versionado, experimentHash/exportación y reproducción CLI; T-11: endpoints, límites de respuesta y errores HTTP. T-19: medir memoria y p95 en AWS. T-22: fijar matriz científica antes de resultados finales y evaluar superioridad promedio; no se declara logrado ese gate. La regeneración de la representativa agrega una ejecución determinista para evitar retener frames/eventos de todas las réplicas. Sin despliegue ni nuevas dependencias en este incremento.
