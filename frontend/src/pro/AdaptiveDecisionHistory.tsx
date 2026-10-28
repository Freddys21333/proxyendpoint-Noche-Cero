import { useState } from 'react'
import type { CompareResponse } from '../lib/api.ts'
import { adaptiveDecisionRows, adaptiveTriggerLabel } from './adaptive-decisions.ts'

const percent = new Intl.NumberFormat('es-EC', { style: 'percent', maximumFractionDigits: 2 })
const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

export function AdaptiveDecisionHistory({ result }: { result: CompareResponse }) {
  const strategy = result.configuration.intervention.combined?.adaptiveStrategy
  const replicateOptions = result.replicates.map(row => row.index)
  const [replicateIndex, setReplicateIndex] = useState(result.representative.index)
  if (!strategy) return null
  const selectedIndex = replicateOptions.includes(replicateIndex) ? replicateIndex : (replicateOptions[0] ?? -1)
  const rows = adaptiveDecisionRows(result, selectedIndex)

  return <section className="results-example adaptive-history" aria-labelledby="adaptive-history-title">
    <div className="adaptive-history-heading">
      <div><h2 id="adaptive-history-title">Historial de decisiones adaptativas</h2>
        <p>Variante {strategy.modelVersion} · política Dirigida · registros del backend para una réplica real.</p></div>
      <label>Réplica <select aria-label="Réplica del historial adaptativo" value={selectedIndex} onChange={event => setReplicateIndex(Number(event.target.value))}>
        {replicateOptions.map(index => <option key={index} value={index}>{index + 1}</option>)}
      </select></label>
    </div>
    <p>Umbral de cierre {percent.format(strategy.closureInfectionThreshold)} · reapertura {percent.format(strategy.reopenInfectionThreshold)} · anillo {strategy.ringVaccinationPriority ? 'habilitado' : 'deshabilitado'}.</p>
    {!strategy.enabled && <p role="note">La variante está desactivada; se muestran las decisiones registradas por la configuración, sin aplicar reglas adaptativas.</p>}
    {rows.length === 0 ? <p role="status">Esta respuesta no contiene registros adaptativos válidos para la réplica seleccionada.</p> : <div className="comparison-table-scroll">
      <table>
        <caption>Decisiones diarias de la política Dirigida; la fracción infecciosa usa el estado observado ese día.</caption>
        <thead><tr><th scope="col">Día</th><th scope="col">S / E / I / R</th><th scope="col">Infecciosos</th><th scope="col">Vacunación</th><th scope="col">Cierre</th><th scope="col">Brigadas</th><th scope="col">Prioridad anillo</th><th scope="col">Saldo</th><th scope="col">Motivos registrados</th></tr></thead>
        <tbody>{rows.map(row => {
          const decision = row.adaptiveDecisions
          const closure = decision.closureActive === null ? 'No aplica' : decision.closureActive ? `Activo${row.closedContext ? ` · ${row.closedContext}` : ''}` : 'Inactivo'
          const brigades = decision.brigadesAllowed ? `Permitidas${row.brigadesActive === undefined ? '' : ` · ${row.brigadesActive} atendidas`}` : 'Pausadas'
          const reasons = decision.triggers.length ? decision.triggers.map(adaptiveTriggerLabel) : ['Sin motivos adicionales registrados.']
          return <tr key={row.day}>
            <th scope="row">{row.day}</th><td>{row.s} / {row.e} / {row.i} / {row.r}</td>
            <td>{percent.format(decision.infectiousFraction)}</td><td>{row.vaccinesAssigned} asignadas · {row.vaccinesEffective} efectivas</td><td>{closure}</td><td>{brigades}</td>
            <td>{decision.ringVaccinationActive ? 'Activa' : 'Inactiva'}</td>
            <td>{row.budgetRemainingCents === undefined ? '—' : money.format(row.budgetRemainingCents / 100)}</td>
            <td><ul>{reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></td>
          </tr>
        })}</tbody>
      </table>
    </div>}
    <p>Este historial describe reglas educativas y acciones observadas; no implica predicción ni recomendación sanitaria real.</p>
  </section>
}
