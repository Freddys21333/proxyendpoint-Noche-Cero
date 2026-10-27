# Estado del código y pendientes después del merge P-02/P-03

**Fecha:** 2026-10-27.
**Rama:** `feat/pro`.
**Merge:** `5861407` (`merge(pro): integrar P-02 adaptativa y P-03 jobs locales`).
**Padres:** `27363d8` (I-01) y `ac2ded7` (P-02/P-03).
**Alcance:** revisión del código integrado y checklist de lo que falta. No declara PRO listo, no aprueba el gate T-22 y no acredita AWS.

---

## 1. Verificación ejecutada

| Frente | Resultado |
|---|---|
| Backend | `pytest -q`: **356 pruebas aprobadas**, 97,41 s. |
| Calidad backend | Ruff, formato y mypy sin incidencias; 21 archivos fuente revisados por mypy. |
| Frontend | **116 pruebas aprobadas**; typecheck y build correctos. |
| Protocolo T-22 | `check_validation_protocol.py`: mismo `protocolSHA256` (`cb6b3e...`), 15 experimentos, 450 réplicas, 150 primarias; no se ejecutaron simulaciones nuevas en ese chequeo. |
| Hash base | `base-root-0` re-ejecutado después del merge: `sha256:ead1ee4c...ae3e0c5`, idéntico al JSON previo al merge. |
| Integración P-02 | `verify_adaptive_integration.mjs`: **passed**, hash `sha256:701bee8c...63590b`, 24 filas adaptativas y anillo real. |
| Integración P-03 | `verify_jobs_integration.mjs`: R=2 `completed` con hash `sha256:27f4365b...ed43e8`; R=31 `completed` con hash `sha256:65199e58...985bc3`. |
| No ejecutado | Matriz primaria/contrastes T-22, benchmark AWS, suite E2E de navegador y aceptación humana. |

Los hashes de evidencia antiguos de P-02/P-03 corresponden a estados intermedios de la rama. Para el estado integrado valen los hashes de esta tabla y los archivos generados en `.tools/` durante la verificación post-merge.

---

## 2. Qué quedó implementado con el merge

### 2.1 P-02 — política adaptativa backend

- Configuración opcional `intervention.combined.adaptiveStrategy` con `adaptive-policy-v1`.
- Umbrales de cierre/reapertura con histéresis, prioridad de anillo, pausa de brigadas y cierre adaptativo.
- Registro diario `adaptiveDecisions`, motivos de omisión, exportación CSV y validación de coherencia.
- Comparación pareada contra `none` y `random`; independencia del orden de políticas y réplicas.
- Reproducción y rechazo de decisiones alteradas incluso si se recalculan hashes.
- El backend no implementa tendencia de casos nuevos ni aprendizaje por refuerzo; observa I/N, contactos activos, elegibles e inventario/presupuesto. No lee el futuro.
- Solo `targeted` con la variante habilitada usa la política adaptativa; no redefine silenciosamente la dirigida fija.

**Pendiente P-02 (actualizado 2026-10-27):** el editor, el nombre de variante y el historial diario ya están implementados y aceptados contra el motor real; ver [p02-ui-2026-10-27](p02-ui-2026-10-27.md). Resta la aceptación humana integral de T-13..T-16 y la corrida E2E, no el código de la variante.

### 2.2 P-03 — trabajos Monte Carlo locales

- Rutas locales `POST /v1/jobs`, `GET /v1/jobs/{id}`, `POST /v1/jobs/{id}/cancel` y `GET /v1/jobs/{id}/result`.
- Cola acotada, dos trabajadores, 2..100 réplicas, token por capacidad, idempotencia, manifiesto fijo, progreso, reintento determinista, cancelación cooperativa y expiración.
- Cliente TypeScript con `createJob`, `jobStatus`, `cancelJob`, `jobResult` y credenciales generadas; valida estados, progreso y resultado completo.
- Resultado reproducible y comparable con la ejecución síncrona; no publica agregados parciales.

**Límites que no se deben ocultar:** el gestor vive en un proceso local, no es durable, pierde trabajos al reiniciar y retiene terminales una hora. No es AWS ni acredita miles de réplicas. La pantalla PRO sigue usando fixtures.

**Pendiente P-03:** selector de modo asíncrono y cantidad, conservar credenciales en `sessionStorage`, polling con pausa/backoff, progreso real, cancelación, descarga y recomendación solo al completar. Conectar `JobsWorkspace`/`ProWorkspace` a la API real y corregir los rótulos “Pendiente”/“No iniciado” que hoy están desactualizados. Después, P-04.

---

## 3. Checklist pendiente por iteración

### I-01 — Rendimiento y gate T-22

