#!/usr/bin/env node
/**
 * Screenshot the app in headless Chromium with software WebGL (works without a GPU, e.g. on CI runners).
 * Starts its own Vite dev server, so nothing else needs to be running.
 *
 *   node scripts/screenshot.mjs [--out dir] [--viewports desktop,phone] [--cameras chase,sail,top]
 *                               [--state '<json>'] [--settle ms]
 *
 * --state is merged into the store via window.__sim before each shot; `boat` and `wind` are merged one level
 * deep, so partial objects work, e.g. --state '{"wind":{"speed":10},"boat":{"heading":0.785}}' (radians).
 * Prints one PNG path per line.
 */
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const CAMERAS = ['chase', 'sail', 'top']

const { values: opts } = parseArgs({
  options: {
    out: { type: 'string', default: 'screenshots' },
    viewports: { type: 'string', default: Object.keys(VIEWPORTS).join(',') },
    cameras: { type: 'string', default: CAMERAS.join(',') },
    state: { type: 'string', default: '{}' },
    settle: { type: 'string', default: '2500' },
  },
})
const viewports = opts.viewports.split(',')
const cameras = opts.cameras.split(',')
const state = JSON.parse(opts.state)
const settle = Number(opts.settle)
for (const v of viewports) if (!VIEWPORTS[v]) throw new Error(`Unknown viewport "${v}" (have: ${Object.keys(VIEWPORTS)})`)
for (const c of cameras) if (!CAMERAS.includes(c)) throw new Error(`Unknown camera "${c}" (have: ${CAMERAS})`)

const root = resolve(fileURLToPath(import.meta.url), '../..')
const out = resolve(opts.out)
await mkdir(out, { recursive: true })

const server = await createServer({ root, logLevel: 'error', server: { port: 5199 } })
await server.listen()
const url = server.resolvedUrls.local[0]

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] })
const errors = []
try {
  for (const v of viewports) {
    const page = await browser.newPage(VIEWPORTS[v])
    page.on('pageerror', (e) => errors.push(`[${v}] ${e.message}`))
    page.on('console', (m) => m.type() === 'error' && errors.push(`[${v}] ${m.text()}`))
    await page.goto(url)
    await page.waitForFunction(() => window.__sim, null, { timeout: 60_000 })
    for (const camera of cameras) {
      await page.evaluate(({ camera, state }) => {
        const s = window.__sim.getState()
        window.__sim.setState({ ...state, camera, boat: { ...s.boat, ...state.boat }, wind: { ...s.wind, ...state.wind } })
      }, { camera, state })
      await page.waitForTimeout(settle)
      const file = join(out, `${v}-${camera}.png`)
      await page.screenshot({ path: file })
      console.log(file)
    }
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
if (errors.length) console.error(`Page errors:\n${errors.join('\n')}`)
