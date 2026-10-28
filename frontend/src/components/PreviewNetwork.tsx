import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import cytoscape from 'cytoscape'
import { ChevronDown, Crosshair, Pause, Play, RotateCcw, SlidersHorizontal, StepBack, StepForward, Syringe, UserRound, ZoomIn, ZoomOut } from 'lucide-react'
import type { PreviewResponse, CompareResponse, Policy, VaccinationSelection, CombinedDaily, InventoryDaily } from '@/lib/api'
import { policyLabels } from '@/lib/comparison'
import { networkPositions, layoutModes, type NetworkLayout } from '@/lib/network-layout'
import { previewNetwork } from '@/lib/preview-network'
import { Button } from './ui/button'
import { vaccinationsAtDay, vaccinationContexts } from '@/lib/vaccination'
import { VaccinationDetails, VaccinationPerson } from './VaccinationDetails'
import { seirColors } from './seir-colors'
import { FloatingSimulationControls } from './FloatingSimulationControls'
import { usd } from './CombinedCostResults'
import { ResourceInventory } from './ResourceInventory'
import { simulationModeMessages, type SimulationPlayback, type ComparisonState } from '@/lib/simulation-playback'
import './ContactNetwork.css'

const labels = { S: 'Sano', E: 'Mordido', I: 'Zombie', R: 'Exorcizado' }
const noSelections: VaccinationSelection[] = []
const groups = [ ['householdId', 'Hogar'], ['schoolId', 'Colegio'], ['busId', 'Ruta de bus'], ['marketId', 'Mercado'], ['neighborhoodId', 'Barrio'] ] as const

export type PreviewNetworkProps = {
  preview: PreviewResponse; layer: string; resetKey: number; children?: ReactNode; panelActions?: ReactNode; active?: boolean; comparison?: CompareResponse | null; comparisonState?: ComparisonState;
  renderTools?: (view: 'network' | 'map') => ReactNode
  onChooseOrigin?: (id: number) => void
}

