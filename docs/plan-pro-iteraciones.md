# Plan de iteraciones PRO

**Fecha de apertura:** 2026-10-27.
**Rama de integración:** `feat/pro`.
**Objetivo:** cerrar las capacidades PRO y los entregables pendientes con iteraciones pequeñas, verificables y documentadas. AWS se aborda al final, después de estabilizar el producto local.
**Documento de referencia:** [hoja de ruta PRO](../specs/pro-roadmap.md), [tareas](../specs/tasks.md) y [acuerdos técnicos](../specs/agreements.md).

## 1. Regla de trabajo

Cada iteración agrega **una capacidad o un habilitador concreto**, no un conjunto de cambios heterogéneos. El orden es obligatorio salvo que una dependencia demuestre lo contrario y se registre la decisión.

Por cada iteración:

1. Leer la ficha de la capacidad y escribir o ajustar la aceptación antes de implementar.
2. Escribir primero las pruebas que fallen; después la implementación mínima y el refactor.
3. Ejecutar backend, frontend, lint, tipos y build cuando corresponda.
4. Registrar comandos, resultados, límites y evidencia en `docs/evidencia/`.
5. Actualizar esta bitácora y las casillas de `specs/tasks.md` o `specs/pro-roadmap.md` solo si la aceptación está cubierta.
6. Hacer **un commit pequeño y coherente** con referencia a la iteración y a RF/CA.
7. Hacer push al remoto al terminar la iteración, aunque el resultado sea parcial; si es parcial, decirlo en el mensaje y en la evidencia.
8. No declarar una capacidad terminada por tener código, mock o una spec: se exige evidencia ejecutada.

No se mezclan features, correcciones de rendimiento y despliegue en el mismo commit. Las correcciones urgentes de una iteración anterior se registran como `fix(...)` y quedan enlazadas a la causa.

## 2. Estado de partida

| Área | Estado comprobable |
|---|---|
| Base local | 356 pruebas backend y 116 frontend; Ruff, mypy, typecheck y build correctos. |
| Motor por defecto | `N=1000`, `T=90`, `R=30`, semilla `20261026`; `none=723,7`, `random=575,1`, `targeted=378,1`; ganancia pareada `196,97` con IC bootstrap `81,62–309,59`; 22 victorias, 6 empates y 2 derrotas frente a random. |
| Rendimiento | **44,3 s** para el escenario por defecto sin frames, frente a objetivos de ~25 s backend y ~60 s total. |
| Gate científico | **T-22 APROBADO**: 15 experimentos, 450 pares, 17 reproducciones; [informe](evidencia/t22-v1-ejecucion.md). Aceptación integral pendiente. |
| P-01 | Verificado localmente: calendario de llegadas, inventario, costos y exportación. |
| P-09 | Verificado localmente como presentación: mapa OSM, polígonos y posiciones deterministas. |
| PRO-1/2 | Parcial: vacunas, cierre y brigadas con presupuesto y costos educativos; falta cerrar aceptación integral. |
| P-02 | Backend, cliente y UI verificados localmente: `adaptive-v1`, reglas, anillo, motivos, editor, historial diario, exportación y reproducción. Falta aceptación humana integral (T-13..T-16). |
| P-03 | Backend, cliente y pantalla PRO verificados localmente: `/v1/jobs`, cola, progreso, cancelación, idempotencia, sondeo e historial. Queda P-04 en AWS. |
| P-04 | No iniciado: Distributed Map, S3, cuotas/costos y evidencia AWS. |
| P-05/P-06 | Cerrados en local: serie real `manabi-dengue-weekly-v1` (94 semanas) y preset calibrado `manabi-dengue-2025-v1` con resultado desfavorable (`fitted-not-validated`). |
| P-07 | Backend verificado y UI integrada por el merge de `feat/pro`: sincronización red/mapa, `step-back`, atajos y movimiento reducido. Falta aceptación en navegador posterior al merge, rendimiento visual y evaluación táctil. [Evidencia UI](evidencia/p07-mapa-animacion-2026-10-28.md). |
| P-08 | Verificado localmente en modo ficticio: PDF determinista, API/CLI y descarga; el merge añade HTML imprimible y CLI. T-22 independiente. [Evidencia](evidencia/p08-informe-2026-10-27.md). |
| AWS | No desplegado; `infra/` vacío. Se deja para la última fase. |

