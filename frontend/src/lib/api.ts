import { fromConfiguration, validateScenario, type Scenario } from './scenario.ts'
import { normalizedCombinedPlan } from './resource-schedule.ts'
import { validDecisionSummary } from './decision-summary.ts'

export type ResourceSchedule = { modelVersion: 'daily-inventory-v1'; vaccineDailyCapacity: number; initialBrigadeSupplies: number;
  deliveries: { day: number; vaccines: number; brigadeSupplies: number }[] }
export type InventoryDaily = { vaccinesDeliveredToday: number; vaccinesReceivedTotal: number; vaccinesUsedToday: number; vaccinesAvailable: number;
  brigadeSuppliesDeliveredToday: number; brigadeSuppliesReceivedTotal: number; brigadeSuppliesUsedToday: number; brigadeSuppliesAvailable: number }

export type AdaptiveStrategy = { modelVersion: 'adaptive-policy-v1'; closureInfectionThreshold: number; reopenInfectionThreshold: number; ringVaccinationPriority: boolean; enabled?: boolean }
export type AdaptiveDecisions = { enabled: boolean; triggers: string[]; infectiousFraction: number; closureActive: boolean | null; brigadesAllowed: boolean; ringVaccinationActive: boolean }
export type DailyRow = {
  day: number; s: number; e: number; i: number; r: number; cumulativeInfected: number;
  budgetRemainingCents?: number; spentCents?: number; spentTodayCents?: number;
  closedContext?: string | null; brigadesActive?: number; brigadeNodeIds?: number[];
  vaccinesDeliveredToday?: number; vaccinesReceivedTotal?: number; vaccinesUsedToday?: number; vaccinesAvailable?: number;
  brigadeSuppliesDeliveredToday?: number; brigadeSuppliesReceivedTotal?: number; brigadeSuppliesUsedToday?: number; brigadeSuppliesAvailable?: number;
  adaptiveDecisions?: AdaptiveDecisions;
}
export type CombinedPlan = {
  modelVersion: 'combined-educational-v1'; budgetCents: number; vaccineCostCents: number;
  closureCostCents: number; closureContext: 'household' | 'school' | 'bus' | 'market' | 'neighborhood';
  closureStart: number; closureDays: number; brigadeCostCents: number;
  brigadeDailyCapacity: number; brigadeReduction: number; brigadeStart: number; brigadeDays: number;
  resourceSchedule?: ResourceSchedule;
  adaptiveStrategy?: AdaptiveStrategy;
}
export type CombinedDaily = { day: number; budgetRemainingCents: number; spentCents: number; spentTodayCents: number; closedContext: string | null; brigadesActive: number; brigadeNodeIds: number[] }

export type ConfigurationInput = {
  rootSeed: number; networkMode: 'fixed'; repetitions: number;
  scenario: { populationSize: number; days: number; beta: number; sigma: number; gamma: number;
    initialInfectious: number; origin: { kind: string; value: number | null } };
  intervention: { vaccines: number; interventionDay: number; vaccineEfficacy: number; combined?: CombinedPlan };
  policies: ['none', 'random', 'targeted'];
  network?: { generatorVersion: 'synthetic-manta-v1'; dayZero: 'monday'; weights: Record<'household' | 'school' | 'bus' | 'market' | 'neighborhood', number> };
}

type Metadata = { schemaVersion: '1.0'; engineVersion: string; requestId: string }
export type PersonState = 'S' | 'E' | 'I' | 'R'
export type VaccinationSelection = { day: number; nodeId: number; score: number | null; infectiousContacts?: number; rank: number; stateAtDecision: 'S'; contexts: string[]; tieBreak: 'nodeIdAsc' | 'seededRandom' | 'ringContact'; effective: boolean }
export type Policy = 'none' | 'random' | 'targeted'
export type CurveMetric = 's' | 'e' | 'i' | 'r' | 'cumulativeInfected'
export type Stats = { n: number; mean: number | null; median: number | null; p05: number | null; p95: number | null }
export type Metric = 'cumulativeInfected' | 'peakInfectious' | 'peakDay' | 'finalInfectious' | 'outbreakDuration' | 'vaccinesAssigned' | 'vaccinesEffective' | 'vaccinesUnused'
export type Comparison = { values: number[]; mean: number; median: number; p05: number; p95: number;
  bootstrap: { level: number; resamples: number; lower: number; upper: number } | null }
