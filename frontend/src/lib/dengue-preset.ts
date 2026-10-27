import type { Scenario } from './scenario.ts'

/** Contrato mínimo que la UI necesita del preset calibrado de P-06. */
export type DenguePreset = {
  presetId: string
  schemaVersion: string
  hash: string
  status: 'fitted-not-validated' | 'fitted-and-validated'
  label: string
  dataset: { datasetId: string; csvSha256: string; years: number[] }
  parameters: {
    beta: number
    reporting: number
    r0: number
    dispersion: number
    logLikelihood: number
    fitWindow: { fitStart: number; fitEnd: number; validationStart: number; validationEnd: number }
  }
  uncertainty: { beta: { p05: number; p50: number; p95: number } }
  metrics: {
    fit: { mae: number; coverage95: number }
    validation: { mae: number; coverage95: number }
  }
  identifiability: {
    identified: boolean
    withinTwoLogUnits: { min: number; max: number; count: number }
    tenPercentDelta: { up: number; down: number }
    note: string
  }
  engine: {
    configuration: {
      scenario: { populationSize: number; days: number; beta: number; sigma: number; gamma: number; initialInfectious: number; origin: { kind: string } }
    }
    meanDailyWeightPerNode: number
    r0: number
    betaApproximation: number
    bridgeCheck: { replicates: number; extinctions: number; ratioMedian: number | null }
  }
  limits: string[]
}

export class PresetError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const number = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new PresetError(`${path} debe ser un número finito.`)
  return value
}

const record = (value: unknown, path: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new PresetError(`${path} debe ser un objeto.`)
  return value
}

const text = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !value.length) throw new PresetError(`${path} debe ser texto no vacío.`)
  return value
}

/**
 * Valida el preset publicado por `scripts/p06_calibrate.py`.
 *
 * La UI no recalcula el ajuste: solo comprueba que el archivo tiene la forma
 * esperada y que sus cifras son finitas. Un preset inválido no debe romper el
 * modo ficticio; se descarta y se informa.
 */
