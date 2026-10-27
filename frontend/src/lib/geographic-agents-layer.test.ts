import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGeographicAgentLayer, type AgentMapRuntime } from './geographic-agents-layer.ts'
import type { GeographicAgent } from './manta-geography.ts'
import type { Map as LeafletMap } from 'leaflet'
import { seirColors } from '../components/seir-colors.ts'
import type { SimulationPresentation } from './simulation-playback.ts'
import type { CompareResponse, Policy } from './api.ts'
import { readFileSync } from 'node:fs'

test('Canvas markers retain each original ID, initial state color and selection callback', () => {
  const agents = ['S', 'E', 'I', 'R'].map((state, index) => ({ id: index + 10, nodeId: index + 10, lat: -0.96 + index * 0.001,
    lng: -80.7, state, householdId: 'household-0', neighborhoodId: 'neighborhood-0', sectorId: 'synthetic-sector-0',
    role: 'community', schoolId: null, busId: null, marketId: null })) as GeographicAgent[]
  const records: { center: number[]; options: any; handlers: Record<string, () => void>; popup?: () => HTMLElement; opened: number; front: boolean }[] = []
  let clears = 0, removed = 0, rendererRemoved = 0
  const renderer = { remove() { rendererRemoved++ } }
  const group = { addTo() { return this }, clearLayers() { clears++ }, remove() { removed++ } }
  const runtime = {
    canvas() { return renderer }, layerGroup() { return group },
    circleMarker(center: number[], options: unknown) {
      const record = { center, options, handlers: {}, opened: 0, front: false } as typeof records[number]
      records.push(record)
      const marker = { bindPopup(popup: () => HTMLElement) { record.popup = popup; return this },
        on(event: string, handler: () => void) { record.handlers[event] = handler; return this },
        off() { record.handlers = {}; return this }, addTo() { return this }, bringToFront() { record.front = true; return this }, openPopup() { record.opened++; return this } }
      return marker
    },
  } as unknown as AgentMapRuntime
  const selected: number[] = []
  const described: number[] = []
  const layer = createGeographicAgentLayer({} as LeafletMap, runtime, agents,
    agent => { described.push(agent.nodeId); return {} as HTMLElement }, id => selected.push(id))
  assert.equal(records.length, agents.length)
  assert.equal(records[2].front, true)
  assert.ok(records[2].options.radius > records[0].options.radius)
  for (let index = 0; index < agents.length; index++) {
    const record = records[index], agent = agents[index]
    assert.deepEqual(record.center, [agent.lat, agent.lng])
    assert.equal(record.options.renderer, renderer)
    assert.equal(record.options.fillColor, seirColors[agent.state].marker)
    record.handlers.click()
    record.popup!()
  }
  assert.deepEqual(selected, [10, 11, 12, 13])
  assert.deepEqual(described, selected)
  layer.select(12)
  assert.equal(records[2].opened, 1)
  const queuedClick = records[0].handlers.click
  layer.destroy(); layer.destroy(); queuedClick()
  assert.deepEqual(selected, [10, 11, 12, 13])
  assert.equal(clears, 1); assert.equal(removed, 1); assert.equal(rendererRemoved, 1)
  assert.ok(records.every(record => Object.keys(record.handlers).length === 0))
})

