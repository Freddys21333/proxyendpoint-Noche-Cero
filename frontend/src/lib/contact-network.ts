// Fixed UI demonstration only. No epidemiological engine or API contract.
export type DemoState = "S" | "E" | "I" | "R";
export type DemoNode = {
  data: { id: string; state: DemoState; group: string };
  position: { x: number; y: number };
};
export type DemoElement =
  | DemoNode
  | { data: { id: string; source: string; target: string; group: string } };
export type DemoNodeContext = {
  id: string;
  state: DemoState;
  group: string;
  contacts: number;
};
const groups = [
  { x: 185, y: 160, count: 26, name: "Households" },
  { x: 400, y: 100, count: 20, name: "Schools" },
  { x: 590, y: 205, count: 24, name: "Market" },
  { x: 375, y: 300, count: 22, name: "Neighborhoods" },
  { x: 155, y: 355, count: 18, name: "Bus routes" },
];

export function buildDemoNetwork(): DemoElement[] {
  const elements: DemoElement[] = [];
  let offset = 0;
  for (const [g, group] of groups.entries()) {
    for (let j = 0; j < group.count; j++) {
      const id = offset + j;
      const angle = j * 2.399963;
      const radius = 19 + Math.sqrt(j) * 18;
      elements.push({
        data: {
          id: `${id}`,
          group: group.name,
          state:
            id === 8 ? "I" : id % 19 === 0 ? "E" : id % 7 === 0 ? "R" : "S",
        },
        position: {
          x: group.x + Math.cos(angle) * radius,
          y: group.y + Math.sin(angle) * radius,
        },
      });
      if (j > 0) {
        elements.push({
          data: {
            id: `e${id}`,
            source: `${id}`,
            target: `${offset + Math.floor((j - 1) / 2)}`,
            group: group.name,
          },
        });
        if (j > 3)
          elements.push({
            data: {
              id: `b${id}`,
              source: `${id}`,
              target: `${id - 2}`,
              group: group.name,
            },
          });
      }
    }
    if (g > 0)
      elements.push({
        data: {
          id: `bridge${g}`,
          source: `${offset}`,
          target: "8",
          group: group.name,
        },
      });
    offset += group.count;
  }
  return elements;
}
export function countDemoStates(
  elements: DemoElement[],
): Record<DemoState, number> {
  const counts = { S: 0, E: 0, I: 0, R: 0 };
  for (const { data } of elements) if ("state" in data) counts[data.state]++;
  return counts;
}
export function describeDemoNode(
  elements: DemoElement[],
  id: string,
): DemoNodeContext | undefined {
  const node = elements.find((element) => element.data.id === id);
  if (!node || !("state" in node.data)) return undefined;
  const neighbors = new Set<string>();
  for (const { data } of elements)
    if ("source" in data) {
      if (data.source === id) neighbors.add(data.target);
      if (data.target === id) neighbors.add(data.source);
    }
  return {
    id,
    state: node.data.state,
    group: node.data.group,
    contacts: neighbors.size,
  };
}
