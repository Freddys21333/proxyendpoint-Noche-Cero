import { ApiError, type JobResponse } from '../lib/api.ts'

export type JobAccessIssue = { message: string; retryable: boolean; unavailable: boolean; retryAfterMs: number | null }

export function classifyJobError(error: unknown): JobAccessIssue {
  if (!(error instanceof ApiError)) return { message: 'No se pudo consultar el trabajo. Intenta de nuevo.', retryable: false, unavailable: false, retryAfterMs: null }
  if (error.status === 403 || error.status === 404) return {
    message: 'El trabajo ya no está disponible en este proceso del backend o la sesión venció. Puedes quitarlo de esta sesión.',
    retryable: false, unavailable: true, retryAfterMs: null,
  }
  if (error.status === 429) return {
    message: 'La cola está ocupada. Espera un momento y vuelve a intentarlo.',
    retryable: true, unavailable: false,
    retryAfterMs: error.retryAfterSeconds === null ? null : Math.min(error.retryAfterSeconds * 1000, 2147483647),
  }
  if (error.status === 413) return {
    message: 'La solicitud o el resultado supera el límite del servidor. Reduce el tamaño del escenario o las réplicas y vuelve a intentarlo.',
    retryable: false, unavailable: false, retryAfterMs: null,
  }
  if (error.code === 'COMPUTE_UNAVAILABLE') return { message: 'La cola o la retención local está llena. Espera a que el servidor libere espacio y vuelve a intentarlo.', retryable: true, unavailable: false, retryAfterMs: null }
  if (error.status >= 500) return { message: 'El servidor no está disponible en este momento.', retryable: true, unavailable: false, retryAfterMs: null }
  return { message: error.message, retryable: error.status === 0, unavailable: false, retryAfterMs: null }
}

export function nextJobPollDelay(backoffMs: number, issue: JobAccessIssue): number {
  return Math.max(backoffMs, issue.retryAfterMs ?? 0)
}

export function mergeJobStatus(current: JobResponse, incoming: JobResponse): JobResponse {
  if (current.jobId !== incoming.jobId) return current
  const order = { pending: 0, running: 1, aggregating: 2, completed: 3, failed: 3, cancelled: 3 }
  if (order[current.status] === 3 || order[incoming.status] < order[current.status]
    || incoming.progress.replicatesCompleted < current.progress.replicatesCompleted
    || incoming.progress.replicatesFailed < current.progress.replicatesFailed) return current
  return incoming
}
