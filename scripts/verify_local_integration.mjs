/** Functional integration matrix. Not the scientific T-22 protocol or an AWS benchmark.
 * Run from repo: node --experimental-strip-types scripts/verify_local_integration.mjs [baseUrl]
 * Requires the real local API and Vite proxy. Exports remain under ignored .tools/.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApiClient, ApiError } from '../frontend/src/lib/api.ts';
import { experimentZip } from '../frontend/src/lib/export-experiment.ts';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5174/v1';
if (!['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) throw new Error('Esta matriz solo admite un servidor local.');
const output = resolve(fileURLToPath(new URL('../.tools/', import.meta.url)), `validation-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(output, { recursive: true });
const api = createApiClient(baseUrl);
const health = await api.health();
const config = await api.config();
// Fixed before executing; no outcome-based case or seed selection.
const cases = [
  { name: 'manual', population: 60, days: 7, beta: 0.12, initial: 2, origin: {kind:'node', value:7}, vaccines: 12, day: 2, efficacy: 0.5, seed: 314159265 },
  { name: 'no-vaccines', population: 60, days: 7, beta: 0.12, initial: 2, origin: {kind:'node', value:7}, vaccines: 0, day: 2, efficacy: 0.5, seed: 314159265 },
  { name: 'no-transmission', population: 50, days: 4, beta: 0, initial: 1, origin: {kind:'market', value:null}, vaccines: 8, day: 0, efficacy: 0, seed: 271828182 },
];
const results = [];
for (const sample of cases) {
  const c = structuredClone(config.defaults);
  Object.assign(c, { rootSeed: sample.seed, repetitions: 2 });
  Object.assign(c.scenario, { populationSize: sample.population, days: sample.days, beta: sample.beta, initialInfectious: sample.initial, origin: sample.origin });
  Object.assign(c.intervention, { vaccines: sample.vaccines, interventionDay: sample.day, vaccineEfficacy: sample.efficacy });
  const started = performance.now();
  const preview = await api.preview(c, undefined, config.limits);
  const experiment = await api.compareForPlayback(c, preview.graphHash, undefined, config.limits);
  for (const rep of experiment.replicates) {
    for (const policy of ['none', 'random', 'targeted']) {
      const trace = rep.policies[policy];
      for (const daily of trace.daily) {
        assert.equal(daily.s + daily.e + daily.i + daily.r, sample.population);
        assert.ok(daily.cumulativeInfected >= sample.initial);
        if (sample.beta === 0) assert.equal(daily.cumulativeInfected, sample.initial);
      }
      assert.ok(trace.metrics.vaccinesAssigned <= sample.vaccines);
      assert.equal(trace.selections.length, trace.metrics.vaccinesAssigned);
      assert.ok(trace.selections.every(row => row.stateAtDecision === 'S' && row.day === sample.day));
      if (sample.efficacy === 0) assert.ok(trace.selections.every(row => !row.effective));
    }
    if (sample.vaccines === 0) {
      assert.deepEqual(rep.policies.none.daily, rep.policies.random.daily);
      assert.deepEqual(rep.policies.none.daily, rep.policies.targeted.daily);
    }
  }
  const jsonPath = resolve(output, `${sample.name}.json`);
  await writeFile(jsonPath, JSON.stringify(experiment));
  await writeFile(resolve(output, `${sample.name}.zip`), experimentZip(experiment));
  const summary = { name: sample.name, seed: sample.seed, hash: experiment.manifest.experimentHash, winner: experiment.recommendation.winner, confidence: experiment.recommendation.confidence, elapsedMs: Math.round(performance.now() - started), jsonPath };
  results.push(summary);
  console.log(JSON.stringify(summary));
}
const reference = structuredClone(config.defaults);
Object.assign(reference.scenario, { populationSize:50, days:2 });
Object.assign(reference.intervention, { vaccines:5, interventionDay:0 });
reference.repetitions = 2;
const preview = await api.preview(reference, undefined, config.limits);
await assert.rejects(api.compare(reference, `sha256:${'0'.repeat(64)}`), error => error instanceof ApiError && error.status === 409);
const invalid = structuredClone(reference); invalid.intervention.vaccines = 51;
await assert.rejects(api.preview(invalid), error => error instanceof ApiError && error.status === 422);
const oversized = await fetch(`${baseUrl}/scenarios/preview`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ padding:'x'.repeat(config.limits.maxRequestBytes + 1) }) });
assert.equal(oversized.status, 413);
const report = { kind:'functional-local-validation', generatedAt:new Date().toISOString(), baseUrl, buildCommit:health.buildCommit, engineVersion:health.engineVersion, results, errorsChecked:[409,422,413], scientificGate:false, moderatedHumanTest:false };
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(`REPORT=${resolve(output, 'report.json')}`);
