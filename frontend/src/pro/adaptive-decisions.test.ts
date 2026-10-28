import assert from 'node:assert/strict'
import test from 'node:test'
import type { CompareResponse } from '../lib/api.ts'
import { adaptiveContextLabel, adaptiveDecisionRows, adaptiveTriggerLabel, adaptiveStrategyDisabled } from './adaptive-decisions.ts'

function comparison(adaptive = true): CompareResponse {
  const daily = [
    { day: 0, s: 49, e: 0, i: 1, r: 0, adaptiveDecisions: { enabled: true, infectiousFraction: 0.02, closureActive: false, brigadesAllowed: true, ringVaccinationActive: true, triggers: ['ring_vaccination_active'] } },
    { day: 1, s: 48, e: 1, i: 1, r: 0, adaptiveDecisions: { enabled: true, infectiousFraction: 0.02, closureActive: true, brigadesAllowed: true, ringVaccinationActive: true, triggers: ['closure_triggered_by_threshold', 'vaccine_no_eligible'] } },
    { day: 2, s: 47, e: 1, i: 1, r: 1 },
  ]
  return {
    configuration: { intervention: { combined: adaptive ? { adaptiveStrategy: { modelVersion: 'adaptive-policy-v1', closureInfectionThreshold: 0.05, reopenInfectionThreshold: 0.02, ringVaccinationPriority: true } } : undefined } },
    replicates: [
      { index: 0, policies: { targeted: { daily, selections: [
        { day: 0, effective: true }, { day: 1, effective: false }, { day: 1, effective: true },
      ] } } },
      { index: 1, policies: { targeted: { daily: [{ ...daily[0], day: 3 }], selections: [] } } },
    ],
  } as unknown as CompareResponse
}

test('adaptive history reads only valid daily decisions from the selected targeted replicate', () => {
  const rows = adaptiveDecisionRows(comparison(), 0)
  assert.deepEqual(rows.map(row => row.day), [0, 1])
  assert.equal(rows[1].adaptiveDecisions.closureActive, true)
  assert.equal(rows[1].adaptiveDecisions.infectiousFraction, 0.02)
  assert.deepEqual(rows[1].adaptiveDecisions.triggers, ['closure_triggered_by_threshold', 'vaccine_no_eligible'])
  assert.deepEqual([rows[1].vaccinesAssigned, rows[1].vaccinesEffective], [2, 1])
  assert.deepEqual(adaptiveDecisionRows(comparison(), 1).map(row => row.day), [3])
  assert.deepEqual(adaptiveDecisionRows(comparison(), 9), [])
})

test('adaptive history is absent when the experiment did not configure the policy', () => {
  assert.deepEqual(adaptiveDecisionRows(comparison(false), 0), [])
})

test('adaptive decision reasons are shown in Spanish and unknown reasons remain visible', () => {
  assert.equal(adaptiveTriggerLabel('closure_triggered_by_threshold'), 'Se alcanzó el umbral de cierre.')
  assert.equal(adaptiveTriggerLabel('reopen_triggered_by_threshold'), 'La fracción infecciosa bajó del umbral de reapertura.')
  assert.equal(adaptiveTriggerLabel('future_reason'), 'Motivo registrado: future_reason')
})

test('an omitted enabled flag keeps the policy enabled; only explicit false disables it', () => {
  assert.equal(adaptiveStrategyDisabled(undefined), false)
  assert.equal(adaptiveStrategyDisabled(true), false)
  assert.equal(adaptiveStrategyDisabled(false), true)
})

test('closure context uses the Spanish interface label and retains unknown values', () => {
  assert.equal(adaptiveContextLabel('household'), 'Hogar')
  assert.equal(adaptiveContextLabel('school'), 'Colegio')
  assert.equal(adaptiveContextLabel('future'), 'future')
})
