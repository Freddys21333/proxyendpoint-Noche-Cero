import type { Policy } from './api.ts'

export type DecisionPolicySummary = {
  infectedMean: number; infectedPopulationPercent: number; avoidedVsNoneMean: number;
  reductionVsNonePercent: number | null; vaccinesAssignedMean: number; vaccinesReceived: number;
  budgetCents: number | null; spentMeanCents: number | null; remainingMeanCents: number | null;
  costPerAvoidedCents: number | null; avoidedPer100Usd: number | null;
  omissionReasons: { reason: string; replicateDays: number }[] | null;
}
export type DecisionSummary = {
  modelVersion: 'decision-summary-v1'; criterion: 'minimize-mean-cumulative-infected';
  confidence: 'descriptive' | 'inconclusive' | 'supported'; bestPolicies: Policy[];
  nearestAlternative: { policies: Policy[]; gapMean: number } | null;
  policies: Record<Policy, DecisionPolicySummary>;
  conclusion?: string;
}
const policies = ['none', 'random', 'targeted'] as const
const reasons = new Set(['closure_budget_exhausted', 'closure_no_active_contacts', 'no_infectious_hold_brigades', 'vaccine_stock_empty', 'vaccine_capacity_zero', 'vaccine_budget_exhausted', 'vaccine_no_eligible', 'brigade_capacity_zero', 'brigade_stock_empty', 'brigade_budget_exhausted', 'brigade_no_eligible'])
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const positive = (value: unknown) => finite(value) && value >= 0
const nullable = (value: unknown, check: (value: unknown) => boolean) => value === null || check(value)
const policyList = (value: unknown, max: number): value is Policy[] => Array.isArray(value) && value.length > 0 && value.length <= max && new Set(value).size === value.length && value.every(p => policies.includes(p))

export function validDecisionSummary(value: unknown): value is DecisionSummary {
  if (object(value) && value.conclusion !== undefined && (typeof value.conclusion !== 'string' || !value.conclusion.length || value.conclusion.length > 6000)) return false
  if (!object(value) || value.modelVersion !== 'decision-summary-v1' || value.criterion !== 'minimize-mean-cumulative-infected' || !['descriptive', 'inconclusive', 'supported'].includes(String(value.confidence)) || !policyList(value.bestPolicies, 3) || !object(value.policies)) return false
  const nearest = value.nearestAlternative
  const best = value.bestPolicies
  if (best.length > 1 ? nearest !== null : !object(nearest) || !policyList(nearest.policies, 2) || nearest.policies.some(p => best.includes(p)) || !positive(nearest.gapMean)) return false
  return policies.every(policy => {
    if (!object(value.policies)) return false
    const row = value.policies[policy]
    if (!object(row) || !positive(row.infectedMean) || !finite(row.infectedPopulationPercent) || row.infectedPopulationPercent < 0 || row.infectedPopulationPercent > 100 || !finite(row.avoidedVsNoneMean) || !nullable(row.reductionVsNonePercent, finite) || !positive(row.vaccinesAssignedMean) || !finite(row.vaccinesReceived) || !Number.isInteger(row.vaccinesReceived) || row.vaccinesReceived < 0) return false
    if (!['budgetCents', 'spentMeanCents', 'remainingMeanCents', 'costPerAvoidedCents', 'avoidedPer100Usd'].every(key => nullable(row[key], positive))) return false
    if (row.budgetCents !== null && !Number.isInteger(row.budgetCents)) return false
    if (row.budgetCents === null && ['spentMeanCents', 'remainingMeanCents', 'costPerAvoidedCents', 'avoidedPer100Usd'].some(key => row[key] !== null)) return false
    if (row.budgetCents !== null && (!positive(row.spentMeanCents) || !positive(row.remainingMeanCents))) return false
    if (row.omissionReasons === null) return true
    return Array.isArray(row.omissionReasons) && new Set(row.omissionReasons.map(reason => object(reason) ? reason.reason : null)).size === row.omissionReasons.length && row.omissionReasons.every(reason => object(reason) && typeof reason.reason === 'string' && reasons.has(reason.reason) && finite(reason.replicateDays) && Number.isInteger(reason.replicateDays) && reason.replicateDays > 0 && reason.replicateDays <= 18100)
  })
}
