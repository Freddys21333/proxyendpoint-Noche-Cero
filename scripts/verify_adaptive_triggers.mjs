/** P-02: ejercita la variante adaptativa contra la API real y comprueba que
 *  cada motivo observado tiene etiqueta en el cliente (`triggerLabels`). */
import assert from 'node:assert/strict'
import { createApiClient } from '../frontend/src/lib/api.ts'
import { adaptiveSummary, decisionRows, isOmissionTrigger, triggerLabels } from '../frontend/src/lib/adaptive.ts'

const api = createApiClient(process.env.API_BASE ?? 'http://127.0.0.1:18002/v1')

const base = overrides => ({
  rootSeed: 271828182, networkMode: 'fixed', repetitions: 2,
  scenario: { populationSize: 100, days: 6, beta: 0.06, sigma: 0.2, gamma: 0.2, initialInfectious: 2, origin: { kind: 'random', value: null } },
  policies: ['none', 'random', 'targeted'],
  intervention: { vaccines: 10, interventionDay: 0, vaccineEfficacy: 0.8, combined: {
    modelVersion: 'combined-educational-v1', budgetCents: 20000, vaccineCostCents: 100,
    closureCostCents: 1000, closureContext: 'school', closureStart: 0, closureDays: 2,
    brigadeCostCents: 100, brigadeDailyCapacity: 5, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 2,
    adaptiveStrategy: { modelVersion: 'adaptive-policy-v1', enabled: true, closureInfectionThreshold: 0.01, reopenInfectionThreshold: 0.005, ringVaccinationPriority: true },
    ...overrides,
  } },
})

const cases = {
  'umbral de cierre y reapertura': base({}),
  'presupuesto agotado': base({ budgetCents: 1200, closureCostCents: 900, brigadeCostCents: 150 }),
  'cierre sin saldo suficiente': base({ budgetCents: 1500, closureCostCents: 1400 }),
  'capacidad cero': base({ brigadeDailyCapacity: 0, resourceSchedule: { modelVersion: 'daily-inventory-v1', vaccineDailyCapacity: 0, initialBrigadeSupplies: 2, deliveries: [] } }),
  'inventario vacío': base({ resourceSchedule: { modelVersion: 'daily-inventory-v1', vaccineDailyCapacity: 4, initialBrigadeSupplies: 0, deliveries: [] } }),
  'prioridad de anillo desactivada': base({ adaptiveStrategy: { modelVersion: 'adaptive-policy-v1', enabled: true, closureInfectionThreshold: 0.03, reopenInfectionThreshold: 0.01, ringVaccinationPriority: false } }),
}

const observed = new Map()
const report = []
for (const [name, configuration] of Object.entries(cases)) {
  const preview = await api.preview(configuration)
  const result = await api.compare(configuration, preview.graphHash, undefined, true)
  const triggers = new Set()
  let rows = 0
  for (const replicate of result.replicates) {
    const decisions = decisionRows(replicate.policies.targeted.daily)
    rows += decisions.length
    for (const row of decisions) for (const trigger of row.triggers) triggers.add(trigger)
    adaptiveSummary(decisions)
  }
  for (const trigger of triggers) observed.set(trigger, (observed.get(trigger) ?? 0) + 1)
  report.push({
    case: name,
    rows,
    triggers: [...triggers].sort(),
    omissions: [...triggers].filter(isOmissionTrigger).sort(),
    experimentHash: result.manifest.experimentHash,
  })
}

const unknown = [...observed.keys()].filter(trigger => !(trigger in triggerLabels))
assert.deepEqual(unknown, [], `motivos sin etiqueta en el cliente: ${unknown.join(', ')}`)
assert.ok(observed.size >= 6, `se esperaban al menos 6 motivos distintos, se observaron ${observed.size}`)
const omitted = [...observed.keys()].filter(isOmissionTrigger)
assert.ok(omitted.length >= 2, `se esperaban motivos de omisión, se observaron ${omitted.length}`)
console.log(JSON.stringify({ status: 'passed', distinctTriggers: [...observed.keys()].sort(), cases: report }, null, 2))
