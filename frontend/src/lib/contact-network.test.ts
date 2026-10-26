import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDemoNetwork,
  countDemoStates,
  describeDemoNode,
} from "./contact-network.ts";

test("SEIR indicators count the existing demonstration nodes, not the scenario population", () => {
  const graph = buildDemoNetwork();
  const counts = countDemoStates(graph);
  assert.deepEqual(counts, { S: 88, E: 6, I: 1, R: 15 });
  assert.equal(
    Object.values(counts).reduce((sum, value) => sum + value, 0),
    110,
  );
  assert.equal(graph.filter((item) => !("source" in item.data)).length, 110);
});

test("selected-node context reports the actual demo state, layer and distinct contacts", () => {
  const graph = buildDemoNetwork();
  assert.deepEqual(describeDemoNode(graph, "8"), {
    id: "8",
    state: "I",
    group: "Households",
    contacts: 9,
  });
  assert.equal(describeDemoNode(graph, "not-a-node"), undefined);
  assert.equal(describeDemoNode(graph, "0")?.state, "E");
});

test("exploration does not alter the fixed demonstration graph", () => {
  const graph = buildDemoNetwork();
  const before = JSON.stringify(graph);
  describeDemoNode(graph, "8");
  countDemoStates(graph);
  assert.equal(JSON.stringify(graph), before);
  assert.deepEqual(buildDemoNetwork(), graph);
});
