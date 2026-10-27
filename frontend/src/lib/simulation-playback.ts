import type { CompareResponse, PersonState, Policy } from './api.ts'

export type SimulationPlaybackState = {
  day: number
  policy: Policy
  playing: boolean
  speed: number
}

export type SimulationPlaybackAction =
  | { type: 'toggle' | 'pause' | 'tick' | 'step' | 'reset' }
  | { type: 'seek'; day: number }
  | { type: 'policy'; policy: Policy }
  | { type: 'speed'; speed: number }

export type SimulationPlayback = SimulationPlaybackState & {
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
    case 'seek':
      return { ...state, day: action.day, playing: false }
    case 'policy':
      return { ...state, policy: action.policy, playing: false }
    case 'speed':
      return { ...state, speed: action.speed }
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