Evidencia de partida: [auditoría PRO 2026-10-27](evidencia/auditoria-pro-2026-10-27.md). Resolución y verificación del merge de `feat/pro`: [merge-feat-pro-2026-10-28](evidencia/merge-feat-pro-2026-10-28.md).

## 3. Orden de iteraciones

| Iteración | Capacidad | Por qué ahora | Depende de |
|---|---|---|---|
| I-00 | Plan, auditoría y estado real | Deja contexto uniforme para agentes y evita decisiones contradictorias. | — |
| I-01 | Rendimiento base y T-22 | Sin esto, P-03/P-04 y el Brote Sorpresa son frágiles; además fija el gate científico de la base. | I-00 |
| I-02 | P-02: decisiones adaptativas | Es el corazón del valor PRO y no necesita AWS. | I-01 |
| I-03 | P-05: datos reales de dengue en Manabí | Debe existir una fuente trazable antes de calibrar. | I-02 |
| I-04 | P-03: jobs Monte Carlo locales | Permite lotes reproducibles y acelera calibración sin AWS. | I-01, I-03 |
| I-05 | P-06: calibración y preset | Cierra el valor científico con validación fuera de muestra. | I-03, I-04 |
| I-06 | P-08: informe para el alcalde | Convierte resultados y costos en un entregable usable. | I-05 |
| I-07 | P-07: cierre de mapa/animación | Pule la experiencia sobre P-09 sin tocar el modelo. | I-06 |
| I-08 | P-04: AWS, Distributed Map y despliegue | Última fase, según decisión del usuario. | I-04, I-07 |
| I-09 | Cierre integral | T-22 final, E2E, costos, Budget, arquitectura, URL y pitch. | I-08 |

### Criterio de salida

No se pasa a I-08 mientras exista una brecha funcional en P-02, P-03, P-05, P-06 o P-08. P-07 puede cerrarse en paralelo si no bloquea el informe. AWS no se usa como excusa para posponer pruebas locales.

## 4. Detalle y aceptación

### I-00 — Plan, auditoría y contexto

- [x] Crear este plan y la auditoría de partida.
- [x] Corregir el estado documental que afirmaba que PRO no había iniciado.
- [x] Fijar rama de integración, protocolo de commits y evidencia.
- [x] Enlazar el plan desde el README.
- [x] Commit y push de la documentación.

**Salida:** cualquier agente puede leer este documento y saber qué sigue, qué está prohibido declarar y dónde dejar evidencia.

### I-01 — Rendimiento base y gate T-22

**Actualización local Windows 2026-10-27:** [carga/exportación optimizadas con equivalencia](evidencia/rendimiento-validacion-2026-10-27.md): carga 32,75–44,36 s → 6,05–6,17 s, reexportación 18,18–21,51 s → 12,14–13,28 s en un JSON N1000/T90/R2. Motor R30 controlado antes/después 13,603/13,796 s, mismos resultados; la referencia de 44,3 s inferior corresponde a Linux y se conserva como histórica. El objetivo ≤25 s se observó en esta corrida Windows del motor, sin certificar p95/HTTP total/AWS. T-22 científico ya está aprobado; I-01 conserva el objetivo de rendimiento consistente; staging se verifica en la fase AWS.

**Problema:** el escenario por defecto tarda 377,9 s; el objetivo es ≤25 s backend y ≤60 s total. El componente científico se ejecutó y aprobó; ver actualización T-22.

