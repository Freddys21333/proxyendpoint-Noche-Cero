import type { CompareResponse, Policy } from '@/lib/api'
import { policyLabels } from '@/lib/comparison'

const policies: Policy[] = ['none', 'random', 'targeted']
const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 })
const display = (value: number | null, unit: string) => value === null ? 'Sin datos' : `${number.format(value)} ${unit}`

export function PrimaryIndicators({ result }: { result: CompareResponse }) {
  const metrics = [
    { title: 'Infectados acumulados', definition: 'Personas que se infectaron alguna vez, incluidos los casos iniciales.', unit: 'personas',
      read: (policy: Policy) => result.summaryByPolicy[policy].cumulativeInfected.mean },
    { title: 'Contagios evitados', definition: 'Diferencia frente a Sin intervención. Positivo: menos infectados; negativo: más infectados.', unit: 'personas',
      read: (policy: Policy) => policy === 'none' ? null : result.pairedComparisons.savedVsNone[policy].mean },
    { title: 'Pico infeccioso', definition: 'Mayor número de zombies al mismo tiempo en cada repetición.', unit: 'personas',
      read: (policy: Policy) => result.summaryByPolicy[policy].peakInfectious.mean },
    { title: 'Dosis utilizadas', definition: 'Dosis asignadas y consumidas, incluidas las que no resultaron efectivas.', unit: 'dosis',
      read: (policy: Policy) => result.summaryByPolicy[policy].vaccinesAssigned.mean },
  ]
  return <section className="primary-indicators" aria-labelledby="primary-indicators-title">
    <h2 id="primary-indicators-title">Indicadores principales</h2>
    <p>Medias de {result.progress.replicatesSucceeded} repeticiones completadas por estrategia · {result.configuration.scenario.populationSize} personas · {result.configuration.scenario.days} días. Las medias pueden tener decimales y se redondean por separado.</p>
    <div className="primary-indicators-grid">{metrics.map(metric => <section key={metric.title}>
      <h3>{metric.title}</h3><p>{metric.definition}</p>
      <dl>{policies.map(policy => <div key={policy}><dt>{policyLabels[policy]}</dt><dd>{metric.title === 'Contagios evitados' && policy === 'none' ? 'Referencia' : display(metric.read(policy), metric.unit)}</dd></div>)}</dl>
    </section>)}</div>
  </section>
}
