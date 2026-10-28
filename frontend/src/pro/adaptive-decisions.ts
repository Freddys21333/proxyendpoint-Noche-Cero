import type { CompareResponse } from '../lib/api.ts'
import { vaccinationContexts } from '../lib/vaccination.ts'

export type AdaptiveDailyRecord = {
  day: number
  s: number
  e: number
  i: number
  r: number
  closedContext?: string | null
  brigadesActive?: number
  budgetRemainingCents?: number
  vaccinesAssigned: number
  vaccinesEffective: number
  adaptiveDecisions: {
    enabled: boolean
    infectiousFraction: number
    closureActive: boolean | null
    brigadesAllowed: boolean
    ringVaccinationActive: boolean
    triggers: string[]
  }
}

const triggerLabels: Record<string, string> = {
  closure_triggered_by_threshold: 'Se alcanzó el umbral de cierre.',
  reopen_triggered_by_threshold: 'La fracción infecciosa bajó del umbral de reapertura.',
  closure_budget_exhausted: 'No alcanzó el presupuesto para el cierre.',
  closure_no_active_contacts: 'No había contactos activos de esa capa para cerrar.',
  no_infectious_hold_brigades: 'Brigadas pausadas: no hay personas infecciosas.',
  ring_vaccination_active: 'Prioridad de vacunación por anillo activa.',
  vaccine_stock_empty: 'No quedan dosis en inventario.',
  vaccine_capacity_zero: 'La capacidad diaria de vacunación es cero.',
  vaccine_budget_exhausted: 'No alcanzó el presupuesto para asignar más dosis.',
  vaccine_no_eligible: 'No hay personas susceptibles elegibles para vacunar.',
  brigade_capacity_zero: 'La capacidad diaria de brigadas es cero.',
  brigade_stock_empty: 'No quedan insumos para brigadas.',
  brigade_budget_exhausted: 'No alcanzó el presupuesto para las brigadas.',
  brigade_no_eligible: 'No hay personas elegibles para las brigadas.',
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function adaptiveDecisionRows(result: CompareResponse, replicateIndex: number): AdaptiveDailyRecord[] {
  if (!result.configuration.intervention.combined?.adaptiveStrategy) return []
  const replicate = result.replicates.find(row => row.index === replicateIndex)
  if (!replicate) return []
  const daily = replicate.policies.targeted.daily.filter((value): value is AdaptiveDailyRecord => {
    if (!record(value) || !Number.isInteger(value.day) || !['s', 'e', 'i', 'r'].every(key => Number.isInteger(value[key]))) return false
    const decision = value.adaptiveDecisions
    return record(decision)
      && typeof decision.enabled === 'boolean'
      && typeof decision.infectiousFraction === 'number' && Number.isFinite(decision.infectiousFraction)
      && (typeof decision.closureActive === 'boolean' || decision.closureActive === null)
      && typeof decision.brigadesAllowed === 'boolean'
      && typeof decision.ringVaccinationActive === 'boolean'
      && Array.isArray(decision.triggers) && decision.triggers.every(trigger => typeof trigger === 'string')
  })
  return daily.map(row => {
    const selections = replicate.policies.targeted.selections.filter(selection => selection.day === row.day)
    return { ...row, vaccinesAssigned: selections.length, vaccinesEffective: selections.filter(selection => selection.effective).length }
  })
}

export function adaptiveTriggerLabel(trigger: string): string {
  return triggerLabels[trigger] ?? `Motivo registrado: ${trigger}`
}

export function adaptiveStrategyDisabled(enabled: boolean | undefined): boolean {
  return enabled === false
}

export function adaptiveContextLabel(context: string): string {
  return vaccinationContexts[context] ?? context
}
