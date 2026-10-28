/** Verificación HTTP real de los datos UX; las cuentas de prueba no viven en producción. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createApiClient } from '../frontend/src/lib/api.ts'

const api = createApiClient(process.env.API_BASE ?? 'http://127.0.0.1:18009/v1')
const configuration = {
  rootSeed: 314159265, networkMode: 'fixed', repetitions: 2,
  scenario: { populationSize: 50, days: 3, beta: 0, sigma: 1, gamma: 0, initialInfectious: 1, origin: { kind: 'node', value: 0 } },
  policies: ['none', 'random', 'targeted'],
  intervention: { vaccines: 2, interventionDay: 0, vaccineEfficacy: 0 },
}
await mkdir('.tools/decision-summary', { recursive: true })
for (const name of ['base', 'combined']) {
  const cfg = structuredClone(configuration)
  if (name === 'combined') cfg.intervention.combined = {
    modelVersion: 'combined-educational-v1', budgetCents: 10000, vaccineCostCents: 100,
    closureCostCents: 500, closureContext: 'household', closureStart: 0, closureDays: 0,
    brigadeCostCents: 50, brigadeDailyCapacity: 2, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 3,
    adaptiveStrategy: { modelVersion: 'adaptive-policy-v1', enabled: true, closureInfectionThreshold: 0.01, reopenInfectionThreshold: 0.005, ringVaccinationPriority: true },
    resourceSchedule: { modelVersion: 'daily-inventory-v1', vaccineDailyCapacity: 2, initialBrigadeSupplies: 2, deliveries: [{ day: 2, vaccines: 2, brigadeSupplies: 4 }] },
  }
  const preview = await api.preview(cfg)
  const source = await api.compare(cfg, preview.graphHash, undefined, true)
  const summary = source.decisionSummary
  assert.ok(summary)
  for (const policy of cfg.policies) {
    const row = summary.policies[policy]
    const baseline = source.summaryByPolicy.none.cumulativeInfected.mean
    const avoided = baseline - source.summaryByPolicy[policy].cumulativeInfected.mean
    assert.equal(row.avoidedVsNoneMean, avoided)
    assert.equal(row.reductionVsNonePercent, baseline > 0 ? 100 * avoided / baseline : null)
    if (name === 'combined') {
      const spent = source.replicates.reduce((total, rep) => total + rep.policies[policy].daily.at(-1).spentCents, 0) / cfg.repetitions
      assert.equal(row.spentMeanCents, spent)
      assert.equal(row.remainingMeanCents, cfg.intervention.combined.budgetCents - spent)
      assert.equal(row.costPerAvoidedCents, avoided > 0 ? spent / avoided : null)
    } else assert.equal(row.spentMeanCents, null)
  }
  const forged = structuredClone(source)
  forged.decisionSummary.confidence = 'supported'
  await assert.rejects(createApiClient('/v1', async () => Response.json(forged)).compare(cfg, preview.graphHash, undefined, true), /contrato/)
  await writeFile(`.tools/decision-summary/${name}.json`, JSON.stringify(source))
  console.log(JSON.stringify({ name, status: 'passed', experimentHash: source.manifest.experimentHash, summary }))
}
