import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { CompareResponse, PreviewResponse, Policy } from './api.ts'
import { previewNetwork } from './preview-network.ts'
import {
  initialSimulationPlayback,
  simulationPlaybackReducer,
  schedulePlaybackTick,
  getSimulationSource,
  readSimulationPresentation,
  type SimulationPlaybackState,
} from './simulation-playback.ts'

function backendFixture() {
  const comparison: CompareResponse = JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response.json', import.meta.url), 'utf8'))
  const preview: PreviewResponse = JSON.parse(readFileSync(new URL('../../../schemas/examples/preview-response.json', import.meta.url), 'utf8'))
  preview.configuration = structuredClone(comparison.configuration)
  preview.graph = structuredClone(comparison.graph)
  preview.graphHash = comparison.graphHash
  preview.initialInfectiousNodeIds = comparison.representative.frames!.none[0].flatMap((state, id) => state === 'I' ? [id] : [])
  return { comparison, preview }
}

test('both views consume each representative frame by ID with its own daily counts for every policy', () => {
  const { preview, comparison } = backendFixture()
  const original = JSON.stringify({ preview, comparison })
  const source = getSimulationSource(preview, comparison, true, 'idle')
  for (const policy of ['none', 'random', 'targeted'] as Policy[]) {
    for (let day = 0; day <= comparison.configuration.scenario.days; day++) {
      const presentation = readSimulationPresentation(preview, source, day, policy)
      assert.equal(presentation.mode, 'representative')
      assert.equal(presentation.frame, comparison.representative.frames![policy][day])
      const graph = previewNetwork(preview, 'All layers', day, presentation.frame)
      assert.deepEqual(graph.counts, presentation.counts)
      assert.deepEqual(graph.nodes.map(node => node.data.state), presentation.frame)
      const daily = comparison.replicates[comparison.representative.index].policies[policy].daily[day] as unknown as Record<string, number>
      for (const state of ['S', 'E', 'I', 'R'] as const) assert.equal(presentation.counts[state], daily[state.toLowerCase()])
    }
  }
  assert.equal(JSON.stringify({ preview, comparison }), original)
})

test('invalidated, pending, failed and frame-free comparisons expose only an explicit initial fallback', () => {
  const { preview, comparison } = backendFixture()
  const cases = [
    { active: false, status: 'idle' as const, comparison, mode: 'invalid' },
    { active: true, status: 'running' as const, comparison, mode: 'pending' },
    { active: true, status: 'error' as const, comparison, mode: 'error' },
    { active: true, status: 'idle' as const, comparison: null, mode: 'preview' },
    { active: true, status: 'idle' as const, comparison: { ...comparison, representative: { ...comparison.representative, frames: null } }, mode: 'no-frames' },
  ]
  for (const row of cases) {
    const source = getSimulationSource(preview, row.comparison, row.active, row.status)
    const shown = readSimulationPresentation(preview, source, 2, 'targeted')
    assert.equal(shown.mode, row.mode)
    assert.equal(shown.frame, undefined)
    assert.equal(shown.day, 0)
    assert.equal(source.lastDay, 0)
    assert.deepEqual(shown.counts, { S: preview.graph.nodes.length - preview.initialInfectiousNodeIds.length, E: 0, I: preview.initialInfectiousNodeIds.length, R: 0 })
  }
})

test('a different graph or epidemiological configuration cannot animate an old scenario', () => {
  const { preview, comparison } = backendFixture()
  for (const change of ['hash', 'configuration'] as const) {
    const other = structuredClone(comparison)
    if (change === 'hash') other.graphHash = `sha256:${'f'.repeat(64)}`
    else other.configuration.scenario.beta += 0.01
    assert.equal(getSimulationSource(preview, other, true, 'idle').mode, 'error')
  }
})

test('a frame inconsistent with its representative daily row is rejected without inventing individual states', () => {
  const { preview, comparison } = backendFixture()
  const source = getSimulationSource(preview, comparison, true, 'idle')
  const row = comparison.replicates[comparison.representative.index].policies.targeted.daily[0] as unknown as Record<string, number>
  row.s++
  const shown = readSimulationPresentation(preview, source, 0, 'targeted')
  assert.equal(shown.mode, 'error')
  assert.equal(shown.frame, undefined)
})

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

test('previous day pauses and cannot retreat below day zero', () => {
  let state = reduce({ ...initialSimulationPlayback, day: 2, playing: true }, { type: 'step-back' })
  assert.deepEqual(state, { ...initialSimulationPlayback, day: 1, playing: false })
  state = reduce(state, { type: 'step-back' })
  assert.equal(state.day, 0)
  state = reduce(state, { type: 'step-back' })
  assert.equal(state.day, 0)
  assert.equal(state.playing, false)
})

test('reduced motion mode can be toggled without changing day or policy', () => {
  const before = { ...initialSimulationPlayback, day: 3, policy: 'targeted' as const }
  const enabled = reduce(before, { type: 'reduced-motion', enabled: true })
  assert.equal(enabled.reducedMotion, true)
  assert.equal(enabled.day, 3)
  assert.equal(enabled.policy, 'targeted')
  const disabled = reduce(enabled, { type: 'reduced-motion', enabled: false })
  assert.equal(disabled.reducedMotion, false)
  assert.equal(disabled.day, 3)
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
