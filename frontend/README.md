# Frontend environment

## Interfaz Noche Cero

El frontend conserva el simulador, la comparación y PRO bajo la identidad **Noche Cero**. La vista principal es **Explorar red** y abre en la red de contactos cuando existe un preview real. Antes de consultar, muestra una ilustración rotulada sin datos; el botón **Consultar red** permanece accesible junto a los parámetros. La paleta nocturna usa naranja calabaza para acciones, lima/ámbar/coral/azul para estados SEIR, y etiquetas de texto para no depender solo del color. En móvil, los controles van primero mientras no hay preview; después la red toma la prioridad visual. La comparación y PRO comparten las mismas superficies y conservan sus límites de datos reales y fixtures demostrativos.

Checklist de capacidades, contratos y pendientes del frontend PRO: [estado al 2026-10-27](../docs/estado-frontend-pro-2026-10-27.md).

La [auditoría de UX y usabilidad](../docs/ux-usability-audit-2026-10-27.md) registra los hallazgos de Nielsen, el recorrido inicial y los límites de accesibilidad comprobados. El panel presenta Escenario y Vacunación antes de las herramientas desplegables; consultar confirma la red sin abrir un diálogo y las acciones conservan su posición. Reproducción aparece al disponer de una trayectoria. PRO y el informe local mantienen pendientes editoriales identificados en la auditoría.

Para revisar localmente: iniciar el backend con `backend/.venv/bin/python scripts/serve_api.py`, iniciar Vite con `npm run dev -- --host 127.0.0.1 --port 5174` desde `frontend/` y abrir `http://127.0.0.1:5174/`. El proxy Vite dirige `/v1` al backend local.

## Estado de integración I-09

Los parámetros tienen ayudas breves y errores locales. Población/duración y vacunas/eficacia se presentan por pares cuando el ancho lo permite. Eficacia, progresión y recuperación muestran etiqueta y porcentaje, sin símbolos ni explicaciones adicionales. En reposo se muestra una cifra decimal y al enfocar aparece el valor completo; enfocar, desenfocar o abrir/cerrar los parámetros avanzados no modifica el escenario. El motor conserva probabilidades de 0 a 1. El foco naranja se dibuja en el borde exterior de cada campo, sin un segundo cuadro interior.

El mapa geográfico está registrado como feature **P-09** ([ficha](../specs/p09-geographic-map.md)); su alcance, datos y aceptación no se mezclan con P-07 (reproducción temporal) ni con P-05/P-06 (datos reales y calibración).

**Facilidad de contagio** agrupa un campo pequeño y un slider de 0 a 100. El slider avanza en pasos enteros; el campo admite decimales y muestra una cifra decimal en reposo sin redondear el valor guardado. Las intervenciones combinadas explican su efecto junto al checkbox y sus campos usan bordes y fondos visibles en el tema oscuro. En pantallas estrechas el panel completo participa en el desplazamiento de la página, para que el reproductor no oculte los campos. Las acciones **Consultar red**, **Comparar estrategias** y **Exportar** incluyen tooltips nativos con descripciones según su disponibilidad. El día de reproducción conserva slider y botones **Día anterior / Día siguiente**; retroceder usa la trayectoria registrada, pausa la reproducción y se deshabilita en el día 0 o cuando no hay frames.

Health/config y el botón **Consultar red** usan la API real. El formulario muestra personas/contactos/semilla del preview recibido. Editar o restablecer invalida el preview y cancela la petición pendiente; los errores conservan los valores del formulario. VITE_API_BASE_URL permite una base que ya incluye /v1 (default /v1 mediante proxy Vite local).

