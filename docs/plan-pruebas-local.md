# Plan de pruebas local (acumulativo)

Este documento reúne las pruebas que **ya existen y se pueden ejecutar** sobre las funcionalidades PRO implementadas en local. Crece junto con el código: una funcionalidad sin implementación no aparece aquí. No sustituye a la aceptación humana de T-13..T-16 ni autoriza AWS/P-04.

- Última actualización: 2026-10-27.
- Rama de referencia: `feat/backend-contratos`.
- Tipos: **A** = prueba unitaria automatizada; **D** = pipeline de datos reproducible (sin red); **I** = integración HTTP real; **B** = verificación en navegador real.
- Evidencia cruda: `.tools/` (no versionado). Informes y figuras: `docs/evidencia/`.
- Sin secretos: los tokens de trabajo viven en `sessionStorage` y nunca se pegan en documentos ni capturas.

Revisión transversal ejecutada del frontend contra API real y proxy Vite: [integración revisada 2026-10-27](evidencia/integracion-revisada-2026-10-27.md). Incluye 391 pruebas backend, 135 frontend, scripts de integración, comparación desde navegador, exportación reproducida y jobs desde UI. No sustituye T-22 ni aceptación humana.

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

## 4. P-05 — Datos reales de dengue en Manabí

Funcionalidad implementada: importación verificable de la serie semanal de dengue de Manabí (2025 y 2026) desde las gacetas vectoriales del MSP. Incluye geometría versionada, selección de la polilínea por coincidencia con las etiquetas impresas, controles de totales, tabla normalizada y procedencia. **No** se conecta al motor SEIR y **no** se mezcla con posiciones OSM ni con casos sintéticos.

Fuente: gaceta ETV SE 53/2025 y SE 41/2026 del Ministerio de Salud Pública del Ecuador. Dataset: `manabi-dengue-weekly-v1`, 94 semanas, 18 259 casos.

### 4.1 Pruebas automatizadas (A)

Precondición: ninguna; no requiere red, PDF ni PyMuPDF. Desde `backend/`:

```powershell
.venv\Scripts\python.exe -m pytest tests/test_p05_dengue.py -q
```

| ID | Qué comprueba | Resultado esperado |
|---|---|---|
| P05-A1 | La selección exige exactamente una polilínea | 4 valores correctos; dos candidatas idénticas → error |
| P05-A2 | Una polilínea que no reproduce las etiquetas se descarta | error `no reproducidas` |
| P05-A3 | Un eje de semanas irregular se rechaza | error `irregular` |
| P05-A4 | 2026 reproduce sus 41 etiquetas y el total de la tabla | 41 valores; suma 11 946; 0 desajustes posicionales |
| P05-A5 | 2025 reproduce sus 53 etiquetas y la tasa publicada | 53 valores; suma 6 313; desajustes (26, 164, 113) y (27, 113, 164) |
| P05-A6 | Los controles del manifiesto pasan y el hash es válido | 2 controles en 2026, 1 en 2025; SHA-256 hexadecimal de 64 |
| P05-A7 | La tasa 2025 reconstruye casos enteros | 1 070 + 46 + 5 179 + 18 = 6 313 |
| P05-A8 | Totales, tasas o componentes incoherentes se rechazan | 3 errores distintos |
| P05-A9 | El CSV coincide con la procedencia y está normalizado | 94 filas; SHA-256 congelado; `wired_into_simulator = false` |
| P05-A10 | Ida y vuelta del CSV | bytes idénticos |
| P05-A11 | Semana duplicada | error `duplicada` |
| P05-A12 | Orden, rango de semana y provincia | 3 errores distintos |
| P05-A13 | Geometría incompleta | 3 errores distintos |

Referencia de la iteración: **13/13** pruebas nuevas; suite backend **369 pruebas** en verde.

### 4.2 Pipeline reproducible (D)

Desde la raíz. No requieren red ni el PDF:

