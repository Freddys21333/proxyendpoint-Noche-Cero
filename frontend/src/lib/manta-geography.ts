import type { PreviewResponse, PersonState } from './api.ts'

export type Coordinate = [number, number] // GeoJSON longitude, latitude.
export type GeographicResource = {
  type: 'FeatureCollection'; resourceVersion: string;
  source: { name: 'OpenStreetMap'; license: 'ODbL-1.0'; extractedAt: string };
  features: {
    type: 'Feature';
    properties: { sectorId: string; osmWayId: number; osmWayVersion: number; osmWayTimestamp: string;
      sourceUrl: string; sourceSha256: string; landuse: 'residential' };
    geometry: { type: 'Polygon'; coordinates: Coordinate[][] };
  }[];
}
export type GeographicAgent = PreviewResponse['graph']['nodes'][number] & {
  nodeId: number; lat: number; lng: number; sectorId: string; state: PersonState;
}

const cross = (a: Coordinate, b: Coordinate, c: Coordinate) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
const onSegment = (p: Coordinate, a: Coordinate, b: Coordinate) => Math.abs(cross(a, b, p)) < 1e-14 &&
  p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1])

export function insideRing(point: Coordinate, ring: Coordinate[]): boolean {
  let inside = false
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1]
    if (onSegment(point, a, b)) return false
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

export function validateGeographicResource(raw: unknown): GeographicResource {
  const data = raw as GeographicResource
  const fail = () => { throw new Error('Recurso geográfico OSM inválido o sin evidencia verificable.') }
  if (!data || data.type !== 'FeatureCollection' || !data.resourceVersion || data.source?.name !== 'OpenStreetMap' ||
    data.source.license !== 'ODbL-1.0' || !Number.isFinite(Date.parse(data.source.extractedAt)) || !Array.isArray(data.features) || !data.features.length) fail()
  const sectors = new Set<string>()
  for (const feature of data.features) {
    const p = feature.properties
    if (feature.type !== 'Feature' || !p || p.landuse !== 'residential' || !p.sectorId || sectors.has(p.sectorId) ||
      !Number.isInteger(p.osmWayId) || p.osmWayId <= 0 || !Number.isInteger(p.osmWayVersion) || p.osmWayVersion < 1 ||
      !Number.isFinite(Date.parse(p.osmWayTimestamp)) || !/^sha256:[a-f0-9]{64}$/.test(p.sourceSha256) ||
      p.sourceUrl !== `https://api.openstreetmap.org/api/0.6/way/${p.osmWayId}/full.json` ||
      feature.geometry?.type !== 'Polygon' || !Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length !== 1) fail()
    sectors.add(p.sectorId)
    const ring = feature.geometry.coordinates[0]
    if (!Array.isArray(ring) || ring.length < 4 || !ring.every(c => Array.isArray(c) && c.length === 2 &&
      Number.isFinite(c[0]) && Number.isFinite(c[1]) && c[0] > -80.76 && c[0] < -80.65 && c[1] > -1.02 && c[1] < -0.94)) fail()
    if (ring[0][0] !== ring.at(-1)![0] || ring[0][1] !== ring.at(-1)![1]) fail()
    let area = 0
    for (let i = 0; i < ring.length - 1; i++) area += cross(ring[0], ring[i], ring[i + 1])
    if (Math.abs(area) < 1e-12) fail()
    for (let i = 0; i < ring.length - 1; i++) for (let j = i + 2; j < ring.length - 1; j++) {
      if (i === 0 && j === ring.length - 2) continue
      const [a, b, c, d] = [ring[i], ring[i + 1], ring[j], ring[j + 1]]
      if ((cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) ||
        onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d)) fail()
    }
  }
  return data
}

function hash(text: string): number {
  let value = 2166136261
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619)
  return value >>> 0
}
function randomStream(key: string) {
  let state = hash(key)
  return () => {
    let value = state += 0x6d2b79f5
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

export function assignGeographicAgents(preview: PreviewResponse, raw: unknown): GeographicAgent[] {
  const data = validateGeographicResource(raw)
  const features = [...data.features].sort((a, b) => a.properties.sectorId < b.properties.sectorId ? -1 : 1)
  const nodes = [...preview.graph.nodes].sort((a, b) => a.id - b.id)
  if (new Set(nodes.map(n => n.id)).size !== nodes.length) throw new Error('Identificadores de agentes duplicados.')
  const key = `mantalab-geography-v2:${data.resourceVersion}:${preview.configuration.rootSeed}:${preview.graphHash}`
  const sectorOrder = [...features]
  const shuffle = randomStream(`${key}:sectors`)
  for (let i = sectorOrder.length - 1; i > 0; i--) {
    const j = Math.floor(shuffle() * (i + 1))
    ;[sectorOrder[i], sectorOrder[j]] = [sectorOrder[j], sectorOrder[i]]
  }
  const households = new Map<string, typeof nodes>()
  for (const node of nodes) {
    if (!households.has(node.householdId)) households.set(node.householdId, [])
    households.get(node.householdId)!.push(node)
  }
  const infected = new Set(preview.initialInfectiousNodeIds)
  const used = new Set<string>()
  const agents: GeographicAgent[] = []
  let householdIndex = 0
  const anchors = new Map<string, Coordinate[]>()
  for (const [household, members] of [...households].sort(([a], [b]) => a < b ? -1 : 1)) {
    const feature = sectorOrder[householdIndex++ % sectorOrder.length]
    const ring = feature.geometry.coordinates[0]
    const xs = ring.map(c => c[0]), ys = ring.map(c => c[1])
    const west = Math.min(...xs), south = Math.min(...ys)
    const width = Math.max(...xs) - west, height = Math.max(...ys) - south
    const random = randomStream(`${key}:household:${household}`)
    let anchor: Coordinate | undefined
    let bestDistance = -1
    let candidates = 0
    const previous = anchors.get(feature.properties.sectorId) ?? []
    for (let attempt = 0; attempt < 4096; attempt++) {
      const point: Coordinate = [west + random() * width, south + random() * height]
      if (!insideRing(point, ring)) continue
      const distance = previous.length ? Math.min(...previous.map(p => (p[0] - point[0]) ** 2 + (p[1] - point[1]) ** 2)) : 1
      if (distance > bestDistance) { anchor = point; bestDistance = distance }
      if (++candidates === 16) break
    }
    if (!anchor) throw new Error('No se encontró terreno permitido para el grupo sintético.')
    previous.push(anchor)
    anchors.set(feature.properties.sectorId, previous)
    const radius = Math.min(Math.min(width, height) * 0.4, 0.0009)
    for (const node of members) {
      let coordinate: Coordinate | undefined
      for (let attempt = 0; attempt < 512; attempt++) {
        const point: Coordinate = [Number((anchor[0] + (random() - 0.5) * radius).toFixed(8)), Number((anchor[1] + (random() - 0.5) * radius).toFixed(8))]
        const identity = point.join(',')
        if (insideRing(point, ring) && !used.has(identity)) { coordinate = point; used.add(identity); break }
      }
      if (!coordinate) throw new Error('No se pudo ubicar un agente dentro del área permitida.')
      agents.push({ ...node, nodeId: node.id, lng: coordinate[0], lat: coordinate[1], sectorId: feature.properties.sectorId, state: infected.has(node.id) ? 'I' : 'S' })
    }
  }
  return agents.sort((a, b) => a.nodeId - b.nodeId)
}
