import assert from 'node:assert/strict'
import test from 'node:test'
import type { ConfigurationInput, JobResponse, PreviewResponse } from '../lib/api.ts'
import {
  isTerminalJob, jobConfigurationFrom, jobErrorMessage, jobFromResponse, jobMaxReplicates, jobOutcome,
  jobProgressPercent, jobStatusDescriptions, jobStatusLabels, mergeJob, statusFromApi, validateJobDraft,
} from './jobs-model.ts'

const configuration = (overrides: Partial<ConfigurationInput> = {}): ConfigurationInput => ({
  rootSeed: 20261026,
  networkMode: 'fixed',
  repetitions: 30,
  scenario: { populationSize: 200, days: 10, beta: 0.08, sigma: 0.1, gamma: 0.1, initialInfectious: 1, origin: { kind: 'random', value: null } },
  intervention: { vaccines: 20, interventionDay: 0, vaccineEfficacy: 1 },
  policies: ['none', 'random', 'targeted'],
  ...overrides,
})

const response = (overrides: Partial<JobResponse> = {}): JobResponse => ({
  schemaVersion: '1.0', engineVersion: '0.1.0', requestId: 'job-1',
  jobId: '0f6a2a4e-2a37-4f3e-9d3f-1b7b0b0b0b0b',
  status: 'pending',
  createdAt: '2026-10-27T12:00:00.000Z',
  updatedAt: '2026-10-27T12:00:00.000Z',
  statusUrl: '/v1/jobs/0f6a2a4e-2a37-4f3e-9d3f-1b7b0b0b0b0b',
  resultUrl: '/v1/jobs/0f6a2a4e-2a37-4f3e-9d3f-1b7b0b0b0b0b/result',
  progress: { replicatesTotal: 30, replicatesCompleted: 0, replicatesFailed: 0 },
  manifest: {
    modelVersion: 'local-jobs-v1',
    configurationHash: `sha256:${'a'.repeat(64)}`,
    graphHash: `sha256:${'b'.repeat(64)}`,
    requestHash: `sha256:${'c'.repeat(64)}`,
    rootSeed: 20261026,
    engineVersion: '0.1.0',
    rngVersion: 'rng-v1',
    runtimeVersions: { engineVersion: '0.1.0', rngVersion: 'rng-v1' },
    replicates: [],
  },
  ...overrides,
})

const limits = (maxRepetitions: number) => ({ maxRepetitions, maxConcurrent: 2, maxRetained: 8, retentionSeconds: 3600, maxEdgeDayReplicates: 50000000 })

test('draft validation uses the server maximum and never clamps', () => {
  assert.deepEqual(validateJobDraft({ replicates: 100, rootSeed: 20261026 }), {})
  assert.deepEqual(validateJobDraft({ replicates: 50, rootSeed: 20261026 }, limits(50)), {})
  assert.match(validateJobDraft({ replicates: 1, rootSeed: 1 }).replicates!, /entre 2 y 100/)
  assert.match(validateJobDraft({ replicates: 101, rootSeed: 1 }).replicates!, /entre 2 y 100/)
  assert.match(validateJobDraft({ replicates: 51, rootSeed: 1 }, limits(50)).replicates!, /entre 2 y 50/)
  assert.match(validateJobDraft({ replicates: Number.NaN, rootSeed: 1 }).replicates!, /entero/)
  assert.match(validateJobDraft({ replicates: 10, rootSeed: -1 }).rootSeed!, /entre 0 y/)
  assert.match(validateJobDraft({ replicates: 10, rootSeed: 4294967296 }).rootSeed!, /entre 0 y/)
})

test('server limits fall back to the documented local default', () => {
  assert.equal(jobMaxReplicates(undefined), 100)
  assert.equal(jobMaxReplicates({ maxRepetitions: 250, maxConcurrent: 2, maxRetained: 8, retentionSeconds: 3600, maxEdgeDayReplicates: 50000000 }), 250)
})

test('every API status maps to a labelled UI status and terminal set', () => {
  const pairs = [
    ['pending', 'PENDING'], ['running', 'RUNNING'], ['aggregating', 'AGGREGATING'],
    ['completed', 'SUCCEEDED'], ['failed', 'FAILED'], ['cancelled', 'CANCELLED'],
  ] as const
  for (const [api, ui] of pairs) {
    assert.equal(statusFromApi(api), ui)
    assert.ok(jobStatusLabels[ui].length > 0)
    assert.ok(jobStatusDescriptions[ui].length > 0)
  }
  assert.equal(isTerminalJob(jobFromResponse(response({ status: 'cancelled' }), configuration())), true)
  assert.equal(isTerminalJob(jobFromResponse(response({ status: 'running' }), configuration())), false)
})

