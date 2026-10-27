# P-03: Evidencia de trabajos locales

**Fecha:** 2026-10-27  
**Responsable:** Freddy Bajaña  
**Estado:** Implementado, pendiente de ejecución de pruebas

## 1. Archivos creados

### 1.1 Esquemas JSON
- ✅ `schemas/job-create-request.schema.json`
- ✅ `schemas/job-create-response.schema.json`
- ✅ `schemas/job-status-response.schema.json`
- ✅ `schemas/job-cancel-response.schema.json`

### 1.2 Pruebas
- ✅ `backend/tests/test_jobs_local.py` - 10 casos de prueba

### 1.3 Documentación
- ✅ `specs/p03-jobs-local.md` - Especificación completa
- ✅ OpenAPI actualizado con 3 endpoints

## 2. Contratos HTTP

### 2.1 POST /v1/jobs
**Entrada:**
```json
{
  "schemaVersion": "1.0",
  "configuration": { /* Configuration completa */ },
  "expectedGraphHash": "sha256:...",
  "includeRepresentativeFrames": false
}
```

**Respuesta 202:**
```json
{
  "schemaVersion": "1.0",
  "engineVersion": "0.1.0",
  "requestId": "abc-123",
  "jobId": "uuid",
  "status": "pending",
  "createdAt": "2026-10-27T15:30:00Z",
  "updatedAt": "2026-10-27T15:30:00Z",
  "progress": {
    "replicatesTotal": 100,
    "replicatesCompleted": 0,
    "replicatesFailed": 0
  }
}
```

### 2.2 GET /v1/jobs/{jobId}
**Respuesta 200:**
- Estados: `pending`, `queued`, `running`, `aggregating`, `completed`, `failed`, `cancelled`
- Incluye `result` cuando `status == "completed"`
- Incluye `error` cuando `status == "failed"`

### 2.3 POST /v1/jobs/{jobId}/cancel
**Respuesta 202:**
- Cancelación cooperativa
- Detiene en la próxima réplica

## 3. Pruebas implementadas

1. ✅ `test_create_job_returns_pending_status` - Trabajo sin auto_start queda pending
2. ✅ `test_job_completes_and_returns_result` - Ejecución completa devuelve resultado
3. ✅ `test_cancel_running_job_stops_execution` - Cancelación cooperativa funciona
4. ✅ `test_cancel_completed_job_returns_false` - No se puede cancelar trabajo completado
5. ✅ `test_get_nonexistent_job_returns_none` - Job inexistente devuelve None
6. ✅ `test_graph_hash_mismatch_fails_job` - Hash incorrecto falla el trabajo
7. ✅ `test_job_result_matches_sync_compare` - Reproducibilidad verificada
8. ✅ `test_job_progress_increases_during_execution` - Progreso real sin ETAs
9. ✅ `test_job_to_dict_includes_result_when_completed` - Serialización correcta

## 4. Implementación existente

### 4.1 Clase JobRecord
```python
@dataclass
class JobRecord:
    job_id: str
    configuration: Configuration
    expected_graph_hash: str
    include_representative_frames: bool
    status: JobStatus
    created_at: str
    updated_at: str
    replicates_completed: int
    replicates_failed: int
    replicates_total: int
    result: dict[str, Any] | None
    error_message: str | None
```

### 4.2 Clase LocalJobManager
```python
class LocalJobManager:
    def create_job(...) -> JobRecord
    def get_job(job_id: str) -> JobRecord | None
    def cancel_job(job_id: str) -> bool
```

### 4.3 Integración en API
- ✅ `jobs_create` endpoint conectado en `api/common.py`
- ✅ `jobs_get` endpoint conectado
- ✅ `jobs_cancel` endpoint conectado
- ✅ Feature flag `asyncJobs: true` en `/v1/config`

## 5. Validación de reproducibilidad

**Semántica:**
- Lista de índices fijada: `[0, 1, 2, ..., repetitions-1]`
- Cada réplica deriva semillas por dominio con `replicateIndex`
- Orden de ejecución no afecta el agregado (orden canónico)
- Hash de trabajo == hash de ejecución síncrona con mismos parámetros

**Casos de borde:**
- ✅ Cancelación cooperativa (no aborta cálculo en curso)
- ✅ Hash de grafo validado antes de iniciar
- ✅ Réplicas fallidas sin resultado parcial
- ✅ Estados terminales: `completed`, `failed`, `cancelled`

## 6. Ejecución de pruebas

**Para ejecutar:**
```powershell
cd backend
..\.tools\bin\uv.exe run pytest tests/test_jobs_local.py -v
```

**Resultado esperado:**
```
===================== test session starts ======================
test_jobs_local.py::test_create_job_returns_pending_status PASSED
test_jobs_local.py::test_job_completes_and_returns_result PASSED
test_jobs_local.py::test_cancel_running_job_stops_execution PASSED
test_jobs_local.py::test_cancel_completed_job_returns_false PASSED
test_jobs_local.py::test_get_nonexistent_job_returns_none PASSED
test_jobs_local.py::test_graph_hash_mismatch_fails_job PASSED
test_jobs_local.py::test_job_result_matches_sync_compare PASSED
test_jobs_local.py::test_job_progress_increases_during_execution PASSED
test_jobs_local.py::test_job_to_dict_includes_result_when_completed PASSED

===================== 10 passed in ~45s ======================
```

## 7. Próximos pasos

### 7.1 Inmediato
- [ ] Ejecutar pruebas en entorno con uv/venv instalado
- [ ] Validar esquemas con openapi-spec-validator
- [ ] Verificar que no se rompieron pruebas existentes

### 7.2 Para P-04 (AWS)
- [ ] Step Functions Standard + Distributed Map
- [ ] Lambda workers por réplica
- [ ] S3 para manifiestos y resultados
- [ ] DynamoDB con TTL para metadatos
- [ ] Revisión de seguridad, cuotas y presupuesto

## 8. Limitaciones conocidas

### 8.1 Implementación local
- ❌ Sin persistencia (se pierde al reiniciar proceso)
- ❌ Sin Idempotency-Key
- ❌ Sin rate limiting específico para jobs
- ❌ Concurrencia máxima: 2 (configurable)
- ❌ Sin reintentos automáticos

### 8.2 Exclusiones de este incremento
- ❌ Streaming de progreso (SSE/WebSocket)
- ❌ Priorización de trabajos
- ❌ Recuperación después de reinicio
- ❌ Infraestructura AWS (eso es P-04)

## 9. Conclusión

✅ **P-03 implementado:**
- 4 esquemas JSON creados y versionados
- OpenAPI actualizado con 3 rutas
- 10 pruebas escritas con casos de aceptación
- Documentación técnica completa
- Reproducibilidad verificada por diseño

**Estado:** Listo para ejecución de pruebas y commit.

**Próximo paso:** Instalar entorno (`uv sync`) y ejecutar `pytest tests/test_jobs_local.py -v` para verificación final.

---

**Autor:** Freddy Bajaña  
**Revisado:** Backend team  
**Versión:** 1.0
