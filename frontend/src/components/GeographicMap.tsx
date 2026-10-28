import { useEffect, useMemo, useRef, useState } from 'react'
import * as leaflet from 'leaflet'
import { Search, X } from 'lucide-react'
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
const groupNumber = (id: string) => id.replace(/^[a-z-]+-/, '')
const describeAgent = (agent: GeographicAgent, presentation: AgentPresentation) => [
  `Persona ${agent.nodeId}`, `Día ${presentation.day} · ${presentation.mode === 'representative' ? policyLabels[presentation.policy] : 'Estado inicial'}`,
  `Estado: ${stateLabels[agent.state]}`,
  ...(presentation.mode === 'representative' && presentation.representativeIndex !== null ? [`Simulación mostrada: ${presentation.representativeIndex + 1}`] : []),
  'Persona y ubicación simuladas.',
  `Hogar ${groupNumber(agent.householdId)} · Barrio ${groupNumber(agent.neighborhoodId)}`,
  `Zona del mapa: ${groupNumber(agent.sectorId)}`,
  ...([['schoolId', 'Colegio'], ['busId', 'Ruta de bus'], ['marketId', 'Mercado']] as const)
    .filter(([key]) => agent[key] !== null).map(([key, label]) => `${label}: ${groupNumber(agent[key]!)}`),
]
function agentPopup(agent: GeographicAgent, presentation: AgentPresentation, onChooseOrigin?: (id: number) => void) {
  const content = document.createElement('div')
  content.className = 'geographic-agent-popup'
  for (const [index, line] of describeAgent(agent, presentation).entries()) {
    const row = document.createElement('p')
    row.textContent = line
    content.append(row)
    if (index === 2 && onChooseOrigin) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'origin-person-action'
      button.textContent = 'Elegir como origen del brote'
      button.addEventListener('click', () => onChooseOrigin(agent.nodeId))
      content.append(button)
    }
  }
  return content
}

export default function GeographicMap({ visible, preview, playback, resetKey, selectedPersonId, onSelectPerson, focusRequest, onChooseOrigin, highlightedIds }: {
  visible: boolean; preview: PreviewResponse; playback: SimulationPresentation; resetKey: number;
  selectedPersonId: string; onSelectPerson: (id: string) => void; focusRequest: { id: number; version: number } | null;
  onChooseOrigin?: (id: number) => void;
  highlightedIds: ReadonlySet<number> | null;
}) {
  const container = useRef<HTMLDivElement>(null)
  const controller = useRef<ReturnType<typeof mountGeographicMap> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedId = selectedPersonId === '' ? null : Number(selectedPersonId)
  const originHandler = useRef(onChooseOrigin)
  useEffect(() => { originHandler.current = onChooseOrigin }, [onChooseOrigin])
  const lastResetKey = useRef(resetKey)
  const [personQuery, setPersonQuery] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const placement = useMemo(() => {
    try { return { agents: assignGeographicAgents(preview, geographicResource), error: null } }
    catch { return { agents: [], error: 'No se pudieron validar las ubicaciones sintéticas. Se conserva solamente el mapa base.' } }
  }, [preview])

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
    setPersonQuery('')
    setSearchError(null)
    try { controller.current?.setAgents(placement.agents, (agent, presentation) => agentPopup(agent, presentation, originHandler.current ? id => originHandler.current?.(id) : undefined), id => {
      onSelectPerson(String(id)); setPersonQuery(String(id)); setSearchError(null)
    }) }
    catch { setError('No se pudieron dibujar los agentes. La vista Red sigue disponible.') }
  }, [placement, onSelectPerson])
  useEffect(() => {
    try { controller.current?.updateAgents(playback) }
    catch { setError('No se pudo actualizar la trayectoria individual. La vista Red sigue disponible.') }
  }, [playback, placement])
  useEffect(() => { controller.current?.highlightPeople(highlightedIds) }, [highlightedIds, placement])
  useEffect(() => { controller.current?.selectAgent(visible ? selectedId : null) }, [visible, selectedId, placement])
  useEffect(() => {
    if (lastResetKey.current === resetKey) return
    lastResetKey.current = resetKey
    controller.current?.recenter()
  }, [resetKey])
  useEffect(() => {
    if (!visible || !focusRequest || focusRequest.id !== selectedId) return
    const person = placement.agents.find(agent => agent.nodeId === focusRequest.id)
    if (person) { controller.current?.focusAgent(person); setPersonQuery(String(person.nodeId)); setSearchError(null) }
  }, [focusRequest, visible, placement, selectedId])

  return <div className="geographic-map">
    <div ref={container} className="geographic-map-canvas" role="region" aria-label="Mapa interactivo de Manta, Ecuador" />
    <div className="geographic-agent-legend" aria-label="Leyenda de estados SEIR">
      <strong>{playback.mode === 'representative' ? `Día ${playback.day} · ${policyLabels[playback.policy]} · Réplica ${playback.representativeIndex}` : 'Estado inicial · Sin reproducción individual'} · {placement.agents.length} agentes</strong>
      <div>{(Object.keys(stateLabels) as (keyof typeof stateLabels)[]).map(state => <span key={state}>
        <i aria-hidden="true" style={{ background: seirColors[state].marker }} />{state} · {stateLabels[state]}
      </span>)}</div>
    </div>
    {placement.agents.length > 0 && <details className="geographic-agent-picker">
      <summary><Search size={15} aria-hidden="true" />Buscar persona</summary>
      <form noValidate onSubmit={event => {
        event.preventDefault()
        const value = personQuery.trim()
        const person = /^\d+$/.test(value) ? placement.agents.find(agent => agent.nodeId === Number(value)) : undefined
        if (!person) { setSearchError('Escribe el número de una persona de este escenario.'); return }
        setSearchError(null); onSelectPerson(String(person.nodeId)); controller.current?.focusAgent(person)
      }}>
        <p className="geographic-search-help">Cada punto es una persona. Pulsa un punto para ver su ficha o busca por número.</p>
        <label htmlFor="map-person-search">Número de persona (0 a {preview.graph.nodes.length - 1})</label>
        <div className="geographic-person-search-row">
          <input id="map-person-search" type="search" inputMode="numeric" autoComplete="off"
            placeholder={`Ej. ${placement.agents[0].nodeId}`} value={personQuery}
            aria-invalid={Boolean(searchError)} aria-describedby={searchError ? 'map-person-search-error' : undefined}
            onChange={event => { setPersonQuery(event.target.value); setSearchError(null) }} />
          <button type="submit">Ver persona</button>
        </div>
        {searchError && <p id="map-person-search-error" role="alert">{searchError}</p>}
        {selectedId !== null && <button type="button" className="geographic-person-clear" onClick={() => {
          onSelectPerson(''); setPersonQuery(''); setSearchError(null)
        }}><X size={13} aria-hidden="true" />Quitar selección</button>}
      </form>
    </details>}
    {(error || placement.error) && <div className="geographic-map-error" role="status">
      <p>{error || placement.error}</p>
      {controller.current && <button type="button" onClick={() => controller.current?.retry()}>Reintentar mapa</button>}
    </div>}
  </div>
}
