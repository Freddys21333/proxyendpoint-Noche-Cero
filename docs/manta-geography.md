# Geographic agents and representative playback in Mantalab

The map is an educational presentation of synthetic agents. The coordinates are not real homes, mobility observations, population density estimates or calibrated neighborhood risks. The backend, API contracts, contact graph, experiment hashes and SEIR results are unchanged.

## Static data and provenance

`frontend/src/data/manta-residential.json` is a derived GeoJSON snapshot from the public OpenStreetMap API, extracted on **2026-10-27 at 07:35:06 UTC**. Its version is `manta-residential-osm-v1`. Each feature records its OSM way ID, version, edit timestamp, source API URL and SHA-256 of the original response. Editor names, user IDs, addresses, buildings and place names are not retained. Derived geographic data is under **ODbL 1.0**, with [OpenStreetMap contributor attribution](https://www.openstreetmap.org/copyright) retained on the map.

| Synthetic reference sector | OSM source | Way version |
|---|---|---|
| synthetic-sector-0 | [1290388697](https://api.openstreetmap.org/api/0.6/way/1290388697/full.json) | 1 |
| synthetic-sector-1 | [1237070572](https://api.openstreetmap.org/api/0.6/way/1237070572/full.json) | 1 |
| synthetic-sector-2 | [412772816](https://api.openstreetmap.org/api/0.6/way/412772816/full.json) | 3 |
| synthetic-sector-3 | [412772820](https://api.openstreetmap.org/api/0.6/way/412772820/full.json) | 5 |
| synthetic-sector-4 | [1426150466](https://api.openstreetmap.org/api/0.6/way/1426150466/full.json) | 1 |

All five sources are small inland areas tagged `landuse=residential` in urban Manta. They were selected as spatial reference areas, not a representative sample of Manta. They are **not** the model's five synthetic neighborhoods, nor official administrative sectors. The API payloads supplied the actual geometry; no polygon was drawn from a bounding box or a representative place coordinate.

The preparer and frontend reject missing evidence, non-residential tags, nonfinite coordinates, unclosed or zero-area rings, self-intersections and geometries outside a coarse Manta envelope. The envelope is only a location sanity check; **strict point-in-polygon membership in the actual residential footprint** defines permitted placement. This resource supports simple closed ways only, not multipolygons or holes. OSM land-use classification is a reference land mask, not authoritative surveying; mapping errors or unmapped interior water cannot be ruled out. No claim of complete city or coastline coverage is made.

## Reproduce preparation

Run from the repository root with Node 24. No OSMnx, Python environment or new package is required.

```powershell
node --experimental-strip-types scripts/prepare-manta-geography.mjs --help
node --experimental-strip-types scripts/prepare-manta-geography.mjs --download --output manta-residential.new.json
```

This makes five bounded public API requests, validates every geometry, strips unrelated tags and writes a **new** resource. Existing files are never overwritten. Review a refreshed resource and bump its version before replacing the checked-in snapshot: live OSM content can change.

For offline preparation, save the five original API responses as `<wayId>.json` in one directory, then run:

```powershell
node --experimental-strip-types scripts/prepare-manta-geography.mjs --source-dir PATH_TO_RESPONSES --extracted-at 2026-10-27T07:35:06Z --output manta-residential.new.json
```

The committed snapshot was prepared offline from the downloaded API responses using that timestamp, with the same validator. Raw responses are not shipped. No geographic API is queried when users create or replay a scenario; only the separate basemap tile layer uses the network.

## Deterministic assignment

The geographic namespace is `mantalab-geography-v1`. A local FNV-1a seed hash and Mulberry32 stream derive from the resource version, root seed, graph hash and household ID. They never consume the backend RNG, modify the graph or write geographic fields into API data.

Nodes are sorted by their original ID. Each household is assigned to a reference sector using its majority synthetic neighborhood, with lexical tie-breaking and a seed-derived sector rotation. This is a presentation rule, not a geographic interpretation of that neighborhood. The backend independently assigns household and neighborhood membership, so a household can contain several neighborhood IDs: household clustering takes precedence, while every original neighborhood ID remains available as context.

An anchor is sampled inside the chosen polygon. Household members receive nearby distinct points, with every rounded coordinate tested again for strict interior membership. Attempts are bounded; failure produces an explicit unavailable message rather than invented fallback points. Source coordinates use GeoJSON `[longitude, latitude]`; Leaflet receives `[latitude, longitude]`.

Assignment reads only the preview, is memoized by preview identity and receives no playback day or policy. Switching views or strategies cannot move agents. A new scenario can produce new coordinates. Every returned `nodeId` is the original `node.id`.

## Rendering and frame semantics

Without individual frames, the preview identifies the initially infectious nodes: those agents are `I` (red), and every other agent starts as `S` (green). This preview precedes intervention. Pending, failed and frame-free comparisons explicitly show this initial fallback; they do not reconstruct individual states from aggregate curves. Invalid previews hide the stale views and unmount the map, clearing selection.

With frames, `SimulationWorkspace` remains the sole playback owner and selects `comparison.representative.frames[policy][day]`. Both views receive that exact array indexed by `nodeId`, together with day, policy and representative index. The source must match the preview's graph hash and complete configuration. Per-frame S/E/I/R totals must match the daily row of that same representative replicate. The aggregate curves are not used for animation. The existing API validator still validates complete frame series before results enter the workspace.

The full S/E/I/R legend uses the existing palette; R retains the backend meaning recovered or immune. Day 0 of a representative policy can already contain vaccination outcomes and need not equal the unvaccinated preview. Headers, counts, legend and selected-agent popups identify the actual selected trajectory.

One Canvas renderer and one CircleMarker per agent are attached to the existing Leaflet instance. Marker layers and deterministic placements are created only for a new preview. Daily/policy updates reuse markers and update styles/radii only when states change. Selection survives playback and tab changes. An open popup receives the current state/day/policy/replicate using DOM text nodes; automatic panning is temporarily disabled during content updates to preserve the camera. Clearing selection closes the popup. Layers, listeners, renderer and ResizeObserver resources are released on replacement/unmount. The demo remains independent. There is one playback timeout, no map-specific playback timer and no API request per day.

## Verification

The frontend suite exercises 50, 1,000 and 2,000 agents: exact ID coverage, strict mask membership, determinism, node-order and visual-xy independence, seed changes, household grouping, initial infections, input immutability, rejected masks, marker selection/colors/cleanup and preprocessing CLI behavior. Representative frames for every policy/day are checked against network states and the representative daily counts. Retained-layer tests cover style updates, stable positions/listeners/Canvas, preserved selection and popup content, no-frame fallback, rejected frames and cleanup. Existing API, export-hash and playback tests remain in the suite.

In the browser, consult a real preview, run **Comparar estrategias**, return to the simulator and select **Mapa**. Select an ID and advance days/change policies: its coordinates and selection must remain stable while its state, day and policy update. Compare S/E/I/R totals between Red and Mapa; play/pause, seek, next day and reset must control both. Switching tabs must keep the clock and camera. Editing scenario parameters must hide old data and clear selection. A comparison without frames must explicitly show the valid initial preview without individual playback.
