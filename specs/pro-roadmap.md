# Hoja de ruta PRO y decisiones de modelo

Estado documental: **borrador de implementación**, actualizado el 2026-10-27 a petición del usuario. Esta revisión registra alcance y pendientes; no implementa nuevos comportamientos, ejecuta lotes AWS ni declara calibración real disponible. Los pendientes base T-17..T-23 conservan su estado.

Para repartir el trabajo en paralelo entre lógica backend y experiencia frontend, consultar la [división de frentes PRO](pro-workstreams.md). Esta guía complementa las tareas de abajo; no cambia su alcance ni sus estados.

## 1. Correspondencia y estado actual

| Capacidad solicitada | Referencia previa | Estado comprobable y pendiente |
|---|---|---|
| Intervenciones combinadas, costos y presupuesto | PRD §4.2 PRO-1/2; TRD §6.3 | Incremento educativo funcional: vacunas, cierre de una capa y brigadas, saldo diario y exportación. No equivale a completar todo PRO-2. Véase [semántica vigente](../docs/intervenciones-combinadas.md). |
| Recursos que llegan por días | PRO-2; TRD §6.3 | **Verificado localmente**: P-01 incorpora calendario opcional de reposición, acumulación, capacidad diaria y registro/exportación de inventario. [Contrato](p01-resource-schedule.md). |
| Decisiones que cambian según el brote | PRO-3; TRD §6.3 | **En progreso, parcial**: las brigadas dirigidas ya recalculan destinatarios susceptibles por día; vacuna y cierre siguen calendarios fijados. Falta política adaptativa explícita con reglas y registro de decisiones. P-02. |
| Miles de simulaciones Monte Carlo en AWS | PRO-4; TRD §2.3, §9.3, §14.2 | **No iniciado**: el flujo actual es síncrono, 2..30 réplicas; no hay jobs ni Distributed Map implementados. P-03/04. |
| Calibración con datos reales, dengue en Manabí como candidato prioritario | PRO-5; PRD §3; TRD §4 | **No iniciado**: se exige incorporar datos reales trazables; no se sustituirán por cifras inventadas. Fuente, período y modelo aún por seleccionar y validar. P-05/06. |
| Mapa animado del avance | PRO-6 | **En progreso**: ya hay mapa/red, estados SEIR por día, reproducción, pausa, velocidad y estrategia de una réplica real. Falta pulir las transiciones y aceptar la visualización con escenarios nuevos. Animación adicional si alcanza el tiempo. P-07. |
| Informe sencillo para el alcalde | PRO-7 | **No iniciado**: salida preferida PDF desde plantilla determinista y un experimento validado. No requiere un LLM. P-08. |

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

- [ ] Estado: **en progreso, parcial**. Dependencia: P-01 y decisiones de modelo compatibles.
- Formalizar reglas para reasignar dosis, brigadas y cierres según S/E/I/R observados, nuevos casos, contactos activos y saldo. Especificar frecuencia, umbrales y desempates; la primera versión puede ser una heurística voraz explicable.
- Mantener las estrategias actuales identificadas. Si la nueva regla cambia su significado, añadir nombre/versionado, no sustituir silenciosamente `targeted`. Comparar sin intervención, azar con recursos equivalentes y política propuesta; aclarar cuándo una regla observa estados completos como supuesto educativo.
- Exportar entradas observadas, acción, motivo, puntuación, recursos/costo y acciones omitidas por límites. No leer eventos futuros, futuros uniformes ni resultados de otras políticas.
- Aceptación: brote ascendente/descendente, saldo agotado, ausencia de elegibles, cambios de prioridad, reglas estables y límites. Verificar independencia del orden de políticas y semillas por dominio. Recalcular solo brigadas diariamente no cierra esta tarea.

### P-03 — Contratos y ejecución local de trabajos Monte Carlo (PRO-4)

- [x] Estado: **implementado, pendiente de verificación**. Dependencia: T-10/11 y una versión fijada del modelo a ejecutar.
- Detallar `/v1/jobs`, estado/progreso, cancelación, acceso por capacidad, manifiesto y resultados usando el diseño previo del TRD. No ampliar `repetitions` del endpoint síncrono como sustituto.
- Fijar lista de índices y semillas antes de ejecutar; cada réplica procesa las políticas pareadas sobre el experimento acordado. Validar modelo, recurso de calibración, red fija o regenerada y versiones.
- Aceptación local: lotes en distinto orden producen el mismo agregado; reintentos no duplican réplicas; errores/cancelación son trazables; solo agregado completo habilita recomendación final; reproducción coincide con ejecución secuencial.
- **Implementado 2026-10-27:** 4 esquemas JSON (`job-create-request`, `job-create-response`, `job-status-response`, `job-cancel-response`), OpenAPI actualizado con 3 endpoints, 10 pruebas en `test_jobs_local.py`, evidencia en `docs/evidencia/p03-jobs-local.md`. Pendiente: ejecutar pruebas con entorno instalado.

### P-04 — Distributed Map en AWS y evidencia de miles de réplicas (PRO-4)

- [ ] Estado: **no iniciado**. Dependencias: P-03, T-17/18 y revisión de infraestructura/costos.
- Preparar Step Functions Standard + Distributed Map, Lambda por réplica, S3 para manifiestos/resultados y almacenamiento de estado según TRD; entradas pequeñas por referencia, roles mínimos e idempotencia. No meter grafos/series completas en el estado de la máquina.
- Separar cantidad total de réplicas de concurrencia: 1.000 réplicas no requiere 1.000 ejecuciones simultáneas. Medir cuotas y memoria; admitir, aumentar o rechazar cargas según límites comprobados.
- Aceptación: infraestructura validada, prueba pequeña, luego 100 y al menos 1.000 réplicas con costo, duración, región, concurrencia e integridad registrados. Más carga requiere presupuesto revisado; no ejecutar automáticamente 10.000. Las alertas de AWS Budget no son un tope duro.
- Preparar código/IaC no significa desplegar ni aprobar gasto de lotes grandes. La ejecución real requiere concretar presupuesto de la prueba, cuenta/cuotas y autorización de gasto correspondiente.

