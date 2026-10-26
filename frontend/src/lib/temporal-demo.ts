import { buildDemoNetwork, type DemoState } from "./contact-network.ts";

// Hand-authored UI fixture. Not a simulation, API response, Monte Carlo run or scientific evidence.
export type TemporalEvent = {
  day: number;
  nodeId: number;
  from: DemoState;
  to: DemoState;
  cause: "initial" | "contact" | "progression" | "vaccine";
  sourceNodeId: number | null;
  edgeId: number | null;
};
export type DemoDaily = {
  day: number;
  s: number;
  e: number;
  i: number;
  r: number;
  cumulativeInfected: number;
};
const graph = buildDemoNetwork();
const edges = graph
  .flatMap(({ data }) =>
    "source" in data
      ? [
          {
            id: 0,
            u: Number(data.source),
            v: Number(data.target),
            visualId: data.id,
          },
        ]
      : [],
  )
  .map((edge, id) => ({ ...edge, id }));
const edgeId = (visualId: string) => {
  const edge = edges.find((edge) => edge.visualId === visualId);
  if (!edge) throw new Error(`Unknown demonstration edge: ${visualId}`);
  return edge.id;
};
const contact = (
  day: number,
  nodeId: number,
  sourceNodeId: number,
  edge: string,
): TemporalEvent => ({
  day,
  nodeId,
  sourceNodeId,
  edgeId: edgeId(edge),
  from: "S",
  to: "E",
  cause: "contact",
});
const progress = (
  day: number,
  nodeId: number,
  from: "E" | "I",
  to: "I" | "R",
): TemporalEvent => ({
  day,
  nodeId,
  from,
  to,
  cause: "progression",
  sourceNodeId: null,
  edgeId: null,
});
const vaccine = (nodeId: number): TemporalEvent => ({
  day: 3,
  nodeId,
  from: "S",
  to: "R",
  cause: "vaccine",
  sourceNodeId: null,
  edgeId: null,
});
const events = [
  {
    day: 0,
    nodeId: 8,
    from: "I",
    to: "I",
    cause: "initial",
    sourceNodeId: null,
    edgeId: null,
  },
  contact(1, 17, 8, "e17"),
  contact(1, 26, 8, "bridge1"),
  contact(2, 18, 8, "e18"),
  contact(2, 46, 8, "bridge2"),
  progress(3, 17, "E", "I"),
  progress(3, 26, "E", "I"),
  vaccine(7),
  vaccine(14),
  vaccine(70),
  progress(4, 18, "E", "I"),
  progress(4, 46, "E", "I"),
  contact(4, 27, 26, "e27"),
  contact(5, 47, 46, "e47"),
  contact(5, 28, 26, "e28"),
  progress(6, 27, "E", "I"),
  progress(7, 47, "E", "I"),
  progress(7, 28, "E", "I"),
  contact(8, 29, 27, "e29"),
  contact(8, 48, 46, "e48"),
  progress(9, 8, "I", "R"),
  progress(10, 29, "E", "I"),
  progress(10, 48, "E", "I"),
  progress(10, 17, "I", "R"),
  progress(11, 26, "I", "R"),
  progress(12, 18, "I", "R"),
  progress(13, 46, "I", "R"),
  progress(14, 27, "I", "R"),
  progress(15, 47, "I", "R"),
  progress(15, 28, "I", "R"),
  progress(16, 29, "I", "R"),
  progress(16, 48, "I", "R"),
] satisfies TemporalEvent[];
events.sort(
  (a, b) =>
    a.day - b.day || a.nodeId - b.nodeId || a.cause.localeCompare(b.cause),
);
const frames: DemoState[][] = [];
const daily: DemoDaily[] = [];
const infected = new Set([8]);
for (let day = 0; day <= 20; day++) {
  const previous: DemoState[] = day
    ? frames[day - 1]
    : Array.from({ length: 110 }, (_, id) => (id === 8 ? "I" : "S"));
  const frame = [...previous];
  for (const event of events.filter((event) => event.day === day)) {
    if (previous[event.nodeId] !== event.from)
      throw new Error(`Invalid authored transition on day ${day}`);
    if (event.cause === "contact") {
      const edge = edges[event.edgeId!];
      if (
        previous[event.sourceNodeId!] !== "I" ||
        ![edge.u, edge.v].includes(event.nodeId) ||
        ![edge.u, edge.v].includes(event.sourceNodeId!)
      )
        throw new Error("Invalid authored contact");
      infected.add(event.nodeId);
    }
    frame[event.nodeId] = event.to;
  }
  frames.push(frame);
  daily.push({
    day,
    s: frame.filter((state) => state === "S").length,
    e: frame.filter((state) => state === "E").length,
    i: frame.filter((state) => state === "I").length,
    r: frame.filter((state) => state === "R").length,
    cumulativeInfected: infected.size,
  });
}
export const temporalDemo = {
  id: "mantalab-temporal-demo-v1",
  mode: "authored-demo" as const,
  days: 20,
  population: 110,
  edges,
  events,
  frames,
  daily,
};
export function readDemoFrame(day: number) {
  if (!Number.isInteger(day) || day < 0 || day > temporalDemo.days)
    throw new RangeError("Demonstration day out of bounds");
  const row = daily[day];
  return {
    day,
    states: frames[day],
    counts: { S: row.s, E: row.e, I: row.i, R: row.r },
    events: events.filter((event) => event.day === day),
  };
}
export type PlaybackState = { day: number; playing: boolean; speed: number };
export type PlaybackAction =
  | { type: "play" | "pause" | "step" | "tick" | "reset" }
  | { type: "seek"; day: number }
  | { type: "speed"; value: number };
export const initialPlayback: PlaybackState = {
  day: 0,
  playing: false,
  speed: 1,
};
export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction,
): PlaybackState {
  switch (action.type) {
    case "play":
      return {
        ...state,
        day: state.day === temporalDemo.days ? 0 : state.day,
        playing: true,
      };
    case "pause":
      return { ...state, playing: false };
    case "reset":
      return { ...state, day: 0, playing: false };
    case "seek":
      return Number.isInteger(action.day) &&
        action.day >= 0 &&
        action.day <= temporalDemo.days
        ? { ...state, day: action.day, playing: false }
        : state;
    case "speed":
      return [0.5, 1, 2, 4].includes(action.value)
        ? { ...state, speed: action.value }
        : state;
    case "step":
      return {
        ...state,
        day: Math.min(temporalDemo.days, state.day + 1),
        playing: false,
      };
    case "tick": {
      if (!state.playing) return state;
      const day = Math.min(temporalDemo.days, state.day + 1);
      return { ...state, day, playing: day < temporalDemo.days };
    }
  }
}
