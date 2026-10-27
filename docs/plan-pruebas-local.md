# Plan de pruebas local (acumulativo)

Este documento reúne las pruebas que **ya existen y se pueden ejecutar** sobre las funcionalidades PRO implementadas en local. Crece junto con el código: una funcionalidad sin implementación no aparece aquí. No sustituye a la aceptación humana de T-13..T-16 ni autoriza AWS/P-04.

- Última actualización: 2026-10-27.
- Rama de referencia: `feat/backend-contratos`.
- Tipos: **A** = prueba unitaria automatizada; **I** = integración HTTP real; **B** = verificación en navegador real.
- Evidencia cruda: `.tools/` (no versionado). Informes y figuras: `docs/evidencia/`.
- Sin secretos: los tokens de trabajo viven en `sessionStorage` y nunca se pegan en documentos ni capturas.

## 1. Entorno y precondiciones

Herramientas: Node ≥24 (probado con 24.21), npm ≥11, Python del venv del backend.

```powershell
# Desde la raíz del repositorio
backend\.venv\Scripts\python.exe scripts\serve_api.py        # API en http://127.0.0.1:8000/v1
# En Linux/macOS: backend/.venv/bin/python scripts/serve_api.py
```

`scripts/serve_api.py` habilita `LOCAL_JOBS_ENABLED=1`, requisito de `/v1/jobs`. Los límites publicados son 2..100 réplicas por trabajo, 2 trabajos concurrentes, 8 retenidos y 3600 s de retención; al llenarse la cola la API responde `503 COMPUTE_UNAVAILABLE` y hay que reiniciarla para limpiar la memoria.

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5174                    # UI en http://127.0.0.1:5174
```

La UI usa el proxy de Vite `/v1` → `127.0.0.1:8000`. No se consulta AWS ni se requieren credenciales externas.

Comprobación de contrato y límites:

```powershell
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/v1/config).Content |
  ConvertFrom-Json | Select-Object -ExpandProperty jobLimits
```

Resultado esperado: `asyncJobs: true` en `features` y `maxRepetitions: 100`, `maxConcurrent: 2`, `maxRetained: 8`, `retentionSeconds: 3600`, `maxEdgeDayReplicates: 50000000`.

## 2. P-02 — Política adaptativa (`adaptive-v1`)

Funcionalidad implementada: editor de umbrales, etiqueta de variante, decisiones con motivo y historial diario, reglas activables/desactivables, exportación y reproducción.

### 2.1 Pruebas automatizadas (A)

| ID | Qué comprueba | Comando | Resultado esperado |
|---|---|---|---|
| P02-A1 | El vocabulario de disparadores cubre las etiquetas documentadas | `npm test -- --run` | 5 pruebas de `src/lib/adaptive.test.ts` en verde |
| P02-A2 | La etiqueta distingue dirigida fija de adaptativa solo si está activa | idem | verde |
| P02-A3 | El historial conserva solo días con decisiones registradas | idem | verde |
| P02-A4 | El resumen separa cierres pagados, solicitudes y acciones omitidas | idem | verde |
| P02-A5 | Una variante inactiva no cuenta decisiones | idem | verde |

Suite completa de referencia en la iteración: **123 pruebas frontend**, `npm run typecheck` y `npm run build` correctos; backend **356 pruebas**, Ruff y mypy correctos.

### 2.2 Integración HTTP (I)

| ID | Qué comprueba | Comando | Resultado esperado |
|---|---|---|---|
| P02-I1 | Respuesta HTTP real → validador del cliente → CSV; rechaza decisiones falsificadas | `node --experimental-strip-types scripts/verify_adaptive_integration.mjs` | `{"status":"passed","experimentHash":"sha256:5982f9b4…","adaptiveRows":24,"ringNode":2}` |
| P02-I2 | Los 11 disparadores distintos se etiquetan y cada caso conserva su hash | `node --experimental-strip-types scripts/verify_adaptive_triggers.mjs` | 11 disparadores rotulados; hashes por caso en `.tools/p02-triggers.json` |

El script P02-I1 requiere la API de `scripts/serve_api.py` (por defecto `API_BASE=http://127.0.0.1:18002/v1`; exportar `API_BASE=http://127.0.0.1:8000/v1` si se usa el puerto estándar).

### 2.3 Navegador real (B)

Precondición: API y UI levantadas; pestaña en `http://127.0.0.1:5174`, vista **Comparación**.

