import { test } from 'node:test'
import assert from 'node:assert/strict'
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assignGeographicAgents, validateGeographicResource, insideRing } from './manta-geography.ts'
import type { PreviewResponse } from './api.ts'

const resource = () => validateGeographicResource(JSON.parse(readFileSync(new URL('../data/manta-residential.json', import.meta.url), 'utf8')))
const preview = (population = 50): PreviewResponse => {
  const value = JSON.parse(readFileSync(new URL('../../../schemas/examples/preview-response.json', import.meta.url), 'utf8'))
  value.graph.nodes = Array.from({ length: population }, (_, id) => ({ id, role: 'community', householdId: `household-${Math.floor(id / 4)}`, neighborhoodId: `neighborhood-${id % 5}`, schoolId: null, busId: null, marketId: null }))
  value.configuration.scenario.populationSize = population
  value.configuration.scenario.initialInfectious = 2
  value.initialInfectiousNodeIds = [1, 3]
  return value
}

test('the versioned OSM resource expands to twenty-two residential polygons across western Manta', () => {
  const data = resource()
  assert.equal(data.features.length, 22)
  assert.equal(data.resourceVersion, 'manta-residential-osm-v3')
  assert.ok(Math.min(...data.features.flatMap(f => f.geometry.coordinates[0].map(p => p[0]))) < -80.75)
  assert.ok(data.source.extractedAt.endsWith('Z'))
  for (const feature of data.features) {
    assert.equal(feature.properties.landuse, 'residential')
    assert.match(feature.properties.sourceSha256, /^sha256:[a-f0-9]{64}$/)
    assert.match(feature.properties.sourceUrl, /^https:\/\/api.openstreetmap.org\//)
  }
  assert.equal(insideRing([-80.71, -0.9], data.features[0].geometry.coordinates[0]), false)
})

test('larger footprints receive more households while anchors remain separated and every sector is used', () => {
  const data = structuredClone(resource())
  data.features = data.features.slice(0, 2)
  data.features[0].geometry.coordinates = [[[-80.72, -0.98], [-80.719, -0.98], [-80.719, -0.979], [-80.72, -0.979], [-80.72, -0.98]]]
  data.features[1].geometry.coordinates = [[[-80.71, -0.98], [-80.702, -0.98], [-80.702, -0.972], [-80.71, -0.972], [-80.71, -0.98]]]
  const source = preview(1000)
  // One person per household makes observed positions the household anchors.
  source.graph.nodes.forEach(node => { node.householdId = `household-${node.id}` })
  const agents = assignGeographicAgents(source, data)
  const small = agents.filter(a => a.sectorId === data.features[0].properties.sectorId)
  const large = agents.filter(a => a.sectorId === data.features[1].properties.sectorId)
  assert.ok(small.length > 0 && small.length < 30, `small footprint contains ${small.length} households`)
  assert.ok(large.length > 970)
  const nearest = large.map((a, index) => Math.sqrt(Math.min(...large.filter((_, i) => i !== index)
    .map(b => (a.lng - b.lng) ** 2 + (a.lat - b.lat) ** 2))))
  nearest.sort((a, b) => a - b)
  assert.ok(nearest[Math.floor(nearest.length / 2)] > 0.0001, 'households must use the available footprint instead of clustering')
})

test('all original IDs receive deterministic interior positions without mutating the experiment', () => {
  for (const size of [50, 1000, 2000]) {
    const source = preview(size)
    const before = JSON.stringify(source)
    const data = resource()
    const agents = assignGeographicAgents(source, data)
    assert.equal(agents.length, size)
    assert.deepEqual(agents.map(agent => agent.nodeId), source.graph.nodes.map(node => node.id))
    assert.deepEqual(agents, assignGeographicAgents(source, data))
    assert.ok(agents.every(agent => insideRing([agent.lng, agent.lat], data.features.find(f => f.properties.sectorId === agent.sectorId)!.geometry.coordinates[0])))
    assert.equal(JSON.stringify(source), before)
  }
})

test('locations depend on the geographic seed and groups, not node order, visual xy, policy or day', () => {
  const source = preview()
  const data = resource()
  const expected = assignGeographicAgents(source, data)
  const reordered = structuredClone(source)
  reordered.graph.nodes.reverse()
  reordered.positions = []
  assert.deepEqual(assignGeographicAgents(reordered, data), expected)
  const changed = structuredClone(source)
  changed.configuration.rootSeed++
  assert.notDeepEqual(assignGeographicAgents(changed, data).map(a => [a.lat, a.lng]), expected.map(a => [a.lat, a.lng]))
})

test('household clusters retain original neighborhood IDs and only actual preview initial infections', () => {
  const source = preview()
  const agents = assignGeographicAgents(source, resource())
  assert.equal(new Set(agents.map(a => a.sectorId)).size, Math.min(new Set(agents.map(a => a.householdId)).size, resource().features.length))
  assert.deepEqual(agents.filter(a => a.state === 'I').map(a => a.nodeId), [1, 3])
  assert.ok(agents.filter(a => ![1, 3].includes(a.nodeId)).every(a => a.state === 'S'))
  for (const agent of agents) {
    const node = source.graph.nodes.find(n => n.id === agent.nodeId)!
    assert.equal(agent.neighborhoodId, node.neighborhoodId)
    assert.equal(agent.householdId, node.householdId)
    const members = agents.filter(a => a.householdId === agent.householdId)
    assert.ok(members.every(a => a.sectorId === agent.sectorId && Math.abs(a.lat - agent.lat) < 0.001 && Math.abs(a.lng - agent.lng) < 0.001))
  }
})

test('invalid geographic masks are rejected instead of producing invented locations', () => {
  for (const corrupt of [
    (data: any) => { data.features[0].properties.landuse = 'water' },
    (data: any) => { data.features[0].geometry.coordinates[0].pop() },
    (data: any) => { data.features[0].geometry.coordinates[0][0] = [0, 0] },
    (data: any) => { data.features[0].properties.sourceSha256 = '' },
  ]) {
    const data = structuredClone(resource())
    corrupt(data)
    assert.throws(() => validateGeographicResource(data))
  }
})

test('the offline preparation command documents its inputs and rejects unknown options before writing', () => {
  const script = fileURLToPath(new URL('../../../scripts/prepare-manta-geography.mjs', import.meta.url))
  const directory = mkdtempSync(join(tmpdir(), 'manta-geography-cli-'))
  const run = (args: string[]) => {
    const stdoutPath = join(directory, 'stdout.txt')
    const stderrPath = join(directory, 'stderr.txt')
    const stdoutFd = openSync(stdoutPath, 'w')
    const stderrFd = openSync(stderrPath, 'w')
    const result = spawnSync(process.execPath, ['--experimental-strip-types', script, ...args], { stdio: ['ignore', stdoutFd, stderrFd] })
    closeSync(stdoutFd)
    closeSync(stderrFd)
    return { ...result, stdout: readFileSync(stdoutPath, 'utf8'), stderr: readFileSync(stderrPath, 'utf8') }
  }
  try {
    const help = run(['--help'])
    assert.equal(help.status, 0)
    assert.match(help.stdout, /--source-dir DIR --extracted-at UTC/)
    assert.equal(help.stderr, '')
    const invalid = run(['--unsupported'])
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /Invalid argument/)
    assert.equal(invalid.stdout, '')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
