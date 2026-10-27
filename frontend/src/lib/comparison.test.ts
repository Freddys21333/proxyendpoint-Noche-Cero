import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createApiClient, toConfiguration, type CompareResponse } from './api.ts'
import { defaults } from './scenario.ts'
import { vaccinationsAtDay, selectionReason } from './vaccination.ts'
import { comparisonRows } from './comparison.ts'

const fixture = (): CompareResponse => JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response-no-frames.json', import.meta.url), 'utf8'))

test('comparison curves use backend means and empirical ranges without recalculating', () => {
  const source = fixture()
  const before = JSON.stringify(source)
  const rows = comparisonRows(source, 'i')
  assert.equal(rows.length, source.configuration.scenario.days + 1)
  assert.equal(rows[0].none, source.aggregatedCurves.none[0].i.mean)
  assert.deepEqual(rows[0].targetedRange, [source.aggregatedCurves.targeted[0].i.p05, source.aggregatedCurves.targeted[0].i.p95])
  assert.equal(JSON.stringify(source), before)
})

test('compare posts the preview hash and requires a complete matching experiment', async () => {
  const source = fixture()
  let sent: Record<string, unknown> = {}
  const fetcher: typeof fetch = async (_url, init) => { sent = JSON.parse(String(init?.body)); return Response.json(source) }
  await createApiClient('/v1', fetcher).compare(source.configuration, source.graphHash)
  assert.equal(sent.expectedGraphHash, source.graphHash)
  assert.equal(sent.includeRepresentativeFrames, false)
  source.progress.replicatesFailed = 1
  await assert.rejects(createApiClient('/v1', fetcher).compare(source.configuration, source.graphHash), /respuesta|contrato/i)
})

test('a result for another configuration is rejected even if its graph hash matches', async () => {
  const source = fixture()
  const fetcher: typeof fetch = async () => Response.json(source)
  await assert.rejects(createApiClient('/v1', fetcher).compare(toConfiguration(defaults), source.graphHash), /respuesta|contrato/i)
})

for (const field of ['curve', 'replicate', 'summary', 'hash'] as const) {
  test(`incomplete ${field} data cannot produce a final result`, async () => {
    const source = fixture()
    const requestedHash = source.graphHash
    if (field === 'curve') source.aggregatedCurves.targeted.pop()
    if (field === 'replicate') source.replicates.pop()
    if (field === 'summary') source.summaryByPolicy.none.cumulativeInfected.mean = null
    if (field === 'hash') source.graphHash = `sha256:${'0'.repeat(64)}`
    const fetcher: typeof fetch = async () => Response.json(source)
    await assert.rejects(createApiClient('/v1', fetcher).compare(source.configuration, requestedHash), /respuesta|contrato/i)
  })
}

const animatedFixture = (): CompareResponse => JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response.json', import.meta.url), 'utf8'))

test('animation requests and accepts complete representative frames', async () => {
  const source = animatedFixture()
  let sent: Record<string, unknown> = {}
  const fetcher: typeof fetch = async (_url, init) => { sent = JSON.parse(String(init?.body)); return Response.json(source) }
  const result = await createApiClient('/v1', fetcher).compare(source.configuration, source.graphHash, undefined, true)
  assert.equal(sent.includeRepresentativeFrames, true)
  assert.deepEqual(result.representative.frames, source.representative.frames)
})

for (const defect of ['missing', 'day', 'person', 'state', 'count', 'nodeId'] as const) {
  test(`rejects representative animation with invalid ${defect}`, async () => {
    const source = animatedFixture()
    const frames = source.representative.frames!
    if (defect === 'missing') source.representative.frames = null
    if (defect === 'day') frames.targeted.pop()
    if (defect === 'person') frames.random[0].pop()
    if (defect === 'state') (frames.none[0] as string[])[0] = 'UNKNOWN'
    if (defect === 'count') frames.none[0][0] = frames.none[0][0] === 'S' ? 'I' : 'S'
    if (defect === 'nodeId') source.graph.nodes[0].id = 999
    await assert.rejects(createApiClient('/v1', async () => Response.json(source)).compare(source.configuration, source.graphHash, undefined, true), /contrato/i)
  })
}

