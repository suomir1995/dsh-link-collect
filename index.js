/**
 * dsh-link-collect — host half of the 链接收藏 (link collection) bundle.
 *
 * Data model (已与用户确认): one 收藏夹 (folder group) == one Markdown file
 * inside a chosen library root directory. Each link inside a folder file is
 * a top-level `## [标题](url)` heading plus an HTML-comment metadata line
 * (`<!-- @dsh-link {"icon":..,"tags":[],"desc":..,"added":..} -->`) plus
 * free-form Markdown body notes until the next `##` heading. The folder's
 * own title/description live in the file's YAML front matter.
 *
 * Host responsibilities:
 *  - owns the library root: config `rootDir` wins; otherwise the active root
 *    is read from a pointer file under `<DSH_HOME>/dsh-link-collect` and may
 *    be switched at runtime through the UI (no restart needed);
 *  - CRUD for folder files and link entries, plus full-text/tag search over
 *    the library (single-writer, atomic tmp+rename writes);
 *  - favicon discovery for a link URL: direct `/favicon.ico` → page
 *    `<link rel="icon">` → DuckDuckGo fallback; downloads a copy into the
 *    library's `icons/` dir so md files stay self-contained;
 *  - serves the browser UI over loopback + same-origin guarded routes and
 *    registers the `link_collect_search` / `link_collect_add` /
 *    `link_collect_list` agent tools.
 *
 * The client half (sidebar entry + collection page overlay) ships separately
 * under `src/client` and is built to `lib/client.js`.
 *
 * @module dsh-link-collect
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { createHash } from 'node:crypto'
import { readFile, writeFile, rename, mkdir, readdir, unlink, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'link-collect'

/**
 * Services required: none statically — the `tools` registry and the
 * `webServer` routes are mounted lazily whenever their services appear.
 */
export const inject = []

/** Plugin version, mirrored in the module header. */
export const VERSION = '0.1.1'

/** Browser UI route family (host half of the client UI). */
export const ROUTE_PREFIX = '/api/link-collect'

/** Hidden pointer file that remembers the active library root. */
const POINTER_NAME = '.link-collect-root'

/** Hard defaults applied when the loader supplies no resolved config. */
const HARD_DEFAULTS = Object.freeze({
  rootDir: '',
  metaTimeoutMs: 10_000,
  faviconTimeoutMs: 6_000,
  maxMetaBytes: 512 * 1024,
  maxFaviconBytes: 2 * 1024 * 1024,
})

/** Plugin config (all optional — `Config` supplies the defaults). */
export const Config = z.object({
  /** Library root; empty keeps the remembered/default root (see below). */
  rootDir: z.string().default(HARD_DEFAULTS.rootDir),
  /** Page-title probe deadline, in milliseconds. */
  metaTimeoutMs: z.number().default(HARD_DEFAULTS.metaTimeoutMs),
  /** One favicon download attempt deadline, in milliseconds. */
  faviconTimeoutMs: z.number().default(HARD_DEFAULTS.faviconTimeoutMs),
  /** Page HTML read cap for the title/icon probe, in bytes. */
  maxMetaBytes: z.number().default(HARD_DEFAULTS.maxMetaBytes),
  /** Favicon byte cap, in bytes (larger downloads are rejected). */
  maxFaviconBytes: z.number().default(HARD_DEFAULTS.maxFaviconBytes),
})

// ---- small helpers ---------------------------------------------------------

/** Clamp a number into an inclusive range. */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/** Expand a leading `~` against the OS home; other values pass through. */
function expandHome(input) {
  if (input === '~') return homedir()
  if (input.startsWith('~/') || input.startsWith('~\\')) return join(homedir(), input.slice(2))
  return input
}

/**
 * Resolve the DSH home the same way the harness does (explicit env wins over
 * `~/.dsh`), without importing a workspace-only path helper.
 * @returns {string} the normalized harness home.
 */
function dshHome() {
  const fromEnv = process.env.DSH_HOME
  const selected = fromEnv !== undefined && fromEnv.trim().length > 0 ? fromEnv : join(homedir(), '.dsh')
  return resolve(expandHome(selected))
}

/** The default library root (also the anchor dir that remembers a switch). */
function anchorDir() {
  return join(dshHome(), 'dsh-link-collect')
}

/** Resolve plugin config defensively against any loader-supplied shape. */
export function resolveConfig(config) {
  const source = config && typeof config === 'object' ? config : {}
  const metaTimeout = Number.isFinite(source.metaTimeoutMs)
    ? clamp(source.metaTimeoutMs, 1_000, 60_000)
    : HARD_DEFAULTS.metaTimeoutMs
  const faviconTimeout = Number.isFinite(source.faviconTimeoutMs)
    ? clamp(source.faviconTimeoutMs, 500, 30_000)
    : HARD_DEFAULTS.faviconTimeoutMs
  const maxMeta = Number.isFinite(source.maxMetaBytes)
    ? clamp(source.maxMetaBytes, 32 * 1024, 4 * 1024 * 1024)
    : HARD_DEFAULTS.maxMetaBytes
  const maxFavicon = Number.isFinite(source.maxFaviconBytes)
    ? clamp(source.maxFaviconBytes, 8 * 1024, 8 * 1024 * 1024)
    : HARD_DEFAULTS.maxFaviconBytes
  const dir = typeof source.rootDir === 'string' ? source.rootDir.trim() : ''
  return {
    rootDir: dir,
    /** Absolute root when config pinned one; '' otherwise (use the pointer). */
    rootAbs: dir.length > 0 ? resolve(expandHome(dir)) : '',
    metaTimeoutMs: metaTimeout,
    faviconTimeoutMs: faviconTimeout,
    maxMetaBytes: maxMeta,
    maxFaviconBytes: maxFavicon,
  }
}

/** The pointer file location (inside the anchor dir). */
function pointerPath() {
  return join(anchorDir(), POINTER_NAME)
}

/** Read the remembered library root from the pointer file, or null. */
async function readPointer() {
  try {
    const raw = (await readFile(pointerPath(), 'utf8')).trim()
    return raw.length > 0 ? resolve(expandHome(raw)) : null
  } catch {
    return null
  }
}

/**
 * The currently active library root.
 * @param cfg - resolved plugin config.
 * @returns {{ path: string, fromConfig: boolean, viaPointer: boolean }}
 */