export type CompareResponse = Metadata & {
  decisionSummary?: import('./decision-summary.ts').DecisionSummary;
  configuration: ConfigurationInput; graphHash: string; graph: PreviewResponse['graph']; generatedAt: string;
  progress: { replicatesTotal: number; replicatesSucceeded: number; replicatesFailed: number };
  aggregatedCurves: Record<Policy, ({ day: number } & Record<CurveMetric, Stats>)[]>;
  summaryByPolicy: Record<Policy, Record<Metric, Stats>>;
  pairedComparisons: { savedVsNone: { random: Comparison; targeted: Comparison }; gainVsRandom: Comparison;
    targetedWinRateVsNone: number; targetedWinRateVsRandom: number };
  recommendation: { winner: Policy | 'tie'; confidence: 'descriptive' | 'supported' | 'inconclusive'; reasons: string[]; limitations: string[] };
  manifest: { experimentHash: string; engineVersion: string; schemaVersion: string; buildCommit: string; rootSeed: number; [key: string]: unknown };
  replicates: { index: number; policies: Record<Policy, { metrics: Record<Metric, number | null>; daily: DailyRow[]; selections: VaccinationSelection[]; events: unknown[] | null; resultHash: string }> }[];
  representative: { index: number; frames: Record<Policy, PersonState[][]> | null; [key: string]: unknown };
}
export type HealthResponse = Metadata & { status: 'ok'; region: string; buildCommit: string; generatedAt: string }
export type ServerLimits = Record<'maxRequestBytes' | 'maxResponseBytes' | 'maxDecodedResponseBytes' | 'maxEdges' | 'maxFrameStates', number>
export type JobLimits = Record<'maxRepetitions' | 'maxConcurrent' | 'maxRetained' | 'retentionSeconds' | 'maxEdgeDayReplicates', number>
export type ConfigResponse = Metadata & { defaults: ConfigurationInput; limits: ServerLimits; generatorDescription: string; features: { asyncJobs: boolean; representativeFrames: boolean; jobBackend?: 'local' | 'aws' }; jobLimits?: JobLimits }
export type JobCredentials = { token: string; idempotencyKey: string }
export type JobResponse = Metadata & { jobId: string; status: 'pending' | 'running' | 'aggregating' | 'completed' | 'failed' | 'cancelled'; createdAt: string; updatedAt: string; statusUrl: string; resultUrl: string;
  progress: { replicatesTotal: number; replicatesCompleted: number; replicatesFailed: number }; error?: 'SIMULATION_FAILED' | 'RESULT_TOO_LARGE';
  manifest: { modelVersion: 'local-jobs-v1' | 'aws-jobs-v1'; configurationHash: string; graphHash: string; requestHash: string; rootSeed: number; engineVersion: string; rngVersion: 'rng-v1'; runtimeVersions: Record<string, unknown>; replicates: { index: number; initialSeedEntropy: number[] }[] } }
