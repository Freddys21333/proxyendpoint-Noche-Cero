import type { Scenario } from './scenario.ts'

export type ConfigurationInput = {
  rootSeed: number; networkMode: 'fixed'; repetitions: number;
  scenario: { populationSize: number; days: number; beta: number; sigma: number; gamma: number;
    initialInfectious: number; origin: { kind: string; value: number | null } };
  intervention: { vaccines: number; interventionDay: number; vaccineEfficacy: number };
  policies: ['none', 'random', 'targeted'];
}

type Metadata = { schemaVersion: '1.0'; engineVersion: string; requestId: string }
export type HealthResponse = Metadata & { status: 'ok'; region: string; buildCommit: string; generatedAt: string }
export type ConfigResponse = Metadata & { defaults: ConfigurationInput; limits: Record<string, number>; generatorDescription: string }
export type PreviewResponse = Metadata & {
  configuration: ConfigurationInput; graphHash: string; initialStateHash: string;
  graph: { generatorVersion: string; nodes: { id: number; role: string; householdId: string; neighborhoodId: string;
    schoolId: string | null; busId: string | null; marketId: string | null }[];
    edges: { id: number; u: number; v: number; context: string; weight: number; activeDays: number[] }[] };
  positions: { nodeId: number; x: number; y: number }[]; initialInfectiousNodeIds: number[];
}

export class ApiError extends Error {
  status: number
  code: string
  fields: { path: string; reason: string }[]
  constructor(status: number, code: string, message: string, fields: { path: string; reason: string }[] = []) {
    super(message)
    this.name = 'ApiError'; this.status = status; this.code = code; this.fields = fields
  }
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function createApiClient(baseUrl = '/v1', fetcher: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/+$/, '')
  async function request<T extends Metadata>(path: string, init: RequestInit, valid: (data: Record<string, unknown>) => boolean): Promise<T> {
    let response: Response
    try { response = await fetcher(`${base}${path}`, { ...init, credentials: 'omit', headers: { Accept: 'application/json', ...init.headers } }) }
    catch (error) {
      if (init.signal?.aborted) throw error
      throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor. Comprueba que esté iniciado.')
    }
    let data: unknown
    try { data = await response.json() }
    catch { throw new ApiError(response.status, 'INVALID_RESPONSE', 'El servidor devolvió una respuesta inválida.') }
    if (!response.ok) {
      const failure = object(data) && object(data.error) ? data.error : null
      const fields = failure && Array.isArray(failure.fields) ? failure.fields.filter((field): field is { path: string; reason: string } => object(field) && typeof field.path === 'string' && typeof field.reason === 'string') : []
      throw new ApiError(response.status, typeof failure?.code === 'string' ? failure.code : 'HTTP_ERROR',
        typeof failure?.message === 'string' ? failure.message : 'No se pudo completar la solicitud.', fields)
    }
    if (!object(data) || data.schemaVersion !== '1.0' || typeof data.engineVersion !== 'string' || typeof data.requestId !== 'string' || !valid(data)) {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'La respuesta no corresponde al contrato de la aplicación.')
    }
    return data as T
  }
  return {
    health: (signal?: AbortSignal) => request<HealthResponse>('/health', { signal }, data => data.status === 'ok' && typeof data.region === 'string' && typeof data.buildCommit === 'string'),
    config: (signal?: AbortSignal) => request<ConfigResponse>('/config', { signal }, data => object(data.defaults) && object(data.limits)),
    preview: (configuration: ConfigurationInput, signal?: AbortSignal) => request<PreviewResponse>('/scenarios/preview', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemaVersion: '1.0', configuration }),
    }, data => object(data.configuration) && object(data.graph) && Array.isArray(data.graph.nodes) && Array.isArray(data.graph.edges) && Array.isArray(data.positions) && Array.isArray(data.initialInfectiousNodeIds) && typeof data.graphHash === 'string' && /^sha256:[0-9a-f]{64}$/.test(data.graphHash)),
  }
}

export function toConfiguration(s: Scenario): ConfigurationInput {
  return { rootSeed: s.seed, networkMode: 'fixed', repetitions: s.repetitions,
    scenario: { populationSize: s.population, days: s.days, beta: s.beta, sigma: s.sigma, gamma: s.gamma,
      initialInfectious: s.initial, origin: { kind: s.origin, value: s.origin === 'node' ? s.node : null } },
    intervention: { vaccines: s.vaccines, interventionDay: s.interventionDay, vaccineEfficacy: s.efficacy },
    policies: ['none', 'random', 'targeted'] }
}