export async function activeRoot(cfg) {
  if (cfg.rootAbs.length > 0) return { path: cfg.rootAbs, fromConfig: true, viaPointer: false }
  const pointer = await readPointer()
  if (pointer !== null) return { path: pointer, fromConfig: false, viaPointer: true }
  return { path: anchorDir(), fromConfig: false, viaPointer: false }
}

/** Resolve an arbitrary requested root ('' resets to the default anchor). */
function resolveRootPath(requested) {
  const raw = typeof requested === 'string' ? requested.trim() : ''
  return raw.length > 0 ? resolve(expandHome(raw)) : anchorDir()
}

/**
 * Switch the active library root and remember it ('' → back to default).
 * @param cfg - resolved plugin config.
 * @param requested - absolute path, `~`-style path, or '' to reset.
 * @returns {{ root: string }}
 */
export async function setRoot(cfg, requested) {
  const target = resolveRootPath(requested)
  await mkdir(anchorDir(), { recursive: true })
  await mkdir(target, { recursive: true })
  await mkdir(join(target, 'icons'), { recursive: true })
  const tmp = `${pointerPath()}.tmp`
  await writeFile(tmp, `${target}\n`, 'utf8')
  await rename(tmp, pointerPath())
  return { root: target }
}

/** Ensure the library root and its icons dir exist; returns the root path. */
async function ensureRoot(cfg) {
  const active = await activeRoot(cfg)
  await mkdir(active.path, { recursive: true })
  await mkdir(join(active.path, 'icons'), { recursive: true })
  return active.path
}

/** ISO timestamp used in front matter / entry metadata. */
function nowIso() {
  return new Date().toISOString()
}

// ---- Markdown folder-file parsing & serialization --------------------------
//
// 一个收藏夹 = 一个 md 文件：
//   ---            front matter: name / description / created / updated
//   name: 前端资源
//   ---
//
//   ## [React 官方文档](https://react.dev)
//   <!-- @dsh-link {"icon":"icons/..png","tags":["react"],"desc":"..","added":".."} -->
//
//   自由正文 (任意 Markdown), 到下一个 `##` 为止。
//
// Parsing is tolerant: hand-written plain Markdown files also work — any
// top-level `## [标题](链接)` heading becomes a link entry.

/** Known front matter keys that are re-serialized. */
const META_KEYS = ['name', 'description', 'created', 'updated']

/** Split a file into { meta text | rest } when a front matter block exists. */
export function splitFrontMatter(text) {
  const lines = text.split('\n')
  if ((lines[0] ?? '').trim() !== '---') return { meta: null, rest: text }
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      return { meta: lines.slice(1, i).join('\n'), rest: lines.slice(i + 1).join('\n') }
    }
  }
  return { meta: null, rest: text }
}

/** Parse front matter lines into a metadata object (unknown keys dropped). */
export function parseMetaText(metaText) {
  const meta = {}
  if (typeof metaText !== 'string') return meta
  for (const rawLine of metaText.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const key = line.slice(0, colon).trim()
    if (!META_KEYS.includes(key)) continue
    let value = line.slice(colon + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    meta[key] = value
  }
  return meta
}

/** Serialize front matter from a metadata object (stable key order). */
export function renderMetaText(meta) {
  const source = meta && typeof meta === 'object' ? meta : {}
  const lines = ['---']
  for (const key of META_KEYS) {
    const value = typeof source[key] === 'string' ? source[key] : ''
    lines.push(`${key}: ${value}`)
  }
  lines.push('---')
  return lines.join('\n')
}

/** Normalize an entry's metadata object. */
function normalizeEntryMeta(input) {
  const source = input && typeof input === 'object' ? input : {}
  const icon = typeof source.icon === 'string' ? source.icon : ''
  const desc = typeof source.desc === 'string' ? source.desc : ''
  const added = typeof source.added === 'string' ? source.added : ''
  const tags = Array.isArray(source.tags)
    ? source.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean)
    : typeof source.tags === 'string'
      ? source.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
      : []
  return { icon, tags, desc, added }
}

/** Parse one top-level block (from its `##` heading to the next one). */
function parseBlock(raw) {
  const lines = raw.split('\n')
  const heading = lines[0] ?? ''
  const match = /^##\s+\[([^\]]*)\]\(([^)]*)\)\s*$/.exec(heading)
  if (match === null) return { type: 'raw', raw }
  const url = match[2].trim()
  const title = match[1].trim() || url
  const restLines = lines.slice(1)
  let cursor = 0
  while (cursor < restLines.length && restLines[cursor].trim() === '') cursor += 1
  let meta = {}
  let bodyStart = cursor
  if (cursor < restLines.length) {
    const comment = /^<!--\s*@dsh-link\s+(\{.*\})\s*-->$/.exec(restLines[cursor].trim())
    if (comment !== null) {
      try {
        const parsed = JSON.parse(comment[1])
        if (parsed !== null && typeof parsed === 'object') meta = parsed
      } catch {
        // malformed comment → treat as body text
      }
      // meta 注释与正文之间的空行是排版分隔符，不属于正文内容
      bodyStart = cursor + 1
      while (bodyStart < restLines.length && restLines[bodyStart].trim() === '') bodyStart += 1
    }
  }
  const body = restLines.slice(bodyStart).join('\n').replace(/\s+$/, '')
  return { type: 'entry', title, url, meta: normalizeEntryMeta(meta), body }
}

/** Serialize one link entry back into its md block form. */
export function renderEntryBlock(entry) {
  const source = entry && typeof entry === 'object' ? entry : {}
  const url = typeof source.url === 'string' ? source.url : ''
  const title = typeof source.title === 'string' && source.title.length > 0 ? source.title : url
  const meta = normalizeEntryMeta(source.meta)
  const metaJson = JSON.stringify({
    icon: meta.icon,
    tags: meta.tags,
    desc: meta.desc,
    added: meta.added,
  })
  const body = typeof source.body === 'string' ? source.body.trim() : ''
  const block = `## [${title}](${url})\n<!-- @dsh-link ${metaJson} -->`
  return body.length > 0 ? `${block}\n\n${body}\n` : `${block}\n`
}

/**
 * Parse a full folder file.
 * @param text - file text.
 * @param fileStem - file stem used as the fallback folder name.
 * @returns {{ meta, prelude, blocks }}
 */