export function createJobCredentials(): JobCredentials {
  return { token: Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join(''), idempotencyKey: crypto.randomUUID() }
}
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
  retryAfterSeconds: number | null
  constructor(status: number, code: string, message: string, fields: { path: string; reason: string }[] = [], retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'ApiError'; this.status = status; this.code = code; this.fields = fields; this.retryAfterSeconds = retryAfterSeconds
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
const contexts = ['household', 'school', 'bus', 'market', 'neighborhood']
const hash = (value: unknown) => typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value)
const integerIn = (value: unknown, low: number, high: number) => finite(value) && Number.isInteger(value) && value >= low && value <= high
function validConfiguration(value: unknown): value is ConfigurationInput {
  if (!object(value) || !object(value.scenario) || !object(value.scenario.origin) || !object(value.intervention) || value.networkMode !== 'fixed' || !containsRequested(value.policies, policies)) return false
  const origin = value.scenario.origin
  if (origin.kind !== 'node' && origin.value !== null) return false
  if (validateScenario(fromConfiguration(value as unknown as ConfigurationInput)).length) return false
  const network = value.network
  return object(network) && network.generatorVersion === 'synthetic-manta-v1' && network.dayZero === 'monday' && object(network.weights) && contexts.every(key => object(network.weights) && finite(network.weights[key]) && network.weights[key] >= 0 && network.weights[key] <= 1)
}
function validConfig(data: Record<string, unknown>): boolean {
  return object(data.features) && typeof data.features.asyncJobs === 'boolean' && data.features.representativeFrames === true && (!data.features.asyncJobs || object(data.jobLimits) && ['maxRepetitions', 'maxConcurrent', 'maxRetained', 'retentionSeconds', 'maxEdgeDayReplicates'].every(key => object(data.jobLimits) && integerIn(data.jobLimits[key], 1, Number.MAX_SAFE_INTEGER))) && validConfiguration(data.defaults) && object(data.limits) && ['maxRequestBytes', 'maxResponseBytes', 'maxDecodedResponseBytes', 'maxEdges', 'maxFrameStates'].every(key => object(data.limits) && integerIn(data.limits[key], 1, Number.MAX_SAFE_INTEGER)) && typeof data.generatorDescription === 'string'
}
function validJob(data: Record<string, unknown>): boolean {
  if (typeof data.jobId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(data.jobId) || !['pending', 'running', 'aggregating', 'completed', 'failed', 'cancelled'].includes(String(data.status)) || !['createdAt', 'updatedAt'].every(k => typeof data[k] === 'string' && Number.isFinite(Date.parse(data[k] as string))) || data.statusUrl !== `/v1/jobs/${data.jobId}` || data.resultUrl !== `/v1/jobs/${data.jobId}/result` || data.result !== undefined) return false
  const p = data.progress, m = data.manifest
  if (!object(p) || !integerIn(p.replicatesTotal, 2, 1000) || !integerIn(p.replicatesCompleted, 0, Number(p.replicatesTotal)) || !integerIn(p.replicatesFailed, 0, 1) || Number(p.replicatesCompleted) + Number(p.replicatesFailed) > Number(p.replicatesTotal)) return false
  if (data.status === 'completed' && (p.replicatesCompleted !== p.replicatesTotal || p.replicatesFailed !== 0)) return false
  if (data.status === 'failed' ? !['SIMULATION_FAILED', 'RESULT_TOO_LARGE'].includes(String(data.error)) : data.error !== undefined) return false
  return object(m) && ['local-jobs-v1', 'aws-jobs-v1'].includes(String(m.modelVersion)) && hash(m.configurationHash) && hash(m.graphHash) && hash(m.requestHash) && integerIn(m.rootSeed, 0, 4294967295) && m.engineVersion === data.engineVersion && m.rngVersion === 'rng-v1' && object(m.runtimeVersions) && m.runtimeVersions.engineVersion === data.engineVersion && m.runtimeVersions.rngVersion === m.rngVersion && Array.isArray(m.replicates) && m.replicates.length === p.replicatesTotal && m.replicates.every((r, i) => object(r) && r.index === i && Array.isArray(r.initialSeedEntropy) && r.initialSeedEntropy.length === 10 && r.initialSeedEntropy[0] === m.rootSeed && r.initialSeedEntropy[1] === i && r.initialSeedEntropy.every(n => integerIn(n, 0, 4294967295)))
}

