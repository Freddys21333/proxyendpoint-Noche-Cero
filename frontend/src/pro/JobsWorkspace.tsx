import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, createJobCredentials, type CompareResponse, type ConfigResponse, type ConfigurationInput, type JobResponse, type JobCredentials } from '../lib/api.ts'
import { experimentZip } from '../lib/export-experiment.ts'
import type { createApiClient } from '../lib/api.ts'
import { JOB_REPLICATE_MIN, mapApiJob, previewConfigurationForJob, validateJobDraft, type ProJob, type ProJobDraft } from './jobs-model.ts'
import { JobForm } from './JobForm.tsx'
import { JobStatusPanel } from './JobStatusPanel.tsx'
import { JobHistory } from './JobHistory.tsx'

const SESSION_KEY = 'noche-cero:local-jobs:v1'
type StoredJob = {
  response: JobResponse
  configuration: ConfigurationInput
  graphHash: string
  credentials: JobCredentials
  result?: CompareResponse
  localError?: string
}

function restoreJobs(): StoredJob[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is StoredJob => !!item && typeof item === 'object'
      && 'response' in item && 'configuration' in item && 'graphHash' in item && 'credentials' in item
      && typeof item.graphHash === 'string' && !!item.credentials && typeof item.credentials.token === 'string'
      && typeof item.credentials.idempotencyKey === 'string')
  } catch { return [] }
}

function toUiJobs(records: StoredJob[]): ProJob[] {
  return records.map(record => {
    const job = mapApiJob(record.response, record.configuration, record.result)
    return record.localError ? { ...job, error: { code: 'SESSION_ERROR', message: record.localError } } : job
  })
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404) return 'El trabajo ya no está disponible en este proceso del backend o la sesión venció.'
    if (error.status === 429) return 'La cola está ocupada. Espera un momento y vuelve a consultar.'
    return error.message
  }
  return 'No se pudo completar la operación con el backend local.'
}

