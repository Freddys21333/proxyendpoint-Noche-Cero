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
