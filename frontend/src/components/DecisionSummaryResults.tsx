import type { CompareResponse } from '@/lib/api'
import { policyVariantLabel, triggerLabel } from '@/lib/adaptive'

const policies = ['none', 'random', 'targeted'] as const
const number = (value: number) => value.toLocaleString('es-EC', {maximumFractionDigits: 2})

export function DecisionSummaryResults({ result }: { result: CompareResponse }) {
  const summary = result.decisionSummary
  if (!summary) return <p>Resumen contextual no disponible para este experimento. Genera una nueva comparación.</p>
  const label = (policy: typeof policies[number]) => policyVariantLabel(policy, result.configuration)
  const alternative = summary.nearestAlternative
  const omissions = summary.policies.targeted.omissionReasons
  return <section className="results-example" aria-label="Indicadores contextualizados">
    <h2>Impacto y recursos del escenario</h2>
    <p>Promedios al finalizar {result.configuration.scenario.days} días, sobre {result.configuration.scenario.populationSize} personas sintéticas.</p>
    {alternative ? <p>{summary.bestPolicies.map(label).join(', ')} tiene {number(alternative.gapMean)} infectados medios menos que la siguiente alternativa: {alternative.policies.map(label).join(', ')}. Esta diferencia no cambia el nivel de confianza indicado arriba.</p> : <p>Hay empate en la menor media: {summary.bestPolicies.map(label).join(', ')}.</p>}
    <div className="comparison-table-scroll"><table>
      <caption>Impacto frente a no intervenir y dosis usadas frente a recibidas</caption>
      <thead><tr><th>Estrategia</th><th>Infectados / población</th><th>Contagios evitados</th><th>Reducción relativa</th><th>Dosis usadas / recibidas</th></tr></thead>
      <tbody>{policies.map(policy => { const row = summary.policies[policy]; return <tr key={policy}><th scope="row">{label(policy)}</th><td>{number(row.infectedMean)} de {result.configuration.scenario.populationSize} ({number(row.infectedPopulationPercent)}%)</td><td>{number(row.avoidedVsNoneMean)}</td><td>{row.reductionVsNonePercent === null ? 'No aplica' : `${number(row.reductionVsNonePercent)}%`}</td><td>{number(row.vaccinesAssignedMean)} / {row.vaccinesReceived}</td></tr> })}</tbody>
    </table></div>
    <p>Los valores negativos indican más contagios que sin intervención. El porcentaje no aplica cuando la referencia es cero.</p>
    <details><summary>Motivos registrados de omisión o pausa</summary>
      {omissions === null ? <p>Esta variante no registra motivos adaptativos de omisión.</p> : <><p>Dirigida: número de días sumados entre réplicas; no representa personas ni acciones individuales. Los detalles están en el historial diario.</p>{omissions.length ? <ul>{omissions.map(row => <li key={row.reason}>{triggerLabel(row.reason)}: {row.replicateDays} días de réplica.</li>)}</ul> : <p>No se registraron omisiones o pausas en las decisiones observadas.</p>}</>}
    </details>
  </section>
}