**Consultar red ya dibuja los nodos, contactos activos del día 0 y casos iniciales reales.** Antes de consultar se conserva una demo explícita; editar la configuración después de consultar oculta la red obsoleta y mantiene el foco del formulario. El preview no incluye vacunación ni curvas inventadas. Comparar estrategias ejecuta ahora el experimento real y muestra curvas agregadas S/E/I/R/acumulados, bandas empíricas, métricas y recomendación. Editar parámetros invalida también ese resultado. La animación reproduce una réplica representativa real con selector de estrategia, día, velocidad, pausa y reinicio; indica semilla e índice, y no representa el promedio. Si el servidor rechaza el tamaño de los frames, se reintenta la comparación sin ellos y se explica la ausencia de animación. I-06 añade inventario de dosis por día, marcas de vacunación y lista por posición con acceso al inspector: día, efectividad, elegibilidad, puntuación, contextos y regla de selección registrados por el backend. No anticipa dosis futuras. ZIP con CSV disponible para experimentos vigentes. Exportar descarga el JSON íntegro reproducible si existe un resultado vigente; si no existe, sigue siendo un borrador explícito. Estas notas actualizan el estado descrito en las revisiones históricas de abajo.

Desde raíz: `.\backend\.venv\Scripts\python.exe scripts/serve_api.py` y, en otra terminal, `.\scripts\frontend.ps1 run dev`. En equipos con Node 24/npm 11 basta `npm ci` y `npm run dev` desde frontend. El navegador descomprime gzip automáticamente; no debe decodificar base64 de Lambda porque el puente HTTP/API Gateway ya lo convierte a bytes.

Verificado el 2026-10-27: build/tipos, **111 pruebas frontend** (incluye mapa y procedencia geográfica) y navegador con preview N=50/T=3 (50 nodos, 322 contactos en la unión, 204 activos en día 0 y 81 del hogar). Se probó filtro, caso inicial 21, inspector, zoom y edición sin perder foco. [Evidencia incremental](../docs/evidencia/integracion-local.md). Verificación de base: [`docs/evidencia/verificacion-base-2026-10-27.md`](../docs/evidencia/verificacion-base-2026-10-27.md); conteo vigente y benchmark en la [auditoría PRO](../docs/evidencia/auditoria-pro-2026-10-27.md).

## Shared real-simulation playback

The preview-backed workspace now offers **Red | Mapa**. After **Consultar red**, choose **Mapa** to see Manta's OpenStreetMap basemap. It uses Leaflet directly (no React Leaflet imports), initializes on the first map visit, remains mounted across view changes, resizes on visibility/container changes and removes its listeners, observer and map on unmount. Zoom buttons, keyboard navigation and dragging are enabled; wheel zoom is disabled to preserve page scrolling. Map controls and attribution support the existing `.dark` theme; dark mode dims only the tile imagery.

The map shows the real preview population at synthetic, deterministic positions inside 22 versioned OSM residential reference polygons, including expanded western Manta coverage. Households use available footprint area and separated candidate positions. The camera fits each new scenario with fractional zoom and an upper cap of 16; markers shrink at city zoom and grow on closer views, retaining infectious emphasis. When representative frames are available, Red and Mapa consume the same workspace-selected day, policy and frame. Existing Canvas CircleMarkers update their colors/radii and open popup content without rebuilding the map, moving agents or losing selection. Click a map point or open **Buscar persona**, enter its number, and choose **Ver persona** to center and inspect it. Invalid numbers produce an inline error; **Quitar selección** closes the selection. No physical movement, heatmaps or transmission changes are implemented. See [geographic data provenance and playback](../docs/manta-geography.md).

The simulator fills the viewport below its navigation. On desktop the map/network and controls occupy separate columns; on phones they stack within the viewport. Counts and vaccine inventory remain over the scene. Only the settings body scrolls: the controls heading and **Consultar red**, **Comparar estrategias**, and **Exportar** actions remain visible. Advanced parameters, combined interventions, resource schedules and representative playback retain their existing behavior. The former educational footer and introductory hero are removed from this layout. Comparison and PRO keep their own document layout. Verify empty/loaded states and all expanded settings at desktop, tablet and phone widths; use browser geometry and interactions rather than CSS-text tests.

### Functional control audit — 2026-10-27

