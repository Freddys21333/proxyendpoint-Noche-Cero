import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { PreviewResponse, ConfigResponse } from './api.ts'
import { createApiClient, createJobCredentials, toConfiguration } from './api.ts'
import { defaults } from './scenario.ts'

test('AWS result follows only a regional S3 link without forwarding the capability', async () => {
  const result = JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response-vaccines.json', import.meta.url), 'utf8'))
  const url = 'https://private-jobs.s3.us-east-2.amazonaws.com/jobs/test/result.json.gz?signature=test'
  const calls: string[] = []
  const api = createApiClient('/v1', async (target, init) => {
    calls.push(String(target))
    if (calls.length === 1) return Response.json({ schemaVersion: '1.0', engineVersion: '0.1.0', requestId: 'test', downloadUrl: url, expiresIn: 300 })
    assert.equal(String(target), url)
    assert.equal(new Headers(init?.headers).has('X-Job-Token'), false)
    assert.equal(init?.credentials, 'omit')
    return Response.json(result)
  })
  const received = await api.jobResult('job', 'a'.repeat(64), result.configuration, result.graphHash, undefined, result.representative.frames !== null)
  assert.equal(received.manifest.experimentHash, result.manifest.experimentHash)
  assert.equal(calls.length, 2)
  const unsafe = createApiClient('/v1', async () => Response.json({ schemaVersion: '1.0', engineVersion: '0.1.0', requestId: 'test', downloadUrl: 'https://other.example/result', expiresIn: 300 }))
  await assert.rejects(unsafe.jobResult('job', 'token', result.configuration, result.graphHash), /contrato/)
})

test('scenario maps to the shared backend request without mutating UI inputs', () => {
  const scenario = { ...defaults, origin: 'node', node: 9 }
  const result = toConfiguration(scenario)
  assert.equal(result.scenario.origin.value, 9)
  assert.equal(result.scenario.populationSize, scenario.population)
  assert.equal(result.intervention.vaccineEfficacy, scenario.efficacy)
  assert.equal(result.rootSeed, scenario.seed)
  assert.deepEqual(result.policies, ['none', 'random', 'targeted'])
  assert.equal(toConfiguration({ ...scenario, origin: 'market' }).scenario.origin.value, null)
  assert.equal(scenario.origin, 'node')
})

test('client uses the provided /v1 base once and submits actual configuration', async () => {
  const source = previewFixture()
  let body: unknown
  const client = createApiClient('http://127.0.0.1:8000/v1/', async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:8000/v1/scenarios/preview')
    body = JSON.parse(String(init?.body))
    return Response.json(source)
  })
  const request = structuredClone(source.configuration)
  delete request.network
  await client.preview(request)
  assert.deepEqual(body, { schemaVersion: '1.0', configuration: request })
})

test('HTTP validation errors keep sane field reasons and do not become a mock success', async () => {
  const fetcher: typeof fetch = async () => Response.json({ schemaVersion: '1.0', error: {
    code: 'VALIDATION_ERROR', message: 'Configuración inválida.', fields: [{ path: 'configuration.intervention.vaccines', reason: 'Fuera de rango.' }],
  } }, { status: 422 })
  await assert.rejects(createApiClient('/v1', fetcher).preview(toConfiguration(defaults)),
    (error: unknown) => error instanceof Error && error.message.includes('Configuración inválida'))
})

test('network failures and non-JSON responses are reported', async () => {
  const offline: typeof fetch = async () => { throw new TypeError('fetch failed') }
  await assert.rejects(createApiClient('/v1', offline).health(), /conectar/)
  const html: typeof fetch = async () => new Response('<html>offline</html>')
  await assert.rejects(createApiClient('/v1', html).health(), /respuesta/i)
})

test('an aborted request keeps its cancellation and forwards the signal', async () => {
  const controller = new AbortController()
  controller.abort()
  const fetcher: typeof fetch = async (_input, init) => {
    assert.equal(init?.signal, controller.signal)
    throw new DOMException('Aborted', 'AbortError')
  }
  await assert.rejects(createApiClient('/v1', fetcher).health(controller.signal), { name: 'AbortError' })
})

const previewFixture = (): PreviewResponse => JSON.parse(readFileSync(new URL('../../../schemas/examples/preview-response.json', import.meta.url), 'utf8'))
const configFixture = (): ConfigResponse => JSON.parse(readFileSync(new URL('../../../schemas/examples/config-response.json', import.meta.url), 'utf8'))

for (const defect of ['configuration', 'population', 'node', 'edge', 'schedule', 'position', 'missingPosition', 'initial', 'duplicateInitial', 'initialHash'] as const) {
  test(`preview rejects inconsistent ${defect}`, async () => {
    const source = previewFixture(), request = structuredClone(source.configuration)
    if (defect === 'configuration') request.scenario.populationSize++
    if (defect === 'population') source.graph.nodes.pop()
    if (defect === 'node') source.graph.nodes[1].id = source.graph.nodes[0].id
    if (defect === 'edge') source.graph.edges[0].v = 9999
    if (defect === 'schedule') source.graph.edges[0].activeDays = [-1]
    if (defect === 'position') source.positions[0].nodeId = 9999
    if (defect === 'missingPosition') source.positions.pop()
    if (defect === 'initial') source.initialInfectiousNodeIds = [9999]
    if (defect === 'duplicateInitial') source.initialInfectiousNodeIds.push(source.initialInfectiousNodeIds[0])
    if (defect === 'initialHash') source.initialStateHash = 'wrong'
    await assert.rejects(createApiClient('/v1', async () => Response.json(source)).preview(request), /contrato/i)
  })
}

