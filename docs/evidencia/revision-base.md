# Revisión de cumplimiento de la base

Fecha local: 26 de octubre de 2026. Código revisado: e17f4d7, rama feat/front-end. Esta revisión contrasta PRD/TRD, specs y código/evidencia local; no acredita despliegue ni resultados científicos nuevos. No cambia funcionalidades ni amplía PRO.

## Conclusión

La integración local ya permite configurar, generar preview, comparar políticas, explorar la representativa, explicar vacunas, cambiar agrupaciones y exportar JSON/ZIP CSV. La base todavía no está cerrada: faltan la aceptación de casos manuales del jurado, validación integral y gate científico e infraestructura/operación AWS. Los incrementos I-01..I-08 son avances verificables, no equivalen automáticamente a cerrar T-13..16.

## Hallazgos ordenados para el siguiente trabajo

### 1. RF-15/CA-12: validar los casos manuales del jurado

**Aclaración de alcance del responsable, 2026-10-27:** no existen casos fijos obligatorios ni se necesitan botones de presets. El jurado solicitará ejemplos distintos y el operador modificará parámetros/semilla manualmente. La observación original que trataba la ausencia de presets como incumplimiento queda retirada. PRD 1.1/TRD 1.3 y specs reflejan esta decisión. Los helpers applyPreset pueden mantenerse como utilidades opcionales; no son trabajo pendiente de UI. Sigue pendiente medir y documentar la aceptación del flujo manual en menos de cinco minutos. RF-18 (comparación lado a lado) conserva su carácter DEBERÍA.

### 2. La validación del preview permite una respuesta de otra configuración

[api.ts, preview](../../frontend/src/lib/api.ts) verifica presencia de objetos/arrays/hash, pero no correspondencia con la petición ni población, IDs, posiciones o estados iniciales completos. Diagnóstico ejecutado en Node con el fixture de preview: petición N=51 y respuesta N=50 fue aceptada (acceptedMismatchedPreview=true). Es una respuesta simulada de contrato, no un fallo observado del backend real. Como [App](../../frontend/src/App.tsx) compara usando remotePreview.configuration, una respuesta incongruente podría ejecutar parámetros distintos de los visibles. Siguiente corrección: rechazar discrepancias conservando normalización válida y comprobar coherencia mínima del grafo/posiciones/origen; añadir regresiones de contrato.

### 3. Los defaults y límites publicados se solicitan, pero se descartan

App hace Promise.all(health, config), pero el callback solo conserva health. El formulario y validateScenario usan defaults y límites locales. Actualmente los valores normales coinciden con el contrato, pero cambios del servidor no se reflejarían en la UI. Esto deja parcial la integración de configuración; consumir datos publicados, validar su estructura y definir cómo conservar entradas del usuario. No recortar silenciosamente parámetros para aparentar compatibilidad. Los límites de grafo/transporte pueden seguir siendo errores explícitos del backend.

### 4. La aceptación del frontend y el gate científico siguen abiertos

Hay pruebas unitarias y flujos manuales con API real registrados en [integracion-local.md](integracion-local.md). No se encontró suite E2E de navegador, prueba moderada cronometrada de ≤3 min ni comprobación completa de contraste/teclado y tabla equivalente de todos los estados/errores. Falta una matriz documentada con éxito, empate, pérdida, error, respuesta inválida, edición durante petición, falta de frames, exportación, semilla externa y casos solicitados con edición manual. La comprobación manual histórica no se presenta como una suite E2E automatizada.

T-22 no tiene protocolo/matriz científica fijada ni exportaciones finales de evaluación. Las pruebas de invariantes y agregación no prueban superioridad promedio. Fijar primero escenarios/semillas y criterio; después ejecutar, conservar pérdidas y reportar si el gate falla. No escoger semillas favorables a posteriori. La animación es una réplica, no evidencia del impacto agregado.

### 5. Infraestructura, rendimiento público y entregables operativos no están implementados

infra solo contiene .gitkeep; no hay configuración Terraform ni pipeline .github. No hay evidencia de URL pública, benchmark AWS N1000/T90/R30, p95 total ≤60 s, objetivo backend ≤25 s, IAM desplegado/CORS/HTTPS, smoke desde sesión limpia ni publicación. [costos.md](../costos.md) sigue siendo un borrador sin tarifas/estimación; Budget tiene evidencia histórica provisional y destinatarios pendientes. Falta arquitectura exportada/enlazada, costos medidos y cierre de documentación/entregables CA-14. No se consultó la cuenta AWS ni se verificaron permisos o notificaciones en esta revisión; no afirmar su estado actual a partir de capturas antiguas.

## Matriz por requisito de implementación