export function parseFolderText(text, fileStem = '') {
  const { meta: metaText, rest } = splitFrontMatter(text)
  const meta = parseMetaText(metaText ?? '')
  if (typeof meta.name !== 'string' || meta.name.length === 0) meta.name = fileStem
  const lines = rest.split('\n')
  const bounds = []
  for (let index = 0; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) bounds.push(index)
  }
  let prelude = ''
  const blocks = []
  if (bounds.length === 0) {
    prelude = rest
  } else {
    prelude = lines.slice(0, bounds[0]).join('\n')
    for (let index = 0; index < bounds.length; index += 1) {
      const start = bounds[index]
      const end = index + 1 < bounds.length ? bounds[index + 1] : lines.length
      blocks.push(parseBlock(lines.slice(start, end).join('\n')))
    }
  }
  return { meta, prelude, blocks }
}

/** Render a full folder document back to text. */
export function renderFolderText(doc) {
  const source = doc && typeof doc === 'object' ? doc : {}
  const meta = source.meta && typeof source.meta === 'object' ? source.meta : {}
  const chunks = [renderMetaText(meta)]
  const prelude = typeof source.prelude === 'string' ? source.prelude.trim() : ''
  if (prelude.length > 0) chunks.push(prelude)
  const blocks = Array.isArray(source.blocks) ? source.blocks : []
  for (const block of blocks) {
    if (block !== null && typeof block === 'object' && block.type === 'raw') {
      chunks.push(block.raw)
    } else {
      chunks.push(renderEntryBlock(block))
    }
  }
  return `${chunks.join('\n\n')}\n`
}

// ---- folder naming ---------------------------------------------------------

/** Characters that cannot appear in a file name across common platforms. */
const FORBIDDEN_NAME = /[\\/:*?"<>|\u0000-\u001f]/g

/** Sanitize a folder name into a safe file stem. */
export function sanitizeStem(name) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  let stem = trimmed.replace(FORBIDDEN_NAME, '')
  stem = stem.replace(/^\.+/, '').trim()
  if (stem.length === 0) {
    const error = new Error('收藏夹名不能为空，也不能包含 \\ / : * ? " < > | 等字符')
    error.code = 'E_NAME'
    throw error
  }
  if (stem.length > 100) stem = stem.slice(0, 100).trim()
  if (stem.toLowerCase() === 'icons' || stem === POINTER_NAME) {
    const error = new Error(`"${stem}" 是保留名，请换一个收藏夹名`)
    error.code = 'E_NAME'
    throw error
  }
  return stem
}

/** Folder file path for a sanitized stem inside a library root. */
function folderFilePath(root, stem) {
  return join(root, `${stem}.md`)
}

// ---- single-writer queue ---------------------------------------------------

/** Serialize all library writes so two mutations never race on one file. */
let writeQueue = Promise.resolve()
function withWriteLock(task) {
  const run = writeQueue.then(task)
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

// ---- folder + link operations ----------------------------------------------

/** Wrap a thrown error with a stable machine code for the route layer. */
function fail(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

/** The library root used by operations that mutate content. */
async function requireRoot(cfg) {
  return ensureRoot(cfg)
}

/** Summary of every folder file (meta + entry count). */
export async function listFolders(cfg) {
  const root = await ensureRoot(cfg)
  const names = await readdir(root)
  const folders = []
  for (const entryName of names) {
    if (!entryName.endsWith('.md')) continue
    const full = join(root, entryName)
    const info = await stat(full)
    if (!info.isFile()) continue
    let doc
    try {
      const text = await readFile(full, 'utf8')
      doc = parseFolderText(text, entryName.slice(0, -3))
    } catch (error) {
      console.warn('[link-collect] unreadable folder file:', entryName, String(error))
      continue
    }
    folders.push(folderSummary(doc, entryName.slice(0, -3), info))
  }
  folders.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return { root, folders }
}

function folderSummary(doc, stem, info) {
  const meta = doc.meta
  const name = typeof meta.name === 'string' && meta.name.length > 0 ? meta.name : stem
  const entries = doc.blocks.filter((block) => block.type === 'entry')
  const countLinks = entries.filter((entry) => entry.url.length > 0).length
  const updatedAt = typeof meta.updated === 'string' && meta.updated.length > 0
    ? meta.updated
    : info && typeof info.mtime === 'object' && info.mtime instanceof Date
      ? info.mtime.toISOString()
      : ''
  return {
    file: stem,
    name,
    description: typeof meta.description === 'string' ? meta.description : '',
    created: typeof meta.created === 'string' ? meta.created : '',
    updated: typeof meta.updated === 'string' ? meta.updated : '',
    updatedAt,
    linkCount: countLinks,
    folderCount: doc.blocks.length,
  }
}

/** Read and parse one folder file by stem. */
export async function readFolder(cfg, folder) {
  const stem = sanitizeStem(folder)
  const root = await ensureRoot(cfg)
  const full = folderFilePath(root, stem)
  let text
  try {
    text = await readFile(full, 'utf8')
  } catch {
    throw fail('E_FOLDER_MISSING', `收藏夹不存在: ${stem}`)
  }
  const doc = parseFolderText(text, stem)
  return { file: stem, meta: doc.meta, prelude: doc.prelude, blocks: doc.blocks }
}

/** Create a new empty folder file. */
export async function createFolder(cfg, input) {
  const source = input && typeof input === 'object' ? input : {}
  const stem = sanitizeStem(source.name)
  const root = await ensureRoot(cfg)
  const full = folderFilePath(root, stem)
  try {
    await stat(full)
  } catch {
    // free name
  }
  try {
    await readFile(full, 'utf8')
    throw fail('E_FOLDER_EXISTS', `收藏夹已存在: ${stem}`)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'E_FOLDER_EXISTS') throw error
  }
  const description = typeof source.description === 'string' ? source.description.trim() : ''
  const now = nowIso()
  const doc = {
    meta: { name: stem, description, created: now, updated: now },
    prelude: '',
    blocks: [],
  }
  await writeFolderFile(full, renderFolderText(doc))
  return { file: stem, name: stem, description }
}

/** Rename a folder file (name change also updates front matter). */
export async function renameFolder(cfg, input) {
  const source = input && typeof input === 'object' ? input : {}
  const from = sanitizeStem(source.name)
  const to = sanitizeStem(source.to)
  const root = await ensureRoot(cfg)
  const fromFull = folderFilePath(root, from)
  const toFull = folderFilePath(root, to)
  if (from === to) return { file: from }
  let text
  try {
    text = await readFile(fromFull, 'utf8')
  } catch {
    throw fail('E_FOLDER_MISSING', `收藏夹不存在: ${from}`)
  }
  try {
    await readFile(toFull, 'utf8')
    throw fail('E_FOLDER_EXISTS', `收藏夹已存在: ${to}`)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'E_FOLDER_EXISTS') throw error
  }
  const doc = parseFolderText(text, from)
  doc.meta.name = to
  doc.meta.updated = nowIso()
  await writeFolderFile(toFull, renderFolderText(doc))
  await unlink(fromFull)
  return { file: to }
}