- [ ] Ejecutar las **5 raíces primarias** (`base-root-0..4`) con R30.
- [ ] Ejecutar los **5 contrastes** descriptivos.
- [ ] Conservar JSON/ZIP/logs de las 15 filas y completar metadatos/reproducción de `base-root-0`; hoy el runner no lo cuenta como raíz completa.
- [ ] Reproducir cada JSON en proceso nuevo y `base-root-0` tres veces.
- [ ] Calcular medias por política, diferencias pareadas, wins/empates/pérdidas, intervalos por raíz y decisión del gate.
- [ ] Publicar informe con decisión **APROBADO / NO APROBADO / INCOMPLETO**. Hoy: **INCOMPLETO/INVÁLIDO**.
- [ ] No editar `specs/validation/t22-v1` después de observar resultados.
- [ ] Cerrar el objetivo de rendimiento backend ≤25 s; el benchmark actual es 44,3 s. El costo de exportación/reproducción no está incluido y es de minutos.

### I-02 — P-02 UI

- [x] Controles para habilitar/versionar la variante adaptativa y editar umbrales.
- [x] Distinguir la variante en vistas, curvas, tabla y explicación de selección.
- [x] Historial diario de decisiones y acciones realmente ejecutadas/omitidas.
- [ ] Aceptación con brote ascendente/descendente, saldo agotado, sin elegibles, cambio de prioridad, I=0/E>0 y reglas deshabilitadas. Cubierto en backend (`test_adaptive_regression.py`) y en el barrido real (`scripts/verify_adaptive_triggers.mjs`); en UI se aceptaron umbral de cierre/reapertura, pausa por I=0, anillo, reglas deshabilitadas y umbrales inválidos. Falta repetir saldo agotado y sin elegibles en la interfaz.
- [x] Pruebas de UI y evidencia con escenario nuevo: [p02-ui-2026-10-27](p02-ui-2026-10-27.md).

### I-03 — P-05 datos reales de dengue/Manabí

- [ ] Elegir fuente oficial utilizable y registrar URL, edición, fecha, corte, período, licencia y hash.
- [ ] Extraer y normalizar geografía, semana/fecha, casos, definición y unidad; revisar visualmente.
- [ ] Distinguir incidencia de acumulados, ceros de ausencias, correcciones y duplicados.
- [ ] Documentar faltantes y límites si no hay granularidad de Manta.
- [ ] No inventar datos ni repartir casos provinciales sin metodología.

### I-04 — P-03 UI y cierre local

- [ ] Conectar la pantalla PRO a `/v1/jobs`; retirar fixtures y rótulos de “contrato pendiente”.
- [ ] Selector de réplicas según `jobLimits`, sin ampliar el modo síncrono 2..30.
- [ ] Sesión de credenciales, polling, backoff, progreso real, cancelación y descarga.
- [ ] Resultado/recomendación solo en estado `completed`; nunca agregados parciales.
- [ ] Probar R=2, R=31 y R=100 localmente; documentar límites de proceso, retención y reinicio.
- [ ] P-04 queda para AWS, no para esta iteración local.

### I-05 — P-06 calibración y preset

- [ ] Definir variable observada y función de observación.
- [ ] Separar ajuste y validación antes de mirar resultados.
- [ ] Documentar parámetros fijados/estimados, identificabilidad, incertidumbre y métricas.
- [ ] Publicar dataset, preset, modelo, semillas y limitaciones versionados.
- [ ] Mantener el modo ficticio separado; no etiquetar como calibrado sin validación fuera de muestra.

### I-06 — P-08 informe para el alcalde

- [ ] Plantilla determinista con problema, escenario, recursos, intervenciones, comparación, incertidumbre, costos y límites.
- [ ] Cifras exactas del JSON, configuración, semilla, versiones y hash.
- [ ] PDF legible y reproducible; tablas/gráficos sin recortes.
- [ ] Conservar empates/pérdidas y no prometer ganador para toda semilla.
- [ ] Puede iniciar con escenario ficticio claramente identificado, pero no sustituye el gate T-22.

### I-07 — P-07 mapa y animación

- [ ] Aceptar sincronización mapa/red/curva/tabla con día, política y réplica.
- [ ] Pausa, seek, velocidad, reinicio y estrategia sin divergencias.
- [ ] Foco, teclado, contraste, movimiento reducido y rendimiento.
- [ ] No inventar contagios, trayectos ni desplazamientos; usar solo eventos reales.
- [ ] No mezclar la aceptación del mapa con el cierre de P-05/P-06.

### I-08 — P-04 AWS y entrega

