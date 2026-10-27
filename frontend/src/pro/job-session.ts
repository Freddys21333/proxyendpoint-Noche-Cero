import type { ConfigurationInput } from '../lib/api.ts'

/** Credenciales y solicitud de un trabajo. Se guardan solo en sessionStorage. */
export type StoredJob = {
  id: string
  token: string
  idempotencyKey: string
  configuration: ConfigurationInput
  graphHash: string
  createdAt: string
}

export const JOB_STORAGE_KEY = 'noche-cero-jobs-v1'

type JobStorage = Pick<Storage, 'getItem' | 'setItem'>

export function defaultJobStorage(): JobStorage | null {
  try {
    const storage = globalThis.sessionStorage
    return storage ?? null
  } catch {
    return null
  }
}

const isToken = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const isHash = (value: unknown): value is string => typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value)

function isStoredJob(value: unknown): value is StoredJob {
  if (typeof value !== 'object' || value === null) return false
  const job = value as Record<string, unknown>
  return typeof job.id === 'string' && job.id.length > 0 && isToken(job.token)
    && typeof job.idempotencyKey === 'string' && job.idempotencyKey.length > 0
    && isHash(job.graphHash) && typeof job.createdAt === 'string' && Number.isFinite(Date.parse(job.createdAt))
    && typeof job.configuration === 'object' && job.configuration !== null
    && typeof (job.configuration as Record<string, unknown>).repetitions === 'number'
}

/** Descarta entradas corruptas o de otra versión en lugar de romper la pantalla. */
export function readStoredJobs(storage: JobStorage | null = defaultJobStorage()): StoredJob[] {
  if (!storage) return []
  let raw: string | null
  try { raw = storage.getItem(JOB_STORAGE_KEY) } catch { return [] }
  if (!raw) return []
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isStoredJob)
}

export function saveStoredJobs(jobs: readonly StoredJob[], storage: JobStorage | null = defaultJobStorage()): void {
  if (!storage) return
  try { storage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobs.filter(isStoredJob))) } catch { /* cuota o modo privado: la sesión sigue en memoria */ }
}

export function upsertStoredJob(job: StoredJob, storage: JobStorage | null = defaultJobStorage()): StoredJob[] {
  const next = [job, ...readStoredJobs(storage).filter(current => current.id !== job.id)]
  saveStoredJobs(next, storage)
  return next
}

export function removeStoredJob(id: string, storage: JobStorage | null = defaultJobStorage()): StoredJob[] {
  const next = readStoredJobs(storage).filter(job => job.id !== id)
  saveStoredJobs(next, storage)
  return next
}