/** Delete a folder file (and nothing else). */
export async function deleteFolder(cfg, folder) {
  const stem = sanitizeStem(folder)
  const root = await ensureRoot(cfg)
  try {
    await unlink(folderFilePath(root, stem))
  } catch {
    throw fail('E_FOLDER_MISSING', `收藏夹不存在: ${stem}`)
  }
  return { file: stem }
}

/** Atomically write one folder file. */
async function writeFolderFile(full, content) {
  const tmp = `${full}.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, full)
}

/** A normalized entry record used by the UI and the agent tools. */
function entryPayload(block, folderStem) {
  return {
    folder: folderStem,
    title: block.title,
    url: block.url,
    icon: block.meta.icon,
    desc: block.meta.desc,
    tags: block.meta.tags,
    added: block.meta.added,
  }
}

/**
 * Add or update one link inside a folder file.
 * @param cfg - resolved plugin config.
 * @param input - { folder, url, title?, desc?, tags?, body?, fetchIcon?,
 *   update? (true = upsert instead of erroring on an existing url),
 *   icon? (explicit icon override, '' clears) }.
 */
export async function upsertLink(cfg, input) {
  const source = input && typeof input === 'object' ? input : {}
  const rawUrl = typeof source.url === 'string' ? source.url.trim() : ''
  if (rawUrl.length === 0) throw fail('E_URL', '缺少链接 URL')
  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw fail('E_URL', `不是合法的 URL: ${rawUrl}`)
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw fail('E_URL', '只支持 http/https 链接')
  }
  const stem = sanitizeStem(source.folder)
  const title = typeof source.title === 'string' && source.title.trim().length > 0
    ? source.title.trim()
    : parsedUrl.hostname || rawUrl
  const update = source.update === true
  const allowUpdate = update
  const explicitIcon = typeof source.icon === 'string' ? source.icon : undefined

  return withWriteLock(async () => {
    const root = await ensureRoot(cfg)
    const full = folderFilePath(root, stem)
    let text
    let existed = true
    try {
      text = await readFile(full, 'utf8')
    } catch {
      if (update) {
        await writeFolderFile(full, renderFolderText({
          meta: { name: stem, description: '', created: nowIso(), updated: nowIso() },
          prelude: '',
          blocks: [],
        }))
        text = await readFile(full, 'utf8')
        existed = false
      } else {
        throw fail('E_FOLDER_MISSING', `收藏夹不存在: ${stem}`)
      }
    }
    const doc = parseFolderText(text, stem)
    const index = doc.blocks.findIndex((block) => block.type === 'entry' && block.url === rawUrl)
    const isNew = index === -1
    if (!isNew && !allowUpdate) {
      const error = fail('E_LINK_EXISTS', `该链接已在此收藏夹中: ${rawUrl}`)
      error.entry = entryPayload(doc.blocks[index], stem)
      throw error
    }

    const fetchIcon = source.fetchIcon !== false
    const oldEntry = isNew ? null : doc.blocks[index]
    let icon = isNew
      ? ''
      : (oldEntry.meta.icon ?? '')
    if (explicitIcon !== undefined) {
      icon = explicitIcon
    } else if (isNew || oldEntry === null || oldEntry.url !== rawUrl) {
      if (fetchIcon) {
        const fetched = await fetchFaviconForUrl(cfg, rawUrl)
        if (fetched !== null) icon = fetched
        else if (!isNew) icon = '' // 换 URL 且抓不到新图标 → 清掉旧图标
      } else if (!isNew) {
        icon = ''
      }
    }

    const entry = {
      title,
      url: rawUrl,
      meta: normalizeEntryMeta({
        icon,
        desc: typeof source.desc === 'string' ? source.desc : '',
        tags: typeof source.tags === 'string'
          ? source.tags
          : Array.isArray(source.tags) ? source.tags : [],
        added: isNew ? nowIso() : (oldEntry.meta.added || nowIso()),
      }),
      body: typeof source.body === 'string' ? source.body : '',
    }
    if (!isNew) {
      const current = oldEntry
      entry.meta = normalizeEntryMeta({
        icon: entry.meta.icon,
        tags: source.tags === undefined ? current.meta.tags : entry.meta.tags,
        desc: source.desc === undefined ? current.meta.desc : entry.meta.desc,
        added: current.meta.added || nowIso(),
      })
      entry.title = source.title === undefined || source.title.trim().length === 0
        ? current.title
        : entry.title
      entry.body = source.body === undefined ? current.body : entry.body
      entry.url = rawUrl
    }
    if (isNew) doc.blocks.push({ type: 'entry', ...entry })
    else doc.blocks[index] = { type: 'entry', ...entry }
    doc.meta.updated = nowIso()
    if (!existed && typeof doc.meta.created !== 'string') doc.meta.created = doc.meta.updated
    await writeFolderFile(full, renderFolderText(doc))
    return {
      created: isNew || !existed,
      updated: !isNew && existed,
      entry: entryPayload(entry, stem),
    }
  })
}

/** Delete one link (matched by its url) from a folder file. */
export async function removeLink(cfg, input) {
  const source = input && typeof input === 'object' ? input : {}
  const url = typeof source.url === 'string' ? source.url.trim() : ''
  if (url.length === 0) throw fail('E_URL', '缺少链接 URL')
  const stem = sanitizeStem(source.folder)
  return withWriteLock(async () => {
    const root = await ensureRoot(cfg)
    const full = folderFilePath(root, stem)
    let text
    try {
      text = await readFile(full, 'utf8')
    } catch {
      throw fail('E_FOLDER_MISSING', `收藏夹不存在: ${stem}`)
    }
    const doc = parseFolderText(text, stem)
    const index = doc.blocks.findIndex((block) => block.type === 'entry' && block.url === url)
    if (index === -1) throw fail('E_LINK_MISSING', `在该收藏夹中找不到这条链接: ${url}`)
    doc.blocks.splice(index, 1)
    doc.meta.updated = nowIso()
    await writeFolderFile(full, renderFolderText(doc))
    return { removed: true, url }
  })
}

// ---- favicon + page title discovery ----------------------------------------

/** Lowercased content-type base → file extension. */
const TYPE_EXT = {
  'image/png': 'png',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
}

/** Sniff an image extension from magic bytes, else fall back on the URL. */
function sniffExt(buffer, contentType, candidate) {
  if (typeof contentType === 'string') {
    const mapped = TYPE_EXT[contentType.split(';', 1)[0].trim().toLowerCase()]
    if (mapped !== undefined) return mapped
  }
  const bytes = buffer
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'ico'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif'
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp'
  const head = bytes.subarray(0, Math.min(bytes.length, 512)).toString('latin1')
  if (head.trimStart().toLowerCase().startsWith('<svg')) return 'svg'
  const tail = (candidate ?? '').toLowerCase()
  if (tail.endsWith('.ico')) return 'ico'
  if (tail.endsWith('.svg')) return 'svg'
  if (tail.endsWith('.png')) return 'png'
  return 'png'
}

/** Minimal HTML entity decoding for page titles. */
function decodeHtml(input) {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

/** Plain page title + `<link rel="icon">` hrefs for one URL. */
export async function probePage(cfg, url) {
  const u = new URL(url)
  const timeout = AbortSignal.timeout(cfg.metaTimeoutMs)
  let response
  try {
    response = await fetch(u, {
      redirect: 'follow',
      signal: timeout,
      headers: {
        'user-agent': `dsh-link-collect/${VERSION} (+link title probe)`,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    })
  } catch {
    return { title: '', relIcons: [] }
  }
  if (response.status !== 200) return { title: '', relIcons: [] }
  const type = typeof response.headers?.get === 'function'
    ? (response.headers.get('content-type') ?? '').toLowerCase()
    : ''
  if (type.length > 0 && !type.includes('text/html') && !type.includes('application/xhtml+xml')) {
    return { title: '', relIcons: [] }
  }
  const chunks = []
  let total = 0
  try {
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: false })
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const room = cfg.maxMetaBytes - total
        if (room <= 0) break
        const usable = value.length > room ? value.subarray(0, room) : value
        total += usable.length
        chunks.push(decoder.decode(usable, { stream: true }))
        if (value.length > room) break
      }
      if (total < cfg.maxMetaBytes) chunks.push(new TextDecoder('utf-8').decode())
    } else {
      return { title: '', relIcons: [] }
    }
  } catch {
    return { title: '', relIcons: [] }
  }
  const html = chunks.join('')
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const title = titleMatch === null
    ? ''
    : decodeHtml(titleMatch[1]).replace(/\s+/g, ' ').trim().slice(0, 240)
  const relIcons = []
  const linkTag = /<link\b[^>]*>/gi
  for (let tag = linkTag.exec(html); tag !== null; tag = linkTag.exec(html)) {
    const attrs = tag[0]
    const relMatch = /rel\s*=\s*["']([^"']*)["']/i.exec(attrs)
    if (relMatch === null || !/icon/i.test(relMatch[1])) continue
    const hrefMatch = /href\s*=\s*["']([^"']*)["']/i.exec(attrs)
    if (hrefMatch === null) continue
    try {
      relIcons.push(new URL(hrefMatch[1], u).href)
    } catch {
      // skip malformed href
    }
  }
  return { title, relIcons }
}

/** Existing local favicon for a URL (icons/<hash>.*), or null. */
export async function existingFavicon(cfg, url) {
  const root = await ensureRoot(cfg)
  const iconsDir = join(root, 'icons')
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 12)
  let names
  try {
    names = await readdir(iconsDir)
  } catch {
    return null
  }
  const found = names.find((entryName) => entryName.startsWith(`${hash}.`))
  return found === undefined ? null : `icons/${found}`
}

/** Try one favicon candidate; returns { buffer, ext } or null. */
async function attemptFavicon(cfg, candidate) {
  const timeout = AbortSignal.timeout(cfg.faviconTimeoutMs)
  let response
  try {
    response = await fetch(candidate, {
      redirect: 'follow',
      signal: timeout,
      headers: {
        'user-agent': `dsh-link-collect/${VERSION} (+favicon fetch)`,
        accept: 'image/*,*/*;q=0.8',
      },
    })
  } catch {
    return null
  }
  if (response.status !== 200) return null
  const type = typeof response.headers?.get === 'function'
    ? (response.headers.get('content-type') ?? '')
    : ''
  const base = type.split(';', 1)[0].trim().toLowerCase()
  const imageType = base.startsWith('image/') || base.length === 0
  if (!imageType) return null
  const chunks = []
  let total = 0
  try {
    if (!response.body || typeof response.body.getReader !== 'function') return null
    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const room = cfg.maxFaviconBytes - total
      if (room <= 0) return null // 超过字节上限，放弃该候选
      const usable = value.length > room ? value.subarray(0, room) : value
      total += usable.length
      chunks.push(Buffer.from(usable))
      if (value.length > room) return null
    }
  } catch {
    return null
  }
  const buffer = Buffer.concat(chunks)
  if (buffer.length < 4) return null
  const ext = sniffExt(buffer, type, candidate)
  const head = buffer.subarray(0, 512).toString('latin1')
  const looksHtml = head.trimStart().toLowerCase().startsWith('<!doctype html>')
    || head.trimStart().toLowerCase().startsWith('<html')
  if (looksHtml && ext === 'png' || looksHtml && ext === 'svg' && !head.trimStart().startsWith('<svg')) return null
  return { buffer, ext }
}

/**
 * Download a favicon for `url` into the library icons dir (when missing).
 * @returns relative `icons/<hash>.<ext>` path, or null when none available.
 */
export async function fetchFaviconForUrl(cfg, url) {
  const existing = await existingFavicon(cfg, url)
  if (existing !== null) return existing
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 12)
  const root = await ensureRoot(cfg)
  const iconsDir = join(root, 'icons')
  let origin
  try {
    origin = new URL(url).origin
  } catch {
    return null
  }
  const direct = `${origin}/favicon.ico`
  let downloaded = await attemptFavicon(cfg, direct)
  if (downloaded === null) {
    const probed = await probePage(cfg, url)
    for (const candidate of probed.relIcons) {
      downloaded = await attemptFavicon(cfg, candidate)
      if (downloaded !== null) break
    }
  }
  if (downloaded === null) {
    try {
      const host = new URL(url).hostname
      downloaded = await attemptFavicon(cfg, `https://icons.duckduckgo.com/ip3/${host}.ico`)
    } catch {
      downloaded = null
    }
  }
  if (downloaded === null) return null
  const name = `${hash}.${downloaded.ext}`
  const full = join(iconsDir, name)
  try {
    await stat(full)
  } catch {
    const tmp = `${full}.tmp`
    await writeFile(tmp, downloaded.buffer)
    await rename(tmp, full)
  }
  return `icons/${name}`
}