- [ ] T-17: viabilidad de cuenta/región/permisos y Budget con destinatarios verificados.
- [ ] T-18: Terraform base, CORS, roles, logs/alarmas y Amplify; validar sin desplegar.
- [ ] T-19: staging autorizado, smoke y benchmark AWS; medir backend ≤25 s y total p95 ≤60 s.
- [ ] T-20: URL pública y health desde sesión limpia.
- [ ] T-21: arquitectura SVG + fuente, costos fechados, README/runbook y Budget verificable.
- [ ] P-04: Distributed Map, Lambda por réplica, S3, IAM mínimo, cuotas, concurrencia, costos y evidencia de 100/≥1.000 réplicas; sin 10.000 sin autorización.
- [ ] No desplegar ni gastar sin autorización explícita.

### I-09 — Cierre integral

- [ ] T-22 final sobre la versión entregada, con informe y decisión del gate.
- [ ] Suite E2E de navegador con éxito, empate, pérdida, error, parcial y respuesta obsoleta.
- [ ] Semilla externa del jurado, casos manuales y flujo sorpresa <5 min.
- [ ] Tiempos humanos, accesibilidad, contraste y tabla equivalente.
- [ ] Costos reales, arquitectura, runbook, pitch PDF/PPT ≤20 MB y ensayo.
- [ ] Revisión final de secretos, enlaces, reproducibilidad y límites visibles.

---

## 4. Tareas base que siguen abiertas

- [ ] **T-13:** matriz de aceptación de formulario/preview, teclado, foco, errores que conservan valores e invalidación.
- [ ] **T-14:** aceptación UI de éxito, empate, pérdida, error, parcial y respuesta obsoleta.
- [ ] **T-15:** prueba humana de casos del jurado, exportación real y diff base/sorpresa.
- [ ] **T-16:** E2E de navegador, contraste AA, tabla equivalente y prueba moderada ≤3 min.
- [ ] **T-22:** primaria/contrastes y gate; ver I-01.
- [ ] **T-23:** escenarios variables, semilla externa y reproducibilidad operativa.
- [ ] **T-01:** acuerdos técnicos adoptados, pero la casilla formal de `specs/tasks.md` sigue abierta.
- [ ] **T-17..T-21:** infraestructura y entrega; ver I-08.

---

## 5. Qué no se debe reimplementar

- No crear otra política adaptativa backend: `adaptive-v1` ya existe y está probada. El trabajo pendiente es UI y aceptación.
- No crear otro gestor `/v1/jobs`: rutas, cola, token, idempotencia, cancelación, manifiesto y cliente ya existen. Falta conectar la pantalla y P-04.
- No reescribir el protocolo T-22 ni cambiar semillas para obtener un resultado favorable.
- No duplicar validación, SEIR, métricas, agregados, costos o decisiones en el frontend.
- No presentar fixtures de `frontend/src/pro/` como resultados reales.
- No afirmar que P-02/P-03 están cerrados: P-02 tiene backend y UI locales verificados, pero la aceptación humana integral (T-13..T-16) y AWS siguen pendientes; P-03 tiene backend y cliente, pero le falta la pantalla y P-04.

---

## 6. Riesgos y trampas vigentes

- **T-22 no está aprobado.** Los controles pasan, pero la matriz primaria y los contrastes no se ejecutaron. `base-root-0` no representa el gate.
- **El benchmark de 44,3 s no es el costo de T-22.** Exportar, validar, comprimir y reproducir un JSON grande tarda minutos; presupuestar decenas de minutos.
- **La pantalla PRO sigue con fixtures.** `ProWorkspace` todavía rotula `/v1/jobs` como “Pendiente” y el backend como “No iniciado”; esos rótulos deben corregirse al conectar la API.
- **El gestor P-03 es local y no durable.** Reiniciar pierde trabajos; no es evidencia de AWS ni de miles de réplicas.
- **El Budget no está operativo.** 0/2 destinatarios verificados; una alerta no detiene el gasto.
- **No hay URL pública ni AWS desplegado.** `infra/` está vacío.
- **La semilla del jurado es externa y sigue pendiente.** No agregarla retrospectivamente a las 150 unidades primarias.
- **La aceptación humana no se mide con el tiempo del script.** CA-12 y RNF-05/06 requieren una persona y acceso.
- **El mapa no es evidencia epidemiológica.** OSM y posiciones sintéticas no prueban riesgo ni movilidad real.

---

## 7. Orden recomendado

1. Commit y push de esta documentación y del runner T-22.
2. Cerrar T-22: primaria, contrastes, reproducciones, informe y gate.
3. Repetir en UI los escenarios de saldo agotado y sin elegibles de P-02; el resto de I-02 ya está verificado localmente.
4. Conectar P-03 UI y cerrar la aceptación local de jobs.
5. P-05 y P-06 con datos reales y validación fuera de muestra.
6. P-08 desde un experimento validado.
7. P-07 con aceptación de sincronización, accesibilidad y rendimiento.
8. P-04/T-17..T-21 solo con autorización de gasto.
9. I-09: E2E, semilla externa, tiempos humanos, costos, arquitectura y pitch.