The player stays fixed below the controls heading after loading a population. Before real frames exist, its disabled actions explain the prerequisite; after comparison, Play/Pause/Step/Reset use the same real representative trajectory. Strategy, day and speed remain in the scrollable settings. Pending comparisons can be cancelled from either the results view or the simulator actions without changing the scenario inputs.

**Centrar mapa** fits the retained geographic agents, including after person focus. **Centrar red** fits the network. The contact filter is explicitly network-only and disabled in Map. Network inspection, map clicks/search and vaccination-person buttons share one selected person; selecting a vaccinated person focuses the matching map popup and exposes the real dose explanation. A hidden map closes its popup and reopens the current selection after becoming visible so popup layout uses the actual map size.

Observed browser checks used the actual 1,000-person, 90-day, 30-replica scenario with combined interventions. The full comparison completed. Play advanced to day 1 and paused, Step reached day 2, seeking reached day 90, Reset returned to day 0, and policy changes retained consistent counts. A vaccinated-person selection opened that same person's map popup and dose details. A separate 500-person/20-day/5-replica cancellation check retained those inputs and restored comparison availability.

Actual JSON and CSV ZIP downloads were validated: the JSON contains 30 replicas and 273 representative policy/day frames whose S/E/I/R counts match the backend daily rows. The ZIP retains the scientific configuration and manifest (plus its documented representative-event export metadata), with 1,000 node rows, 59,373 edge rows, 8,190 daily rows, 8,190 budget rows and 90 metric rows. Large comparisons are synchronous local calculations and can take several minutes; cancelling the browser request does not interrupt work already running in the local Python server. No engine, epidemiological parameters or API contracts changed in this control fix.

Both views retain the workspace's day, policy, speed and playback. Tile failures show an inline message with **Reintentar mapa**; the network and simulation remain usable. OpenStreetMap attribution stays visible. Standard public OSM tiles require internet access and follow the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/); no offline downloads or prefetching are implemented.

`ContactNetwork` routes real previews through `SimulationWorkspace`, which owns day, policy, playback status and speed, and schedules one cancellable tick. `PreviewNetwork` consumes that controller; future views can consume the same frame without creating another clock. The existing controls, markup and camera behavior are preserved. The authored demo retains its independent reducer and timer.

Changing the preview, comparison, request status or active status resets playback to day 0 and pauses, preserving the chosen policy and speed. View changes do not reset playback. `resetKey` only fits the network camera. Pending, failed or frame-free comparisons explicitly retain the valid initial preview without individual playback; invalid previews hide the old views and clear map selection. A comparison must match the preview graph hash and configuration. Selected-frame counts are checked against the same representative replicate's daily row, never aggregate curves. The controller and timer/layer cleanup checks run with `npm test` alongside the existing network, API and demo tests.

## Minimal simulator dashboard

SEIR person markers use vivid green/yellow/red/blue, with contrasting strokes from one shared presentation palette. State-indicator circles are 14px without borders. Evolution curves and their legend use solid colored lines, with labels and the daily data table retained. State totals use equal centered columns; chart-legend values have fixed alignment. The contact filter is labeled Tipo de contacto / Todos los tipos; its internal values and behavior are unchanged.

The dashboard uses a light contact-network canvas on the left and a synchronized temporal chart plus scenario parameters on the right. Navigation is reduced to Simulador, Comparación and Ayuda. Labels and input text use 16px, with 15px supporting text. The surprise-outbreak section and its navigation are removed; its domain helpers remain available to existing tests.

The follow-up preview explains that each point (node) represents a synthetic person and each line a contact. Origin controls use Origen aleatorio, Persona específica and Número de persona; internal API/configuration keys are unchanged. Evolution displays all four states directly, without a state selector. Initial fit, centering and fit controls share 16px padding to enlarge the complete network; the native Cytoscape wheel sensitivity is restored without custom wheel listeners or animation timers. Browser checks observed wheel zoom in/out, complete recentering, person-origin field visibility and synchronized day-3 counts (102/2/3/3). All 9 tests and the production build passed.