test('valid config is accepted; missing, negative and inconsistent defaults/limits are rejected', async () => {
  const source = configFixture()
  await createApiClient('/v1', async () => Response.json(source)).config()
  for (const mutate of [
    (value: ConfigResponse) => { delete (value.limits as Partial<typeof value.limits>).maxEdges },
    (value: ConfigResponse) => { value.limits.maxFrameStates = -1 },
    (value: ConfigResponse) => { value.defaults.intervention.vaccines = value.defaults.scenario.populationSize + 1 },
  ]) {
    const invalid = structuredClone(source); mutate(invalid)
    await assert.rejects(createApiClient('/v1', async () => Response.json(invalid)).config(), /contrato/i)
  }
})

test('published request/preview limits are enforced without an invalid network success', async () => {
  const source = previewFixture(), limits = configFixture().limits
  let calls = 0
  const client = createApiClient('/v1', async () => { calls++; return Response.json(source) })
  await assert.rejects(client.preview(source.configuration, undefined, { ...limits, maxRequestBytes: 1 }), /tamaño/)
  assert.equal(calls, 0)
  source.graph.edges.push({ ...source.graph.edges[0], id: 1, v: 2 })
  await assert.rejects(client.preview(source.configuration, undefined, { ...limits, maxEdges: 1 }), /contrato/)
  await assert.rejects(client.preview(source.configuration, undefined, { ...limits, maxDecodedResponseBytes: 1 }), /tamaño/)
})

test('frame budget avoids requesting known oversized animation while retaining comparison', async () => {
  const source = JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response-no-frames.json', import.meta.url), 'utf8'))
  const limits = configFixture().limits
  let included: unknown
  await createApiClient('/v1', async (_url, init) => { included = JSON.parse(String(init?.body)).includeRepresentativeFrames; return Response.json(source) }).compareForPlayback(source.configuration, source.graphHash, undefined, { ...limits, maxFrameStates: 1 })
  assert.equal(included, false)
})

test('API client sends canonical resource deliveries without changing the caller', async () => {
  const source = previewFixture()
  source.configuration.intervention.vaccines = 1
  source.configuration.intervention.combined = { modelVersion: 'combined-educational-v1', budgetCents: 10000, vaccineCostCents: 1000, closureCostCents: 500, closureContext: 'school', closureStart: 0, closureDays: 0, brigadeCostCents: 100, brigadeDailyCapacity: 2, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 0,
    resourceSchedule: { modelVersion: 'daily-inventory-v1', vaccineDailyCapacity: 2, initialBrigadeSupplies: 0, deliveries: [{ day: 1, vaccines: 1, brigadeSupplies: 1 }, { day: 1, vaccines: 2, brigadeSupplies: 3 }] } }
  const request = structuredClone(source.configuration)
  const before = JSON.stringify(request)
  source.configuration.intervention.combined.resourceSchedule!.deliveries = [{ day: 1, vaccines: 3, brigadeSupplies: 4 }]
  const client = createApiClient('/v1', async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)).configuration.intervention.combined.resourceSchedule.deliveries, [{ day: 1, vaccines: 3, brigadeSupplies: 4 }])
    return Response.json(source)
  })
  await client.preview(request)
  assert.equal(JSON.stringify(request), before)
})


const jobFixture = () => JSON.parse(readFileSync(new URL('../../../schemas/examples/job-status-response.json', import.meta.url), 'utf8'))
test('job credentials use independent random tokens and idempotency keys', () => {
  const a = createJobCredentials(), b = createJobCredentials()
  assert.match(a.token, /^[0-9a-f]{64}$/)
  assert.notEqual(a.token, b.token)
  assert.notEqual(a.idempotencyKey, b.idempotencyKey)
})
test('job client sends credentials only in headers and forwards abort signals', async () => {
  const source = jobFixture(), credentials = createJobCredentials(), controller = new AbortController()
  const wire = JSON.parse(readFileSync(new URL('../../../schemas/examples/job-create-request.json', import.meta.url), 'utf8'))
  const client = createApiClient('/v1', async (url, init) => {
    assert.equal(String(url).includes(credentials.token), false)
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('X-Job-Token'), credentials.token)
    assert.equal(init?.signal, controller.signal)
    if (url === '/v1/jobs') {
      assert.equal(headers.get('Idempotency-Key'), credentials.idempotencyKey)
      assert.equal(String(init?.body).includes(credentials.token), false)
      assert.equal(JSON.parse(String(init?.body)).configuration.repetitions, 31)
    }
    return Response.json(source, { status: url === '/v1/jobs' ? 202 : 200 })
  })
  await client.createJob(wire.configuration, wire.expectedGraphHash, credentials, controller.signal)
  await client.jobStatus(source.jobId, credentials.token, controller.signal)
})
test('job client rejects impossible progress, incomplete completion and missing manifests', async () => {
  for (const mutate of [
    value => { value.progress.replicatesCompleted = 32 },
    value => { value.status = 'completed' },
    value => { value.manifest.replicates.pop() },
    value => { value.jobId = 'wrong' },
    value => { value.manifest.replicates[0].initialSeedEntropy[1] = 5 },
  ] as ((value: ReturnType<typeof jobFixture>) => void)[]) {
    const source = jobFixture(), id = source.jobId
    mutate(source)
    const client = createApiClient('/v1', async () => Response.json(source))
    await assert.rejects(client.jobStatus(id, 'a'.repeat(64)), /contrato/)
  }
})
test('cancelling through the client requires a terminal response', async () => {
  const source = jobFixture()
  const client = createApiClient('/v1', async () => Response.json(source, { status: 202 }))
  await assert.rejects(client.cancelJob(source.jobId, 'a'.repeat(64)), /contrato/)
  source.status = 'cancelled'
  assert.equal((await client.cancelJob(source.jobId, 'a'.repeat(64))).status, 'cancelled')
})
