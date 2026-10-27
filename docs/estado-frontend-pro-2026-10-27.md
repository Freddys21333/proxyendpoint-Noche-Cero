# Estado del frontend hacia PRO · 2026-10-27

> **Instantánea histórica.** Este documento describe el frontend antes de I-02..I-05 (P-02, P-03, P-05 y P-06). El estado vigente está en [pro-roadmap](../specs/pro-roadmap.md), [plan de pruebas local](plan-pruebas-local.md) y [AGENTS.md](../AGENTS.md).

Alcance de esta revisión: **solo frontend**. La fuente de verdad del modelo, los costos, las estadísticas y los trabajos sigue siendo el backend. La [hoja de ruta PRO](../specs/pro-roadmap.md) define el alcance del producto y la [división de frentes](../specs/pro-workstreams.md) separa responsabilidades. Este documento registra qué puede usar hoy una persona en la interfaz, qué es una demostración y qué contrato falta para conectar el resto.

## Estado visible hoy

La aplicación local se llama **Noche Cero**. **Explorar red** es la entrada principal; Comparación y PRO conservan su navegación. La interfaz usa una paleta nocturna de Halloween sin cambiar los resultados ni atribuir riesgo a personas o lugares reales. Antes de consultar el servidor, la ilustración de la red declara que no contiene datos. Después de consultar, Red es la vista inicial y Mapa sigue disponible. Los estados SEIR se identifican con letra, nombre, cifra y color. [Código de la aplicación](../frontend/src/App.tsx), [estilos](../frontend/src/noche-cero.css) y [sistema visual](../DESIGN.md).

| Función base del frontend | Estado | Evidencia y límite |
|---|---|---|
| Salud, configuración y validación del escenario | Conectado a API real | `GET /v1/health` y `/v1/config`; se preservan entradas si falla la conexión. [Cliente API](../frontend/src/lib/api.ts). |
| Preview, filtros y exploración de contactos | Conectado a API real | `Consultar red` obtiene grafo, casos iniciales y semilla; seleccionar una persona muestra contactos del día y filtro. Cambiar parámetros invalida la vista anterior. [Explorador](../frontend/src/components/PreviewNetwork.tsx). |
| Comparación pareada de tres políticas | Conectado a API real | Endpoint síncrono, 2–30 réplicas, curvas, métricas, rangos empíricos, límites y recomendación del motor. La UI no calcula ganadores. [Resultados](../frontend/src/components/ComparisonResults.tsx). |
| Reproducción de una réplica | Conectado a frames reales cuando existen | Día, estrategia, velocidad, pausa y reinicio; la trayectoria se identifica como réplica y no como promedio. Si faltan frames, se explica el límite. [Controlador](../frontend/src/components/SimulationWorkspace.tsx). |
| Exportación | Implementada para resultados vigentes | JSON reproducible y ZIP/CSV; sin comparación solo se descarga un borrador de configuración. [Aplicación](../frontend/src/App.tsx). |
| Errores de API | Implementado para operaciones actuales | Panel contextual para desconexión, 404, 409, 413, 422, 429, 503 y 5xx; ofrece recuperación y mantiene parámetros. Un futuro `409 IDEMPOTENCY_CONFLICT` de jobs necesitará texto propio. [Mapa de errores](../frontend/src/lib/api-errors.ts). |

## Checklist por feature PRO

