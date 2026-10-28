import type { CompareResponse, ConfigurationInput, JobResponse, Policy } from '../lib/api.ts'

export type ProJobStatus = 'QUEUED' | 'RUNNING' | 'AGGREGATING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
export type ProJobSource = 'fixture' | 'api'
export type ProJobDraft = { replicates: number; rootSeed: number }
export type ProJobConfiguration = {
  replicates: number
  rootSeed: number
  policies: readonly Policy[]
  modelLabel: string
  modelVersion: string
  calibrated: boolean
  networkMode: 'fixed'
}
export type ProJobProgress = { total: number; succeeded: number; failed: number }
export type ProJobResult = {
  experimentHash: string
  generatedAt: string
  policies: { policy: Policy; cumulativeInfected: number; peakInfectious: number }[]
}
export type ProJob = {
  id: string
  source: ProJobSource
  status: ProJobStatus
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  configuration: ProJobConfiguration
  progress: ProJobProgress
  error: { code: string; message: string } | null
  result: ProJobResult | null
}

export const JOB_POLICIES = ['none', 'random', 'targeted'] as const satisfies readonly Policy[]
export const JOB_REPLICATE_MIN = 2
export const JOB_REPLICATE_MAX = 1000
export const JOB_SYNC_REPLICATE_MAX = 30
export const JOB_SEED_MAX = 4294967295

export const jobStatusLabels: Record<ProJobStatus, string> = {
  QUEUED: 'En cola',
  RUNNING: 'Ejecutando',
  AGGREGATING: 'Agregando resultados',
  SUCCEEDED: 'Completado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
}

export const jobStatusDescriptions: Record<ProJobStatus, string> = {
  QUEUED: 'El trabajo está aceptado y espera turno de ejecución.',
  RUNNING: 'Las réplicas se están procesando. El progreso muestra conteos reales.',
  AGGREGATING: 'Las réplicas terminaron y se está construyendo el agregado.',
  SUCCEEDED: 'El agregado está completo y el resultado puede consultarse.',
  FAILED: 'El trabajo se detuvo sin un agregado utilizable.',
  CANCELLED: 'La cancelación fue aceptada y no se generará un resultado.',
}

const terminalStatuses: ReadonlySet<ProJobStatus> = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])

export function isTerminalJob(job: ProJob): boolean {
  return terminalStatuses.has(job.status)
}

export function jobProgressPercent(job: ProJob): number {
  const completed = job.progress.succeeded + job.progress.failed
  return job.progress.total > 0 ? Math.min(100, Math.round((completed / job.progress.total) * 100)) : 0
}

export function jobOutcome(job: ProJob): { label: string; partial: boolean } {
  if (job.status === 'SUCCEEDED' && job.progress.failed > 0) return { label: 'Resultado incompleto', partial: true }
  return { label: jobStatusLabels[job.status], partial: false }
}

export function validateJobDraft(draft: ProJobDraft, maxReplicates = JOB_REPLICATE_MAX): { replicates?: string; rootSeed?: string } {
  const errors: { replicates?: string; rootSeed?: string } = {}
  if (!Number.isInteger(draft.replicates) || draft.replicates < JOB_REPLICATE_MIN || draft.replicates > maxReplicates) {
    errors.replicates = `Las réplicas deben ser un entero entre ${JOB_REPLICATE_MIN} y ${maxReplicates.toLocaleString('es-EC')}.`
  }
  if (!Number.isInteger(draft.rootSeed) || draft.rootSeed < 0 || draft.rootSeed > JOB_SEED_MAX) {
    errors.rootSeed = `La semilla debe ser un entero entre 0 y ${JOB_SEED_MAX.toLocaleString('es-EC')}.`
  }
  return errors
}

export function previewConfigurationForJob(configuration: ConfigurationInput, synchronousMax = JOB_SYNC_REPLICATE_MAX): ConfigurationInput {
  return { ...configuration, repetitions: Math.min(configuration.repetitions, synchronousMax) }
}

const apiStatus: Record<JobResponse['status'], ProJobStatus> = {
  pending: 'QUEUED', running: 'RUNNING', aggregating: 'AGGREGATING',
  completed: 'SUCCEEDED', failed: 'FAILED', cancelled: 'CANCELLED',
}

