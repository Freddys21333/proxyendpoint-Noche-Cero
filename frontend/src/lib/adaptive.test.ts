import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adaptiveEnabled,
  adaptiveStrategyOf,
  adaptiveSummary,
  decisionRows,
  policyVariantLabel,
  triggerLabel,
  triggerLabels,
} from './adaptive.ts'
import type { AdaptiveStrategy, ConfigurationInput, DailyRow } from './api.ts'

const strategy = (overrides: Partial<AdaptiveStrategy> = {}): AdaptiveStrategy => ({
  modelVersion: 'adaptive-policy-v1',
  closureInfectionThreshold: 0.05,
  reopenInfectionThreshold: 0.02,
  ringVaccinationPriority: true,
  ...overrides,
})

const configuration = (adaptive?: AdaptiveStrategy): ConfigurationInput => ({
  rootSeed: 20261026,
  networkMode: 'fixed',
  repetitions: 2,
  scenario: { populationSize: 50, days: 5, beta: 0.2, sigma: 0.1, gamma: 0.1, initialInfectious: 1, origin: { kind: 'random', value: null } },
  intervention: {
    vaccines: 10,
    interventionDay: 0,
    vaccineEfficacy: 1,
    ...(adaptive ? {
      combined: {
        modelVersion: 'combined-educational-v1', budgetCents: 200000, vaccineCostCents: 1000,
        closureCostCents: 10000, closureContext: 'school', closureStart: 0, closureDays: 3,
        brigadeCostCents: 200, brigadeDailyCapacity: 10, brigadeReduction: 0.3, brigadeStart: 0, brigadeDays: 3,
        adaptiveStrategy: adaptive,
      },
    } : {}),
  },
  policies: ['none', 'random', 'targeted'],
})

const decision = (overrides: Partial<DailyRow['adaptiveDecisions']> = {}): DailyRow['adaptiveDecisions'] => ({
  enabled: true,
  triggers: [],
  infectiousFraction: 0,
  closureActive: false,
  brigadesAllowed: true,
  ringVaccinationActive: false,
  ...overrides,
})

test('adaptive trigger labels cover the documented vocabulary', () => {
  const documented = [
    'closure_triggered_by_threshold', 'closure_budget_exhausted', 'reopen_triggered_by_threshold',
    'no_infectious_hold_brigades', 'ring_vaccination_active', 'closure_no_active_contacts',
    'vaccine_stock_empty', 'vaccine_capacity_zero', 'vaccine_budget_exhausted', 'vaccine_no_eligible',
    'brigade_capacity_zero', 'brigade_stock_empty', 'brigade_budget_exhausted', 'brigade_no_eligible',
  ]
  assert.deepEqual(Object.keys(triggerLabels).sort(), documented.sort())
  assert.equal(triggerLabel('closure_budget_exhausted'), 'Cierre omitido: presupuesto insuficiente')
  assert.equal(triggerLabel('firewall_desconocido'), 'firewall_desconocido')
})

test('variant label distinguishes fixed from adaptive targeted only when active', () => {
  assert.equal(adaptiveStrategyOf(configuration()), undefined)
  assert.equal(adaptiveEnabled(configuration()), false)
  assert.equal(policyVariantLabel('targeted', configuration()), 'Dirigida')
  assert.equal(policyVariantLabel('none', configuration(strategy())), 'Sin intervención')

  const active = configuration(strategy())
  assert.equal(adaptiveEnabled(active), true)
  assert.equal(policyVariantLabel('targeted', active), 'Dirigida · adaptativa v1')

  const inactive = configuration(strategy({ enabled: false }))
  assert.equal(adaptiveEnabled(inactive), false)
  assert.equal(policyVariantLabel('targeted', inactive), 'Dirigida · adaptativa v1 (inactiva)')
})

test('decision rows keep only days with registered adaptive decisions', () => {
  const daily: DailyRow[] = [
    { day: 0, s: 9, e: 0, i: 1, r: 0, cumulativeInfected: 1, closedContext: null, brigadesActive: 0,
      adaptiveDecisions: decision({ triggers: ['ring_vaccination_active'], infectiousFraction: 0.02, ringVaccinationActive: true }) },
    { day: 1, s: 8, e: 0, i: 2, r: 0, cumulativeInfected: 3, closedContext: 'school', brigadesActive: 4,
      adaptiveDecisions: decision({ triggers: ['closure_triggered_by_threshold'], infectiousFraction: 0.04, closureActive: true, brigadesAllowed: false }) },
    { day: 2, s: 8, e: 0, i: 2, r: 0, cumulativeInfected: 3,
      adaptiveDecisions: decision({ enabled: false, closureActive: null }) },
    { day: 3, s: 8, e: 0, i: 2, r: 0, cumulativeInfected: 3 },
  ]
  const rows = decisionRows(daily)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => row.day), [0, 1])
  assert.equal(rows[0].ringVaccinationActive, true)
  assert.equal(rows[1].closedContext, 'school')
  assert.equal(rows[1].brigadesActive, 4)
  assert.deepEqual(decisionRows(undefined), [])
})

test('summary separates paid closures, requests and omitted actions', () => {
  const rows = decisionRows([
    { day: 0, s: 8, e: 0, i: 2, r: 0, cumulativeInfected: 3, closedContext: 'school', brigadesActive: 0,
      adaptiveDecisions: decision({ triggers: ['closure_triggered_by_threshold', 'closure_budget_exhausted'], infectiousFraction: 0.04, closureActive: true, brigadesAllowed: false }) },
    { day: 1, s: 8, e: 0, i: 2, r: 0, cumulativeInfected: 3, closedContext: null, brigadesActive: 0,
      adaptiveDecisions: decision({ triggers: ['closure_triggered_by_threshold', 'no_infectious_hold_brigades'], infectiousFraction: 0.04, closureActive: false, brigadesAllowed: false }) },
    { day: 2, s: 9, e: 0, i: 1, r: 0, cumulativeInfected: 3, closedContext: null, brigadesActive: 0,
      adaptiveDecisions: decision({ triggers: ['ring_vaccination_active', 'vaccine_no_eligible'], infectiousFraction: 0.02, ringVaccinationActive: true }) },
  ])
  const summary = adaptiveSummary(rows)
  assert.equal(summary.days, 3)
  assert.equal(summary.closureDays, 1)
  assert.equal(summary.closureRequests, 2)
  assert.equal(summary.closureRequestsNotExecuted, 1)
  assert.equal(summary.brigadeHoldDays, 1)
  assert.equal(summary.ringDays, 1)
  const omissions = Object.fromEntries(summary.omissions.map(item => [item.trigger, item.count]))
  assert.equal(omissions.closure_budget_exhausted, 1)
  assert.equal(omissions.vaccine_no_eligible, 1)
  assert.equal(omissions.closure_triggered_by_threshold, undefined)
  assert.equal(summary.omissions.every(item => item.label.length > 0), true)
})

test('summary of an inactive variant has no decisions to count', () => {
  const rows = decisionRows([
    { day: 0, s: 9, e: 0, i: 1, r: 0, cumulativeInfected: 1,
      adaptiveDecisions: decision({ enabled: false, closureActive: null }) },
  ])
  assert.equal(rows.length, 0)
  assert.deepEqual(adaptiveSummary(rows), {
    days: 0, closureDays: 0, closureRequests: 0, closureRequestsNotExecuted: 0,
    brigadeHoldDays: 0, ringDays: 0, omissions: [],
  })
})
