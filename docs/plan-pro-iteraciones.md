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
| Base local | 324 pruebas backend y 111 frontend; Ruff, mypy, typecheck y build correctos. |
| Motor por defecto | `N=1000`, `T=90`, `R=30`, semilla `20261026`; `none=723,7`, `random=575,1`, `targeted=378,1`; ganancia pareada `196,97` con IC bootstrap `81,62–309,59`; 22 victorias, 6 empates y 2 derrotas frente a random. |
| Rendimiento | **377,9 s** para el escenario por defecto sin frames, frente a objetivos de ~25 s backend y ~60 s total. |
| Gate científico | Protocolo T-22 congelado, pero **no ejecutado**. |
| P-01 | Verificado localmente: calendario de llegadas, inventario, costos y exportación. |
| P-09 | Verificado localmente como presentación: mapa OSM, polígonos y posiciones deterministas. |
| PRO-1/2 | Parcial: vacunas, cierre y brigadas con presupuesto y costos educativos; falta cerrar aceptación integral. |
| P-02 | Parcial: solo las brigadas recalculan destinatarios; faltan reglas generales, motivos y observabilidad. |
| P-03/P-04 | No iniciados: no hay jobs, manifiestos, progreso, cancelación ni Distributed Map. |
| P-05/P-06 | No iniciados: no hay dataset real importado ni calibración. |
| P-07 | Parcial: reproducción y mapa funcionan; faltan aceptación de sincronización, rendimiento y accesibilidad. |
| P-08 | No iniciado: no hay informe PDF determinista. |
| AWS | No desplegado; `infra/` vacío. Se deja para la última fase. |

Evidencia de partida: [auditoría PRO 2026-10-27](evidencia/auditoria-pro-2026-10-27.md).

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

**Problema:** el escenario por defecto tarda 377,9 s; el objetivo es ≤25 s backend y ≤60 s total. El gate científico no está ejecutado.

**Estado 2026-10-27:** motor vectorizado y benchmark reproducible en **44,3 s** (8,5× menos), con hashes idénticos a la versión anterior. Objetivo local de ≤60 s cumplido; objetivo de ≤25 s backend aún no. T-22 pendiente. Evidencia: [I-01 rendimiento](evidencia/i01-rendimiento.md).

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

### I-06 — P-08: informe para el alcalde

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
| I-02 | Pendiente | — | — |
| I-03 | Pendiente | — | — |
| I-04 | Pendiente | — | — |
| I-05 | Pendiente | — | — |
| I-06 | Pendiente | — | — |
| I-07 | Pendiente | — | — |
| I-08 | Pendiente | — | — |
| I-09 | Pendiente | — | — |
