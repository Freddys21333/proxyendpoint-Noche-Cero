import { test } from "node:test";
import assert from "node:assert/strict";
import {
  temporalDemo,
  readDemoFrame,
  playbackReducer,
  initialPlayback,
} from "./temporal-demo.ts";

test("the authored demo has 21 coherent daily frames of 110 people and a single initial case", () => {
  assert.equal(temporalDemo.frames.length, 21);
  assert.deepEqual(readDemoFrame(0).counts, { S: 109, E: 0, I: 1, R: 0 });
  for (let day = 0; day <= 20; day++) {
    const frame = readDemoFrame(day);
    assert.equal(frame.states.length, 110);
    assert.equal(
      Object.values(frame.counts).reduce((sum, n) => sum + n, 0),
      110,
    );
    assert.deepEqual(
      frame.events,
      temporalDemo.events.filter((event) => event.day === day),
    );
  }
  assert.deepEqual(readDemoFrame(20).counts, { S: 97, E: 0, I: 0, R: 13 });
});

test("contacts reference a real edge and an infectious source in the preceding frame; vaccines only change susceptible nodes", () => {
  for (const event of temporalDemo.events) {
    if (!event.day) continue;
    const before = readDemoFrame(event.day - 1).states;
    assert.equal(before[event.nodeId], event.from);
    assert.equal(readDemoFrame(event.day).states[event.nodeId], event.to);
    if (event.cause === "contact") {
      assert.equal(before[event.sourceNodeId!], "I");
      const edge = temporalDemo.edges[event.edgeId!];
      assert.ok([edge.u, edge.v].includes(event.nodeId));
      assert.ok([edge.u, edge.v].includes(event.sourceNodeId!));
    }
    if (event.cause === "vaccine") assert.equal(event.from, "S");
  }
  assert.throws(() => readDemoFrame(-1), RangeError);
  assert.throws(() => readDemoFrame(21), RangeError);
});

test("play, pause, seek, step, speed, reset and completion share one bounded day", () => {
  const reduce = playbackReducer;
  let state = reduce(initialPlayback, { type: "play" });
  state = reduce(state, { type: "tick" });
  assert.equal(state.day, 1);
  state = reduce(state, { type: "pause" });
  assert.deepEqual(reduce(state, { type: "tick" }), state);
  state = reduce(state, { type: "speed", value: 2 });
  assert.equal(state.speed, 2);
  state = reduce(state, { type: "seek", day: 3 });
  assert.equal(state.day, 3);
  assert.equal(state.playing, false);
  state = reduce(state, { type: "step" });
  assert.equal(state.day, 4);
  assert.equal(state.playing, false);
  state = reduce({ ...state, day: 19, playing: true }, { type: "tick" });
  assert.equal(state.day, 20);
  assert.equal(state.playing, false);
  assert.equal(reduce(state, { type: "play" }).day, 0);
  assert.deepEqual(reduce(state, { type: "reset" }), {
    day: 0,
    playing: false,
    speed: 2,
  });
});

test("seeking backwards restores the exact recorded states without altering the fixture", () => {
  const before = JSON.stringify(temporalDemo);
  const first = readDemoFrame(3);
  readDemoFrame(18);
  assert.deepEqual(readDemoFrame(3), first);
  assert.equal(JSON.stringify(temporalDemo), before);
});
