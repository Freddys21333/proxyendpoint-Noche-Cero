# P-03: Contratos y ejecución local de trabajos Monte Carlo

**Estado:** en desarrollo  
**Fecha:** 27 de octubre de 2026  
**Referencia:** PRO-4; TRD §2.3, §9.3  
**Dependencias:** T-10/11, modelo fijado  

## 1. Propósito y alcance

Formalizar los contratos HTTP de `/v1/jobs` para experimentos con más de 30 réplicas, validar reproducibilidad local antes de AWS y cerrar la semántica de creación, consulta, progreso y cancelación de trabajos Monte Carlo.

Este incremento NO despliega AWS Step Functions ni Distributed Map; P-04 cubrirá infraestructura cloud. El LocalJobManager actual en `simulation/jobs.py` ya ofrece ejecución en hilos Python para pruebas locales.

## 2. Contratos HTTP

### 2.1 POST /v1/jobs — Crear trabajo

**Petición:** `job-create-request.schema.json`

```json
{
  "schemaVersion": "1.0",
  "configuration": { /* Configuration completa normalizada */ },
  "expectedGraphHash": "sha256:...",
  "includeRepresentativeFrames": false
}
```

- `configuration`: igual estructura que `/v1/simulations/compare`, con `repetitions` entre 2 y 10.000
- `expectedGraphHash`: obtenido desde `/v1/scenarios/preview`, valida coherencia
- `includeRepresentativeFrames`: por defecto `false` para ahorrar transferencia

**Respuesta 202:** `job-create-response.schema.json`

```json
{
  "schemaVersion": "1.0",
  "engineVersion": "0.1.0",
  "requestId": "abc-123",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "createdAt": "2026-10-27T15:30:00Z",
  "updatedAt": "2026-10-27T15:30:00Z",
  "progress": {
    "replicatesTotal": 100,
    "replicatesCompleted": 0,
    "replicatesFailed": 0
  },
  "statusUrl": "/v1/jobs/550e8400-e29b-41d4-a716-446655440000"
}
```

Estados iniciales:
- `pending`: trabajo creado pero no iniciado
- `queued`: aceptado y en cola de ejecución (se puede usar este inmediatamente)

**Errores:**
- 400 INVALID_JSON / UNKNOWN_FIELD
- 409 GRAPH_HASH_MISMATCH / IDEMPOTENCY_CONFLICT (futuro con Idempotency-Key)
- 413 REQUEST_TOO_LARGE
- 422 VALIDATION_ERROR / ORIGIN_EMPTY
- 429 RATE_LIMITED
- 503 COMPUTE_UNAVAILABLE

### 2.2 GET /v1/jobs/{jobId} — Consultar estado

**Respuesta 200:** `job-status-response.schema.json`

```json
{
  "schemaVersion": "1.0",
  "engineVersion": "0.1.0",
  "requestId": "def-456",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "createdAt": "2026-10-27T15:30:00Z",
  "updatedAt": "2026-10-27T15:31:45Z",
  "progress": {
    "replicatesTotal": 100,
    "replicatesCompleted": 67,
    "replicatesFailed": 0
  }
}
```

Estados posibles:
- `pending`: creado, no iniciado
- `queued`: en cola de ejecución
- `running`: ejecutando réplicas
- `aggregating`: calculando resumen estadístico (opcional, puede omitirse si es instantáneo)
- `completed`: terminado exitosamente
- `failed`: falló por error interno
- `cancelled`: cancelado por solicitud del usuario

Estados terminales: `completed`, `failed`, `cancelled`

Cuando `status == "completed"`, incluir campo `result` con el mismo esquema que `experiment-result.schema.json` (respuesta de `/v1/simulations/compare`).

Cuando `status == "failed"`, incluir campo `error` con mensaje descriptivo.

**Errores:**
- 404 JOB_NOT_FOUND

### 2.3 POST /v1/jobs/{jobId}/cancel — Cancelar trabajo

**Respuesta 202:** `job-cancel-response.schema.json`

```json
{
  "schemaVersion": "1.0",
  "engineVersion": "0.1.0",
  "requestId": "ghi-789",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "cancelled",
  "createdAt": "2026-10-27T15:30:00Z",
  "updatedAt": "2026-10-27T15:32:10Z",
  "progress": {
    "replicatesTotal": 100,
    "replicatesCompleted": 73,
    "replicatesFailed": 0
  }
}
```