function validPreview(data: Record<string, unknown>, requested: ConfigurationInput, limits?: ServerLimits): boolean {
  if (!validConfiguration(data.configuration) || !containsRequested(data.configuration, requested) || !hash(data.graphHash) || !hash(data.initialStateHash) || !object(data.graph)) return false
  const { nodes, edges } = data.graph, positions = data.positions, initial = data.initialInfectiousNodeIds
  const n = requested.scenario.populationSize, days = requested.scenario.days
  if (data.graph.generatorVersion !== data.configuration.network!.generatorVersion || !Array.isArray(nodes) || nodes.length !== n || !Array.isArray(edges) || edges.length > (limits?.maxEdges ?? 100000)) return false
  if (!nodes.every((node, id) => object(node) && node.id === id && ['student', 'worker', 'community'].includes(String(node.role)) && ['householdId', 'neighborhoodId'].every(key => typeof node[key] === 'string' && node[key].length > 0) && ['schoolId', 'busId', 'marketId'].every(key => node[key] === null || typeof node[key] === 'string' && node[key].length > 0))) return false
  const edgeKeys = new Set<string>()
  if (!edges.every((edge, id) => {
    if (!object(edge) || edge.id !== id || !integerIn(edge.u, 0, n - 1) || !integerIn(edge.v, Number(edge.u) + 1, n - 1) || !contexts.includes(String(edge.context)) || !finite(edge.weight) || edge.weight < 0 || edge.weight > 1 || !Array.isArray(edge.activeDays) || !edge.activeDays.length || !edge.activeDays.every((day, index, all) => integerIn(day, 0, days) && (index === 0 || day > all[index - 1]))) return false
    const key = `${edge.u}:${edge.v}:${edge.context}`
    if (edgeKeys.has(key)) return false
    edgeKeys.add(key); return true
  })) return false
  return Array.isArray(positions) && positions.length === n && new Set(positions.map(p => object(p) ? p.nodeId : null)).size === n && positions.every(p => object(p) && integerIn(p.nodeId, 0, n - 1) && finite(p.x) && finite(p.y)) && Array.isArray(initial) && initial.length === requested.scenario.initialInfectious && new Set(initial).size === initial.length && initial.every(id => integerIn(id, 0, n - 1)) && (requested.scenario.origin.kind !== 'node' || initial.includes(requested.scenario.origin.value))
}

function validStats(value: unknown, n: number, censored = false): boolean {
  if (!object(value) || !finite(value.n) || !Number.isInteger(value.n) || value.n < 0 || value.n > n || (!censored && value.n !== n)) return false
  const count = value.n
  return ['mean', 'median', 'p05', 'p95'].every(key => count === 0 ? value[key] === null : finite(value[key]))
}
function completeComparison(data: Record<string, unknown>, configuration: ConfigurationInput, graphHash: string, includeFrames: boolean): boolean {
  if (data.decisionSummary !== undefined && !validDecisionSummary(data.decisionSummary)) return false
  const n = configuration.repetitions, days = configuration.scenario.days + 1
  if (data.graphHash !== graphHash || !containsRequested(data.configuration, configuration) || !object(data.progress) || data.progress.replicatesTotal !== n || data.progress.replicatesSucceeded !== n || data.progress.replicatesFailed !== 0) return false
  if (!Array.isArray(data.replicates) || data.replicates.length !== n || !object(data.aggregatedCurves) || !object(data.summaryByPolicy)) return false
  if (!data.replicates.every((rep, i) => object(rep) && rep.index === i && object(rep.policies) && policies.every(p => object(rep.policies) && object(rep.policies[p]) && Array.isArray(rep.policies[p].daily) && rep.policies[p].daily.length === days && validSelections(rep.policies[p], p, configuration)))) return false
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
  if (validDecisionSummary(data.decisionSummary)) {
    const summary = data.decisionSummary
    if (summary.confidence !== rec.confidence || (rec.winner === 'tie' ? summary.bestPolicies.length < 2 : summary.bestPolicies.length !== 1 || summary.bestPolicies[0] !== rec.winner)) return false
    if (policies.some(policy => summary.policies[policy].budgetCents !== (configuration.intervention.combined?.budgetCents ?? null) || summary.policies[policy].vaccinesReceived > configuration.scenario.populationSize)) return false
  }
  if (!comparisons.every(c => object(c) && Array.isArray(c.values) && c.values.length === n && c.values.every(finite) && ['mean', 'median', 'p05', 'p95'].every(k => finite(c[k])) && (n < 30 ? c.bootstrap === null : object(c.bootstrap) && c.bootstrap.level === 0.95 && c.bootstrap.resamples === 2000 && finite(c.bootstrap.lower) && finite(c.bootstrap.upper) && c.bootstrap.lower <= c.bootstrap.upper))) return false
  return object(data.manifest) && typeof data.manifest.experimentHash === 'string' && /^sha256:[0-9a-f]{64}$/.test(data.manifest.experimentHash) && data.manifest.engineVersion === data.engineVersion && data.manifest.schemaVersion === data.schemaVersion && data.manifest.rootSeed === configuration.rootSeed && typeof data.manifest.buildCommit === 'string' && object(data.representative) && finite(data.representative.index) && Number.isInteger(data.representative.index) && data.representative.index >= 0 && data.representative.index < n && (includeFrames ? validFrames(data, configuration) : data.representative.frames === null)
}

