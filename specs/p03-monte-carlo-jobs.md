# P-03: trabajos Monte Carlo locales

Estado: **backend y contrato cliente verificados localmente**. P-04 conserva el despliegue AWS y la ejecución de miles de réplicas como pendientes. Referencias: TRD §9.3, [hoja PRO](pro-roadmap.md), [frentes backend/frontend](pro-workstreams.md), [evidencia](../docs/evidencia/p03-jobs-local.md).

## Alcance y límites

La comparación síncrona y preview aceptan 2..30 réplicas. P-03 agrega trabajos locales con 2..100, sin ampliar el endpoint síncrono. `ConfigurationInput` conserva el máximo 30; `JobConfigurationInput` acepta 100. Los resultados normalizados/exportables admiten hasta 100 para compartir estadísticas, validación y reproducción. Omitir jobs conserva los resultados científicos anteriores.

El servidor `scripts/serve_api.py` activa `LOCAL_JOBS_ENABLED=1` y publica `features.asyncJobs:true` y `jobLimits` en `/v1/config`. Los handlers sin esa opción anuncian false y rechazan trabajos con 503. Este gestor vive en un único proceso local: no es almacenamiento durable ni un worker Lambda para producción.

| Límite local | Valor |
|---|---|
| Réplicas por trabajo | 2..100 |
| Trabajos ejecutándose | 2 como máximo por defecto |
| Trabajos retenidos, incluidos pendientes y terminales | 8 |
| Retención de terminales/idempotencia | 3600 segundos desde terminar |
| Admisión de trabajo | aristas × días × réplicas <= 50000000 |
| Petición, resultado y frames | Límites compartidos publicados por la API |

La cola espera hasta disponer de trabajador. Cada trabajo procesa sus réplicas secuencialmente; dos trabajos pueden solaparse. Esto no acredita paralelismo de miles de réplicas. La cota de admisión estima trabajo, no garantiza duración ni precio. La cola/retención llena devuelve 503; no abre más hilos. Descargar el resultado antes de que expire. Reiniciar el proceso elimina todos los trabajos y claves locales. La expiración se aplica al consultar o admitir trabajo, sin limpiar archivos externos.

## Acceso e idempotencia

El cliente genera 32 bytes aleatorios y los envía como 64 caracteres hexadecimales en `X-Job-Token`. El servidor conserva su SHA-256 y verifica el acceso en tiempo constante. El token no aparece en URL, log, manifiesto ni exportación y debe conservarse en `sessionStorage` cuando se implemente la interfaz. No identifica a una persona.

Crear exige además `Idempotency-Key` de 1..128 caracteres alfanuméricos, guion o guion bajo. Misma capacidad + clave + solicitud normalizada devuelve el mismo trabajo durante su retención, incluso si está terminado/cancelado/fallido. Misma clave con otra configuración, hash o selección de frames devuelve 409 `IDEMPOTENCY_CONFLICT`; otra capacidad tiene otro espacio de claves. Reintentar requiere conservar ambas credenciales. Expiración/reinicio permiten crear un trabajo nuevo.

## Endpoints

Todos conservan metadata `schemaVersion`, `engineVersion` y `requestId`.

| Método/ruta | Entrada y salida |
|---|---|
| `POST /v1/jobs` | Token y clave en headers. JSON con `schemaVersion`, `configuration`, `expectedGraphHash` y `includeRepresentativeFrames` opcional false. Devuelve 202 y snapshot del trabajo. |
| `GET /v1/jobs/{jobId}` | Token en header. Devuelve 200 con estado, timestamps, URLs relativas, progreso y manifiesto; no transporta el resultado científico en cada consulta. |
| `POST /v1/jobs/{jobId}/cancel` | Token en header. Devuelve 202 con snapshot. Repetir es seguro; completed/failed/cancelled conservan su estado. |
| `GET /v1/jobs/{jobId}/result` | Token en header. Devuelve JSON científico completo, gzip, únicamente si completed. Otros estados: 409 `JOB_NOT_READY`. |

