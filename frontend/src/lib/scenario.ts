import type { ConfigurationInput, CombinedPlan } from './api.ts'
import { sameCombinedPlan } from './resource-schedule.ts'
export const defaults = {
  population: 1000, days: 90, beta: 0.08, sigma: 0.333333, gamma: 0.142857,
  initial: 1, vaccines: 100, interventionDay: 0, efficacy: 1, repetitions: 30,
  seed: 20261026, origin: 'random', node: 0,
}
export type Scenario = typeof defaults & { combined?: CombinedPlan }
export type Preset = 'double_beta' | 'half_vaccines' | 'market_origin' | 'partial_efficacy_50'

export function applyPreset(base: Scenario, preset: Preset): Scenario {
  const transforms = {
    double_beta: { beta: Math.min(1, base.beta * 2) },
    half_vaccines: { vaccines: Math.floor(base.vaccines / 2) },
    market_origin: { origin: 'market' },
    partial_efficacy_50: { efficacy: 0.5 },
  }
  return { ...base, ...transforms[preset] }
}

export function validateScenario(s: Scenario): string[] {
  const errors: string[] = []
  const integer = (value: number, min: number, max: number, name: string) => {
    if (!Number.isInteger(value) || value < min || value > max) errors.push(`${name} must be an integer from ${min} to ${max}.`)
  }
  integer(s.population, 50, 2000, 'Population')
  integer(s.days, 1, 180, 'Horizon')
  integer(s.initial, 1, Math.min(20, s.population), 'Initial cases')
  integer(s.vaccines, 0, s.population, 'Vaccines')
  integer(s.interventionDay, 0, s.days, 'Intervention day')
  integer(s.repetitions, 2, 30, 'Replicates')
  integer(s.seed, 0, 4294967295, 'Seed')
  for (const [name, value] of [['Transmission', s.beta], ['Progression', s.sigma], ['Recovery', s.gamma], ['Efficacy', s.efficacy]] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) errors.push(`${name} must be between 0 and 1.`)
  }
  if (!['random', 'household', 'school', 'bus', 'market', 'neighborhood', 'node'].includes(s.origin)) errors.push('Choose a valid origin.')
  if (s.origin === 'node') integer(s.node, 0, s.population - 1, 'Node ID')
  if (s.combined) {
    const p = s.combined
    if (p.modelVersion !== 'combined-educational-v1') errors.push('Modelo combinado no admitido.')
    integer(p.budgetCents, 0, 100000000, 'Presupuesto en centavos')
    for (const cost of [p.vaccineCostCents, p.closureCostCents, p.brigadeCostCents]) integer(cost, 1, 1000000, 'Costo en centavos')
    integer(p.brigadeDailyCapacity, 0, s.population, 'Capacidad diaria de brigadas')
    if (!Number.isFinite(p.brigadeReduction) || p.brigadeReduction < 0 || p.brigadeReduction > 1) errors.push('La reducción de brigadas debe estar entre 0 y 100 %.')
    if (!['household', 'school', 'bus', 'market', 'neighborhood'].includes(p.closureContext)) errors.push('Tipo de contacto de cierre inválido.')
    for (const [start, days] of [[p.closureStart, p.closureDays], [p.brigadeStart, p.brigadeDays]]) {
      integer(start, 0, s.days, 'Inicio de intervención combinada')
      integer(days, 0, s.days, 'Duración de intervención combinada')
      if (days && start + days > s.days) errors.push('Las intervenciones combinadas deben caber en el horizonte.')
    }
    if (p.adaptiveStrategy) {
      const a = p.adaptiveStrategy
      if (a.modelVersion !== 'adaptive-policy-v1' || typeof a.ringVaccinationPriority !== 'boolean' || (a.enabled !== undefined && typeof a.enabled !== 'boolean') || ![a.closureInfectionThreshold, a.reopenInfectionThreshold].every(v => Number.isFinite(v) && v >= 0 && v <= 1) || a.reopenInfectionThreshold > a.closureInfectionThreshold) errors.push('Política adaptativa inválida: el umbral de reapertura no debe superar el de cierre.')
    }
    if (p.resourceSchedule) {
      const r = p.resourceSchedule
      if (r.modelVersion !== 'daily-inventory-v1' || !Array.isArray(r.deliveries) || r.deliveries.length > 512) errors.push('Calendario de entregas inválido.')
      integer(r.vaccineDailyCapacity, 0, s.population, 'Capacidad diaria de vacunación')
      integer(r.initialBrigadeSupplies, 0, 360000, 'Insumos iniciales de brigadas')
      const deliveries = Array.isArray(r.deliveries) ? r.deliveries.filter(row => row && typeof row === 'object') : []
      if (Array.isArray(r.deliveries) && deliveries.length !== r.deliveries.length) errors.push('Fila de entrega inválida.')
      for (const row of deliveries) {
        integer(row.day, 0, s.days, 'Día de entrega')
        integer(row.vaccines, 0, 2000, 'Dosis entregadas')
        integer(row.brigadeSupplies, 0, 360000, 'Insumos entregados')
      }
      if (s.vaccines + deliveries.reduce((n, row) => n + row.vaccines, 0) > s.population) errors.push('Las dosis iniciales más entregas no pueden superar la población en esta versión.')
      if (r.initialBrigadeSupplies + deliveries.reduce((n, row) => n + row.brigadeSupplies, 0) > 360000) errors.push('Los insumos totales de brigadas superan 360000.')
    }
  }
  return errors
}

export function fromConfiguration(c: ConfigurationInput): Scenario {
  return { population: c.scenario.populationSize, days: c.scenario.days, beta: c.scenario.beta,
    sigma: c.scenario.sigma, gamma: c.scenario.gamma, initial: c.scenario.initialInfectious,
    vaccines: c.intervention.vaccines, interventionDay: c.intervention.interventionDay,
    efficacy: c.intervention.vaccineEfficacy, repetitions: c.repetitions, seed: c.rootSeed,
    origin: c.scenario.origin.kind, node: c.scenario.origin.value ?? 0,
    ...(c.intervention.combined ? { combined: { ...c.intervention.combined } } : {}) }
}

export function matchesLoadedScenario(scenario: Scenario, configuration: ConfigurationInput): boolean {
  if (validateScenario(scenario).length) return false
  const loaded = fromConfiguration(configuration)
  const keys = new Set([...Object.keys(loaded), ...Object.keys(scenario)] as (keyof Scenario)[])
  return [...keys].every(key => {
    if (key === 'node' && scenario.origin !== 'node') return true
    if (key !== 'combined') return scenario[key] === loaded[key]
    if (!scenario.combined || !loaded.combined) return scenario.combined === loaded.combined
    return sameCombinedPlan(scenario.combined, loaded.combined)
  })
}

export function applyServerDefaults(current: Scenario, configuration: ConfigurationInput, edited: ReadonlySet<keyof Scenario>): Scenario {
  const incoming = fromConfiguration(configuration)
  const next = Object.fromEntries((Object.keys(incoming) as (keyof Scenario)[]).map(key => [key, edited.has(key) ? current[key] : incoming[key]])) as Scenario
  if (edited.has('combined') && current.combined) next.combined = { ...current.combined }
  return next
}
