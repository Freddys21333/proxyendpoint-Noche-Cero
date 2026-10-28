import { AlertTriangle, Check, Clock, RefreshCw, Square } from 'lucide-react'
import { policyLabels } from '../lib/comparison.ts'
import type { CompareResponse } from '../lib/api.ts'
import {
  isTerminalJob, jobOutcome, jobProgressPercent, jobStatusDescriptions, jobStatusLabels,
  type ProJob, type ProJobStatus,
} from './jobs-model.ts'

const steps: ProJobStatus[] = ['QUEUED', 'RUNNING', 'AGGREGATING', 'SUCCEEDED']
const dateFormat = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
const numberFormat = new Intl.NumberFormat('es-EC')

function stepIndex(status: ProJobStatus): number {
  if (status === 'SUCCEEDED') return 3
  if (status === 'AGGREGATING') return 2
  if (status === 'RUNNING') return 1
  return 0
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date)
}

export function JobStatusPanel({ job, fullResult, onCancel, onRetry, onForget, onExport }: {
  job: ProJob | null
  fullResult?: CompareResponse
  onCancel: () => void
  onRetry: () => void
  onForget: () => void
  onExport: (result: CompareResponse) => void
}) {
  if (!job) {
    return <section className="pro-card pro-empty" aria-labelledby="pro-job-status-title">
      <Clock size={28} aria-hidden="true" />
      <h2 id="pro-job-status-title">Sin trabajo activo</h2>
      <p>Inicia un trabajo local o selecciónalo en el historial para revisar su estado.</p>
    </section>
  }

  const outcome = jobOutcome(job)
  const percent = jobProgressPercent(job)
  const currentStep = job.status === 'SUCCEEDED' ? steps.length : stepIndex(job.status)
  const terminal = isTerminalJob(job)
  const showTimeline = job.status !== 'FAILED' && job.status !== 'CANCELLED'

  return <section className="pro-card pro-status-card" aria-labelledby="pro-job-status-title">
    <div className="pro-card-heading">
      <div>
        <h2 id="pro-job-status-title">Trabajo activo</h2>
        <p className="mono">{job.id}</p>
      </div>
      <div className="pro-status-badges">
        <span className={`pro-status pro-status--${job.status.toLowerCase()}`}>{outcome.label}</span>
        <span className="pro-badge pro-badge--muted">{job.source === 'fixture' ? 'Datos de ejemplo' : 'Backend local'}</span>
      </div>
    </div>

    <p className="pro-status-description" role="status" aria-live="polite">{jobStatusDescriptions[job.status]}</p>

    <div className="pro-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`Progreso del trabajo: ${percent}%`}>
      <span style={{ width: `${percent}%` }} />
    </div>
    <div className="pro-progress-meta">
      <span>{numberFormat.format(job.progress.succeeded)} completadas</span>
      <span>{numberFormat.format(job.progress.failed)} fallidas</span>
      <span>{numberFormat.format(job.progress.total)} en total</span>
      <strong>{percent}%</strong>
    </div>

    {showTimeline && <ol className="pro-timeline" aria-label="Etapas del trabajo">
      {steps.map((step, index) => <li key={step} className={index < currentStep ? 'is-done' : index === currentStep ? 'is-current' : ''}>
        <span className="pro-timeline-dot" aria-hidden="true">{index < currentStep ? <Check size={13} /> : index + 1}</span>
        <span>{jobStatusLabels[step]}</span>
      </li>)}
    </ol>}

    <dl className="pro-meta">
      <div><dt>Réplicas</dt><dd>{numberFormat.format(job.configuration.replicates)}</dd></div>
      <div><dt>Semilla</dt><dd className="mono">{job.configuration.rootSeed}</dd></div>
      <div><dt>Creado</dt><dd>{formatDate(job.createdAt)}</dd></div>
      <div><dt>Modelo</dt><dd>{job.configuration.modelLabel} <span className="pro-badge pro-badge--muted">{job.configuration.calibrated ? 'Calibrado' : 'Ficticio'}</span></dd></div>
      <div><dt>Red</dt><dd>Fija</dd></div>
      <div><dt>Políticas</dt><dd>{job.configuration.policies.map(policy => policyLabels[policy]).join(' · ')}</dd></div>
    </dl>

    {job.error && <div className="pro-alert" role="alert">
      <AlertTriangle size={19} aria-hidden="true" />
      <div>
        <strong>El trabajo no terminó</strong>
        <p>{job.error.message}</p>
        <code>{job.error.code}</code>
      </div>
    </div>}

    {outcome.partial && <div className="pro-alert pro-alert--warning" role="alert">
      <AlertTriangle size={19} aria-hidden="true" />
      <div>
        <strong>Resultado incompleto</strong>
        <p>Hay réplicas fallidas. La recomendación final no debe habilitarse con este agregado.</p>
      </div>
    </div>}

    {!terminal && <div className="pro-actions">
      <button type="button" className="pro-secondary pro-secondary--danger" onClick={onCancel}>
        <Square size={15} aria-hidden="true" /> Cancelar trabajo
      </button>
    </div>}

    {(job.status === 'FAILED' || job.status === 'CANCELLED') && <div className="pro-actions">
      <button type="button" className="pro-primary" onClick={onRetry}>
        <RefreshCw size={16} aria-hidden="true" /> Reintentar con esta configuración
      </button>
    </div>}

    {job.status === 'SUCCEEDED' && job.result && <section className="pro-result" aria-label="Resultado agregado del trabajo">
      <div className="pro-result-heading">
        <h3>Resultado agregado</h3>
        <span className="pro-badge pro-badge--muted">{job.source === 'fixture' ? 'Cifras de ejemplo' : 'Resultado backend'}</span>
      </div>
      <p>{job.source === 'fixture' ? 'Vista de la interfaz. Estas cifras no provienen de una simulación real ni deben interpretarse como evidencia.' : `Experimento ${job.result.experimentHash}. Las cifras pertenecen a este escenario ficticio y no representan dengue real.`}</p>
      <div className="pro-table-scroll">
        <table>
          <caption>Resumen agregado del trabajo por estrategia</caption>
          <thead><tr><th>Estrategia</th><th>Infectados acumulados</th><th>Pico de zombies</th></tr></thead>
          <tbody>{job.result.policies.map(row => <tr key={row.policy}>
            <th scope="row">{policyLabels[row.policy]}</th>
            <td>{numberFormat.format(row.cumulativeInfected)}</td>
            <td>{numberFormat.format(row.peakInfectious)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="pro-hash">Hash del experimento <span className="mono">{job.result.experimentHash}</span></p>
    </section>}
    {job.source === 'api' && job.status === 'SUCCEEDED' && !job.result && <p role="status">Trabajo completado. Recuperando el agregado completo del backend…</p>}
    {job.source === 'api' && job.result && fullResult && <button type="button" className="pro-secondary" onClick={() => onExport(fullResult)}>Descargar resultado ZIP</button>}
    {job.source === 'api' && terminal && <div className="pro-actions"><button type="button" className="pro-link-button" onClick={onForget}>Quitar de esta sesión</button></div>}
  </section>
}
