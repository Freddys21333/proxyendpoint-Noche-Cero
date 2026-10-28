# Hoja de ruta PRO y decisiones de modelo

Estado documental: **borrador de implementación**, actualizado el 2026-10-27 a petición del usuario. Esta revisión registra alcance y pendientes; no implementa nuevos comportamientos, ejecuta lotes AWS ni declara calibración real disponible. Los pendientes base T-17..T-23 conservan su estado. P-09 quedó registrado y verificado localmente como presentación en esta fecha.

Para repartir el trabajo en paralelo entre lógica backend y experiencia frontend, consultar la [división de frentes PRO](pro-workstreams.md). El orden acordado, la aceptación por iteración y el protocolo de commits están en el [plan de iteraciones PRO](../docs/plan-pro-iteraciones.md). Esta guía complementa las tareas de abajo; no cambia su alcance ni sus estados.

## 1. Correspondencia y estado actual

| Capacidad solicitada | Referencia previa | Estado comprobable y pendiente |
|---|---|---|
| Intervenciones combinadas, costos y presupuesto | PRD §4.2 PRO-1/2; TRD §6.3 | Incremento educativo funcional: vacunas, cierre de una capa y brigadas, saldo diario y exportación. No equivale a completar todo PRO-2. Véase [semántica vigente](../docs/intervenciones-combinadas.md). |
| Recursos que llegan por días | PRO-2; TRD §6.3 | **Verificado localmente**: P-01 incorpora calendario opcional de reposición, acumulación, capacidad diaria y registro/exportación de inventario. [Contrato](p01-resource-schedule.md). |
| Decisiones que cambian según el brote | PRO-3; TRD §6.3 | **Backend verificado localmente**: variante adaptativa versionada con cierres por umbral, pausa de brigadas y prioridad de anillo; registros/exportación y cliente compatibles. Pendiente editor e historial visual frontend. [Contrato P-02](p02-adaptive-policy.md). |
| Miles de simulaciones Monte Carlo en AWS | PRO-4; TRD §2.3, §9.3, §14.2 | **P-03 verificado localmente**: trabajos 2..100 con cola limitada, progreso, cancelación, capacidades e idempotencia; pantalla PRO conectada a la API real con credenciales de sesión, sondeo, cancelación y resultado solo al completar. La comparación síncrona conserva 2..30. Distributed Map y miles en AWS siguen pendientes P-04. [Evidencia UI](../docs/evidencia/p03-ui-2026-10-27.md). |
| Calibración con datos reales, dengue en Manabí como candidato prioritario | PRO-5; PRD §3; TRD §4 | **No iniciado**: se exige incorporar datos reales trazables; no se sustituirán por cifras inventadas. Fuente, período y modelo aún por seleccionar y validar. P-05/06. |
| Mapa animado del avance | PRO-6 | **En progreso**: ya hay mapa/red, estados SEIR por día, reproducción, pausa, velocidad y estrategia de una réplica real. Falta pulir las transiciones y aceptar la visualización con escenarios nuevos. Animación adicional si alcanza el tiempo. P-07. |
| Informe sencillo para el alcalde | PRO-7 | **Verificado localmente** en modo ficticio: PDF determinista, API/CLI y descarga en comparación/trabajos; integridad del experimento comprobada, sin cerrar T-22. [P-08](p08-report.md). |
| Mapa geográfico de referencia | PRO-6 (presentación) | **Verificado localmente como presentación**: mapa OSM de Manta, trece polígonos residenciales versionados, posiciones deterministas y sincronización con la reproducción. No es dato epidemiológico ni altera el modelo. P-09. |

No se confunden posiciones OSM con observaciones epidemiológicas reales, ni los costos educativos de intervenciones con tarifas verificadas o gasto AWS.

## 2. Ficha obligatoria antes de cada escenario nuevo

Cada escenario declara y versiona: enfermedad real de inspiración o plaga inventada; mecanismo y unidad de transmisión; período expuesto/incubación y contagioso; probabilidades frente a duraciones y escala temporal; significado de recuperación, inmunidad, conversión y muerte; población, período y geografía; intervenciones compatibles, recursos, costos y efectos; estrategia y datos que puede observar; fuentes frente a supuestos; límites y pruebas.

