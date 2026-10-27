import type { Map as LeafletMap, TileEvent, TileLayer } from 'leaflet'
import type { GeographicAgent } from './manta-geography.ts'
import { createGeographicAgentLayer, type AgentMapRuntime, type AgentPresentation } from './geographic-agents-layer.ts'

export type MapRuntime = Pick<typeof import('leaflet'), 'map' | 'tileLayer'> & AgentMapRuntime

// A presentation camera only; this location is never assigned to a simulated person.
const mantaCenter: [number, number] = [-0.9677, -80.7089]
const tileError = 'No se pudo cargar parte del mapa de OpenStreetMap. Revisa tu conexión o reintenta.'

export function mountGeographicMap(container: HTMLElement, leaflet: MapRuntime, onError: (message: string | null) => void) {
  let map: LeafletMap | undefined
  let tiles: TileLayer | undefined
  let agents: ReturnType<typeof createGeographicAgentLayer> | undefined
  let destroyed = false
  const failedTiles = new Set<HTMLElement>()
  const report = () => { if (!destroyed) onError(failedTiles.size ? tileError : null) }
  const events = {
    tileerror: (event: TileEvent) => { failedTiles.add(event.tile); report() },
    tileload: (event: TileEvent) => { failedTiles.delete(event.tile); report() },
    tileunload: (event: TileEvent) => { failedTiles.delete(event.tile); report() },
  }
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    agents?.destroy()
    tiles?.off(events)
    map?.remove()
    failedTiles.clear()
  }

  try {
    map = leaflet.map(container, {
      scrollWheelZoom: false, dragging: true, zoomControl: true, attributionControl: true,
    })
    map.setView(mantaCenter, 13)
    tiles = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
    tiles.on(events)
    tiles.addTo(map)
  } catch (error) {
    destroy()
    throw error
  }

  return {
    setAgents: (values: GeographicAgent[], popup: (agent: GeographicAgent, presentation: AgentPresentation) => HTMLElement, onSelect: (id: number) => void) => {
      if (destroyed) return
      agents?.destroy()
      agents = createGeographicAgentLayer(map!, leaflet, values, popup, onSelect)
    },
    selectAgent: (id: number | null) => { if (!destroyed) agents?.select(id) },
    updateAgents: (presentation: AgentPresentation) => { if (!destroyed) agents?.update(presentation) },
    resize: () => { if (!destroyed) map!.invalidateSize({ pan: false }) },
    retry: () => {
      if (destroyed) return
      failedTiles.clear()
      report()
      tiles!.redraw()
    },
    destroy,
  }
}