// ---- search ----------------------------------------------------------------

/** Search entries across folder files (optional folder / tag filters). */
export async function searchLibrary(cfg, input) {
  const source = input && typeof input === 'object' ? input : {}
  const query = typeof source.query === 'string' ? source.query.trim().toLowerCase() : ''
  const tag = typeof source.tag === 'string' ? source.tag.trim() : ''
  const folderFilter = typeof source.folder === 'string' && source.folder.trim().length > 0
    ? sanitizeStem(source.folder)
    : ''
  const limit = clamp(Number.isInteger(source.limit) ? source.limit : 50, 1, 200)
  const { folders } = await listFolders(cfg)
  const results = []
  for (const summary of folders) {
    if (folderFilter.length > 0 && summary.file !== folderFilter) continue
    const doc = await readFolder(cfg, summary.file)
    for (const block of doc.blocks) {
      if (block.type !== 'entry' || block.url.length === 0) continue
      const haystack = [
        block.title,
        block.url,
        block.meta.desc,
        block.body,
        block.meta.tags.join(' '),
      ].join(' ').toLowerCase()
      if (query.length > 0 && !haystack.includes(query)) continue
      if (tag.length > 0 && !block.meta.tags.some((entryTag) => entryTag.toLowerCase() === tag.toLowerCase())) continue
      results.push({
        folder: summary.file,
        ...entryPayload(block, summary.file),
        body: block.body,
      })
      if (results.length >= limit) break
    }
    if (results.length >= limit) break
  }
  return { query: source.query ?? '', tag, folder: folderFilter, count: results.length, results }
}