test('live frames update retained markers and the open selection without moving or rebuilding layers', () => {
  for (const size of [50, 1000, 2000]) {
    const agents = Array.from({ length: size }, (_, id) => ({ id, nodeId: id, lat: -0.96 + id * 0.0000001, lng: -80.7,
      state: 'S', householdId: `household-${id}`, neighborhoodId: 'neighborhood-0', sectorId: 'synthetic-sector-0',
      role: 'community', schoolId: null, busId: null, marketId: null })) as GeographicAgent[]
    const original = JSON.stringify(agents)
    const records: { center: number[]; options: any; clicks: number; styles: number; opened: number; content: any; popup: any; close: () => void }[] = []
    let renderers = 0, groups = 0, removed = 0, selected = -1
    const runtime = {
      canvas() { renderers++; return { remove() {} } },
      layerGroup() { groups++; return { addTo() { return this }, clearLayers() {}, remove() { removed++ } } },
      circleMarker(center: number[], options: any) {
        let describe = () => ({} as HTMLElement), open = false
        const record: typeof records[number] = { center, options, clicks: 0, styles: 0, opened: 0, content: null,
          popup: { options: { autoPan: true }, isOpen: () => open,
            setContent(value: unknown) { assert.equal(this.options.autoPan, false); record.content = value } }, close: () => { open = false } }
        records.push(record)
        return { bindPopup(value: () => HTMLElement) { describe = value; return this },
          on() { record.clicks++; return this }, off() { record.clicks--; return this }, addTo() { return this },
          bringToFront() { return this }, setStyle(value: unknown) { record.styles++; Object.assign(options, value); return this },
          setRadius(value: number) { options.radius = value; return this }, getPopup() { return record.popup },
          openPopup() { open = true; record.opened++; record.content = describe(); return this } }
      },
    } as unknown as AgentMapRuntime
    const map = { closePopup() { records.forEach(record => record.close()) } } as unknown as LeafletMap
    const layer = createGeographicAgentLayer(map, runtime, agents,
      (agent, context) => ({ id: agent.nodeId, state: agent.state, day: context.day, policy: context.policy }) as unknown as HTMLElement,
      id => { selected = id })
    const selection = Math.min(436, size - 1)
    layer.select(selection)
    const frame = agents.map((_, id) => (['S', 'E', 'I', 'R'] as const)[id % 4])
    const context = { mode: 'representative', day: 1, policy: 'targeted', frame, representativeIndex: 0 } as SimulationPresentation
    layer.update(context)
    assert.equal(records.length, size)
    assert.equal(renderers, 1); assert.equal(groups, 1); assert.equal(removed, 0)
    for (let id = 0; id < size; id++) {
      assert.deepEqual(records[id].center, [agents[id].lat, agents[id].lng])
      assert.equal(records[id].options.fillColor, seirColors[frame[id]].marker)
      assert.equal(records[id].clicks, 1)
    }
    assert.deepEqual(records[selection].content, { id: selection, state: frame[selection], day: 1, policy: 'targeted' })
    assert.equal(records[selection].opened, 1)
    assert.equal(records[selection].popup.options.autoPan, true)
    const updates = records.reduce((total, record) => total + record.styles, 0)
    layer.update({ ...context })
    assert.equal(records.reduce((total, record) => total + record.styles, 0), updates)
    const next = frame.map(state => state === 'S' ? 'R' : 'S')
    layer.update({ ...context, day: 2, policy: 'random', frame: next })
    assert.deepEqual(records[selection].content, { id: selection, state: next[selection], day: 2, policy: 'random' })
    assert.equal(records[selection].opened, 1)
    layer.update({ ...context, mode: 'no-frames', day: 0, frame: undefined })
    assert.ok(records.every(record => record.options.fillColor === seirColors.S.marker))
    assert.equal(JSON.stringify(agents), original)
    const beforeRejected = records.map(record => record.options.fillColor)
    assert.throws(() => layer.update({ ...context, frame: [] }), /Frame individual inválido/)
    assert.deepEqual(records.map(record => record.options.fillColor), beforeRejected)
    if (size === 50) {
      const backend: CompareResponse = JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response.json', import.meta.url), 'utf8'))
      for (const policy of ['none', 'random', 'targeted'] as Policy[]) {
        backend.representative.frames![policy].forEach((frame, day) => {
          assert.equal(frame.length, size)
          layer.update({ ...context, frame, policy, day, representativeIndex: backend.representative.index })
          frame.forEach((state, id) => assert.equal(records[id].options.fillColor, seirColors[state].marker))
        })
      }
    }
    layer.select(null)
    assert.equal(records[selection].popup.isOpen(), false)
    layer.destroy()
    layer.update(context)
    assert.equal(renderers, 1); assert.equal(groups, 1); assert.equal(removed, 1)
    assert.ok(records.every(record => record.clicks === 0))
    assert.equal(selected, -1)
  }
})
