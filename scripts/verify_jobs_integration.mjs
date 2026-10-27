/** P-03: real HTTP jobs consumed by the typed frontend client. No AWS calls. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createApiClient, createJobCredentials } from '../frontend/src/lib/api.ts'
import { experimentFiles } from '../frontend/src/lib/export-experiment.ts'

const api = createApiClient(process.env.API_BASE ?? 'http://127.0.0.1:18003/v1')
const published = await api.config()
assert.equal(published.features.asyncJobs, true)
assert.equal(published.jobLimits.maxRepetitions, 100)
const configuration = structuredClone(published.defaults)
Object.assign(configuration, { rootSeed: 314159265, repetitions: 2 })
Object.assign(configuration.scenario, { populationSize: 50, days: 2, beta: 0 })
Object.assign(configuration.intervention, { vaccines: 5 })
const preview = await api.preview(configuration)
const output = resolve('.tools', `jobs-validation-${new Date().toISOString().replaceAll(':', '-')}`)
await mkdir(output, { recursive: true })

for (const repetitions of [2, 31]) {
  const cfg = { ...configuration, repetitions }
  const credentials = createJobCredentials()
  const includeFrames = repetitions === 2
  const created = await api.createJob(cfg, preview.graphHash, credentials, undefined, includeFrames)
  const duplicate = await api.createJob(cfg, preview.graphHash, credentials, undefined, includeFrames)
  assert.equal(duplicate.jobId, created.jobId)
  await assert.rejects(api.jobStatus(created.jobId, '0'.repeat(64)), error => error.code === 'JOB_NOT_FOUND')
  let status = created
  const deadline = Date.now() + 30000
  while (!['completed', 'failed', 'cancelled'].includes(status.status) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 100))
    const next = await api.jobStatus(created.jobId, credentials.token)
    assert.ok(next.progress.replicatesCompleted >= status.progress.replicatesCompleted)
    status = next
  }
  assert.equal(status.status, 'completed', status.error)
  assert.equal(status.progress.replicatesCompleted, repetitions)
  const result = await api.jobResult(created.jobId, credentials.token, cfg, preview.graphHash, undefined, includeFrames)
  if (repetitions === 2) {
    const synchronous = await api.compare(cfg, preview.graphHash, undefined, includeFrames)
    assert.equal(result.manifest.experimentHash, synchronous.manifest.experimentHash)
  }
  assert.equal((await api.cancelJob(created.jobId, credentials.token)).status, 'completed')
  const files = experimentFiles(result)
  assert.ok(files['daily.csv'].includes('cumulativeInfected'))
  assert.equal(JSON.stringify(result).includes(credentials.token), false)
  await writeFile(resolve(output, `result-${repetitions}.json`), JSON.stringify(result))
  console.log(JSON.stringify({ repetitions, status: status.status, hash: result.manifest.experimentHash }))
}
console.log(`OUTPUT=${output}`)
