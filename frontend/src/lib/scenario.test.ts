import { toConfiguration } from './api.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaults, applyPreset, validateScenario, applyServerDefaults, fromConfiguration } from './scenario.ts'

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