test('frame-size rejection retries without animation but preserves real comparison', async () => {
  const source = fixture()
  const requests: boolean[] = []
  const client = createApiClient('/v1', async (_url, init) => {
    const sent = JSON.parse(String(init?.body))
    requests.push(sent.includeRepresentativeFrames)
    return sent.includeRepresentativeFrames ? Response.json({ error: { code: 'FRAMES_TOO_LARGE', message: 'Límite de frames' } }, { status: 413 }) : Response.json(source)
  })
  const result = await client.compareForPlayback(source.configuration, source.graphHash)
  assert.deepEqual(requests, [true, false])
  assert.equal(result.representative.frames, null)
})

test('contract errors are not retried as a comparison without animation', async () => {
  const source = fixture()
  let requests = 0
  const client = createApiClient('/v1', async () => { requests++; return Response.json(source) })
  await assert.rejects(client.compareForPlayback(source.configuration, source.graphHash), /contrato/i)
  assert.equal(requests, 1)
})

const vaccinationFixture = (): CompareResponse => JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response-vaccines.json', import.meta.url), 'utf8'))

test('vaccination selections are accepted from the backend contract', async () => {
  const source = vaccinationFixture()
  const result = await createApiClient('/v1', async () => Response.json(source)).compare(source.configuration, source.graphHash, undefined, true)
  assert.deepEqual(result.replicates[0].policies.targeted.selections, source.replicates[0].policies.targeted.selections)
})

for (const defect of ['missing', 'eligibility', 'score', 'rank', 'effective', 'duplicate', 'day', 'rule', 'inventory'] as const) {
  test(`rejects invalid vaccination selection ${defect}`, async () => {
    const source = vaccinationFixture()
    const result = source.replicates[0].policies.targeted
    const rows = result.selections as unknown as Record<string, unknown>[]
    if (defect === 'missing') delete (result as Partial<typeof result>).selections
    if (defect === 'eligibility') rows[0].stateAtDecision = 'I'
    if (defect === 'score') rows[0].score = null
    if (defect === 'rank') rows[0].rank = 0
    if (defect === 'effective') rows[0].effective = 'yes'
    if (defect === 'duplicate') rows.push({...rows[0]})
    if (defect === 'day') rows[0].day = source.configuration.intervention.interventionDay + 1
    if (defect === 'rule') rows[0].tieBreak = 'seededRandom'
    if (defect === 'inventory') result.metrics.vaccinesAssigned = 0
    await assert.rejects(createApiClient('/v1', async () => Response.json(source)).compare(source.configuration, source.graphHash, undefined, true), /contrato/i)
  })
}

test('vaccination view hides future doses and restores exact selections when seeking', () => {
  const selections = vaccinationFixture().replicates[0].policies.targeted.selections.map(row => ({ ...row, day: 3 }))
  const before = JSON.stringify(selections)
  assert.deepEqual(vaccinationsAtDay(selections, 2), [])
  assert.deepEqual(vaccinationsAtDay(selections, 3), [...selections].sort((a, b) => a.rank - b.rank))
  assert.deepEqual(vaccinationsAtDay(selections, 10), vaccinationsAtDay(selections, 3))
  assert.deepEqual(vaccinationsAtDay(selections, 0), [])
  assert.equal(JSON.stringify(selections), before)
  assert.match(selectionReason(selections[0]), /menor identificador/)
  const random = vaccinationFixture().replicates[0].policies.random.selections[0]
  assert.match(selectionReason(random), /sin reemplazo/)
  assert.match(selectionReason(random), /no usa puntuación/)
})
