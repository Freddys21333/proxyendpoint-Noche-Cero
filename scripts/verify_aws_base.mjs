/** Smoke remoto acotado; no sustituye T-22 ni el benchmark de aceptación. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createApiClient } from '../frontend/src/lib/api.ts'
import { fetchMayorReport } from '../frontend/src/lib/mayor-report.ts'

const base = process.argv[2]
if (!base || !/^https:\/\/[a-z0-9]+\.execute-api\.us-east-2\.amazonaws\.com\/v1$/.test(base)) throw new Error('Indica la API de staging de Ohio.')
const output = '.tools/aws-smoke'
await mkdir(output, { recursive: true })
const api = createApiClient(base)
const health = await api.health()
const config = await api.config()
assert.equal(config.features.asyncJobs, false)
const c = structuredClone(config.defaults)
Object.assign(c, { repetitions: 2 })
Object.assign(c.scenario, { populationSize: 60, days: 7, initialInfectious: 2 })
Object.assign(c.intervention, { vaccines: 10, interventionDay: 2 })
const samples = []
for (const [name, configuration] of [['small', c], ['default', config.defaults]]) {
  const start = performance.now()
  const preview = await api.preview(configuration, undefined, config.limits)
  const compared = performance.now()
  const result = await api.compareForPlayback(configuration, preview.graphHash, undefined, config.limits)
  const end = performance.now()
  for (const replica of result.replicates) for (const policy of ['none', 'random', 'targeted']) {
    for (const row of replica.policies[policy].daily) assert.equal(row.s + row.e + row.i + row.r, configuration.scenario.populationSize)
  }
  await writeFile(`${output}/${name}.json`, JSON.stringify(result))
  const pdfStart = performance.now()
  const pdf = await fetchMayorReport(result, undefined, fetch, base)
  await writeFile(`${output}/${name}.pdf`, new Uint8Array(await pdf.arrayBuffer()))
  samples.push({ name, previewSeconds: (compared-start)/1000, compareSeconds: (end-compared)/1000, pdfSeconds: (performance.now()-pdfStart)/1000, hash: result.manifest.experimentHash, pdfBytes: pdf.size })
}
// Un documento grande real ya exportado sigue siendo válido para el PDF.
const { readFile } = await import('node:fs/promises')
try {
  const large = JSON.parse(await readFile('.tools/local-stability/experiment.json', 'utf8'))
  const pdf = await fetchMayorReport(large, undefined, fetch, base)
  await writeFile(`${output}/large.pdf`, new Uint8Array(await pdf.arrayBuffer()))
  samples.push({ name: 'large-imported-pdf', inputBytes: JSON.stringify(large).length, pdfBytes: pdf.size })
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const evidence = { health, features: config.features, samples }
const excessive = structuredClone(config.defaults)
Object.assign(excessive.scenario, { populationSize: 1000, days: 90 })
const excessivePreview = await api.preview(excessive, undefined, config.limits)
await assert.rejects(api.compareForPlayback(excessive, excessivePreview.graphHash, undefined, config.limits), error => error.status === 422 && error.message.includes('síncrono'))
evidence.largeWorkloadRejected = true
await writeFile(`${output}/summary.json`, JSON.stringify(evidence, null, 2))
console.log(JSON.stringify(evidence, null, 2))
