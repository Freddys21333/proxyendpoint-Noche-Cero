import { lazy, Suspense, useEffect, useMemo, useReducer, useState } from 'react'
import {
  initialSimulationPlayback, simulationPlaybackReducer, schedulePlaybackTick, getSimulationSource, readSimulationPresentation,
  type SimulationPlaybackAction,
} from '@/lib/simulation-playback'
import { PreviewNetwork, type PreviewNetworkProps } from './PreviewNetwork'

const GeographicMap = lazy(() => import('./GeographicMap'))

// One playback controller keeps the map and contact network synchronized.
export function SimulationWorkspace({ active = true, comparison = null, comparisonState = 'idle', ...props }: PreviewNetworkProps) {
  const [view, setView] = useState<'network' | 'map'>('map')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [focusRequest, setFocusRequest] = useState<{ id: number; version: number } | null>(null)
  const source = useMemo(() => getSimulationSource(props.preview, comparison, active, comparisonState), [props.preview, comparison, active, comparisonState])
  const lastDay = source.lastDay
  const [state, dispatch] = useReducer(
    (current: typeof initialSimulationPlayback, action: SimulationPlaybackAction) =>
      simulationPlaybackReducer(current, action, lastDay),
    initialSimulationPlayback,
  )
  const presentation = useMemo(() => readSimulationPresentation(props.preview, source, state.day, state.policy), [props.preview, source, state.day, state.policy])
  const day = presentation.day
  const frames = presentation.mode === 'representative' ? source.frames : null

  useEffect(() => { dispatch({ type: 'reset' }) }, [comparison, active, props.preview, comparisonState])
  useEffect(() => {
    const origin = props.preview.configuration.scenario.origin
    const id = origin.kind === 'node' && origin.value !== null ? origin.value : null
    setView('map')
    setSelectedPersonId(id === null ? '' : String(id))
    setFocusRequest(id === null ? null : { id, version: 1 })
  }, [props.preview])
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)')
        if (media.matches) dispatch({ type: 'reduced-motion', enabled: true })
        const handler = (event: MediaQueryListEvent) => dispatch({ type: 'reduced-motion', enabled: event.matches })
        media.addEventListener('change', handler)
        return () => media.removeEventListener('change', handler)
      }
    } catch {
      // Ignorar en entornos de test o sin matchMedia
    }
  }, [])
  useEffect(() => {
    if (presentation.mode !== 'representative') { if (state.playing) dispatch({ type: 'pause' }); return }
    return schedulePlaybackTick({ ...state, day }, lastDay, () => dispatch({ type: 'tick' }))
  }, [state.playing, state.speed, day, lastDay, frames, comparison, active, props.preview, comparisonState, presentation.mode])

  const playback = { ...state, ...presentation, lastDay, frames, dispatch }
  const viewSelector = <div className="visualizer-view-selector" role="group" aria-label="Vista del visualizador">
    <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>Mapa</button>
    <button type="button" aria-pressed={view === 'network'} onClick={() => setView('network')}>Red</button>
  </div>
  const renderMap = (highlightedIds: ReadonlySet<number> | null) => <div className="network-view geographic-map-view" hidden={view !== 'map'}>
    <Suspense fallback={<p className="geographic-map-loading" role="status">Cargando mapa de Manta…</p>}>
      <GeographicMap visible={view === 'map' && active} preview={props.preview} playback={playback}
        resetKey={props.resetKey} selectedPersonId={selectedPersonId} onSelectPerson={setSelectedPersonId} focusRequest={focusRequest} onChooseOrigin={active ? props.onChooseOrigin : undefined} highlightedIds={highlightedIds} />
    </Suspense>
  </div>
  return <PreviewNetwork {...props} active={active} comparison={comparison} comparisonState={comparisonState} playback={playback}
    view={view} viewSelector={viewSelector} renderMap={renderMap} selectedPersonId={selectedPersonId} onSelectPerson={setSelectedPersonId}
    onFocusPerson={id => {
      setSelectedPersonId(id)
      setFocusRequest(previous => ({ id: Number(id), version: (previous?.version ?? 0) + 1 }))
      dispatch({ type: 'pause' })
    }} />
}
