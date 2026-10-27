# Geographic agents and representative playback in Mantalab

**Feature:** P-09 — Mapa geográfico y capa de agentes. **Estado:** verificado localmente como presentación. **Ficha, alcance y aceptación:** [specs/p09-geographic-map.md](../specs/p09-geographic-map.md).

The map is an educational presentation of synthetic agents. The coordinates are not real homes, mobility observations, population density estimates or calibrated neighborhood risks. The backend, API contracts, contact graph, experiment hashes and SEIR results are unchanged.

## Static data and provenance

`frontend/src/data/manta-residential.json` is a derived GeoJSON snapshot from the public OpenStreetMap API. Version `manta-residential-osm-v3` retains the original thirteen geometries and response hashes from **2026-10-27T11:26:10.777Z** and adds nine residential ways fetched at **2026-10-27T16:04:22.636Z**, the resource assembly timestamp. The additions were retrieved through `www.openstreetmap.org/api/0.6/way/{id}/full.json`; recorded URLs use the canonical API hostname. Each feature records its OSM way ID, version, edit timestamp, source API URL and SHA-256 of the original response. Editor names, user IDs, addresses, buildings and place names are not retained. Derived geographic data is under **ODbL 1.0**, with [OpenStreetMap contributor attribution](https://www.openstreetmap.org/copyright) retained on the map.

| Synthetic reference sector | OSM source | Way version |
|---|---|---|
| synthetic-sector-0 | [1290388697](https://api.openstreetmap.org/api/0.6/way/1290388697/full.json) | 1 |
| synthetic-sector-1 | [1237070572](https://api.openstreetmap.org/api/0.6/way/1237070572/full.json) | 1 |
| synthetic-sector-2 | [412772816](https://api.openstreetmap.org/api/0.6/way/412772816/full.json) | 3 |
| synthetic-sector-3 | [412772820](https://api.openstreetmap.org/api/0.6/way/412772820/full.json) | 5 |
| synthetic-sector-4 | [1426150466](https://api.openstreetmap.org/api/0.6/way/1426150466/full.json) | 1 |
| synthetic-sector-5 | [411802416](https://api.openstreetmap.org/api/0.6/way/411802416/full.json) | 2 |
| synthetic-sector-6 | [411822001](https://api.openstreetmap.org/api/0.6/way/411822001/full.json) | 1 |
| synthetic-sector-7 | [411822004](https://api.openstreetmap.org/api/0.6/way/411822004/full.json) | 1 |
| synthetic-sector-8 | [411822007](https://api.openstreetmap.org/api/0.6/way/411822007/full.json) | 1 |
| synthetic-sector-9 | [767412777](https://api.openstreetmap.org/api/0.6/way/767412777/full.json) | 4 |
| synthetic-sector-10 | [1120671240](https://api.openstreetmap.org/api/0.6/way/1120671240/full.json) | 3 |
| synthetic-sector-11 | [1237070571](https://api.openstreetmap.org/api/0.6/way/1237070571/full.json) | 1 |
| synthetic-sector-12 | [1291890427](https://api.openstreetmap.org/api/0.6/way/1291890427/full.json) | 2 |
| synthetic-sector-13 | [859889942](https://api.openstreetmap.org/api/0.6/way/859889942/full.json) | 37 |
| synthetic-sector-14 | [954255999](https://api.openstreetmap.org/api/0.6/way/954255999/full.json) | 15 |
| synthetic-sector-15 | [1211040016](https://api.openstreetmap.org/api/0.6/way/1211040016/full.json) | 4 |
| synthetic-sector-16 | [1225669343](https://api.openstreetmap.org/api/0.6/way/1225669343/full.json) | 4 |
| synthetic-sector-17 | [1298886280](https://api.openstreetmap.org/api/0.6/way/1298886280/full.json) | 7 |
| synthetic-sector-18 | [1301876283](https://api.openstreetmap.org/api/0.6/way/1301876283/full.json) | 5 |
| synthetic-sector-19 | [1301876284](https://api.openstreetmap.org/api/0.6/way/1301876284/full.json) | 3 |
| synthetic-sector-20 | [1426150465](https://api.openstreetmap.org/api/0.6/way/1426150465/full.json) | 1 |
| synthetic-sector-21 | [1426734719](https://api.openstreetmap.org/api/0.6/way/1426734719/full.json) | 1 |

All twenty-two sources are inland areas tagged `landuse=residential` in urban Manta. The additions extend the western footprint from longitude -80.73511 to -80.75496. They were selected as spatial reference areas, not a representative sample of Manta. They are **not** the model's five synthetic neighborhoods, nor official administrative sectors. The API payloads supplied the actual geometry; no polygon was drawn from a bounding box or a representative place coordinate.

The preparer and frontend reject missing evidence, non-residential tags, nonfinite coordinates, unclosed or zero-area rings, self-intersections and geometries outside a coarse Manta envelope. The envelope is only a location sanity check; **strict point-in-polygon membership in the actual residential footprint** defines permitted placement. This resource supports simple closed ways only, not multipolygons or holes. OSM land-use classification is a reference land mask, not authoritative surveying; mapping errors or unmapped interior water cannot be ruled out. No claim of complete city or coastline coverage is made.

## Reproduce preparation

Run from the repository root with Node 24. No OSMnx, Python environment or new package is required.

```powershell
node --experimental-strip-types scripts/prepare-manta-geography.mjs --help
node --experimental-strip-types scripts/prepare-manta-geography.mjs --download --output manta-residential.new.json
```

This makes twenty-two bounded public API requests, validates every geometry, strips unrelated tags and writes a **new** resource. Existing files are never overwritten. Review a refreshed resource and bump its version before replacing the checked-in snapshot: live OSM content can change.

For offline preparation, save the twenty-two original API responses as `<wayId>.json` in one directory, then run:

```powershell
node --experimental-strip-types scripts/prepare-manta-geography.mjs --source-dir PATH_TO_RESPONSES --extracted-at 2026-10-27T11:26:10.777Z --output manta-residential.new.json
```

The original snapshot was prepared offline from downloaded API responses using the original timestamp, with the same validator. Version 3 preserves those thirteen features and validates each additional full-way response before assembling the combined resource. Raw responses are not shipped. No geographic API is queried when users create or replay a scenario; only the separate basemap tile layer uses the network.

## Deterministic assignment

The geographic namespace is now `mantalab-geography-v3`. A local FNV-1a seed hash and Mulberry32 stream derive from the resource version, root seed, graph hash and household ID. They never consume the backend RNG, modify the graph or write geographic fields into API data.

Nodes and households are sorted by original ID. Sectors are permuted with a seeded Fisher-Yates shuffle. Each available sector receives one household before additional households go to the footprint with the lowest household-count-to-area ratio. This avoids assigning the same number of households to tiny and large polygons. Area is a local planar placement weight, not measured population density. This is a presentation rule, not a geographic interpretation of synthetic neighborhood IDs; every original neighborhood ID remains available as context.

An anchor is selected from up to 64 interior candidates by its distance from all previous household anchors, including those in neighboring polygons. Single-person households use the rounded anchor; larger households choose nearby distinct positions from up to eight valid candidates per member to reduce overlap. Every rounded coordinate is tested again for strict interior membership. Attempts are bounded; failure produces an explicit unavailable message rather than invented fallback points. Source coordinates use GeoJSON `[longitude, latitude]`; Leaflet receives `[latitude, longitude]`. The resource contains twenty-two verified OSM residential areas. Discovery used bounded public map API windows; geometries and hashes were obtained separately from each official way/full.json source. No unsupported residential footprints were invented.

Assignment reads only the preview, is memoized by preview identity and receives no playback day or policy. Switching views or strategies cannot move agents. A new scenario can produce new coordinates. Every returned `nodeId` is the original `node.id`.

## Rendering and frame semantics

Without individual frames, the preview identifies the initially infectious nodes: those agents are `I` (red), and every other agent starts as `S` (green). This preview precedes intervention. Pending, failed and frame-free comparisons explicitly show this initial fallback; they do not reconstruct individual states from aggregate curves. Invalid previews are blurred and inert until matching parameters are restored or a fresh preview is loaded.

With frames, `SimulationWorkspace` remains the sole playback owner and selects `comparison.representative.frames[policy][day]`. Both views receive that exact array indexed by `nodeId`, together with day, policy and representative index. The source must match the preview's graph hash and complete configuration. Per-frame S/E/I/R totals must match the daily row of that same representative replicate. The aggregate curves are not used for animation. The existing API validator still validates complete frame series before results enter the workspace.

The full S/E/I/R legend uses the existing palette; R retains the backend meaning recovered or immune. Day 0 of a representative policy can already contain vaccination outcomes and need not equal the unvaccinated preview. Headers, counts, legend and selected-agent popups identify the actual selected trajectory.

One Canvas renderer and one CircleMarker per agent are attached to the existing Leaflet instance. Marker layers and deterministic placements are created only for a new preview. A new scenario fits all agents with room for the legend and bottom counts, capped at zoom 16 with 0.25 zoom increments; playback and resize preserve the camera. Marker radius is clamped between 1 and 4 pixels according to zoom, with infectious cases 1.5 times larger. A `zoomend` listener resizes existing markers and is removed on destroy. Daily/policy updates reuse markers and update styles/radii only when states change. Selection survives playback and tab changes. An open popup receives the current state/day/policy/replicate using DOM text nodes; automatic panning is temporarily disabled during content updates to preserve the camera. Clearing selection closes the popup. Layers, listeners, renderer and ResizeObserver resources are released on replacement/unmount. The automatic authored demo has been removed from the application. There is one playback timeout, no map-specific playback timer and no API request per day.

## Verification

The frontend suite exercises 50, 1,000 and 2,000 agents: exact ID coverage, strict mask membership, determinism, node-order and visual-xy independence, seed changes, household grouping, initial infections, input immutability, rejected masks, marker selection/colors/cleanup and preprocessing CLI behavior. Representative frames for every policy/day are checked against network states and the representative daily counts. Retained-layer tests cover style updates, stable positions/listeners/Canvas, preserved selection and popup content, no-frame fallback, rejected frames and cleanup. Existing API, export-hash and playback tests remain in the suite.

In the browser, consult a real preview, run **Comparar estrategias**, return to the simulator and select **Mapa**. Open Buscar persona, enter a person number and use Ver persona (or click a point), then advance days/change policies: its coordinates and selection must remain stable while its state, day and policy update. Compare S/E/I/R totals between Red and Mapa; play/pause, seek, next day and reset must control both. Switching tabs must keep the clock and camera. Editing scenario parameters must block stale views behind the update notice; restoring the loaded parameters recovers their data. A comparison without frames must explicitly show the valid initial preview without individual playback.

## Incremento del 2026-10-27

La distribución v2 amplía de cinco a trece áreas residenciales OSM verificadas y usa todas las áreas disponibles y separa anclas de hogares entre 16 candidatos, sin modificar grafos, semillas epidemiológicas ni hashes científicos. Medición local puntual: asignación de 50/1000/2000 agentes en 10/27/36 ms, respectivamente; no es un benchmark AWS ni una garantía por dispositivo. No se agregó una llamada de geografía por simulación ni por día. El escenario anterior se conserva difuminado y bloqueado cuando cambian parámetros; al restaurarlos se recupera la visualización. La demo automática fue retirada.
