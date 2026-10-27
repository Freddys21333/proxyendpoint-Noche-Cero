import type { AdaptiveStrategy, ConfigurationInput, DailyRow, Policy } from './api.ts'

export const adaptiveModelVersion = 'adaptive-policy-v1'

export const triggerLabels = {
  closure_triggered_by_threshold: 'Cierre solicitado por umbral de infección',
  closure_budget_exhausted: 'Cierre omitido: presupuesto insuficiente',
  reopen_triggered_by_threshold: 'Reapertura por umbral de infección',
  no_infectious_hold_brigades: 'Brigadas en pausa: sin infecciosos',
  ring_vaccination_active: 'Prioridad de anillo activa',
  closure_no_active_contacts: 'Cierre omitido: sin contactos activos',
  vaccine_stock_empty: 'Vacunas omitidas: inventario vacío',
  vaccine_capacity_zero: 'Vacunas omitidas: capacidad diaria cero',
  vaccine_budget_exhausted: 'Vacunas omitidas: presupuesto insuficiente',
  vaccine_no_eligible: 'Vacunas omitidas: sin susceptibles elegibles',
  brigade_capacity_zero: 'Brigadas omitidas: capacidad diaria cero',
  brigade_stock_empty: 'Brigadas omitidas: sin insumos',
  brigade_budget_exhausted: 'Brigadas omitidas: presupuesto insuficiente',
  brigade_no_eligible: 'Brigadas omitidas: sin elegibles',
} as const

export type AdaptiveTrigger = keyof typeof triggerLabels

const omissionTriggers: ReadonlySet<string> = new Set<AdaptiveTrigger>([
  'closure_budget_exhausted',
  'closure_no_active_contacts',
  'vaccine_stock_empty',
  'vaccine_capacity_zero',
  'vaccine_budget_exhausted',
  'vaccine_no_eligible',
  'brigade_capacity_zero',
  'brigade_stock_empty',
  'brigade_budget_exhausted',
  'brigade_no_eligible',
])

export function triggerLabel(trigger: string): string {
  return triggerLabels[trigger as AdaptiveTrigger] ?? trigger
}

export function isOmissionTrigger(trigger: string): boolean {
  return omissionTriggers.has(trigger)
}

export function adaptiveStrategyOf(configuration?: ConfigurationInput | null): AdaptiveStrategy | undefined {
  return configuration?.intervention.combined?.adaptiveStrategy
}

export function adaptiveEnabled(configuration?: ConfigurationInput | null): boolean {
  const strategy = adaptiveStrategyOf(configuration)
  return Boolean(strategy && strategy.enabled !== false)
}

export function policyVariantLabel(policy: Policy, configuration?: ConfigurationInput | null): string {
  const labels: Record<Policy, string> = { none: 'Sin intervención', random: 'Aleatoria', targeted: 'Dirigida' }
  if (policy !== 'targeted') return labels[policy]
  const strategy = adaptiveStrategyOf(configuration)
  if (!strategy) return labels.targeted
  return `${labels.targeted} · adaptativa v1${strategy.enabled === false ? ' (inactiva)' : ''}`
}

export type AdaptiveDecisionRow = {
  day: number
  infectiousFraction: number
  closureActive: boolean | null
  brigadesAllowed: boolean
  ringVaccinationActive: boolean
  triggers: string[]
  closedContext: string | null
  brigadesActive: number | null
}

export function decisionRows(daily?: readonly DailyRow[] | null): AdaptiveDecisionRow[] {
  if (!daily) return []
  return daily.flatMap<AdaptiveDecisionRow>(row => {
    const decisions = row.adaptiveDecisions
    if (!decisions) return []
    const hasRecord = decisions.enabled || decisions.triggers.length > 0 || decisions.closureActive === true
    if (!hasRecord) return []
    return [{
      day: row.day,
      infectiousFraction: decisions.infectiousFraction,
      closureActive: decisions.closureActive,
      brigadesAllowed: decisions.brigadesAllowed,
      ringVaccinationActive: decisions.ringVaccinationActive,
      triggers: decisions.triggers,
      closedContext: row.closedContext ?? null,
      brigadesActive: row.brigadesActive ?? null,
    }]
  })
}

export type AdaptiveSummary = {
  days: number
  closureDays: number
  closureRequests: number
  closureRequestsNotExecuted: number
  brigadeHoldDays: number
  ringDays: number
  omissions: { trigger: string; label: string; count: number }[]
}

export function adaptiveSummary(rows: readonly AdaptiveDecisionRow[]): AdaptiveSummary {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const trigger of row.triggers) {
      if (isOmissionTrigger(trigger)) counts.set(trigger, (counts.get(trigger) ?? 0) + 1)
    }
  }
  return {
    days: rows.length,
    closureDays: rows.filter(row => row.closureActive === true).length,
    closureRequests: rows.filter(row => row.triggers.includes('closure_triggered_by_threshold')).length,
    closureRequestsNotExecuted: rows.filter(row => row.triggers.includes('closure_triggered_by_threshold') && row.closureActive !== true).length,
    brigadeHoldDays: rows.filter(row => row.triggers.includes('no_infectious_hold_brigades')).length,
    ringDays: rows.filter(row => row.ringVaccinationActive).length,
    omissions: [...counts.entries()]
      .map(([trigger, count]) => ({ trigger, label: triggerLabel(trigger), count }))
      .sort((a, b) => b.count - a.count || a.trigger.localeCompare(b.trigger)),
  }
}
