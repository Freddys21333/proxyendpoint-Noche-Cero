import type { CompareResponse, Policy } from './api.ts'
import { policyLabels } from './comparison.ts'
import { gzipSync, strToU8 } from 'fflate'

export async function fetchMayorReport(result: CompareResponse, signal?: AbortSignal, fetcher: typeof fetch = fetch, baseUrl = '/v1'): Promise<Blob> {
  let response: Response
  try {
    response = await fetcher(`${baseUrl.replace(/\/+$/, '')}/reports/mayor`, {
      method: 'POST', credentials: 'omit', signal,
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', Accept: 'application/pdf' },
      body: new Blob([new Uint8Array(gzipSync(strToU8(JSON.stringify(result))))]),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('No se pudo conectar para generar el informe. Intenta nuevamente.')
  }
  if (!response.ok) {
    let message = 'No se pudo generar el informe. Intenta nuevamente.'
    try {
      const data = await response.json()
      if (typeof data?.error?.message === 'string') message = data.error.message
    } catch { /* A proxy may return a non-JSON failure. */ }
    throw new Error(message)
  }
  if (response.headers.get('Content-Type')?.split(';')[0] !== 'application/pdf') throw new Error('El servidor no devolvió un PDF válido.')
  const blob = await response.blob()
  if (blob.size > 5_242_880 || await blob.slice(0, 5).text() !== '%PDF-') throw new Error('El servidor no devolvió un PDF válido.')
  return blob
}

const policies: Policy[] = ['none', 'random', 'targeted']
const number = (value: number | null | undefined) => value == null ? 'No disponible' : new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(value)
const money = (cents: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(cents / 100)
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)

export interface MayorReportOptions { autoPrint?: boolean }

/** Resumen autocontenido; usa agregados existentes, sin calcular finanzas ni confianza. */
export function buildMayorReportHtml(result: CompareResponse, options: MayorReportOptions = {}): string {
  const { configuration, manifest, summaryByPolicy: stats, pairedComparisons: paired, recommendation: rec } = result
  const { scenario, intervention } = configuration
  const comparisonText = rec.winner === 'tie'
    ? 'Las estrategias empatan en el promedio de contagios. No hay una única opción ganadora.'
    : `${policyLabels[rec.winner]} tuvo el menor promedio de personas contagiadas en este ejercicio.`
  const confidenceText = rec.confidence === 'supported'
    ? 'La ventaja está respaldada por estas repeticiones. No garantiza el mismo resultado en otro escenario.'
    : 'No hay evidencia suficiente para recomendar una única opción con confianza. El promedio es una orientación, no una garantía.'
  const pairs = [
    ['Aleatoria frente a no intervenir', paired.savedVsNone.random],
    ['Dirigida frente a no intervenir', paired.savedVsNone.targeted],
    ['Dirigida frente a aleatoria', paired.gainVsRandom],
  ] as const
  const bars = policies.map(policy => {
    const value = stats[policy].cumulativeInfected
    return `<div class="bar-row"><strong>${policyLabels[policy]}</strong><div class="track" role="img" aria-label="${escapeHtml(policyLabels[policy])}: ${number(value.mean)} de ${scenario.populationSize} personas contagiadas"><span class="${policy}" style="width:${Number(value.mean) / scenario.populationSize * 100}%"></span></div><b>${number(value.mean)}</b></div>`
  }).join('')
  const impact = policies.map(policy => `<tr><th scope="row">${policyLabels[policy]}</th><td>${policy === 'none' ? 'Referencia' : number(paired.savedVsNone[policy].mean)}</td><td>${number(stats[policy].peakInfectious.mean)}</td><td>${number(stats[policy].vaccinesAssigned.mean)}</td><td>${number(stats[policy].cumulativeInfected.p05)} a ${number(stats[policy].cumulativeInfected.p95)}</td></tr>`).join('')
  const plan = intervention.combined
  const budget = plan ? `<p>Presupuesto máximo educativo por estrategia: <strong>${money(plan.budgetCents)}</strong>. No es el gasto operativo real del sistema.</p><table><thead><tr><th>Estrategia</th><th>Gasto medio</th><th>Saldo medio</th></tr></thead><tbody>${policies.map(policy => {
    const row = result.decisionSummary?.policies[policy]
    return `<tr><th scope="row">${policyLabels[policy]}</th><td>${row?.spentMeanCents == null ? 'No disponible' : money(row.spentMeanCents)}</td><td>${row?.remainingMeanCents == null ? 'No disponible' : money(row.remainingMeanCents)}</td></tr>`
  }).join('')}</tbody></table><p class="note">Son costos educativos, no precios de salud reales. Sin el resumen financiero del backend no se estima gasto.</p>`
    : '<p>No se configuró un presupuesto monetario. Eso no significa que vacunar sea gratis: aquí se comparan dosis y contagios.</p>'
  const adaptive = plan?.adaptiveStrategy
  const adaptiveSection = adaptive ? `<details class="technical"><summary>Variante adaptativa evaluada</summary><p>${escapeHtml(adaptive.modelVersion)} ${adaptive.enabled === false ? '(deshabilitada)' : '(habilitada)'}.</p><p>Cierre: ${(adaptive.closureInfectionThreshold * 100).toFixed(1)}%; reapertura: ${(adaptive.reopenInfectionThreshold * 100).toFixed(1)}%. Prioridad de anillo: ${adaptive.ringVaccinationPriority ? 'Habilitada' : 'Deshabilitada'}.</p></details>` : ''
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resumen para alcaldía</title><link rel="icon" href="data:,"><style>
  :root{font-family:Arial,Helvetica,sans-serif;color:#202d38;background:#f1f4f2;color-scheme:light}
  *{box-sizing:border-box}body{margin:0;line-height:1.45}.page{max-width:850px;margin:24px auto;background:white;padding:40px 46px;border-top:5px solid #18745e}
  header small{font-weight:bold;letter-spacing:.07em;color:#4b5963}h1{font-size:30px;line-height:1.15;margin:10px 0}h2{font-size:18px;margin:22px 0 9px}p{margin:9px 0}.label,.note{font-size:12px;color:#4b5963}.callout{padding:16px 20px;background:#eaf1ee;border-left:4px solid #18745e;margin:18px 0}.lead{font-size:19px;font-weight:bold}
  .bar-row{display:grid;grid-template-columns:125px minmax(50px,1fr) 65px;gap:12px;align-items:center;margin:18px 0;font-size:13px}.track{height:22px;background:#edf1ef}.track span{display:block;height:100%}.none{background:#77707e}.random{background:#487aa0}.targeted{background:#18745e}.scale{margin-left:137px;display:flex;justify-content:space-between;padding-right:77px;font-size:11px;color:#4b5963}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}th,td{padding:10px 7px;text-align:left;vertical-align:top;border-bottom:1px solid #d6dedc}thead{background:#eaf1ee}caption{text-align:left;font-size:11px;padding:5px 0}.frequency{padding:12px 16px;background:#eaf1ee;font-size:13px}.hash{overflow-wrap:anywhere;font-family:monospace;font-size:10px}.technical{font-size:12px;margin-top:14px}footer{margin-top:20px;padding-top:12px;border-top:1px solid #d6dedc;font-size:11px;color:#4b5963}
  .print-actions{max-width:850px;margin:18px auto}.print-actions button{background:#18745e;color:white;border:0;border-radius:4px;padding:12px 18px;cursor:pointer}
  @page{size:A4 portrait;margin:12mm 14mm}@media print{:root{background:#fff}body{background:white;font-size:9pt}.page{margin:0;padding:0;border:0;max-width:none;break-after:page}.page:last-child{break-after:auto}h1{font-size:23pt}h2{font-size:12pt;margin-top:14px}.print-actions,.technical{display:none}.bar-row{margin:13px 0}.callout{margin:12px 0;padding:10px 14px}table{font-size:8.5pt}th,td{padding:7px 5px}section,table,.callout{break-inside:avoid}footer{font-size:8pt}.note{font-size:8pt}}
  @media screen and (max-width:600px){.page{margin:10px;padding:24px 16px}.bar-row{grid-template-columns:90px minmax(30px,1fr) 45px;gap:7px}.scale{margin-left:97px;padding-right:52px}table{font-size:10px}th,td{padding:7px 3px}}
  </style>${options.autoPrint ? '<script>window.addEventListener("load",()=>{window.print()});</script>' : ''}</head><body>
  <div class="print-actions"><button type="button" onclick="window.print()">Imprimir o guardar como PDF</button></div>
  <article class="page"><header><small>COMITÉ DE CONTENCIÓN DE MANTA</small><h1>Resumen para decidir</h1><p class="label">ESCENARIO FICTICIO · USO EDUCATIVO</p><p>${scenario.populationSize} personas de una población sintética · ${scenario.days} días · ${result.progress.replicatesSucceeded} repeticiones.</p></header>
  <section class="callout"><p class="lead">${escapeHtml(comparisonText)}</p><p>${escapeHtml(confidenceText)}</p><p class="note">El objetivo es reducir contagios; no se elige automáticamente la alternativa más barata.</p></section>
  <section><h2>Personas contagiadas durante el brote</h2>${bars}<div class="scale"><span>0</span><span>${scenario.populationSize} personas</span></div><p class="note">Todas las barras usan la misma escala. Una barra menor significa menos contagios, incluidos los casos iniciales.</p></section>
  <section><h2>Impacto y vacunas, de un vistazo</h2><table><caption>Promedios del experimento; los decimales no son partes de una persona.</caption><thead><tr><th>Estrategia</th><th>Contagios evitados*</th><th>Pico simultáneo</th><th>Dosis usadas</th><th>Variación P05–P95</th></tr></thead><tbody>${impact}</tbody></table><p class="note">* Frente a no intervenir. Un valor negativo significa más contagios. P05–P95 describe variación entre repeticiones; no es un intervalo de confianza. Una dosis usada puede fallar.</p></section>
  </article>
  <article class="page"><header><small>INFORME PARA ALCALDÍA</small><h1>Recursos y confianza</h1></header>
  <section><h2>Qué recursos supone este escenario</h2><p>${intervention.vaccines} dosis iniciales; protección supuesta del ${number(intervention.vaccineEfficacy * 100)}%; intervención desde el día ${intervention.interventionDay}.</p>${budget}${adaptiveSection}</section>
  <section><h2>¿La ventaja se repitió siempre?</h2><p class="frequency">Dirigida tuvo menos contagios que Aleatoria en el <strong>${number(paired.targetedWinRateVsRandom * 100)}%</strong> de las repeticiones; frente a no intervenir, en el <strong>${number(paired.targetedWinRateVsNone * 100)}%</strong>.</p><p class="note">El resto puede incluir empates y pérdidas. No es una probabilidad de éxito futuro.</p>
  <table><caption>Diferencias pareadas: cuánto cambia el promedio frente a cada referencia</caption><thead><tr><th>Comparación</th><th>Contagios evitados</th><th>Variación P05–P95</th><th>Intervalo del 95%</th></tr></thead><tbody>${pairs.map(([label, value]) => `<tr><th scope="row">${label}</th><td>${number(value.mean)}</td><td>${number(value.p05)} a ${number(value.p95)}</td><td>${value.bootstrap ? `${number(value.bootstrap.lower)} a ${number(value.bootstrap.upper)}` : 'No disponible: menos de 30 repeticiones'}</td></tr>`).join('')}</tbody></table><p class="note">El intervalo bootstrap resume incertidumbre sobre la diferencia media; no garantiza una victoria. Con pocas repeticiones la comparación es descriptiva.</p></section>
  <section><h2>Antes de tomar una decisión real</h2><p>Simulación educativa: no representa dengue real ni predice brotes. El mapa no muestra pacientes reales. Más repeticiones no eliminan los límites del modelo.</p><details class="technical"><summary>Límites completos y datos de reproducción</summary><ul>${rec.limitations.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul><p>Semilla ${configuration.rootSeed}; mediana y datos completos: consultar el JSON exportado.</p></details></section>
  <footer><p>Referencia separada: manabi-dengue-2025-v1, fitted-not-validated (ajustado, no validado). No acredita predicción de dengue ni aprobación científica T-22.</p><p>Identificador del experimento: <span class="hash">${escapeHtml(manifest.experimentHash)}</span></p><p>Build ${escapeHtml(manifest.buildCommit)} · Motor ${escapeHtml(manifest.engineVersion)} · Esquema ${escapeHtml(manifest.schemaVersion)} · ${escapeHtml(result.generatedAt)}.</p><p>Conserve el JSON junto al informe: contiene parámetros, versiones y cifras completas. El informe no modifica la simulación.</p></footer>
  </article></body></html>`
}
