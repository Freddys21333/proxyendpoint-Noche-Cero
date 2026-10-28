import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')

test('document shell exposes Spanish search and social metadata without inventing a public canonical URL', () => {
  assert.match(html, /<html lang="es">/)
  assert.match(html, /<title>Noche Cero — Laboratorio de propagación<\/title>/)
  assert.match(html, /<meta name="description" content=".{60,}"\s*\/>/)
  assert.match(html, /<meta name="theme-color" content="#[0-9a-fA-F]{6}"\s*\/>/)
  assert.match(html, /<meta property="og:title" content="Noche Cero — Laboratorio de propagación"\s*\/>/)
  assert.match(html, /<meta property="og:description" content=".{60,}"\s*\/>/)
  assert.match(html, /<meta property="og:type" content="website"\s*\/>/)
  assert.doesNotMatch(html, /rel="canonical"|property="og:url"/)
})
