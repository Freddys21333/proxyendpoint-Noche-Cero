import type { ConfigurationInput } from './api.ts'
export const defaults = {
  population: 1000, days: 90, beta: 0.08, sigma: 0.333333, gamma: 0.142857,
  initial: 1, vaccines: 100, interventionDay: 0, efficacy: 1, repetitions: 30,
  seed: 20261026, origin: 'random', node: 0,
}
export type Scenario = typeof defaults
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
  return errors
}

export function fromConfiguration(c: ConfigurationInput): Scenario {
  return { population: c.scenario.populationSize, days: c.scenario.days, beta: c.scenario.beta,
    sigma: c.scenario.sigma, gamma: c.scenario.gamma, initial: c.scenario.initialInfectious,
    vaccines: c.intervention.vaccines, interventionDay: c.intervention.interventionDay,
    efficacy: c.intervention.vaccineEfficacy, repetitions: c.repetitions, seed: c.rootSeed,
    origin: c.scenario.origin.kind, node: c.scenario.origin.value ?? 0 }
}

export function matchesLoadedScenario(scenario: Scenario, configuration: ConfigurationInput): boolean {
  if (validateScenario(scenario).length) return false
  const loaded = fromConfiguration(configuration)
  return (Object.keys(loaded) as (keyof Scenario)[]).every(key =>
    key === 'node' && scenario.origin !== 'node' || scenario[key] === loaded[key])
}

export function applyServerDefaults(current: Scenario, configuration: ConfigurationInput, edited: ReadonlySet<keyof Scenario>): Scenario {
  const incoming = fromConfiguration(configuration)
  return Object.fromEntries((Object.keys(incoming) as (keyof Scenario)[]).map(key => [key, edited.has(key) ? current[key] : incoming[key]])) as Scenario
}
