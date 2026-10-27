import assert from 'node:assert/strict'
import test from 'node:test'
import type { ConfigurationInput } from '../lib/api.ts'
import { JOB_STORAGE_KEY, readStoredJobs, removeStoredJob, saveStoredJobs, upsertStoredJob, type StoredJob } from './job-session.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    dump: () => data,
  }
}

const configuration = (rootSeed = 20261026): ConfigurationInput => ({
  rootSeed, networkMode: 'fixed', repetitions: 10,
  scenario: { populationSize: 100, days: 5, beta: 0.08, sigma: 0.1, gamma: 0.1, initialInfectious: 1, origin: { kind: 'random', value: null } },
  intervention: { vaccines: 10, interventionDay: 0, vaccineEfficacy: 1 },
  policies: ['none', 'random', 'targeted'],
})

const stored = (id: string, rootSeed = 20261026): StoredJob => ({
  id, token: 'a'.repeat(64), idempotencyKey: `key-${id}`, configuration: configuration(rootSeed),
  graphHash: `sha256:${'b'.repeat(64)}`, createdAt: '2026-10-27T12:00:00.000Z',
})

test('credentials round-trip through the session storage', () => {
  const storage = memoryStorage()
  saveStoredJobs([stored('job-1')], storage)
  const read = readStoredJobs(storage)
  assert.equal(read.length, 1)
  assert.equal(read[0].id, 'job-1')
  assert.equal(read[0].token, 'a'.repeat(64))
  assert.equal(read[0].configuration.repetitions, 10)
  assert.ok(storage.getItem(JOB_STORAGE_KEY))
})

test('upsert puts the newest job first and keeps one entry per id', () => {
  const storage = memoryStorage()
  upsertStoredJob(stored('job-1'), storage)
  upsertStoredJob(stored('job-2'), storage)
  const next = upsertStoredJob(stored('job-1', 7), storage)
  assert.deepEqual(next.map(job => job.id), ['job-1', 'job-2'])
  assert.equal(next[0].configuration.rootSeed, 7)
  assert.equal(readStoredJobs(storage).length, 2)
})

test('corrupt or foreign entries are discarded instead of breaking the screen', () => {
  const storage = memoryStorage({
    [JOB_STORAGE_KEY]: JSON.stringify([
      stored('ok'),
      { ...stored('bad-token'), token: 'short' },
      { ...stored('bad-hash'), graphHash: 'sha256:zzzz' },
      { ...stored('bad-date'), createdAt: 'ayer' },
      { id: 'no-configuration' },
      'texto',
      null,
    ]),
  })
  assert.deepEqual(readStoredJobs(storage).map(job => job.id), ['ok'])
  assert.deepEqual(readStoredJobs(memoryStorage({ [JOB_STORAGE_KEY]: '{no-json' })), [])
  assert.deepEqual(readStoredJobs(memoryStorage({ [JOB_STORAGE_KEY]: '{"a":1}' })), [])
})

test('removing a job only drops that entry and missing storage is harmless', () => {
  const storage = memoryStorage()
  saveStoredJobs([stored('job-1'), stored('job-2')], storage)
  assert.deepEqual(removeStoredJob('job-1', storage).map(job => job.id), ['job-2'])
  assert.deepEqual(readStoredJobs(null), [])
  assert.doesNotThrow(() => saveStoredJobs([stored('job-3')], null))
})
