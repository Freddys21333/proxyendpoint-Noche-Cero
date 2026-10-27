import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import cytoscape from 'cytoscape'
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react'
import type { PreviewResponse, CompareResponse, Policy } from '@/lib/api'
import { policyLabels } from '@/lib/comparison'
import { previewNetwork } from '@/lib/preview-network'
import { Button } from './ui/button'
import { seirColors } from './seir-colors'
import './ContactNetwork.css'

const labels = { S: 'Sano', E: 'Mordido', I: 'Zombie', R: 'Exorcizado' }
const groups = [ ['householdId', 'Hogar'], ['schoolId', 'Colegio'], ['busId', 'Ruta de bus'], ['marketId', 'Mercado'], ['neighborhoodId', 'Barrio'] ] as const

export function PreviewNetwork({ preview, layer, resetKey, children, active = true, comparison = null }: {
  preview: PreviewResponse; layer: string; resetKey: number; children?: ReactNode; active?: boolean; comparison?: CompareResponse | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const network = useRef<cytoscape.Core | null>(null)
  const [selected, setSelected] = useState('')
  const [day, setDay] = useState(0)
  const [policy, setPolicy] = useState<Policy>('targeted')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(700)
  const frames = active ? comparison?.representative.frames : null
  const lastDay = frames ? comparison!.configuration.scenario.days : 0
  const currentDay = Math.min(day, lastDay)
  const frame = frames?.[policy][currentDay]
  useEffect(() => { setDay(0); setPlaying(false) }, [comparison, active])
  useEffect(() => {
    if (!playing || !frames || currentDay >= lastDay) { setPlaying(false); return }
    const timer = window.setTimeout(() => setDay(value => value + 1), speed)
    return () => window.clearTimeout(timer)
  }, [playing, frames, currentDay, lastDay, speed])
  const pickerId = useId()
  const graph = useMemo(() => previewNetwork(preview, layer, currentDay, frame), [preview, layer, currentDay, frame])
  const detail = preview.graph.nodes.find(n => String(n.id) === selected)
  const selectedState = graph.nodes.find(n => n.data.id === selected)?.data.state ?? 'S'

  useEffect(() => {
    if (!container.current || !active) return
    const cy = cytoscape({ container: container.current, elements: graph.elements,
      layout: { name: 'preset' }, minZoom: 0.01, maxZoom: 5, boxSelectionEnabled: false, selectionType: 'single',
      style: [
        { selector: 'node', style: { width: 15, height: 15, 'background-color': seirColors.S.marker, 'border-width': 1, 'border-color': '#334155' } },
        { selector: 'node[state="I"]', style: { width: 23, height: 23, 'background-color': seirColors.I.marker, 'font-size': 14, 'text-valign': 'top', 'text-margin-y': -10, 'text-background-color': '#ffffff', 'text-background-opacity': 0.9 } },
        { selector: 'node[state="E"]', style: { 'background-color': seirColors.E.marker } },
        { selector: 'node[state="R"]', style: { 'background-color': seirColors.R.marker } },
        { selector: 'node[!inLayer]', style: { opacity: 0.15 } },
        { selector: 'edge', style: { width: 1, 'line-color': '#a8c0b2', opacity: 0.4, 'curve-style': 'bezier' } },
        { selector: '.focused', style: { 'line-color': '#315d47', width: 2, opacity: 1 } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#173e32', opacity: 1 } },
      ],
    })
    network.current = cy
    cy.on('tap', 'node', event => setSelected(event.target.id()))
    cy.on('tap', event => { if (event.target === cy) setSelected('') })
    const resize = new ResizeObserver(() => { cy.resize(); cy.fit(undefined, 20) })
    resize.observe(container.current)
    cy.fit(undefined, 20)
    return () => { resize.disconnect(); cy.destroy(); network.current = null }
  }, [preview, active])

  useEffect(() => {
    const cy = network.current
    if (!cy) return
    cy.batch(() => {
      cy.edges().remove()
      for (const node of graph.nodes) cy.getElementById(node.data.id).data(node.data)
      cy.add(graph.edges)
    })
  }, [graph, active])

  useEffect(() => { network.current?.fit(undefined, 20) }, [resetKey])
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
    {!active ? <section className="network-demo-panel" aria-label="Vista previa pendiente"><h2>Vista previa pendiente</h2><p>La configuración cambió. Consulta la red para mostrar la población actual.</p></section> : <section className="network-demo-panel" aria-label="Red real de la vista previa">
      <header className="network-demo-heading"><h2>Red de contactos</h2><span>{frames ? `Réplica ${comparison!.representative.index} · ${policyLabels[policy]}` : 'Vista previa'} · {graph.nodes.length} personas · Día {currentDay}</span></header>
      <p className="network-meaning">{graph.edges.length} contactos activos visibles. Cada punto es una persona; cada línea, un contacto.</p>
      <div className="seir-instrument" aria-label="Estados de la población en el día seleccionado">
        {(Object.keys(labels) as (keyof typeof labels)[]).map(state => <div key={state} aria-label={`${labels[state]}: ${graph.counts[state]}`} style={{ '--state-color': seirColors[state].marker } as CSSProperties}>
          <span className="seir-instrument-label"><span className="seir-status-dot" aria-hidden="true" /><b>{state}</b> {labels[state]}</span><strong>{graph.counts[state]}</strong>
        </div>)}
      </div>
      <div className="network-view">
        <div ref={container} className="network-canvas" role="img" aria-label={`Red real de ${graph.nodes.length} personas sintéticas, contactos del día ${currentDay}. Seleccione una persona o use el selector.`} />
        <div className="graph-day-label">{frames ? `Día ${currentDay} · ${policyLabels[policy]}` : 'Estado inicial · sin vacunación'}</div>
        <div className="network-zoom" aria-label="Herramientas de exploración">
          <button type="button" aria-label="Acercar red" onClick={() => zoom(1.25)}><ZoomIn size={17} /></button>
          <button type="button" aria-label="Alejar red" onClick={() => zoom(0.8)}><ZoomOut size={17} /></button>
          <button type="button" aria-label="Ajustar grafo a la vista" onClick={() => network.current?.fit(undefined, 20)}><Crosshair size={17} /></button>
        </div>
      </div>
      <p className="network-playback-status">Semilla {preview.configuration.rootSeed}.{frames ? ` Réplica representativa ${comparison!.representative.index} (índice desde 0). No es el promedio de las réplicas.` : ` Origen: ${preview.initialInfectiousNodeIds.join(', ')}.`} Las personas sin contactos del filtro se atenúan.</p>
      <details className="node-inspector" open={Boolean(detail)} aria-label="Información de la persona seleccionada">
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
          <button className="plain-action" onClick={() => network.current?.fit(network.current.getElementById(selected).closedNeighborhood(), 45)}><Crosshair size={14} /> Enfocar conexiones</button>
        </div>}
      </details>
    </section>}
    <div className="simulator-control-column">
      <section className="temporal-chart-panel real-playback" aria-label="Reproducción de réplica real">
        <h3>{frames ? 'Réplica representativa' : 'Estado inicial'}</h3>
        {frames ? <>
          <p>Trayectoria real de una réplica. Los promedios y rangos están en Comparación.</p>
          <label>Estrategia <select aria-label="Estrategia de la animación" value={policy} onChange={event => { setPolicy(event.target.value as Policy); setPlaying(false) }}>{(['none', 'random', 'targeted'] as const).map(p => <option key={p} value={p}>{policyLabels[p]}</option>)}</select></label>
          <p><label>Día {currentDay} de {lastDay}<input aria-label="Día de la réplica" type="range" min={0} max={lastDay} value={currentDay} onChange={event => { setDay(Number(event.target.value)); setPlaying(false) }} /></label></p>
          <div className="configuration-actions">
            <Button type="button" variant="outline" onClick={() => { if (currentDay >= lastDay) setDay(0); setPlaying(value => !value) }}>{playing ? 'Pausar' : 'Reproducir'}</Button>
            <Button type="button" variant="outline" disabled={currentDay >= lastDay} onClick={() => { setPlaying(false); setDay(currentDay + 1) }}>Día siguiente</Button>
            <Button type="button" variant="outline" onClick={() => { setPlaying(false); setDay(0) }}>Volver al día 0</Button>
          </div>
          <label>Velocidad <select aria-label="Velocidad de reproducción" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={1400}>Lenta</option><option value={700}>Normal</option><option value={250}>Rápida</option></select></label>
          <p role="status">Día {currentDay} · {playing ? 'Reproduciendo' : currentDay === lastDay ? 'Final de la réplica' : 'En pausa'}. Los contactos y colores corresponden a este día.</p>
          <p>R incluye personas recuperadas o inmunizadas. Las vacunas se aplican al registrar el día {comparison!.configuration.intervention.interventionDay}.</p>
        </> : <><p>{!active ? 'Consulta la red para obtener un nuevo estado inicial.' : comparison ? 'Comparación disponible sin animación: el servidor limitó el tamaño de los estados diarios. Los resultados completos están en Comparación.' : 'Ejecuta Comparar estrategias para cargar una trayectoria real.'}</p><p>Las vacunas se aplican al ejecutar la simulación, no en este preview.</p></>}
      </section>
      {children}
    </div>
  </div>
}
