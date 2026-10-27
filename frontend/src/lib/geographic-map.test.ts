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
    invalidateSize(value: unknown) { calls.resizes++; assert.deepEqual(value, { pan: false }); return this },
    remove() { calls.removed++ },
  }
  const runtime = {
    map(_container: unknown, value: unknown) { calls.maps++; Object.assign(options, value); return map },
    tileLayer(url: string, value: unknown) { calls.layers++; Object.assign(options, { url, tiles: value }); return layer },
  } as unknown as MapRuntime
  const container = {} as HTMLElement
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
