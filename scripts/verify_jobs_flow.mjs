/** P-03: flujo real de trabajos locales (crear, sondear, cancelar, resultado, idempotencia y token). */
import assert from 'node:assert/strict'
import { createApiClient, createJobCredentials } from '../frontend/src/lib/api.ts'
import { statusFromApi } from '../frontend/src/pro/jobs-model.ts'

const api = createApiClient(process.env.API_BASE ?? 'http://127.0.0.1:8000/v1')
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

async function waitForTerminal(jobId, token, timeoutMs = 180000) {
  const started = Date.now()
  const seen = []
  while (Date.now() - started < timeoutMs) {
    const response = await api.jobStatus(jobId, token)
    if (seen.at(-1) !== response.status) seen.push(response.status)
    if (['completed', 'failed', 'cancelled'].includes(response.status)) return { response, seen }
    await sleep(400)
  }
  throw new Error(`El trabajo ${jobId} no terminó en ${timeoutMs} ms; estados vistos: ${seen.join(', ')}`)
}

const config = await api.config()
assert.equal(config.features.asyncJobs, true, 'La API debe anunciar features.asyncJobs=true')
assert.ok(config.jobLimits && config.jobLimits.maxRepetitions >= 2, 'La API debe publicar jobLimits')
assert.equal(config.jobLimits.maxConcurrent >= 1, true)
assert.equal(config.jobLimits.maxRetained >= 1, true)

const configuration = {
  rootSeed: 424242, networkMode: 'fixed', repetitions: 3,
  scenario: { populationSize: 60, days: 4, beta: 0.09, sigma: 0.2, gamma: 0.2, initialInfectious: 1, origin: { kind: 'random', value: null } },
  policies: ['none', 'random', 'targeted'],
  intervention: { vaccines: 6, interventionDay: 0, vaccineEfficacy: 0.8 },
}
// La vista previa usa el contrato síncrono (máx. 30 réplicas); el trabajo puede subir hasta 100.
const previewConfiguration = { ...configuration, repetitions: 3 }
const preview = await api.preview(previewConfiguration)
const credentials = createJobCredentials()
const created = await api.createJob(configuration, preview.graphHash, credentials)

assert.equal(created.progress.replicatesTotal, 3)
// El trabajador puede tomar el trabajo antes de que llegue la respuesta de creación.
assert.ok(['PENDING', 'RUNNING'].includes(statusFromApi(created.status)), `Estado inicial inesperado: ${created.status}`)
assert.equal(created.statusUrl, `/v1/jobs/${created.jobId}`)

// La misma capacidad + clave de idempotencia devuelve el mismo trabajo, sin duplicar réplicas.
const replayed = await api.createJob(configuration, preview.graphHash, credentials)
assert.equal(replayed.jobId, created.jobId, 'La repetición idempotente debe devolver el mismo jobId')
assert.equal((await api.jobStatus(created.jobId, credentials.token)).progress.replicatesTotal, 3)

// Una clave ya usada con otra solicitud se rechaza en lugar de reutilizar el trabajo.
await assert.rejects(
  api.createJob({ ...configuration, rootSeed: configuration.rootSeed + 1 }, preview.graphHash, credentials),
  error => error.code === 'IDEMPOTENCY_CONFLICT' && error.status === 409,
)

const completed = await waitForTerminal(created.jobId, credentials.token)
assert.equal(completed.response.status, 'completed', `Estado final inesperado: ${completed.response.status}`)
assert.equal(completed.response.progress.replicatesCompleted, 3)
assert.equal(completed.response.progress.replicatesFailed, 0)
assert.equal(completed.response.manifest.graphHash, preview.graphHash)
assert.equal(completed.response.manifest.rootSeed, 424242)
assert.equal(completed.response.manifest.replicates.length, 3)

const result = await api.jobResult(created.jobId, credentials.token, configuration, preview.graphHash)
assert.equal(result.configuration.repetitions, 3)
assert.equal(result.replicates.length, 3)
assert.deepEqual([...new Set(result.replicates.map(replica => replica.index))], [0, 1, 2])

// El agregado del trabajo debe coincidir con la ejecución secuencial equivalente.
const sequential = await api.compare(configuration, preview.graphHash)
assert.equal(result.manifest.experimentHash, sequential.manifest.experimentHash, 'El hash del trabajo debe igualar al compare síncrono')

// Un token desconocido no revela el trabajo.
await assert.rejects(
  api.jobStatus(created.jobId, 'f'.repeat(64)),
  error => error.code === 'JOB_NOT_FOUND' && error.status === 404,
)

// Un trabajo en curso no entrega resultado parcial y la cancelación es terminal.
const longConfiguration = { ...configuration, repetitions: 100, scenario: { ...configuration.scenario, populationSize: 120, days: 12 } }
const longPreview = await api.preview({ ...longConfiguration, repetitions: 3 })
const longCredentials = createJobCredentials()
const longJob = await api.createJob(longConfiguration, longPreview.graphHash, longCredentials)
await assert.rejects(
  api.jobResult(longJob.jobId, longCredentials.token, longConfiguration, longPreview.graphHash),
  error => error.code === 'JOB_NOT_READY' && error.status === 409,
)
const cancelled = await api.cancelJob(longJob.jobId, longCredentials.token)
assert.equal(cancelled.status, 'cancelled')
await assert.rejects(
  api.jobResult(longJob.jobId, longCredentials.token, longConfiguration, longPreview.graphHash),
  error => error.code === 'JOB_NOT_READY' && error.status === 409,
)

console.log(JSON.stringify({
  status: 'passed',
  jobId: created.jobId,
  states: completed.seen,
  replicates: created.progress.replicatesTotal,
  experimentHash: result.manifest.experimentHash,
  sequentialHashMatches: true,
  cancelledJobId: longJob.jobId,
  idempotency: 'replayed-and-conflicted',
  token: 'unknown-token-404',
  partialResult: 'blocked-409',
}))
