import type { CompareResponse } from '@/lib/api'
import { policyVariantLabel, triggerLabel } from '@/lib/adaptive'

const policies = ['none', 'random', 'targeted'] as const
const number = (value: number | null) => value === null ? 'No disponible' : value.toLocaleString('es-EC', {maximumFractionDigits: 2})

export function DecisionSummaryResults({ result }: { result: CompareResponse }) {
  const summary = result.decisionSummary
  const label = (policy: typeof policies[number]) => policyVariantLabel(policy, result.configuration)
  const alternative = summary?.nearestAlternative
  const omissions = summary?.policies.targeted.omissionReasons ?? null
  return <section className="results-example" aria-label="Indicadores contextualizados">
    <h2>Las tres estrategias, con la misma referencia</h2>
    <p>Promedios de {result.configuration.repetitions} repeticiones al finalizar {result.configuration.scenario.days} días. Las fracciones representan promedios, no partes de una persona.</p>
    {summary && (alternative ? <p>{summary.bestPolicies.map(label).join(', ')} tiene {number(alternative.gapMean)} infectados medios menos que la siguiente alternativa: {alternative.policies.map(label).join(', ')}. Esta diferencia no cambia el nivel de confianza indicado arriba.</p> : <p>Hay empate en la menor media: {summary.bestPolicies.map(label).join(', ')}.</p>)}
    <div className="strategy-comparison">{policies.map(policy => {
      const row = summary?.policies[policy]
      const infected = row?.infectedMean ?? result.summaryByPolicy[policy].cumulativeInfected.mean
      const avoided = row?.avoidedVsNoneMean ?? (policy === 'none' ? 0 : result.pairedComparisons.savedVsNone[policy].mean)
      const doses = row?.vaccinesAssignedMean ?? result.summaryByPolicy[policy].vaccinesAssigned.mean
      return <article className={`strategy-impact strategy-impact--${policy}`} key={policy} aria-label={label(policy)}>
        <h3>{label(policy)}{policy === 'none' && <span>Referencia sin vacunas</span>}</h3>
        <div className="strategy-impact-track" role="img" aria-label={`${number(infected)} de ${result.configuration.scenario.populationSize} personas infectadas en ${label(policy)}`}><span style={{ width: `${infected === null ? 0 : infected / result.configuration.scenario.populationSize * 100}%` }} /></div>
        <dl className="strategy-impact-metrics">
          <div><dt>Infectados acumulados</dt><dd>{number(infected)} <small>de {result.configuration.scenario.populationSize} personas{row && ` · ${number(row.infectedPopulationPercent)}%`}</small></dd></div>
          <div><dt>Contagios evitados</dt><dd>{policy === 'none' ? 'Referencia' : `${number(avoided)} personas`}<small>{policy === 'none' ? 'Las otras estrategias se comparan con esta.' : !row ? 'Frente a no intervenir.' : row.reductionVsNonePercent === null ? 'Porcentaje no aplicable: referencia igual a cero.' : `${number(row.reductionVsNonePercent)}% de reducción frente a no intervenir`}</small></dd></div>
          <div><dt>Pico de zombies</dt><dd>{number(result.summaryByPolicy[policy].peakInfectious.mean)} personas<small>Mayor cantidad infecciosa simultánea.</small></dd></div>
          <div><dt>Dosis utilizadas</dt><dd>{number(doses)} <small>{row ? `de ${row.vaccinesReceived} recibidas` : 'dosis asignadas en promedio'}</small></dd></div>
        </dl>
      </article>
    })}</div>
    <p>Las barras usan la misma escala: 0 a 100% de la población. Infectados acumulados incluye los casos iniciales; evitados compara con no intervenir. Un valor negativo significa más contagios. Una dosis utilizada no siempre resulta efectiva.</p>
    <details><summary>Motivos registrados de omisión o pausa</summary>
      {omissions === null ? <p>Esta variante no registra motivos adaptativos de omisión.</p> : <><p>Dirigida: número de días sumados entre réplicas; no representa personas ni acciones individuales. Los detalles están en el historial diario.</p>{omissions.length ? <ul>{omissions.map(row => <li key={row.reason}>{triggerLabel(row.reason)}: {row.replicateDays} días de réplica.</li>)}</ul> : <p>No se registraron omisiones o pausas en las decisiones observadas.</p>}</>}
    </details>
  </section>
}
