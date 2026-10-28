import type { CompareResponse } from '@/lib/api'
import { policyVariantLabel } from '@/lib/adaptive'
import { pairedOutcome } from '@/lib/comparison'

const number = (value: number) => value.toLocaleString('es-EC', { maximumFractionDigits: 3 })

export function PairedComparisons({ result }: { result: CompareResponse }) {
  const pairs = [
    { policy: 'random', reference: 'none', stats: result.pairedComparisons.savedVsNone.random },
    { policy: 'targeted', reference: 'none', stats: result.pairedComparisons.savedVsNone.targeted },
    { policy: 'targeted', reference: 'random', stats: result.pairedComparisons.gainVsRandom },
  ] as const
  return <section className="results-example" aria-labelledby="paired-title">
    <h2 id="paired-title">Cara a cara: ¿cuánto cambia cada estrategia?</h2>
    <p>Comparamos las estrategias en cada repetición con la misma red y los mismos sorteos. A esto lo llamamos diferencias pareadas.</p>
    <div className="paired-cards">{pairs.map(({ policy, reference, stats }) => <article className={`paired-card paired-card--${stats.mean < 0 ? 'loss' : stats.mean > 0 ? 'gain' : 'tie'}`} key={`${policy}-${reference}`}>
      <h3>{policyVariantLabel(policy, result.configuration)}<span>frente a {policyVariantLabel(reference, result.configuration)}</span></h3>
      <p className="paired-value">{number(pairedOutcome(stats.mean).magnitude)}<span>{pairedOutcome(stats.mean).label}</span></p>
      <p>{stats.mean === 0 ? 'Empatan en el promedio; las repeticiones individuales pueden diferir.' : stats.mean > 0 ? 'Mejora frente a esta referencia en el promedio observado.' : 'Resultado desfavorable frente a esta referencia en el promedio observado.'}</p>
      <details><summary>Ver variación e incertidumbre</summary>
        <p>Diferencia con signo: {number(stats.mean)}. Positivo significa menos contagios; negativo, más.</p>
        <p>Mediana: {number(stats.median)} · P05–P95: {number(stats.p05)} a {number(stats.p95)} personas.</p>
        <p>{stats.bootstrap ? `Intervalo de confianza bootstrap del 95%: ${number(stats.bootstrap.lower)} a ${number(stats.bootstrap.upper)} (${stats.bootstrap.resamples} remuestras).` : 'Sin intervalo bootstrap: se requieren al menos 30 repeticiones.'}</p>
      </details>
    </article>)}</div>
    <p>P05–P95 muestra dispersión entre repeticiones, no un intervalo de confianza. Una mejora media no garantiza ganar siempre ni cambia la confianza de la conclusión principal.</p>
  </section>
}
