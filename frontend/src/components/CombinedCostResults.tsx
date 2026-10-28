import type { CompareResponse } from '@/lib/api'
import { policyLabels } from '@/lib/comparison'

export const usd = (cents: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(cents / 100)
export function CombinedCostResults({ result }: { result: CompareResponse }) {
  const plan = result.configuration.intervention.combined
  if (!plan) return null
  const summary = result.decisionSummary
  if (!summary) return <section className="results-example"><h2>Presupuesto y beneficio simulado</h2><p>Resumen no disponible para este experimento. Genera una nueva comparación.</p></section>
  const rows = (['none', 'random', 'targeted'] as const).map(policy => ({ policy, ...summary.policies[policy] }))
  return <section className="results-example combined-cost-results" aria-label="Costos de intervenciones combinadas">
    <h2>Presupuesto y beneficio simulado</h2>
    <p>Presupuesto máximo por estrategia: <strong>{usd(plan.budgetCents)}</strong>. Supuestos educativos editables; importes de intervenciones, separados del gasto de AWS.</p>
    <div className="combined-table-scroll"><table><caption>Promedios entre réplicas. Contagios evitados frente a no intervenir; pueden ser negativos.</caption>
      <thead><tr><th>Estrategia</th><th>Gasto medio</th><th>Saldo medio</th><th>Contagios evitados</th><th>Costo por contagio evitado</th><th>Evitados por USD 100</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.policy}><th>{policyLabels[row.policy]}</th><td>{row.spentMeanCents === null ? 'No configurado' : usd(row.spentMeanCents)}</td><td>{row.remainingMeanCents === null ? 'No configurado' : usd(row.remainingMeanCents)}</td><td>{row.avoidedVsNoneMean.toLocaleString('es-EC', { maximumFractionDigits: 2 })}</td><td>{row.costPerAvoidedCents === null ? 'No aplica' : usd(row.costPerAvoidedCents)}</td><td>{row.avoidedPer100Usd === null ? 'No aplica' : row.avoidedPer100Usd.toLocaleString('es-EC', {maximumFractionDigits: 2})}</td></tr>)}</tbody>
    </table></div>
    <p>El costo unitario divide gasto medio entre contagios evitados medios. No representa una garantía de protección individual ni una estimación sanitaria real. La recomendación principal sigue comparando infectados, no optimiza automáticamente el presupuesto.</p>
  </section>
}
