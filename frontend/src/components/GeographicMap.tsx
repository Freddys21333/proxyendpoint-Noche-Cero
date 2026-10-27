import { useEffect, useMemo, useRef, useState } from 'react'
import * as leaflet from 'leaflet'
import { mountGeographicMap } from '@/lib/geographic-map'
import { assignGeographicAgents, type GeographicAgent } from '@/lib/manta-geography'
import type { PreviewResponse } from '@/lib/api'
import type { SimulationPresentation } from '@/lib/simulation-playback'
import type { AgentPresentation } from '@/lib/geographic-agents-layer'
import { policyLabels } from '@/lib/comparison'
import geographicResource from '@/data/manta-residential.json'
import { seirColors } from './seir-colors'
import 'leaflet/dist/leaflet.css'
import './GeographicMap.css'

const stateLabels = { S: 'Sano', E: 'Mordido', I: 'Zombie', R: 'Exorcizado (recuperado o inmune)' }
const describeAgent = (agent: GeographicAgent, presentation: AgentPresentation) => [
  `Agente ${agent.nodeId}`, `Día ${presentation.day} · ${presentation.mode === 'representative' ? policyLabels[presentation.policy] : 'Estado inicial'}`,
  `Estado: ${agent.state} · ${stateLabels[agent.state]}`,
  ...(presentation.mode === 'representative' ? [`Réplica representativa: ${presentation.representativeIndex}`] : []),
  `Hogar sintético: ${agent.householdId}`, `Barrio sintético: ${agent.neighborhoodId}`,
  `Sector geográfico sintético: ${agent.sectorId}`,
  ...([['schoolId', 'Colegio'], ['busId', 'Ruta de bus'], ['marketId', 'Mercado']] as const)
    .filter(([key]) => agent[key] !== null).map(([key, label]) => `${label}: ${agent[key]}`),
]
function agentPopup(agent: GeographicAgent, presentation: AgentPresentation) {
  const content = document.createElement('div')
  content.className = 'geographic-agent-popup'
  for (const line of describeAgent(agent, presentation)) {
    const row = document.createElement('p')
    row.textContent = line
    content.append(row)
  }
  return content
}

export default function GeographicMap({ visible, preview, playback }: { visible: boolean; preview: PreviewResponse; playback: SimulationPresentation }) {
  const container = useRef<HTMLDivElement>(null)
  const controller = useRef<ReturnType<typeof mountGeographicMap> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const placement = useMemo(() => {
    try { return { agents: assignGeographicAgents(preview, geographicResource), error: null } }
    catch { return { agents: [], error: 'No se pudieron validar las ubicaciones sintéticas. Se conserva solamente el mapa base.' } }
  }, [preview])
  const agentOptions = useMemo(() => placement.agents.map(agent => <option key={agent.nodeId} value={agent.nodeId}>Agente {agent.nodeId}</option>), [placement.agents])

  useEffect(() => {
    if (!container.current) return
    let resize: ResizeObserver | undefined
    try {
      const view = mountGeographicMap(container.current, leaflet, setError)
      controller.current = view
      resize = new ResizeObserver(() => {
        if (container.current?.clientWidth && container.current.clientHeight) view.resize()
      })
      resize.observe(container.current)
    } catch {
      controller.current?.destroy()
      controller.current = null
      setError('No se pudo abrir el mapa. Puedes continuar en la vista Red.')
    }
    return () => {
      resize?.disconnect()
      controller.current?.destroy()
      controller.current = null
    }
  }, [])

  useEffect(() => { if (visible) controller.current?.resize() }, [visible])
  useEffect(() => {
    setSelectedId(null)
    try { controller.current?.setAgents(placement.agents, agentPopup, setSelectedId) }
    catch { setError('No se pudieron dibujar los agentes. La vista Red sigue disponible.') }
  }, [placement])
  useEffect(() => {
    try { controller.current?.updateAgents(playback) }
    catch { setError('No se pudo actualizar la trayectoria individual. La vista Red sigue disponible.') }
  }, [playback, placement])
  useEffect(() => { controller.current?.selectAgent(selectedId) }, [selectedId])

  return <div className="geographic-map">
    <div ref={container} className="geographic-map-canvas" role="region" aria-label="Mapa interactivo de Manta, Ecuador" />
    <div className="geographic-agent-legend" aria-label="Leyenda de estados SEIR">
      <strong>{playback.mode === 'representative' ? `Día ${playback.day} · ${policyLabels[playback.policy]} · Réplica ${playback.representativeIndex}` : 'Estado inicial · Sin reproducción individual'} · {placement.agents.length} agentes</strong>
      <div>{(Object.keys(stateLabels) as (keyof typeof stateLabels)[]).map(state => <span key={state}>
        <i aria-hidden="true" style={{ background: seirColors[state].marker }} />{state} · {stateLabels[state]}
      </span>)}</div>
    </div>
    {placement.agents.length > 0 && <label className="geographic-agent-picker">Explorar agente
      <select aria-label="Agente en el mapa" value={selectedId ?? ''} onChange={event => setSelectedId(event.target.value === '' ? null : Number(event.target.value))}>
        <option value="">Selecciona un identificador</option>
        {agentOptions}
      </select>
    </label>}
    {(error || placement.error) && <div className="geographic-map-error" role="status">
      <p>{error || placement.error}</p>
      {controller.current && <button type="button" onClick={() => controller.current?.retry()}>Reintentar mapa</button>}
    </div>}
  </div>
}
