import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import cytoscape from 'cytoscape'
import { Crosshair, Pause, Play, RotateCcw, StepForward, ZoomIn, ZoomOut } from 'lucide-react'
import type { PreviewResponse, CompareResponse, Policy, VaccinationSelection } from '@/lib/api'
import { policyLabels } from '@/lib/comparison'
import { networkPositions, layoutModes, type NetworkLayout } from '@/lib/network-layout'
import { previewNetwork } from '@/lib/preview-network'
import { Button } from './ui/button'
import { vaccinationsAtDay } from '@/lib/vaccination'
import { VaccinationDetails, VaccinationPerson } from './VaccinationDetails'
import { seirColors } from './seir-colors'
import { simulationModeMessages, type SimulationPlayback, type ComparisonState } from '@/lib/simulation-playback'
import './ContactNetwork.css'

const labels = { S: 'Sano', E: 'Mordido', I: 'Zombie', R: 'Exorcizado' }
const noSelections: VaccinationSelection[] = []
const groups = [ ['householdId', 'Hogar'], ['schoolId', 'Colegio'], ['busId', 'Ruta de bus'], ['marketId', 'Mercado'], ['neighborhoodId', 'Barrio'] ] as const

export type PreviewNetworkProps = {
  preview: PreviewResponse; layer: string; resetKey: number; children?: ReactNode; active?: boolean; comparison?: CompareResponse | null; comparisonState?: ComparisonState
}

