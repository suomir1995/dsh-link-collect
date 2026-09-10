/**
 * Real-Loader composition boot for dsh-link-collect's host half.
 *
 * Mounts a real Cordis Context + plugin Loader, registers the real
 * `@deepseek-ai/dsh-host-webserver` service and this bundle's host module
 * (`../index.js`) through the Loader's entry rows, then exercises the live
 * HTTP routes exactly as the running profile would (folders / links / search
 * / root switch / guards). The agent tools are exercised separately in
 * smoke-host.mjs because this boot does not mount a real `tools` service.
 *
 * DSH_HOME is isolated to a temp directory so nothing leaks into the real
 * profile. Requires `@deepseek-ai/*` to be resolvable from this package (a
 * temporary node_modules symlink to the profile's shared fallback works),
 * e.g.:
 *   ln -s ~/.dsh/profiles/node_modules node_modules
 *   node scripts/loader-boot.mjs
 *   rm node_modules
 */
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import * as WebServerModule from '@deepseek-ai/dsh-host-webserver'
import * as linkCollect from '../index.js'

const dshHomeTmp = mkdtempSync(join(tmpdir(), 'dsh-lc-boot-home-'))
process.env.DSH_HOME = dshHomeTmp

/** Raw GET returning { status } — lets us spoof the Host header undici forbids. */
function rawGet(port, path, host) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'GET', headers: host ? { host } : {} }, (res) => {
      res.resume()
      res.on('end', () => resolve({ status: res.statusCode }))
    })
    req.on('error', reject)
    req.end()
  })
}

const failures = []
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
  if (!cond) failures.push(name)
}

const HttpServer = WebServerModule.WebServer

const context = new Context()
const root = mkdtempSync(join(tmpdir(), 'dsh-lc-loader-'))
context.baseUrl = pathToFileURL(join(root, 'package.json')).href
await context.plugin(Loader)
context.loader.builtins.include = Include

const modules = new Map([
  ['@deepseek-ai/dsh-host-webserver', HttpServer],
  ['dsh-link-collect', linkCollect],
])
context.loader.internal = {
  version: 'v2',
  async import(specifier) {
    if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
    return modules.get(specifier)
  },
}

const configPath = join(root, 'cordis.yml')
writeFileSync(configPath, [
  '- id: ws-test',
  "  name: '@deepseek-ai/dsh-host-webserver'",
  '  config:',
  "    host: '127.0.0.1'",
  '    port: 0',
  '- id: link-collect',
  '  name: dsh-link-collect',
  '  config:',
  '    rootDir: \'\'',
  '',
].join('\n'))

