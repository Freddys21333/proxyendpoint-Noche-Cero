import type { CompareResponse, PersonState, Policy, PreviewResponse } from './api.ts'

export type ComparisonState = 'idle' | 'running' | 'error'
export type SimulationMode = 'invalid' | 'preview' | 'pending' | 'error' | 'no-frames' | 'representative'
export type SimulationPresentation = {
  day: number; policy: Policy; mode: SimulationMode; frame: PersonState[] | undefined;
  counts: Record<PersonState, number>; representativeIndex: number | null;
}
export const simulationModeMessages: Record<SimulationMode, string> = {
  invalid: 'La configuración cambió. Consulta una nueva red.',
  preview: 'Ejecuta Comparar estrategias para cargar una trayectoria real.',
  pending: 'Comparación en ejecución. Se muestra el estado inicial mientras llegan los resultados.',
  error: 'No hay una trayectoria válida disponible. Se conserva el estado inicial del escenario.',
  'no-frames': 'Comparación disponible sin reproducción individual. Se muestra el estado inicial.',
  representative: 'Trayectoria real de una réplica. Los promedios y rangos están en Comparación.',
}

type SimulationSource = {
  mode: SimulationMode; frames: CompareResponse['representative']['frames'];
  lastDay: number; comparison: CompareResponse | null; representativeIndex: number | null;
}
function sameConfiguration(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameConfiguration(left[key], right[key]))
}

export function getSimulationSource(preview: PreviewResponse, comparison: CompareResponse | null, active: boolean, status: ComparisonState): SimulationSource {
  const fallback = (mode: SimulationMode): SimulationSource => ({ mode, frames: null, lastDay: 0, comparison: null, representativeIndex: null })
  if (!active) return fallback('invalid')
  if (status === 'running') return fallback('pending')
  if (status === 'error') return fallback('error')
  if (!comparison) return fallback('preview')
  if (comparison.graphHash !== preview.graphHash || !sameConfiguration(comparison.configuration, preview.configuration)) return fallback('error')
  if (!comparison.representative.frames) return fallback('no-frames')
  return { mode: 'representative', frames: comparison.representative.frames,
    lastDay: comparison.configuration.scenario.days, comparison, representativeIndex: comparison.representative.index }
}

export function readSimulationPresentation(preview: PreviewResponse, source: SimulationSource, requestedDay: number, policy: Policy): SimulationPresentation {
  const initial: SimulationPresentation = { mode: source.mode, day: 0, policy, frame: undefined, representativeIndex: null,
    counts: { S: preview.graph.nodes.length - preview.initialInfectiousNodeIds.length, E: 0, I: preview.initialInfectiousNodeIds.length, R: 0 } }
  if (source.mode !== 'representative') return initial
  const day = Math.max(0, Math.min(requestedDay, source.lastDay))
  const frame = source.frames?.[policy]?.[day]
  const counts = { S: 0, E: 0, I: 0, R: 0 }
  if (!frame || frame.length !== preview.graph.nodes.length || !frame.every(state => Object.hasOwn(counts, state))) return { ...initial, mode: 'error' }
  for (const state of frame) counts[state]++
  const row = source.comparison?.replicates[source.representativeIndex!]?.policies[policy].daily[day] as Record<string, unknown> | undefined
  if (!row || row.day !== day || !(Object.keys(counts) as PersonState[]).every(state => row[state.toLowerCase()] === counts[state])) return { ...initial, mode: 'error' }
  return { mode: 'representative', day, policy, frame, counts, representativeIndex: source.representativeIndex }
}

export type SimulationPlaybackState = {
  day: number
  policy: Policy
  playing: boolean
  speed: number
  reducedMotion?: boolean
}

export type SimulationPlaybackAction =
  | { type: 'toggle' | 'pause' | 'tick' | 'step' | 'step-back' | 'reset' }
  | { type: 'seek'; day: number }
  | { type: 'policy'; policy: Policy }
  | { type: 'speed'; speed: number }
  | { type: 'reduced-motion'; enabled: boolean }

export type SimulationPlayback = SimulationPlaybackState & SimulationPresentation & {
  lastDay: number
  frames: CompareResponse['representative']['frames']
  frame: PersonState[] | undefined
  dispatch: (action: SimulationPlaybackAction) => void
}

export const initialSimulationPlayback: SimulationPlaybackState = {
  day: 0, policy: 'targeted', playing: false, speed: 700,
}

export function simulationPlaybackReducer(
  state: SimulationPlaybackState, action: SimulationPlaybackAction, lastDay: number,
): SimulationPlaybackState {
  switch (action.type) {
    case 'toggle':
      return { ...state, day: state.day >= lastDay ? 0 : state.day, playing: lastDay > 0 && !state.playing }
    case 'pause':
      return { ...state, playing: false }
    case 'tick': {
      if (!state.playing || state.day >= lastDay) return state
      const day = state.day + 1
      return { ...state, day, playing: day < lastDay }
    }
    case 'step':
      return { ...state, day: Math.min(lastDay, state.day + 1), playing: false }
    case 'step-back':
      return { ...state, day: Math.max(0, state.day - 1), playing: false }
    case 'seek':
      return { ...state, day: action.day, playing: false }
    case 'policy':
      return { ...state, policy: action.policy, playing: false }
    case 'speed':
      return { ...state, speed: action.speed }
    case 'reduced-motion':
      return { ...state, reducedMotion: action.enabled }
    case 'reset':
      return { ...state, day: 0, playing: false }
  }
}

type ScheduleTick = (callback: () => void, delay: number) => () => void
const scheduleTimeout: ScheduleTick = (callback, delay) => {
  const timer = setTimeout(callback, delay)
  return () => clearTimeout(timer)
}

// The workspace owns one pending tick; cleanup also rejects a callback already queued by the host.
export function schedulePlaybackTick(
  state: SimulationPlaybackState, lastDay: number, tick: () => void, schedule: ScheduleTick = scheduleTimeout,
): (() => void) | undefined {
  if (!state.playing || state.day >= lastDay) return
  let active = true
  const cancel = schedule(() => { if (active) tick() }, state.speed)
  return () => { active = false; cancel() }
}
