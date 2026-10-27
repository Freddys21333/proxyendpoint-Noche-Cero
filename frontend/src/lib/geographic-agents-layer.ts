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
  const destroy = () => {
    if (disposed) return
    disposed = true
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
      const marker = leaflet.circleMarker([agent.lat, agent.lng], { renderer, radius: agent.state === 'I' ? 5.5 : 3.5, weight: 1.5,
        color: color.stroke, fillColor: color.marker, fillOpacity: 0.95, bubblingMouseEvents: false })
        .bindPopup(() => popup({ ...agent, state: stateAt(agent, current)! }, current), { maxWidth: 240, maxHeight: 190,
          autoPanPaddingTopLeft: [64, 95], autoPanPaddingBottomRight: [10, 100] })
      marker.on('click', () => { if (!disposed) onSelect(agent.nodeId) })
      marker.addTo(layer)
      markers.set(agent.nodeId, marker)
    }
    // Initial cases remain visible when household members overlap at city-scale zoom.
    for (const agent of agents) if (agent.state === 'I') markers.get(agent.nodeId)!.bringToFront()
  } catch (error) { destroy(); throw error }
  return {
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
          marker.setRadius(state === 'I' ? 5.5 : 3.5)
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