Capacidad ausente/incorrecta, trabajo desconocido o expirado: 404 `JOB_NOT_FOUND` sin distinguir existencia. Headers inválidos al crear: 422. Hash de red distinto: 409 antes de admitir trabajo. JSON estricto conserva rechazo de claves duplicadas, no finitos, campos desconocidos y exceso de tamaño. La validación de frames y carga se hace antes de admitir. Los errores de ejecución son códigos saneados, sin trazas ni mensajes de excepción.

Para R>30 se obtiene preview con la misma configuración de red y R<=30 y se usa su hash al enviar el trabajo con R deseado. El grafo no depende de repetitions. No enviar R>30 al preview ni a compare.

Los schemas `job-*.schema.json` referencian tipos de `common.schema.json`; OpenAPI y ejemplos usan esas mismas definiciones. Los ejemplos están marcados como mocks de contrato y no prueban resultados científicos.

## Estados, progreso y cancelación

Estados locales: `pending -> running -> aggregating -> completed|failed|cancelled`; se puede cancelar también desde pending. Corresponden a QUEUED/RUNNING/AGGREGATING/SUCCEEDED/FAILED/CANCELLED del diseño AWS, pero el wire local usa los nombres en minúscula del schema.

`replicatesTotal` es fijo. `replicatesCompleted` cuenta índices únicos que terminaron; `replicatesFailed` cuenta una réplica agotada tras reintentos; fallos de admisión/runtime o de agregación no inventan una réplica fallida. Completar todas las réplicas aún puede dejar estado aggregating. Solo completed expone resultado/recomendación. Fallar o cancelar no publica agregados parciales.

Cancelación es cooperativa en fronteras de réplica, antes de agregar, después de regenerar la representativa y antes de publicar. El snapshot pasa a cancelled al aceptarse; el trabajador puede terminar su cálculo actual antes de liberar el cupo. No se mata un hilo. Progreso y estado terminal quedan congelados; una exportación que finalice después de cancelar se descarta. Cancelar una petición del navegador con AbortSignal no cancela el trabajo; hay que invocar cancel explícitamente.

## Reproducibilidad y reintentos

El manifiesto se fija al crear: versión `local-jobs-v1`, hashes de configuración/petición/grafo, raíz, versiones de motor/RNG/runtime y lista completa de índices con entropía inicial. Los demás dominios se derivan de raíz, índice y nombre según rng-v1. No se eligen semillas después de ver resultados.

El gestor reutiliza `run_experiment`; no mantiene una segunda implementación de estadísticas o selección de representativa. Comparte las mismas políticas pareadas, agregado ordenado, bootstrap y regeneración verificada de representativa. Un fallo transitorio de simulación puede reintentar una vez el mismo índice desde sus flujos deterministas nuevos. Se registra éxito una sola vez después de terminar la réplica; las acciones no quedan acumuladas entre intentos. Un segundo fallo termina el trabajo sin resultado parcial. La ejecución síncrona conserva un solo intento.

El hash científico no incluye IDs de trabajo, tokens, timestamps ni orden de ejecución. Exportar, cargar y reproducir admite trabajos >30 con el mismo algoritmo. La prueba de orden invertido y la comparación de 31 réplicas verifican esta equivalencia.

## Entrega al frontend

`createApiClient` expone `createJob`, `jobStatus`, `cancelJob`, `jobResult`; `createJobCredentials()` genera token y clave. El cliente valida estados, progreso, manifiesto y resultados completos; transmite credenciales exclusivamente en headers y admite AbortSignal. Conservar las credenciales del mismo intento si falla la red antes de recibir 202. Las funciones no hacen polling automáticamente ni guardan secretos.

Pendiente frontend: selector de modo asíncrono y cantidad según jobLimits, conservar credenciales en sesión, polling con pausa/backoff, progreso real, cancelación y descarga/recomendación solo al terminar. Puede desarrollar ese diseño sobre los ejemplos de contrato; no necesita implementar reglas científicas. La validación del formulario síncrono mantiene R<=30: el modo jobs necesita su propio campo/cantidad según jobLimits, sin ampliar silenciosamente el modo base. P-04 sustituirá almacenamiento/orquestación local por infraestructura durable y definirá descarga S3 firmada, cuotas/costos y evidencia de miles de réplicas.
