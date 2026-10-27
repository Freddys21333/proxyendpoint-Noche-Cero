import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiClient, toConfiguration } from './api.ts'
import { defaults } from './scenario.ts'

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
  const calls: { url: string, body: string | null }[] = []
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), body: typeof init?.body === 'string' ? init.body : null })
    return Response.json({ schemaVersion: '1.0', engineVersion: '0.1.0', requestId: 'test',
      configuration: toConfiguration(defaults), graphHash: `sha256:${'a'.repeat(64)}`,
      graph: { generatorVersion: 'synthetic-manta-v1', nodes: [], edges: [] }, positions: [], initialInfectiousNodeIds: [], initialStateHash: `sha256:${'b'.repeat(64)}` })
  }
  await createApiClient('http://127.0.0.1:8000/v1/', fetcher).preview(toConfiguration(defaults))
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/v1/scenarios/preview')
  assert.deepEqual(JSON.parse(calls[0].body!), { schemaVersion: '1.0', configuration: toConfiguration(defaults) })
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
