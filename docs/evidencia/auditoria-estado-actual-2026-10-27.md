# Auditoría del estado actual — 27 de octubre de 2026

Rama: `feat/backend-contratos`. Commit auditado: `ca21076` (P-06). Árbol limpio al comenzar. Esta revisión reemplaza el contexto antiguo de T-05: se evaluó lo que existe actualmente, sin implementar nuevas capacidades PRO ni ejecutar despliegues AWS.

## Resultado

El flujo local probado funciona: configuración → preview → comparación → curvas/tabla → descarga JSON/ZIP → reproducción; también funcionan los flujos HTTP de inventario, intervenciones combinadas, política adaptativa y trabajos locales. Esto no acredita todas las condiciones de aceptación de UI, el gate científico completo ni rendimiento AWS.

| Verificación ejecutada | Resultado observado |
|---|---|
| `uv run --locked --offline --project backend --cache-dir .uv-cache pytest backend/tests -q` | 391 pruebas aprobadas, 68,14 s. |
| `uv run --locked --offline --project backend --cache-dir .uv-cache ruff check backend/src backend/tests` | Correcto. |
| `uv run --locked --offline --project backend --cache-dir .uv-cache mypy --config-file backend/pyproject.toml backend/src` | Correcto, 24 archivos fuente. |
| `uv run --locked --offline --project backend --cache-dir .uv-cache openapi-spec-validator schemas/openapi.yaml` | OpenAPI válido. |
| `npm.cmd test` desde frontend | 135 pruebas aprobadas. |
| `npm.cmd run build` desde frontend | TypeScript y build Vite correctos. |
| `node prototype/simulation.test.mjs` | 5 pruebas del prototipo aprobadas. |
| `backend/.venv/Scripts/python.exe scripts/check_validation_protocol.py` | Protocolo intacto, SHA-256 `cb6b3e62795de8a6ec87f1a7e4c972c692ebbcb5144d3546ec6f622a92ffbb8b`; no ejecuta la matriz. |
| `backend/.venv/Scripts/python.exe scripts/p05_import_dengue.py verify` | Datos/procedencia verificados: 94 semanas, total 18.259 casos, sin descargas nuevas. |
| `backend/.venv/Scripts/python.exe scripts/p06_calibrate.py verify` | Preset y resultados reproducidos/verificados; no significa validación epidemiológica favorable. |

Los comandos `uv` se ejecutaron con `.tools/bin/uv.exe` local y Python 3.12.14; Node 24.21.0 y npm 11.19.0 para frontend. No se actualizaron dependencias.

## Integración HTTP real

API temporal en `127.0.0.1:18009`, con `scripts/serve_api.py --port 18009`. Vite en `127.0.0.1:5174` con API en `:8000` para comprobar además el proxy real.

- `node --experimental-strip-types scripts/verify_local_integration.mjs http://127.0.0.1:18009/v1`: tres casos manual/sin vacunas/sin transmisión aprobados. Reporte crudo en `.tools/validation-2026-10-27T20-28-16.761Z/report.json`.
- `API_BASE=http://127.0.0.1:18009/v1` con `verify_adaptive_integration.mjs`: correcto, 24 filas adaptativas y anillo de vacunación.
- Con el mismo API_BASE, `verify_adaptive_triggers.mjs`: seis escenarios aprobados, 11 motivos distintos, incluidos presupuesto/capacidad/inventario agotados y cierre/reapertura.
- `verify_jobs_flow.mjs`: correcto; resultado secuencial con el mismo hash, cancelación, idempotencia/rechazo de conflicto, token ajeno 404 y resultado parcial bloqueado con 409.
- `verify_jobs_integration.mjs`: trabajos de 2 y 31 réplicas completos; reporte en `.tools/jobs-validation-2026-10-27T20-29-40.248Z/`.
- `verify_combined_integration.mjs` mediante Vite: presupuestos 0, 2.500 y 100.000 centavos educativos correctos.
- `verify_resource_schedule_integration.mjs` mediante Vite: dos escenarios de presupuesto, recibos, inventario y exportación correctos.
- `scripts/reproduce.py` sobre `manual.json` exportado: hash reproducido `sha256:c860fa7271bfce0378b575f18d2f5bc02e5300654141c9c3f5b437b7835baf39`.

