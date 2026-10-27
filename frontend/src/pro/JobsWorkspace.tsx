import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, createApiClient, createJobCredentials, type CompareResponse, type ConfigResponse, type PreviewResponse } from '../lib/api.ts'
import {
  JOB_POLL_INTERVAL_MS, isTerminalJob, jobConfigurationFrom, jobErrorMessage, jobFromResponse, jobMaxReplicates,
  mergeJob, validateJobDraft, type ProJob, type ProJobDraft,
} from './jobs-model.ts'
import { readStoredJobs, removeStoredJob, upsertStoredJob, type StoredJob } from './job-session.ts'
import { JobForm } from './JobForm.tsx'
import { JobStatusPanel } from './JobStatusPanel.tsx'
import { JobHistory } from './JobHistory.tsx'

const api = createApiClient(import.meta.env.VITE_API_BASE_URL || '/v1')

type JobNotice = { tone: 'error' | 'info'; text: string } | null

export function JobsWorkspace({ config, preview, onShowSimulator }: {
  config: ConfigResponse | null
  preview: PreviewResponse | null
  onShowSimulator: () => void
}) {
  const [records, setRecords] = useState<StoredJob[]>(() => readStoredJobs())
  const [jobs, setJobs] = useState<ProJob[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProJobDraft>({ replicates: 30, rootSeed: 20261026 })
  const [errors, setErrors] = useState<{ replicates?: string; rootSeed?: string }>({})
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [resultLoading, setResultLoading] = useState(false)
  const [result, setResult] = useState<{ jobId: string; data: CompareResponse } | null>(null)
  const [notice, setNotice] = useState<JobNotice>(null)

  const maxReplicates = jobMaxReplicates(config?.jobLimits)
  const available = Boolean(config?.features.asyncJobs)
  const activeJob = useMemo(() => jobs.find(job => job.id === activeId) ?? null, [jobs, activeId])
  const activeRecord = useMemo(() => records.find(record => record.id === activeId) ?? null, [records, activeId])
  const activeResult = result && result.jobId === activeId ? result.data : null
  const previewLabel = preview
    ? `${preview.configuration.scenario.populationSize.toLocaleString('es-EC')} personas · ${preview.configuration.scenario.days} días · red ${preview.graphHash.slice(7, 15)}…`
    : null

  const describe = useCallback((error: unknown): string => error instanceof ApiError ? error.message : jobErrorMessage(error), [])

  const applyJob = useCallback((next: ProJob) => {
    setJobs(current => current.some(job => job.id === next.id)
      ? current.map(job => job.id === next.id ? mergeJob(job, next) : job)
      : [next, ...current])
  }, [])

  // Al cargar la configuración, recupera del servidor los trabajos de esta sesión.
  useEffect(() => {
    if (!available || !config) return
    const stored = readStoredJobs()
    setRecords(stored)
    if (!stored.length) return
    let cancelled = false
    void Promise.allSettled(stored.map(async record => {
      const response = await api.jobStatus(record.id, record.token)
      return jobFromResponse(response, record.configuration)
    })).then(results => {
      if (cancelled) return
      const loaded = results.flatMap(item => item.status === 'fulfilled' ? [item.value] : [])
      const failures = results.length - loaded.length
      if (failures) setNotice({ tone: 'error', text: `${failures} ${failures === 1 ? 'trabajo' : 'trabajos'} de esta sesión ya no existen en el servidor (expiraron o se reinició).` })
      if (!loaded.length) return
      setJobs(current => [...loaded, ...current.filter(job => !loaded.some(next => next.id === job.id))])
      setActiveId(current => current ?? loaded[0].id)
    })
    return () => { cancelled = true }
  }, [available, config])

  // Ajusta semilla y réplicas al escenario previsualizado sin pisar lo que el usuario ya eligió.
  useEffect(() => {
    if (!preview) return
    setDraft(current => ({
      rootSeed: current.rootSeed === 20261026 ? preview.configuration.rootSeed : current.rootSeed,
      replicates: Math.min(current.replicates, maxReplicates),
    }))
  }, [preview?.graphHash, preview?.configuration.rootSeed, maxReplicates])

  // Sondeo real del trabajo activo mientras no sea terminal.
  useEffect(() => {
    if (!activeJob || !activeRecord || isTerminalJob(activeJob)) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void api.jobStatus(activeRecord.id, activeRecord.token)
        .then(response => { if (!cancelled) applyJob(jobFromResponse(response, activeRecord.configuration)) })
        .catch(error => { if (!cancelled) setNotice({ tone: 'error', text: describe(error) }) })
    }, JOB_POLL_INTERVAL_MS)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [activeJob, activeRecord, applyJob, describe])

  const create = async (configuration: ReturnType<typeof jobConfigurationFrom> | null, graphHash: string | null, seed?: ProJobDraft) => {
    if (!available) { setNotice({ tone: 'error', text: 'Este servidor no expone trabajos asíncronos.' }); return }
    if (!configuration || !graphHash) { setNotice({ tone: 'error', text: 'Consulta la red antes de crear un trabajo.' }); return }
    if (seed) {
      const nextErrors = validateJobDraft(seed, config?.jobLimits)
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length) return
    }
    setCreating(true)
    setNotice(null)
    const credentials = createJobCredentials()
    try {
      const response = await api.createJob(configuration, graphHash, credentials, undefined, false, config?.limits)
      const job = jobFromResponse(response, configuration)
      const record: StoredJob = {
        id: job.id, token: credentials.token, idempotencyKey: credentials.idempotencyKey,
        configuration, graphHash, createdAt: job.createdAt,
      }
      setRecords(current => [record, ...current.filter(item => item.id !== record.id)])
      upsertStoredJob(record)
      applyJob(job)
      setActiveId(job.id)
      setResult(null)
      setNotice({ tone: 'info', text: 'Trabajo aceptado por el servidor local. El progreso se actualiza automáticamente.' })
    } catch (error) {
      setNotice({ tone: 'error', text: describe(error) })
    } finally {
      setCreating(false)
    }
  }

  const submit = () => {
    void create(preview ? jobConfigurationFrom(preview.configuration, draft) : null, preview?.graphHash ?? null, draft)
  }

  const retry = () => {
    if (!activeRecord) return
    void create(activeRecord.configuration, activeRecord.graphHash)
  }

  const cancel = async () => {
    if (!activeRecord) return
    setCancelling(true)
    setNotice(null)
    try {
      const response = await api.cancelJob(activeRecord.id, activeRecord.token)
      applyJob(jobFromResponse(response, activeRecord.configuration))
      setNotice({ tone: 'info', text: 'Cancelación aceptada. El trabajo no generará un resultado.' })
    } catch (error) {
      setNotice({ tone: 'error', text: describe(error) })
    } finally {
      setCancelling(false)
    }
  }

  const openResult = async () => {
    if (!activeRecord || !activeJob) return
    if (activeJob.status !== 'SUCCEEDED' || activeJob.progress.failed > 0) {
      setNotice({ tone: 'error', text: 'El resultado solo se habilita con un agregado completo.' })
      return
    }
    setResultLoading(true)
    setNotice(null)
    try {
      const data = await api.jobResult(activeRecord.id, activeRecord.token, activeRecord.configuration, activeRecord.graphHash, undefined, false, config?.limits)
      setResult({ jobId: activeRecord.id, data })
    } catch (error) {
      setNotice({ tone: 'error', text: describe(error) })
    } finally {
      setResultLoading(false)
    }
  }

  const remove = (id: string) => {
    setRecords(current => current.filter(record => record.id !== id))
    setJobs(current => current.filter(job => job.id !== id))
    setResult(current => current && current.jobId === id ? null : current)
    setActiveId(current => current === id ? null : current)
    removeStoredJob(id)
  }

  return <>
    {notice && <div className={`pro-alert${notice.tone === 'error' ? '' : ' pro-alert--info'}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <p>{notice.text}</p>
    </div>}
    <div className="pro-work-grid">
      <JobForm
        draft={draft} errors={errors} maxReplicates={maxReplicates} hasPreview={Boolean(preview)}
        previewLabel={previewLabel} available={available} busy={creating}
        onChange={next => { setDraft(next); setErrors({}) }} onSubmit={submit} onShowSimulator={onShowSimulator}
      />
      <JobStatusPanel
        job={activeJob} result={activeResult} resultLoading={resultLoading} cancelling={cancelling}
        onCancel={() => { void cancel() }} onRetry={retry} onOpenResult={() => { void openResult() }}
        onRemove={() => { if (activeId) remove(activeId) }}
      />
    </div>
    <JobHistory jobs={jobs} activeId={activeId} onSelect={setActiveId} />
  </>
}
