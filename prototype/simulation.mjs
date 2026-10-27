import { createHash } from 'node:crypto';

const contexts = ['household', 'school', 'bus', 'market', 'neighborhood'];
const weights = { household: 1, school: 0.6, bus: 0.45, market: 0.5, neighborhood: 0.2 };
export const defaults = { populationSize: 160, days: 45, beta: 0.08, sigma: 1 / 3, gamma: 1 / 7, initialInfectious: 1, vaccines: 16, interventionDay: 0, vaccineEfficacy: 1, repetitions: 8, rootSeed: 20261026, origin: 'random', closureContext: 'none', closureStart: 7, closureEnd: 14 };

function fail(message) { throw Object.assign(new Error(message), { status: 422 }); }
export function validate(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('La configuración debe ser un objeto.');
  for (const key of Object.keys(input)) if (!(key in defaults)) fail(`Campo desconocido: ${key}`);
  const c = { ...defaults, ...input };
  for (const [key, min, max] of [['populationSize', 20, 400], ['days', 1, 90], ['initialInfectious', 1, 20], ['vaccines', 0, 400], ['interventionDay', 0, 90], ['repetitions', 1, 30], ['rootSeed', 0, 4294967295], ['closureStart', 0, 90], ['closureEnd', 0, 90]]) {
    if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max) fail(`${key} debe ser entero entre ${min} y ${max}.`);
  }
  for (const key of ['beta', 'sigma', 'gamma', 'vaccineEfficacy']) if (typeof c[key] !== 'number' || !Number.isFinite(c[key]) || c[key] < 0 || c[key] > 1) fail(`${key} debe estar entre 0 y 1.`);
  if (c.initialInfectious > c.populationSize || c.vaccines > c.populationSize || c.interventionDay > c.days || (c.closureContext !== 'none' && (c.closureStart > c.closureEnd || c.closureEnd > c.days))) fail('La población, las vacunas y los días deben ser compatibles.');
  if (!['random', 'market', 'school', 'bus'].includes(c.origin)) fail('Origen inválido.');
  if (!['none', ...contexts].includes(c.closureContext)) fail('Capa de cierre inválida.');
  return c;
}
function hash32(...parts) {
  let h = 2166136261;
  for (const part of parts.join(':')) { h ^= part.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function random(...parts) { return hash32(...parts) / 4294967296; }
function shuffle(items, ...seed) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random(...seed, i) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function addEdge(map, u, v, context) {
  if (u === v) return;
  const a = Math.min(u, v), b = Math.max(u, v);
  map.set(`${a}:${b}:${context}`, { u: a, v: b, context, weight: weights[context] });
}
export function makeGraph(c) {
  const n = c.populationSize, ids = Array.from({ length: n }, (_, i) => i);
  const nodes = ids.map(id => ({ id, household: -1, school: -1, bus: -1, market: false, neighborhood: -1 }));
  const edgeMap = new Map();
  let order = shuffle(ids, c.rootSeed, 'households'), cursor = 0, household = 0;
  while (cursor < n) {
    const size = 1 + Math.floor(random(c.rootSeed, 'size', household) * 6), group = order.slice(cursor, cursor + size);
    for (const id of group) nodes[id].household = household;
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) addEdge(edgeMap, group[i], group[j], 'household');
    cursor += size; household++;
  }
  order = shuffle(ids, c.rootSeed, 'roles');
  const students = shuffle(order.slice(0, Math.floor(n * 0.25)), c.rootSeed, 'schools');
  for (let s = 0; s < students.length; s += 25) {
    const group = students.slice(s, s + 25), school = Math.floor(s / 25);
    group.forEach(id => { nodes[id].school = school; });
    for (let i = 0; i < group.length; i++) for (const offset of [1, 2, 3]) if (group.length > offset) addEdge(edgeMap, group[i], group[(i + offset) % group.length], 'school');
  }
  const riders = shuffle(ids, c.rootSeed, 'buses').slice(0, Math.floor(n * 0.4));
  for (let i = 0; i < riders.length; i++) nodes[riders[i]].bus = Math.floor(i / 40);
  const workers = order.slice(Math.floor(n * 0.25), Math.floor(n * 0.8));
  const vendors = shuffle(workers, c.rootSeed, 'vendors').slice(0, Math.max(1, Math.floor(workers.length * 0.1)));
  vendors.forEach(id => { nodes[id].market = true; });
  const neighborhoods = shuffle(ids, c.rootSeed, 'neighborhoods');
  neighborhoods.forEach((id, i) => { nodes[id].neighborhood = i % 5; });
  for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) {
    if (nodes[u].neighborhood === nodes[v].neighborhood && random(c.rootSeed, 'neighborhood', u, v) < 0.02) addEdge(edgeMap, u, v, 'neighborhood');
    if (nodes[u].bus >= 0 && nodes[u].bus === nodes[v].bus) addEdge(edgeMap, u, v, 'bus');
  }
  for (const vendor of vendors) for (const visitor of ids) if (vendor !== visitor && !nodes[visitor].market) addEdge(edgeMap, vendor, visitor, 'market');
  const edges = [...edgeMap.values()].sort((a, b) => a.u - b.u || a.v - b.v || contexts.indexOf(a.context) - contexts.indexOf(b.context)).map((e, id) => ({ id, ...e }));
  const graphHash = 'sha256:' + createHash('sha256').update(JSON.stringify({ seed: c.rootSeed, n, edges, nodes })).digest('hex');
  return { nodes, edges, graphHash };
}
function active(edge, day, c) {
  if (c.closureContext === edge.context && day >= c.closureStart && day < c.closureEnd) return false;
  const weekday = day % 7;
  if (edge.context === 'school' && weekday >= 5) return false;
  if ((edge.context === 'bus' || edge.context === 'market') && weekday === 6) return false;
  if (edge.context === 'bus') return random(c.rootSeed, 'bus-contact', day, edge.id) < 0.16;
  if (edge.context === 'market') return random(c.rootSeed, 'market-contact', day, edge.id) < 0.16;
  return true;
}
function initialIds(c, graph, rep) {
  let pool = graph.nodes.filter(node => c.origin === 'random' || (c.origin === 'market' && node.market) || (c.origin === 'school' && node.school >= 0) || (c.origin === 'bus' && node.bus >= 0)).map(node => node.id);
  const first = pool[Math.floor(random(c.rootSeed, rep, 'initial') * pool.length)];
  const rest = shuffle(graph.nodes.map(n => n.id).filter(id => id !== first), c.rootSeed, rep, 'remaining').slice(0, c.initialInfectious - 1);
  return [first, ...rest].sort((a, b) => a - b);
}
function simulate(c, graph, rep, policy, keepFrames) {
  const n = c.populationSize, state = Array(n).fill('S'), initial = initialIds(c, graph, rep);
  initial.forEach(id => { state[id] = 'I'; });
  const ever = new Set(initial), selections = [], frames = [], daily = [];
  let assigned = 0, effective = 0;
  function vaccinate(day) {
    if (policy === 'none' || day !== c.interventionDay) return;
    const eligible = graph.nodes.filter(node => state[node.id] === 'S').map(node => node.id);
    let ranked;
    if (policy === 'random') ranked = shuffle(eligible, c.rootSeed, rep, 'policy-random');
    else {
      const scores = new Float64Array(n);
      for (const edge of graph.edges) if (active(edge, day, c) && state[edge.u] === 'S' && state[edge.v] === 'S') { scores[edge.u] += edge.weight; scores[edge.v] += edge.weight; }
      ranked = eligible.sort((a, b) => scores[b] - scores[a] || a - b);
    }
    for (const [index, id] of ranked.slice(0, c.vaccines).entries()) {
      const succeeds = random(c.rootSeed, rep, 'vaccine', day, id) < c.vaccineEfficacy;
      assigned++; if (succeeds) { effective++; state[id] = 'R'; }
      selections.push({ nodeId: id, rank: index + 1, effective: succeeds });
    }
  }
  function record(day) {
    const row = { day, s: 0, e: 0, i: 0, r: 0, cumulativeInfected: ever.size };
    for (const value of state) row[value.toLowerCase()]++;
    daily.push(row);
    if (keepFrames) frames.push([...state]);
  }
  vaccinate(0); record(0);
  for (let day = 0; day < c.days; day++) {
    const next = [...state];
    for (const edge of graph.edges) {
      if (!active(edge, day, c)) continue;
      let target = -1;
      if (state[edge.u] === 'I' && state[edge.v] === 'S') target = edge.v;
      else if (state[edge.v] === 'I' && state[edge.u] === 'S') target = edge.u;
      if (target >= 0 && random(c.rootSeed, rep, 'transmission', day, edge.id) < c.beta * edge.weight) { next[target] = 'E'; ever.add(target); }
    }
    for (let id = 0; id < n; id++) {
      if (state[id] === 'E' && random(c.rootSeed, rep, 'progression-E', day, id) < c.sigma) next[id] = 'I';
      if (state[id] === 'I' && random(c.rootSeed, rep, 'progression-I', day, id) < c.gamma) next[id] = 'R';
    }
    for (let id = 0; id < n; id++) state[id] = next[id];
    vaccinate(day + 1); record(day + 1);
  }
  const peak = Math.max(...daily.map(d => d.i));
  return { initial, daily, frames, selections, metrics: { cumulativeInfected: ever.size, peakInfectious: peak, peakDay: daily.find(d => d.i === peak).day, finalInfectious: daily.at(-1).i, outbreakDuration: daily.find(d => d.e + d.i === 0)?.day ?? null, vaccinesAssigned: assigned, vaccinesEffective: effective } };
}
function stats(values) { const a = [...values].sort((x, y) => x - y); const q = p => { const at = (a.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at); return a[lo] + (a[hi] - a[lo]) * (at - lo); }; return { mean: values.reduce((x, y) => x + y, 0) / values.length, median: q(0.5), p05: q(0.05), p95: q(0.95) }; }
export function preview(input) {
  const configuration = validate(input), graph = makeGraph(configuration);
  return { configuration, graph, initial: initialIds(configuration, graph, 0), note: 'Prototipo local: red y resultados sintéticos, sin validación científica ni contrato AWS.' };
}
export function compare(input) {
  const configuration = validate(input), graph = makeGraph(configuration), policies = ['none', 'random', 'targeted'];
  const reps = [];
  for (let rep = 0; rep < configuration.repetitions; rep++) {
    const result = {};
    for (const policy of policies) result[policy] = simulate(configuration, graph, rep, policy, rep === 0);
    reps.push(result);
  }
  const summary = Object.fromEntries(policies.map(policy => [policy, stats(reps.map(r => r[policy].metrics.cumulativeInfected))]));
  const curves = Object.fromEntries(policies.map(policy => [policy, Array.from({ length: configuration.days + 1 }, (_, day) => ({ day, ...Object.fromEntries(['s', 'e', 'i', 'r', 'cumulativeInfected'].map(key => [key, stats(reps.map(r => r[policy].daily[day][key])).mean])) }))]));
  const gain = stats(reps.map(r => r.random.metrics.cumulativeInfected - r.targeted.metrics.cumulativeInfected));
  const winner = policies.reduce((best, p) => summary[p].mean < summary[best].mean ? p : best, policies[0]);
  return { configuration, graph, summary, curves, gain, winner, representative: Object.fromEntries(policies.map(policy => [policy, reps[0][policy]])), note: 'Resultados exploratorios de una red sintética. La réplica animada es la 0; la recomendación es descriptiva.' };
}
