import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { validateGeographicResource } from '../frontend/src/lib/manta-geography.ts'

const help = 'Usage: node --experimental-strip-types scripts/prepare-manta-geography.mjs (--download | --source-dir DIR --extracted-at UTC) --output FILE\nDownloads public OSM residential polygons once, or validates saved API responses. Never overwrites an existing output. No address, building or person data is retained.\n'
const ids = [1290388697, 1237070572, 412772816, 412772820, 1426150466, 411802416, 411822001, 411822004, 411822007, 767412777, 1120671240, 1237070571, 1291890427]
try {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(help); process.exit(0) }
  const options = {}
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    if (key === '--download' && !options[key]) options[key] = true
    else if (['--source-dir', '--extracted-at', '--output'].includes(key) && !options[key] && args[i + 1] && !args[i + 1].startsWith('--')) options[key] = args[++i]
    else throw new Error(`Invalid argument: ${key}. Use --help.`)
  }
  if (!options['--output'] || Boolean(options['--download']) === Boolean(options['--source-dir']) ||
    (!options['--download'] && !options['--extracted-at'])) throw new Error(help.trim())
  const features = []
  for (const [index, id] of ids.entries()) {
    const sourceUrl = `https://api.openstreetmap.org/api/0.6/way/${id}/full.json`
    let raw
    if (options['--download']) {
      const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mantalab geography preparation/1.0' } })
      if (!response.ok) throw new Error(`OSM download failed: HTTP ${response.status}`)
      raw = await response.text()
    } else raw = await readFile(join(options['--source-dir'], `${id}.json`), 'utf8')
    const source = JSON.parse(raw)
    const way = source.elements?.find(item => item.type === 'way' && item.id === id)
    if (!way || way.tags?.landuse !== 'residential') throw new Error(`Missing OSM residential way ${id}`)
    const nodes = new Map(source.elements.filter(item => item.type === 'node').map(node => [node.id, node]))
    const ring = way.nodes.map(nodeId => {
      const node = nodes.get(nodeId)
      if (!node) throw new Error(`Missing geometry for OSM way ${id}`)
      return [node.lon, node.lat]
    })
    features.push({ type: 'Feature', properties: { sectorId: `synthetic-sector-${index}`, osmWayId: id,
      osmWayVersion: way.version, osmWayTimestamp: way.timestamp, sourceUrl,
      sourceSha256: `sha256:${createHash('sha256').update(raw).digest('hex')}`, landuse: 'residential' },
      geometry: { type: 'Polygon', coordinates: [ring] } })
  }
  const resource = { type: 'FeatureCollection', resourceVersion: 'manta-residential-osm-v2',
    source: { name: 'OpenStreetMap', license: 'ODbL-1.0', extractedAt: options['--extracted-at'] ?? new Date().toISOString() }, features }
  validateGeographicResource(resource)
  await writeFile(resolve(options['--output']), `${JSON.stringify(resource, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`Validated ${features.length} residential polygons. Wrote the new resource.\n`)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
