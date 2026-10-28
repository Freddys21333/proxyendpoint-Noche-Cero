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
  let pendingBounds: [number, number][] | null = null
  let agentBounds: [number, number][] | null = null
  let destroyed = false
  let highlightedIds: ReadonlySet<number> | null = null
  const fitAgents = () => {
    if (!pendingBounds || !container.clientWidth || !container.clientHeight) return
    map!.fitBounds(pendingBounds, {
      paddingTopLeft: [24, 76], paddingBottomRight: [24, 112], maxZoom: 16, animate: false,
    })
    pendingBounds = null
  }
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
    pendingBounds = null
    agentBounds = null
    tiles?.off(events)
    map?.remove()
    failedTiles.clear()
  }

  try {
    map = leaflet.map(container, {
      scrollWheelZoom: true, zoomAnimation: false, dragging: true, zoomControl: true, attributionControl: true, zoomSnap: 0.25,
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
      if (highlightedIds !== null) agents.highlightPeople(highlightedIds)
      agentBounds = values.length ? values.map(agent => [agent.lat, agent.lng]) : null
      pendingBounds = agentBounds
      fitAgents()
    },
    selectAgent: (id: number | null) => { if (!destroyed) agents?.select(id) },
    highlightPeople: (ids: ReadonlySet<number> | null) => {
      if (destroyed) return
      highlightedIds = ids
      agents?.highlightPeople(ids)
    },
    recenter: () => {
      if (destroyed) return
      map!.closePopup()
      map!.invalidateSize({ pan: false })
      pendingBounds = agentBounds
      fitAgents()
    },
    focusAgent: (agent: GeographicAgent) => {
      if (destroyed) return
      map!.setView([agent.lat, agent.lng], Math.max(map!.getZoom(), 16), { animate: false })
      agents?.select(agent.nodeId)
    },
    updateAgents: (presentation: AgentPresentation) => { if (!destroyed) agents?.update(presentation) },
    resize: () => { if (!destroyed) { map!.invalidateSize({ pan: false }); fitAgents() } },
    retry: () => {
      if (destroyed) return
      failedTiles.clear()
      report()
      tiles!.redraw()
    },
    destroy,
  }
}
