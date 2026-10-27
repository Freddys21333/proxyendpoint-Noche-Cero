import type { Scenario } from './scenario.ts'

export type ConfigurationInput = {
  rootSeed: number; networkMode: 'fixed'; repetitions: number;
  scenario: { populationSize: number; days: number; beta: number; sigma: number; gamma: number;
    initialInfectious: number; origin: { kind: string; value: number | null } };
  intervention: { vaccines: number; interventionDay: number; vaccineEfficacy: number };
  policies: ['none', 'random', 'targeted'];
}

type Metadata = { schemaVersion: '1.0'; engineVersion: string; requestId: string }
export type Policy = 'none' | 'random' | 'targeted'
export type CurveMetric = 's' | 'e' | 'i' | 'r' | 'cumulativeInfected'
export type Stats = { n: number; mean: number | null; median: number | null; p05: number | null; p95: number | null }
export type Metric = 'cumulativeInfected' | 'peakInfectious' | 'peakDay' | 'finalInfectious' | 'outbreakDuration' | 'vaccinesAssigned' | 'vaccinesEffective' | 'vaccinesUnused'
export type Comparison = { values: number[]; mean: number; median: number; p05: number; p95: number;
  bootstrap: { level: number; resamples: number; lower: number; upper: number } | null }
export type CompareResponse = Metadata & {
  configuration: ConfigurationInput; graphHash: string; graph: PreviewResponse['graph']; generatedAt: string;
  progress: { replicatesTotal: number; replicatesSucceeded: number; replicatesFailed: number };
  aggregatedCurves: Record<Policy, ({ day: number } & Record<CurveMetric, Stats>)[]>;
  summaryByPolicy: Record<Policy, Record<Metric, Stats>>;
  pairedComparisons: { savedVsNone: { random: Comparison; targeted: Comparison }; gainVsRandom: Comparison;
    targetedWinRateVsNone: number; targetedWinRateVsRandom: number };
  recommendation: { winner: Policy | 'tie'; confidence: 'descriptive' | 'supported' | 'inconclusive'; reasons: string[]; limitations: string[] };
  manifest: { experimentHash: string; engineVersion: string; schemaVersion: string; buildCommit: string; rootSeed: number; [key: string]: unknown };
  replicates: { index: number; policies: Record<Policy, { metrics: Record<Metric, number | null>; daily: unknown[]; selections: unknown[]; events: unknown[] | null; resultHash: string }> }[];
  representative: { index: number; frames: Record<Policy, string[][]> | null; [key: string]: unknown };
}
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
const policies: Policy[] = ['none', 'random', 'targeted']
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
function containsRequested(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((v, i) => containsRequested(actual[i], v))
  if (object(expected)) return object(actual) && Object.entries(expected).every(([key, value]) => containsRequested(actual[key], value))
  return actual === expected
}
function validStats(value: unknown, n: number, censored = false): boolean {
  if (!object(value) || !finite(value.n) || !Number.isInteger(value.n) || value.n < 0 || value.n > n || (!censored && value.n !== n)) return false
  const count = value.n
  return ['mean', 'median', 'p05', 'p95'].every(key => count === 0 ? value[key] === null : finite(value[key]))
}
function completeComparison(data: Record<string, unknown>, configuration: ConfigurationInput, graphHash: string): boolean {
  const n = configuration.repetitions, days = configuration.scenario.days + 1
  if (data.graphHash !== graphHash || !containsRequested(data.configuration, configuration) || !object(data.progress) || data.progress.replicatesTotal !== n || data.progress.replicatesSucceeded !== n || data.progress.replicatesFailed !== 0) return false
  if (!Array.isArray(data.replicates) || data.replicates.length !== n || !object(data.aggregatedCurves) || !object(data.summaryByPolicy)) return false
  if (!data.replicates.every((rep, i) => object(rep) && rep.index === i && object(rep.policies) && policies.every(p => object(rep.policies) && object(rep.policies[p]) && Array.isArray(rep.policies[p].daily) && rep.policies[p].daily.length === days))) return false
  for (const policy of policies) {
    const curves = data.aggregatedCurves[policy], summary = data.summaryByPolicy[policy]
    if (!Array.isArray(curves) || curves.length !== days || !object(summary)) return false
    if (!curves.every((row, day) => object(row) && row.day === day && ['s', 'e', 'i', 'r', 'cumulativeInfected'].every(key => validStats(row[key], n)))) return false
    if (!['cumulativeInfected', 'peakInfectious', 'peakDay', 'finalInfectious', 'outbreakDuration', 'vaccinesAssigned', 'vaccinesEffective', 'vaccinesUnused'].every(key => validStats(summary[key], n, key === 'outbreakDuration'))) return false
  }
  const paired = data.pairedComparisons, rec = data.recommendation
  if (!object(paired) || !object(paired.savedVsNone) || !object(rec) || ![...policies, 'tie'].includes(String(rec.winner)) || !['descriptive', 'supported', 'inconclusive'].includes(String(rec.confidence)) || !Array.isArray(rec.reasons) || !rec.reasons.every(v => typeof v === 'string') || !Array.isArray(rec.limitations) || !rec.limitations.every(v => typeof v === 'string')) return false
  if (!['targetedWinRateVsNone', 'targetedWinRateVsRandom'].every(key => finite(paired[key]) && paired[key] >= 0 && paired[key] <= 1) || (n < 30 && rec.confidence !== 'descriptive')) return false
  const comparisons = [paired.savedVsNone.random, paired.savedVsNone.targeted, paired.gainVsRandom]
  if (!comparisons.every(c => object(c) && Array.isArray(c.values) && c.values.length === n && c.values.every(finite) && ['mean', 'median', 'p05', 'p95'].every(k => finite(c[k])) && (n < 30 ? c.bootstrap === null : object(c.bootstrap) && c.bootstrap.level === 0.95 && c.bootstrap.resamples === 2000 && finite(c.bootstrap.lower) && finite(c.bootstrap.upper) && c.bootstrap.lower <= c.bootstrap.upper))) return false
  return object(data.manifest) && typeof data.manifest.experimentHash === 'string' && /^sha256:[0-9a-f]{64}$/.test(data.manifest.experimentHash) && data.manifest.engineVersion === data.engineVersion && data.manifest.schemaVersion === data.schemaVersion && data.manifest.rootSeed === configuration.rootSeed && typeof data.manifest.buildCommit === 'string' && object(data.representative) && finite(data.representative.index) && Number.isInteger(data.representative.index) && data.representative.index >= 0 && data.representative.index < n && data.representative.frames === null
}

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
    compare: (configuration: ConfigurationInput, graphHash: string, signal?: AbortSignal) => request<CompareResponse>('/simulations/compare', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemaVersion: '1.0', configuration, expectedGraphHash: graphHash, includeRepresentativeFrames: false }),
    }, data => completeComparison(data, configuration, graphHash)),
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
