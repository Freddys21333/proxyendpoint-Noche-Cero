import assert from 'node:assert/strict'
import test from 'node:test'
import type { CompareResponse } from './api.ts'
import { fetchMayorReport } from './mayor-report.ts'

test('report sends the complete experiment and accepts only a PDF', async () => {
  const source = { manifest: { experimentHash: 'sha256:test' } } as CompareResponse
  const blob = await fetchMayorReport(source, undefined, async (url, init) => {
    assert.equal(url, '/v1/reports/mayor')
    assert.deepEqual(JSON.parse(String(init?.body)), source)
    return new Response('%PDF-test', { headers: { 'Content-Type': 'application/pdf' } })
  })
  assert.equal(blob.type, 'application/pdf')
  await assert.rejects(fetchMayorReport(source, undefined, async () => Response.json({})), /PDF válido/)
})

test('report exposes readable server errors and propagates cancellation', async () => {
  const source = {} as CompareResponse
  await assert.rejects(fetchMayorReport(source, undefined, async () => Response.json({ error: { message: 'Experimento incompleto.' } }, { status: 422 })), /Experimento incompleto/)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(fetchMayorReport(source, controller.signal, async (_url, init) => {
    init?.signal?.throwIfAborted()
    return new Response('%PDF-test')
  }), { name: 'AbortError' })
})
