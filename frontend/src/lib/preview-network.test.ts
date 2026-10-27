import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { PreviewResponse } from './api.ts'
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