```powershell
backend\.venv\Scripts\python.exe scripts\p05_import_dengue.py verify
backend\.venv\Scripts\python.exe scripts\p05_import_dengue.py build --imported-at 2026-10-27T00:00:00Z
backend\.venv\Scripts\python.exe scripts\p05_import_dengue.py render
```

| ID | Qué comprueba | Resultado esperado |
|---|---|---|
| P05-D1 | `verify` recalcula desde la geometría y compara con lo publicado | `status: passed`, `csv_sha256 e51b0858…`, 94 filas, 18 259 casos |
| P05-D2 | `build` es idempotente | mismo `csv_sha256` que P05-D1 |
| P05-D3 | `render` es determinista | el SVG no cambia entre ejecuciones |

Salida real de P05-D1 (2026-10-27):

```json
{"status":"passed","dataset_id":"manabi-dengue-weekly-v1","csv_sha256":"e51b0858624ccd32349e86fcee57777bc1834579b80416e21ce54b1b11d1913a","rows":94,"years":[2025,2026],"weeks":94,"total_cases":18259,"snapshots":[{"snapshot_id":"msp-etv-se53-2025","weeks":53,"sum_cases":6313,"controls":["rate-components"],"positional_label_mismatches":2},{"snapshot_id":"msp-etv-se41-2026","weeks":41,"sum_cases":11946,"controls":["official-total","case-components"],"positional_label_mismatches":0}]}
```

Regeneración completa (solo si hace falta; el paso `extract` requiere red en `download` y PyMuPDF ≥1.28):

```powershell
backend\.venv\Scripts\python.exe scripts\p05_import_dengue.py download
python -m pip install pymupdf
backend\.venv\Scripts\python.exe scripts\p05_import_dengue.py extract
backend\.venv\Scripts\python.exe scripts\p05_import_dengue.py build --imported-at 2026-10-27T00:00:00Z
backend\.venv\Scripts\python.exe scripts\p05_import_dengue.py verify
```

Si el MSP publica una revisión del PDF en la misma URL, `download` y `extract` fallan por hash: el cambio exige revisión explícita.

### 4.3 Límites

- Granularidad **provincial**: no hay datos de Manta ni cantonales.
- Datos **preliminares**: una gaceta posterior puede revisar semanas publicadas.
- 2026 llega hasta la SE 41; 2025 cubre 53 semanas.
- Las series 2021–2024 del gráfico no tienen etiquetas impresas y no se importan.
- El control de 2025 es **indirecto** (tasas por 100 000), no una tabla de casos.
- El dataset no alimenta el motor SEIR; la calibración es P-06 y se prueba en la sección 5.

Evidencia: [p05-dengue-manabi-2026-10-27.md](evidencia/p05-dengue-manabi-2026-10-27.md) y figura [p05-dengue-manabi.svg](evidencia/figuras/p05-dengue-manabi.svg).

## 5. P-06 — Calibración y preset versionado de dengue

Funcionalidad implementada: ajuste del SEIR de mezcla homogénea del motor a los casos semanales notificados de Manabí (P-05), con ventanas de ajuste/validación fijadas antes de mirar resultados, incertidumbre por bootstrap, perfil de verosimilitud, preset versionado `manabi-dengue-2025-v1` y panel en la UI.

**Estado publicado: `fitted-not-validated`.** La validación fuera de muestra pierde frente a la persistencia en 2025 (MAE 29,53 vs 14,22) y en 2026 (268,62 vs 48,86). Es el resultado real y no se re-tunea. El modo ficticio sigue siendo el predeterminado.

### 5.1 Pruebas automatizadas (A)

Backend, desde `backend/`. No requieren red, PDF ni la API:

```powershell
.venv\Scripts\python.exe -m pytest tests/test_p06_calibration.py -q
```

