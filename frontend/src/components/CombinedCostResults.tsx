import type { CompareResponse, CombinedDaily } from '@/lib/api'
import { policyLabels } from '@/lib/comparison'

export const usd = (cents: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(cents / 100)
export function CombinedCostResults({ result }: { result: CompareResponse }) {
  const plan = result.configuration.intervention.combined
  if (!plan) return null
  const rows = (['none', 'random', 'targeted'] as const).map(policy => {
    const spent = result.replicates.map(rep => (rep.policies[policy].daily.at(-1) as CombinedDaily).spentCents)
    const meanSpent = spent.reduce((a, b) => a + b, 0) / spent.length
    const saved = result.summaryByPolicy.none.cumulativeInfected.mean! - result.summaryByPolicy[policy].cumulativeInfected.mean!
    return { policy, meanSpent, saved }
  })
  return <section className="results-example combined-cost-results" aria-label="Costos de intervenciones combinadas">
    <h2>Presupuesto y beneficio simulado</h2>
    <p>Presupuesto máximo por estrategia: <strong>{usd(plan.budgetCents)}</strong>. Supuestos educativos editables; importes de intervenciones, separados del gasto de AWS.</p>
    <div className="combined-table-scroll"><table><caption>Promedios entre réplicas. Contagios evitados frente a no intervenir; pueden ser negativos.</caption>
      <thead><tr><th>Estrategia</th><th>Gasto medio</th><th>Saldo medio</th><th>Contagios evitados</th><th>Costo por contagio evitado</th><th>Evitados por USD 100</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.policy}><th>{policyLabels[row.policy]}</th><td>{usd(row.meanSpent)}</td><td>{usd(plan.budgetCents - row.meanSpent)}</td><td>{row.saved.toLocaleString('es-EC', { maximumFractionDigits: 2 })}</td><td>{row.saved > 0 ? usd(row.meanSpent / row.saved) : 'No aplica'}</td><td>{row.saved > 0 && row.meanSpent > 0 ? (row.saved * 10000 / row.meanSpent).toFixed(2) : 'No aplica'}</td></tr>)}</tbody>
    </table></div>
    <p>El costo unitario divide gasto medio entre contagios evitados medios. No representa una garantía de protección individual ni una estimación sanitaria real. La recomendación principal sigue comparando infectados, no optimiza automáticamente el presupuesto.</p>
  </section>
}