export function mapApiJob(response: JobResponse, configuration: ConfigurationInput, result?: CompareResponse): ProJob {
  if (configuration.rootSeed !== response.manifest.rootSeed || configuration.repetitions !== response.progress.replicatesTotal) {
    throw new Error('La configuración guardada no coincide con el manifiesto del trabajo.')
  }
  const complete = response.status === 'completed'
    && response.progress.replicatesCompleted === response.progress.replicatesTotal
    && response.progress.replicatesFailed === 0
    && result?.progress.replicatesSucceeded === response.progress.replicatesTotal
    && result?.progress.replicatesFailed === 0
  const policies: Policy[] = ['none', 'random', 'targeted']
  return {
    id: response.jobId,
    source: 'api',
    status: apiStatus[response.status],
    createdAt: response.createdAt,
    startedAt: response.status === 'pending' ? null : response.createdAt,
    finishedAt: ['completed', 'failed', 'cancelled'].includes(response.status) ? response.updatedAt : null,
    configuration: {
      replicates: response.progress.replicatesTotal,
      rootSeed: response.manifest.rootSeed,
      policies,
      modelLabel: 'Plaga ficticia SEIR',
      modelVersion: response.manifest.modelVersion,
      calibrated: false,
      networkMode: 'fixed',
    },
    progress: {
      total: response.progress.replicatesTotal,
      succeeded: response.progress.replicatesCompleted,
      failed: response.progress.replicatesFailed,
    },
    error: response.status === 'failed' ? {
      code: response.error ?? 'SIMULATION_FAILED',
      message: response.error === 'RESULT_TOO_LARGE'
        ? 'El agregado excede el límite de tamaño publicado por el servidor.'
        : 'El motor no pudo completar todas las réplicas. No hay un resultado utilizable.',
    } : null,
    result: complete && result ? {
      experimentHash: result.manifest.experimentHash,
      generatedAt: result.generatedAt,
      policies: policies.map(policy => ({
        policy,
        cumulativeInfected: result.summaryByPolicy[policy].cumulativeInfected.mean ?? 0,
        peakInfectious: result.summaryByPolicy[policy].peakInfectious.mean ?? 0,
      })),
    } : null,
  }
}

export function createDemoJob(draft: ProJobDraft, now = new Date(), id = `demo-${now.getTime()}`): ProJob {
  return {
    id,
    source: 'fixture',
    status: 'QUEUED',
    createdAt: now.toISOString(),
    startedAt: null,
    finishedAt: null,
    configuration: {
      replicates: draft.replicates,
      rootSeed: draft.rootSeed,
      policies: JOB_POLICIES,
      modelLabel: 'Plaga ficticia SEIR',
      modelVersion: 'fictional-seir-v1',
      calibrated: false,
      networkMode: 'fixed',
    },
    progress: { total: draft.replicates, succeeded: 0, failed: 0 },
    error: null,
    result: null,
  }
}

export function advanceDemoJob(job: ProJob, now = new Date()): ProJob {
  if (isTerminalJob(job)) return job
  if (job.status === 'QUEUED') {
    return { ...job, status: 'RUNNING', startedAt: now.toISOString() }
  }
  if (job.status === 'RUNNING') {
    const step = Math.max(1, Math.ceil(job.progress.total / 10))
    const succeeded = Math.min(job.progress.total, job.progress.succeeded + step)
    return {
      ...job,
      status: succeeded >= job.progress.total ? 'AGGREGATING' : 'RUNNING',
      progress: { ...job.progress, succeeded },
    }
  }
  return {
    ...job,
    status: 'SUCCEEDED',
    finishedAt: now.toISOString(),
    result: demoResultFor(job, now),
  }
}

export function cancelDemoJob(job: ProJob, now = new Date()): ProJob {
  if (isTerminalJob(job)) return job
  return { ...job, status: 'CANCELLED', finishedAt: now.toISOString() }
}

export function demoResultFor(job: ProJob, now = new Date()): ProJobResult {
  const variation = job.configuration.rootSeed % 11
  return {
    experimentHash: `sha256:${'d'.repeat(64)}`,
    generatedAt: now.toISOString(),
    policies: [
      { policy: 'none', cumulativeInfected: 412 + variation, peakInfectious: 38 + (variation % 4) },
      { policy: 'random', cumulativeInfected: 286 + (variation % 7), peakInfectious: 27 + (variation % 3) },
      { policy: 'targeted', cumulativeInfected: 194 + (variation % 5), peakInfectious: 19 + (variation % 2) },
    ],
  }
}