## Navegador real

Skill utilizada: [playwright-cli](../../.agents/skills/playwright-cli/SKILL.md). Sesión temporal Edge `audit-current`, acceso solo a localhost.

1. Carga inicial: servidor disponible; formulario con defaults reales.
2. Configuración de smoke: N=50, T=4, K=5; resto de defaults del servidor. Consultar red devolvió una vista previa real y habilitó comparar.
3. Comparación completada con métricas, curvas, tabla, diferencias pareadas y límites visibles. El resultado observado señaló dirigida como menor media en este escenario pequeño; no constituye el gate T-22.
4. Descargas JSON y ZIP completadas desde los botones reales de UI. El JSON descargado se reprodujo con hash `sha256:964bc26904ce880d155e645a3ee098f201bb55d3b922aa9902d7cc855f5279c1`; el ZIP pasó `ZipFile.testzip()` y contiene 11 archivos.
5. Pantalla PRO cargada; trabajo de 2 réplicas creado desde la UI y completado, progreso 100 %, dos completadas y botón para leer resultado disponible.

Snapshots, consola y descargas quedan en `.playwright-cli/` (ignorado). La consola no mostró errores de aplicación: registró un **404 de `/favicon.ico`**, incidencia cosmética pendiente, sin impedir el flujo. No se ejecutó revisión visual exhaustiva de mapa/móvil ni certificación de accesibilidad.

## Correcciones pequeñas derivadas de la auditoría

- `scripts/frontend.ps1` no transmitió correctamente `test` al invocarse en esta sesión. Se añadió un parámetro explícito de argumentos restantes y se usa `npm.cmd` en Windows. Tras corregirlo, el wrapper pasó `run typecheck`, `test` (135 pruebas) y `run build`.
- `scripts/p05_import_dengue.py`: reemplazo equivalente de timezone.utc por UTC, sin cambiar cálculos ni datos.
- `scripts/run_t22.py`: se documentaron los imports intencionales tras ampliar sys.path; no se modificaron protocolo, escenarios ni ejecución científica.

El lint inicial de scripts desde raíz tomó opciones globales y reportó 11 incidencias. Para una comprobación explícita y reproducible del proyecto se usó:

```powershell
.tools\bin\uv.exe run --locked --offline --project backend --cache-dir .uv-cache ruff check --config backend/pyproject.toml --config "src = ['backend/src']" backend/src backend/tests scripts
```

Resultado final correcto. Se especifica src porque las rutas de configuración explícita se resuelven desde la raíz de ejecución. Después de los ajustes se repitieron las 13 pruebas P-05, verificación de datos, protocolo congelado y checks del wrapper; todas correctas. No se alteraron fórmulas, fixtures científicas ni hashes del motor.

## Pendientes que esta auditoría no elimina

- Rendimiento: la última medición documentada de defaults es 44,3 s sin frames; objetivo backend ≤25 s aún no cumplido. No se repitió un benchmark grande en esta auditoría.
- T-22: falta matriz primaria/contrastes y aprobación del gate; comprobar la integridad del protocolo no equivale a ejecutarlo.
- P-06 continúa `fitted-not-validated`: el preset pierde frente a persistencia fuera de muestra. Verificar sus archivos no convierte el resultado en favorable.
- T-13..T-16: aceptación humana completa, accesibilidad, móvil, rendimiento visual y escenarios de error integrales siguen abiertos.
- P-03 es local y en memoria; no se probó persistencia AWS ni miles de réplicas. Infraestructura, URL pública, costos/alertas y despliegue siguen pendientes.
- El 404 del favicon sigue como detalle cosmético. No se añadió funcionalidad nueva para esta revisión.