La base vigente sigue siendo plaga ficticia SEIR por contacto. E no contagia, I contagia y R significa recuperado o inmunizado; no existe estado de muerte. No se reinterpretan R como fallecidos ni E como infeccioso. Añadir mortalidad, reinfección, vectores, movilidad u hospitalización exige otro modelo versionado, contratos y pruebas propios. Influenza, sarampión, COVID, cólera y enfermedad inventada quedan como alternativas de inspiración, no como cinco modelos comprometidos.

Para dengue, la OMS identifica la transmisión mediante mosquitos infectados: [ficha oficial](https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue). Antes de llamarlo modelo calibrado de dengue se debe elegir y justificar una extensión vectorial o una aproximación agregada explícita, y comprobar que explica la variable observada. Ajustar beta/sigma/gamma del grafo humano sin esa revisión no basta. Las brigadas actuales son reducción educativa de contactos de personas atendidas, no una simulación entomológica validada.

## 3. Pendientes ejecutables y aceptación

### P-01 — Calendario de llegadas e inventario (PRO-2)

- [x] Estado: **verificado localmente**. Dependencia: contrato combinado vigente. Implementación, decisiones cerradas y evidencia: [P-01](p01-resource-schedule.md).
- Definir esquema de entregas por día, tipo y cantidad, con inventario inicial y recursos consumibles frente a capacidad diaria. Distinguir dosis recibidas, atenciones disponibles y financiación; una entrega no aumenta automáticamente el presupuesto.
- Propuesta a cerrar en contrato: recepción al inicio del día, antes de decidir; acumular remanentes no perecederos. Definir explícitamente cancelación de entregas, caducidad si aplica y si las compras descuentan al recibir o al usar. Evitar pagar dos veces una dosis.
- Exportar inventario inicial, llegadas, consumo y saldo por recurso/día/réplica/política; límites de coste e inventario son simultáneos. Ninguna estrategia usa recursos antes de su llegada.
- Aceptación: conservación exacta; cero entregas; varios envíos el mismo día; día 0 y T; rechazo de negativos/días fuera de horizonte; ninguna reserva o gasto futuro oculto; reproducción con misma semilla; comparación con el mismo calendario y presupuesto. La omisión conserva los hashes del modo anterior.

### P-02 — Política adaptativa observable (PRO-3)

- [x] Estado: **backend, contrato cliente y UI verificados localmente**. Dependencia: P-01 y decisiones de modelo compatibles.
- Formalizar reglas para reasignar dosis, brigadas y cierres según S/E/I/R observados, nuevos casos, contactos activos y saldo. Especificar frecuencia, umbrales y desempates; la primera versión puede ser una heurística voraz explicable.
- Mantener las estrategias actuales identificadas. Si la nueva regla cambia su significado, añadir nombre/versionado, no sustituir silenciosamente `targeted`. Comparar sin intervención, azar con recursos equivalentes y política propuesta; aclarar cuándo una regla observa estados completos como supuesto educativo.
- Exportar entradas observadas, acción, motivo, puntuación, recursos/costo y acciones omitidas por límites. No leer eventos futuros, futuros uniformes ni resultados de otras políticas.
- Aceptación: brote ascendente/descendente, saldo agotado, ausencia de elegibles, cambios de prioridad, reglas estables y límites. Verificar independencia del orden de políticas y semillas por dominio. Recalcular solo brigadas diariamente no cierra esta tarea.
- **Verificado 2026-10-27 (backend):** contrato de registros y anillo, conservación, exportación/reproducción, independencia de orden y cliente HTTP. Alcance exacto y límites en [P-02](p02-adaptive-policy.md); resultados en [evidencia](../docs/evidencia/p02-adaptive.md).
- **Verificado 2026-10-27 (UI):** editor de la variante con umbrales validados, etiqueta de variante en comparación/vacunación, historial diario de la réplica representativa con acciones ejecutadas y omitidas, y barrido real de motivos etiquetados. Evidencia y límites en [p02-ui-2026-10-27](../docs/evidencia/p02-ui-2026-10-27.md); la aceptación humana integral sigue en T-13..T-16.

