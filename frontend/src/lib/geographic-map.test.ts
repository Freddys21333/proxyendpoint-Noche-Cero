import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mountGeographicMap, type MapRuntime } from './geographic-map.ts'

function fixture() {
  const calls = { maps: 0, layers: 0, removed: 0, redraws: 0, resizes: 0 }
  const listeners: Record<string, (event: unknown) => void> = {}
  const options: Record<string, unknown> = {}
  const layer = {
    on(events: typeof listeners) { Object.assign(listeners, events); return this },
    off() { for (const key of Object.keys(listeners)) delete listeners[key]; return this },
    addTo() { return this },
    redraw() { calls.redraws++; return this },
  }
  const map = {
    setView(center: number[], zoom: number) { Object.assign(options, { center, zoom }); return this },
    fitBounds(bounds: number[][], camera: unknown) { Object.assign(options, { bounds, camera, fits: Number(options.fits ?? 0) + 1 }); return this },
    getZoom() { return 13 }, on() {}, off() {},
    invalidateSize(value: unknown) { calls.resizes++; assert.deepEqual(value, { pan: false }); return this },
    remove() { calls.removed++ },
  }
  const runtime = {
    map(_container: unknown, value: unknown) { calls.maps++; Object.assign(options, value); return map },
    tileLayer(url: string, value: unknown) { calls.layers++; Object.assign(options, { url, tiles: value }); return layer },
  } as unknown as MapRuntime
  const container = { clientWidth: 680, clientHeight: 360 } as HTMLElement
  const messages: (string | null)[] = []
  return { calls, listeners, options, runtime, container, messages, layer }
}

test('the base map opens in Manta with OSM attribution, dragging and wheel-safe zoom controls', () => {
  const f = fixture()
  const view = mountGeographicMap(f.container, f.runtime, message => f.messages.push(message))
  const center = f.options.center as number[]
  assert.ok(center[0] < -0.9 && center[0] > -1.1)
  assert.ok(center[1] < -80.6 && center[1] > -80.9)
  assert.equal(f.options.scrollWheelZoom, false)
  assert.equal(f.options.dragging, true)
  assert.equal(f.options.zoomControl, true)
  assert.equal(f.options.attributionControl, true)
  assert.equal(f.options.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
  assert.match((f.options.tiles as { attribution: string }).attribution, /openstreetmap.org\/copyright/)
  view.destroy()
})

test('a new scenario waits until the hidden map is visible, fits agents once and retains the camera', () => {
  const f = fixture()
  Object.assign(f.runtime, {
    canvas: () => ({ remove() {} }),
    layerGroup: () => ({ addTo() { return this }, clearLayers() {}, remove() {} }),
    circleMarker: () => ({ bindPopup() { return this }, on() { return this }, off() {},
      addTo() { return this }, bringToFront() { return this }, openPopup() { return this } }),
  })
  const view = mountGeographicMap(f.container, f.runtime, () => {})
  Object.assign(f.container, { clientWidth: 0, clientHeight: 0 })
  const agents = [{ id: 0, nodeId: 0, lat: -0.96, lng: -80.754, state: 'S' },
    { id: 1, nodeId: 1, lat: -0.995, lng: -80.67, state: 'I' }] as Parameters<typeof view.setAgents>[0]
  view.setAgents(agents, () => ({} as HTMLElement), () => {})
  assert.equal(f.options.fits, undefined)
  view.resize()
  assert.equal(f.options.fits, undefined)
  Object.assign(f.container, { clientWidth: 680, clientHeight: 360 })
  view.resize()
  assert.deepEqual(f.options.bounds, agents.map(a => [a.lat, a.lng]))
  assert.deepEqual(f.options.camera, { paddingTopLeft: [24, 76], paddingBottomRight: [24, 112], maxZoom: 16, animate: false })
  assert.equal(f.options.zoomSnap, 0.25)
  view.focusAgent(agents[1])
  assert.deepEqual(f.options.center, [agents[1].lat, agents[1].lng])
  assert.equal(f.options.zoom, 16)
  view.updateAgents({ mode: 'preview', day: 0, policy: 'targeted', frame: undefined, representativeIndex: null })
  view.resize(); view.retry()
  assert.equal(f.options.fits, 1)
  view.recenter()
  assert.equal(f.options.fits, 2)
  assert.deepEqual(f.options.bounds, agents.map(a => [a.lat, a.lng]))
  Object.assign(f.container, { clientWidth: 0, clientHeight: 0 })
  view.recenter()
  assert.equal(f.options.fits, 2)
  Object.assign(f.container, { clientWidth: 680, clientHeight: 360 })
  view.resize()
  assert.equal(f.options.fits, 3)
  view.destroy()
  view.recenter()
  assert.equal(f.options.fits, 3)
  view.focusAgent(agents[0])
  assert.deepEqual(f.options.center, [agents[1].lat, agents[1].lng])
})

test('resize and retry retain one map; unmount removes listeners and ignores late callbacks', () => {
  const f = fixture()
  const view = mountGeographicMap(f.container, f.runtime, message => f.messages.push(message))
  view.resize(); view.resize(); view.retry()
  assert.deepEqual(f.calls, { maps: 1, layers: 1, removed: 0, redraws: 1, resizes: 2 })
  const queuedError = f.listeners.tileerror
  view.destroy()
  const messagesAfterUnmount = [...f.messages]
  queuedError({ tile: {} })
  view.resize(); view.retry(); view.destroy()
  assert.deepEqual(f.messages, messagesAfterUnmount)
  assert.deepEqual(f.listeners, {})
  assert.deepEqual(f.calls, { maps: 1, layers: 1, removed: 1, redraws: 1, resizes: 2 })
})

test('a failed tile remains visible as an error while other tiles load and retry reuses the layer', () => {
  const f = fixture()
  const view = mountGeographicMap(f.container, f.runtime, message => f.messages.push(message))
  const failed = {}
  f.listeners.tileerror({ tile: failed })
  assert.match(f.messages.at(-1)!, /OpenStreetMap/)
  f.listeners.tileload({ tile: {} })
  assert.ok(f.messages.at(-1))
  f.listeners.tileunload({ tile: failed })
  assert.equal(f.messages.at(-1), null)
  f.listeners.tileerror({ tile: failed })
  view.retry()
  assert.equal(f.messages.at(-1), null)
  assert.equal(f.calls.redraws, 1)
  assert.equal(f.calls.maps, 1)
  view.destroy()
})

test('partial initialization failure releases the map before reporting the error', () => {
  const f = fixture()
  f.layer.addTo = () => { throw new Error('tile setup failed') }
  assert.throws(() => mountGeographicMap(f.container, f.runtime, () => {}), /tile setup failed/)
  assert.equal(f.calls.removed, 1)
  assert.deepEqual(f.listeners, {})
})