let lib = ''
try {
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()

  const unloaded = [...context.loader.entries()]
    .filter(entry => entry.fiber === undefined && !entry.disabled)
    .map(entry => entry.options.name)
  check('all rows loaded (no unloaded entry)', unloaded.length === 0, JSON.stringify(unloaded))

  const port = context.webServer.port
  check('webServer bound', Number.isInteger(port) && port > 0, `port=${port}`)
  const base = `http://127.0.0.1:${port}`
  const hostHeader = `127.0.0.1:${port}`
  const headers = { host: hostHeader, 'content-type': 'application/json' }
  lib = mkdtempSync(join(tmpdir(), 'dsh-lc-library-'))

  // state: default root is the isolated DSH home
  const state = await (await fetch(`${base}/api/link-collect/state`, { headers: { host: hostHeader } })).json()
  check('state returns default anchor root', typeof state.root === 'string' && state.root === join(dshHomeTmp, 'dsh-link-collect')
    && state.fromConfig === false, state.root)

  // switch root to the temp library
  const rootPut = await fetch(`${base}/api/link-collect/root`, {
    method: 'PUT', headers, body: JSON.stringify({ root: lib }),
  })
  check('root switch 200', rootPut.status === 200, `status=${rootPut.status}`)
  const state2 = await (await fetch(`${base}/api/link-collect/state`, { headers: { host: hostHeader } })).json()
  check('root switch persisted via pointer', state2.root === lib && state2.viaPointer === true, state2.root)

  // folder create + duplicate rejection
  const create = await fetch(`${base}/api/link-collect/folder/create`, {
    method: 'POST', headers, body: JSON.stringify({ name: '前端资源', description: '前端收藏' }),
  })
  check('folder create 200', create.status === 200)
  const dup = await fetch(`${base}/api/link-collect/folder/create`, {
    method: 'POST', headers, body: JSON.stringify({ name: '前端资源' }),
  })
  check('duplicate folder 409', dup.status === 409, `status=${dup.status}`)

  // add links (fetchIcon false — no network in this boot)
  const add = await fetch(`${base}/api/link-collect/link/add`, {
    method: 'POST', headers,
    body: JSON.stringify({ folder: '前端资源', url: 'https://react.dev/', title: 'React', desc: '官方文档', tags: ['react', '官方'], body: '正文\n第二行', fetchIcon: false }),
  })
  check('link add 200', add.status === 200, `status=${add.status}`)
  const dupLink = await fetch(`${base}/api/link-collect/link/add`, {
    method: 'POST', headers, body: JSON.stringify({ folder: '前端资源', url: 'https://react.dev/', title: 'React 2', fetchIcon: false }),
  })
  check('duplicate link 409', dupLink.status === 409, `status=${dupLink.status}`)

  // read the folder back through the route
  const folderGet = await (await fetch(`${base}/api/link-collect/folder?name=${encodeURIComponent('前端资源')}`, { headers: { host: hostHeader } })).json()
  check('folder GET has entry + body', folderGet.entries.length === 1 && folderGet.entries[0].body.includes('第二行')
    && folderGet.entries[0].tags.join(',') === 'react,官方', JSON.stringify(folderGet.entries[0]).slice(0, 120))

  // folders list
  const folders = await (await fetch(`${base}/api/link-collect/folders`, { headers: { host: hostHeader } })).json()
  check('folders list count', Array.isArray(folders.folders) && folders.folders.length === 1 && folders.folders[0].linkCount === 1)

  // update link fields
  const update = await fetch(`${base}/api/link-collect/link/update`, {
    method: 'POST', headers,
    body: JSON.stringify({ folder: '前端资源', oldUrl: 'https://react.dev/', url: 'https://react.dev/', title: 'React 官方', desc: '新简介', body: '', fetchIcon: false }),
  })
  check('link update 200', update.status === 200, `status=${update.status}`)
  const folderGet2 = await (await fetch(`${base}/api/link-collect/folder?name=${encodeURIComponent('前端资源')}`, { headers: { host: hostHeader } })).json()
  check('update persisted', folderGet2.entries[0].title === 'React 官方' && folderGet2.entries[0].desc === '新简介' && folderGet2.entries[0].body === '')

  // search route (whole library)
  const search = await (await fetch(`${base}/api/link-collect/search?q=React`, { headers: { host: hostHeader } })).json()
  check('search finds entry', search.count === 1 && search.results[0].folder === '前端资源')
  const tagSearch = await (await fetch(`${base}/api/link-collect/search?tag=官方`, { headers: { host: hostHeader } })).json()
  check('search by tag', tagSearch.count === 1)

  // meta probe against unroutable local port fails fast & reports empty
  const meta = await fetch(`${base}/api/link-collect/meta?url=${encodeURIComponent('http://127.0.0.1:9/x')}`, { headers: { host: hostHeader } })
  check('meta probe 200 offline', meta.status === 200, `status=${meta.status}`)
  const metaBody = await meta.json()
  check('meta probe empty title offline', metaBody.title === '' && metaBody.icon === '')

  // icon route guards
  const iconBad = await fetch(`${base}/api/link-collect/icon?name=../../etc/passwd`, { headers: { host: hostHeader } })
  check('icon traversal rejected 400', iconBad.status === 400, `status=${iconBad.status}`)
  const iconMissing = await fetch(`${base}/api/link-collect/icon?name=nope.png`, { headers: { host: hostHeader } })
  check('icon missing 404', iconMissing.status === 404, `status=${iconMissing.status}`)

  // delete link then folder
  const delLink = await fetch(`${base}/api/link-collect/link`, {
    method: 'DELETE', headers, body: JSON.stringify({ folder: '前端资源', url: 'https://react.dev/' }),
  })
  check('link delete 200', delLink.status === 200)
  const delFolder = await fetch(`${base}/api/link-collect/folder?name=${encodeURIComponent('前端资源')}`, { method: 'DELETE', headers: { host: hostHeader } })
  check('folder delete 200', delFolder.status === 200)
  const folders2 = await (await fetch(`${base}/api/link-collect/folders`, { headers: { host: hostHeader } })).json()
  check('library empty after delete', folders2.folders.length === 0)

  // guards: foreign Host header, wrong methods, unknown route
  const foreignHost = await rawGet(port, '/api/link-collect/state', 'evil.example.com')
  check('foreign-host request forbidden 403', foreignHost.status === 403, `status=${foreignHost.status}`)
  const badMethod = await fetch(`${base}/api/link-collect/state`, { method: 'PUT', headers, body: JSON.stringify({ root: lib }) })
  check('wrong method rejected 405', badMethod.status === 405, `status=${badMethod.status}`)
  const notFound = await fetch(`${base}/api/link-collect/nope`, { headers: { host: hostHeader } })
  check('unknown route 404', notFound.status === 404, `status=${notFound.status}`)
  const badJson = await fetch(`${base}/api/link-collect/link/add`, { method: 'POST', headers: { host: hostHeader, 'content-type': 'application/json' }, body: '{oops' })
  check('malformed JSON rejected 400', badJson.status === 400, `status=${badJson.status}`)
} finally {
  try {
    await context.stop?.()
  } catch {
    // teardown best-effort
  }
  try {
    context.dispose?.()
  } catch {
    // teardown best-effort
  }
  rmSync(root, { recursive: true, force: true })
  rmSync(lib, { recursive: true, force: true })
  rmSync(dshHomeTmp, { recursive: true, force: true })
}

console.log(failures.length === 0 ? '\nALL LOADER BOOT CHECKS PASSED' : `\n${failures.length} FAILURE(S): ${failures.join(', ')}`)
process.exit(failures.length === 0 ? 0 : 1)
