import { createDemoJob, demoResultFor, type ProJob } from '../jobs-model.ts'

export function initialDemoJobs(now = new Date()): ProJob[] {
  const completedAt = new Date(now.getTime() - 1000 * 60 * 42)
  const completedBase = createDemoJob(
    { replicates: 1000, rootSeed: 20261026 },
    new Date(completedAt.getTime() - 1000 * 60 * 12),
    'demo-completed-1000',
  )
  const completed: ProJob = {
    ...completedBase,
    status: 'SUCCEEDED',
    startedAt: new Date(completedAt.getTime() - 1000 * 60 * 11).toISOString(),
    finishedAt: completedAt.toISOString(),
    progress: { total: 1000, succeeded: 1000, failed: 0 },
    result: demoResultFor(completedBase, completedAt),
  }

  const failedAt = new Date(now.getTime() - 1000 * 60 * 95)
  const failedBase = createDemoJob(
    { replicates: 500, rootSeed: 771204 },
    new Date(failedAt.getTime() - 1000 * 60 * 4),
    'demo-failed-500',
  )
  const failed: ProJob = {
    ...failedBase,
    status: 'FAILED',
    startedAt: new Date(failedAt.getTime() - 1000 * 60 * 3).toISOString(),
    finishedAt: failedAt.toISOString(),
    progress: { total: 500, succeeded: 218, failed: 1 },
    error: {
      code: 'REPLICA_FAILED',
      message: 'Una réplica no pudo completarse. El agregado no es utilizable para recomendación.',
    },
  }

  const cancelledAt = new Date(now.getTime() - 1000 * 60 * 150)
  const cancelledBase = createDemoJob(
    { replicates: 250, rootSeed: 440021 },
    new Date(cancelledAt.getTime() - 1000 * 60 * 2),
    'demo-cancelled-250',
  )
  const cancelled: ProJob = {
    ...cancelledBase,
    status: 'CANCELLED',
    startedAt: new Date(cancelledAt.getTime() - 1000 * 60 * 2).toISOString(),
    finishedAt: cancelledAt.toISOString(),
    progress: { total: 250, succeeded: 61, failed: 0 },
  }

  return [completed, failed, cancelled]
}
