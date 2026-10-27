# Frontend environment

## Estado de integración I-03

Health/config y el botón **Consultar red** usan la API real. El formulario muestra personas/contactos/semilla del preview recibido. Editar o restablecer invalida el preview y cancela la petición pendiente; los errores conservan los valores del formulario. VITE_API_BASE_URL permite una base que ya incluye /v1 (default /v1 mediante proxy Vite local).

**Consultar red ya dibuja los nodos, contactos activos del día 0 y casos iniciales reales.** Antes de consultar se conserva una demo explícita; editar la configuración después de consultar oculta la red obsoleta y mantiene el foco del formulario. El preview no incluye vacunación ni curvas inventadas. La comparación y su gráfica todavía son de demostración; el siguiente incremento conectará compare y exportación de resultados. El botón Exportar aún descarga un borrador, no resultados reales. Estas notas actualizan el estado descrito en las revisiones históricas de abajo.

Desde raíz: `.\backend\.venv\Scripts\python.exe scripts/serve_api.py` y, en otra terminal, `.\scripts\frontend.ps1 run dev`. En equipos con Node 24/npm 11 basta `npm ci` y `npm run dev` desde frontend. El navegador descomprime gzip automáticamente; no debe decodificar base64 de Lambda porque el puente HTTP/API Gateway ya lo convierte a bytes.

Verificado: build/tipos, 16 pruebas frontend y navegador con preview N=50/T=3 (50 nodos, 322 contactos en la unión, 204 activos en día 0 y 81 del hogar). Se probó filtro, caso inicial 21, inspector, zoom y edición sin perder foco. [Evidencia incremental](../docs/evidencia/integracion-local.md).

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

## Scope

The interactive workspace includes editable scenario controls, advanced parameters, a Cytoscape contact-network illustration with layer filtering and fit control, a synchronized temporal chart and equivalent table, a separate illustrative comparison view, responsive navigation, Base UI dialogs, and configuration-draft JSON downloads. Surprise presets are no longer exposed in the current UI preview.

All network and curve data are fixed illustrations, independent of scenario inputs. They are explicitly marked and are not schema-validated experiment fixtures. No simulation runs, hashes, paired metrics or recommendations are fabricated. The Run action validates inputs and explains that the API is unavailable. Downloads contain a UI configuration draft, not canonical experiment requests or reproducible results. No persistence or remote calls are implemented.

T-03 contracts and the T-12 typed API client/fixtures remain pending. This preview does not complete T-12 through T-16. Experiment export, scientific metrics, real preview and comparisons require backend integration. La interfaz está en español y conserva la identidad de Mantalab. Local draft edits reset on page reload.

Run `npm test` for the deterministic configuration/preset checks. Tests were added with the implementation; no pre-implementation RED was captured for this increment. Type checking and the production build pass. Browser checks cover a valid run dialog, Escape dismissal, consecutive presets and responsive navigation. Automated full E2E and exhaustive contrast/keyboard audits remain pending.

The visual direction follows Taste Skill's light framed-sheet app style, with a green-grey frame and IBM Plex Sans/Mono. Chart and network bundles load separately. Fonts are installed locally and use the Latin subset. No Sites tooling is used.

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