function validSelections(result: Record<string, unknown>, policy: Policy, configuration: ConfigurationInput): boolean {
  const rows = result.selections, metrics = result.metrics
  const { interventionDay } = configuration.intervention
  const schedule = configuration.intervention.combined?.resourceSchedule
  const vaccines = configuration.intervention.vaccines + (schedule?.deliveries.reduce((total, row) => total + row.vaccines, 0) ?? 0)
  if (!Array.isArray(rows) || !object(metrics) || rows.length > vaccines || (policy === 'none' && rows.length !== 0)) return false
  const plan = configuration.intervention.combined
  if (plan) {
    if (!Array.isArray(result.daily)) return false
    let previous = 0, usedVaccines = 0, usedSupplies = 0
    for (const [day, row] of result.daily.entries()) {
      if (!object(row) || row.day !== day || !integerIn(row.spentCents, 0, plan.budgetCents) || !integerIn(row.budgetRemainingCents, 0, plan.budgetCents) || !Array.isArray(row.brigadeNodeIds) || new Set(row.brigadeNodeIds).size !== row.brigadeNodeIds.length || !row.brigadeNodeIds.every(id => integerIn(id, 0, configuration.scenario.populationSize - 1)) || row.brigadesActive !== row.brigadeNodeIds.length || row.brigadeNodeIds.length > plan.brigadeDailyCapacity) return false
      const cost = rows.filter(selection => object(selection) && selection.day === day).length * plan.vaccineCostCents + row.brigadeNodeIds.length * plan.brigadeCostCents + (row.closedContext === null ? 0 : plan.closureCostCents)
      if (row.spentTodayCents !== cost || row.spentCents !== previous + cost || row.budgetRemainingCents !== plan.budgetCents - row.spentCents || policy === 'none' && cost !== 0) return false
      if (row.closedContext !== null && (row.closedContext !== plan.closureContext || (!(plan.adaptiveStrategy && plan.adaptiveStrategy.enabled !== false && policy === 'targeted') && (day < plan.closureStart || day >= plan.closureStart + plan.closureDays)) || day >= configuration.scenario.days)) return false
      if (row.brigadeNodeIds.length && (day < plan.brigadeStart || day >= plan.brigadeStart + plan.brigadeDays || day >= configuration.scenario.days)) return false
      const adaptive = plan.adaptiveStrategy
      if (adaptive) {
        const d = row.adaptiveDecisions, enabled = policy === 'targeted' && adaptive.enabled !== false
        if (!object(d) || d.enabled !== enabled || !finite(d.infectiousFraction) || !finite(row.i) || d.infectiousFraction !== row.i / configuration.scenario.populationSize || d.closureActive !== (enabled ? row.closedContext !== null : null) || d.brigadesAllowed !== (!enabled || row.i > 0) || d.ringVaccinationActive !== (enabled && adaptive.ringVaccinationPriority && row.i > 0) || !Array.isArray(d.triggers) || !d.triggers.every(r => typeof r === 'string' && ['closure_triggered_by_threshold', 'closure_budget_exhausted', 'reopen_triggered_by_threshold', 'no_infectious_hold_brigades', 'ring_vaccination_active', 'closure_no_active_contacts', 'vaccine_stock_empty', 'vaccine_capacity_zero', 'vaccine_budget_exhausted', 'vaccine_no_eligible', 'brigade_capacity_zero', 'brigade_stock_empty', 'brigade_budget_exhausted', 'brigade_no_eligible'].includes(r)) || new Set(d.triggers).size !== d.triggers.length || (!enabled && d.triggers.length)) return false
      } else if (row.adaptiveDecisions !== undefined) return false
      previous = row.spentCents
      if (schedule) {
        const delivered = schedule.deliveries.filter(r => r.day === day), received = schedule.deliveries.filter(r => r.day <= day)
        const count = rows.filter(selection => object(selection) && selection.day === day).length
        usedVaccines += count; usedSupplies += row.brigadeNodeIds.length
        const receivedVaccines = configuration.intervention.vaccines + received.reduce((n, r) => n + r.vaccines, 0)
        const receivedSupplies = schedule.initialBrigadeSupplies + received.reduce((n, r) => n + r.brigadeSupplies, 0)
        const expected = { vaccinesDeliveredToday: delivered.reduce((n,r) => n+r.vaccines,0), vaccinesReceivedTotal: receivedVaccines, vaccinesUsedToday: count, vaccinesAvailable: receivedVaccines-usedVaccines,
          brigadeSuppliesDeliveredToday: delivered.reduce((n,r) => n+r.brigadeSupplies,0), brigadeSuppliesReceivedTotal: receivedSupplies, brigadeSuppliesUsedToday: row.brigadeNodeIds.length, brigadeSuppliesAvailable: receivedSupplies-usedSupplies }
        if (count > schedule.vaccineDailyCapacity || Object.entries(expected).some(([key,value]) => value < 0 || !integerIn(row[key],value,value))) return false
      }
    }
  }
  if (!rows.every(row => object(row) && Number.isInteger(row.nodeId) && Number(row.nodeId) >= 0 && Number(row.nodeId) < configuration.scenario.populationSize && (schedule ? integerIn(row.day, interventionDay, configuration.scenario.days) : row.day === interventionDay) && (row.infectiousContacts === undefined || integerIn(row.infectiousContacts, 0, 100000)) && row.stateAtDecision === 'S' && typeof row.effective === 'boolean' && Number.isInteger(row.rank) && Number(row.rank) >= 1 && Number(row.rank) <= rows.length && Array.isArray(row.contexts) && new Set(row.contexts).size === row.contexts.length && row.contexts.every(context => ['household', 'school', 'bus', 'market', 'neighborhood'].includes(String(context))) && (policy === 'targeted' ? finite(row.score) && row.score >= 0 && (row.tieBreak === 'nodeIdAsc' || row.tieBreak === 'ringContact' && integerIn(row.infectiousContacts, 1, 100000) && !!plan?.adaptiveStrategy?.ringVaccinationPriority && plan.adaptiveStrategy.enabled !== false) : row.score === null && row.tieBreak === 'seededRandom'))) return false
  return new Set(rows.map(row => row.nodeId)).size === rows.length && new Set(rows.map(row => row.rank)).size === rows.length && metrics.vaccinesAssigned === rows.length && metrics.vaccinesEffective === rows.filter(row => row.effective).length && metrics.vaccinesUnused === vaccines - rows.length
}

