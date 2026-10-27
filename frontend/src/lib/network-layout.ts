import type { PreviewResponse } from './api.ts'

export const layoutModes = {
  neighborhoodId: 'Barrios', householdId: 'Hogares', schoolId: 'Colegios',
  busId: 'Rutas de bus', marketId: 'Mercados', circle: 'Circular',
} as const
export type NetworkLayout = keyof typeof layoutModes
const groupNames = {
  neighborhoodId: ['Barrio', 'Sin barrio'], householdId: ['Hogar', 'Sin hogar'],
  schoolId: ['Colegio', 'Sin colegio'], busId: ['Bus', 'Sin ruta de bus'], marketId: ['Mercado', 'Sin mercado'],
} as const
export type DisplayPosition = { nodeId: number; x: number; y: number; label: string }

// Presentation only: membership is taken from the graph; no contacts or states are inferred.
export function networkPositions(preview: PreviewResponse, mode: NetworkLayout): DisplayPosition[] {
  const nodes = [...preview.graph.nodes].sort((a, b) => a.id - b.id)
  if (mode === 'circle') {
    const source = new Map(preview.positions.map(p => [p.nodeId, p]))
    const radius = Math.max(230, nodes.length * 3)
    return nodes.map(node => {
      const p = source.get(node.id)
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('Missing graph position')
      return { nodeId: node.id, x: p.x * radius, y: p.y * radius, label: '' }
    })
  }
  const groups = new Map<string | null, typeof nodes>()
  for (const node of nodes) {
    const key = node[mode]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(node)
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a === null ? 1 : b === null ? -1 : a.localeCompare(b, 'en', { numeric: true }))
  const maxSize = Math.max(1, ...ordered.map(([, members]) => members.length))
  const spacing = 2 * Math.sqrt(maxSize) * 22 + 150
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)))
  const positions: DisplayPosition[] = []
  ordered.forEach(([key, members], groupIndex) => {
    const points = members.map((node, index) => {
      const angle = index * Math.PI * (3 - Math.sqrt(5))
      const radius = 22 * Math.sqrt(index + 0.5)
      return { nodeId: node.id, x: (groupIndex % columns) * spacing + Math.cos(angle) * radius,
        y: Math.floor(groupIndex / columns) * spacing + Math.sin(angle) * radius, label: '' }
    })
    const anchor = points.reduce((top, point) => point.y < top.y ? point : top)
    anchor.label = `${key === null ? groupNames[mode][1] : `${groupNames[mode][0]} ${key.split('-').at(-1)}`} · ${members.length}`
    positions.push(...points)
  })
  return positions.sort((a, b) => a.nodeId - b.nodeId)
}