Simulation data, playback, filters, validation and configuration-draft export retain their existing behavior. The chart/network demo remains independent of scenario parameters; the main action validates configuration without claiming to run the disconnected engine. Narrow screens stack the workbench and preserve readable controls.

PRODUCT.md and DESIGN.md record the current product scope and interface. The sections below include earlier implementation and verification history.

## Committee interface refinement

The temporal chart's state selector includes “Todos los estados”, displaying Sano, Mordido, Zombie and Exorcizado together. Each line has its own color and dash pattern; a legend shows counts for the current playback day. Individual-state views, the synchronized day boundary, and the complete data table remain available. Browser verification observed four series in the combined view and one after selecting Zombie; build and all 9 existing tests passed.

The contact network now gives more space to the canvas and uses larger circular person markers and labels. A reading guide explains that nodes represent synthetic people and edges represent contacts (TRD section 4.1; agreements D-03); grouping is contextual rather than geographical. The inspector uses person-facing labels and moves below the canvas when the workbench is at most 760px wide, preserving the navigation and configuration columns. No topology, simulation state, fixture, or scientific calculation changes. Build and all 9 tests passed; browser selection of person 008 still reports 9 direct contacts.

The workspace follows `../DESIGN.md`: flat paper surfaces, green navigation and readable scientific controls. The heading and scenario context are simplified; pending experiment statistics use compact availability text; surprise presets prioritize their effect and expose explicit Apply/Applied states. Small CSS text now has a 12px floor, including responsive overrides. Backend, simulation modules, fixtures, and scenario callbacks are unchanged.

Impeccable Live was stopped and its injected script removed. No listener remains on port 8400. Verification: production build/typecheck passed; all 9 existing tests passed; browser readback confirmed the vaccine preset changes to 50 doses and displays its applied state. Automated 1440/768/390 screenshots were unavailable because the inspector's Chrome process failed to start; the integrated browser was used for visual inspection.

React, TypeScript and Vite with Tailwind CSS v4, Lucide React and shadcn/ui using Base UI (`base-nova`, Lucide icons).

## Requirements and commands

Use Node.js 24 LTS and npm 11. Run from `frontend/`:

```sh
npm ci
npm run dev
npm run typecheck
npm run build
npm run preview
```

`dev` starts the local development server; `preview` serves the compiled `dist/` after building. Neither command publishes the application. Commit `package-lock.json`; dependencies use exact versions.

The environment includes the generated shadcn Button at `src/components/ui/button.tsx`, backed by `@base-ui/react/button`. Import it through `@/components/ui/button`. Import icons by name from `lucide-react`. `components.json` configures future shadcn components; the neutral starter theme is provisional.

## Vista PRO en desarrollo

La vista PRO muestra la comparación vigente de la API real cuando existe y permite abrir sus resultados completos. El flujo de trabajos Monte Carlo usa exclusivamente fixtures locales rotulados como datos de ejemplo; su progreso, historial y cifras no son resultados científicos. El backend todavía no publica `/v1/jobs`, por lo que P-03 sigue pendiente de contrato e integración.

## Scope

**Estado actual (2026-10-27).** The interactive workspace uses the real backend for health/config, preview and comparison. Editable controls, the Cytoscape/Canvas contact network, layer filtering, the synchronized temporal chart/table, representative playback, vaccination selections, inventory, combined interventions, ZIP/JSON export and the geographic map are integrated. The authored demo remains only as an explicitly labeled fallback before querying; it is not presented as a real result.

The geographic map is feature **P-09**, documented in [`../specs/p09-geographic-map.md`](../specs/p09-geographic-map.md) and [`../docs/manta-geography.md`](../docs/manta-geography.md). It uses versioned OSM residential polygons and deterministic synthetic placement; it does not change the model, contracts or hashes.

All scientific logic stays in the backend. The frontend may format, filter, lay out and present data, but it must not recompute epidemiological results. The `Mapa` and `Red` views consume the same day, policy, replicate and frames. Incomplete or stale data never becomes an invented result.