test('progress counts completed plus failed and never exceeds one hundred', () => {
  const running = jobFromResponse(response({ status: 'running', progress: { replicatesTotal: 30, replicatesCompleted: 12, replicatesFailed: 3 } }), configuration())
  assert.equal(jobProgressPercent(running), 50)
  assert.equal(jobOutcome(running).label, 'Ejecutando')
  const overrun = { ...running, progress: { total: 10, succeeded: 12, failed: 4 } }
  assert.equal(jobProgressPercent(overrun), 100)
  assert.equal(jobProgressPercent({ ...running, progress: { total: 0, succeeded: 0, failed: 0 } }), 0)
})

test('a completed aggregate with failed replicates is labelled partial', () => {
  const partial = jobFromResponse(response({ status: 'completed', progress: { replicatesTotal: 30, replicatesCompleted: 28, replicatesFailed: 2 } }), configuration())
  assert.deepEqual(jobOutcome(partial), { label: 'Resultado incompleto', partial: true })
  const complete = jobFromResponse(response({ status: 'completed', progress: { replicatesTotal: 30, replicatesCompleted: 30, replicatesFailed: 0 } }), configuration())
  assert.deepEqual(jobOutcome(complete), { label: 'Completado', partial: false })
})

test('a server error keeps its code and a readable message', () => {
  const failed = jobFromResponse(response({ status: 'failed', error: 'SIMULATION_FAILED' }), configuration())
  assert.deepEqual(failed.error, { code: 'SIMULATION_FAILED', message: 'Una réplica falló y el servidor no completó el agregado.' })
  assert.equal(jobFromResponse(response({ status: 'failed' }), configuration()).error, null)
})

test('the job reuses the previewed scenario and only replaces replicates and seed', () => {
  const base = configuration()
  const next = jobConfigurationFrom(base, { replicates: 75, rootSeed: 7 })
  assert.equal(next.repetitions, 75)
  assert.equal(next.rootSeed, 7)
  assert.deepEqual(next.scenario, base.scenario)
  assert.equal(base.repetitions, 30)
  assert.equal(mergeJob(jobFromResponse(response(), base), jobFromResponse(response({ status: 'running' }), next)).configuration.repetitions, 30)
})

test('API errors are translated and unknown codes keep a generic message', () => {
  assert.match(jobErrorMessage({ code: 'JOB_NOT_FOUND' }), /expiró o el servidor local se reinició/)
  assert.match(jobErrorMessage({ code: 'JOB_NOT_READY' }), /todavía no tiene un resultado completo/)
  assert.match(jobErrorMessage({ code: 'IDEMPOTENCY_CONFLICT' }), /idempotencia/)
  assert.equal(jobErrorMessage({ code: 'DESCONOCIDO' }), 'No se pudo completar la operación con el trabajo.')
  assert.equal(jobErrorMessage(null), 'No se pudo completar la operación con el trabajo.')
})


test('workload limit follows the preview and never changes the requested draft', () => {
  const preview = { configuration: { ...configuration(), scenario: { ...configuration().scenario, days: 90 } }, graph: { edges: new Array(59373) } } as unknown as PreviewResponse
  const caps = limits(100)
  assert.equal(jobMaxReplicates(caps, preview), 9)
  const draft = { replicates: 30, rootSeed: 20261026 }
  assert.match(validateJobDraft(draft, caps, preview).replicates!, /entre 2 y 9/)
  assert.equal(draft.replicates, 30)
  assert.deepEqual(validateJobDraft({ ...draft, replicates: 9 }, caps, preview), {})
  assert.match(validateJobDraft({ replicates: 9, rootSeed: 123 }, caps, preview).rootSeed!, /vista previa/)
  assert.equal(jobMaxReplicates({ ...caps, maxEdgeDayReplicates: 1 }, preview), 0)
  assert.match(validateJobDraft({ ...draft, replicates: 2 }, { ...caps, maxEdgeDayReplicates: 1 }, preview).replicates!, /población|duración/)
})
