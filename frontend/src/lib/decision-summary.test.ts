import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createApiClient } from './api.ts'
import { validDecisionSummary, type DecisionSummary } from './decision-summary.ts'

function summary(): DecisionSummary {
  const row = { infectedMean: 1, infectedPopulationPercent: 2, avoidedVsNoneMean: 0, reductionVsNonePercent: 0, vaccinesAssignedMean: 0, vaccinesReceived: 3, budgetCents: null, spentMeanCents: null, remainingMeanCents: null, costPerAvoidedCents: null, avoidedPer100Usd: null, omissionReasons: null }
  return { modelVersion: 'decision-summary-v1', criterion: 'minimize-mean-cumulative-infected', confidence: 'descriptive', bestPolicies: ['none', 'random', 'targeted'], nearestAlternative: null, policies: { none: { ...row }, random: { ...row }, targeted: { ...row } } }
}

test('decision summary accepts unavailable economics and rejects malformed numbers and ranking', () => {
  assert.equal(validDecisionSummary(summary()), true)
  assert.equal(validDecisionSummary({ ...summary(), conclusion: 'Conclusión calculada por el backend.' }), true)
  assert.equal(validDecisionSummary({ ...summary(), conclusion: 12 }), false)
  for (const mutate of [
    (s: DecisionSummary) => { s.policies.random.infectedMean = Infinity },
    (s: DecisionSummary) => { s.policies.random.spentMeanCents = 1 },
    (s: DecisionSummary) => { s.bestPolicies = [] },
    (s: DecisionSummary) => { s.nearestAlternative = { policies: ['random'], gapMean: 1 } },
    (s: DecisionSummary) => { s.policies.targeted.omissionReasons = [{reason: 'invented', replicateDays: 1}] },
  ]) {
    const value = summary(); mutate(value)
    assert.equal(validDecisionSummary(value), false)
  }
})

test('API rejects a malformed additive decision summary and accepts old responses without it', async () => {
  const old = JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response-no-frames.json', import.meta.url), 'utf8'))
  await createApiClient('/v1', async () => Response.json(old)).compare(old.configuration, old.graphHash)
  const invalid = { ...old, decisionSummary: { ...summary(), modelVersion: 'invented' } }
  await assert.rejects(createApiClient('/v1', async () => Response.json(invalid)).compare(old.configuration, old.graphHash), /contrato/)
})