**Estado 2026-10-27:** motor vectorizado y benchmark reproducible en **44,3 s** (8,5× menos), con hashes idénticos a la versión anterior. Objetivo local de ≤60 s cumplido; objetivo de ≤25 s backend aún no. T-22: **APROBADO**, 15 experimentos completos, controles 5/5 y 17 reproducciones. Evidencia: [I-01 rendimiento](evidencia/i01-rendimiento.md) y [protocolo T-22](../specs/validation/t22-v1/README.md).

**Alcance:**

- Medir y registrar un benchmark reproducible antes/después.
- Optimizar el recorrido de aristas y la progresión SEIR sin cambiar semillas, orden de consumo de números aleatorios, contratos ni hashes para la misma versión del modelo.
- Mantener una ruta de referencia lenta para comparar resultados.
- Ejecutar T-22 v1 completo y registrar exportaciones, ganancias, empates y pérdidas.
- Actualizar la estimación de duración y el límite práctico del endpoint síncrono.

**Aceptación:**

- Benchmark documentado con comando, entorno y resultado antes/después.
- Misma salida numérica y mismos hashes para las fixtures existentes; si se cambia la versión del modelo, se versiona y se explica.
- Escenario por defecto ≤60 s total en local, con objetivo de ≤25 s backend; si no se alcanza, se registra el límite real y se rediseña la ejecución antes de P-04.
- T-22 ejecutado; el resultado se reporta aunque el gate falle.
- Pruebas backend completas y evidencia actualizada.

**Riesgo:** una vectorización agresiva puede alterar el orden de los sorteos. La prioridad es preservar reproducibilidad, no solo velocidad.

### I-02 — P-02: decisiones adaptativas al brote

**Problema:** las brigadas ya se recalculan, pero vacunas y cierres siguen calendarios fijos. No hay una política adaptativa explícita, versionada ni observable.

**Estado 2026-10-27:** cerrada localmente. Backend y contrato cliente verificados (`adaptive-v1`, decisiones, motivos, exportación y reproducción) **y UI verificada con el motor real**: editor de la variante, etiqueta «Dirigida · adaptativa v1», historial diario con cierre solicitado/ejecutado, brigadas atendidas, anillo y omisiones. Evidencia: [p02-ui-2026-10-27](evidencia/p02-ui-2026-10-27.md). Queda fuera de I-02 la aceptación humana integral de T-13..T-16.

**Alcance:**

- Definir una estrategia nueva y versionada, por ejemplo `adaptive-v1`; no redefinir silenciosamente `targeted`.
- Reglas explicables por día o por intervalo, basadas solo en estados observados, nuevos casos, contactos activos y saldo.
- Umbrales, prioridades, desempates y límites por tipo de intervención.
- Registro de decisión: día, entradas observadas, acción, motivo, puntuación, recursos, costo y acciones omitidas.
- Comparación pareada contra `none` y `random` con recursos equivalentes.
- Exportación de decisiones y documentación de que observar estados completos es un supuesto educativo.

**Aceptación:**

- Brote ascendente y descendente; saldo agotado; ausencia de elegibles; cambio de prioridad; reglas estables.
- Ninguna lectura de eventos futuros, uniformes futuros ni resultados de otras políticas.
- Independencia del orden de políticas y de semillas por dominio.
- La comparación no mejora por dar más recursos a la política adaptativa.
- Pruebas de contrato, UI y exportación; evidencia con una corrida real.
- Cierre documental de PRO-1/2: costos, presupuesto, no doble cobro y límites visibles.

### I-03 — P-05: datos reales de dengue en Manabí

**Problema:** no hay dataset real trazable; usar cifras inventadas invalidaría la calibración.

