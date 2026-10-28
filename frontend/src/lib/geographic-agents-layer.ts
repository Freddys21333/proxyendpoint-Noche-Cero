import type { Map as LeafletMap } from 'leaflet'
import type { GeographicAgent } from './manta-geography.ts'
import { seirColors } from '../components/seir-colors.ts'
import type { SimulationPresentation } from './simulation-playback.ts'

export type AgentMapRuntime = Pick<typeof import('leaflet'), 'canvas' | 'layerGroup' | 'circleMarker'>
export type AgentPresentation = Pick<SimulationPresentation, 'mode' | 'day' | 'policy' | 'frame' | 'representativeIndex'>

export function createGeographicAgentLayer(map: LeafletMap, leaflet: AgentMapRuntime, agents: GeographicAgent[],
  popup: (agent: GeographicAgent, presentation: AgentPresentation) => HTMLElement, onSelect: (id: number) => void) {
  const renderer = leaflet.canvas({ padding: 0.5 })
  const layer = leaflet.layerGroup().addTo(map)
  const markers = new Map<number, ReturnType<AgentMapRuntime['circleMarker']>>()
  const states = new Map(agents.map(agent => [agent.nodeId, agent.state]))
  let current: AgentPresentation = { mode: 'preview', day: 0, policy: 'targeted', frame: undefined, representativeIndex: null }
  const stateAt = (agent: GeographicAgent, presentation: AgentPresentation) =>
    presentation.mode === 'representative' ? presentation.frame?.[agent.nodeId] : agent.state
  let disposed = false
  // Leaflet puede perder el handle RAF cuando fitBounds fuerza un redraw síncrono.
  // Ese callback ya encolado debe ser inocuo incluso después de renderer.remove().
  const canvas = renderer as typeof renderer & { _redraw?: () => void }
  const redraw = canvas._redraw
  if (redraw) canvas._redraw = function () {
    if (!disposed) redraw.call(this)
  }
  const radius = (state: GeographicAgent['state']) => {
    const base = Math.max(2.5, Math.min(7, 3 + (map.getZoom() - 13) * 0.6))
    return state === 'I' ? base * 1.5 : base
  }
  const resizeMarkers = () => {
    if (disposed) return
    for (const [id, marker] of markers) marker.setRadius(radius(states.get(id)!))
  }
  const destroy = () => {
    if (disposed) return
    disposed = true
    map.off('zoomend', resizeMarkers)
    for (const marker of markers.values()) marker.off()
    layer.clearLayers()
    layer.remove()
    renderer.remove()
    markers.clear()
    states.clear()
  }
  try {
    for (const agent of agents) {
      const color = seirColors[agent.state]
      const marker = leaflet.circleMarker([agent.lat, agent.lng], { renderer, radius: radius(agent.state), weight: 0.7,
        color: color.stroke, fillColor: color.marker, fillOpacity: 0.95, bubblingMouseEvents: false })
        .bindPopup(() => popup({ ...agent, state: stateAt(agent, current)! }, current), { maxWidth: 240, maxHeight: 190,
          autoPanPaddingTopLeft: [64, 95], autoPanPaddingBottomRight: [10, 100] })
      marker.on('click', () => { if (!disposed) onSelect(agent.nodeId) })
      marker.addTo(layer)
      markers.set(agent.nodeId, marker)
    }
    // Initial cases remain visible when household members overlap at city-scale zoom.
    for (const agent of agents) if (agent.state === 'I') markers.get(agent.nodeId)!.bringToFront()
    map.on('zoomend', resizeMarkers)
  } catch (error) { destroy(); throw error }
  return {
    highlightPeople: (ids: ReadonlySet<number> | null) => {
      if (disposed) return
      for (const [id, marker] of markers) {
        const matches = ids === null || ids.has(id)
        marker.setStyle({ opacity: matches ? 1 : 0.8, fillOpacity: matches ? 0.95 : 0.65 })
      }
    },
    select: (id: number | null) => {
      if (disposed) return
      if (id === null) map.closePopup()
      else markers.get(id)?.bringToFront().openPopup()
    },
    update: (presentation: AgentPresentation) => {
      if (disposed || (current.mode === presentation.mode && current.day === presentation.day && current.policy === presentation.policy &&
        current.frame === presentation.frame && current.representativeIndex === presentation.representativeIndex)) return
      const nextStates = agents.map(agent => stateAt(agent, presentation))
      if (!nextStates.every(state => state !== undefined && Object.hasOwn(seirColors, state))) throw new Error('Frame individual inválido para los agentes del mapa.')
      current = presentation
      agents.forEach((agent, index) => {
        const marker = markers.get(agent.nodeId)!, state = nextStates[index]!
        if (states.get(agent.nodeId) !== state) {
          const color = seirColors[state]
          marker.setStyle({ color: color.stroke, fillColor: color.marker })
          marker.setRadius(radius(state))
          states.set(agent.nodeId, state)
        }
        if (state === 'I') marker.bringToFront()
        const selectedPopup = marker.getPopup()
        if (selectedPopup?.isOpen()) {
          const autoPan = selectedPopup.options.autoPan
          selectedPopup.options.autoPan = false
          try { selectedPopup.setContent(popup({ ...agent, state }, current)) }
          finally { selectedPopup.options.autoPan = autoPan }
        }
      })
    },
    destroy,
  }
}
