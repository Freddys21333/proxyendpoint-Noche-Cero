import { AlertTriangle, ArrowLeft, RefreshCw, SlidersHorizontal } from 'lucide-react'
import type { ApiError } from '@/lib/api'
import { apiErrorView, type ApiOperation } from '@/lib/api-errors'

const fieldLabels: Record<string, string> = {
  'configuration.scenario.populationSize': 'Población',
  'configuration.scenario.days': 'Horizonte',
  'configuration.scenario.beta': 'Tasa de transmisión',
  'configuration.scenario.sigma': 'Progresión diaria',
  'configuration.scenario.gamma': 'Recuperación diaria',
  'configuration.scenario.initialInfectious': 'Casos iniciales',
  'configuration.scenario.origin': 'Origen del brote',
  'configuration.intervention.vaccines': 'Vacunas',
  'configuration.intervention.interventionDay': 'Día de intervención',
  'configuration.intervention.vaccineEfficacy': 'Eficacia de la vacuna',
  'configuration.repetitions': 'Réplicas',
  'configuration.rootSeed': 'Semilla',
}


export function ApiErrorPanel({ error, operation, onRetry, onOpenParameters, onRepreview }: {
  error: ApiError
  operation: ApiOperation
  onRetry?: () => void
  onOpenParameters?: () => void
  onRepreview?: () => void
}) {
  const copy = apiErrorView(error, operation)
  const action = copy.action === 'retry' ? onRetry : copy.action === 'parameters' ? onOpenParameters : onRepreview
  const Icon = copy.action === 'retry' ? RefreshCw : copy.action === 'parameters' ? SlidersHorizontal : ArrowLeft
  const technical = `HTTP ${error.status || 'sin respuesta'} · ${error.code}`

  return <section className="api-error-panel" role="alert" aria-labelledby="api-error-title">
    <span className="api-error-icon" aria-hidden="true"><AlertTriangle size={20} /></span>
    <div className="api-error-content">
      <div className="api-error-heading"><h2 id="api-error-title">{copy.title}</h2><span>{error.status ? `Error ${error.status}` : 'Sin conexión'}</span></div>
      <p>{copy.description}</p>
      {error.fields.length > 0 && <ul className="api-error-fields">
        {error.fields.map((field, index) => <li key={`${field.path}-${index}`}><strong>{fieldLabels[field.path] ?? field.path.split('.').at(-1) ?? 'Parámetro'}:</strong> {field.reason}</li>)}
      </ul>}
      {action && <button type="button" className="api-error-action" onClick={action}><Icon size={16} aria-hidden="true" />{copy.actionLabel}</button>}
      <details className="api-error-details"><summary>Detalles técnicos</summary><p>{technical}</p></details>
    </div>
  </section>
}
