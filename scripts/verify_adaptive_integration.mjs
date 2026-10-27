/** P-02: actual HTTP response -> frontend validator -> CSV; reject forged decisions. */
import assert from 'node:assert/strict'
import { createApiClient } from '../frontend/src/lib/api.ts'
import { experimentFiles } from '../frontend/src/lib/export-experiment.ts'
import { selectionReason } from '../frontend/src/lib/vaccination.ts'

const api = createApiClient(process.env.API_BASE ?? 'http://127.0.0.1:18002/v1')
const configuration = {
  rootSeed: 314159265, networkMode: 'fixed', repetitions: 2,
  scenario: { populationSize: 50, days: 3, beta: 0, sigma: 1, gamma: 0, initialInfectious: 1, origin: { kind: 'node', value: 0 } },
  policies: ['none', 'random', 'targeted'],
  intervention: { vaccines: 2, interventionDay: 0, vaccineEfficacy: 0, combined: {
    modelVersion: 'combined-educational-v1', budgetCents: 10000, vaccineCostCents: 100,
    closureCostCents: 500, closureContext: 'household', closureStart: 0, closureDays: 0,
    brigadeCostCents: 50, brigadeDailyCapacity: 2, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 3,
    adaptiveStrategy: { modelVersion: 'adaptive-policy-v1', enabled: true, closureInfectionThreshold: 0.01, reopenInfectionThreshold: 0.005, ringVaccinationPriority: true },
    resourceSchedule: { modelVersion: 'daily-inventory-v1', vaccineDailyCapacity: 2, initialBrigadeSupplies: 2, deliveries: [{ day: 2, vaccines: 2, brigadeSupplies: 4 }] },
  } },
}
const preview = await api.preview(configuration)
const result = await api.compare(configuration, preview.graphHash, undefined, true)
const data = result.replicates[0].policies.targeted
assert.equal(data.daily[0].closedContext, 'household') // Outside fixed closure calendar.
assert.equal(data.daily.at(-1).adaptiveDecisions.closureActive, false)
const ring = data.selections.find(row => row.tieBreak === 'ringContact')
assert.ok(ring)
assert.match(selectionReason(ring), /anillo/)
const files = experimentFiles(result)
assert.ok(files['adaptive-decisions.csv'].includes('closure_triggered_by_threshold'))
assert.ok(files['inventory.csv'])
assert.ok(files['budget.csv'])
for (const change of [
  value => { value.replicates[0].policies.targeted.daily[0].adaptiveDecisions.infectiousFraction = 0.9 },
  value => { value.replicates[0].policies.targeted.daily[0].adaptiveDecisions.closureActive = false },
  value => { value.replicates[0].policies.random.selections[0].tieBreak = 'ringContact' },
]) {
  const forged = structuredClone(result)
  change(forged)
  const transport = createApiClient('/v1', async () => Response.json(forged))
  await assert.rejects(transport.compare(configuration, preview.graphHash, undefined, true), error => error.code === 'INVALID_RESPONSE')
}
console.log(JSON.stringify({ status: 'passed', experimentHash: result.manifest.experimentHash, adaptiveRows: configuration.repetitions * 3 * (configuration.scenario.days + 1), ringNode: ring.nodeId }))
