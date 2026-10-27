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
        <h2 id="pro-history-title">Trabajos de esta sesión</h2>
        <p>Credenciales guardadas en <span className="mono">sessionStorage</span>; se pierden al cerrar la pestaña.</p>
      </div>
      <span className="pro-badge pro-badge--muted">{jobs.length} {jobs.length === 1 ? 'trabajo' : 'trabajos'}</span>
    </div>
    {jobs.length === 0
      ? <p className="pro-history-empty" role="status">Todavía no hay trabajos en esta sesión. Crea uno con el formulario.</p>
      : <div className="pro-table-scroll">
        <table>
          <caption>Trabajos creados en esta sesión, del más reciente al más antiguo</caption>
          <thead><tr><th scope="col">Trabajo</th><th scope="col">Estado</th><th scope="col">Réplicas</th><th scope="col">Creado</th><th scope="col"><span className="pro-sr-only">Acción</span></th></tr></thead>
          <tbody>{jobs.map(job => {
            const outcome = jobOutcome(job)
            const tone = outcome.partial ? 'partial' : job.status.toLowerCase()
            return <tr key={job.id} className={job.id === activeId ? 'is-active' : undefined}>
              <td className="mono" data-label="Trabajo">{job.id.slice(0, 8)}</td>
              <td data-label="Estado"><span className={`pro-status pro-status--${tone}`}>{outcome.label}</span></td>
              <td data-label="Réplicas">{numberFormat.format(job.configuration.repetitions)}</td>
              <td data-label="Creado">{formatDate(job.createdAt)}</td>
              <td data-label="Acción"><button type="button" className="pro-link-button" aria-pressed={job.id === activeId} onClick={() => onSelect(job.id)}>{job.id === activeId ? 'Seleccionado' : 'Abrir'}</button></td>
            </tr>
          })}</tbody>
        </table>
      </div>}
  </section>
}