Run `npm test` for the deterministic frontend suite, `npm run typecheck` for types and `npm run build` for the production bundle. The current suite covers API client, preview, comparison, export, playback, geographic map, geography provenance and agent layer. Automated full browser E2E and exhaustive contrast/keyboard audits remain pending.

The visual direction follows the light framed-sheet app style defined in [`../DESIGN.md`](../DESIGN.md), with IBM Plex Sans/Mono. Chart, network and map bundles load separately. Fonts are installed locally and use the Latin subset.

Sections below this point are **historical records**. Some describe earlier states where the API, real simulations or contracts were not yet connected; do not read them as the current scope.

Do not duplicate epidemiological calculations in the frontend. Follow `../specs/agreements.md` when implementing the API client. The deployment variables will be `VITE_API_BASE_URL` (including `/v1`), `VITE_BUILD_COMMIT` and `VITE_SCHEMA_VERSION`; never put secrets in Vite variables.

## Rediseño de la consola científica

La interfaz está en español y utiliza una navegación lateral única, red de contactos dominante, parámetros agrupados en columna y banco de pruebas para Brote Sorpresa. El sistema visual usa fondo #F5F5F0, verde #173E32, texto #202C28 y alerta #C45C47. Los estados SEIR conservan letras y colores diferenciados. Se mantienen los parámetros, presets, datos de ejemplo y contratos; Monte Carlo, impacto e incertidumbre muestran ausencia de resultados reales.

Verificación visual: escritorio 1440 px, tableta 768 px y móvil 390 px; presets consecutivos, filtrado de capas, zoom y cierre del diálogo con Escape. El lint visual de Taste no detectó fallos y emitió advertencias de estilo. El proyecto no tiene script npm run lint. El inspector de Taste no pudo iniciar Chrome; se utilizó el navegador integrado.

### Ajuste de jerarquía y accesibilidad

Se compactó la cabecera y se ampliaron etiquetas y controles. La red distingue S/E/I/R también por forma (círculo, rombo, hexágono y rectángulo redondeado). Las series comparativas usan trazos distintos, leyenda explícita y ejes numéricos legibles; se conservan los mismos valores ilustrativos, representados mediante segmentos rectos. Brote Sorpresa muestra el valor de la transformación antes de aplicarla y anuncia el botón seleccionado. La navegación móvil dispone de cierre explícito y con Escape. No se modifican el dominio, la validación, los contratos ni los datos de la simulación.

Verificación final de esta revisión: build y typecheck correctos; 2 pruebas existentes correctas; lint Taste en modo app con 0 fallos y 2 avisos (identificadores monoespaciados y marcadores de datos ausentes). Comprobado en navegador: menú móvil con Escape, 390 px sin desbordamiento, presets sin acumulación y leyendas diferenciadas por forma/trazo. ESLint no está configurado en este proyecto; el lint ejecutado es el inspector estático de Taste.

## Explorador de la red de contactos

Solo el lienzo de la red utiliza una superficie oscura. Los indicadores S/E/I/R se calculan a partir de los 110 nodos existentes de demostración (88/6/1/15), no de la población del formulario. La selección directa o mediante teclado muestra ID, estado, capa y número de contactos distintos. Se pueden enfocar las conexiones del nodo, filtrar capas, ampliar y ajustar la vista. El generador visual se conserva en `src/lib/contact-network.ts`, sin cambios en la topología ni en el backend.

En pantallas estrechas se redistribuyen las posiciones visuales por grupo, sin añadir o modificar nodos/aristas. La demo temporal usa un temporizador de reproducción con limpieza al pausar/desmontar; no hay cálculo epidemiológico ni animaciones decorativas. Los estilos se actualizan en lote y la instancia de Cytoscape y su observador se destruyen al desmontar.

La barra inferior permite reproducir los estados diarios del guion de demostración. El día mostrado pertenece a ese guion, no a una réplica real. Conectar resultados reales requiere integrar el backend en una etapa posterior; los contratos API no se modifican.