Semántica:
- Cancelación cooperativa: el trabajo se detiene en la próxima réplica, no aborta cálculos en curso
- Si el trabajo ya terminó (`completed`, `failed`), devuelve 404 o el estado actual sin cambios
- No hay transición desde estado terminal

**Errores:**
- 404 JOB_NOT_FOUND (si no existe o ya está en estado terminal irrecuperable)

## 3. Validación y semántica

### 3.1 Reproducibilidad

- Lista de índices de réplicas: `[0, 1, 2, ..., repetitions-1]` fijada antes de ejecutar
- Cada réplica usa `replicateIndex` para derivar semillas: `initial`, `transmission`, `progression`, `vaccine`, `policy-random`, `combined-brigades-v1`
- Ejecutar réplicas en diferente orden debe producir el mismo agregado (orden canónico: por índice ascendente)
- Reintentos de réplicas fallidas no duplican índices
- Hash del experimento completo debe coincidir con ejecución secuencial de `/v1/simulations/compare` con mismos parámetros

### 3.2 Validación de versiones

- `configuration` debe incluir `rootSeed`, `networkMode`, `repetitions`, versiones compatibles
- `graphHash` validado contra grafo regenerado antes de iniciar el trabajo
- Si las versiones de motor/esquema no coinciden con las configuradas en Lambda, devolver 503 COMPUTE_UNAVAILABLE

### 3.3 Progreso real

- `replicatesCompleted`: réplicas que terminaron exitosamente todas las políticas
- `replicatesFailed`: réplicas con error irrecuperable (no se reintenta automáticamente en local)
- `replicatesTotal == replicatesCompleted + replicatesFailed` cuando el trabajo está activo
- No inventar tiempo estimado (ETA) ni porcentaje basado en duración pasada
- Progreso solo refleja conteo de réplicas procesadas sobre total

### 3.4 Agregación

- Solo cuando `replicatesCompleted == replicatesTotal` y `replicatesFailed == 0` se calcula el resumen
- Si hay réplicas fallidas, el trabajo pasa a `failed` sin resultado parcial
- Ninguna recomendación final desde un trabajo incompleto
- Réplica representativa: igual criterio que compare síncrono (más cercana a mediana de `targeted`)

## 4. Implementación actual en `simulation/jobs.py`

### 4.1 Clase `JobRecord`

```python
@dataclass
class JobRecord:
    job_id: str
    configuration: Configuration
    expected_graph_hash: str
    include_representative_frames: bool
    status: JobStatus  # Literal["pending", "running", "completed", "failed", "cancelled"]
    created_at: str
    updated_at: str
    replicates_completed: int
    replicates_failed: int
    replicates_total: int
    result: dict[str, Any] | None
    error_message: str | None
    _cancelled: bool
```

Método `to_dict(*, include_result: bool = True)` devuelve JSON según esquemas de arriba.

### 4.2 Clase `LocalJobManager`

```python
class LocalJobManager:
    def __init__(self, *, max_concurrent: int = 2) -> None
    def create_job(...) -> JobRecord
    def get_job(job_id: str) -> JobRecord | None
    def cancel_job(job_id: str) -> bool
    def _run_job(record: JobRecord) -> None  # Método interno, ejecuta en hilo daemon
```

- `create_job` con `auto_start=True` lanza hilo inmediatamente
- `_run_job` ejecuta réplicas secuencialmente dentro del hilo, actualiza `replicates_completed` después de cada una
- Antes de cada réplica verifica `record._cancelled`; si es `True`, detiene y marca `status = "cancelled"`
- Al terminar todas las réplicas, calcula agregado con `aggregate()` y exporta con `export_experiment()`

Singleton: `GLOBAL_JOB_MANAGER = LocalJobManager()`

### 4.3 Integración en `api/common.py`

Endpoints ya conectados:
- `jobs_create`: extrae body, valida con `parse_request(..., operation="compare")`, llama `create_job()`, devuelve 202
- `jobs_get`: extrae `jobId` de path, consulta `get_job()`, devuelve 200 o 404
- `jobs_cancel`: extrae `jobId`, llama `cancel_job()`, devuelve 202 o 404

Feature flag en `/v1/config`: `"asyncJobs": true` (ya implementado)

## 5. Pruebas de aceptación

### 5.1 Casos mínimos

