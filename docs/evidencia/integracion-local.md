# Integración local incremental en feat/front-end

## I-01 — Servidor real y proxy

`scripts/serve_api.py` publica los cuatro handlers solo en 127.0.0.1:8000, con traducción HTTP→evento v2→bytes HTTP. Conserva Content-Encoding gzip y Content-Length de los bytes reales. Entrada limitada a 64 KiB; no habilita CORS wildcard. Vite reenvía /v1 al mismo backend mediante proxy. No reemplaza despliegue ni ejecuta simulaciones desde la interfaz todavía.

Rojo observado: test_local_server falló antes de crear serve_api.py. Verde: prueba HTTP real en puerto efímero para health/preview/error, con cierre explícito de conexión HTTPError y servidor. Resultado: 32 pruebas aprobadas de test_local_server.py + test_api.py; las 9 pruebas originales del frontend también pasaron. Lint del proyecto desde backend y mypy correctos para código nuevo. Se usa pyproject.toml desde backend para resolver src y evitar reglas globales ajenas al proyecto.

Node 24.22.1 y npm 11 quedaron en .tools/node (ignorado), sin instalaciones globales. `scripts/frontend.ps1` usa esas herramientas si existen y, en otros equipos, npm instalado. Se instalaron 390 paquetes con npm ci respetando package-lock.json. Para iniciar: backend/.venv/Scripts/python.exe scripts/serve_api.py y, en otra terminal, scripts/frontend.ps1 run dev. Servidor secuencial y loopback, solo desarrollo.

Siguiente incremento: cliente de API y preview desde el formulario; la red/animación y comparación seguirán identificadas como demo hasta conectar sus vistas.


## I-02 — Cliente y consulta de preview real

Cliente tipado health/config/preview con base /v1 configurable (VITE_API_BASE_URL), traducción Scenario→configuration, errores HTTP/red/JSON y AbortSignal. La interfaz consulta health/config al montar y el formulario llama a preview; no invoca compare todavía. El diálogo muestra datos reales de población/contactos/semilla. Cambios/reset cancelan e invalidan preview, preservando entradas; se ignoran respuestas abortadas. La red, animación y comparación siguen etiquetadas como demo.

Rojo: las cuatro pruebas iniciales del cliente fallaron con API client/Scenario mapping not implemented antes de implementarlos. Verde: mapeo, URLs, errores y prueba adicional de cancelación. Build y tipos correctos; 14 pruebas frontend en total (9 previas + 5 de cliente). Servidor/API: 32 pruebas específicas; lint del backend y mypy correctos. Se manejan conexiones cerradas por el navegador al cancelar.

Prueba manual en navegador sobre Vite 127.0.0.1:5174 y backend 127.0.0.1:8000: estado Servidor disponible; formulario N=50/T=3/K=10→Consultar red→diálogo con 50 personas, 322 contactos y semilla 20261026. Al cambiar población a 51, se verificó la invalidación y preservación del nuevo valor. Screenshot local en .tools/integration-preview.png (ignorado, no es resultado científico). El proxy/browser descomprime gzip sin código de base64 en cliente. Se verificó la separación explícita entre preview real y explorador demo. Procesos locales ejecutados fuera del aislamiento para permitir acceso desde navegador, siempre loopback.

Pendiente I-03: renderizar grafo/origen real y conectar reproducción/curvas/resultados. T-12/13 no se declaran cerrados por estos avances parciales. No se alteró main ni se desplegó AWS.


## I-03 — Grafo de preview conectado

`PreviewNetwork` usa exclusivamente nodos, posiciones, IDs y origen del backend. El adaptador preview-network conserva todas las personas, toma solo aristas activas en día 0 y filtra contexto sin colapsar aristas paralelas de distintas capas. Los vecinos del inspector se cuentan como personas distintas, no aristas. La escala del círculo es solo visual y no altera datos ni consume RNG. Los estados iniciales son S/I según initialInfectiousNodeIds; todavía no hay vacunación ni trayectoria temporal en preview.

Se mantiene la demo como modo inicial explícito. Después de un preview real, editar invalida y oculta el grafo anterior, preservando el componente del formulario para mantener foco y escritura. Una nueva consulta reconstruye la red; cleanup destruye Cytoscape y ResizeObserver. El preview muestra su semilla y origen reales. Se conservan zoom, centrar, selector por ID, inspector y enfoque de vecinos. La comparación sigue pendiente en otro incremento.

Rojo: dos pruebas fallaron con Preview graph not connected antes de implementar el adaptador. Verde: 16 pruebas frontend (14 anteriores + 2 nuevas), build y TypeScript correctos. Los fixtures del adaptador prueban formato/vista, no generación científica. Casos: población/origen, no mutación, IDs de nodo/arista sin colisiones, calendario y filtro, capas paralelas y vecinos distintos.

