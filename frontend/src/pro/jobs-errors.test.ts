import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { ApiError, type JobResponse } from '../lib/api.ts'
import { classifyJobError, mergeJobStatus, nextJobPollDelay } from './jobs-errors.ts'

test('expired or invalid access stops polling and permits removing the saved job', () => {
  for (const status of [403, 404]) {
    const issue = classifyJobError(new ApiError(status, 'JOB_NOT_FOUND', 'missing'))
    assert.equal(issue.retryable, false)
    assert.equal(issue.unavailable, true)
    assert.match(issue.message, /no está disponible|sesión/i)
  }
})

test('temporary network and queue errors retry while preserving the server wait', () => {
  const offline = classifyJobError(new ApiError(0, 'NETWORK_ERROR', 'Sin conexión'))
  assert.equal(offline.retryable, true)
  assert.equal(offline.unavailable, false)
  const busy = classifyJobError(new ApiError(429, 'QUEUE_FULL', 'Cola llena', [], 20))
  assert.equal(busy.retryable, true)
  assert.match(busy.message, /cola/i)
  assert.equal(nextJobPollDelay(1500, busy), 20000)
  assert.equal(nextJobPollDelay(1500, offline), 1500)
  const proxyDown = classifyJobError(new ApiError(502, 'INVALID_RESPONSE', 'respuesta inválida'))
  assert.equal(proxyDown.retryable, true)
  assert.match(proxyDown.message, /servidor.*disponible/i)
  const full = classifyJobError(new ApiError(503, 'COMPUTE_UNAVAILABLE', 'La cola o retención local está llena.'))
  assert.equal(full.retryable, true)
  assert.match(full.message, /cola|retención/i)
})

test('oversized result is a permanent error with a recovery action', () => {
  const issue = classifyJobError(new ApiError(413, 'RESULT_TOO_LARGE', 'Excede el límite'))
  assert.equal(issue.retryable, false)
  assert.match(issue.message, /reduc/i)
})

test('a late poll cannot undo an accepted cancellation or completed response', () => {
  const source = JSON.parse(readFileSync(new URL('../../../schemas/examples/job-status-response.json', import.meta.url), 'utf8')) as JobResponse
  const running = { ...source, status: 'running' as const }
  for (const status of ['cancelled', 'completed', 'failed'] as const) {
    const terminal = { ...source, status }
    assert.equal(mergeJobStatus(terminal, running), terminal)
  }
  const cancelled = { ...source, status: 'cancelled' as const }
  assert.equal(mergeJobStatus(running, cancelled), cancelled)
})
