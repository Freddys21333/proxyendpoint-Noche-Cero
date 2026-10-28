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
  useEffect(() => { setView('map'); setSelectedPersonId(''); setFocusRequest(null) }, [props.preview])
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
  const mapView = <div className="network-view geographic-map-view" hidden={view !== 'map'}>
    <Suspense fallback={<p className="geographic-map-loading" role="status">Cargando mapa de Manta…</p>}>
      <GeographicMap visible={view === 'map' && active} preview={props.preview} playback={playback}
        resetKey={props.resetKey} selectedPersonId={selectedPersonId} onSelectPerson={setSelectedPersonId} focusRequest={focusRequest} />
    </Suspense>
  </div>
  return <PreviewNetwork {...props} active={active} comparison={comparison} comparisonState={comparisonState} playback={playback}
    view={view} viewSelector={viewSelector} mapView={mapView} selectedPersonId={selectedPersonId} onSelectPerson={setSelectedPersonId}
    onFocusPerson={id => {
      setSelectedPersonId(id)
      setFocusRequest(previous => ({ id: Number(id), version: (previous?.version ?? 0) + 1 }))
      dispatch({ type: 'pause' })
    }} />
}