Pruebas: `npm test` incluye la suma SEIR, el contexto del nodo 008 (I, Hogares, 9 contactos), identificadores desconocidos y conservación de datos al explorar. Se observó RED al añadir la prueba antes del módulo, y GREEN tras implementarlo. Comprobación manual de selección directa, selector por ID, enfoque y adaptación a escritorio y móvil. Los controles ahora reproducen únicamente el guion temporal identificado.

## Primera demo temporal de interfaz

El explorador reproduce un guion manual de 20 días (21 estados diarios) para los mismos 110 nodos. No ejecuta el modelo científico, no produce resultados Monte Carlo ni cambia el backend o sus contratos. La configuración del formulario sigue siendo independiente de esta demo.

`src/lib/temporal-demo.ts` contiene eventos, estados, conteos y el reductor del reproductor. Los nombres temporales siguen los acuerdos (`day`, `nodeId`, `from`, `to`, `cause`, `sourceNodeId`, `edgeId`, `daily`), pero es un fixture parcial, no una respuesta completa ni validada por OpenAPI de `/compare`. Los identificadores numéricos de aristas se adaptan a las claves visuales de Cytoscape. No se inventan hashes, semillas de ejecución o versiones científicas.

Play, pausa, paso, reinicio, búsqueda y velocidades 0,5×/1×/2×/4× usan un solo día. La reproducción se detiene al finalizar, buscar, ocultar la página o desmontar el componente. Reiniciar conserva la velocidad; reproducir desde el final empieza en 0. La velocidad solo cambia la presentación del guion. El inspector muestra el estado actual y únicamente el historial ocurrido. Curva y tabla usan los mismos estados; el gráfico comparativo general sigue siendo otro ejemplo independiente.

Pruebas nuevas: conservación por día, un caso inicial, transiciones y causalidad sobre aristas existentes, vacunas solo de susceptibles, reconstrucción hacia atrás y acciones del reproductor. RED antes de crear el módulo y GREEN tras implementarlo. Comprobación en navegador: día 3 con S=102/E=2/I=3/R=3 y curva I=3, búsqueda a 20 con paso deshabilitado y regreso a 0 sin eventos futuros.

Verificación final de la demo temporal: build y tipos correctos, 9 pruebas correctas, lint Taste con 0 fallos y 2 avisos de estilo. Verificación independiente del reloj, ciclos de limpieza y coherencia temporal sin bloqueos; sus probes se ejecutaron en una copia temporal fuera del repositorio. La visibilidad del navegador y Strict Mode fueron inspeccionados estructuralmente, no mediante un E2E automatizado.
# Integración local incremental

Primer incremento: servidor real de desarrollo y proxy de Vite. Desde la raíz, en una terminal:

```powershell
.\backend\.venv\Scripts\python.exe scripts/serve_api.py
```

En otra terminal, ejecutar `.\scripts\frontend.ps1 run dev` desde la raíz (o `npm run dev` desde frontend si Node/npm están instalados). Las llamadas `/v1/*` del navegador pasan al backend en 127.0.0.1:8000 sin necesitar CORS. El puente conserva gzip y errores de los handlers Lambda. Es un servidor local secuencial para desarrollo; no reemplaza API Gateway/Lambda ni valida rendimiento de producción. Este primer incremento todavía conserva la demo visual y sus datos.


### Ejecutar una comparación real

1. Ajustar parámetros y consultar la red.
2. Pulsar Comparar estrategias (en el diálogo o formulario). La espera es indeterminada; no hay progreso por réplica en HTTP síncrono.
3. En Comparación, elegir S/E/I/R o acumulados. Las líneas son medias y las bandas P05–P95 son rango empírico, no IC. Tablas y diferencias provienen del backend, incluidos negativos, censura de duración y empates/pérdidas.
4. Descargar experimento JSON para usar scripts/reproduce.py. Sin resultado vigente, Exportar descarga solo borrador. Volver al simulador permite reproducir la réplica representativa. ZIP con CSV disponible para experimentos vigentes.

