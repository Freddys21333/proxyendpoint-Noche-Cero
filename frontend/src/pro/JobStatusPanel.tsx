import { AlertTriangle, Check, Clock, Download, RefreshCw, Square, Trash2 } from 'lucide-react'
import type { CompareResponse, Policy } from '../lib/api.ts'
import { policyLabels } from '../lib/comparison.ts'
import {
  isTerminalJob, jobOutcome, jobProgressPercent, jobStatusDescriptions, jobStatusLabels,
  type ProJob, type ProJobStatus,
} from './jobs-model.ts'

const steps: ProJobStatus[] = ['PENDING', 'RUNNING', 'AGGREGATING', 'SUCCEEDED']
const dateFormat = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
const numberFormat = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })
const policies: Policy[] = ['none', 'random', 'targeted']
const confidenceLabels = { descriptive: 'Comparación descriptiva', inconclusive: 'Incertidumbre no resuelta', supported: 'Ventaja respaldada por estas réplicas' }

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

const mean = (value: number | null | undefined) => value === null || value === undefined ? '—' : numberFormat.format(value)

export function JobStatusPanel({ job, result, resultLoading, cancelling, onCancel, onRetry, onOpenResult, onRemove }: {
  job: ProJob | null
  result: CompareResponse | null
  resultLoading: boolean
  cancelling: boolean
  onCancel: () => void
  onRetry: () => void
  onOpenResult: () => void
  onRemove: () => void
}) {
  if (!job) {
    return <section className="pro-card pro-empty" aria-labelledby="pro-job-status-title">
      <Clock size={28} aria-hidden="true" />
      <h2 id="pro-job-status-title">Sin trabajo seleccionado</h2>
      <p>Crea un trabajo o abre uno de esta sesión para revisar su estado y su resultado.</p>
    </section>
  }

  const outcome = jobOutcome(job)
  const percent = jobProgressPercent(job)
  const currentStep = job.status === 'SUCCEEDED' ? steps.length : stepIndex(job.status)
  const terminal = isTerminalJob(job)
  const showTimeline = job.status !== 'FAILED' && job.status !== 'CANCELLED'
  const canShowResult = job.status === 'SUCCEEDED' && job.progress.failed === 0

  return <section className="pro-card pro-status-card" aria-labelledby="pro-job-status-title">
    <div className="pro-card-heading">
      <div>
        <h2 id="pro-job-status-title">Trabajo seleccionado</h2>
        <p className="mono">{job.id}</p>
      </div>
      <div className="pro-status-badges">
        <span className={`pro-status pro-status--${job.status.toLowerCase()}`}>{outcome.label}</span>
        <span className="pro-badge pro-badge--muted">Servidor local</span>
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
      <div><dt>Réplicas</dt><dd>{numberFormat.format(job.configuration.repetitions)}</dd></div>
      <div><dt>Semilla</dt><dd className="mono">{job.configuration.rootSeed}</dd></div>
      <div><dt>Personas · días</dt><dd>{numberFormat.format(job.configuration.scenario.populationSize)} · {job.configuration.scenario.days}</dd></div>
      <div><dt>Creado</dt><dd>{formatDate(job.createdAt)}</dd></div>
      <div><dt>Actualizado</dt><dd>{formatDate(job.updatedAt)}</dd></div>
      <div><dt>Modelo</dt><dd>Plaga ficticia SEIR <span className="pro-badge pro-badge--muted">Ficticio</span></dd></div>
      <div><dt>Políticas</dt><dd>{job.configuration.policies.map(policy => policyLabels[policy]).join(' · ')}</dd></div>
      {job.manifestHash && <div><dt>Hash de solicitud</dt><dd className="mono pro-hash-cell">{job.manifestHash}</dd></div>}
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
        <p>Hay réplicas fallidas. La recomendación final no se habilita con este agregado.</p>
      </div>
    </div>}

    <div className="pro-actions">
      {!terminal && <button type="button" className="pro-secondary pro-secondary--danger" onClick={onCancel} disabled={cancelling}>
        <Square size={15} aria-hidden="true" /> {cancelling ? 'Cancelando…' : 'Cancelar trabajo'}
      </button>}
      {(job.status === 'FAILED' || job.status === 'CANCELLED') && <button type="button" className="pro-primary" onClick={onRetry}>
        <RefreshCw size={16} aria-hidden="true" /> Reintentar con esta configuración
      </button>}
      {canShowResult && <button type="button" className="pro-primary" onClick={onOpenResult} disabled={resultLoading}>
        <Download size={16} aria-hidden="true" /> {resultLoading ? 'Leyendo resultado…' : result ? 'Volver a leer el resultado' : 'Leer resultado completo'}
      </button>}
      {terminal && <button type="button" className="pro-link-button" onClick={onRemove}>
        <Trash2 size={14} aria-hidden="true" /> Quitar de esta sesión
      </button>}
    </div>

    {result && canShowResult && <section className="pro-result" aria-label="Resultado agregado del trabajo">
      <div className="pro-result-heading">
        <h3>Resultado agregado</h3>
        <span className="pro-badge">{result.configuration.repetitions} réplicas completas</span>
      </div>
      <p>Agregado real del servidor local para este trabajo. La incertidumbre, las diferencias pareadas y los límites completos están en la comparación del simulador.</p>
      <div className="pro-table-scroll">
        <table>
          <caption>Media por estrategia en este trabajo</caption>
          <thead><tr><th scope="col">Estrategia</th><th scope="col">Infectados acumulados</th><th scope="col">Pico de zombies</th></tr></thead>
          <tbody>{policies.map(policy => <tr key={policy}>
            <th scope="row">{policyLabels[policy]}</th>
            <td>{mean(result.summaryByPolicy[policy].cumulativeInfected.mean)}</td>
            <td>{mean(result.summaryByPolicy[policy].peakInfectious.mean)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="pro-result-winner">
        {result.recommendation.winner === 'tie'
          ? 'Empate en la media de infectados entre las estrategias.'
          : `Menor media de infectados: ${policyLabels[result.recommendation.winner]}.`}{' '}
        {confidenceLabels[result.recommendation.confidence]}.
      </p>
      <ul className="pro-result-reasons">{result.recommendation.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      <p className="pro-hash">Hash del experimento <span className="mono">{result.manifest.experimentHash}</span></p>
    </section>}
  </section>
}
