import type { CompareResponse, Policy, Stats } from './api.ts'
import { policyLabels } from './comparison.ts'

const policies: Policy[] = ['none', 'random', 'targeted']
const number = (value: number | null | undefined) => value == null
  ? 'No disponible'
  : new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(value)
const money = (cents: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(cents / 100)
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

function statsRow(label: string, stats: Stats): string {
  return `<tr><th scope="row">${escapeHtml(label)}</th><td>${number(stats.mean)}</td><td>${number(stats.median)}</td><td>${number(stats.p05)}–${number(stats.p95)}</td><td>${stats.n}</td></tr>`
}

function meanObservedSpend(result: CompareResponse, policy: Policy): number | null {
  const values = result.replicates.map(replicate => {
    const rows = replicate.policies[policy].daily
    const last = rows.at(-1)
    if (!last || typeof last !== 'object' || !('spentCents' in last) || typeof last.spentCents !== 'number') return null
    return last.spentCents
  })
  if (values.some(value => value === null) || values.length === 0) return null
  return (values as number[]).reduce((total, value) => total + value, 0) / values.length
}

function pairSummary(label: string, mean: number, p05: number, p95: number, bootstrap: CompareResponse['pairedComparisons']['gainVsRandom']['bootstrap']): string {
  const interval = bootstrap
    ? `Intervalo bootstrap del 95%: ${number(bootstrap.lower)} a ${number(bootstrap.upper)}.`
    : 'No hay intervalo bootstrap: el informe conserva la comparación descriptiva de las réplicas disponibles.'
  return `<li><strong>${escapeHtml(label)}:</strong> ${number(mean)} infectados de diferencia media; rango empírico P05–P95 de ${number(p05)} a ${number(p95)}. ${interval}</li>`
}

export function buildMayorReportHtml(result: CompareResponse): string {
  const { configuration, manifest, summaryByPolicy, pairedComparisons, recommendation } = result
  const { scenario, intervention } = configuration
  const sampleSize = result.progress.replicatesSucceeded
  const comparisonText = recommendation.winner === 'tie'
    ? 'Las medias observadas empatan. Este informe no propone una estrategia ganadora.'
    : `La menor media observada corresponde a ${policyLabels[recommendation.winner]}. Es un resultado de este conjunto de réplicas, no una garantía para otros escenarios.`
  const confidenceText = recommendation.confidence === 'supported'
    ? 'La respuesta del motor marca esta diferencia como respaldada por estas réplicas; revise también el intervalo y los resultados por semilla.'
    : recommendation.confidence === 'inconclusive'
      ? 'La respuesta del motor indica que la incertidumbre no queda resuelta.'
      : 'La comparación es descriptiva y no estima una conclusión inferencial.'
  const rows = policies.map(policy => statsRow(policyLabels[policy], summaryByPolicy[policy].cumulativeInfected)).join('')
  const comparisons = [
    pairSummary('Aleatoria frente a no intervenir', pairedComparisons.savedVsNone.random.mean, pairedComparisons.savedVsNone.random.p05, pairedComparisons.savedVsNone.random.p95, pairedComparisons.savedVsNone.random.bootstrap),
    pairSummary('Dirigida frente a no intervenir', pairedComparisons.savedVsNone.targeted.mean, pairedComparisons.savedVsNone.targeted.p05, pairedComparisons.savedVsNone.targeted.p95, pairedComparisons.savedVsNone.targeted.bootstrap),
    pairSummary('Dirigida frente a aleatoria', pairedComparisons.gainVsRandom.mean, pairedComparisons.gainVsRandom.p05, pairedComparisons.gainVsRandom.p95, pairedComparisons.gainVsRandom.bootstrap),
  ].join('')
  const budget = intervention.combined ? `<section><h2>Recursos y presupuesto del escenario</h2><p>Presupuesto máximo educativo por estrategia: <strong>${money(intervention.combined.budgetCents)}</strong>. Es un supuesto de la simulación. No es el gasto operativo real del sistema ni incluye AWS.</p><table><caption>Gasto de intervención medio reportado por las réplicas</caption><thead><tr><th>Estrategia</th><th>Gasto medio</th><th>Saldo medio estimado</th></tr></thead><tbody>${policies.map(policy => {
    const spend = meanObservedSpend(result, policy)
    return `<tr><th scope="row">${policyLabels[policy]}</th><td>${spend === null ? 'No disponible' : money(spend)}</td><td>${spend === null ? 'No disponible' : money(intervention.combined!.budgetCents - spend)}</td></tr>`
  }).join('')}</tbody></table><p>Los costos unitarios y los efectos son educativos, configurados para el escenario. No son costos sanitarios observados.</p></section>` : '<section><h2>Recursos y presupuesto</h2><p>Este escenario no configuró un presupuesto combinado de intervención. No se reporta gasto operativo real.</p></section>'
  const limitations = [...recommendation.limitations, 'El escenario usa una población sintética y una plaga ficticia. No representa dengue real ni predice brotes.', 'Los resultados describen las réplicas incluidas y pueden variar con otros escenarios o semillas.'].filter((item, index, all) => all.indexOf(item) === index)
  const list = (values: string[]) => values.length ? `<ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>` : '<p>No se registraron límites adicionales en la respuesta del motor.</p>'
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Informe del escenario ficticio</title>
<style>
  :root{color-scheme:light;font-family:Arial,Helvetica,sans-serif;color:#17201d;background:#fff}body{max-width:900px;margin:0 auto;padding:40px 48px;line-height:1.5}header{border-bottom:3px solid #175b50;padding-bottom:18px}h1{font-size:30px;margin:0 0 8px}h2{font-size:19px;margin:28px 0 8px;color:#175b50}.label{display:inline-block;background:#fff1d6;border:1px solid #8d5b00;padding:5px 9px;font-weight:700;font-size:12px;letter-spacing:.04em}.lead{font-size:18px;font-weight:600}.meta{color:#47534e;font-size:13px}table{width:100%;border-collapse:collapse;margin:12px 0 18px;font-size:14px}th,td{border:1px solid #aebbb5;padding:8px;text-align:left}thead{background:#edf3f0}caption{text-align:left;font-weight:700;padding:6px 0}li{margin:5px 0}.hash{overflow-wrap:anywhere;font-family:monospace;font-size:12px}.print{border:0;background:#175b50;color:white;padding:10px 14px;font-size:15px;border-radius:4px;cursor:pointer;margin:0 0 22px}.footer{border-top:1px solid #aebbb5;margin-top:26px;padding-top:12px;font-size:12px;color:#47534e}@media print{body{max-width:none;padding:12mm 14mm}.print{display:none}h2{break-after:avoid}table,section{break-inside:avoid}a{color:inherit}}
</style></head><body>
<button class="print" type="button" onclick="window.print()">Imprimir o guardar como PDF</button>
<header><span class="label">ESCENARIO FICTICIO · USO EDUCATIVO</span><h1>Informe de resultados</h1><p>Resumen para revisión del comité y autoridades locales.</p></header>
<section><h2>Qué muestra esta simulación</h2><p class="lead">${escapeHtml(comparisonText)}</p><p>${escapeHtml(confidenceText)}</p><p>Se compararon ${sampleSize} réplicas pareadas. Cada política recibió los mismos parámetros, red y condiciones iniciales.</p></section>
<section><h2>Resultados de infectados acumulados</h2><table><caption>Resumen entre réplicas; no es el resultado de una sola corrida</caption><thead><tr><th>Estrategia</th><th>Media</th><th>Mediana</th><th>Rango empírico P05–P95</th><th>Réplicas</th></tr></thead><tbody>${rows}</tbody></table><p>Una diferencia negativa en las comparaciones pareadas significa que la estrategia comparada registró más infectados que su referencia. Los empates y las pérdidas permanecen dentro del resumen.</p><ul>${comparisons}</ul></section>
${budget}
<section><h2>Parámetros del escenario</h2><ul><li>Población sintética: ${scenario.populationSize} personas.</li><li>Duración simulada: ${scenario.days} ${scenario.days === 1 ? 'día' : 'días'}.</li><li>Casos iniciales: ${scenario.initialInfectious}.</li><li>Réplicas solicitadas: ${configuration.repetitions}; semilla raíz: ${configuration.rootSeed}.</li><li>Modelo: ${escapeHtml(manifest.engineVersion)}.</li></ul></section>
<section><h2>Límites de interpretación</h2>${list(limitations)}</section>
<footer class="footer"><p>Hash del experimento: <span class="hash">${escapeHtml(manifest.experimentHash)}</span></p><p>Build ${escapeHtml(manifest.buildCommit)} · Esquema ${escapeHtml(manifest.schemaVersion)} · Fecha de resultado ${escapeHtml(result.generatedAt)}.</p><p>Las cifras se transcriben de la respuesta validada del motor. El informe no modifica el experimento.</p></footer>
</body></html>`
}
