/** Prueba AWS explícita: crea UN trabajo. No se ejecuta desde los tests/build. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createApiClient, createJobCredentials } from '../frontend/src/lib/api.ts'

const [base, count = '100', allowLarge] = process.argv.slice(2)
if (!/^https:\/\/[a-z0-9]+\.execute-api\.us-east-2\.amazonaws\.com\/v1$/.test(base ?? '')) throw Error('Indica la API de staging de Ohio.')
const repetitions = Number(count)
if (![100, 1000].includes(repetitions)) throw Error('La prueba admite 100 o 1000 réplicas.')
if (repetitions === 1000 && allowLarge !== '--allow-large') throw Error('Primero mide 100 réplicas. Para 1000 se requiere --allow-large y autorización de gasto.')
const api = createApiClient(base)
const config = await api.config()
assert.equal(config.features.jobBackend, 'aws')
assert.equal(config.features.asyncJobs, true)
const configuration = structuredClone(config.defaults)
Object.assign(configuration.scenario, { populationSize: 60, days: 7 })
Object.assign(configuration.intervention, { vaccines: 10 })
configuration.repetitions = 2
const preview = await api.preview(configuration, undefined, config.limits)
configuration.repetitions = repetitions
const credentials = createJobCredentials()
let job = await api.createJob(configuration, preview.graphHash, credentials, undefined, false, config.limits)
const started = performance.now()
try {
  const same = await api.createJob(configuration, preview.graphHash, credentials, undefined, false, config.limits)
  assert.equal(same.jobId, job.jobId)
  while (!['completed', 'failed', 'cancelled'].includes(job.status)) {
    if (performance.now() - started > 3_600_000) throw Error('Se alcanzó el tiempo de espera de la prueba.')
    await new Promise(resolve => setTimeout(resolve, 2000))
    job = await api.jobStatus(job.jobId, credentials.token)
    console.log(JSON.stringify({ jobId: job.jobId, status: job.status, progress: job.progress }))
  }
  assert.equal(job.status, 'completed')
  const result = await api.jobResult(job.jobId, credentials.token, configuration, preview.graphHash, undefined, false, config.limits)
  const output = `.tools/p04-aws-${Date.now()}`
  await mkdir(output, { recursive: true })
  await writeFile(`${output}/experiment.json`, JSON.stringify(result))
  await writeFile(`${output}/job.json`, JSON.stringify(job, null, 2))
  console.log(JSON.stringify({ output, seconds: (performance.now()-started)/1000, hash: result.manifest.experimentHash }))
} catch (error) {
  if (!['completed', 'failed', 'cancelled'].includes(job.status)) await api.cancelJob(job.jobId, credentials.token).catch(() => {})
  throw error
}