| Requisito | Estado observado | Pendiente para cierre |
|---|---|---|
| REQ-01 configuración | Parcial: edición, validación y normalización backend presentes | Config publicado y validación de preview; aceptación UI |
| REQ-02 red/origen | Núcleo verificado; integración local presente | Cobertura UI/aceptación de orígenes y errores |
| REQ-03 SEIR diario | Verificado en backend | Verificación integral junto al frontend |
| REQ-04 políticas/recursos | Verificado en backend; detalle real de dosis integrado | Aceptación UI integral |
| REQ-05 ejecuciones/fallos | Completo o error en API; espera indeterminada y descarte implementados | Matriz UI de fallos/obsolescencia |
| REQ-06 curvas/métricas | Backend y adaptación de curvas/tablas verificados localmente | Aceptación integral CA-09 |
| REQ-07 estadísticas | Agregación/bootstrap y presentación integrados | Aceptación UI de casos límite |
| REQ-08 explicación | Recomendaciones y selecciones reales implementadas | Casos UI de empate/pérdida/error |
| REQ-09 exportación/reproducción | Verificado localmente, JSON y ZIP CSV con equivalencia Python | Repetición en entorno publicado/semilla externa |
| REQ-10 sorpresas | Controles manuales presentes; presets no requeridos | Aceptación RF-15/CA-12 y prueba humana <5 min |
| REQ-11 AWS/documentación | Parcial: instrucciones locales y health | T-17..21 y aceptación pública/operativa |
| REQ-12 representativa/diff | Animación real identificada implementada | Diff base/sorpresa y aceptación de usabilidad |

## Estado de tareas

T-02..11 conservan su evidencia backend. T-12 se marca verificado localmente por entorno/cliente/fixtures/build/pruebas. T-13..16 se mantienen abiertos con avances explícitos; T-15 no se cierra solo por terminar exportaciones/animación. T-01, T-17..23 siguen abiertos. PRO permanece separado y no se inicia en esta revisión.

## Verificación ejecutada en esta revisión

- Frontend: scripts/frontend.ps1 test → 55 pruebas aprobadas.
- Frontend: scripts/frontend.ps1 run build → TypeScript y Vite correctos.
- Backend (cwd backend): uv run --locked --offline --cache-dir ../.uv-cache pytest -q → 302 pruebas aprobadas en 94,72 s, con temporales y loopback habilitados.
- Diagnóstico de contrato: preview de N50 aceptado ante petición N51; pendiente de corrección, no se cambió código de producción.
- Inspección local de archivos/evidencias; sin despliegue, consulta de cuenta AWS, benchmark público ni nuevo experimento científico.

Primera ejecución backend bajo aislamiento: 288 aprobadas, 12 errores de tmp_path y 2 fallos HTTP con WinError10013. Se repitió la misma suite con acceso a temporales y loopback para distinguir restricciones del entorno de regresiones. El resultado del intento restringido se conserva como limitación de ejecución, no como fallo científico del motor.

## Orden recomendado

1. Endurecer preview y consumir config sin perder entradas ni invalidación.
2. Validar cambios manuales de parámetros/semilla según casos del jurado; medir CA-12 y valorar diff RF-18.
3. Completar T-13..16 con matriz integral y aceptación de usabilidad/accesibilidad.
4. Fijar protocolo T-22 antes de evaluar resultados; ejecutar y reportar el gate real.
5. Preparar T-17/18; luego despliegue autorizado T-19/20, mediciones y documentación T-21/23. Se puede preparar IaC en paralelo, sin declarar servicio público antes de comprobarlo.
6. Solo tras verificar la base, abrir tareas PRO con alcance/contratos/pruebas propios.


## Actualización I-09 — preview y config corregidos

Los hallazgos 2 y 3 anteriores describen e17f4d7 y se conservan como historial. I-09 rechaza discrepancias petición/preview, valida población/IDs/posiciones/aristas/calendario/origen y los metadatos necesarios para dibujar. Config se valida, se conserva y aplica defaults solo a campos no editados; Restablecer usa defaults del servidor y las solicitudes conservan su configuración de red. El contrato /config publica límites de transporte/grafo/frames, no nuevos rangos de N/tasas: se consumen maxRequestBytes, maxDecodedResponseBytes, maxEdges y maxFrameStates en sus respectivos pasos; maxResponseBytes comprimido lo controla el backend. Los rangos de formulario siguen el esquema base.

Verificación I-09: 69 pruebas frontend y build/tipos correctos. No cierra la matriz E2E completa ni T-13..16. Siguen pendientes aceptación de casos manuales RF-15/CA-12, validación integral, gate científico y AWS. El diagnóstico N51/N50 ahora se rechaza. Siguiente trabajo: aceptación del flujo manual y validación integral; no añadir presets obligatorios.
