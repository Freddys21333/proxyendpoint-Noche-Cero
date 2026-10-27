import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  initialSimulationPlayback,
  simulationPlaybackReducer,
  schedulePlaybackTick,
  type SimulationPlaybackState,
} from './simulation-playback.ts'

const lastDay = 4
const reduce = (state: SimulationPlaybackState, action: Parameters<typeof simulationPlaybackReducer>[1]) =>
  simulationPlaybackReducer(state, action, lastDay)

test('real playback starts paused on day zero with the existing policy and speed', () => {
  assert.deepEqual(initialSimulationPlayback, { day: 0, policy: 'targeted', playing: false, speed: 700 })
})

test('play advances one day per tick and pause preserves the selected day', () => {
  let state = reduce(initialSimulationPlayback, { type: 'toggle' })
  assert.equal(state.playing, true)
  state = reduce(state, { type: 'tick' })
  assert.equal(state.day, 1)
  state = reduce(state, { type: 'pause' })
  assert.equal(state.day, 1)
  assert.equal(state.playing, false)
  assert.deepEqual(reduce(state, { type: 'tick' }), state)
})

test('manual day selection pauses and restores the exact selected day', () => {
  const state = reduce({ ...initialSimulationPlayback, day: 3, playing: true }, { type: 'seek', day: 1 })
  assert.deepEqual(state, { ...initialSimulationPlayback, day: 1 })
})

test('policy selection pauses without changing day or speed', () => {
  for (const policy of ['none', 'random', 'targeted'] as const) {
    const state = reduce({ ...initialSimulationPlayback, day: 2, playing: true, speed: 250 }, { type: 'policy', policy })
    assert.deepEqual(state, { day: 2, policy, playing: false, speed: 250 })
  }
})

test('speed selection preserves playback, day and policy at all existing speeds', () => {
  const before = { ...initialSimulationPlayback, day: 2, policy: 'random' as const, playing: true }
  for (const speed of [1400, 700, 250]) {
    assert.deepEqual(reduce(before, { type: 'speed', speed }), { ...before, speed })
  }
})

test('reset pauses on day zero and retains the selected policy and speed', () => {
  const state = reduce({ day: 3, policy: 'none', playing: true, speed: 1400 }, { type: 'reset' })
  assert.deepEqual(state, { day: 0, policy: 'none', playing: false, speed: 1400 })
})

test('completion stops at the last day and play from the end restarts at zero', () => {
  let state = reduce({ ...initialSimulationPlayback, day: lastDay - 1, playing: true }, { type: 'tick' })
  assert.equal(state.day, lastDay)
  assert.equal(state.playing, false)
  assert.deepEqual(reduce(state, { type: 'tick' }), state)
  state = reduce(state, { type: 'toggle' })
  assert.equal(state.day, 0)
  assert.equal(state.playing, true)
})

test('next day pauses and cannot advance beyond the final day', () => {
  const state = reduce({ ...initialSimulationPlayback, day: lastDay - 1, playing: true }, { type: 'step' })
  assert.deepEqual(state, { ...initialSimulationPlayback, day: lastDay })
  assert.deepEqual(reduce(state, { type: 'step' }), state)
})

test('no frames means no temporal progression or timer', () => {
  const state = simulationPlaybackReducer(initialSimulationPlayback, { type: 'toggle' }, 0)
  assert.deepEqual(state, initialSimulationPlayback)
  assert.equal(schedulePlaybackTick(state, 0, () => assert.fail('unexpected tick')), undefined)
})

test('the scheduler uses the selected delay and cleanup rejects already queued callbacks', () => {
  for (const speed of [1400, 700, 250]) {
    let callback = () => {}
    let cancelled = 0
    let ticks = 0
    const cleanup = schedulePlaybackTick({ ...initialSimulationPlayback, playing: true, speed }, lastDay,
      () => ticks++, (tick, delay) => {
        assert.equal(delay, speed)
        callback = tick
        return () => { cancelled++ }
      })
    assert.ok(cleanup)
    callback()
    assert.equal(ticks, 1)
    cleanup()
    callback()
    assert.equal(ticks, 1)
    assert.equal(cancelled, 1)
  }
})

test('pause and completion schedule no timer; replacing a tick leaves only one active timer', () => {
  let scheduled = 0
  let active = 0
  const schedule = (_tick: () => void, _delay: number) => {
    scheduled++; active++
    return () => { active-- }
  }
  assert.equal(schedulePlaybackTick(initialSimulationPlayback, lastDay, () => {}, schedule), undefined)
  assert.equal(schedulePlaybackTick({ ...initialSimulationPlayback, day: lastDay, playing: true }, lastDay, () => {}, schedule), undefined)
  assert.equal(scheduled, 0)
  const state = { ...initialSimulationPlayback, playing: true }
  const first = schedulePlaybackTick(state, lastDay, () => {}, schedule)!
  assert.equal(active, 1)
  first()
  const replacement = schedulePlaybackTick({ ...state, speed: 250 }, lastDay, () => {}, schedule)!
  assert.equal(active, 1)
  replacement()
  assert.equal(active, 0)
})
