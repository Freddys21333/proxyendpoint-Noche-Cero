import { useEffect, useMemo, useState } from 'react'
import { initialDemoJobs } from './fixtures/jobs.ts'
import {
  advanceDemoJob, cancelDemoJob, createDemoJob, isTerminalJob, validateJobDraft,
  type ProJob, type ProJobDraft,
} from './jobs-model.ts'
import { JobForm } from './JobForm.tsx'
import { JobStatusPanel } from './JobStatusPanel.tsx'
import { JobHistory } from './JobHistory.tsx'

function newJobId(): string {
  return `demo-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`
}

export function JobsWorkspace() {
  const [jobs, setJobs] = useState<ProJob[]>(() => initialDemoJobs())
  const [activeId, setActiveId] = useState<string | null>('demo-completed-1000')
  const [draft, setDraft] = useState<ProJobDraft>({ replicates: 1000, rootSeed: 20261026 })
  const [errors, setErrors] = useState<{ replicates?: string; rootSeed?: string }>({})
  const activeJob = useMemo(() => jobs.find(job => job.id === activeId) ?? null, [jobs, activeId])

  useEffect(() => {
    if (!activeJob || isTerminalJob(activeJob)) return
    const timer = window.setInterval(() => {
      setJobs(current => current.map(job => job.id === activeJob.id ? advanceDemoJob(job) : job))
    }, 520)
    return () => window.clearInterval(timer)
  }, [activeJob?.id, activeJob?.status])

  const updateDraft = (next: ProJobDraft) => {
    setDraft(next)
    setErrors({})
  }

  const submit = () => {
    const nextErrors = validateJobDraft(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const job = createDemoJob(draft, new Date(), newJobId())
    setJobs(current => [job, ...current])
    setActiveId(job.id)
  }

  const cancel = () => {
    if (!activeJob) return
    setJobs(current => current.map(job => job.id === activeJob.id ? cancelDemoJob(job) : job))
  }

  const retry = () => {
    if (!activeJob) return
    const job = createDemoJob(
      { replicates: activeJob.configuration.replicates, rootSeed: activeJob.configuration.rootSeed },
      new Date(),
      newJobId(),
    )
    setJobs(current => [job, ...current])
    setActiveId(job.id)
  }

  return <>
    <div className="pro-work-grid">
      <JobForm draft={draft} errors={errors} onChange={updateDraft} onSubmit={submit} />
      <JobStatusPanel job={activeJob} onCancel={cancel} onRetry={retry} />
    </div>
    <JobHistory jobs={jobs} activeId={activeId} onSelect={setActiveId} />
  </>
}