Verificado en navegador con API real N=50/T=3/K=10: 50 personas, S=49/E=0/I=1/R=0, caso inicial 21, 322 contactos de unión y 204 activos del día 0. Filtro Hogares: 81 contactos; persona 021 Zombie inicial con 3 vecinos visibles y grupos household-3/bus-0/market-0/neighborhood-4. Se probó zoom, ajuste y selector. Cambiar a 51 con teclado dejó foco en población y ocultó la red previa. Screenshot local .tools/integration-real-network.png, ignorado en Git. No hay nuevas dependencias ni despliegue AWS.

## I-04 — Comparación, curvas y JSON reales

Cliente compare envía configuración normalizada y expectedGraphHash del preview vigente, con includeRepresentativeFrames=false. Antes de aceptar éxito verifica hash/configuración, réplicas completas, series de T+1 filas, estadísticas no nulas salvo censura, bootstrap coherente con R y metadatos. No hay fallback a resultados ilustrativos. Editar/reset/consultar otro preview aborta la espera e invalida comparación; un error 409 obliga a volver a consultar la red. Esto no promete detener el cómputo del servidor al abortar el navegador.

La interfaz muestra espera indeterminada, después medias y bandas P05–P95 para S/E/I/R/acumulados. Tablas incluyen las ocho métricas y estadísticas detalladas con n efectivo, mediana/P05/P95, diferencias pareadas con negativos, IC bootstrap cuando existe y tasas de victoria. La recomendación usa los datos del backend sin recalcular la estrategia; mantiene empate, incertidumbre y pérdidas. Se exponen semilla/versiones/build/región configurada/hash/fecha y limitaciones.

Descargar experimento JSON conserva el documento completo retornado por API (incluye grafo, réplicas, manifiesto y eventos de representativa; frames omitidos). Sin resultado vigente, Exportar conserva el borrador explícito. No se conectaron aún animación representativa ni ZIP CSV. El grafo del simulador sigue siendo preview inicial sin vacunación, claramente identificado.

TDD: tres pruebas fallaron antes de implementar comparisonRows/compare; luego se añadieron cuatro rechazos de curvas/réplicas/resúmenes/hash incompletos. Resultado: 23 pruebas frontend aprobadas (16 previas + 7 nuevas), build y TypeScript correctos. Los fixtures unitarios son mocks de contrato y no evidencia de impacto.

Flujo real en navegador: N=50/T=10/K=10/R=2, semilla 20261026, preview→comparar→curvas/métricas/recomendación. Medias de acumulados none=15.5/random=11.5/targeted=5; recomendación descriptiva sin IC para R<30. Se verificaron selector de curva y tablas, espera sin porcentajes inventados y edición con invalidación. Estos datos son una comprobación funcional, no el gate científico T-22.

Interop real: cliente TypeScript → Vite → API local → archivo JSON compacto en .tools/integration-experiment.json → scripts/reproduce.py en proceso Python nuevo. Ambos produjeron sha256:7c0f3a4c73824b0335c698590728f781b6e25c6d90cab6126a363d3a2376c5ad. Archivo temporal ignorado, no se versiona como resultado final.

Prueba adicional por HTTP con N=50/T=3/R=30: 30 réplicas válidas, bootstrap de 2000 remuestras con intervalo [-0.06666666666666667, 0.5] para gainVsRandom y confianza inconclusive. Se comprueba transporte de incertidumbre real, sin atribuir superioridad universal. No se ejecutó benchmark AWS ni se cerró T-22.

### Corrección local de cierres de conexión (I-04.1)

Se observó ConnectionAbortedError/WinError 10053 al revisar el servidor local durante cancelaciones. El puente ahora captura ConnectionError al enviar tanto cabeceras como cuerpo; incluye cierre abortado, reset y broken pipe. No altera handlers, resultados ni límites. La nueva prueba inyecta el aborto en end_headers, exige ausencia de error no manejado y verifica una petición siguiente correcta. Contra la versión anterior del script falló (errors=[True]); restaurada la corrección, pasó. Resultado específico servidor+API: 33 pruebas aprobadas; lint y mypy correctos. El archivo anterior se probó temporalmente y se restauró automáticamente; no se publicaron pruebas rotas.


## I-05 — Animación de réplica representativa real

Comparar solicita includeRepresentativeFrames=true. El cliente comprueba días T+1, población N, estados S/E/I/R, IDs indexados y correspondencia con daily en las tres políticas. Rechaza datos incompletos o incoherentes. Ante límites 413 de frames/resultado reintenta sin frames; la comparación sigue siendo real y el simulador explica la ausencia de animación. Otros errores no se ocultan ni se reintentan con datos de demo.