El cliente verifica hash/configuración, total de réplicas, longitud de series, estadísticas y metadatos antes de mostrar éxito. Si falla o se editan parámetros, no se presenta un resultado anterior como actual. Abortar la espera del navegador no garantiza detener el cómputo del servidor.


## Detalle de vacunación real (I-06)

Tras comparar, vuelve a Simulador y avanza al día de intervención. El panel Vacunación muestra asignadas/efectivas/sin usar y la lista de personas en orden de selección. Pulsa una persona para abrir su explicación; también funciona el selector del inspector. El borde violeta distingue dosis efectivas (continuo) de fallidas (discontinuo); el color interior conserva S/E/I/R. Una selección fallida consume una dosis y no atribuye inmunidad.

Cambiar estrategia o retroceder actualiza los registros sin recomputar decisiones. Antes de la intervención no se revelan seleccionados futuros. El estado elegible al decidir se conserva separado del estado actual. Sin frames, el registro completo de la representativa sigue disponible con su selector de estrategia; el grafo permanece identificado como preview inicial.


## Distribuciones visuales reales (I-07)

El selector Organizar personas por ofrece Barrios (predeterminado), Hogares, Colegios, Rutas de bus, Mercados y Circular. Cada grupo conserva su identificador y cantidad; las personas sin pertenencia se agrupan explícitamente como Sin colegio/Sin ruta de bus/etc. Las etiquetas pertenecen a personas existentes, sin añadir nodos epidemiológicos. Son grupos de una población sintética, no coordenadas geográficas.

Las posiciones agrupadas son deterministas por IDs/pertenencia y se mantienen al cambiar día, estrategia o filtro de contactos. Cambiar distribución pausa la reproducción y ajusta el encuadre; no invalida resultados ni hace otra petición. El círculo conserva las posiciones originales del preview. El filtro Tipo de contacto controla aristas por separado. Zoom, selección, inspector, estados SEIR y bordes de dosis siguen disponibles.


## Exportación ZIP/CSV (I-08)

Después de comparar, Descargar ZIP con CSV está disponible en Comparación y en el diálogo Exportar del simulador. Incluye configuration.json, manifest.json, comparison-summary.json y ocho CSV: nodes, edges, daily, metrics, selections, events, summary, comparisons. UTF-8, coma, encabezados/orden del contrato, CRLF, null vacío y listas JSON. Solo exporta eventos de la representativa; manifest.json declara ese alcance. No recalcula estadísticas ni modifica el JSON original. Conserva el JSON completo para reproducir; el ZIP facilita análisis. Sin comparación vigente solo se permite el borrador JSON. fflate está fijado en package.json/lockfile y genera el ZIP localmente sin endpoint nuevo.


## Configuración publicada y preview coherente (I-09)

La UI espera config válida antes de habilitar Consultar red. Permite editar mientras carga; defaults recibidos solo completan campos no modificados. Restablecer usa defaults publicados. Si la carga falla conserva entradas y muestra error. Los requests incluyen la configuración de red publicada. Los rangos de N/tasas siguen el esquema; config publica límites de transporte/grafo/frames: se valida tamaño de request y JSON descomprimido, máximo de aristas y presupuesto de animación. Si el presupuesto no admite frames, se solicita directamente comparación sin animación; un rechazo posterior permite fallback acotado solo si se habían pedido frames.

Preview debe coincidir con todos los parámetros solicitados (se permiten campos normalizados adicionales), conservar N, IDs, pertenencias, posiciones finitas y completas, aristas/calendario válidos, IDs iniciales únicos/cantidad coherente y hashes con formato válido. Esta validación de contrato no sustituye la validación del backend ni recalcula el hash científico.

## Aclaración de alcance — 2026-10-27

Los casos distintos del jurado se atienden editando parámetros y semilla manualmente. No se requieren presets fijos ni botones de sorpresa. Los helpers applyPreset y sus pruebas se conservan como utilidades opcionales históricas; su existencia no obliga a exponerlos. Las descripciones anteriores de pantallas con presets son historial, no alcance vigente. Falta medir la aceptación del flujo manual RF-15/CA-12.
