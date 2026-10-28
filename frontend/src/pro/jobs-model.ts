import type { ConfigurationInput, JobLimits, JobResponse, PreviewResponse } from '../lib/api.ts'

export type ProJobStatus = 'PENDING' | 'RUNNING' | 'AGGREGATING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
export type ProJobDraft = { replicates: number; rootSeed: number }
export type ProJob = {
  id: string
  status: ProJobStatus
  createdAt: string
  updatedAt: string
  configuration: ConfigurationInput
  progress: { total: number; succeeded: number; failed: number }
  manifestHash: string | null
  error: { code: string; message: string } | null
}

export const JOB_POLICIES = ['none', 'random', 'targeted'] as const
export const JOB_REPLICATE_MIN = 2
export const JOB_REPLICATE_DEFAULT_MAX = 100
export const JOB_SEED_MAX = 4294967295
export const JOB_POLL_INTERVAL_MS = 1500

export const jobStatusLabels: Record<ProJobStatus, string> = {
  PENDING: 'En cola',
  RUNNING: 'Ejecutando',
  AGGREGATING: 'Agregando resultados',
  SUCCEEDED: 'Completado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
}

export const jobStatusDescriptions: Record<ProJobStatus, string> = {
  PENDING: 'El trabajo está aceptado y espera turno de ejecución en el servidor.',
  RUNNING: 'Las réplicas se están procesando. El progreso muestra conteos reales del servidor.',
  AGGREGATING: 'Las réplicas terminaron y el servidor está construyendo el agregado.',
  SUCCEEDED: 'El agregado está completo y el resultado puede consultarse.',
  FAILED: 'El trabajo se detuvo sin un agregado utilizable.',
  CANCELLED: 'La cancelación fue aceptada y no se generará un resultado.',
}

const terminalStatuses: ReadonlySet<ProJobStatus> = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED'])
const apiStatuses: Record<JobResponse['status'], ProJobStatus> = {
  pending: 'PENDING',
  running: 'RUNNING',
  aggregating: 'AGGREGATING',
  completed: 'SUCCEEDED',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
}

export const jobErrorLabels: Record<string, string> = {
  SIMULATION_FAILED: 'Una réplica falló y el servidor no completó el agregado.',
  RESULT_TOO_LARGE: 'El resultado supera el tamaño que el servidor puede entregar.',
  JOB_NOT_FOUND: 'El trabajo no está disponible. Puede haber expirado; si era local, pudo perderse al reiniciar.',
  JOB_NOT_READY: 'El trabajo todavía no tiene un resultado completo.',
  IDEMPOTENCY_CONFLICT: 'Esa clave de idempotencia ya identifica otra solicitud. Crea el trabajo de nuevo.',
  VALIDATION_ERROR: 'El servidor rechazó la solicitud del trabajo por un dato inválido.',
  REQUEST_TOO_LARGE: 'La configuración del trabajo supera el tamaño permitido.',
  NETWORK_ERROR: 'No se pudo conectar con el servidor. Comprueba que esté iniciado.',
  HTTP_ERROR: 'El servidor respondió con un error al operar el trabajo.',
}

export function statusFromApi(status: JobResponse['status']): ProJobStatus {
  return apiStatuses[status]
}

export function jobMaxReplicates(limits?: JobLimits, preview?: PreviewResponse | null): number {
  const maximum = limits?.maxRepetitions ?? JOB_REPLICATE_DEFAULT_MAX
  if (!limits || !preview) return maximum
  // Validación del límite de trabajo publicado por la API; no calcula epidemiología.
  const workPerReplicate = preview.graph.edges.length * preview.configuration.scenario.days
  return workPerReplicate > 0 ? Math.min(maximum, Math.floor(limits.maxEdgeDayReplicates / workPerReplicate)) : maximum
}

export function isTerminalStatus(status: ProJobStatus): boolean {
  return terminalStatuses.has(status)
}

export function isTerminalJob(job: ProJob): boolean {
  return isTerminalStatus(job.status)
}

export function jobProgressPercent(job: ProJob): number {
  const completed = job.progress.succeeded + job.progress.failed
  if (!Number.isFinite(completed) || job.progress.total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((completed / job.progress.total) * 100)))
}

export function jobOutcome(job: ProJob): { label: string; partial: boolean } {
  if (job.status === 'SUCCEEDED' && job.progress.failed > 0) return { label: 'Resultado incompleto', partial: true }
  return { label: jobStatusLabels[job.status], partial: false }
}

export function validateJobDraft(draft: ProJobDraft, limits?: JobLimits, preview?: PreviewResponse | null): { replicates?: string; rootSeed?: string } {
  const max = jobMaxReplicates(limits, preview)
  const errors: { replicates?: string; rootSeed?: string } = {}
  if (!Number.isInteger(draft.replicates) || draft.replicates < JOB_REPLICATE_MIN || draft.replicates > max) {
    errors.replicates = `Las réplicas deben ser un entero entre ${JOB_REPLICATE_MIN} y ${max.toLocaleString('es-EC')}.`
  }
  if (!Number.isInteger(draft.rootSeed) || draft.rootSeed < 0 || draft.rootSeed > JOB_SEED_MAX) {
    errors.rootSeed = `La semilla debe ser un entero entre 0 y ${JOB_SEED_MAX.toLocaleString('es-EC')}.`
  } else if (preview && draft.rootSeed !== preview.configuration.rootSeed) {
    errors.rootSeed = 'La semilla debe coincidir con la vista previa. Cámbiala en el simulador y consulta la red de nuevo.'
  }
  if (max < JOB_REPLICATE_MIN) errors.replicates = 'Esta red supera la capacidad del servidor. Reduce población o duración y consulta la red de nuevo.'
  return errors
}

/** El trabajo reutiliza el escenario ya previsualizado y solo cambia réplicas y semilla. */
export function jobConfigurationFrom(base: ConfigurationInput, draft: ProJobDraft): ConfigurationInput {
  return { ...base, repetitions: draft.replicates, rootSeed: draft.rootSeed }
}

export function jobErrorMessage(error: unknown, fallback = 'No se pudo completar la operación con el trabajo.'): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : ''
  return jobErrorLabels[code] ?? fallback
}

export function jobFromResponse(response: JobResponse, configuration: ConfigurationInput): ProJob {
  const status = statusFromApi(response.status)
  return {
    id: response.jobId,
    status,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    configuration,
    progress: {
      total: response.progress.replicatesTotal,
      succeeded: response.progress.replicatesCompleted,
      failed: response.progress.replicatesFailed,
    },
    manifestHash: response.manifest.requestHash,
    error: response.error ? { code: response.error, message: jobErrorLabels[response.error] ?? response.error } : null,
  }
}

/** Copia el progreso de un trabajo ya conocido sin tocar configuración ni credenciales. */
export function mergeJob(current: ProJob, next: ProJob): ProJob {
  return { ...current, ...next, configuration: current.configuration }
}