| ID | Qué comprueba | Resultado esperado |
|---|---|---|
| P06-A1 | La ventana usa dos tercios por número de semanas | 2025 35/18; 2026 27/14 |
| P06-A2 | `σ`, `γ` y `N` son los valores declarados | 0.333333, 0.142857, 1 661 447 |
| P06-A3 | La simulación conserva población y es determinista | misma salida en dos llamadas |
| P06-A4 | La simulación responde de forma monótona a `β` al inicio | más `β` ⇒ más exposición |
| P06-A5 | Parámetros inválidos se rechazan | 4 errores distintos |
| P06-A6 | La log-verosimilitud NB coincide con la fórmula | error < 1e-12 |
| P06-A7 | La dispersión se elige en la rejilla declarada | valor de la rejilla |
| P06-A8 | `evaluate` publica MAE, RMSE, sesgo, log-score y cobertura | cifras finitas y rango válido |
| P06-A9 | El ajuste recupera parámetros conocidos de datos sintéticos | error acotado en `β` y `ρ` |
| P06-A10 | Series cortas o inválidas se rechazan | 3 errores distintos |
| P06-A11 | El perfil de verosimilitud tiene su máximo cerca del estimado | Δ mínimo en el entorno de `β` |
| P06-A12 | El bootstrap es determinista y ordenado | mismos percentiles en dos ejecuciones |
| P06-A13 | El CSV de P-05 se lee con su hash congelado | 94 filas, `e51b0858…` |
| P06-A14 | El ajuste real coincide con el preset publicado | `β`, `ρ`, `k`, `R₀` y logL idénticos |
| P06-A15 | Se publican métricas de validación y las dos referencias | MAE de modelo, persistencia y media |
| P06-A16 | El preset del motor es una configuración válida | `β` en (0,1], N ≤ 2000, días ≤ 180 |
| P06-A17 | El perfil se lee como identificabilidad **condicional** | máximo único en 0.17; ±10 % cuesta > 2 unidades |
| P06-A18 | El perfil no escapa al óptimo global | `β` lejano pierde > 2 unidades |
| P06-A19 | El puente al motor se publica como desviación | 10 réplicas, extinciones contadas, cociente finito |
| P06-A20 | El resultado desfavorable queda registrado | validación > persistencia en los dos años |
| P06-A21 | La copia del frontend coincide con el preset del backend | hash, motor, límites e identificabilidad |
| P06-A22 | El preset no contamina el modo ficticio | escenario por defecto intacto |

Frontend, desde `frontend/`:

```powershell
npm test -- --run
```

| ID | Qué comprueba | Resultado esperado |
|---|---|---|
| P06-A23 | Lee el preset publicado sin recalcular el ajuste | `manabi-dengue-2025-v1`, ventanas 35/53 y 27/41 |
| P06-A24 | Un preset alterado no se carga ni rompe el modo ficticio | `PresetError` en 6 mutaciones |
| P06-A25 | Cargar impone la parte epidemiológica y respeta la intervención | `β` y `σ` del motor; vacunas, eficacia, réplicas y semilla intactas |
| P06-A26 | El preset solo está activo mientras el escenario no se edite | `true` con vacunas distintas; `false` al cambiar `β` o población |
| P06-A27 | El resumen muestra ventana, error retenido y desviación | texto con S1–S35 / S36–S53 y brotes extintos |

Referencia de la iteración: **22/22** pruebas backend nuevas y **5/5** frontend; suite completa **391 backend** y **135 frontend** en verde.

### 5.2 Pipeline reproducible (D)

Desde la raíz, sin red:

```powershell
backend\.venv\Scripts\python.exe scripts\p06_calibrate.py verify
backend\.venv\Scripts\python.exe scripts\p06_calibrate.py summary
```

| ID | Qué comprueba | Resultado esperado |
|---|---|---|
| P06-D1 | `verify` recalcula el preset desde el CSV y compara con lo publicado | `status: passed`, hash `sha256:2cde2f34…` |
| P06-D2 | El ajuste es determinista | `beta 0.1678562291` (2025) y `0.1725914523` (2026) en cada ejecución |
| P06-D3 | `summary` resume ambos años y el puente | ventanas, MAE de validación y persistencia |

