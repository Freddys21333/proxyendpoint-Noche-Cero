import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createApiClient } from './api.ts'
import { apiErrorView } from './api-errors.ts'

test('409 mismatch explains the stale preview and offers a new preview', () => {
  const view = apiErrorView(new ApiError(409, 'GRAPH_HASH_MISMATCH', 'raw backend detail'), 'comparison')
  assert.equal(view.title, 'La red cambió antes de completar la comparación')
  assert.equal(view.action, 'repreview')
  assert.equal(view.actionLabel, 'Consultar la red de nuevo')
  assert.ok(!view.description.includes('raw backend detail'))
})

test('422 validation points back to editable parameters and preserves user values', () => {
  const view = apiErrorView(new ApiError(422, 'VALIDATION_ERROR', 'raw detail'), 'preview')
  assert.equal(view.action, 'parameters')
  assert.match(view.description, /Conservamos tus valores/)
})

test('413 tells the user to reduce scenario size', () => {
  const view = apiErrorView(new ApiError(413, 'GRAPH_TOO_LARGE', 'raw detail'), 'preview')
  assert.equal(view.actionLabel, 'Ajustar escenario')
  assert.match(view.description, /Reduce población, horizonte o réplicas/)
})

test('429 uses the server Retry-After value without inventing a wait', async () => {
  const client = createApiClient('/v1', async () => Response.json({ error: { code: 'RATE_LIMITED', message: 'detail', fields: [] } }, { status: 429, headers: { 'Retry-After': '17' } }))
  await assert.rejects(client.health(), (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.retryAfterSeconds, 17)
    const view = apiErrorView(error, 'startup')
    assert.match(view.description, /17 segundos/)
    return true
  })
})

test('503 gives a recoverable service-unavailable message', () => {
  const view = apiErrorView(new ApiError(503, 'COMPUTE_UNAVAILABLE', 'raw detail'), 'comparison')
  assert.equal(view.title, 'El motor no está disponible por ahora')
  assert.equal(view.actionLabel, 'Reintentar comparación')
})