1. **Crear trabajo válido:** POST con N=50, T=3, R=5 devuelve 202 con `jobId` y `status="pending"` o `"queued"`
2. **Consultar progreso:** GET mientras ejecuta devuelve `status="running"` y `replicatesCompleted` creciente
3. **Consultar completado:** GET después de terminar devuelve `status="completed"` y `result` completo
4. **Cancelar en progreso:** POST cancel mientras ejecuta detiene y devuelve `status="cancelled"`
5. **Cancelar ya terminado:** POST cancel sobre `completed` devuelve 404 o estado sin cambios
6. **Trabajo inexistente:** GET/POST cancel con UUID inventado devuelve 404 JOB_NOT_FOUND
7. **Hash incorrecto:** POST con `expectedGraphHash` distinto al grafo devuelve trabajo `failed` con error GRAPH_HASH_MISMATCH
8. **Reproducibilidad:** Resultado de trabajo con R=10 coincide con `/v1/simulations/compare` con R=10 (mismo hash)
9. **Orden irrelevante:** Dos trabajos con R=5 ejecutados en orden de índices [0,1,2,3,4] y [4,3,2,1,0] producen mismo `experimentHash`
10. **Réplica fallida (simulada):** Si una réplica lanza excepción, trabajo pasa a `failed` sin resultado parcial

### 5.2 Archivo de pruebas

Crear `backend/tests/test_jobs_local.py` con:

```python
import pytest
from domain.configuration import normalize_configuration
from simulation.jobs import LocalJobManager
from simulation.network import generate_graph
from domain.reproducibility import json_hash
import time

def test_create_job_returns_pending_status():
    manager = LocalJobManager()
    config = normalize_configuration({"scenario": {"populationSize": 50, "days": 3}, "repetitions": 5})
    graph = generate_graph(config)
    graph_hash = json_hash(graph)
    
    job = manager.create_job(config, graph_hash, auto_start=False)
    
    assert job.status == "pending"
    assert job.replicates_total == 5
    assert job.replicates_completed == 0
    assert job.job_id is not None

def test_job_completes_and_returns_result():
    manager = LocalJobManager()
    config = normalize_configuration({"scenario": {"populationSize": 50, "days": 3}, "repetitions": 2})
    graph = generate_graph(config)
    job = manager.create_job(config, json_hash(graph), auto_start=True)
    
    # Esperar hasta completar (timeout 30s)
    for _ in range(60):
        time.sleep(0.5)
        current = manager.get_job(job.job_id)
        if current and current.status in ("completed", "failed", "cancelled"):
            break
    
    assert current is not None
    assert current.status == "completed"
    assert current.replicates_completed == 2
    assert current.result is not None
    assert "manifest" in current.result
    assert current.result["manifest"]["experimentHash"]

def test_cancel_running_job_stops_execution():
    manager = LocalJobManager()
    config = normalize_configuration({"scenario": {"populationSize": 100, "days": 10}, "repetitions": 50})
    graph = generate_graph(config)
    job = manager.create_job(config, json_hash(graph), auto_start=True)
    
    time.sleep(1)  # Dejar que empiece
    success = manager.cancel_job(job.job_id)
    
    assert success is True
    time.sleep(0.5)
    current = manager.get_job(job.job_id)
    assert current.status == "cancelled"
    assert current.replicates_completed < 50

def test_graph_hash_mismatch_fails_job():
    manager = LocalJobManager()
    config = normalize_configuration({"scenario": {"populationSize": 50, "days": 3}, "repetitions": 2})
    wrong_hash = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    
    job = manager.create_job(config, wrong_hash, auto_start=True)
    
    for _ in range(20):
        time.sleep(0.5)
        current = manager.get_job(job.job_id)
        if current and current.status == "failed":
            break
    
    assert current.status == "failed"
    assert "GRAPH_HASH_MISMATCH" in current.error_message

def test_job_result_matches_sync_compare():
    from simulation.experiments import run_experiment
    from simulation.exports import export_experiment
    
    config = normalize_configuration({"scenario": {"populationSize": 50, "days": 3}, "repetitions": 3})
    
    # Ejecución síncrona
    sync_result = run_experiment(config)
    sync_export = export_experiment(sync_result)
    sync_hash = sync_export["manifest"]["experimentHash"]
    
    # Ejecución asíncrona
    manager = LocalJobManager()
    graph = generate_graph(config)
    job = manager.create_job(config, json_hash(graph), auto_start=True)
    
    for _ in range(60):
        time.sleep(0.5)
        current = manager.get_job(job.job_id)
        if current and current.status == "completed":
            break
    
    async_hash = current.result["manifest"]["experimentHash"]
    assert async_hash == sync_hash
```