function validFrames(data: Record<string, unknown>, configuration: ConfigurationInput): boolean {
  if (!object(data.representative) || !object(data.representative.frames) || !object(data.graph) || !Array.isArray(data.graph.nodes) || data.graph.nodes.length !== configuration.scenario.populationSize || !Array.isArray(data.replicates)) return false
  const frames = data.representative.frames
  const rep = data.replicates[Number(data.representative.index)]
  if (!object(rep) || !object(rep.policies)) return false
  const results = rep.policies
  // Frame position is nodeId; reject a graph that would mislabel people.
  if (!data.graph.nodes.every((node, id) => object(node) && node.id === id)) return false
  return policies.every(policy => {
    const series = frames[policy], result = results[policy]
    if (!Array.isArray(series) || series.length !== configuration.scenario.days + 1 || !object(result) || !Array.isArray(result.daily)) return false
    const daily = result.daily
    return series.every((frame, day) => {
      if (!Array.isArray(frame) || frame.length !== configuration.scenario.populationSize || !frame.every(state => ['S', 'E', 'I', 'R'].includes(state))) return false
      const row = daily[day]
      return object(row) && row.day === day && ['S', 'E', 'I', 'R'].every(state => row[state.toLowerCase()] === frame.filter(value => value === state).length)
    })
  })
}

