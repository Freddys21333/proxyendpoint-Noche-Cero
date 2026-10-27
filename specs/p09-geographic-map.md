# P-09 — Mapa geográfico y capa de agentes

**Estado:** verificado localmente como presentación. No modifica el modelo, los contratos ni los hashes.
**Frente principal:** frontend. **Contraparte backend:** ninguna nueva; consume `preview` y `compare` vigentes.
**Actualizado:** 2026-10-27.

## 1. Qué registra esta feature

P-09 separa en el seguimiento la capa geográfica que antes vivía solo en `docs/manta-geography.md` y en el historial de `frontend/README.md`. Su objetivo es mostrar a las personas sintéticas del preview sobre un mapa real de referencia de Manta, sin convertir esa geografía en dato epidemiológico, domicilio ni resultado científico.

P-09 **no sustituye** a [P-07](pro-roadmap.md#p-07--completar-visualización-temporal-y-animación-opcional-pro-6):

- **P-07** gobierna la reproducción temporal: frames, día, política, réplica, eventos y animación opcional.
- **P-09** gobierna el mapa base, los polígonos residenciales versionados, la asignación determinista de posiciones y la experiencia de la vista **Mapa**.

La vista **Mapa** consume el mismo día, política, réplica y frames que la vista **Red**. Si P-07 no entrega frames, P-09 debe mostrar el estado inicial válido o un mensaje explícito; nunca inventa una animación.

## 2. Alcance implementado

- Mapa Leaflet con teselas públicas de OpenStreetMap y atribución visible.
- Vista **Red | Mapa** dentro del mismo espacio de trabajo; la cámara y el mapa permanecen montados al cambiar de vista.
- Trece polígonos `landuse=residential` de OSM como máscara de referencia; no son barrios oficiales ni los cinco barrios sintéticos del modelo.
- Asignación de posiciones sintéticas, deterministas y sin consumo del RNG del backend.
- Sincronización con día, política, réplica, reproducción, pausa, velocidad y selección de persona.
- Selector de personas accesible por teclado y reutilización de marcadores entre frames sin reconstruir el mapa.
- Manejo de fallo de teselas con **Reintentar mapa**, sin bloquear la red ni la simulación.
- Movimiento reducido respetado por los controles existentes; no se añaden animaciones decorativas.

## 3. Fuera de alcance

- Domicilios, direcciones, identidades o movilidad real.
- Densidad poblacional, riesgo por barrio, calor, trayectorias o desplazamientos.
- Endpoint `/geography`, campos geográficos en la API o escritura de coordenadas en el grafo/hashes.
- Cálculo epidemiológico en el navegador.
- Descarga offline o precarga de teselas.
- Presentar la capa OSM como validación científica o como los barrios del modelo.

## 4. Datos y reproducibilidad

La fuente y el procedimiento están en [docs/manta-geography.md](../docs/manta-geography.md):

- Recurso versionado: `frontend/src/data/manta-residential.json`, versión `manta-residential-osm-v2`.
- Preparador reproducible: `scripts/prepare-manta-geography.mjs`.
- Espacio de nombres de posiciones: `mantalab-geography-v2`.
- Derivación: FNV-1a local + Mulberry32 a partir de versión del recurso, `rootSeed`, `graphHash` y `householdId`.
- La asignación no consume el RNG del backend, no cambia el experimento y no se escribe en las respuestas de `preview`/`compare`.
- Las posiciones del backend (`positions`) siguen siendo el layout circular de presentación; la UI puede reubicar nodos según [agreements.md](agreements.md) §2 sin alterar `graphHash`.

Licencia y atribución: datos derivados de OpenStreetMap bajo ODbL 1.0; atribución de colaboradores visible en el mapa.

## 5. Contratos

P-09 no añade rutas ni campos. Consume:

| Contrato | Uso en P-09 |
|---|---|
| `POST /v1/scenarios/preview` | IDs de personas, casos iniciales y `graphHash` para derivar posiciones deterministas |
| `POST /v1/simulations/compare` | `representative.frames` y `daily` de la réplica representativa para sincronizar estados |
| `GET /v1/config` | Límites de frames y defaults del escenario |

Regla de consistencia: un frame solo se pinta si pertenece al mismo `graphHash`, configuración y réplica representativa; los conteos del frame deben coincidir con la fila diaria. Si no, se conserva el estado inicial válido y se explica la ausencia de animación.

## 6. Criterios de aceptación

| CA | Criterio | Evidencia |
|---|---|---|
| P09-CA-01 | El mapa abre en Manta con atribución OSM, arrastre y zoom seguro para el scroll | `geographic-map.test.ts` |
| P09-CA-02 | Redimensionar o reintentar conserva un solo mapa; desmontar libera listeners y callbacks tardíos | `geographic-map.test.ts` |
| P09-CA-03 | Un fallo de teselas se muestra sin romper la red ni la simulación | `geographic-map.test.ts` |
| P09-CA-04 | El recurso versionado contiene trece polígonos residenciales terrestres simples y evidencia de origen | `manta-geography.test.ts` |
| P09-CA-05 | Todas las personas reciben posiciones interiores deterministas sin mutar el experimento | `manta-geography.test.ts` |
| P09-CA-06 | Las posiciones dependen de semilla/grafo/hogar, no del orden, del layout visual, de la política ni del día | `manta-geography.test.ts` |
| P09-CA-07 | Los grupos de hogar conservan barrio y solo los casos iniciales reales del preview | `manta-geography.test.ts` |
| P09-CA-08 | Máscaras inválidas se rechazan en vez de inventar ubicaciones | `manta-geography.test.ts` |
| P09-CA-09 | El preparador rechaza opciones desconocidas antes de escribir | `manta-geography.test.ts` |
| P09-CA-10 | Los marcadores conservan ID, estado inicial, color y selección | `geographic-agents-layer.test.ts` |
| P09-CA-11 | Los frames actualizan marcadores y popup sin mover ni reconstruir capas | `geographic-agents-layer.test.ts` |
| P09-CA-12 | Red y Mapa consumen el mismo frame y los mismos conteos diarios por política | `simulation-playback.test.ts` |
| P09-CA-13 | Una comparación de otro grafo/configuración no puede animar un escenario viejo | `simulation-playback.test.ts` |
| P09-CA-14 | Un frame inconsistente con su fila diaria se rechaza sin inventar estados | `simulation-playback.test.ts` |

## 7. Trazabilidad

| Capa | Archivos |
|---|---|
| Componentes | `frontend/src/components/GeographicMap.tsx`, `GeographicMap.css` |
| Lógica de presentación | `frontend/src/lib/geographic-map.ts`, `geographic-agents-layer.ts`, `manta-geography.ts` |
| Datos versionados | `frontend/src/data/manta-residential.json` |
| Preparador | `scripts/prepare-manta-geography.mjs` |
| Reproductor compartido | `frontend/src/components/SimulationWorkspace.tsx`, `frontend/src/lib/simulation-playback.ts` |
| Pruebas | `frontend/src/lib/geographic-map.test.ts`, `manta-geography.test.ts`, `geographic-agents-layer.test.ts`, `simulation-playback.test.ts` |
| Documentación | `docs/manta-geography.md`, `frontend/README.md`, este documento |

## 8. Límites y riesgos

- Las teselas requieren internet y siguen la política de uso de OSM; no hay modo offline.
- OSM puede cambiar; el snapshot está congelado y cualquier refresco exige revisión y cambio de versión.
- La máscara solo admite `way` cerrados simples; no multipolígonos ni agujeros.
- La geografía es una referencia visual: no acredita P-05/P-06 (datos reales y calibración) ni P-08 (informe), y no convierte el escenario ficticio en predicción.

## 9. Relación con la base y con PRO

P-09 no desbloquea por sí sola ninguna dependencia de P-02..P-08. Deja el mapa documentado, probado y separado para que:

- P-07 pueda cerrar su aceptación temporal sin mezclar la deuda del mapa.
- P-05/P-06 no confundan polígonos OSM con datos epidemiológicos.
- P-08 pueda citar límites geográficos correctos si incluye mapas en el informe.