export function PreviewNetwork({ preview, layer, resetKey, children, active = true, comparison = null, playback, view = 'network', viewSelector, mapView }: PreviewNetworkProps & {
  playback: SimulationPlayback; view?: 'network' | 'map'; viewSelector?: ReactNode; mapView?: ReactNode
}) {
  const inspector = useRef<HTMLDetailsElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const network = useRef<cytoscape.Core | null>(null)
  const [layout, setLayout] = useState<NetworkLayout>('neighborhoodId')
  const [selected, setSelected] = useState('')
  const { day: currentDay, policy, playing, speed, frames, lastDay, frame, dispatch } = playback
  const showNetwork = view === 'network'
  const hasComparison = active && comparison && (playback.mode === 'representative' || playback.mode === 'no-frames')
  const selections = hasComparison ? comparison!.replicates[comparison!.representative.index].policies[policy].selections : noSelections
  const applied = useMemo(() => vaccinationsAtDay(selections, currentDay), [selections, currentDay])
  const dose = applied.find(row => String(row.nodeId) === selected)
  const pickerId = useId()
  const graph = useMemo(() => previewNetwork(preview, layer, currentDay, frame, frames ? selections : noSelections), [preview, layer, currentDay, frame, selections])
  const visibleCounts = playback.counts
  const positions = useMemo(() => networkPositions(preview, layout), [preview, layout])
  const detail = preview.graph.nodes.find(n => String(n.id) === selected)
  const selectedState = graph.nodes.find(n => n.data.id === selected)?.data.state ?? 'S'

  useEffect(() => {
    if (!container.current || !active) return
    const cy = cytoscape({ container: container.current, elements: graph.elements,
      layout: { name: 'preset' }, minZoom: 0.01, maxZoom: 5, boxSelectionEnabled: false, selectionType: 'single',
      style: [
        { selector: 'node', style: { width: 15, height: 15, 'background-color': seirColors.S.marker, 'border-width': 1, 'border-color': '#334155', label: 'data(groupLabel)', 'font-size': 15, 'text-valign': 'top', 'text-margin-y': -14, 'text-background-color': '#ffffff', 'text-background-opacity': 0.9, 'text-background-padding': '4px' } },
        { selector: 'node[state="I"]', style: { width: 23, height: 23, 'background-color': seirColors.I.marker, 'font-size': 14, 'text-valign': 'top', 'text-margin-y': -10, 'text-background-color': '#ffffff', 'text-background-opacity': 0.9 } },
        { selector: 'node[state="E"]', style: { 'background-color': seirColors.E.marker } },
        { selector: 'node[state="R"]', style: { 'background-color': seirColors.R.marker } },
        { selector: 'node[!inLayer]', style: { opacity: 0.15 } },
        { selector: 'edge', style: { display: 'none', width: 1, 'line-color': '#a8c0b2', 'curve-style': 'bezier' } },
        { selector: 'edge.focused', style: { display: 'element', 'line-color': '#315d47', width: 2, opacity: 1 } },
        { selector: 'node[vaccination="effective"]', style: { 'border-width': 4, 'border-color': '#7c3aed', 'border-style': 'solid' } },
        { selector: 'node[vaccination="ineffective"]', style: { 'border-width': 4, 'border-color': '#7c3aed', 'border-style': 'dashed' } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#173e32', opacity: 1 } },
      ],
    })
    network.current = cy
    cy.on('tap', 'node', event => setSelected(event.target.id()))
    cy.on('tap', event => { if (event.target === cy) setSelected('') })
    let viewportSize = ''
    const resize = new ResizeObserver(() => {
      const width = container.current?.clientWidth ?? 0
      const height = container.current?.clientHeight ?? 0
      if (!width || !height) return
      const size = `${width}:${height}`
      cy.resize()
      if (size !== viewportSize) cy.fit(undefined, 20)
      viewportSize = size
    })
    resize.observe(container.current)
    cy.fit(undefined, 20)
    return () => { resize.disconnect(); cy.destroy(); network.current = null }
  }, [preview, active])

  useEffect(() => { setSelected('') }, [preview])

  useEffect(() => {
    const cy = network.current
    if (!cy) return
    cy.batch(() => {
      cy.edges().remove()
      for (const node of graph.nodes) {
        const visual = cy.getElementById(node.data.id)
        visual.data({ ...node.data, groupLabel: visual.data('groupLabel') ?? '' })
      }
      cy.add(graph.edges)
    })
  }, [graph, active])

  useEffect(() => {
    const cy = network.current
    if (!cy) return
    cy.batch(() => {
      for (const position of positions) {
        const node = cy.getElementById(String(position.nodeId))
        node.position({ x: position.x, y: position.y })
        node.data('groupLabel', position.label)
      }
    })
    cy.fit(undefined, 45)
  }, [positions, active])

  useEffect(() => { network.current?.fit(undefined, 45) }, [resetKey])
  useEffect(() => { if (showNetwork) network.current?.resize() }, [showNetwork])
  useEffect(() => {
    const cy = network.current
    if (!cy) return
    cy.elements().removeClass('focused')
    cy.nodes().unselect()
    if (selected) { const node = cy.getElementById(selected); node.select(); node.connectedEdges().addClass('focused') }
  }, [selected, graph])

  const zoom = (factor: number) => {
    const cy = network.current
    if (cy) cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
  }
  return <div className="simulator-workbench network-workbench">
    {!active ? <section className="network-demo-panel" aria-label="Vista previa pendiente"><h2>Vista previa pendiente</h2><p>La configuración cambió. Consulta la red para mostrar la población actual.</p></section> : <section className="network-demo-panel" aria-label={showNetwork ? 'Red real de la vista previa' : 'Mapa geográfico de Manta'}>
      <header className="network-demo-heading"><h2>{showNetwork ? 'Red de contactos' : 'Mapa de Manta'}</h2>{viewSelector}<span>{frames ? `Réplica ${playback.representativeIndex} · ${policyLabels[policy]}` : 'Vista previa'} · {graph.nodes.length} personas · Día {currentDay}</span></header>
      <p className="network-meaning">{showNetwork ? selected ? `Persona ${selected} · ${graph.neighbors[selected]?.length ?? 0} contactos distintos en este día y filtro. Solo se muestran sus conexiones directas. Haz clic en el fondo para ocultarlas.` : 'Cada punto es una persona. Selecciona un nodo o busca una persona para ver solo sus conexiones del día y filtro actuales.' : `Ubicaciones sintéticas, sin domicilios reales. ${simulationModeMessages[playback.mode]}`}</p>
      <div className="seir-instrument" aria-label={frames ? 'Estados de la población en el día seleccionado' : 'Estados iniciales de la población del preview'}>
        {(Object.keys(labels) as (keyof typeof labels)[]).map(state => <div key={state} aria-label={`${labels[state]}: ${visibleCounts[state]}`} style={{ '--state-color': seirColors[state].marker } as CSSProperties}>
          <span className="seir-instrument-label"><span className="seir-status-dot" aria-hidden="true" /><b>{state}</b> {labels[state]}</span><strong>{visibleCounts[state]}</strong>
        </div>)}
      </div>
      <div className="network-view" hidden={!showNetwork}>
        <div ref={container} className="network-canvas" role="img" aria-label={`Red real de ${graph.nodes.length} personas sintéticas, contactos del día ${currentDay}. Seleccione una persona o use el selector.`} />
        <div className="graph-day-label">{frames ? `Día ${currentDay} · ${policyLabels[policy]}` : 'Estado inicial · sin vacunación'}</div>
        <div className="network-zoom" aria-label="Herramientas de exploración">
          <button type="button" aria-label="Acercar red" onClick={() => zoom(1.25)}><ZoomIn size={17} /></button>
          <button type="button" aria-label="Alejar red" onClick={() => zoom(0.8)}><ZoomOut size={17} /></button>
          <button type="button" aria-label="Ajustar grafo a la vista" onClick={() => network.current?.fit(undefined, 20)}><Crosshair size={17} /></button>
        </div>
      </div>
      {mapView}
      <p className="network-playback-status">Semilla {preview.configuration.rootSeed}.{frames ? ` Réplica representativa ${playback.representativeIndex} (índice desde 0). No es el promedio de las réplicas.` : ` Origen: ${preview.initialInfectiousNodeIds.join(', ')}.`}{showNetwork && ' Las personas sin contactos del filtro se atenúan.'}</p>
      <details ref={inspector} className="node-inspector" hidden={!showNetwork} open={Boolean(detail)} aria-label="Información de la persona seleccionada">
        <summary>Explorar personas</summary>
        <label htmlFor={pickerId}>Buscar persona por número</label>
        <select id={pickerId} value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">Seleccione una persona</option>
          {preview.graph.nodes.map(node => <option key={node.id} value={String(node.id)}>Persona {String(node.id).padStart(3, '0')}</option>)}
        </select>
        {detail && <div className="node-context" aria-live="polite">
          <div className="node-context-id">Persona <strong>{String(detail.id).padStart(3, '0')}</strong> · {labels[selectedState]}</div>
          <dl><div><dt>Contactos distintos visibles</dt><dd>{graph.neighbors[selected]?.length ?? 0}</dd></div>
            {groups.map(([key, label]) => detail[key] !== null && <div key={key}><dt>{label}</dt><dd>{detail[key]}</dd></div>)}</dl>
          {frames && (dose ? <VaccinationPerson selection={dose} /> : <p>{policy === 'none' ? 'Sin intervención: no se aplican vacunas.' : currentDay < comparison!.configuration.intervention.interventionDay ? `Intervención pendiente para el día ${comparison!.configuration.intervention.interventionDay}. Aún no recibió una dosis.` : 'No recibió una dosis en esta estrategia. El estado actual no determina por sí solo su elegibilidad al decidir.'}</p>)}
          <button className="plain-action" onClick={() => network.current?.fit(network.current.getElementById(selected).closedNeighborhood(), 45)}><Crosshair size={14} /> Enfocar conexiones</button>
          <button type="button" className="plain-action" onClick={() => setSelected('')}>Ocultar conexiones y quitar selección</button>
        </div>}
      </details>
    </section>}
    <div className="simulator-control-column">
      <section className="temporal-chart-panel real-playback" aria-label="Reproducción de réplica real">
        <h3>{frames ? 'Réplica representativa' : 'Estado inicial'}</h3>
        {frames ? <>
          <p>Trayectoria real de una réplica. Los promedios y rangos están en Comparación.</p>
          <label>Estrategia <select aria-label="Estrategia de la animación" value={policy} onChange={event => dispatch({ type: 'policy', policy: event.target.value as Policy })}>{(['none', 'random', 'targeted'] as const).map(p => <option key={p} value={p}>{policyLabels[p]}</option>)}</select></label>
          <div className="network-playback" role="group" aria-label="Reproductor de simulación real">
            <div className="playback-time"><span>Día actual</span><strong>{currentDay} <small>/ {lastDay}</small></strong></div>
            <div className="playback-actions">
              <Button type="button" variant="ghost" aria-label="Reproducir simulación" title="Reproducir" disabled={playing} onClick={() => dispatch({ type: 'toggle' })}><Play size={17} /></Button>
              <Button type="button" variant="ghost" aria-label="Pausar simulación" title="Pausar" disabled={!playing} onClick={() => dispatch({ type: 'pause' })}><Pause size={17} /></Button>
              <Button type="button" variant="ghost" aria-label="Reiniciar simulación" title="Volver al día 0" onClick={() => dispatch({ type: 'reset' })}><RotateCcw size={17} /></Button>
              <Button type="button" variant="ghost" aria-label="Avanzar un día" title="Día siguiente" disabled={currentDay >= lastDay} onClick={() => dispatch({ type: 'step' })}><StepForward size={17} /></Button>
            </div>
            <label className="playback-timeline"><span>{playing ? 'Reproduciendo' : currentDay === lastDay ? 'Final de la réplica' : 'Explorar días'}</span><input aria-label="Día de la réplica" type="range" min={0} max={lastDay} value={currentDay} onChange={event => dispatch({ type: 'seek', day: Number(event.target.value) })} /></label>
            <label className="playback-speed"><span>Velocidad</span><select aria-label="Velocidad de reproducción" value={speed} onChange={event => dispatch({ type: 'speed', speed: Number(event.target.value) })}><option value={1400}>0,5×</option><option value={700}>1×</option><option value={350}>2×</option><option value={175}>4×</option></select></label>
          </div>
          <p role="status">Día {currentDay} · {playing ? 'Reproduciendo' : currentDay === lastDay ? 'Final de la réplica' : 'En pausa'}. Los contactos y colores corresponden a este día.</p>
          <p>R incluye personas recuperadas o inmunizadas. Las vacunas se aplican al registrar el día {comparison!.configuration.intervention.interventionDay}.</p>
        </> : <><p role="status">{simulationModeMessages[playback.mode]}</p><p>Las vacunas se aplican al ejecutar la simulación, no en este preview.</p></>}
      </section>
      {hasComparison && !frames && <label>Estrategia del registro de vacunación <select aria-label="Estrategia del registro de vacunación" value={policy} onChange={event => dispatch({ type: 'policy', policy: event.target.value as Policy })}>{(['none', 'random', 'targeted'] as const).map(p => <option key={p} value={p}>{policyLabels[p]}</option>)}</select></label>}
      {hasComparison && <VaccinationDetails selections={selections} day={frames ? currentDay : comparison!.configuration.scenario.days} interventionDay={comparison!.configuration.intervention.interventionDay} vaccines={comparison!.configuration.intervention.vaccines} policy={policy} selectedId={frames ? undefined : selected} onSelect={id => { setSelected(id); dispatch({ type: 'pause' }); if (frames) requestAnimationFrame(() => inspector.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })) }} />}
      <div className="network-layout-control" hidden={!showNetwork}>
        <label>Organizar personas por <select aria-label="Distribución visual de la red" value={layout} onChange={event => { setLayout(event.target.value as NetworkLayout); dispatch({ type: 'pause' }) }}>{Object.entries(layoutModes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p>Agrupación visual según pertenencia real; no es un mapa geográfico. El filtro de contactos funciona por separado.</p>
      </div>
      {children}
    </div>
  </div>
}
