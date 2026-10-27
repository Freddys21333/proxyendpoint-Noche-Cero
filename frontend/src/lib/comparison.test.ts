import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createApiClient, toConfiguration, type CompareResponse } from './api.ts'
import { defaults } from './scenario.ts'
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