**Estado 2026-10-27:** cerrada en local. Dataset `manabi-dengue-weekly-v1` con 94 semanas (2025 S1–53, 2026 S1–41) desde las gacetas ETV SE 53/2025 y SE 41/2026 del MSP. Importador con `download`/`extract`/`build`/`verify`/`render`, geometría versionada, procedencia completa y controles de totales: directo en 2026 (11 946) e indirecto por tasas en 2025 (6 313). Evidencia en [p05-dengue-manabi-2026-10-27.md](https://github.com/Freddys21333/proxyendpoint-Noche-Cero/blob/9a1391d00d396a6d6662c4ec09a85fbe6df7767f/docs/evidencia/p05-dengue-manabi-2026-10-27.md) y pruebas en [plan-pruebas-local.md](plan-pruebas-local.md). Límites declarados: granularidad provincial (sin Manta), datos preliminares y 2026 incompleto. No alimenta el motor SEIR. **P-06 sigue pendiente**: que la serie exista no equivale a una calibración validada.

**Alcance:**

- Seleccionar publicaciones oficiales del MSP (gacetas vectoriales) con datos utilizables de Manabí.
- Registrar URL, edición, fecha, corte, período, licencia/condiciones, hash y copia permitida.
- Extraer y normalizar geografía, semana/fecha, casos, definición y unidad; revisar visualmente la extracción.
- Distinguir incidencia de acumulados, ceros de ausencias, correcciones y duplicados.
- Documentar límites si no hay granularidad de Manta.
- Añadir controles de totales, faltantes y procedencia.

**Aceptación:**

- Descarga/extracción repetible y verificable.
- Tabla normalizada con procedencia completa.
- Totales y faltantes controlados; no se suman acumulados de semanas sucesivas.
- Si no hay serie suficiente, se deja P-06 pendiente en vez de inventar datos.
- Los datos reales no se mezclan con las posiciones OSM ni con los casos sintéticos.

### I-04 — P-03: jobs Monte Carlo locales

**Problema:** el endpoint síncrono no sirve para lotes grandes ni para calibración; no hay manifiesto, progreso, cancelación ni idempotencia.

**Estado 2026-10-27:** cerrada localmente. Backend y cliente verificados (cuatro rutas, cola, token, idempotencia, cancelación y resultado reproducible) **y pantalla PRO conectada a la API real**: creación con el escenario previsualizado, límites publicados, credenciales en `sessionStorage`, sondeo, progreso real, cancelación, reintento, resultado solo con agregado completo e historial de la sesión. Evidencia: [p03-ui-2026-10-27](evidencia/p03-ui-2026-10-27.md) y [plan de pruebas local](plan-pruebas-local.md). P-04 (AWS, miles de réplicas) sigue fuera de I-04.

**Alcance:**

- Contrato `/v1/jobs` para crear, consultar, cancelar y recoger resultados.
- Manifiesto con lista de índices y semillas fijadas antes de ejecutar.
- Cada réplica procesa las políticas pareadas del experimento acordado.
- Estado, progreso, errores y cancelación trazables.
- Almacenamiento local reproducible; sin AWS todavía.
- Cliente frontend para lanzar y seguir un job, sin presentar resultados parciales como recomendación final.

**Aceptación:**

- Lotes en distinto orden producen el mismo agregado.
- Reintentos no duplican réplicas.
- Solo un agregado completo habilita la recomendación.
- La reproducción coincide con la ejecución secuencial.
- Errores y cancelación no dejan resultados parciales presentados como completos.
- Pruebas de contrato y de integración local.

### I-05 — P-06: calibración y preset versionado

**Problema:** importar datos no es calibrar. Falta una variable observada, un método, validación fuera de muestra e incertidumbre.

**Alcance:**

- Definir variable observada y función de observación; escala diaria/semanal y notificación.
- Separar ajuste y validación antes de mirar el resultado.
- Estimar parámetros con restricciones y documentar identificabilidad.
- Publicar dataset, preset, modelo y semillas versionados.
- Comparar con una referencia sencilla y conservar resultados desfavorables.
- Mantener el modo ficticio independiente.

**Aceptación:**

- Otro proceso reproduce el ajuste y la evaluación retenida.
- Métricas de ajuste y predicción, incertidumbre y limitaciones documentadas.
- No se selecciona una semilla por parecerse a la curva observada.
- No se etiqueta como calibrado si solo hay datos importados.
- El preset calibrado se puede cargar desde la UI sin romper el modo ficticio.

**Estado 2026-10-27:** cerrada localmente con **resultado desfavorable publicado**. `manabi-dengue-2025-v1` (`status: fitted-not-validated`) ajusta el SEIR de mezcla homogénea a P-05 con ventanas fijadas antes de mirar resultados (2025 S1–S35/S36–S53; 2026 S1–S27/S28–S41), bootstrap determinista de 120 réplicas, perfil de verosimilitud que reoptimiza solo `ρ` y puente declarado al motor (`β_motor = R₀·γ/w̄`). La validación pierde frente a persistencia en los dos años (MAE 29,53 vs 14,22 y 268,62 vs 48,86) y el intervalo predictivo no cubre la onda retenida; `N` y `ρ` siguen confundidos y la ventana de 371 días no cabe en el motor. El panel de la UI muestra la etiqueta, las cifras y los 9 límites, y permite volver al modo ficticio. Evidencia: [p06-dengue-manabi-2026-10-27](https://github.com/Freddys21333/proxyendpoint-Noche-Cero/blob/9a1391d00d396a6d6662c4ec09a85fbe6df7767f/docs/evidencia/p06-dengue-manabi-2026-10-27.md) y [plan de pruebas local](plan-pruebas-local.md).

### I-06 — P-08: informe para el alcalde

**Estado 2026-10-27:** verificado localmente por solicitud explícita del usuario. [Contrato](../specs/p08-report.md) y [evidencia](evidencia/p08-informe-2026-10-27.md). Se usa experimento ficticio completo con integridad comprobada; este incremento no cierra el gate científico T-22 ni la aceptación humana integral. PDF/API/CLI y descarga desde comparación y trabajos completos disponibles.

**Problema:** los resultados existen, pero no hay un documento sencillo, determinista y trazable para una autoridad.

**Alcance:**

- Plantilla determinista con problema, escenario, recursos, estrategias, comparación, incertidumbre, gasto/saldo, recomendación y límites.
- Fuentes reales cuando existan; configuración, semilla, versiones y hash del experimento.
- Lenguaje sencillo; explicar contagios evitados, una réplica frente al promedio y empates/pérdidas.
- Gráficos y tablas sin recortes; PDF legible y reproducible.
- Separar costos de intervención y costos AWS.

**Aceptación:**

- Las cifras coinciden con el JSON del experimento.
- No se fabrican resultados faltantes.
- Se conservan empates y pérdidas; no se promete ganador por semilla.
- PDF revisado visualmente y generado desde un comando documentado.
- Si el experimento es ficticio, el informe lo declara de forma visible.

### I-07 — P-07: cierre de mapa y animación

**Avance backend 2026-10-27:** por solicitud explícita se verifica [integridad temporal](../specs/p07-backend-playback.md) sin cambiar el motor ni esperar al gate científico. [Evidencia](evidencia/p07-backend-2026-10-27.md): 418 pruebas backend y contratos HTTP reales pasan.

**Avance UI 2026-10-28 (merge de `feat/pro`):** la interfaz de reproducción quedó integrada con navegación bidireccional (`step-back`), atajos de teclado y movimiento reducido, con [evidencia UI](evidencia/p07-mapa-animacion-2026-10-28.md) y pruebas automatizadas en `lib/simulation-playback.test.ts`. I-07 sigue abierto por la aceptación en navegador posterior al merge, el rendimiento visual y la evaluación táctil/móvil; T-22 conserva su estado independiente.

**Problema:** la reproducción y P-09 funcionan, pero falta aceptar sincronización, rendimiento, accesibilidad y transiciones.

**Alcance:**

- Mapa y red sincronizados con día, política y réplica; conservar cámara, selección y conteos.
- Pausa, seek, velocidad y reinicio sin divergencias.
- Bloqueo de entradas obsoletas.
- Movimiento reducido y animación decorativa desactivable.
- Evaluación de rendimiento y accesibilidad.
- No inventar trayectos, contagios ni desplazamientos.

**Aceptación:**

- Sin divergencias entre mapa, red, curva y tabla.
- Frames coherentes con hash, configuración, réplica y fila diaria.
- Rendimiento aceptable en escenarios nuevos.
- Accesibilidad y preferencia de movimiento reducido verificadas.
- La animación no altera RNG, hashes ni resultados.

### I-08 — P-04: AWS, Distributed Map y despliegue

**Problema:** no hay nada desplegado ni ejecución distribuida; los lotes grandes son inviables en local.

**Alcance:**

- Terraform para API, Lambdas, S3, Step Functions Standard + Distributed Map, Amplify/CloudFront, IAM mínimo, CORS, logs y alarmas.
- Manifiestos y resultados por referencia; no meter grafos completos en el estado.
- Idempotencia, cuotas, concurrencia y límites de gasto.
- Prueba pequeña, luego 100 y al menos 1.000 réplicas.
- Registro de región, duración, memoria, concurrencia, integridad y costo.
- URL pública y smoke desde sesión limpia.

**Aceptación:**

- `terraform fmt -check`, `terraform validate` y revisión del plan.
- Sin secretos y con roles mínimos.
- 1.000 réplicas con evidencia de integridad y costo.
- No se ejecutan 10.000 réplicas sin presupuesto y autorización.
- La URL pública funciona con una semilla nueva.
- El Brote Sorpresa se completa en menos de 5 minutos.

### I-09 — Cierre integral

- T-22 final sobre la versión entregada y reporte de resultados.
- Suite E2E de navegador: éxito, empate, pérdida, error y respuesta obsoleta.
- Prueba cronometrada con semilla externa y Brote Sorpresa.
- `docs/arquitectura.svg` y fuente editable.
- `docs/costos.md` con tarifas, fórmula, estimación mensual y gasto real.
- Budget con destinatarios verificados y evidencia.
- README con despliegue, pruebas, decisiones, limitaciones y comandos.
- Pitch PDF/PPT ≤20 MB y ensayo de 5 minutos.
- Revisión final de secretos, accesibilidad, reproducibilidad y enlaces.

## 5. Definición de terminado

Una capacidad solo se marca `[x]` cuando:

- su aceptación está escrita y cubierta;
- las pruebas nuevas y las existentes pasan;
- lint, tipos y build pasan cuando aplique;
- hay evidencia ejecutada, no solo mocks;
- la documentación y la bitácora están actualizadas;
- no se introdujeron secretos ni datos personales;
- el commit y el push existen;
- las limitaciones y los resultados desfavorables están visibles.

## 6. Protocolo Git

- Rama de integración: `feat/pro`.
- Si se paraleliza el trabajo, cada agente crea una rama corta desde `feat/pro` y la integra con revisión; no se comparte la misma rama de implementación.
- Mensajes: `feat(pro-p02): reglas adaptativas y registro de decisiones (P-02/RF-...)`.
- Documentación: `docs(pro): ...`.
- Corrección: `fix(pro-p02): ...`.
- Un commit por avance coherente; no se hace squash de features distintas.
- Push después de cada iteración verde o parcial documentada.
- Al cierre, `feat/pro` se fusiona a `main` y se despliega desde el commit fusionado.

## 7. Contexto para otros agentes

Antes de tocar código, leer en este orden:

1. `AGENTS.md`.
2. `specs/agreements.md`.
3. `specs/pro-roadmap.md` y la ficha de la capacidad.
4. `docs/plan-pro-iteraciones.md` (este documento).
5. `docs/evidencia/` de la iteración anterior.

Reglas heredadas que no se pueden romper:

- No cambiar hashes ni semillas silenciosamente.
- No presentar mocks, fixtures o números inventados como resultados reales.
- No afirmar despliegue, calibración o gate científico sin evidencia.
- No mezclar datos OSM con datos epidemiológicos.
- No dar más recursos a la política propuesta que a las líneas base.
- No leer eventos futuros.
- No agregar secretos al repositorio.
- No declarar terminado lo que solo está planificado.

## 8. Bitácora

| Iteración | Estado | Commit | Evidencia |
|---|---|---|---|
| I-00 | Completada | `git log --grep=I-00` | `docs/evidencia/auditoria-pro-2026-10-27.md` |
| I-01 | En progreso: rendimiento listo, T-22 pendiente | `git log --grep=I-01` | `docs/evidencia/i01-rendimiento.md` |
| I-02 | Completada localmente: backend, cliente y UI con motor real | `git log --grep=pro-p02` | `docs/evidencia/p02-ui-2026-10-27.md` |
| I-03 | Completada localmente: dataset real y verificado | `git log --grep=pro-p05` | `docs/evidencia/p05-dengue-manabi-2026-10-27.md` |
| I-04 | Completada localmente: backend, cliente y UI con API real | `git log --grep=pro-p03` | `docs/evidencia/p03-ui-2026-10-27.md` |
| I-05 | Completada localmente: preset `fitted-not-validated`, validación desfavorable publicada | `git log --grep=pro-p06` | `docs/evidencia/p06-dengue-manabi-2026-10-27.md` |
| I-06 | Verificado localmente, informe ficticio reproducible | `git log --grep=pro-p08` | `docs/evidencia/p08-informe-2026-10-27.md` |
| I-07 | Pendiente | — | — |
| I-08 | Pendiente | — | — |
| I-09 | Pendiente | — | — |

**Nota post-merge (2026-10-27):** `5861407` integró P-02/P-03 backend y cliente. La verificación posterior dio 356 pruebas backend, 116 frontend y hashes base preservados; el detalle y todo lo pendiente están en [estado post-merge](evidencia/estado-post-merge-2026-10-27.md).

Actualización I-01 (2026-10-27): [benchmark HTTP completo](evidencia/api-performance-2026-10-27.md), sin frames mediana 24,35 s, con frames 33,41 s (n=3). El objetivo consistente de 25 s permanece abierto; T-22 científico ya está completo y aprobado.

Actualización T-22 (2026-10-27): [matriz completa y gate científico APROBADO](evidencia/t22-v1-ejecucion.md). No modifica protocolo ni motor, no cierra rendimiento, T-23, UI ni AWS. Frente a random: 112/33/5 victorias/empates/pérdidas; mercado redundante y censura explícitos.

Actualización I-01 (2026-10-28): [rendimiento HTTP y salidas](evidencia/rendimiento-backend-2026-10-28.md). Las seis comparaciones finales observadas cumplen <25 s, con medianas 18,46/19,56 s sin/con frames; PDF, ZIP y tres jobs bajo carga local verificados. 510 pruebas y hashes conservados. Aceptación de staging/p95 y carga general siguen pendientes; no se cierra I-08 ni entrega integral.

## Prioridad operativa ajustada por el usuario (2026-10-28)

Se adopta local → UX → AWS por partes. La primera etapa se verificó en el [incremento de estabilidad local](evidencia/estabilidad-local-2026-10-28.md): 510 pruebas backend, 151 frontend y recorrido real. No se exige una calibración nueva ni la prueba formal del jurado para seguir mejorando localmente. Las tareas formales y gates de despliegue siguen explícitos; esta decisión no declara completa aceptación humana/T-23 ni autoriza recursos AWS. Próximo frente: mejoras UX concretas sobre la versión local utilizable.