| ID | Pasos | Resultado esperado |
|---|---|---|
| P02-B1 | Abrir avanzados y el editor adaptativo con umbrales por defecto | Anillo de 4 días y retención de 7 días; etiqueta `Dirigida · adaptativa v1` |
| P02-B2 | Fijar cierre 0,2 % y reapertura 0,1 % y ejecutar | 4 días de cierre pagados en «Colegio»; reapertura el día 4 |
| P02-B3 | Desactivar reglas | Insignia «(inactiva)», nota explicativa y 0 filas de decisiones |
| P02-B4 | Invertir umbrales (reapertura ≥ cierre) | Bloqueo con mensaje en español; no se envía la comparación |
| P02-B5 | Revisar el encabezado de vacunación | `Vacunación · Dirigida · adaptativa v1` |
| P02-B6 | Revisar el historial diario y su exportación | Filas por día con motivo; CSV `adaptive-decisions.csv` presente |

Evidencia: [p02-ui-2026-10-27.md](evidencia/p02-ui-2026-10-27.md), figuras `docs/evidencia/figuras/p02-historico-adaptativo.jpeg` y `p02-editor-adaptativo.jpeg`.

## 3. P-03 — Trabajos Monte Carlo locales (`/v1/jobs`)

Funcionalidad implementada: pantalla PRO conectada a la API real (sin fixtures), credenciales en `sessionStorage`, creación con el escenario previsualizado, sondeo de estado, progreso real, cancelación, reintento, lectura del resultado solo con agregado completo, historial de la sesión y aviso cuando el servidor perdió los trabajos.

### 3.1 Pruebas automatizadas (A)

Ejecutar desde `frontend/`:

```powershell
node --experimental-strip-types --test src/pro/jobs-model.test.ts src/pro/job-session.test.ts
```

| ID | Qué comprueba | Resultado esperado |
|---|---|---|
| P03-A1 | La validación de réplicas usa el máximo del servidor y no recorta valores | error entre 2 y 100 (o el máximo recibido) |
| P03-A2 | Los límites caen al valor local documentado si el servidor no los publica | 100 |
| P03-A3 | Cada estado de la API se mapea a una etiqueta y al conjunto terminal | 6 pares correctos |
| P03-A4 | El progreso suma completadas y fallidas y se acota a 0..100 | 12+3 de 30 → 50 %; exceso → 100 % |
| P03-A5 | Un agregado completado con réplicas fallidas se rotula parcial | «Resultado incompleto», `partial: true` |
| P03-A6 | El error del servidor conserva código y mensaje legible | `SIMULATION_FAILED` traducido |
| P03-A7 | El trabajo reutiliza el escenario previsualizado y solo cambia réplicas y semilla | escenario intacto; base sin mutar |
| P03-A8 | Los códigos de error de la API se traducen; los desconocidos usan mensaje genérico | `JOB_NOT_FOUND`, `JOB_NOT_READY`, `IDEMPOTENCY_CONFLICT` |
| P03-A9 | Las credenciales sobreviven el viaje a `sessionStorage` | token, hash y configuración intactos |
| P03-A10 | `upsert` deja el trabajo más reciente primero y no duplica por id | 2 entradas, orden correcto |
| P03-A11 | Entradas corruptas, de otro formato o ajenas se descartan sin romper la pantalla | solo la válida |
| P03-A12 | Quitar un trabajo solo borra esa entrada y un almacenamiento ausente no falla | sin excepciones |

Referencia de la iteración: **12/12** pruebas nuevas; suite completa **130 pruebas** en verde; `npm run typecheck` y `npm run build` correctos.

### 3.2 Integración HTTP (I)

Precondición: API recién iniciada con `scripts/serve_api.py`. El script crea 2 trabajos (uno completado y uno cancelado); con 8 retenidos, reiniciar la API si aparece `503 COMPUTE_UNAVAILABLE`.

```powershell
node --experimental-strip-types scripts/verify_jobs_flow.mjs
```