El simulador muestra la réplica seleccionada por el backend, con índice desde 0 y semilla raíz. Permite estrategia, día, velocidad, reproducir, pausar, siguiente y reiniciar. Colores y conteos vienen de frames; aristas visibles de activeDays y filtro de contexto. Mantiene coordenadas y la instancia/zoom de Cytoscape al cambiar día. El inspector lee el estado del día; R identifica recuperación o inmunización sin atribuir una causa inventada. Editar invalida comparación/frames y los temporizadores se limpian al pausar/desmontar. El JSON exportado incluye los frames recibidos.

Verificación unitaria: 33 pruebas frontend aprobadas (23 previas + 10 de validación de animación, adaptación de estados/calendario y alternativa por límite de tamaño). Build y TypeScript correctos. Fixtures unitarios son contratos de prueba, no evidencia científica.

Navegador con API real N=50/T=10/K=10/R=2 y semilla 20261026: representativa índice 0. Dirigida día 0 S39/E0/I1/R10 y 204 contactos activos; día 10 S35/E1/I2/R12 y 194 contactos. Sin intervención día 10 S40/E5/I3/R2. Se comprobó cambio de estrategia conservando día, retroceso exacto, reproducción hasta el final, reinicio y pausa en día 7 (S45/E2/I2/R1 sin intervención). No se cambia generación, motor científico ni disposición circular. ZIP CSV y explicación de selección de cada vacuna siguen pendientes; no hay despliegue AWS.


## I-06 — Dosis y explicación de selección reales

La vista consume selections de la política y réplica representativa, sin calcular nuevos scores ni rankings. Inspector: día, efectividad, estado S al decidir, puntuación/posición, contextos y regla de desempate por ID para targeted; random explica muestreo uniforme sin reemplazo y posición en el sorteo, con score no aplicable. No atribuye causas individuales de exclusión a personas sin dosis. Tabla por rank y acceso al inspector. Bordes violetas continuo/discontinuo distinguen dosis efectiva/fallida manteniendo el estado SEIR en el interior. Inventario por día cuenta dosis fallidas como consumidas. Antes de intervenir oculta selecciones futuras. Cambiar política o retroceder restaura datos registrados; editar invalida marcas y resultados. Si faltan frames por límite del servidor, el registro completo de vacunación continúa consultable separado del preview inicial.

Validación de contrato en todas las réplicas: selections obligatorias, IDs/ranks únicos, rango/día, elegibilidad S, score y regla según política, contextos válidos, outcome booleano e inventario concordante con metrics. RED observado: nueve corrupciones de selección se aceptaban antes de la validación; GREEN: 45 pruebas frontend aprobadas (33 previas + 12 nuevas). Build/TypeScript correctos. Fixtures unitarios son pruebas de contrato, no evidencia científica.

Navegador con API real N50/T10/K10/R2, semilla 20261026: intervención día 0/eficacia 1 mostró persona012 con score12.1/rank1, S al decidir y dosis efectiva. Caso adicional intervención día3/eficacia .5: día0 y retroceso a día2 inventario 0/0/10, sin receptores futuros; día3 dirigida 10 asignadas/5 efectivas/0 sin usar. Persona017 score11.65/rank1, dosis no efectiva, estado actual S. Aleatoria: 10/6/0; persona041 rank1, score no aplicable y dosis efectiva. None: 0/0/10 y sin registros de vacunación. Se comprobó navegación tabla→inspector, cambio de política y edición con invalidación. No hay cambios de motor/RNG, layouts ni despliegue. ZIP CSV sigue pendiente.


## I-07 — Distribuciones por pertenencia

Se añaden cinco distribuciones agrupadas y la circular original. Cada grupo usa IDs/pertenencias del grafo y una nube determinista; etiquetas indican grupo/cantidad y existe grupo explícito para personas sin pertenencia. Las etiquetas se asignan a personas existentes. Predeterminado barrios. Cambiar distribución solo mueve puntos, pausa reproducción y ajusta encuadre. Días, estrategias y filtros conservan posiciones; los filtros siguen aplicando exclusivamente calendario/contexto de contactos.

RED: importación del nuevo adaptador falló antes de implementarlo. GREEN: 51 pruebas frontend aprobadas (45 previas + 6 de posiciones por cinco pertenencias y círculo/sin pertenencia). Cubren determinismo, independencia del orden de nodos, IDs/población conservados, coordenadas finitas/únicas, etiquetas, no mutación y coordenadas circulares originales. Build/TypeScript correctos.

Navegador con experimento real N50/T10/K10/R2, intervención día3/eficacia .5: barrios mostró cinco grupos de 10 personas, 202 contactos activos en día3, S43/E0/I2/R5 y bordes de dosis. Se cambió por hogares/colegios/buses/mercados/círculo sin cambiar el día ni los conteos. Filtro Colegios dejó 36 contactos, independientemente de la distribución; volver a todos restauró 202. Las etiquetas siguieron visibles después de cambiar día. Coordenadas de representación no equivalen a un mapa de Manta ni alteran motor, RNG, grafo, semilla o hash. ZIP CSV y despliegue continúan pendientes.