Salida real de P06-D1 (2026-10-27):

```json
{"status":"passed","presetId":"manabi-dengue-2025-v1","hash":"sha256:2cde2f34eb1c088611d4f6714756e67d4cec980b8b0a349d0e323fbd56cf8aab","fits":[{"year":2025,"beta":0.1678562291,"reporting":0.0121826558,"r0":1.174994779,"validationMae":29.5293446741,"validationCoverage95":0.3333333333},{"year":2026,"beta":0.1725914523,"reporting":0.016842195,"r0":1.2081413743,"validationMae":268.6159791177,"validationCoverage95":0.0}],"engineBeta":0.025542,"bridgeRatio":0.6502960959,"bridgeExtinctions":3,"identifiabilityWindow":{"min":0.17,"max":0.17,"count":1}}
```

`fit` solo hace falta para republicar: reescribe `data/p06/dengue-preset-v1.json` y `frontend/src/lib/dengue-preset.json`. Si cambia el CSV de P-05, `verify` falla por hash y el ajuste exige revisión explícita.

### 5.3 Navegador real (B)

Precondición: API en `:8000` y Vite en `:5174`; vista **Explorar red**.

| ID | Pasos | Resultado esperado |
|---|---|---|
| P06-B1 | Abrir la vista y leer el panel | Insignia «Ajustado, no validado»; ventanas S1–S35/S36–S53; MAE retenido 29,53; cobertura 33,33 %; 3/10 brotes extintos; 9 límites; sin errores de consola |
| P06-B2 | Pulsar «Cargar preset de dengue» | `β` 0.03 (0.025542), población 1000, horizonte 90, inicio 3; vacunas, eficacia y réplicas sin cambios; aviso con `R₀ ≈ 1.17` |
| P06-B3 | «Consultar red» con el preset cargado | `POST /v1/scenarios/preview` → 200; 1 000 personas, 59 373 contactos, semilla 20261026 |
| P06-B4 | Pulsar «Volver al brote ficticio» | `β` vuelve a 0.08; el panel deja de estar activo; aviso de modo ficticio restablecido |

Figura: `docs/evidencia/figuras/p06-preset-dengue.jpeg`. Informe: [p06-dengue-manabi-2026-10-27.md](evidencia/p06-dengue-manabi-2026-10-27.md).

### 5.4 Límites

- El resultado de validación es **desfavorable** y así se publica; el preset no está validado.
- No es un modelo de dengue: es la forma SEIR del motor ajustada a una curva de casos.
- `N` y `ρ` están confundidos; solo se identifica `ρ·N` y se reporta `ρ|N`.
- La identificabilidad de `β` es **condicional al modelo**; no corrige el mal ajuste.
- El motor no puede simular la ventana de ajuste (371 días > 180): el preset reproduce la dinámica traducida, no la serie.
- El puente mide desviación entre aproximaciones (0,65× la teoría), no valida el motor.
- Los datos son provinciales, preliminares y 2026 llega hasta la SE 41.

## 6. Regresión mínima antes de cerrar una iteración

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

Resultado de referencia (2026-10-27, I-05): 391 pruebas backend; 135 pruebas frontend; Ruff, formato, mypy, typecheck y build correctos.

## 7. Límites de este documento

- P-04 (AWS, Distributed Map, miles de réplicas) no existe en local y por eso no tiene pruebas aquí.
- P-05 no tiene prueba de navegador: es un pipeline de datos. Su verificación es por hash, controles de totales y pruebas unitarias.
- P-06 tiene panel, pero su verificación en navegador cubre la carga y la vista previa, no una aceptación humana.
- La aceptación humana T-13..T-16 (teclado, contraste con personas, tiempos de demo, guion sorpresa) requiere personas y acceso; no se simula con scripts.
- Las capturas prueban lo que muestran; no sustituyen los hashes ni la reproducibilidad que verifican los scripts.
- T-22 sigue incompleto: ninguna cifra de estas pruebas debe citarse como gate científico.