### 5.3 Verificación de esquemas

Agregar validación de esquemas en `backend/tests/test_api.py`:

```python
def test_jobs_create_validates_schema():
    from api.common import _execute
    
    config = normalize_configuration({"scenario": {"populationSize": 50, "days": 3}, "repetitions": 5})
    graph = generate_graph(config)
    
    event = {
        "body": json.dumps({
            "schemaVersion": "1.0",
            "configuration": config.to_dict(),
            "expectedGraphHash": json_hash(graph)
        })
    }
    
    response = _execute("jobs_create", event, "test-request-id", DEFAULT_LIMITS)
    
    # Validar contra job-create-response.schema.json
    validate_contract(response, "JobCreateResponse")
    assert response["jobId"]
    assert response["status"] in ("pending", "queued")
```

## 6. Documentación en OpenAPI

Agregar a `schemas/openapi.yaml`:

```yaml
  /jobs:
    post:
      operationId: jobsCreate
      summary: Crear trabajo Monte Carlo asíncrono
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: ./job-create-request.schema.json
      responses:
        '202':
          description: Trabajo creado y aceptado para ejecución
          content:
            application/json:
              schema:
                $ref: ./job-create-response.schema.json
        '400':
          $ref: '#/components/responses/BadRequest'
        '409':
          $ref: '#/components/responses/Conflict'
        '422':
          $ref: '#/components/responses/ValidationError'
        '503':
          $ref: '#/components/responses/ServiceUnavailable'
  
  /jobs/{jobId}:
    get:
      operationId: jobsGet
      summary: Consultar estado de un trabajo
      parameters:
        - name: jobId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Estado actual del trabajo
          content:
            application/json:
              schema:
                $ref: ./job-status-response.schema.json
        '404':
          $ref: '#/components/responses/NotFound'
    
    post:
      operationId: jobsCancel
      summary: Cancelar un trabajo en ejecución
      parameters:
        - name: jobId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '202':
          description: Solicitud de cancelación aceptada
          content:
            application/json:
              schema:
                $ref: ./job-cancel-response.schema.json
        '404':
          $ref: '#/components/responses/NotFound'
```

## 7. Límites y configuración

### 7.1 Límites actuales (local)

- Mínimo `repetitions`: 2 (hereda de base)
- Máximo `repetitions` local: 10.000 (no validado aún, agregar en `domain/configuration.py`)
- Máximo trabajos concurrentes: 2 (configurable en `LocalJobManager.__init__`)
- No hay TTL de trabajos en memoria (se pierden al reiniciar el proceso)

### 7.2 Para P-04 (AWS futuro)

- Máximo `repetitions` AWS: configurable según cuotas Lambda/Step Functions
- Persistencia en DynamoDB con TTL de 7 días
- Resultados en S3 con lifecycle
- Concurrencia Lambda según `MaxConcurrency` de Distributed Map

## 8. Siguientes pasos

1. ✅ **Crear esquemas JSON:** `job-create-request`, `job-create-response`, `job-status-response`, `job-cancel-response` en `schemas/`
2. ✅ **Actualizar OpenAPI:** agregar rutas `/jobs`, `/jobs/{jobId}` con todos los códigos de error
3. ✅ **Escribir pruebas:** `test_jobs_local.py` con 10 casos de aceptación mínimos
4. ✅ **Validar reproducibilidad:** comparar hash de trabajo asíncrono vs. síncrono
5. ✅ **Documentar límites:** agregar validación de `repetitions` máximo en configuración
6. 🔄 **Evidencia:** ejecutar pruebas, capturar salida y registrar en `docs/evidencia/p03-jobs-local.md`
7. ⬜ **Cerrar P-03:** marcar como verificado en `specs/pro-roadmap.md`

## 9. Exclusiones de este incremento

- ❌ Idempotency-Key (header HTTP para prevenir duplicados)
- ❌ Step Functions, Lambda workers, S3, DynamoDB (eso es P-04)
- ❌ Límite de rate (429) específico para jobs
- ❌ Priorización de trabajos o cola con pesos
- ❌ Streaming de progreso (SSE/WebSocket)
- ❌ Reintentos automáticos de réplicas fallidas
- ❌ Recuperación de trabajos después de reinicio del proceso

Estos se considerarán en P-04 o mejoras futuras según necesidad demostrada.

---

**Última actualización:** 2026-10-27  
**Responsable:** Freddy Bajaña  
**Próximo revisor:** Backend team
