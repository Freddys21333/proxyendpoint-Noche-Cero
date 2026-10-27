import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, defaults, preview, validate } from './simulation.mjs';

const small = { populationSize: 50, days: 12, repetitions: 2, vaccines: 5, rootSeed: 7 };

test('la misma entrada conserva red y resultados', () => {
  assert.deepEqual(compare(small), compare(small));
  assert.equal(preview(small).graph.graphHash, compare(small).graph.graphHash);
});

test('sin vacunas, las tres políticas tienen trayectorias iguales', () => {
  const result = compare({ ...small, vaccines: 0 });
  assert.deepEqual(result.representative.none.daily, result.representative.random.daily);
  assert.deepEqual(result.representative.none.daily, result.representative.targeted.daily);
});

test('beta cero impide nuevos contagios y conserva población', () => {
  const result = compare({ ...small, beta: 0 });
  for (const policy of ['none', 'random', 'targeted']) {
    assert.equal(result.representative[policy].metrics.cumulativeInfected, 1);
    for (const day of result.representative[policy].daily) assert.equal(day.s + day.e + day.i + day.r, 50);
  }
});

test('las vacunas eficaces del día cero protegen antes del primer intervalo', () => {
  const result = compare({ ...small, vaccines: 50, vaccineEfficacy: 1, beta: 1, days: 1 });
  assert.equal(result.representative.random.metrics.cumulativeInfected, 1);
  assert.equal(result.representative.targeted.metrics.cumulativeInfected, 1);
});

test('rechaza configuración incompatible y campos desconocidos', () => {
  assert.throws(() => validate({ ...defaults, populationSize: 20, vaccines: 21 }), /compatibles/);
  assert.throws(() => validate({ unknown: 1 }), /desconocido/);
});