### P-05 — Incorporar datos reales de dengue en Manabí (PRO-5)

- [ ] Estado: **no iniciado**. Puede investigarse en paralelo al diseño; debe preceder a P-06.
- Punto de partida oficial consultado el 2026-10-27: [gacetas vectoriales del MSP](https://www.salud.gob.ec/gacetas-vectoriales/) y [archivo 2025](https://www.salud.gob.ec/gacetas-vectoriales-2025/). Son fuentes candidatas, no un dataset ya importado o calibrado.
- Elegir publicaciones concretas con observaciones utilizables de Manabí; registrar URL, edición, fecha de publicación, corte, período cubierto, licencia/condiciones, hash y copia permitida de la fuente. Registrar tabla/página y método si se extrae PDF; revisar extracción visualmente.
- Construir tabla normalizada con geografía, semana epidemiológica/fecha, casos, definición del caso y unidad. Distinguir incidencia de acumulados y ceros de ausencias. Tratar correcciones y duplicados; no sumar informes acumulados de semanas sucesivas.
- Usar población oficial si se necesitan tasas, con fuente y año; no repartir casos provinciales entre cantones ni personas sintéticas sin metodología explícita. Si no hay granularidad de Manta, etiquetar Manabí y declarar la limitación. Los domicilios OSM no se convierten en casos reales.
- Aceptación: descarga/extracción repetible, controles de totales y faltantes, procedencia completa y separación de fuentes frente a supuestos. Si no se consigue una serie suficiente, dejar pendiente la calibración en lugar de inventarla.

### P-06 — Modelo y preset calibrado, validación fuera de muestra (PRO-5)

- [ ] Estado: **no iniciado**. Dependencias: P-05 y ficha de modelo de §2.
- Definir variable observada y función de observación (casos notificados frente a estados simulados), escala semanal/diaria y supuestos de notificación. Una probabilidad diaria no se obtiene igualando sin justificación el inverso de una duración ni interpolando arbitrariamente casos semanales.
- Separar períodos de ajuste y validación antes de observar el resultado; documentar parámetros fijados/estimados, método, restricciones, identificabilidad, incertidumbre y métricas de ajuste/predicción. No escoger una semilla por parecerse a la curva observada.
- Publicar dataset/preset/modelo versionados, código, semillas, parámetros, rango y limitaciones. Comparar con una referencia sencilla; registrar resultados desfavorables. Los efectos y costos educativos no se vuelven reales por calibrar una curva de casos.
- Aceptación: otro proceso reproduce el ajuste y la evaluación retenida. No se etiqueta como calibrado mientras solo existan datos importados o números tomados de una ficha. Mantener el modo ficticio independiente.

### P-07 — Completar visualización temporal y animación opcional (PRO-6)

- [ ] Estado: **en progreso**. Base de reproducción disponible; depende de frames/eventos exportados por el modelo correspondiente.
- Aceptar mapa y red sincronizados con día, política y réplica; conservar cámara, selección, coordenadas y conteos. Mostrar límites cuando no hay frames. La curva media nunca determina los estados individuales.
- Si queda tiempo, interpolar colores/transiciones entre fotogramas e indicar exposiciones únicamente con eventos causales reales registrados. No inventar trayectos, contagios o desplazamientos de personas porque se vea más animado.
- Aceptación: pausa/seek/velocidad/reinicio y estrategia sin divergencias, entradas obsoletas bloqueadas, rendimiento y accesibilidad evaluados. Respetar preferencia de movimiento reducido; animación decorativa desactivable y sin afectar RNG/hashes.

### P-08 — Informe para el alcalde, salida preferida PDF (PRO-7)

- [ ] Estado: **no iniciado**. Dependencia: un experimento completo y validado; puede usar primero el modo ficticio, claramente identificado.
- Plantilla determinista con problema, escenario/enfermedad, lugar/período, recursos, intervenciones, estrategias, comparación contra no intervenir y azar, incertidumbre, gasto/saldo, beneficio, recomendación explicada y límites. Incluir fuentes reales cuando existan, configuración, semilla, versiones y hash del experimento.
- Lenguaje sencillo; explicar contagios evitados y diferencia entre una réplica y promedio. Conservar empates/pérdidas; no prometer ganador para toda semilla. Costo por evitado no aplicable cuando no hay mejora positiva. Separar costos de intervenciones y AWS.
- Aceptación: las cifras coinciden con el JSON; archivo legible y visualmente revisado, tablas/gráficos sin recortes, fuentes trazables y plantilla reproducible. No fabricar resultados faltantes. Fecha de generación puede ser volátil sin cambiar la evidencia del experimento.

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

P-01 está verificado localmente; seguir con P-02 para completar decisiones e investigar P-05 para resolver pronto datos y modelo. P-03 prepara la escalabilidad antes de P-04 y P-06 cierra la calibración tras disponer de datos. P-07 mejora la reproducción existente. P-08 puede entregar un informe del escenario ficticio antes de la calibración, con su alcance visible.

Antes de cada implementación: cerrar esquema, ejemplo, semántica temporal, pruebas y cambios de PRD/TRD afectados. Los nombres de campos nuevos de esta hoja son propuestas, no contratos disponibles. Conservar la comparación justa, independencia de políticas, exportaciones y reproducibilidad. Cada capacidad pasa a verificada solo con evidencia, sin convertir las ideas opcionales en obligaciones.