export function PreviewNetwork({ preview, layer, resetKey, children, panelActions, active = true, comparison = null, playback, view = 'network', viewSelector, mapView,
  selectedPersonId: selected, onSelectPerson: setSelected, onFocusPerson, renderTools, onChooseOrigin }: PreviewNetworkProps & {
  playback: SimulationPlayback; view?: 'network' | 'map'; viewSelector?: ReactNode; mapView?: ReactNode;
  selectedPersonId: string; onSelectPerson: (id: string) => void; onFocusPerson: (id: string) => void
}) {
  const inspector = useRef<HTMLDetailsElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const network = useRef<cytoscape.Core | null>(null)
  const [layout, setLayout] = useState<NetworkLayout>('neighborhoodId')
  const { day: currentDay, policy, playing, speed, frames, lastDay, frame, dispatch } = playback
  const showNetwork = view === 'network'
  const hasComparison = active && comparison && (playback.mode === 'representative' || playback.mode === 'no-frames')
  const selections = hasComparison ? comparison!.replicates[comparison!.representative.index].policies[policy].selections : noSelections
  const applied = useMemo(() => vaccinationsAtDay(selections, currentDay), [selections, currentDay])
  const dose = applied.find(row => String(row.nodeId) === selected)
  const pickerId = useId()
  const combined = preview.configuration.intervention.combined
  const budgetDay = combined && frames && hasComparison ? comparison!.replicates[comparison!.representative.index].policies[policy].daily[currentDay] as CombinedDaily : null
  const schedule = combined?.resourceSchedule
  const inventoryDay = schedule && budgetDay ? budgetDay as CombinedDaily & InventoryDaily : null
  const blockedContext = budgetDay?.closedContext ?? null
  const graph = useMemo(() => previewNetwork(preview, layer, currentDay, frame, frames ? selections : noSelections, blockedContext), [preview, layer, currentDay, frame, selections, blockedContext])
  const visibleCounts = playback.counts
  const vaccineBudget = inventoryDay?.vaccinesReceivedTotal ?? preview.configuration.intervention.vaccines
  const remainingVaccines = inventoryDay?.vaccinesAvailable ?? vaccineBudget - (frames ? applied.length : 0)
  const positions = useMemo(() => networkPositions(preview, layout), [preview, layout])
  const detail = preview.graph.nodes.find(n => String(n.id) === selected)
  const selectedState = graph.nodes.find(n => n.data.id === selected)?.data.state ?? 'S'

  useEffect(() => {
    if (!container.current) return
    const cy = cytoscape({ container: container.current, elements: graph.elements,
      layout: { name: 'preset' }, minZoom: 0.01, maxZoom: 5, boxSelectionEnabled: false, selectionType: 'single',
      style: [
        { selector: 'node', style: { width: 15, height: 15, 'background-color': seirColors.S.marker, 'border-width': 1, 'border-color': '#e7dec9', label: 'data(groupLabel)', color: '#eee7d9', 'font-size': 15, 'text-valign': 'top', 'text-margin-y': -14, 'text-background-color': '#25212e', 'text-background-opacity': 0.94, 'text-background-padding': '4px' } },
        { selector: 'node[state="I"]', style: { width: 23, height: 23, 'background-color': seirColors.I.marker, 'font-size': 14, 'text-valign': 'top', 'text-margin-y': -10, 'text-background-color': '#25212e', 'text-background-opacity': 0.94 } },
        { selector: 'node[state="E"]', style: { 'background-color': seirColors.E.marker } },
        { selector: 'node[state="R"]', style: { 'background-color': seirColors.R.marker } },
        { selector: 'node[!inLayer]', style: { opacity: 0.15 } },
        { selector: 'edge', style: { display: 'none', width: 1, 'line-color': '#827c91', 'curve-style': 'bezier' } },
        { selector: 'edge.focused', style: { display: 'element', 'line-color': '#ff925d', width: 2, opacity: 1 } },
        { selector: 'node[vaccination="effective"]', style: { 'border-width': 4, 'border-color': '#7c3aed', 'border-style': 'solid' } },
        { selector: 'node[vaccination="ineffective"]', style: { 'border-width': 4, 'border-color': '#7c3aed', 'border-style': 'dashed' } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#fff2d6', opacity: 1 } },
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
  }, [preview, setSelected])

  useEffect(() => { setSelected('') }, [preview, setSelected])

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
  useEffect(() => {
    if (!frames) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (target?.isContentEditable) return

      if (event.key === ' ' || event.key === 'k') {
        event.preventDefault()
        dispatch({ type: 'toggle' })
      } else if (event.key === 'ArrowRight' || event.key === 'l') {
        event.preventDefault()
        dispatch({ type: 'step' })
      } else if (event.key === 'ArrowLeft' || event.key === 'j') {
        event.preventDefault()
        dispatch({ type: 'step-back' })
      } else if (event.key === 'Home') {
        event.preventDefault()
        dispatch({ type: 'reset' })
      } else if (event.key === 'End') {
        event.preventDefault()
        dispatch({ type: 'seek', day: lastDay })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [frames, lastDay, dispatch])

  const availability = {
    preview: 'Pulsa Comparar estrategias para reproducir.',
    pending: 'Calculando la trayectoria…',
    invalid: 'Consulta la red para actualizar el escenario.',
    error: 'Reintenta la comparación para reproducir.',
    'no-frames': 'Este resultado no incluye trayectoria individual.',
    representative: '',
  }[playback.mode]
  const transport = <section className="persistent-playback playback-transport" aria-label="Reproducción de la simulación">
    <div className="playback-heading"><h3>Reproducción</h3><div className="playback-time">{frames ? <><span>Día</span><strong>{currentDay} <small>/ {lastDay}</small></strong></> : <span>Sin trayectoria</span>}</div></div>
    <div className="playback-actions">
      <Button type="button" variant="ghost" className="playback-primary" aria-label="Reproducir simulación" aria-describedby={!frames ? 'playback-availability' : undefined} title="Reproducir" disabled={!frames || playing} onClick={() => dispatch({ type: 'toggle' })}><Play size={17} />{playing ? 'Reproduciendo' : 'Reproducir'}</Button>
      <Button type="button" variant="ghost" aria-label="Pausar simulación" title="Pausar" disabled={!frames || !playing} onClick={() => dispatch({ type: 'pause' })}><Pause size={17} /></Button>
      <Button type="button" variant="ghost" aria-label="Reiniciar simulación" title="Volver al día 0" disabled={!frames} onClick={() => dispatch({ type: 'reset' })}><RotateCcw size={17} /></Button>
      <Button type="button" variant="ghost" aria-label="Retroceder un día" title="Día anterior" disabled={!frames || currentDay <= 0} onClick={() => dispatch({ type: 'step-back' })}><StepBack size={17} /></Button>
      <Button type="button" variant="ghost" aria-label="Avanzar un día" title="Día siguiente" disabled={!frames || currentDay >= lastDay} onClick={() => dispatch({ type: 'step' })}><StepForward size={17} /></Button>
    </div>
    <div className="playback-accessibility-row">
      <button type="button" className={`playback-motion-toggle${playback.reducedMotion ? ' active' : ''}`}
        aria-pressed={Boolean(playback.reducedMotion)}
        onClick={() => dispatch({ type: 'reduced-motion', enabled: !playback.reducedMotion })}
        title={playback.reducedMotion ? 'Desactivar modo de movimiento reducido' : 'Activar modo de movimiento reducido'}>
        {playback.reducedMotion ? 'Movimiento reducido' : 'Movimiento normal'}
      </button>
      <span className="playback-keyboard-hint" title="Atajos accesibles: Espacio (Play/Pausa), ← / → (Retroceder/Avanzar día), Inicio (Día 0)">Atajos: Espacio, ← / →</span>
    </div>
    {!frames && <p id="playback-availability" role="status">{availability}</p>}
  </section>
  return <div className="simulator-workbench network-workbench">
    <section className={`network-demo-panel simulation-visualizer${active ? '' : ' simulation-outdated'}`} aria-label={!active ? 'Vista previa pendiente' : showNetwork ? 'Red real de la vista previa' : 'Mapa geográfico de Manta'}>
      <div className="simulation-visualizer-content" inert={!active} aria-hidden={!active}>
      <header className="network-demo-heading"><h2>{showNetwork ? 'Red de contactos' : 'Mapa de Manta'}</h2>{viewSelector}<span>{frames ? `Réplica ${playback.representativeIndex} · ${policyLabels[policy]}` : 'Vista previa · sin vacunación'} · {graph.nodes.length} personas · Día {currentDay}</span></header>
      <div className="population-inventory-summary">
      <div className="seir-instrument" aria-label={frames ? 'Estados de la población en el día seleccionado' : 'Estados iniciales de la población del preview'}>
        {(Object.keys(labels) as (keyof typeof labels)[]).map(state => <div key={state} aria-label={`${labels[state]}: ${visibleCounts[state]}`} style={{ '--state-color': seirColors[state].marker } as CSSProperties}>
          <span className="seir-instrument-label"><span className="seir-status-dot" aria-hidden="true" /><b>{state}</b> {labels[state]}</span><strong>{visibleCounts[state]}</strong>
        </div>)}
      </div>
      <div className="vaccine-inventory" aria-label={`Vacunas restantes: ${remainingVaccines} de ${vaccineBudget}${frames ? ` en el día ${currentDay}, estrategia ${policyLabels[policy]}` : ', antes de simular'}`} title="Cada dosis asignada se descuenta, aunque no resulte efectiva.">
        <span className="vaccine-inventory-label"><Syringe size={16} aria-hidden="true" />Vacunas restantes</span>
        <span className="vaccine-inventory-value"><strong>{remainingVaccines.toLocaleString('es-EC')}</strong><small>/ {vaccineBudget.toLocaleString('es-EC')} dosis</small></span>
        <small>{frames ? `Día ${currentDay} · ${policyLabels[policy]}${inventoryDay ? ' · recibidas hasta hoy' : ''}` : 'Antes de simular'}</small>
      </div>
      </div>
      <div className="network-view" hidden={!showNetwork}>
        <div ref={container} className="network-canvas" role="img" aria-label={`Red real de ${graph.nodes.length} personas sintéticas, contactos del día ${currentDay}. Seleccione una persona o use el selector.`} />
        <div className="network-zoom" aria-label="Herramientas de exploración">
          <button type="button" aria-label="Acercar red" onClick={() => zoom(1.25)}><ZoomIn size={17} /></button>
          <button type="button" aria-label="Alejar red" onClick={() => zoom(0.8)}><ZoomOut size={17} /></button>
          <button type="button" aria-label="Ajustar grafo a la vista" onClick={() => network.current?.fit(undefined, 20)}><Crosshair size={17} /></button>
        </div>
      <details ref={inspector} className="node-inspector floating-person-inspector" hidden={!showNetwork} open={Boolean(detail)} aria-label="Información de la persona seleccionada">
        <summary><UserRound size={17} aria-hidden="true" /><span>{detail ? `Persona ${String(detail.id).padStart(3, '0')}` : 'Explorar personas'}</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="person-inspector-body">
        <label htmlFor={pickerId}>Buscar persona por número</label>
        <select id={pickerId} value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">Seleccione una persona</option>
          {preview.graph.nodes.map(node => <option key={node.id} value={String(node.id)}>Persona {String(node.id).padStart(3, '0')}</option>)}
        </select>
        {detail && <div className="node-context" aria-live="polite">
          <div className="node-context-id">Persona <strong>{String(detail.id).padStart(3, '0')}</strong> · {labels[selectedState]}</div>
          {active && onChooseOrigin && <button type="button" className="origin-person-action" onClick={() => onChooseOrigin(Number(selected))}>Elegir como origen del brote</button>}
          <dl><div><dt>Contactos distintos visibles</dt><dd>{graph.neighbors[selected]?.length ?? 0}</dd></div>
            {groups.map(([key, label]) => detail[key] !== null && <div key={key}><dt>{label}</dt><dd>{detail[key]}</dd></div>)}</dl>
          {frames && (dose ? <VaccinationPerson selection={dose} /> : <p>{policy === 'none' ? 'Sin intervención: no se aplican vacunas.' : currentDay < comparison!.configuration.intervention.interventionDay ? `Intervención pendiente para el día ${comparison!.configuration.intervention.interventionDay}. Aún no recibió una dosis.` : 'No recibió una dosis en esta estrategia. El estado actual no determina por sí solo su elegibilidad al decidir.'}</p>)}
          <button className="plain-action" onClick={() => network.current?.fit(network.current.getElementById(selected).closedNeighborhood(), 45)}><Crosshair size={14} /> Enfocar conexiones</button>
          <button type="button" className="plain-action" onClick={() => setSelected('')}>Ocultar conexiones y quitar selección</button>
        </div>}
        </div>
      </details>
      </div>
      {mapView}
      <p className="network-playback-status">Semilla {preview.configuration.rootSeed}.{frames ? ` Réplica representativa ${playback.representativeIndex} (índice desde 0). No es el promedio de las réplicas.` : ` Origen: ${preview.initialInfectiousNodeIds.join(', ')}. Las vacunas se aplican al ejecutar la simulación, no en esta vista previa.`}{showNetwork && ' Las personas sin contactos del filtro se atenúan.'}</p>
      </div>
      {!active && <div className="simulation-update-overlay">
        <div className="simulation-update-card" role="status" aria-live="polite">
          <span className="simulation-update-icon"><SlidersHorizontal size={30} aria-hidden="true" /></span>
          <h2>Actualiza tu escenario</h2>
          <p>Los parámetros cambiaron y la visualización anterior ya no corresponde a la configuración actual.</p>
          <p className="simulation-update-action">Pulsa <strong>Consultar red</strong> en el panel de parámetros para cargar la nueva población.</p>
        </div>
      </div>}
    </section>
    <FloatingSimulationControls actions={panelActions}>
      {frames && <details className="sidebar-section"><summary>Reproducción y estrategia</summary>
        {transport}
        <section className="temporal-chart-panel real-playback persistent-playback" aria-label="Opciones de reproducción">
          <p role="status">{frames ? `Día ${currentDay} · ${playing ? 'Reproduciendo' : currentDay === lastDay ? 'Final de la réplica' : 'En pausa'}. Trayectoria real de una réplica.` : simulationModeMessages[playback.mode]}</p>
          <fieldset className="playback-settings" disabled={!frames}>
          <label>Estrategia que estás visualizando <select aria-label="Estrategia que estás visualizando" value={policy} onChange={event => dispatch({ type: 'policy', policy: event.target.value as Policy })}>{(['none', 'random', 'targeted'] as const).map(p => <option key={p} value={p}>{policyLabels[p]}</option>)}</select></label>
          <div className="network-playback" role="group" aria-label="Reproductor de simulación real">
            <label className="playback-timeline"><span>{!frames ? 'Día de reproducción' : playing ? 'Reproduciendo' : currentDay === lastDay ? 'Final de la réplica' : 'Explorar días'}</span><input aria-label="Día de la réplica" type="range" min={0} max={lastDay} value={currentDay} onChange={event => dispatch({ type: 'seek', day: Number(event.target.value) })} /></label>
            <label className="playback-speed"><span>Velocidad</span><select aria-label="Velocidad de reproducción" value={speed} onChange={event => dispatch({ type: 'speed', speed: Number(event.target.value) })}><option value={1400}>0,5×</option><option value={700}>1×</option><option value={350}>2×</option><option value={175}>4×</option></select></label>
          </div>
          </fieldset>
          {frames && <p>R incluye personas recuperadas o inmunizadas. {schedule ? `La vacunación comienza el día ${comparison!.configuration.intervention.interventionDay} y continúa según inventario, capacidad y presupuesto.` : `Las vacunas se aplican al registrar el día ${comparison!.configuration.intervention.interventionDay}.`}</p>}
        </section>
      </details>}
      {children}
      {(combined || hasComparison) && <details className="sidebar-section"><summary>Intervenciones y registro</summary>
      {combined && <p className="combined-budget-status">Presupuesto restante: <strong>{usd(budgetDay?.budgetRemainingCents ?? combined.budgetCents)}</strong> / {usd(combined.budgetCents)} · {budgetDay ? `Día ${currentDay} · ${policyLabels[policy]} · ${budgetDay.brigadesActive} personas atendidas por brigadas${budgetDay.closedContext ? ` · Contactos cerrados: ${vaccinationContexts[budgetDay.closedContext]}` : ''}` : 'Antes de simular'} · Supuestos educativos</p>}
      {schedule && <ResourceInventory row={inventoryDay} schedule={schedule} day={currentDay} initialVaccines={preview.configuration.intervention.vaccines} />}
      {hasComparison && !frames && <label>Estrategia del registro de vacunación <select aria-label="Estrategia del registro de vacunación" value={policy} onChange={event => dispatch({ type: 'policy', policy: event.target.value as Policy })}>{(['none', 'random', 'targeted'] as const).map(p => <option key={p} value={p}>{policyLabels[p]}</option>)}</select></label>}
      {hasComparison && <VaccinationDetails selections={selections} day={frames ? currentDay : comparison!.configuration.scenario.days} interventionDay={comparison!.configuration.intervention.interventionDay} vaccines={schedule ? (comparison!.replicates[comparison!.representative.index].policies[policy].daily[frames ? currentDay : comparison!.configuration.scenario.days] as InventoryDaily).vaccinesReceivedTotal : comparison!.configuration.intervention.vaccines} policy={policy} configuration={comparison!.configuration} selectedId={selected} onSelect={onFocusPerson} />}
      </details>}
      <details className="sidebar-section"><summary>{showNetwork ? 'Vista y contactos' : 'Vista del mapa'}</summary>
      <p className="network-meaning">{showNetwork ? selected ? `Persona ${selected} · ${graph.neighbors[selected]?.length ?? 0} contactos en este día y filtro. Haz clic en el fondo para ocultar sus conexiones.` : 'Cada punto es una persona. Selecciona un punto o usa Explorar personas para ver sus conexiones.' : 'Ubicaciones sintéticas en Manta. Pulsa un punto para ver a la persona.'}</p>
      <div className="network-layout-control" hidden={!showNetwork}>
        <label>Organizar personas por <select aria-label="Distribución visual de la red" value={layout} onChange={event => { setLayout(event.target.value as NetworkLayout); dispatch({ type: 'pause' }) }}>{Object.entries(layoutModes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p>Cambia la distribución visual, sin modificar los contactos.</p>
      </div>
      {renderTools?.(view)}
      </details>
    </FloatingSimulationControls>
  </div>
}
