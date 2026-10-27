import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'
import type { CompareResponse } from './api.ts'
import { csvTable, experimentFiles, experimentZip } from './export-experiment.ts'
const fixture = (): CompareResponse => JSON.parse(readFileSync(new URL('../../../schemas/examples/compare-response-vaccines.json', import.meta.url), 'utf8'))

test('CSV escapes quotes, commas, line breaks and lists with UTF-8 and empty nulls', () => {
  assert.equal(csvTable(['text', 'list', 'flag', 'empty'], [{ text: 'á,"x"\nfin', list: ['bus', 'school'], flag: false, empty: null }]), 'text,list,flag,empty\r\n"á,""x""\nfin","[""bus"",""school""]",false,\r\n')
})

test('ZIP contains the agreed tables and preserves data without changing the experiment', () => {
  const source = fixture(), before = JSON.stringify(source)
  const archive = unzipSync(experimentZip(source))
  assert.deepEqual(Object.keys(archive).sort(), ['configuration.json', 'manifest.json', 'comparison-summary.json', 'nodes.csv', 'edges.csv', 'daily.csv', 'metrics.csv', 'selections.csv', 'events.csv', 'summary.csv', 'comparisons.csv'].sort())
  const files = experimentFiles(source)
  for (const [name, data] of Object.entries(archive)) assert.equal(strFromU8(data), files[name])
  assert.equal(files['daily.csv'].trim().split('\r\n').length, 1 + source.configuration.repetitions * 3 * (source.configuration.scenario.days + 1))
  assert.equal(files['metrics.csv'].trim().split('\r\n').length, 1 + source.configuration.repetitions * 3)
  assert.deepEqual(JSON.parse(files['configuration.json']), source.configuration)
  assert.equal(JSON.parse(files['manifest.json']).experimentHash, source.manifest.experimentHash)
  assert.deepEqual(JSON.parse(files['manifest.json']).exportMetadata, { exportedEventsScope: 'representative' })
  assert.equal(JSON.stringify(source), before)
  assert.deepEqual(experimentZip(source), experimentZip(source))
})

test('exports negative comparisons and censored nulls without replacing them', () => {
  const source = fixture()
  source.pairedComparisons.gainVsRandom.values[0] = -2
  source.summaryByPolicy.targeted.outbreakDuration.mean = null
  const files = experimentFiles(source)
  assert.match(files['comparisons.csv'], /gainVsRandom,0,-2\r\n/)
  assert.ok(files['summary.csv'].includes('targeted,outbreakDuration,'))
  assert.deepEqual(JSON.parse(files['comparison-summary.json']), source.pairedComparisons)
})

test('nonrepresentative events cannot silently enter the archive', () => {
  const source = fixture()
  source.replicates.find(rep => rep.index !== source.representative.index)!.policies.none.events = []
  assert.throws(() => experimentZip(source), /representativa/)
})