export function readDenguePreset(raw: unknown): DenguePreset {
  const root = record(raw, 'preset')
  if (root.schemaVersion !== 'p06-dengue-preset-v1') throw new PresetError('Versión de preset no admitida.')
  const status = root.status
  if (status !== 'fitted-not-validated' && status !== 'fitted-and-validated') throw new PresetError('Estado de preset no admitido.')
  const dataset = record(root.dataset, 'dataset')
  const parameters = record(root.parameters, 'parameters')
  const window = record(parameters.fitWindow, 'parameters.fitWindow')
  const uncertainty = record(root.uncertainty, 'uncertainty')
  const beta = record(uncertainty.beta, 'uncertainty.beta')
  const metrics = record(root.metrics, 'metrics')
  const fit = record(metrics.fit, 'metrics.fit')
  const validation = record(metrics.validation, 'metrics.validation')
  const identifiability = record(root.identifiability, 'identifiability')
  const flat = record(identifiability.withinTwoLogUnits, 'identifiability.withinTwoLogUnits')
  const tenPercent = record(identifiability.tenPercentDelta, 'identifiability.tenPercentDelta')
  const engine = record(root.engine, 'engine')
  const configuration = record(engine.configuration, 'engine.configuration')
  const scenario = record(configuration.scenario, 'engine.configuration.scenario')
  const origin = record(scenario.origin, 'engine.configuration.scenario.origin')
  const bridge = record(engine.bridgeCheck, 'engine.bridgeCheck')
  const limits = root.limits
  if (!Array.isArray(limits) || !limits.length || limits.some(item => typeof item !== 'string')) {
    throw new PresetError('limits debe ser una lista de textos.')
  }
  const years = dataset.years
  if (!Array.isArray(years) || years.some(year => typeof year !== 'number')) {
    throw new PresetError('dataset.years debe ser una lista de años.')
  }
  return {
    presetId: text(root.presetId, 'presetId'),
    schemaVersion: root.schemaVersion,
    hash: text(root.hash, 'hash'),
    status,
    label: text(root.label, 'label'),
    dataset: {
      datasetId: text(dataset.datasetId, 'dataset.datasetId'),
      csvSha256: text(dataset.csvSha256, 'dataset.csvSha256'),
      years: years as number[],
    },
    parameters: {
      beta: number(parameters.beta, 'parameters.beta'),
      reporting: number(parameters.reporting, 'parameters.reporting'),
      r0: number(parameters.r0, 'parameters.r0'),
      dispersion: number(parameters.dispersion, 'parameters.dispersion'),
      logLikelihood: number(parameters.logLikelihood, 'parameters.logLikelihood'),
      fitWindow: {
        fitStart: number(window.fitStart, 'parameters.fitWindow.fitStart'),
        fitEnd: number(window.fitEnd, 'parameters.fitWindow.fitEnd'),
        validationStart: number(window.validationStart, 'parameters.fitWindow.validationStart'),
        validationEnd: number(window.validationEnd, 'parameters.fitWindow.validationEnd'),
      },
    },
    uncertainty: {
      beta: {
        p05: number(beta.p05, 'uncertainty.beta.p05'),
        p50: number(beta.p50, 'uncertainty.beta.p50'),
        p95: number(beta.p95, 'uncertainty.beta.p95'),
      },
    },
    metrics: {
      fit: {
        mae: number(fit.mae, 'metrics.fit.mae'),
        coverage95: number(fit.coverage95, 'metrics.fit.coverage95'),
      },
      validation: {
        mae: number(validation.mae, 'metrics.validation.mae'),
        coverage95: number(validation.coverage95, 'metrics.validation.coverage95'),
      },
    },
    identifiability: {
      identified: identifiability.identified === true,
      withinTwoLogUnits: {
        min: number(flat.min, 'identifiability.withinTwoLogUnits.min'),
        max: number(flat.max, 'identifiability.withinTwoLogUnits.max'),
        count: number(flat.count, 'identifiability.withinTwoLogUnits.count'),
      },
      tenPercentDelta: {
        up: number(tenPercent.up, 'identifiability.tenPercentDelta.up'),
        down: number(tenPercent.down, 'identifiability.tenPercentDelta.down'),
      },
      note: text(identifiability.note, 'identifiability.note'),
    },
    engine: {
      configuration: {
        scenario: {
          populationSize: number(scenario.populationSize, 'scenario.populationSize'),
          days: number(scenario.days, 'scenario.days'),
          beta: number(scenario.beta, 'scenario.beta'),
          sigma: number(scenario.sigma, 'scenario.sigma'),
          gamma: number(scenario.gamma, 'scenario.gamma'),
          initialInfectious: number(scenario.initialInfectious, 'scenario.initialInfectious'),
          origin: { kind: text(origin.kind, 'scenario.origin.kind') },
        },
      },
      meanDailyWeightPerNode: number(engine.meanDailyWeightPerNode, 'engine.meanDailyWeightPerNode'),
      r0: number(engine.r0, 'engine.r0'),
      betaApproximation: number(engine.betaApproximation, 'engine.betaApproximation'),
      bridgeCheck: {
        replicates: number(bridge.replicates, 'engine.bridgeCheck.replicates'),
        extinctions: number(bridge.extinctions, 'engine.bridgeCheck.extinctions'),
        ratioMedian: bridge.ratioMedian === null ? null : number(bridge.ratioMedian, 'engine.bridgeCheck.ratioMedian'),
      },
    },
    limits: limits as string[],
  }
}

/**
 * Campos del escenario que impone el preset.
 *
 * Solo toca la parte epidemiológica y la red con la que se midió `w̄`; vacunas,
 * eficacia, réplicas y semilla siguen siendo del usuario. El `beta` del motor ya
 * está traducido desde `R₀` y `w̄`, no es el `beta` de mezcla homogénea.
 */
export function presetScenario(preset: DenguePreset): Partial<Scenario> {
  const scenario = preset.engine.configuration.scenario
  return {
    population: scenario.populationSize,
    days: scenario.days,
    beta: scenario.beta,
    sigma: scenario.sigma,
    gamma: scenario.gamma,
    initial: scenario.initialInfectious,
    origin: scenario.origin.kind,
    node: 0,
  }
}

/** `true` cuando el escenario actual sigue siendo el del preset, sin ediciones. */
export function presetCoversScenario(preset: DenguePreset, scenario: Scenario): boolean {
  const expected = presetScenario(preset)
  return (Object.keys(expected) as (keyof Scenario)[]).every(key => scenario[key] === expected[key])
}

const nf = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })

/** Resumen numérico para la UI: ventana, error retenido y desviación del motor. */
export function presetSummary(preset: DenguePreset): { window: string; validation: string; bridge: string } {
  const { fitStart, fitEnd, validationStart, validationEnd } = preset.parameters.fitWindow
  const ratio = preset.engine.bridgeCheck.ratioMedian
  return {
    window: `Ajuste S${fitStart}–S${fitEnd} · validación S${validationStart}–S${validationEnd}`,
    validation: `MAE retenido ${nf.format(preset.metrics.validation.mae)} · cobertura 95 % ${nf.format(preset.metrics.validation.coverage95 * 100)} %`,
    bridge: `Motor: ${preset.engine.bridgeCheck.extinctions}/${preset.engine.bridgeCheck.replicates} brotes extintos${ratio === null ? '' : ` · crecimiento ${nf.format(ratio)}× la teoría`}`,
  }
}