// ---- agent tools -----------------------------------------------------------

/** Shared `render` text helper for the three tools. */
function renderPlain(args, lines) {
  return [{ type: 'text', text: lines.join('\n') }]
}

/** Build the three agent tools. Exported so tests can run execute directly. */
export function buildTools(cfg) {
  const search = defineTool({
    name: 'link_collect_search',
    description:
      '在“链接收藏”库中搜索已收藏的链接。收藏库是把收藏夹保存成本地 Markdown 的文件夹；' +
      '每条收藏含标题、URL、简介、标签和自由正文。可按关键词、标签或限定某个收藏夹过滤。',
    parameters: {
      query: { type: 'string', description: '可选：关键词，匹配标题/URL/简介/标签/正文（大小写不敏感）。' },
      tag: { type: 'string', description: '可选：按标签精确过滤（大小写不敏感）。' },
      folder: { type: 'string', description: '可选：限定搜索的收藏夹名称。' },
      limit: { type: 'integer', description: '最多返回多少条（1-200，默认 50）。' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string' },
          tag: { type: 'string' },
          folder: { type: 'string' },
          count: { type: 'integer' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                folder: { type: 'string' },
                title: { type: 'string' },
                url: { type: 'string' },
                desc: { type: 'string' },
                icon: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                added: { type: 'string' },
              },
            },
          },
        },
      },
      render(args, value) {
        const parts = [`收藏库搜索结果 (${value.count})`]
        for (const item of value.results) {
          const tags = item.tags.length > 0 ? ` [${item.tags.join(', ')}]` : ''
          const desc = item.desc && item.desc.length > 0 ? ` — ${item.desc}` : ''
          parts.push(`- ${item.title}（收藏夹: ${item.folder}${tags}）${desc}\n  ${item.url}`)
        }
        if (value.results.length === 0) parts.push('没有匹配的收藏。')
        return renderPlain(args, parts)
      },
    },
    async execute(args, exec) {
      const payload = await searchLibrary(cfg, {
        query: typeof args?.query === 'string' ? args.query : '',
        tag: typeof args?.tag === 'string' ? args.tag : '',
        folder: typeof args?.folder === 'string' ? args.folder : '',
        limit: Number.isInteger(args?.limit) ? args.limit : 50,
      })
      exec?.signal?.throwIfAborted?.()
      return {
        query: typeof args?.query === 'string' ? args.query : '',
        tag: typeof args?.tag === 'string' ? args.tag : '',
        folder: payload.folder,
        count: payload.count,
        results: payload.results.map(({ folder, title, url, desc, icon, tags, added }) => ({
          folder, title, url, desc, icon, tags, added,
        })),
      }
    },
  })

  const add = defineTool({
    name: 'link_collect_add',
    description:
      '向“链接收藏”库添加（或更新）一条链接收藏。URL 已存在于该收藏夹时会改为更新而不是重复添加。' +
      '目标收藏夹不存在会自动创建。会尝试自动抓取该站点的图标存入本地；抓不到则留空。' +
      '若只想更新已有条目的标题/简介等而不改动其它内容，请先调用 link_collect_search 找到该 URL 所在的收藏夹。',
    parameters: {
      folder: { type: 'string', description: '必填：目标收藏夹名称（= 一个本地 .md 文件；不存在会自动创建）。' },
      url: { type: 'string', description: '必填：要收藏的链接，http/https。' },
      title: { type: 'string', description: '可选：标题；不填则用 URL 的主机名。' },
      desc: { type: 'string', description: '可选：一句话简介。' },
      tags: { type: 'string', description: '可选：标签，多个用英文或中文逗号分隔。' },
      body: { type: 'string', description: '可选：自由正文备注，任意 Markdown。' },
      fetchIcon: { type: 'boolean', description: '可选：是否尝试自动抓图标，默认 true。' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          folder: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string' },
          icon: { type: 'string' },
          created: { type: 'boolean' },
          updated: { type: 'boolean' },
          conflict: { type: 'boolean' },
        },
      },
      render(args, value) {
        const verb = value.created ? '已添加' : '已更新'
        const iconNote = value.icon ? ` 图标: ${value.icon}` : ''
        return renderPlain(args, [
          `${verb}收藏: ${value.title} → ${value.url}（收藏夹: ${value.folder}）${iconNote}`,
        ])
      },
    },
    async execute(args, exec) {
      const folder = typeof args?.folder === 'string' && args.folder.trim().length > 0
        ? args.folder.trim()
        : (() => { throw new Error('link_collect_add 缺少必填参数 folder（目标收藏夹）') })()
      const url = typeof args?.url === 'string' && args.url.trim().length > 0
        ? args.url.trim()
        : (() => { throw new Error('link_collect_add 缺少必填参数 url') })()
      const tags = typeof args?.tags === 'string' && args.tags.trim().length > 0
        ? args.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
        : []
      const result = await upsertLink(cfg, {
        folder,
        url,
        title: typeof args?.title === 'string' ? args.title : '',
        desc: typeof args?.desc === 'string' ? args.desc : '',
        tags,
        body: typeof args?.body === 'string' ? args.body : '',
        fetchIcon: args?.fetchIcon !== false,
        update: true,
      })
      exec?.signal?.throwIfAborted?.()
      return {
        folder,
        title: result.entry.title,
        url: result.entry.url,
        icon: result.entry.icon,
        created: result.created,
        updated: result.updated,
        conflict: false,
      }
    },
  })

  const list = defineTool({
    name: 'link_collect_list',
    description:
      '列出“链接收藏”库的收藏夹；带 folder 参数时列出该收藏夹内的链接（标题/URL/简介/标签）。',
    parameters: {
      folder: { type: 'string', description: '可选：收藏夹名称；省略则只列收藏夹概览。' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          folders: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                file: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                linkCount: { type: 'integer' },
              },
            },
          },
          folder: { type: 'string' },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                desc: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      render(args, value) {
        const parts = []
        if (value.entries !== undefined && value.folder) {
          parts.push(`收藏夹「${value.folder}」内的链接 (${value.entries.length})`)
          for (const entry of value.entries) {
            const tags = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : ''
            const desc = entry.desc && entry.desc.length > 0 ? ` — ${entry.desc}` : ''
            parts.push(`- ${entry.title}${tags}${desc}\n  ${entry.url}`)
          }
          if (value.entries.length === 0) parts.push('这个收藏夹还没有链接。')
        } else {
          parts.push(`收藏夹 (${value.folders.length})`)
          for (const item of value.folders) {
            const desc = item.description && item.description.length > 0 ? ` — ${item.description}` : ''
            parts.push(`- ${item.name}（${item.linkCount} 条链接）${desc}`)
          }
          if (value.folders.length === 0) parts.push('收藏库还是空的，用 link_collect_add 添加第一条。')
        }
        return renderPlain(args, parts)
      },
    },
    async execute(args, exec) {
      const folder = typeof args?.folder === 'string' ? args.folder.trim() : ''
      exec?.signal?.throwIfAborted?.()
      if (folder.length === 0) {
        const { folders } = await listFolders(cfg)
        return {
          folders: folders.map(({ file, name, description, linkCount }) => ({ file, name, description, linkCount })),
          folder: '',
          entries: [],
        }
      }
      const doc = await readFolder(cfg, folder)
      return {
        folders: [],
        folder: doc.file,
        entries: doc.blocks
          .filter((block) => block.type === 'entry' && block.url.length > 0)
          .map((block) => ({ title: block.title, url: block.url, desc: block.meta.desc, tags: block.meta.tags })),
      }
    },
  })

  return { search, add, list }
}

