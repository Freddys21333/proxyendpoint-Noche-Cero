import type { CompareResponse } from '@/lib/api'
import { adaptiveEnabled, adaptiveSummary, decisionRows, policyVariantLabel, triggerLabel } from '@/lib/adaptive'
import { vaccinationContexts } from '@/lib/vaccination'
import './adaptive.css'

const percent = new Intl.NumberFormat('es-EC', { style: 'percent', maximumFractionDigits: 2 })
const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 0 })
const times = (count: number) => `${number.format(count)} ${count === 1 ? 'vez' : 'veces'}`

export function AdaptiveDecisionsPanel({ result }: { result: CompareResponse }) {
  const strategy = result.configuration.intervention.combined?.adaptiveStrategy
  if (!strategy) return null
  const enabled = adaptiveEnabled(result.configuration)
  const replica = result.replicates[result.representative.index] ?? result.replicates[0]
  const rows = decisionRows(replica?.policies.targeted.daily)
  const summary = adaptiveSummary(rows)
  const omissions = summary.omissions.reduce((total, item) => total + item.count, 0)

  return <section className="results-example adaptive-decisions" aria-labelledby="adaptive-decisions-title">
    <h2 id="adaptive-decisions-title">Política adaptativa · decisiones diarias</h2>
    <p><span className="adaptive-badge">{policyVariantLabel('targeted', result.configuration)}</span> Cierre desde {percent.format(strategy.closureInfectionThreshold)} de I/N · reapertura por debajo de {percent.format(strategy.reopenInfectionThreshold)} · anillo {strategy.ringVaccinationPriority ? 'activo' : 'inactivo'}.</p>
    <p>Historial de la réplica representativa {result.representative.index}. Solo se muestran días registrados por el motor; el cliente no reconstruye ni completa decisiones.</p>

    {!enabled && <p className="adaptive-note" role="status">Reglas desactivadas: el backend ejecutó las acciones fijas de Dirigida y no registró decisiones adaptativas.</p>}
    {enabled && rows.length === 0 && <p className="adaptive-note" role="status">El backend no registró decisiones adaptativas para la réplica representativa de este experimento.</p>}

    {rows.length > 0 && <>
      <ul className="adaptive-summary">
        <li>Días con decisiones registradas: {number.format(summary.days)}</li>
        <li>Cierre pagado y aplicado: {number.format(summary.closureDays)} días; solicitado por umbral {times(summary.closureRequests)}, sin ejecutar {number.format(summary.closureRequestsNotExecuted)}.</li>
        <li>Brigadas en pausa por I=0: {number.format(summary.brigadeHoldDays)} días.</li>
        <li>Prioridad de anillo aplicada: {number.format(summary.ringDays)} días.</li>
        <li>Acciones omitidas por límites: {number.format(omissions)}. {summary.omissions.length ? summary.omissions.map(item => `${item.label} (${item.count})`).join(' · ') : 'Ninguna.'}</li>
      </ul>
      <div className="adaptive-table-scroll"><table>
        <caption>Decisiones y acciones ejecutadas de la réplica representativa. Las curvas del experimento son medias entre réplicas.</caption>
        <thead><tr><th scope="col">Día</th><th scope="col">I/N observado</th><th scope="col">Cierre</th><th scope="col">Brigadas</th><th scope="col">Anillo</th><th scope="col">Motivos registrados</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.day}>
          <th scope="row">{row.day}</th>
          <td>{percent.format(row.infectiousFraction)}</td>
          <td>{row.closedContext ? `Activo · ${vaccinationContexts[row.closedContext] ?? row.closedContext}`
            : row.closureActive ? 'Activo'
              : row.triggers.includes('closure_triggered_by_threshold') ? 'Solicitado, no ejecutado' : 'No'}</td>
          <td>{row.brigadesAllowed ? `Permitidas${row.brigadesActive ? ` · ${number.format(row.brigadesActive)} atendidas` : ''}` : 'En pausa'}</td>
          <td>{row.ringVaccinationActive ? 'Sí' : 'No'}</td>
          <td>{row.triggers.length ? <ul className="adaptive-triggers">{row.triggers.map(trigger => <li key={trigger}>{triggerLabel(trigger)}</li>)}</ul> : '—'}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="table-scroll-hint">Desliza horizontalmente para ver todos los motivos.</p>
      <p className="adaptive-limits">Un cierre solicitado por umbral no implica que se pagara: exige saldo, contactos activos de la capa y un intervalo dentro del horizonte. Brigadas permitidas no equivalen a atenciones; la columna muestra las personas efectivamente atendidas. Este historial no demuestra efectividad epidemiológica ni sustituye la comparación entre políticas.</p>
    </>}
  </section>
}
