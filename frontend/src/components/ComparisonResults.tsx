import { useState } from 'react'
import type { CompareResponse, CurveMetric, Metric, Stats } from '@/lib/api'
import { metricLabels, policyLabels } from '@/lib/comparison'
import { policyVariantLabel } from '@/lib/adaptive'
import ComparisonChart from './ComparisonChart'
import { CombinedCostResults } from './CombinedCostResults'
import { AdaptiveDecisionsPanel } from './AdaptiveDecisionsPanel'
import { MayorReportDownload } from './MayorReportDownload'
import { DecisionSummaryResults } from './DecisionSummaryResults'
import { PairedComparisons } from './PairedComparisons'

const policies = ['none', 'random', 'targeted'] as const
const metricNames: Record<Metric, string> = { cumulativeInfected: 'Infectados acumulados', peakInfectious: 'Pico de Zombies', peakDay: 'Primer día del pico', finalInfectious: 'Zombies al final', outbreakDuration: 'Día de extinción', vaccinesAssigned: 'Dosis asignadas', vaccinesEffective: 'Dosis efectivas', vaccinesUnused: 'Dosis sin usar' }
const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('es-EC', { maximumFractionDigits: 3 }).format(value)
const confidence = { descriptive: 'Comparación descriptiva', inconclusive: 'Incertidumbre no resuelta', supported: 'Ventaja respaldada por estas réplicas' }

export function ComparisonResults({ result, region, onExport, onExportCsv }: { result: CompareResponse; region?: string; onExport: () => void; onExportCsv: () => void }) {
  const [curve, setCurve] = useState<CurveMetric>('cumulativeInfected')
  const [metric, setMetric] = useState<Metric>('cumulativeInfected')
  const rec = result.recommendation
  const labels = { ...policyLabels, targeted: policyVariantLabel('targeted', result.configuration) }
  return <>
    <div className="results-heading"><h1 id="results-title">¿Qué estrategia reduce más los contagios?</h1><p>{result.configuration.scenario.populationSize} personas sintéticas · {result.configuration.scenario.days} días · {result.configuration.repetitions} repeticiones con el mismo escenario</p><a className="plain-action" href="#result-downloads">Descargar resultados</a></div>
    <section className="results-example" aria-label="Recomendación del experimento">
      <h2>{rec.winner === 'tie' ? 'Empate en la media de infectados' : `Menor media de infectados: ${labels[rec.winner]}`}</h2>
      <p>{confidence[rec.confidence]}</p>
      <p>Objetivo: reducir el promedio de personas que se infectan durante la simulación.</p>
      <p className="results-conclusion">{result.decisionSummary?.conclusion?.replace("no incluyen el daño de los contagios ni AWS.", "no incluyen el daño de los contagios.").replace("no precios sanitarios ni gastos AWS.", "no precios sanitarios reales.") ?? 'La conclusión se basa en contagios medios. Para añadir la explicación económica del backend, genera una comparación nueva con la versión actual de la API.'}</p>
      {rec.confidence !== 'supported' && <p>La menor media no demuestra por sí sola una ventaja consistente. No hay evidencia suficiente para recomendar una única estrategia con confianza.</p>}
      <details><summary>Por qué se obtuvo esta conclusión</summary><ul>{rec.reasons.map((reason, i) => <li key={i}>{reason.replaceAll('targeted', 'Dirigida').replaceAll('random', 'Aleatoria').replaceAll('none', 'Sin intervención')}</li>)}</ul></details>
      <p>Simulación educativa; no es una predicción sanitaria real.</p>
    </section>
    <DecisionSummaryResults result={result} />
    <CombinedCostResults result={result} />
    <PairedComparisons result={result} />
    <section className="results-example" aria-label="Curvas reales del experimento">
      <h2>¿Cómo cambia el brote con los días?</h2>
      <label>Estado o métrica de la curva <select aria-label="Métrica de la curva" value={curve} onChange={event => setCurve(event.target.value as CurveMetric)}>{Object.entries(metricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <p>{curve === 'cumulativeInfected' ? 'Personas que se han infectado hasta cada día, incluidos los casos iniciales. Una línea más baja indica menos contagios.' : 'Personas en el estado seleccionado en cada día; no equivale al total acumulado de contagios.'} Las líneas muestran el promedio y las bandas la variación P05–P95 entre repeticiones, no un intervalo de confianza.</p>
      <ComparisonChart result={result} metric={curve} />
    </section>
    <section id="result-downloads" className="results-example results-downloads" aria-labelledby="result-downloads-title">
      <h2 id="result-downloads-title">Descargar resultados</h2>
      <MayorReportDownload result={result} />
      <div className="export-downloads"><button type="button" className="plain-action" onClick={onExport}>Descargar experimento (JSON)</button><button type="button" className="plain-action" onClick={onExportCsv}>Descargar tablas (ZIP con CSV)</button></div>
      <p>PDF y HTML: informe para compartir. JSON: experimento completo para reproducir. ZIP: tablas CSV y eventos de la repetición representativa.</p>
    </section>
    <details className="chart-table"><summary>Ver estadísticas y detalles del experimento</summary>
    <h2>Métricas por estrategia</h2><div className="comparison-table-scroll"><table>
      <caption>Medias del experimento. La extinción usa solo réplicas con E+I=0; las demás están censuradas.</caption>
      <thead><tr><th>Estrategia</th>{Object.values(metricNames).map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{policies.map(policy => <tr key={policy}><th scope="row">{labels[policy]}</th>{(Object.keys(metricNames) as Metric[]).map(key => <td key={key}>{number(result.summaryByPolicy[policy][key].mean)}</td>)}</tr>)}</tbody>
    </table></div><p className="table-scroll-hint">Desliza horizontalmente para ver todas las columnas.</p>
    <section className="results-example"><label>Estadística detallada <select aria-label="Métrica de estadísticas" value={metric} onChange={event => setMetric(event.target.value as Metric)}>{Object.entries(metricNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <div className="comparison-table-scroll"><table><caption>{metricNames[metric]} · n efectivo y dispersión entre réplicas</caption><thead><tr><th>Estrategia</th><th>n</th><th>Media</th><th>Mediana</th><th>P05</th><th>P95</th></tr></thead><tbody>{policies.map(policy => {
        const stats: Stats = result.summaryByPolicy[policy][metric]
        return <tr key={policy}><th scope="row">{labels[policy]}</th><td>{stats.n}</td><td>{number(stats.mean)}</td><td>{number(stats.median)}</td><td>{number(stats.p05)}</td><td>{number(stats.p95)}</td></tr>
      })}</tbody></table></div><p className="table-scroll-hint">Desliza horizontalmente para ver todas las columnas.</p>
    </section>
    <AdaptiveDecisionsPanel result={result} />
    <section className="results-example"><h2>Reproducibilidad y límites</h2><p>Semilla {result.configuration.rootSeed} · Motor {result.engineVersion} · Schema {result.schemaVersion} · Build {result.manifest.buildCommit} · Región configurada {region ?? 'no disponible'}</p><p className="experiment-hash">{result.manifest.experimentHash}</p><p>{result.generatedAt}</p><ul>{rec.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul></section>
    </details>
  </>
}
