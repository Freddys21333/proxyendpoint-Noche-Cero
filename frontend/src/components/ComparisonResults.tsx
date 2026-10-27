import { useState } from 'react'
import type { CompareResponse, CurveMetric, Metric, Stats } from '@/lib/api'
import { metricLabels, policyLabels } from '@/lib/comparison'
import { policyVariantLabel } from '@/lib/adaptive'
import ComparisonChart from './ComparisonChart'
import { CombinedCostResults } from './CombinedCostResults'
import { AdaptiveDecisionsPanel } from './AdaptiveDecisionsPanel'

const policies = ['none', 'random', 'targeted'] as const
const metricNames: Record<Metric, string> = { cumulativeInfected: 'Infectados acumulados', peakInfectious: 'Pico de Zombies', peakDay: 'Primer día del pico', finalInfectious: 'Zombies al final', outbreakDuration: 'Día de extinción', vaccinesAssigned: 'Dosis asignadas', vaccinesEffective: 'Dosis efectivas', vaccinesUnused: 'Dosis sin usar' }
const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('es-EC', { maximumFractionDigits: 3 }).format(value)
const confidence = { descriptive: 'Comparación descriptiva', inconclusive: 'Incertidumbre no resuelta', supported: 'Ventaja respaldada por estas réplicas' }

export function ComparisonResults({ result, region, onExport, onExportCsv }: { result: CompareResponse; region?: string; onExport: () => void; onExportCsv: () => void }) {
  const [curve, setCurve] = useState<CurveMetric>('i')
  const [metric, setMetric] = useState<Metric>('cumulativeInfected')
  const rec = result.recommendation
  const labels = { ...policyLabels, targeted: policyVariantLabel('targeted', result.configuration) }
  const comparisons = [
    ['Salvados: aleatoria frente a no intervenir', result.pairedComparisons.savedVsNone.random],
    ['Salvados: dirigida frente a no intervenir', result.pairedComparisons.savedVsNone.targeted],
    ['Mejora: dirigida frente a aleatoria', result.pairedComparisons.gainVsRandom],
  ] as const
  return <>
    <CombinedCostResults result={result} />
    <div className="results-heading"><h1 id="results-title">Comparación de estrategias</h1><p>Experimento real · {result.configuration.repetitions} réplicas · {result.configuration.scenario.populationSize} personas · {result.configuration.scenario.days} días · Semilla {result.configuration.rootSeed}</p></div>
    <section className="results-example" aria-label="Recomendación del experimento">
      <h2>{rec.winner === 'tie' ? 'Empate en la media de infectados' : `Menor media de infectados: ${labels[rec.winner]}`}</h2>
      <p>{confidence[rec.confidence]}</p>
      <ul>{rec.reasons.map((reason, i) => <li key={i}>{reason.replaceAll('targeted', 'Dirigida').replaceAll('random', 'Aleatoria').replaceAll('none', 'Sin intervención')}</li>)}</ul>
    </section>
    <section className="results-example" aria-label="Curvas reales del experimento">
      <label>Estado o métrica de la curva <select aria-label="Métrica de la curva" value={curve} onChange={event => setCurve(event.target.value as CurveMetric)}>{Object.entries(metricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <p>Líneas: media entre réplicas. Bandas: P05–P95, rango empírico; no es un intervalo de confianza.</p>
      <ComparisonChart result={result} metric={curve} />
    </section>
    <details className="chart-table" open><summary>Métricas por estrategia: medias</summary><div><table>
      <caption>Medias del experimento. La extinción usa solo réplicas con E+I=0; las demás están censuradas.</caption>
      <thead><tr><th>Estrategia</th>{Object.values(metricNames).map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{policies.map(policy => <tr key={policy}><th scope="row">{labels[policy]}</th>{(Object.keys(metricNames) as Metric[]).map(key => <td key={key}>{number(result.summaryByPolicy[policy][key].mean)}</td>)}</tr>)}</tbody>
    </table></div><p className="table-scroll-hint">Desliza horizontalmente para ver todas las columnas.</p></details>
    <section className="results-example"><label>Estadística detallada <select aria-label="Métrica de estadísticas" value={metric} onChange={event => setMetric(event.target.value as Metric)}>{Object.entries(metricNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <div className="comparison-table-scroll"><table><caption>{metricNames[metric]} · n efectivo y dispersión entre réplicas</caption><thead><tr><th>Estrategia</th><th>n</th><th>Media</th><th>Mediana</th><th>P05</th><th>P95</th></tr></thead><tbody>{policies.map(policy => {
        const stats: Stats = result.summaryByPolicy[policy][metric]
        return <tr key={policy}><th scope="row">{labels[policy]}</th><td>{stats.n}</td><td>{number(stats.mean)}</td><td>{number(stats.median)}</td><td>{number(stats.p05)}</td><td>{number(stats.p95)}</td></tr>
      })}</tbody></table></div><p className="table-scroll-hint">Desliza horizontalmente para ver todas las columnas.</p>
    </section>
    <section className="results-example"><h2>Diferencias pareadas</h2><p>Valores negativos indican que la estrategia evaluada perdió frente a su referencia.</p>
      {comparisons.map(([label, comp]) => <div key={label}><h3>{label}</h3><p>Media {number(comp.mean)} · Mediana {number(comp.median)} · P05–P95 {number(comp.p05)} a {number(comp.p95)}</p><p>{comp.bootstrap ? `IC bootstrap 95%: ${number(comp.bootstrap.lower)} a ${number(comp.bootstrap.upper)} · ${comp.bootstrap.resamples} remuestras` : 'Sin IC bootstrap: requiere 30 réplicas.'}</p></div>)}
      <p>Dirigida supera a aleatoria en {number(result.pairedComparisons.targetedWinRateVsRandom * 100)}% de las réplicas; a no intervenir en {number(result.pairedComparisons.targetedWinRateVsNone * 100)}%.</p>
    </section>
    <AdaptiveDecisionsPanel result={result} />
    <section className="results-example"><h2>Reproducibilidad y límites</h2><p>Motor {result.engineVersion} · Schema {result.schemaVersion} · Build {result.manifest.buildCommit} · Región configurada {region ?? 'no disponible'}</p><p className="experiment-hash">{result.manifest.experimentHash}</p><p>{result.generatedAt}</p><ul>{rec.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul><div className="export-downloads"><button type="button" className="plain-action" onClick={onExport}>Descargar experimento JSON</button><button type="button" className="plain-action" onClick={onExportCsv}>Descargar ZIP con CSV</button></div><p>CSV para análisis; JSON para reproducir. Los eventos del ZIP corresponden solo a la réplica representativa.</p></section>
  </>
}
