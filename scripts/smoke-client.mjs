/**
 * Client artifact smoke test: load lib/client.js in a stub browser context
 * (window.__ModuleLoader__ capture + module-table require stubs) and confirm
 * the closure registers and its exports expose name/inject/apply.
 * Run: node scripts/smoke-client.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const failures = []
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
  if (!cond) failures.push(name)
}

const here = dirname(fileURLToPath(import.meta.url))
const artifactPath = join(here, '..', 'lib', 'client.js')
const source = readFileSync(artifactPath, 'utf8')

check('banner registers dsh-link-collect', source.includes('window.__ModuleLoader__.load({ id: "dsh-link-collect"'))
check('no absolute machine paths leak', !source.includes('/Users/suomir'))

// Execute the artifact in a stub browser.
const registrations = []
const windowStub = {
  __ModuleLoader__: {
    load(registration) {
      registrations.push(registration)
    },
  },
}
globalThis.window = windowStub
globalThis.document = {
  head: { appendChild: () => ({}) },
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
  addEventListener: () => {},
  removeEventListener: () => {},
  body: { appendChild: () => ({}) },
}
Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => `uuid-${Math.random()}` }, configurable: true })

const requireStub = createRequire('/Users/suomir/.dsh/profiles/web/package.json')
const sandboxRequire = (specifier) => {
  // Only module-table words may be required at materialization; everything
  // else must have been inlined by the build.
  const allowed = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis'])
  if (allowed.has(specifier)) {
    // Real react exists under the web profile fallback.
    try {
      return requireStub(specifier)
    } catch {
      return { createElement: () => ({}), useState: () => [], createRoot: () => ({ render() {}, unmount() {} }) }
    }
  }
  throw new Error(`client bundle required a non-module-table specifier: ${specifier}`)
}

const moduleExports = { exports: {} }
const fn = new Function('require', 'module', 'exports', source)
fn(sandboxRequire, moduleExports, moduleExports.exports)

check('exactly one registration', registrations.length === 1, `count=${registrations.length}`)
const reg = registrations[0]
check('registration id is dsh-link-collect', reg?.id === 'dsh-link-collect', JSON.stringify(reg?.id))

// Materialize the factory to obtain the exported module surface.
let exported
try {
  exported = reg.factory(sandboxRequire)
} catch (error) {
  check('factory materializes', false, String(error))
  exported = undefined
}
if (exported !== undefined) {
  check('exports name', typeof exported.name === 'string' && exported.name === 'link-collect-ui', String(exported.name))
  check('exports apply', typeof exported.apply === 'function')
  check('exports inject array', Array.isArray(exported.inject) && exported.inject.length === 0, JSON.stringify(exported.inject))
}

console.log(failures.length === 0 ? '\nALL CLIENT SMOKE CHECKS PASSED' : `\n${failures.length} FAILURE(S): ${failures.join(', ')}`)
process.exit(failures.length === 0 ? 0 : 1)
