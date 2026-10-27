import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PresetError, presetCoversScenario, presetScenario, presetSummary, readDenguePreset } from './dengue-preset.ts'
import { defaults } from './scenario.ts'

const published = () => JSON.parse(readFileSync(new URL('./dengue-preset.json', import.meta.url), 'utf8'))

test('lee el preset publicado sin recalcular el ajuste', () => {
  const preset = readDenguePreset(published())
  assert.equal(preset.presetId, 'manabi-dengue-2025-v1')
  assert.equal(preset.schemaVersion, 'p06-dengue-preset-v1')
  assert.equal(preset.status, 'fitted-not-validated')
  assert.match(preset.label, /calibrado/i)
  assert.deepEqual(preset.dataset.years, [2025, 2026])
  assert.equal(preset.parameters.fitWindow.fitEnd, 35)
  assert.equal(preset.parameters.fitWindow.validationEnd, 53)
  assert.equal(preset.identifiability.identified, true)
  assert.ok(preset.identifiability.tenPercentDelta.up < -2)
  assert.ok(preset.limits.length >= 7)
  assert.equal(preset.engine.bridgeCheck.replicates, 10)
})

test('un preset alterado no se carga y no rompe el modo ficticio', () => {
  const broken = (mutate: (copy: Record<string, unknown>) => void) => {
    const copy = published()
    mutate(copy)
    return () => readDenguePreset(copy)
  }
  assert.throws(broken(copy => { copy.schemaVersion = 'otro' }), PresetError)
  assert.throws(broken(copy => { copy.status = 'calibrado' }), PresetError)
  assert.throws(broken(copy => { copy.limits = [] }), PresetError)
  assert.throws(broken(copy => { (copy.parameters as Record<string, unknown>).beta = 'alta' }), PresetError)
  assert.throws(broken(copy => { (copy.engine as { bridgeCheck: { ratioMedian: unknown } }).bridgeCheck.ratioMedian = Number.NaN }), PresetError)
  assert.throws(broken(copy => { (copy.dataset as { years: unknown[] }).years = ['2025'] }), PresetError)
})

test('cargar el preset impone la parte epidemiológica y respeta la intervención', () => {
  const preset = readDenguePreset(published())
  const applied = presetScenario(preset)
  const scenario = { ...defaults, vaccines: 42, efficacy: 0.5, repetitions: 7, seed: 99, ...applied }
  assert.equal(scenario.population, 1000)
  assert.equal(scenario.days, 90)
  assert.equal(scenario.beta, preset.engine.configuration.scenario.beta)
  assert.equal(scenario.sigma, preset.engine.configuration.scenario.sigma)
  assert.equal(scenario.gamma, preset.engine.configuration.scenario.gamma)
  assert.equal(scenario.initial, 3)
  assert.equal(scenario.origin, 'random')
  assert.equal(scenario.vaccines, 42)
  assert.equal(scenario.efficacy, 0.5)
  assert.equal(scenario.repetitions, 7)
  assert.equal(scenario.seed, 99)
  assert.notEqual(scenario.beta, defaults.beta)
})

test('el preset solo se considera activo mientras el escenario no se edite', () => {
  const preset = readDenguePreset(published())
  const applied = { ...defaults, ...presetScenario(preset) }
  assert.equal(presetCoversScenario(preset, applied), true)
  assert.equal(presetCoversScenario(preset, { ...applied, beta: defaults.beta }), false)
  assert.equal(presetCoversScenario(preset, { ...applied, vaccines: 12 }), true)
  assert.equal(presetCoversScenario(preset, { ...applied, population: 800 }), false)
})

test('el resumen muestra la ventana retenida, el error y la desviación del motor', () => {
  const preset = readDenguePreset(published())
  const summary = presetSummary(preset)
  assert.match(summary.window, /Ajuste S1–S35 · validación S36–S53/)
  assert.match(summary.validation, /MAE retenido/)
  assert.match(summary.validation, /cobertura 95 %/)
  assert.match(summary.bridge, /brotes extintos/)
})
