import type { PreviewResponse } from './api.ts'
import type { DemoState } from './contact-network.ts'

export const contextLayers: Record<string, string> = {
  Households: 'household', Schools: 'school', Market: 'market',
  Neighborhoods: 'neighborhood', 'Bus routes': 'bus',
}

export function previewNetwork(preview: PreviewResponse, layer: string) {
  const context = contextLayers[layer]
  if (layer !== 'All layers' && !context) throw new Error('Unknown contact layer')
  const initial = new Set(preview.initialInfectiousNodeIds)
  const positions = new Map(preview.positions.map(p => [p.nodeId, p]))
  const edges = preview.graph.edges.filter(e => e.activeDays.includes(0) && (!context || e.context === context))
    .map(e => ({ data: { id: `edge-${e.id}`, source: String(e.u), target: String(e.v), context: e.context } }))
  const neighbors: Record<string, string[]> = {}
  const sets = new Map<number, Set<number>>()
  for (const e of edges) {
    const u = Number(e.data.source), v = Number(e.data.target)
    if (!sets.has(u)) sets.set(u, new Set())
    if (!sets.has(v)) sets.set(v, new Set())
    sets.get(u)!.add(v); sets.get(v)!.add(u)
  }
  const radius = Math.max(230, preview.graph.nodes.length * 3)
  const nodes = preview.graph.nodes.map(node => {
    const position = positions.get(node.id)
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('Missing graph position')
    neighbors[String(node.id)] = [...(sets.get(node.id) ?? [])].sort((a, b) => a - b).map(String)
    return { data: { id: String(node.id), state: (initial.has(node.id) ? 'I' : 'S') as DemoState,
      initial: initial.has(node.id) ? 1 : 0, inLayer: !context || sets.has(node.id) },
      position: { x: position.x * radius, y: position.y * radius } }
  })
  return { nodes, edges, elements: [...nodes, ...edges], neighbors,
    counts: { S: nodes.length - initial.size, E: 0, I: initial.size, R: 0 } }
}