### P-03 — Contratos y ejecución local de trabajos Monte Carlo (PRO-4)

- [x] Estado: **backend, contrato cliente y pantalla PRO verificados localmente**. Dependencia: T-10/11 y una versión fijada del modelo a ejecutar.
- Detallar `/v1/jobs`, estado/progreso, cancelación, acceso por capacidad, manifiesto y resultados usando el diseño previo del TRD. No ampliar `repetitions` del endpoint síncrono como sustituto.
- Fijar lista de índices y semillas antes de ejecutar; cada réplica procesa las políticas pareadas sobre el experimento acordado. Validar modelo, recurso de calibración, red fija o regenerada y versiones.
- Aceptación local: lotes en distinto orden producen el mismo agregado; reintentos no duplican réplicas; errores/cancelación son trazables; solo agregado completo habilita recomendación final; reproducción coincide con ejecución secuencial.
- **Verificado 2026-10-27:** cuatro rutas locales reales, token, idempotencia, cola/retención, cancelación terminal, reintentos, progreso y resultado reproducible >30. **UI PRO conectada:** formulario con límites del servidor, credenciales en `sessionStorage`, sondeo, cancelación, reintento, resultado solo al completar e historial de sesión. [Contrato P-03](p03-monte-carlo-jobs.md), [evidencia backend](../docs/evidencia/p03-jobs-local.md), [evidencia UI](../docs/evidencia/p03-ui-2026-10-27.md). No cierra P-04.

### P-04 — Distributed Map en AWS y evidencia de miles de réplicas (PRO-4)

- [ ] Estado: **no iniciado**. Dependencias: P-03, T-17/18 y revisión de infraestructura/costos.
- Preparar Step Functions Standard + Distributed Map, Lambda por réplica, S3 para manifiestos/resultados y almacenamiento de estado según TRD; entradas pequeñas por referencia, roles mínimos e idempotencia. No meter grafos/series completas en el estado de la máquina.
- Separar cantidad total de réplicas de concurrencia: 1.000 réplicas no requiere 1.000 ejecuciones simultáneas. Medir cuotas y memoria; admitir, aumentar o rechazar cargas según límites comprobados.
- Aceptación: infraestructura validada, prueba pequeña, luego 100 y al menos 1.000 réplicas con costo, duración, región, concurrencia e integridad registrados. Más carga requiere presupuesto revisado; no ejecutar automáticamente 10.000. Las alertas de AWS Budget no son un tope duro.
- Preparar código/IaC no significa desplegar ni aprobar gasto de lotes grandes. La ejecución real requiere concretar presupuesto de la prueba, cuenta/cuotas y autorización de gasto correspondiente.

### P-05 — Incorporar datos reales de dengue en Manabí (PRO-5)