export function createApiClient(baseUrl = '/v1', fetcher: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/+$/, '')
  async function request<T extends Metadata>(path: string, init: RequestInit, valid: (data: Record<string, unknown>) => boolean, limits?: ServerLimits, external = false): Promise<T> {
    if (typeof init.body === 'string' && limits && new TextEncoder().encode(init.body).length > limits.maxRequestBytes) throw new ApiError(413, 'REQUEST_TOO_LARGE', 'La configuración supera el tamaño permitido por el servidor.')
    let response: Response
    try { response = await fetcher(external ? path : `${base}${path}`, { ...init, credentials: 'omit', headers: { Accept: 'application/json', ...init.headers } }) }
    catch (error) {
      if (init.signal?.aborted) throw error
      throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor. Comprueba que esté iniciado.')
    }
    let data: unknown
    const raw = await response.text()
    if (limits && new TextEncoder().encode(raw).length > limits.maxDecodedResponseBytes) throw new ApiError(413, 'RESULT_TOO_LARGE', 'La respuesta supera el tamaño permitido por el servidor.')
    try { data = JSON.parse(raw) }
    catch { throw new ApiError(response.status, 'INVALID_RESPONSE', 'El servidor devolvió una respuesta inválida.') }
    if (!response.ok) {
      const failure = object(data) && object(data.error) ? data.error : null
      const fields = failure && Array.isArray(failure.fields) ? failure.fields.filter((field): field is { path: string; reason: string } => object(field) && typeof field.path === 'string' && typeof field.reason === 'string') : []
      const retryHeader = response.headers.get('Retry-After')
      const retryAfterSeconds = retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : null
      throw new ApiError(response.status, typeof failure?.code === 'string' ? failure.code : 'HTTP_ERROR',
        typeof failure?.message === 'string' ? failure.message : 'No se pudo completar la solicitud.', fields, retryAfterSeconds)
    }
    if (!object(data) || data.schemaVersion !== '1.0' || typeof data.engineVersion !== 'string' || typeof data.requestId !== 'string' || !valid(data)) {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'La respuesta no corresponde al contrato de la aplicación.')
    }
    return data as T
  }
  const normalized = (configuration: ConfigurationInput): ConfigurationInput => configuration.intervention.combined?.resourceSchedule
    ? { ...configuration, intervention: { ...configuration.intervention, combined: normalizedCombinedPlan(configuration.intervention.combined) } } : configuration
  const compare = (configuration: ConfigurationInput, graphHash: string, signal?: AbortSignal, includeFrames = false, limits?: ServerLimits) => {
    configuration = normalized(configuration)
    return request<CompareResponse>('/simulations/compare', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemaVersion: '1.0', configuration, expectedGraphHash: graphHash, includeRepresentativeFrames: includeFrames }),
  }, data => completeComparison(data, configuration, graphHash, includeFrames), limits)
  }
  return {
    compare,
    compareForPlayback: async (configuration: ConfigurationInput, graphHash: string, signal?: AbortSignal, limits?: ServerLimits) => {
      const includeFrames = !limits || configuration.scenario.populationSize * (configuration.scenario.days + 1) <= limits.maxFrameStates
      try { return await compare(configuration, graphHash, signal, includeFrames, limits) }
      catch (error) {
        if (!includeFrames || signal?.aborted || !(error instanceof ApiError) || error.status !== 413 || !['FRAMES_TOO_LARGE', 'RESULT_TOO_LARGE'].includes(error.code)) throw error
        return compare(configuration, graphHash, signal, false, limits)
      }
    },
    createJob: (configuration: ConfigurationInput, graphHash: string, credentials: JobCredentials, signal?: AbortSignal, includeFrames = false, limits?: ServerLimits) => request<JobResponse>('/jobs', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'X-Job-Token': credentials.token, 'Idempotency-Key': credentials.idempotencyKey },
      body: JSON.stringify({ schemaVersion: '1.0', configuration: normalized(configuration), expectedGraphHash: graphHash, includeRepresentativeFrames: includeFrames }),
    }, data => validJob(data) && object(data.progress) && data.progress.replicatesTotal === configuration.repetitions && object(data.manifest) && data.manifest.graphHash === graphHash && data.manifest.rootSeed === configuration.rootSeed, limits),
    jobStatus: (jobId: string, token: string, signal?: AbortSignal) => request<JobResponse>(`/jobs/${encodeURIComponent(jobId)}`, { signal, headers: { 'X-Job-Token': token } }, data => validJob(data) && data.jobId === jobId),
    cancelJob: (jobId: string, token: string, signal?: AbortSignal) => request<JobResponse>(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST', signal, headers: { 'X-Job-Token': token } }, data => validJob(data) && data.jobId === jobId && ['completed', 'failed', 'cancelled'].includes(String(data.status))),
    jobResult: async (jobId: string, token: string, configuration: ConfigurationInput, graphHash: string, signal?: AbortSignal, includeFrames = false, limits?: ServerLimits) => {
      const validLink = (data: Record<string, unknown>) => typeof data.downloadUrl === 'string' && /^https:\/\/[a-z0-9.-]+\.s3\.us-east-2\.amazonaws\.com\//.test(data.downloadUrl) && data.expiresIn === 300
      const data = await request<CompareResponse & { downloadUrl?: string }>(`/jobs/${encodeURIComponent(jobId)}/result`, { signal, headers: { 'X-Job-Token': token } }, data => completeComparison(data, normalized(configuration), graphHash, includeFrames) || validLink(data), limits)
      if (!data.downloadUrl) return data
      if (!validLink(data as unknown as Record<string, unknown>)) throw new ApiError(200, 'INVALID_RESPONSE', 'El servidor devolvió un enlace de descarga inválido.')
      return request<CompareResponse>(data.downloadUrl, { signal }, result => completeComparison(result, normalized(configuration), graphHash, includeFrames), limits, true)
    },
    health: (signal?: AbortSignal) => request<HealthResponse>('/health', { signal }, data => data.status === 'ok' && typeof data.region === 'string' && typeof data.buildCommit === 'string'),
    config: (signal?: AbortSignal) => request<ConfigResponse>('/config', { signal }, validConfig),
    preview: (configuration: ConfigurationInput, signal?: AbortSignal, limits?: ServerLimits) => {
      configuration = normalized(configuration)
      return request<PreviewResponse>('/scenarios/preview', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schemaVersion: '1.0', configuration }),
    }, data => validPreview(data, configuration, limits), limits)
    },
  }
}

export function toConfiguration(s: Scenario, base?: ConfigurationInput): ConfigurationInput {
  return { ...base, rootSeed: s.seed, networkMode: 'fixed', repetitions: s.repetitions,
    scenario: { populationSize: s.population, days: s.days, beta: s.beta, sigma: s.sigma, gamma: s.gamma,
      initialInfectious: s.initial, origin: { kind: s.origin, value: s.origin === 'node' ? s.node : null } },
    intervention: { vaccines: s.vaccines, interventionDay: s.interventionDay, vaccineEfficacy: s.efficacy, ...(s.combined ? { combined: normalizedCombinedPlan(s.combined) } : {}) },
    policies: ['none', 'random', 'targeted'] }
}