| ID | Qué comprueba | Resultado esperado |
|---|---|---|
| P03-I1 | `features.asyncJobs` y `jobLimits` se publican | `true` y límites 2..100 / 2 / 8 / 3600 |
| P03-I2 | Crear un trabajo de 3 réplicas devuelve `jobId`, total 3 y estado no terminal | `pending` o `running` (el trabajador puede tomarlo antes de responder) |
| P03-I3 | Repetir la solicitud con la misma capacidad y `Idempotency-Key` devuelve el mismo `jobId` | mismo id, total 3 |
| P03-I4 | Reutilizar la clave con otra configuración se rechaza | `409 IDEMPOTENCY_CONFLICT` |
| P03-I5 | El sondeo llega a terminal con todas las réplicas completadas | `completed`, 3/3, 0 fallidas, hash de red y semilla del manifiesto |
| P03-I6 | El resultado tiene 3 réplicas y sus índices 0,1,2 | estructura completa del contrato |
| P03-I7 | El hash del trabajo coincide con la ejecución secuencial equivalente | `experimentHash` idéntico (`sha256:d3a86e4d…` en la última ejecución) |
| P03-I8 | Un token desconocido no revela el trabajo | `404 JOB_NOT_FOUND` |
| P03-I9 | Un trabajo en curso no entrega resultado parcial | `409 JOB_NOT_READY` |
| P03-I10 | Cancelar devuelve estado terminal y el resultado sigue bloqueado | `cancelled`, después `409 JOB_NOT_READY` |

Salida real de la última ejecución (2026-10-27):

```json
{"status":"passed","jobId":"44dc297a-1029-43fe-8fed-214e580120ff","states":["running","completed"],"replicates":3,"experimentHash":"sha256:d3a86e4d00a9a0a6e86f838e16f6d45ae3fb839163353a77b921cda8fe0e9891","sequentialHashMatches":true,"cancelledJobId":"449a0d95-7cd3-4eb2-8d86-99a8eec79e96","idempotency":"replayed-and-conflicted","token":"unknown-token-404","partialResult":"blocked-409"}
```

Salida cruda: `.tools/p03-verify-jobs.log` (no versionado).

### 3.3 Navegador real (B)

Precondición: API y UI levantadas; vista **Explorar red** con una vista previa vigente. En las pruebas se usó N=300, T=30, semilla 20261026 y 2 réplicas.

| ID | Pasos | Resultado esperado |
|---|---|---|
| P03-B1 | Abrir PRO sin vista previa | Insignia «Trabajos: servidor local»; aviso «Falta la vista previa de la red»; «Iniciar trabajo» deshabilitado |
| P03-B2 | Consultar la red y volver a PRO | El formulario muestra escenario, red y máximo de 100 réplicas; el botón se habilita |
| P03-B3 | Crear un trabajo de 2 réplicas | Aviso «Trabajo aceptado…»; estado En cola/Ejecutando; progreso real; historial con 1 trabajo |
| P03-B4 | Esperar a que termine y leer el resultado | «Completado», 2/2, 0 fallidas, 100 %; tabla real por política, empate honesto y hash del experimento |
| P03-B5 | Crear un trabajo de 100 réplicas y cancelarlo | «Cancelado», progreso hasta el momento, sin botón de resultado; botón «Reintentar con esta configuración» |
| P03-B6 | Reintentar y volver a cancelar | Nuevo `jobId` con la misma configuración; historial con 3 trabajos |
| P03-B7 | Recargar la pestaña y abrir PRO | Los trabajos de la sesión se recuperan del servidor; el completado vuelve a entregar su resultado |
| P03-B8 | Reiniciar la API y recargar PRO | Aviso «N trabajos de esta sesión ya no existen en el servidor (expiraron o se reinició)»; sin resultados falsos |

Figuras: `docs/evidencia/figuras/p03-formulario-preview.jpeg`, `p03-trabajo-completado.jpeg`, `p03-trabajo-cancelado.jpeg`. Informe: [p03-ui-2026-10-27.md](evidencia/p03-ui-2026-10-27.md).

## 4. Regresión mínima antes de cerrar una iteración

Desde `backend/`:

```powershell
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m ruff check src tests
.venv\Scripts\python.exe -m ruff format --check src tests
.venv\Scripts\python.exe -m mypy
```

Desde `frontend/`:

```powershell
npm test -- --run
npm run typecheck
npm run build
```

Resultado de referencia (2026-10-27, I-04): 356 pruebas backend; 130 pruebas frontend; Ruff, formato, mypy, typecheck y build correctos.

## 5. Límites de este documento

- P-04 (AWS, Distributed Map, miles de réplicas) no existe en local y por eso no tiene pruebas aquí.
- La aceptación humana T-13..T-16 (teclado, contraste con personas, tiempos de demo, guion sorpresa) requiere personas y acceso; no se simula con scripts.
- Las capturas prueban lo que muestran; no sustituyen los hashes ni la reproducibilidad que verifican los scripts.
- T-22 sigue incompleto: ninguna cifra de estas pruebas debe citarse como gate científico.
