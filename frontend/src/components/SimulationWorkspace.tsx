import { useEffect, useReducer } from 'react'
import {
  initialSimulationPlayback, simulationPlaybackReducer, schedulePlaybackTick,
  type SimulationPlaybackAction,
} from '@/lib/simulation-playback'
import { PreviewNetwork, type PreviewNetworkProps } from './PreviewNetwork'

// Shared owner for the real simulation views. The authored demo keeps its own controller.
export function SimulationWorkspace({ active = true, comparison = null, ...props }: PreviewNetworkProps) {
  const frames = active ? comparison?.representative.frames ?? null : null
  const lastDay = frames ? comparison!.configuration.scenario.days : 0
  const [state, dispatch] = useReducer(
    (current: typeof initialSimulationPlayback, action: SimulationPlaybackAction) =>
      simulationPlaybackReducer(current, action, lastDay),
    initialSimulationPlayback,
  )
  const day = Math.min(state.day, lastDay)

  useEffect(() => { dispatch({ type: 'reset' }) }, [comparison, active, props.preview])
  useEffect(() => schedulePlaybackTick(
    { ...state, day }, lastDay, () => dispatch({ type: 'tick' }),
  ), [state.playing, state.speed, day, lastDay, frames, comparison, active, props.preview])

  const playback = { ...state, day, lastDay, frames, frame: frames?.[state.policy][day], dispatch }
  return <PreviewNetwork {...props} active={active} comparison={comparison} playback={playback} />
}
