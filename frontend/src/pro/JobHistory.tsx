import { jobOutcome, type ProJob } from './jobs-model.ts'

const dateFormat = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
const numberFormat = new Intl.NumberFormat('es-EC')

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date)
}

export function JobHistory({ jobs, activeId, onSelect }: {
  jobs: ProJob[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return <section className="pro-card pro-history" aria-labelledby="pro-history-title">
    <div className="pro-card-heading">
      <div>
        <h2 id="pro-history-title">Historial de trabajos</h2>
        <p>Trabajos creados desde esta sesión del navegador.</p>
      </div>
      <span className="pro-badge pro-badge--muted">Sesión actual</span>
    </div>
    <div className="pro-table-scroll">
      <table>
        <caption>Trabajos locales de la sesión actual, del más reciente al más antiguo</caption>
        <thead><tr><th>Trabajo</th><th>Estado</th><th>Réplicas</th><th>Creado</th><th><span className="pro-sr-only">Acción</span></th></tr></thead>
        <tbody>{jobs.map(job => {
          const outcome = jobOutcome(job)
          const tone = outcome.partial ? 'partial' : job.status.toLowerCase()
          return <tr key={job.id} className={job.id === activeId ? 'is-active' : undefined}>
            <td className="mono" data-label="Trabajo">{job.id}</td>
            <td data-label="Estado"><span className={`pro-status pro-status--${tone}`}>{outcome.label}</span></td>
            <td data-label="Réplicas">{numberFormat.format(job.configuration.replicates)}</td>
            <td data-label="Creado">{formatDate(job.createdAt)}</td>
            <td data-label="Acción"><button type="button" className="pro-link-button" aria-pressed={job.id === activeId} onClick={() => onSelect(job.id)}>{job.id === activeId ? 'Seleccionado' : 'Abrir'}</button></td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </section>
}