// ---- Browser UI routes ------------------------------------------------------

/** Whether the request peer is on the loopback interface (127/8, ::1). */
function isLoopbackPeer(req) {
  const address = req.socket?.remoteAddress
  if (typeof address !== 'string') return false
  if (address === '::1' || address === '::ffff:127.0.0.1') return true
  const octets = address.split('.')
  return octets.length === 4
    && octets[0] === '127'
    && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Whether the Host header names the loopback authority. */
function isLoopbackHost(req) {
  const host = req.headers?.host
  if (typeof host !== 'string' || host.length === 0) return false
  try {
    const hostname = new URL(`http://${host}`).hostname
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '[::1]'
      || hostname.endsWith('.localhost')
  } catch {
    return false
  }
}

/** Write one JSON response with explicit no-store semantics. */
function writeJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders,
  })
  res.end(body)
}

/** Read the whole request body as UTF-8, capped at `maxBytes` (413 when larger). */
function readBody(req, maxBytes) {
  return new Promise((resolveRead, reject) => {
    const chunks = []
    let total = 0
    let over = false
    req.on('data', (chunk) => {
      if (over) return
      total += chunk.length
      if (total > maxBytes) {
        over = true
        reject(Object.assign(new Error(`request body exceeds ${maxBytes} bytes`), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!over) resolveRead(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

const MAX_ROUTE_BODY = 512 * 1024

/** Map a thrown operation error to an HTTP status. */
function statusOf(error) {
  const code = error && typeof error === 'object' ? error.code : undefined
  if (code === 'E_FOLDER_EXISTS' || code === 'E_LINK_EXISTS') return 409
  if (code === 'E_FOLDER_MISSING' || code === 'E_LINK_MISSING') return 404
  if (code === 'E_NAME' || code === 'E_URL') return 400
  return 500
}

/** Guard check shared by every UI route. */
function guarded(req, res) {
  if (!isLoopbackPeer(req) || !isLoopbackHost(req)) {
    writeJson(res, 403, { error: 'forbidden: this route only serves the local DeepSeek Harness web UI' })
    return false
  }
  return true
}

/** Parse one JSON body; writes the 400 response itself on failure. */
async function readJsonBody(req, res) {
  let raw
  try {
    raw = await readBody(req, MAX_ROUTE_BODY)
  } catch (error) {
    const status = error && typeof error === 'object' && error.status === 413 ? 413 : 400
    writeJson(res, status, { error: error instanceof Error ? error.message : String(error) })
    return null
  }
  try {
    return JSON.parse(raw)
  } catch {
    writeJson(res, 400, { error: '请求体不是合法 JSON' })
    return null
  }
}

/** Build the exact route table serving the browser UI. */
export function buildRoutes(cfg) {
  const P = ROUTE_PREFIX

  return [
    // ---- state + root switch ----------------------------------------------
    {
      kind: 'exact',
      path: `${P}/state`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'GET') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'GET' })
          return
        }
        try {
          const active = await activeRoot(cfg)
          const anchor = anchorDir()
          let exists = false
          try {
            exists = (await stat(active.path)).isDirectory()
          } catch {
            exists = false
          }
          writeJson(res, 200, {
            root: active.path,
            anchor,
            defaultRoot: anchor,
            fromConfig: active.fromConfig,
            viaPointer: active.viaPointer,
            exists,
          })
        } catch (error) {
          writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${P}/root`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'PUT') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'PUT' })
          return
        }
        const payload = await readJsonBody(req, res)
        if (payload === null) return
        try {
          const switched = await setRoot(cfg, typeof payload.root === 'string' ? payload.root : '')
          writeJson(res, 200, { ok: true, root: switched.root })
        } catch (error) {
          writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },

    // ---- folders -----------------------------------------------------------
    {
      kind: 'exact',
      path: `${P}/folders`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'GET') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'GET' })
          return
        }
        try {
          const { root, folders } = await listFolders(cfg)
          writeJson(res, 200, { root, folders })
        } catch (error) {
          writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${P}/folder`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (req.method === 'GET') {
          const name = url.searchParams.get('name') ?? ''
          try {
            const doc = await readFolder(cfg, name)
            writeJson(res, 200, {
              file: doc.file,
              meta: doc.meta,
              entries: doc.blocks
                .filter((block) => block.type === 'entry' && block.url.length > 0)
                .map((block) => ({ ...entryPayload(block, doc.file), body: block.body })),
            })
          } catch (error) {
            writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        if (req.method === 'DELETE') {
          const name = url.searchParams.get('name') ?? ''
          try {
            const removed = await deleteFolder(cfg, name)
            writeJson(res, 200, { ok: true, ...removed })
          } catch (error) {
            writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'GET, DELETE' })
      },
    },
    {
      kind: 'exact',
      path: `${P}/folder/create`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'POST') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'POST' })
          return
        }
        const payload = await readJsonBody(req, res)
        if (payload === null) return
        try {
          const created = await createFolder(cfg, payload)
          writeJson(res, 200, { ok: true, ...created })
        } catch (error) {
          writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${P}/folder/rename`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'POST') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'POST' })
          return
        }
        const payload = await readJsonBody(req, res)
        if (payload === null) return
        try {
          const renamed = await renameFolder(cfg, payload)
          writeJson(res, 200, { ok: true, ...renamed })
        } catch (error) {
          writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },

    // ---- links -------------------------------------------------------------
    {
      kind: 'exact',
      path: `${P}/link`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'DELETE') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'DELETE' })
          return
        }
        const payload = await readJsonBody(req, res)
        if (payload === null) return
        try {
          const removed = await removeLink(cfg, payload)
          writeJson(res, 200, { ok: true, ...removed })
        } catch (error) {
          writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${P}/link/add`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'POST') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'POST' })
          return
        }
        const payload = await readJsonBody(req, res)
        if (payload === null) return
        try {
          const result = await upsertLink(cfg, { ...payload, update: false })
          writeJson(res, 200, { ok: true, ...result })
        } catch (error) {
          writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${P}/link/update`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'POST') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'POST' })
          return
        }
        const payload = await readJsonBody(req, res)
        if (payload === null) return
        try {
          const result = await upsertLink(cfg, { ...payload, update: true })
          writeJson(res, 200, { ok: true, ...result })
        } catch (error) {
          writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${P}/meta`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'GET') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'GET' })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const raw = url.searchParams.get('url') ?? ''
        if (raw.length === 0) {
          writeJson(res, 400, { error: '缺少 url 参数' })
          return
        }
        try {
          const target = new URL(raw)
          if (target.protocol !== 'http:' && target.protocol !== 'https:') {
            writeJson(res, 400, { error: '只支持 http/https 链接' })
            return
          }
          const probed = await probePage(cfg, raw)
          const icon = await existingFavicon(cfg, raw)
          writeJson(res, 200, {
            url: raw,
            title: probed.title,
            icon: icon ?? '',
            relIcons: probed.relIcons,
          })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${P}/search`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'GET') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'GET' })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        try {
          const payload = await searchLibrary(cfg, {
            query: url.searchParams.get('q') ?? '',
            tag: url.searchParams.get('tag') ?? '',
            folder: url.searchParams.get('folder') ?? '',
            limit: url.searchParams.get('limit') !== null ? Number(url.searchParams.get('limit')) : 50,
          })
          writeJson(res, 200, payload)
        } catch (error) {
          writeJson(res, statusOf(error), { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: `${P}/icon`,
      async handler(req, res) {
        if (!guarded(req, res)) return
        if (req.method !== 'GET') {
          writeJson(res, 405, { error: 'method not allowed' }, { Allow: 'GET' })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const rawName = url.searchParams.get('name') ?? ''
        // 图标名必须是 icons/ 目录内的单个文件名，拒绝路径穿越
        if (rawName.length === 0 || rawName.includes('/') || rawName.includes('\\') || rawName.includes('..')) {
          writeJson(res, 400, { error: '非法的图标文件名' })
          return
        }
        const name = basename(rawName)
        const root = await ensureRoot(cfg)
        const iconsDir = join(root, 'icons')
        const full = resolve(join(iconsDir, name))
        if (name.length === 0 || !full.startsWith(`${resolve(iconsDir)}${sep}`)) {
          writeJson(res, 400, { error: '非法的图标文件名' })
          return
        }
        const EXT_TYPE = {
          png: 'image/png',
          ico: 'image/x-icon',
          svg: 'image/svg+xml',
          webp: 'image/webp',
          gif: 'image/gif',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          bmp: 'image/bmp',
          avif: 'image/avif',
        }
        try {
          const buffer = await readFile(full)
          const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : 'png'
          res.writeHead(200, {
            'content-type': EXT_TYPE[ext] ?? 'application/octet-stream',
            'cache-control': 'private, max-age=86400',
            'content-length': buffer.length,
          })
          res.end(buffer)
        } catch {
          writeJson(res, 404, { error: '图标不存在' })
        }
      },
    },
  ]
}

// ---- apply -----------------------------------------------------------------

/**
 * Register the agent tools and, when a web server service is mounted, the UI
 * routes. Both registrations happen in child scopes so their disposers follow
 * this fiber's lifecycle.
 * @param ctx - Cordis context.
 * @param config - raw or resolved plugin config (may be absent in bare mounts).
 */
export function apply(ctx, config) {
  const cfg = resolveConfig(config)
  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.effect(() => {
      const tools = buildTools(cfg)
      toolCtx.tools.register(tools.search)
      toolCtx.tools.register(tools.add)
      toolCtx.tools.register(tools.list)
      return () => {}
    }, 'link-collect:tools')
  })
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const disposers = buildRoutes(cfg).map((route) => webCtx.webServer.register(route))
      return () => {
        for (const dispose of disposers) {
          try {
            dispose()
          } catch (error) {
            ctx.logger?.warn?.(`[link-collect] route dispose failed: ${String(error)}`)
          }
        }
      }
    }, 'link-collect:ui-routes')
  })
}
