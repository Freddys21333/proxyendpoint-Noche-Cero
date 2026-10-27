import { toConfiguration } from './api.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaults, applyPreset, validateScenario, applyServerDefaults, fromConfiguration, matchesLoadedScenario } from './scenario.ts'

test('each surprise transforms a copy of the base without accumulating changes', () => {
  assert.equal(applyPreset(defaults, 'double_beta').beta, 0.16)
  assert.equal(applyPreset({ ...defaults, beta: 0.8 }, 'double_beta').beta, 1)
  assert.equal(applyPreset({ ...defaults, vaccines: 101 }, 'half_vaccines').vaccines, 50)
  assert.equal(applyPreset(defaults, 'market_origin').origin, 'market')
  assert.equal(applyPreset(defaults, 'partial_efficacy_50').efficacy, 0.5)
  assert.deepEqual(defaults, { ...applyPreset(defaults, 'market_origin'), origin: 'random' })
})
test('valid defaults pass; incompatible doses, nonfinite rates and node IDs fail', () => {
  assert.deepEqual(validateScenario(defaults), [])
  assert.match(validateScenario({ ...defaults, population: 50 }).join(), /Vaccines/)
  assert.match(validateScenario({ ...defaults, beta: NaN }).join(), /Transmission/)
  assert.match(validateScenario({ ...defaults, origin: 'node', node: 1000 }).join(), /Node ID/)
  assert.match(validateScenario({ ...defaults, days: 2, interventionDay: 3 }).join(), /Intervention day/)
})

test('published defaults fill untouched fields and preserve edits without clamping dependent inputs', () => {
  const published = toConfiguration({ ...defaults, population: 800, vaccines: 120, seed: 77 })
  const current = { ...defaults, population: 50, beta: 0.3 }
  const result = applyServerDefaults(current, published, new Set(['population', 'beta']))
  assert.equal(result.population, 50)
  assert.equal(result.beta, 0.3)
  assert.equal(result.vaccines, 120)
  assert.equal(result.seed, 77)
  assert.ok(validateScenario(result).some(message => message.includes('Vaccines')))
  assert.deepEqual(applyServerDefaults(current, published, new Set()), fromConfiguration(published))
})

test('returning to loaded parameters restores only the same valid scenario', () => {
  const configuration = toConfiguration(defaults)
  assert.equal(matchesLoadedScenario({ ...defaults }, configuration), true)
  for (const key of ['population', 'days', 'beta', 'sigma', 'gamma', 'initial', 'vaccines', 'interventionDay', 'efficacy', 'repetitions', 'seed'] as const) {
    const edited = { ...defaults, [key]: defaults[key] + 1 }
    assert.equal(matchesLoadedScenario(edited, configuration), false, key)
    assert.equal(matchesLoadedScenario({ ...edited, [key]: defaults[key] }, configuration), true, key)
  }
  assert.equal(matchesLoadedScenario({ ...defaults, population: NaN }, configuration), false)
  assert.equal(matchesLoadedScenario({ ...defaults, node: 12 }, configuration), true)
  assert.equal(matchesLoadedScenario({ ...defaults, origin: 'market' }, configuration), false)
  const nodeScenario = { ...defaults, origin: 'node', node: 12 }
  const nodeConfiguration = toConfiguration(nodeScenario)
  assert.equal(matchesLoadedScenario(nodeScenario, nodeConfiguration), true)
  assert.equal(matchesLoadedScenario({ ...nodeScenario, node: 13 }, nodeConfiguration), false)
})

test('combined plans round trip, validate money and restore by value rather than object identity', () => {
  const combined = { modelVersion: 'combined-educational-v1' as const, budgetCents: 10000, vaccineCostCents: 1000, closureCostCents: 500, closureContext: 'school' as const, closureStart: 0, closureDays: 2, brigadeCostCents: 100, brigadeDailyCapacity: 10, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 2 }
  const scenario = { ...defaults, combined }
  const configuration = toConfiguration(scenario)
  assert.deepEqual(fromConfiguration(configuration), scenario)
  assert.equal(matchesLoadedScenario(structuredClone(scenario), configuration), true)
  assert.equal(matchesLoadedScenario({ ...scenario, combined: { ...combined, budgetCents: 9999 } }, configuration), false)
  assert.equal(matchesLoadedScenario(defaults, configuration), false)
  assert.ok(validateScenario({ ...scenario, combined: { ...combined, vaccineCostCents: 0 } }).length)
  assert.ok(validateScenario({ ...scenario, combined: { ...combined, closureDays: 91 } }).length)
})

test('resource schedules normalize duplicate deliveries and restore equivalent inputs without mutating UI', () => {
  const combined = { modelVersion: 'combined-educational-v1' as const, budgetCents: 10000, vaccineCostCents: 1000, closureCostCents: 500, closureContext: 'school' as const, closureStart: 0, closureDays: 2, brigadeCostCents: 100, brigadeDailyCapacity: 10, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 2,
    resourceSchedule: { modelVersion: 'daily-inventory-v1' as const, vaccineDailyCapacity: 2, initialBrigadeSupplies: 0, deliveries: [{ day: 2, vaccines: 2, brigadeSupplies: 3 }, { day: 2, vaccines: 1, brigadeSupplies: 1 }] } }
  const scenario = { ...defaults, vaccines: 1, combined }
  const before = JSON.stringify(scenario)
  const configuration = toConfiguration(scenario)
  assert.deepEqual(configuration.intervention.combined!.resourceSchedule!.deliveries, [{ day: 2, vaccines: 3, brigadeSupplies: 4 }])
  assert.equal(JSON.stringify(scenario), before)
  assert.equal(matchesLoadedScenario(scenario, configuration), true)
  const edited = structuredClone(scenario)
  edited.combined.resourceSchedule.deliveries[0].day = 3
  assert.equal(matchesLoadedScenario(edited, configuration), false)
  edited.combined.resourceSchedule.deliveries[0].day = 91
  assert.ok(validateScenario(edited).length)
  edited.combined.resourceSchedule.deliveries[0] = { day: 1, vaccines: 1000, brigadeSupplies: 0 }
  assert.ok(validateScenario(edited).length)
})


test('adaptive rules restore by value and reject inverted thresholds', () => {
  const combined = { modelVersion: 'combined-educational-v1' as const, budgetCents: 10000, vaccineCostCents: 1000, closureCostCents: 500, closureContext: 'school' as const, closureStart: 0, closureDays: 2, brigadeCostCents: 100, brigadeDailyCapacity: 10, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 2,
    adaptiveStrategy: { modelVersion: 'adaptive-policy-v1' as const, closureInfectionThreshold: 0.05, reopenInfectionThreshold: 0.02, ringVaccinationPriority: true } }
  const scenario = { ...defaults, combined }
  const configuration = toConfiguration(scenario)
  assert.equal(matchesLoadedScenario(structuredClone(scenario), configuration), true)
  const changed = structuredClone(scenario)
  changed.combined.adaptiveStrategy.closureInfectionThreshold = 0.1
  assert.equal(matchesLoadedScenario(changed, configuration), false)
  changed.combined.adaptiveStrategy.reopenInfectionThreshold = 0.2
  assert.ok(validateScenario(changed).length)
  assert.equal(combined.adaptiveStrategy.closureInfectionThreshold, 0.05)
})