export function JobsWorkspace({ api, serverConfig, comparison, preview }: {
  api: ReturnType<typeof createApiClient>
  serverConfig: ConfigResponse | null
  comparison: CompareResponse | null
  preview: ConfigResponse['defaults'] | CompareResponse['configuration'] | null
}) {
  const maxReplicates = serverConfig?.jobLimits?.maxRepetitions ?? JOB_REPLICATE_MIN
  const maxConcurrent = serverConfig?.jobLimits?.maxConcurrent ?? 1
  const available = Boolean(serverConfig?.features.asyncJobs && serverConfig.jobLimits)
  const [records, setRecords] = useState<StoredJob[]>(restoreJobs)
  const [activeId, setActiveId] = useState<string | null>(() => restoreJobs()[0]?.response.jobId ?? null)
  const [draft, setDraft] = useState<ProJobDraft>({ replicates: Math.min(30, maxReplicates), rootSeed: serverConfig?.defaults.rootSeed ?? 20261026 })
  const [errors, setErrors] = useState<{ replicates?: string; rootSeed?: string }>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const createController = useRef<AbortController | null>(null)
  const uiJobs = useMemo(() => toUiJobs(records), [records])
  const activeJob = useMemo(() => uiJobs.find(job => job.id === activeId) ?? null, [uiJobs, activeId])
  const activeRecord = records.find(record => record.response.jobId === activeId) ?? null

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(records.map(({ result: _result, localError: _error, ...record }) => record)))
    } catch {
      setRequestError('El navegador no pudo guardar la credencial temporal. Mantén esta pestaña abierta para seguir el trabajo.')
    }
  }, [records])

  useEffect(() => () => createController.current?.abort(), [])

  useEffect(() => {
    if (!activeRecord) return
    const controller = new AbortController()
    let timer = 0
    let delay = 900
    const refresh = async () => {
      try {
        let response = activeRecord.response
        let result = activeRecord.result
        if (response.status === 'completed' && !result) {
          result = await api.jobResult(response.jobId, activeRecord.credentials.token, activeRecord.configuration, activeRecord.graphHash, controller.signal, false, serverConfig?.limits)
        } else if (!['failed', 'cancelled', 'completed'].includes(response.status)) {
          response = await api.jobStatus(response.jobId, activeRecord.credentials.token, controller.signal)
        }
        setRecords(current => current.map(record => record.response.jobId === response.jobId ? { ...record, response, result, localError: undefined } : record))
        if (!controller.signal.aborted && (!['failed', 'cancelled'].includes(response.status) && (response.status !== 'completed' || !result))) {
          timer = window.setTimeout(refresh, delay)
          delay = Math.min(15000, Math.round(delay * 1.6))
        }
      } catch (error) {
        if (controller.signal.aborted) return
        const message = errorMessage(error)
        setRecords(current => current.map(record => record.response.jobId === activeRecord.response.jobId ? { ...record, localError: message } : record))
        const retryable = !(error instanceof ApiError) || error.status === 0 || error.status === 429 || error.status >= 500
        if (retryable) {
          timer = window.setTimeout(refresh, delay)
          delay = Math.min(15000, Math.round(delay * 1.6))
        }
      }
    }
    void refresh()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [activeRecord?.response.jobId, activeRecord?.response.status, activeRecord?.credentials.token, api, serverConfig?.limits])

  const updateDraft = (next: ProJobDraft) => { setDraft(next); setErrors({}); setRequestError(null) }

  const create = async (source: StoredJob | null = null) => {
    if (!serverConfig || !available) return
    createController.current?.abort()
    const controller = new AbortController()
    createController.current = controller
    setSubmitting(true)
    setRequestError(null)
    try {
      const base = source?.configuration ?? comparison?.configuration ?? preview ?? serverConfig.defaults
      const configuration: ConfigurationInput = { ...base, rootSeed: source?.configuration.rootSeed ?? draft.rootSeed, repetitions: source?.configuration.repetitions ?? draft.replicates }
      const graph = await api.preview(previewConfigurationForJob(configuration, serverConfig.defaults.repetitions), controller.signal, serverConfig.limits)
      const credentials = createJobCredentials()
      const response = await api.createJob(configuration, graph.graphHash, credentials, controller.signal, false, serverConfig.limits)
      const record: StoredJob = { response, configuration, graphHash: graph.graphHash, credentials }
      setRecords(current => [record, ...current.filter(item => item.response.jobId !== response.jobId)])
      setActiveId(response.jobId)
    } catch (error) {
      if (!controller.signal.aborted) setRequestError(errorMessage(error))
    } finally {
      if (createController.current === controller) {
        createController.current = null
        if (!controller.signal.aborted) setSubmitting(false)
      }
    }
  }

  const submit = () => {
    const next = validateJobDraft(draft, maxReplicates)
    setErrors(next)
    if (Object.keys(next).length) return
    void create()
  }

  const cancel = async () => {
    if (!activeRecord || !activeJob || ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(activeJob.status)) return
    setRequestError(null)
    try {
      const response = await api.cancelJob(activeRecord.response.jobId, activeRecord.credentials.token)
      setRecords(current => current.map(record => record.response.jobId === response.jobId ? { ...record, response, localError: undefined } : record))
    } catch (error) { setRequestError(errorMessage(error)) }
  }

  const retry = () => { if (activeRecord) void create(activeRecord) }
  const forget = () => {
    setRecords(current => current.filter(record => record.response.jobId !== activeId))
    setActiveId(null)
  }
  const exportResult = (result: CompareResponse) => {
    const blob = new Blob([experimentZip(result)], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `manta-job-${result.configuration.rootSeed}-${result.manifest.experimentHash.slice(7, 15)}.zip`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <>
    {!available && <div className="pro-alert" role="status">El servidor no anunció trabajos asíncronos. Enciende el modo local de jobs para habilitar esta función; no se mostrarán resultados de ejemplo.</div>}
    {requestError && <div className="pro-alert" role="alert"><strong>No se pudo completar el trabajo.</strong><p>{requestError}</p></div>}
    <div className="pro-work-grid">
      <JobForm draft={draft} errors={errors} maxReplicates={maxReplicates} maxConcurrent={maxConcurrent} submitting={submitting} available={available} onChange={updateDraft} onSubmit={submit} />
      <JobStatusPanel job={activeJob} fullResult={activeRecord?.result} onCancel={() => { void cancel() }} onRetry={retry} onForget={forget} onExport={exportResult} />
    </div>
    <JobHistory jobs={uiJobs} activeId={activeId} onSelect={setActiveId} />
  </>
}