| Feature | Estado del frontend | Qué hay hoy | Falta para cerrar la feature en el front |
|---|---|---|---|
| **PRO-1/2: intervenciones, costos y presupuesto** | Parcial conectado | Editor de vacunas, cierre de capa y brigadas simuladas; presupuesto y costos educativos; resultados del motor y exportación. [Controles](../frontend/src/components/CombinedInterventions.tsx). | Mantener visibles supuestos y límites de la versión educativa; no presentar costos como tarifas reales ni como gasto AWS. |
| **P-01: llegadas e inventario diario** | Verificado localmente | Calendario de entregas e inventario inicial, capacidad, consumo y saldo por día en formulario y reproducción. [Editor](../frontend/src/components/ResourceScheduleEditor.tsx), [inventario](../frontend/src/components/ResourceInventory.tsx), [contrato](../specs/p01-resource-schedule.md). | Revalidar la vista cuando cambie el contrato; no hay bloqueo actual de frontend para P-01. |
| **P-02: política adaptativa** | Pendiente en frontend | Las brigadas dirigidas actuales recalculan destinatarios por día, pero no existe un editor de regla adaptativa ni una línea de decisiones explicadas. | Esperar esquema versionado de observaciones, reglas, acciones y motivos; crear editor, validación, comparación y explicación por día sin inferir decisiones en el cliente. |
| **P-03: trabajos Monte Carlo locales** | Prototipo de interfaz con fixture | Formulario de réplicas/semilla, estados `QUEUED/RUNNING/AGGREGATING/SUCCEEDED/FAILED/CANCELLED`, progreso, cancelar, reintentar e historial. Los datos y el avance son locales y se rotulan **Datos de ejemplo**. [Modelo UI](../frontend/src/pro/jobs-model.ts), [flujo](../frontend/src/pro/JobsWorkspace.tsx). | Publicar contrato `/v1/jobs`; implementar cliente API, idempotencia, token de capacidad en `sessionStorage`, consulta periódica, cancelación real, recuperación tras recarga, validación de respuestas y errores, resultado firmado y estados parciales. El modelo TypeScript actual es provisional, no un schema acordado. |
| **P-04: miles de réplicas en AWS** | No conectado | La pantalla de P-03 puede servir como base visual. El “1.000” visible en PRO es fixture; no ejecuta 1.000 réplicas. | Consumir progreso real del contrato de P-03, comunicar límites/costo y evitar ETA inventada. La infraestructura y prueba de escala son externas al frontend. |
| **P-05: datos epidemiológicos reales** | No iniciado | La pestaña Evidencia está deshabilitada y rotulada “Próximamente”. No hay selector ni dataset real. | Contrato de metadatos de fuente, lugar, período, granularidad, versión y límites; ficha y selector que distingan evidencia real de escenario ficticio. |
| **P-06: modelo calibrado** | No iniciado | La UI solo ofrece el modelo ficticio. No declara calibración de dengue. | Tras P-05, selector de modelo/preset y ficha de parámetros, ajuste, validación retenida, incertidumbre y límites, todos provenientes de respuestas verificadas. |
| **P-07: visualización temporal PRO-6** | Parcial con datos reales | Red y mapa usan día, política y réplica compartidos; reproducción y selección funcionan. [Workspace](../frontend/src/components/SimulationWorkspace.tsx). | Cerrar aceptación de transiciones, rendimiento con escenarios nuevos, teclado y movimiento reducido. No dibujar rutas de contagio ni movimiento sin eventos causales reales. |
| **P-08: informe para el alcalde** | No iniciado | La pestaña Informe está deshabilitada y rotulada “Próximamente”. | Contrato de informe validado; plantilla legible, previsualización y PDF con cifras, límites, fuentes, versión y hash del experimento. |
| **P-09: mapa geográfico** | Verificado localmente como presentación | Mapa OSM de Manta, trece polígonos versionados, posiciones sintéticas deterministas y sincronización con reproducción. [Mapa](../frontend/src/components/GeographicMap.tsx), [ficha](../specs/p09-geographic-map.md). | Mantener atribución, reintento de teselas y separación visible entre ubicación sintética y riesgo real. No cambia hashes ni contrato científico. |

## Contrato preparado para conectar P-03

El [TRD §9.3](../TRD.md#93-endpoints-pro) propone `POST /v1/jobs`, `GET /v1/jobs/{jobId}`, `POST /v1/jobs/{jobId}/cancel` y `GET /v1/jobs/{jobId}/result`. `POST` necesita `Idempotency-Key`; el progreso se calcula con réplicas completadas y fallidas sobre el total; resultado disponible solo al terminar. El token de capacidad se guarda solo en `sessionStorage`, nunca en URL, log o exportación.

Antes de reemplazar [fixtures de trabajos](../frontend/src/pro/fixtures/jobs.ts), backend y frontend deben cerrar en `schemas/` petición, respuesta y errores versionados: configuración/modelo/red, límites de réplicas, `jobId`, estado y transiciones, contadores, `Retry-After` o ritmo de consulta, cancelación, expiración, resultado parcial o fallido, URL firmada y códigos 409/429/5xx. La UI debe comprobar ese contrato en tiempo de ejecución igual que los endpoints actuales. **Hoy `/v1/jobs` no está publicado; el formulario PRO no lo llama.**

## Verificación de esta revisión

- [x] `npm run build`: TypeScript y compilación Vite correctos el 2026-10-27.
- [x] Navegador en 1280×800 y 390×844: navegación, composición, estados vacíos, controles y ausencia de desbordamiento horizontal en la pantalla inicial.
- [x] Preview real N=50, T=3: API devolvió población y red; se observó la vista Red y la pantalla de comparación.
- [x] Comparación real N=50, T=3, R=2: terminó y mostró métricas y curva sin datos ficticios.
- [x] `/v1/health` respondió `status: ok` tras reiniciar el servicio local.
- [ ] No se ha cerrado una auditoría completa de accesibilidad, rendimiento de grafos grandes ni aceptación P-07 en todos los estados.
- [ ] P-03/P-04, P-05/P-06 y P-08 no tienen integración real; las cifras de jobs son demostrativas.

Una comparación N=1.000, T=90, R=30 ocupó durante varios minutos el servidor local secuencial; se detuvo ese proceso y se reinició el backend antes de la comprobación corta. Esto no demuestra un fallo de resultado, pero **no acredita tiempo de respuesta apto para la demo**. Medir la configuración objetivo y definir límite/feedback de espera antes del gate de aceptación.

## Próxima iteración solo frontend

1. Cerrar con backend el schema de P-03 y convertir `JobsWorkspace` en un cliente real sin cambiar la semántica visual de estados; conservar los fixtures únicamente como demo explícita.
2. Diseñar P-02 sobre ejemplos versionados de reglas/decisiones; explicar observación, acción, costo y límite en cada día.
3. Completar la revisión de P-07 en móvil, teclado, movimiento reducido y tamaños altos; registrar evidencia sin inferir contagios.
4. Preparar las pantallas Evidencia e Informe cuando P-05/P-06 y P-08 publiquen contratos y contenido verificable.

**Criterio para decir “PRO listo” en el frontend:** cada control PRO debe consumir un contrato real versionado o declararse demo; carga, vacío, error, cancelación, resultados parciales, límites y recuperación deben estar verificados con datos de API. Esta pantalla todavía no cumple ese criterio para P-02 a P-08.