- [x] Estado: **cerrado en local** (2026-10-27). Dataset `manabi-dengue-weekly-v1`: 94 semanas (2025 S1–53, 2026 S1–41), 18 259 casos, procedencia completa, geometría versionada, controles de totales y separación explícita del simulador. P-06 sigue pendiente.
- Punto de partida oficial consultado el 2026-10-27: [gacetas vectoriales del MSP](https://www.salud.gob.ec/gacetas-vectoriales/) y [archivo 2025](https://www.salud.gob.ec/gacetas-vectoriales-2025/). Fuentes efectivamente usadas: gaceta ETV SE 53/2025 y SE 41/2026.
- [x] Elegir publicaciones concretas con observaciones utilizables de Manabí; registrar URL, edición, fecha de publicación, corte, período cubierto, licencia/condiciones, hash y copia permitida de la fuente. Registrar tabla/página y método si se extrae PDF; revisar extracción visualmente.
- [x] Construir tabla normalizada con geografía, semana epidemiológica/fecha, casos, definición del caso y unidad. Distinguir incidencia de acumulados y ceros de ausencias. Tratar correcciones y duplicados; no sumar informes acumulados de semanas sucesivas.
- [x] Usar población oficial si se necesitan tasas, con fuente y año; no repartir casos provinciales entre cantones ni personas sintéticas sin metodología explícita. Si no hay granularidad de Manta, etiquetar Manabí y declarar la limitación. Los domicilios OSM no se convierten en casos reales.
- [x] Aceptación: descarga/extracción repetible, controles de totales y faltantes, procedencia completa y separación de fuentes frente a supuestos. Si no se consigue una serie suficiente, dejar pendiente la calibración en lugar de inventarla.

**Resultado 2026-10-27**

| Pieza | Ruta | Comprobación |
|---|---|---|
| Manifiesto | `data/p05/sources.json` | URL, edición, corte, SHA-256 y controles por gaceta |
| Geometría | `data/p05/geometry/*.json` | Etiquetas + todas las polilíneas candidatas + la elegida |
| Tabla | `data/p05/manabi-dengue-weekly.csv` | 94 filas, `weekly_cases`, sin acumulados ni duplicados |
| Procedencia | `data/p05/manabi-dengue-provenance.json` | Hash del CSV, método, controles y límites |
| Importador | `scripts/p05_import_dengue.py` | `download`/`extract`/`build`/`verify`/`render` |
| Lógica | `backend/src/data/dengue.py` | Selección, escala, derivación y controles |
| Pruebas | `backend/tests/test_p05_dengue.py` | 13 pruebas; suite backend 369 |

- Control 2026: suma de 41 semanas = 11 946 = `Total Casos` de la tabla provincial (exacto) y desglose por clasificación (2 249 + 72 + 9 261 + 11 + 353).
- Control 2025: las tasas 64,40 + 2,77 + 311,72 + 1,08 = 379,97 y la población implícita reconstruyen 1 070 + 46 + 5 179 + 18 = 6 313 casos (indirecto, declarado).
- Semanas 26 y 27 de 2025 tienen etiquetas solapadas; el orden se resuelve por la geometría y queda registrado.
- `provenance.usage.wired_into_simulator = false`: el dataset no alimenta el motor SEIR ni se mezcla con OSM o casos sintéticos.
- Evidencia: [p05-dengue-manabi-2026-10-27.md](https://github.com/Freddys21333/proxyendpoint-Noche-Cero/blob/9a1391d00d396a6d6662c4ec09a85fbe6df7767f/docs/evidencia/p05-dengue-manabi-2026-10-27.md). Pruebas: [plan-pruebas-local.md](../docs/plan-pruebas-local.md#4-p-05--datos-reales-de-dengue-en-manabí).
- Límites: granularidad provincial (sin Manta), datos preliminares, 2026 incompleto (S41), sin fechas calendario y sin series 2021–2024.

### P-06 — Modelo y preset calibrado, validación fuera de muestra (PRO-5)

- [x] Estado: **cerrado en local** (2026-10-27) sobre `manabi-dengue-weekly-v1` (P-05). Preset `manabi-dengue-2025-v1` con `status: fitted-not-validated`: la validación fuera de muestra **pierde frente a persistencia** en 2025 y 2026 y así se publica. Dependencias: P-05 cumplida. La «ficha de modelo de §2» no existe como documento aparte: los supuestos se declaran aquí y en la evidencia de la iteración. Evidencia: [p06-dengue-manabi-2026-10-27.md](https://github.com/Freddys21333/proxyendpoint-Noche-Cero/blob/9a1391d00d396a6d6662c4ec09a85fbe6df7767f/docs/evidencia/p06-dengue-manabi-2026-10-27.md). Pruebas: [plan-pruebas-local.md](../docs/plan-pruebas-local.md#5-p-06--calibración-y-preset-versionado-de-dengue).
- Definir variable observada y función de observación (casos notificados frente a estados simulados), escala semanal/diaria y supuestos de notificación. Una probabilidad diaria no se obtiene igualando sin justificación el inverso de una duración ni interpolando arbitrariamente casos semanales.
- Separar períodos de ajuste y validación antes de observar el resultado; documentar parámetros fijados/estimados, método, restricciones, identificabilidad, incertidumbre y métricas de ajuste/predicción. No escoger una semilla por parecerse a la curva observada.
- Publicar dataset/preset/modelo versionados, código, semillas, parámetros, rango y limitaciones. Comparar con una referencia sencilla; registrar resultados desfavorables. Los efectos y costos educativos no se vuelven reales por calibrar una curva de casos.
- Aceptación: otro proceso reproduce el ajuste y la evaluación retenida. No se etiqueta como calibrado mientras solo existan datos importados o números tomados de una ficha. Mantener el modo ficticio independiente.

**Protocolo fijado antes de ajustar (2026-10-27)**

| Elemento | Decisión | Justificación |
|---|---|---|
| Variable observada | Casos semanales **notificados** de dengue en Manabí (`weekly_cases`, P-05) | Es lo único observado; no se usan tasas, acumulados ni datos de otra geografía. |
| Modelo de transmisión | SEIR determinista de mezcla homogénea a escala provincial: `λ = β·I/N`, pasos diarios discretos | Es la forma del motor del proyecto llevada a su límite de mezcla homogénea; no es un modelo de dengue validado. |
| Función de observación | `y_w ~ NB(μ_w, k)`, `μ_w = ρ · Σ_{d∈w} σ·E_d` | Los casos notificados siguen al inicio de síntomas, aproximado por la transición E→I. |
| Parámetros fijados | `σ = γ = 1/3` por día (valores por defecto del motor), `N = 1 661 447` (población implícita de la tabla de tasas 2025) | No se inventan duraciones «de dengue»; se usan las del simulador y se declara. |
| Parámetros estimados | `β` (transmisión diaria), `ρ` (fracción notificada **dado N**), `k` (dispersión NB, en rejilla) | `N` y `ρ` están exactamente confundidos: solo se identifica `ρ·N`. Se fija `N` y se reporta `ρ|N`. |
| Semilla de condiciones iniciales | `E₀ = I₀ = (y₁/7ρ)·(1/σ)`; la semana 1 solo condiciona y no entra en la verosimilitud | La serie empieza a mitad de onda; sembrar desde cero obligaría a inventar historia previa. |
| Ventana de ajuste 2025 | S1–S35 (35 de 53 semanas) | Regla de dos tercios declarada por número de semanas disponibles, no por forma de la curva. |
| Validación 2025 | S36–S53 (18 semanas), sin reajuste | Retención fuera de muestra dentro de la misma onda. |
| Ventana de ajuste 2026 | S1–S27 (27 de 41 semanas) | Misma regla de dos tercios. |
| Validación 2026 | S28–S41 (14 semanas), sin reajuste | Segunda onda, misma regla; el pico queda en la frontera y se declara. |
| Referencias simples | Persistencia (último valor) y media de la ventana de ajuste | Si el modelo no supera una referencia trivial, se registra. |
| Incertidumbre | Bootstrap paramétrico determinista, 120 réplicas, semilla fija | Reproducible sin depender de optimizadores estocásticos. |
| Preset para el motor | `manabi-dengue-2025-v1`: `β_motor = R₀·γ / w̄`, con `R₀ = β/γ` y `w̄` medido en el grafo sintético | Puente declarado de mezcla homogénea; se mide su desviación frente al motor y se publica. |

**Resultado publicado (2026-10-27)**

| Año | Ajuste | Validación | `β` | `ρ\|N` | `k` | `R₀` | MAE validación | Persistencia | Cobertura 95 % |
|---|---|---|---|---|---|---|---|---|---|
| 2025 | S1–S35 | S36–S53 | 0.1678562291 | 0.0121826558 | 50 | 1.174994779 | **29.53** | **14.22** | 33.3 % |
| 2026 | S1–S27 | S28–S41 | 0.1725914523 | 0.016842195 | 25 | 1.2081413743 | **268.62** | **48.86** | 0 % |

- Preset: `data/p06/dengue-preset-v1.json`, hash `sha256:2cde2f34eb1c088611d4f6714756e67d4cec980b8b0a349d0e323fbd56cf8aab`, `status: fitted-not-validated`.
- Bootstrap 120 réplicas (semilla 20261027): `β` 2025 entre 0.165540 y 0.169498.
- Identificabilidad condicional: mover `β` un ±10 % cuesta −35.46 / −29.51 unidades de log-verosimilitud; `N` y `ρ` siguen confundidos.
- Puente al motor: `w̄ = 6.5717655556`, `β_motor = 0.0255420294`, 3/10 brotes extintos, crecimiento 0.65× la teoría.
- Consecuencia: el preset es optativo, explícitamente no validado y no convierte en reales los efectos ni los costos educativos. P-08 debe citarlo con esta etiqueta.

### P-07 — Completar visualización temporal y animación opcional (PRO-6)

Backend verificado localmente (2026-10-27): [validación compartida de integridad temporal](p07-backend-playback.md), trazas reales, rechazo de frames/eventos incoherentes y hashes conservados. [Evidencia](../docs/evidencia/p07-backend-2026-10-27.md). El merge de `feat/pro` (2026-10-28) integró la UI: sincronización red/mapa, retroceso de día, atajos de teclado y movimiento reducido ([evidencia UI](../docs/evidencia/p07-mapa-animacion-2026-10-28.md)). Queda la aceptación en navegador posterior al merge, en dispositivos táctiles y el rendimiento visual.

- [ ] Estado: **UI integrada, aceptación pendiente**. Base de reproducción disponible; depende de frames/eventos exportados por el modelo correspondiente.
- Aceptar mapa y red sincronizados con día, política y réplica; conservar cámara, selección, coordenadas y conteos. Mostrar límites cuando no hay frames. La curva media nunca determina los estados individuales.
- Si queda tiempo, interpolar colores/transiciones entre fotogramas e indicar exposiciones únicamente con eventos causales reales registrados. No inventar trayectos, contagios o desplazamientos de personas porque se vea más animado.
- Aceptación: pausa/seek/velocidad/reinicio y estrategia sin divergencias, entradas obsoletas bloqueadas, rendimiento y accesibilidad evaluados. Respetar preferencia de movimiento reducido; animación decorativa desactivable y sin afectar RNG/hashes.

### P-08 — Informe para el alcalde, salida preferida PDF (PRO-7)

- [x] Estado: **verificado localmente**, modo ficticio claramente identificado. Experimento completo validado en integridad, sin afirmar validación epidemiológica ni aprobación de T-22. PDF determinista, API/CLI y descarga desde comparación/trabajos. [Contrato](p08-report.md) y [evidencia](../docs/evidencia/p08-informe-2026-10-27.md). El merge de `feat/pro` añadió además el informe HTML imprimible y su CLI ([evidencia](../docs/evidencia/p08-informe-html-2026-10-28.md)).
- Plantilla determinista con problema, escenario/enfermedad, lugar/período, recursos, intervenciones, estrategias, comparación contra no intervenir y azar, incertidumbre, gasto/saldo, beneficio, recomendación explicada y límites. Incluir fuentes reales cuando existan, configuración, semilla, versiones y hash del experimento.
- Lenguaje sencillo; explicar contagios evitados y diferencia entre una réplica y promedio. Conservar empates/pérdidas; no prometer ganador para toda semilla. Costo por evitado no aplicable cuando no hay mejora positiva. Separar costos de intervenciones y AWS.
- Aceptación: las cifras coinciden con el JSON; archivo legible y visualmente revisado, tablas/gráficos sin recortes, fuentes trazables y plantilla reproducible. No fabricar resultados faltantes. Fecha de generación puede ser volátil sin cambiar la evidencia del experimento.

### P-09 — Mapa geográfico y capa de agentes (presentación de PRO-6)

- [x] Estado: **verificado localmente como presentación**. Dependencia: preview y frames representativos existentes. No requiere endpoint nuevo. Ficha completa: [P-09](p09-geographic-map.md).
- Alcance: mapa Leaflet con teselas OSM, trece polígonos residenciales versionados, posiciones sintéticas deterministas y vista **Red | Mapa** sincronizada con día, política, réplica, pausa y velocidad.
- Separación: no escribe geografía en la API, no consume el RNG del backend, no altera `graphHash`/`experimentHash` ni convierte OSM en dato epidemiológico. Complementa a P-07; no lo sustituye.
- Aceptación: atribución y zoom seguro; un solo mapa tras resize/reintento y limpieza al desmontar; fallo de teselas no bloqueante; recurso versionado válido; posiciones deterministas e interiores; rechazo de máscaras inválidas; marcadores sin reconstrucción; frames consistentes con `graphHash`, configuración, réplica y fila diaria.
- Evidencia: `frontend/src/lib/geographic-map.test.ts`, `manta-geography.test.ts`, `geographic-agents-layer.test.ts` y `simulation-playback.test.ts`. Procedencia: [docs/manta-geography.md](../docs/manta-geography.md).
- Límites: sin domicilios, movilidad, densidad ni riesgo real; sin modo offline; solo `way` cerrados simples; no acredita P-05/P-06/P-08.

## 4. Ideas de dirección: opcionales, no compromisos de entrega

| Idea | Encaje y decisión pendiente |
|---|---|
| Vacunación estratégica | Ya existe una heurística dirigida por suma de pesos de contactos entre susceptibles, no aprendizaje por refuerzo ni garantía de óptimo. Ampliar y comparar centralidad/grado ponderado, heurísticas voraces u optimización bajo los mismos recursos en P-02. |
| Reparto de antídotos | Pendiente de decidir estado elegible, efecto (cura/conversión/protección), demora, eficacia, inventario y costo. No renombrar la vacuna y asumir equivalencia. |
| Cuarentena inteligente | Extensión de aislamiento por persona/grupo; definir contactos reducidos, duración, criterios observables, costo y liberación. El cierre de una capa actual no equivale a cuarentena individual. |
| Plaga por mosquito y brigadas de fumigación | Candidata para dengue; necesita revisión de modelo, datos y efectos de P-05/06. La brigada educativa vigente no demuestra control vectorial real. |
| Rastreo del paciente cero | La selección del origen ya existe. Inferir un origen desconocido desde observaciones es otra capacidad, pendiente de alcance, método, incertidumbre y evaluación; no confundir ambos. |
| Hospital saturado | Opción futura con capacidad, demanda/ingreso/alta y efecto de saturación definidos. No existe hospitalización/mortalidad en el SEIR base; requiere contratos y pruebas propios. |
| Campañas, cuarentenas y otras intervenciones | Catálogo opcional según la plaga elegida; especificar sobre qué mecanismo actúan y con qué evidencia, costos, calendario y límites antes de implementarlas. |
| Aprendizaje por refuerzo | Alternativa de investigación, no requisito ni dependencia del producto. Solo considerar tras referencias simples, entorno/recompensa y evaluación reproducible sin fuga de datos. |

## 5. Orden de trabajo y criterio de inicio

P-01, el backend de P-02/P-03 y P-09 están verificados localmente; seguir con la integración visual de P-02/P-03 y la preparación de P-04 en paralelo, e investigar P-05 para resolver pronto datos y modelo. P-03 prepara la escalabilidad antes de P-04 y P-06 cierra la calibración tras disponer de datos. P-07 mejora la reproducción existente y se apoya en P-09 sin mezclar la aceptación del mapa con la animación. P-08 puede entregar un informe del escenario ficticio antes de la calibración, con su alcance visible.

Antes de cada implementación: cerrar esquema, ejemplo, semántica temporal, pruebas y cambios de PRD/TRD afectados. Los campos de capacidades pendientes son propuestas; P-01..P-03 tienen contratos vigentes en sus anexos. Conservar la comparación justa, independencia de políticas, exportaciones y reproducibilidad. Cada capacidad pasa a verificada solo con evidencia, sin convertir las ideas opcionales en obligaciones.

P-04, actualización 28/10/2026: implementación local y Terraform optativo preparados; aceptación distribuida AWS pendiente. Ver [contrato y límites](p04-aws-jobs.md). No se cierra el checkbox por emulación ni plan.
