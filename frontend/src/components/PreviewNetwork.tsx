import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import cytoscape from 'cytoscape'
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react'
import type { PreviewResponse } from '@/lib/api'
import { previewNetwork } from '@/lib/preview-network'
import { seirColors } from './seir-colors'
import './ContactNetwork.css'

const labels = { S: 'Sano', E: 'Mordido', I: 'Zombie', R: 'Exorcizado' }
const groups = [ ['householdId', 'Hogar'], ['schoolId', 'Colegio'], ['busId', 'Ruta de bus'], ['marketId', 'Mercado'], ['neighborhoodId', 'Barrio'] ] as const

export function PreviewNetwork({ preview, layer, resetKey, children, active = true, hasComparison = false }: {
  preview: PreviewResponse; layer: string; resetKey: number; children?: ReactNode; active?: boolean; hasComparison?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const network = useRef<cytoscape.Core | null>(null)
  const [selected, setSelected] = useState('')
  const pickerId = useId()
  const graph = useMemo(() => previewNetwork(preview, layer), [preview, layer])
  const detail = preview.graph.nodes.find(n => String(n.id) === selected)
  const initial = preview.initialInfectiousNodeIds.includes(Number(selected))

  useEffect(() => {
    if (!container.current || !active) return
    const cy = cytoscape({ container: container.current, elements: graph.elements,
      layout: { name: 'preset' }, minZoom: 0.01, maxZoom: 5, boxSelectionEnabled: false, selectionType: 'single',
      style: [
        { selector: 'node', style: { width: 15, height: 15, 'background-color': seirColors.S.marker, 'border-width': 1, 'border-color': '#334155' } },
        { selector: 'node[state="I"]', style: { width: 23, height: 23, 'background-color': seirColors.I.marker, label: 'Caso inicial', 'font-size': 14, 'text-valign': 'top', 'text-margin-y': -10, 'text-background-color': '#ffffff', 'text-background-opacity': 0.9 } },
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
      <header className="network-demo-heading"><h2>Red de contactos</h2><span>Vista previa · {graph.nodes.length} personas · Día 0</span></header>
      <p className="network-meaning">{graph.edges.length} contactos activos visibles. Cada punto es una persona; cada línea, un contacto.</p>
      <div className="seir-instrument" aria-label="Estados iniciales de la población">
        {(Object.keys(labels) as (keyof typeof labels)[]).map(state => <div key={state} aria-label={`${labels[state]}: ${graph.counts[state]}`} style={{ '--state-color': seirColors[state].marker } as CSSProperties}>
          <span className="seir-instrument-label"><span className="seir-status-dot" aria-hidden="true" /><b>{state}</b> {labels[state]}</span><strong>{graph.counts[state]}</strong>
        </div>)}
      </div>
      <div className="network-view">
        <div ref={container} className="network-canvas" role="img" aria-label={`Red real de ${graph.nodes.length} personas sintéticas, contactos del día 0. Seleccione una persona o use el selector.`} />
        <div className="graph-day-label">Estado inicial · sin vacunación</div>
        <div className="network-zoom" aria-label="Herramientas de exploración">
          <button type="button" aria-label="Acercar red" onClick={() => zoom(1.25)}><ZoomIn size={17} /></button>
          <button type="button" aria-label="Alejar red" onClick={() => zoom(0.8)}><ZoomOut size={17} /></button>
          <button type="button" aria-label="Ajustar grafo a la vista" onClick={() => network.current?.fit(undefined, 20)}><Crosshair size={17} /></button>
        </div>
      </div>
      <p className="network-playback-status">Semilla {preview.configuration.rootSeed}. Origen: {preview.initialInfectiousNodeIds.join(', ')}. Las personas sin contactos del filtro se atenúan.</p>
      <details className="node-inspector" open={Boolean(detail)} aria-label="Información de la persona seleccionada">
        <summary>Explorar personas</summary>
        <label htmlFor={pickerId}>Buscar persona por número</label>
        <select id={pickerId} value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">Seleccione una persona</option>
          {preview.graph.nodes.map(node => <option key={node.id} value={String(node.id)}>Persona {String(node.id).padStart(3, '0')}</option>)}
        </select>
        {detail && <div className="node-context" aria-live="polite">
          <div className="node-context-id">Persona <strong>{String(detail.id).padStart(3, '0')}</strong> · {initial ? 'Zombie inicial' : 'Sano'}</div>
          <dl><div><dt>Contactos distintos visibles</dt><dd>{graph.neighbors[selected]?.length ?? 0}</dd></div>
            {groups.map(([key, label]) => detail[key] !== null && <div key={key}><dt>{label}</dt><dd>{detail[key]}</dd></div>)}</dl>
          <button className="plain-action" onClick={() => network.current?.fit(network.current.getElementById(selected).closedNeighborhood(), 45)}><Crosshair size={14} /> Enfocar conexiones</button>
        </div>}
      </details>
    </section>}
    <div className="simulator-control-column">
      <section className="temporal-chart-panel" aria-label="Estado de la vista previa"><h3>Estado inicial</h3><p>{active ? hasComparison ? "Los resultados están en Comparación. Aquí se conserva la vista previa inicial, sin vacunación." : "La red corresponde a tus parámetros. Aún no hay una trayectoria temporal ni resultados de comparación." : "Consulta la red para obtener un nuevo estado inicial."}</p><p>Las vacunas se aplican al ejecutar la simulación, no en este preview.</p></section>
      {children}
    </div>
  </div>
}
