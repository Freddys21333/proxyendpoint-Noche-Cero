import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { CompareResponse, JobResponse } from '../lib/api.ts'
import {
  advanceDemoJob, cancelDemoJob, createDemoJob, isTerminalJob, jobOutcome, mapApiJob, previewConfigurationForJob,
  jobProgressPercent, validateJobDraft,
} from './jobs-model.ts'
import { initialDemoJobs } from './fixtures/jobs.ts'

const at = (minute: number) => new Date(`2026-10-27T12:${String(minute).padStart(2, '0')}:00.000Z`)

test('job draft rejects out-of-range replicates and seeds without clamping', () => {
  assert.deepEqual(validateJobDraft({ replicates: 1000, rootSeed: 20261026 }), {})
  assert.match(validateJobDraft({ replicates: 1, rootSeed: 1 }).replicates!, /entre 2 y 1.000/)
  assert.match(validateJobDraft({ replicates: 1001, rootSeed: 1 }).replicates!, /entre 2 y 1.000/)
  assert.match(validateJobDraft({ replicates: Number.NaN, rootSeed: 1 }).replicates!, /entero/)
  assert.match(validateJobDraft({ replicates: 10, rootSeed: -1 }).rootSeed!, /entre 0 y/)
  assert.match(validateJobDraft({ replicates: 10, rootSeed: 4294967296 }).rootSeed!, /entre 0 y/)
  assert.deepEqual(validateJobDraft({ replicates: 100, rootSeed: 1 }, 100), {})
  assert.match(validateJobDraft({ replicates: 101, rootSeed: 1 }, 100).replicates!, /entre 2 y 100/)
})

test('a demo job moves through real UI states and keeps a terminal state stable', () => {
  const created = createDemoJob({ replicates: 2, rootSeed: 7 }, at(0), 'job-1')
  assert.equal(created.status, 'QUEUED')
  assert.equal(created.progress.total, 2)
  assert.equal(created.source, 'fixture')

  const running = advanceDemoJob(created, at(1))
  assert.equal(running.status, 'RUNNING')
  assert.equal(running.startedAt, at(1).toISOString())
  assert.equal(running.progress.succeeded, 0)

  const progressing = advanceDemoJob(running, at(2))
  assert.equal(progressing.status, 'RUNNING')
  assert.equal(progressing.progress.succeeded, 1)

  const aggregating = advanceDemoJob(progressing, at(3))
  assert.equal(aggregating.status, 'AGGREGATING')
  assert.equal(aggregating.progress.succeeded, 2)

  const succeeded = advanceDemoJob(aggregating, at(4))
  assert.equal(succeeded.status, 'SUCCEEDED')
  assert.equal(succeeded.finishedAt, at(4).toISOString())
  assert.equal(succeeded.result?.policies.length, 3)
  assert.equal(isTerminalJob(succeeded), true)

  assert.deepEqual(advanceDemoJob(succeeded, at(4)), succeeded)
  assert.equal(jobProgressPercent(succeeded), 100)
})

test('cancelling stops progress and never fabricates a result', () => {
  const created = createDemoJob({ replicates: 100, rootSeed: 1 }, at(0), 'job-2')
  const running = advanceDemoJob(created, at(1))
  const cancelled = cancelDemoJob(running, at(2))
  assert.equal(cancelled.status, 'CANCELLED')
  assert.equal(cancelled.finishedAt, at(2).toISOString())
  assert.equal(cancelled.result, null)
  assert.deepEqual(cancelDemoJob(cancelled, at(3)), cancelled)
})

test('partial aggregates are labelled and never presented as complete', () => {
  const created = createDemoJob({ replicates: 10, rootSeed: 1 }, at(0), 'job-3')
  const partial = { ...created, status: 'SUCCEEDED' as const, progress: { total: 10, succeeded: 9, failed: 1 } }
  assert.deepEqual(jobOutcome(partial), { label: 'Resultado incompleto', partial: true })
  assert.equal(jobOutcome(created).label, 'En cola')
})

test('the fixture history exposes completed, failed and cancelled states', () => {
  const jobs = initialDemoJobs(at(0))
  assert.deepEqual(jobs.map(job => job.status), ['SUCCEEDED', 'FAILED', 'CANCELLED'])
  assert.equal(jobs[0].result?.policies.length, 3)
  assert.equal(jobs[1].error?.code, 'REPLICA_FAILED')
  assert.equal(jobs[2].result, null)
})

test('a real API job maps backend status and progress without simulating progress', () => {
  const response = JSON.parse(readFileSync(new URL('../../../schemas/examples/job-status-response.json', import.meta.url), 'utf8')) as JobResponse
  const configuration = JSON.parse(readFileSync(new URL('../../../schemas/examples/job-create-request.json', import.meta.url), 'utf8')).configuration
  const job = mapApiJob({ ...response, status: 'running', progress: { ...response.progress, replicatesCompleted: 8 } }, configuration)
  assert.equal(job.source, 'api')
  assert.equal(job.status, 'RUNNING')
  assert.deepEqual(job.progress, { total: 31, succeeded: 8, failed: 0 })
  assert.equal(job.result, null)
})

test('a completed API job exposes only its complete backend aggregate', () => {
  const response = JSON.parse(readFileSync(new URL('../../../schemas/examples/job-status-response.json', import.meta.url), 'utf8')) as JobResponse
  const configuration = JSON.parse(readFileSync(new URL('../../../schemas/examples/job-create-request.json', import.meta.url), 'utf8')).configuration
  const incomplete = mapApiJob({ ...response, status: 'completed', progress: { ...response.progress, replicatesCompleted: response.progress.replicatesTotal - 1 } }, configuration)
  assert.equal(incomplete.status, 'SUCCEEDED')
  assert.equal(incomplete.result, null)
})

test('preview caps only the synchronous configuration while preserving the job repetitions and root seed', () => {
  const configuration = JSON.parse(readFileSync(new URL('../../../schemas/examples/job-create-request.json', import.meta.url), 'utf8')).configuration
  configuration.repetitions = 100
  const preview = previewConfigurationForJob(configuration, 30)
  assert.equal(preview.repetitions, 30)
  assert.equal(configuration.repetitions, 100)
  assert.equal(preview.rootSeed, configuration.rootSeed)
  assert.equal(preview.scenario.populationSize, configuration.scenario.populationSize)
})
