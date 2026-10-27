import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { PreviewResponse } from './api.ts'
import { networkPositions } from './network-layout.ts'
import { previewNetwork } from './preview-network.ts'

const fixture = (): PreviewResponse => JSON.parse(readFileSync(new URL('../../../schemas/examples/preview-response.json', import.meta.url), 'utf8'))

test('preview preserves population, initial cases, positions and input data', () => {
  const source = fixture()
  const before = JSON.stringify(source)
  const graph = previewNetwork(source, 'All layers')
  assert.equal(graph.nodes.length, source.graph.nodes.length)
  assert.deepEqual(graph.nodes.filter(n => n.data.state === 'I').map(n => Number(n.data.id)), source.initialInfectiousNodeIds)
  assert.equal(graph.counts.S + graph.counts.I, source.graph.nodes.length)
  assert.equal(graph.counts.E, 0)
  assert.equal(graph.counts.R, 0)
  assert.equal(JSON.stringify(source), before)
  assert.equal(new Set(graph.elements.map(e => e.data.id)).size, graph.elements.length)
})

test('layers show only active day-zero contacts, preserving parallel contexts', () => {
  const source = fixture()
  source.graph.edges = [
    { id: 0, u: 0, v: 1, context: 'household', weight: 1, activeDays: [0, 1] },
    { id: 1, u: 0, v: 1, context: 'school', weight: 0.6, activeDays: [0] },
    { id: 2, u: 1, v: 2, context: 'market', weight: 0.5, activeDays: [1] },
  ]
  assert.equal(previewNetwork(source, 'All layers').edges.length, 2)
  const homes = previewNetwork(source, 'Households')
  assert.equal(homes.edges.length, 1)
  assert.equal(homes.nodes.length, source.graph.nodes.length)
  assert.deepEqual(homes.neighbors['0'], ['1'])
  assert.deepEqual(previewNetwork(source, 'All layers').neighbors['0'], ['1'])
  assert.equal(homes.nodes.find(n => n.data.id === '2')?.data.inLayer, false)
})

test('playback uses actual person states and the selected day contact schedule', () => {
  const source = fixture()
  source.graph.edges = [
    { id: 0, u: 0, v: 1, context: 'school', weight: 1, activeDays: [0] },
    { id: 1, u: 1, v: 2, context: 'market', weight: 1, activeDays: [1] },
  ]
  const frame = source.graph.nodes.map(() => 'S' as 'S' | 'E' | 'I' | 'R')
  frame[0] = 'R'; frame[1] = 'E'; frame[2] = 'I'
  const before = JSON.stringify(source)
  const graph = previewNetwork(source, 'All layers', 1, frame)
  assert.deepEqual(graph.nodes.slice(0, 3).map(node => node.data.state), ['R', 'E', 'I'])
  assert.deepEqual(graph.counts, { S: frame.length - 3, E: 1, I: 1, R: 1 })
  assert.deepEqual(graph.edges.map(edge => edge.data.id), ['edge-1'])
  assert.deepEqual(graph.neighbors['1'], ['2'])
  assert.equal(previewNetwork(source, 'Schools', 1, frame).edges.length, 0)
  assert.deepEqual(graph.nodes.map(node => node.position), previewNetwork(source, 'All layers').nodes.map(node => node.position))
  assert.equal(JSON.stringify(source), before)
})

test('vaccination markers follow actual dose outcomes and do not replace SEIR states', () => {
  const source = fixture()
  const selections = [
    { day: 2, nodeId: 0, rank: 1, score: 3, stateAtDecision: 'S' as const, contexts: [], tieBreak: 'nodeIdAsc' as const, effective: true },
    { day: 2, nodeId: 1, rank: 2, score: 2, stateAtDecision: 'S' as const, contexts: [], tieBreak: 'nodeIdAsc' as const, effective: false },
  ]
  assert.ok(previewNetwork(source, 'All layers', 1, undefined, selections).nodes.every(node => node.data.vaccination === 'none'))
  const graph = previewNetwork(source, 'All layers', 2, undefined, selections)
  assert.deepEqual(graph.nodes.slice(0, 2).map(node => node.data.vaccination), ['effective', 'ineffective'])
  assert.deepEqual(graph.nodes.map(node => node.data.state), previewNetwork(source, 'All layers').nodes.map(node => node.data.state))
  assert.ok(previewNetwork(source, 'All layers').nodes.every(node => node.data.vaccination === 'none'))
})

for (const mode of ['householdId', 'schoolId', 'busId', 'marketId', 'neighborhoodId'] as const) {
  test(`layout ${mode} preserves people and creates deterministic finite separated positions`, () => {
    const source = fixture()
    const before = JSON.stringify(source)
    const layout = networkPositions(source, mode)
    assert.equal(layout.length, source.graph.nodes.length)
    assert.equal(new Set(layout.map(p => p.nodeId)).size, source.graph.nodes.length)
    assert.equal(new Set(layout.map(p => `${p.x},${p.y}`)).size, source.graph.nodes.length)
    assert.ok(layout.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))
    assert.deepEqual(networkPositions(source, mode), layout)
    assert.deepEqual(networkPositions({ ...source, graph: { ...source.graph, nodes: [...source.graph.nodes].reverse() } }, mode), layout)
    assert.equal(layout.filter(p => p.label).length, new Set(source.graph.nodes.map(n => n[mode])).size)
    assert.equal(JSON.stringify(source), before)
  })
}

test('circular layout preserves backend preview coordinates and handles unassigned memberships', () => {
  const source = fixture()
  const circle = networkPositions(source, 'circle')
  const radius = Math.max(230, source.graph.nodes.length * 3)
  assert.deepEqual(circle.map(p => [p.x, p.y]), source.positions.map(p => [p.x * radius, p.y * radius]))
  source.graph.nodes.forEach(node => { node.schoolId = null })
  const grouped = networkPositions(source, 'schoolId')
  assert.equal(grouped.filter(p => p.label).length, 1)
  assert.match(grouped.find(p => p.label)!.label, /Sin colegio/)
})