## I-08 — Descarga ZIP con CSV

Exportación generada en cliente desde la comparación vigente, disponible en Comparación y diálogo Exportar. Borradores no ofrecen ZIP. Once archivos según agreements: configuration.json, manifest.json, comparison-summary.json y nodes/edges/daily/metrics/selections/events/summary/comparisons.csv. UTF-8/CRLF, columnas de referencia, escape de comillas/comas/saltos, listas JSON y null vacío. No modifica fuente ni recalcula métricas. Manifest ZIP agrega alcance de eventos representativos; JSON íntegro separado sigue siendo la fuente de reproducción. ZIP usa fecha fija y fflate 0.8.3 fijado en lockfile (auditoría npm: 0 vulnerabilidades al instalar).

55 pruebas frontend aprobadas (51 previas + 4 de exportación): escape CSV, archivos/contenido, no mutación, determinismo de ZIP, valores negativos/nulos y rechazo de eventos no representativos. Build/TypeScript correctos. Interoperabilidad con experimento real guardado en I-04: ZIP TypeScript descomprimido con zipfile de Python, CRC válido, mismos once nombres y todos los JSON/CSV equivalentes a simulation.exports.export_zip; números comparados por valor para no confundir formato textual JS/Python. Los fixtures unitarios tienen hashes ilustrativos y no se usaron como evidencia de reproducción científica.

Navegador con API real N50/T3/K10/R2, semilla 20261026: comparación vigente y botón Descargar ZIP con CSV activado; clic completó generación/descarga y mostró aviso de éxito. Hash del experimento visible sha256:0ebeb007cbc744d9de04085dbf47c15f6a15454af3c445e9ba3a87a8429b0b86. ZIP es para análisis, no sustituye al JSON reproducible. Sin endpoints, cambios del motor ni despliegue AWS. Pendientes: validación integral y requisitos base restantes.


## I-09 — Coherencia de preview y consumo de config

Corrige los hallazgos 2/3 de revision-base.md. Preview compara todos los campos solicitados contra la normalización recibida, verifica N, IDs de nodos/aristas, pertenencias/tipos, extremos, contextos/pesos, calendario ordenado válido, posiciones finitas/completas, IDs iniciales únicos y cantidad/origen node, y formato de ambos hashes. No recalcula hashes científicos en JS. Se permiten campos normalizados adicionales; no se acepta otra configuración.

Config se valida (defaults completos/red y límites positivos), conserva en App y aplica defaults solo a campos no editados mediante un registro de campos modificados. Consultar red se habilita tras cargar config. Edición durante carga y error no pierden valores; Restablecer usa defaults publicados. toConfiguration conserva network publicado. Los límites de N/tasas siguen el esquema: /config publica límites de bytes/grafo/frames, no rangos alternativos de esos controles. Se comprueba request UTF-8 antes de fetch, respuesta JSON descomprimida, máximo de aristas y presupuesto de animación; si no caben frames se pide comparación sin ellos. maxResponseBytes comprimido permanece responsabilidad del backend. Reintento 413 acotado solo si se solicitaron frames.

RED observado: 10 previews corruptos y config inválida se aceptaban antes de implementar las guardas. GREEN: 69 pruebas frontend (55 previas, una prueba antigua reemplaza su preview vacío por contrato válido, 14 nuevas de preview/config/límites/preservación de ediciones). Se corrigió el fixture de la prueba de maxEdges para que excediera realmente el límite de 1 con dos aristas. Build/TypeScript correctos. La suite backend de 302 pruebas corresponde a la revisión previa; este incremento no cambia backend y no se declara una nueva ejecución.

La aceptación completa T-13..16 sigue pendiente. La aceptación manual RF-15/CA-12, gate científico y AWS no se cierran por esta corrección (alcance aclarado 2026-10-27; presets no requeridos). La actualización de revision-base.md preserva el diagnóstico original y añade su resolución I-09.

Navegador con API real: config cargada y consulta N50/T3/K10 aceptada por las nuevas guardas; diálogo mostró 50 personas, 322 contactos y semilla 20261026. Captura local ignorada .tools/integration-config-preview.png.


## Aclaración de alcance — 2026-10-27

El responsable aclaró que el jurado pedirá ejemplos variables configurados manualmente. Se elimina el requisito de cuatro presets fijos en PRD/TRD/specs y se retira ese hallazgo de la revisión. Se mantiene aceptación del flujo manual <5 min, validación, semilla externa y exportación. No se agrega UI ni se declara validado el tiempo de operación por este cambio documental.
