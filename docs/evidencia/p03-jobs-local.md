# P-03: evidencia de trabajos Monte Carlo locales

Fecha: 2026-10-27. Rama `feat/backend-contratos`. Estado: **backend y contrato cliente verificados localmente**. [Contrato vigente](../../specs/p03-monte-carlo-jobs.md).

## Qué se cerró

Cuatro rutas HTTP reales para crear, consultar, cancelar y descargar; schemas compartidos y OpenAPI sin anchors duplicados ni referencias inexistentes. Solicitud local R=2..100 separada del máximo síncrono 30. Dos trabajadores, retención/cola acotada, límites publicados, manifiesto de índices/semillas/versiones fijado antes de ejecutar. Acceso con token cuyo hash se almacena, idempotencia por capacidad y clave, respuestas saneadas y sin resultados parciales.

El gestor reutiliza el ejecutor científico. Progreso por índices únicos, un reintento determinista por réplica, cancelación cooperativa y estados terminales estables incluso al terminar una exportación pendiente. Se verifica runtime contra manifiesto al iniciar. El cliente TypeScript valida snapshots y resultados; recibe credenciales por argumento y las envía solo en headers. No se añadieron pantallas de trabajos ni persistencia de sesión de la interfaz.

## Pruebas ejecutadas

- Suite completa backend final: **356 aprobadas**, incluidos procesos nuevos, API, contratos, trabajos HTTP, orden invertido y runtime fijado. Log local `.tools/p03-backend-tests-final.log`. La suite focalizada de gestor obtuvo **12 aprobadas**.
- Contratos/OpenAPI/ejemplos finales y HTTP local: **73 aprobadas** (`test_contracts.py` y `test_jobs_local.py`). Ejemplos de trabajos marcados como mocks, sin resultados científicos inventados.
- Frontend: **106 aprobadas**; compilación TypeScript/Vite aprobada. Nuevos casos comprueban credenciales aleatorias, headers sin token en cuerpo/URL, AbortSignal, progreso imposible, resultado incompleto y cancelación terminal.
- Ruff de `src` y `tests`, formato y mypy: aprobados, **21 archivos fuente**. Ejecutados desde `backend/` para resolver correctamente sus imports y configuración.

Las pruebas cubren 31 réplicas, igualdad con ejecución síncrona, reproducción, orden de índices, manifiesto, reintento sin doble progreso, cola limitada, cancelación antes de empezar y durante agregación/exportación, capacidad incorrecta, conflicto idempotente, expiración, ausencia de resultado parcial y sanitización de fallos.

## Integración con el cliente real

`scripts/verify_jobs_integration.mjs` contra `scripts/serve_api.py --port 18003`, loopback, sin AWS. N=50, T=2, raíz 314159265. El cliente TypeScript recorre config/preview, create duplicado, consulta de progreso, rechazo de token distinto, result, exportación CSV y cancelación de terminal sin cambiarlo.

| Réplicas | Resultado | Hash científico |
|---|---|---|
| 2 | completed; mismo hash que compare síncrono | `sha256:0a87c2d4a2923e6ef0fb186081be6243af2c297702eb9150fa1ed48c64ae4187` |
| 31 | completed; aceptado por contrato cliente y exportable | `sha256:08125143c7ef5937ae6c8df19155009499e4ebf57b8bbca586a00fe5d6a1641b` |

Salida local final: `.tools/jobs-validation-2026-10-27T15-04-33.221Z/`. Una ejecución inicial equivalente quedó en `.tools/jobs-validation-2026-10-27T14-55-08.772Z/`. `scripts/reproduce.py` reprodujo `result-31.json` en otro proceso y devolvió el mismo hash. El script final también pide frames en el caso de 2 réplicas; frames no alteran el hash científico.

Para repetir, iniciar el servidor en una terminal y el script en otra:

```powershell
.\backend\.venv\Scripts\python.exe scripts/serve_api.py --port 18003
.\.tools\node\node.exe --experimental-strip-types scripts/verify_jobs_integration.mjs
```

`API_BASE` permite otro servidor local. El script guarda JSON reales en una carpeta nueva ignorada de `.tools`; no guarda tokens. La prueba HTTP Python usa un puerto efímero y un gestor aislado. Sockets y temporales Windows requirieron ejecución con permisos locales suficientes; no se deshabilitaron validaciones para superar ese aislamiento.

## Pendiente posterior

Frontend: selector, polling visible, sesión de credenciales, cancelación y descarga. P-04: almacenamiento durable, orquestación AWS, cuotas/costos y evidencia real de miles de réplicas. Reinicio pierde el estado local y terminales expiran tras una hora; ese límite es explícito. No se desplegaron recursos AWS ni se retomó T-22. P-01/P-02 conservan sus pruebas dentro de la suite general.
