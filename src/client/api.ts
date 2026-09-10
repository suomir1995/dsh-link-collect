/**
 * Browser half of dsh-link-collect — shared types + host route calls.
 * The page talks only to the loopback-guarded host routes; all Markdown /
 * icon persistence happens host-side inside the chosen library folder.
 */

/** Route prefix mirrored from the host module (index.js). */
export const ROUTE_PREFIX = '/api/link-collect'

/** One 收藏夹 summary (one .md file inside the library root). */
export interface FolderSummary {
  file: string
  name: string
  description: string
  created: string
  updated: string
  updatedAt: string
  linkCount: number
  folderCount: number
}

/** One saved link inside a folder file. */
export interface LinkEntry {
  folder: string
  title: string
  url: string
  icon: string
  desc: string
  tags: string[]
  added: string
  body: string
}

/** A parsed folder document. */
export interface FolderDoc {
  file: string
  meta: { name: string; description: string; created: string; updated: string }
  entries: LinkEntry[]
}

/** Library root state returned by the host. */
export interface RootState {
  root: string
  anchor: string
  defaultRoot: string
  fromConfig: boolean
  viaPointer: boolean
  exists: boolean
}

/** Search payload over the whole library. */
export interface SearchResult extends LinkEntry {
  body: string
}

export interface SearchPayload {
  query: string
  tag: string
  folder: string
  count: number
  results: SearchResult[]
}

/** Add/update a link (folder/file side-effects happen host-side). */
export interface LinkPayload {
  folder: string
  url: string
  title?: string
  desc?: string
  tags?: string[]
  body?: string
  fetchIcon?: boolean
  icon?: string
}

/** Error payload shape used by the guarded routes. */
interface ApiErrorBody {
  error?: unknown
}

/** Parse an error response body into a readable message. */
async function errorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text()
  try {
    const body = JSON.parse(text) as ApiErrorBody
    if (typeof body.error === 'string' && body.error) return body.error
  } catch {
    // keep the fallback
  }
  return text.length > 0 && text.length < 200 ? text : `${fallback}（HTTP ${response.status}）`
}

/** One JSON request to the host; throws with the host's error message. */
async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const text = await response.text()
  if (!response.ok) {
    let message = `请求失败：HTTP ${response.status}`
    try {
      const body = JSON.parse(text) as ApiErrorBody
      if (typeof body.error === 'string' && body.error) message = body.error
    } catch {
      // status-only message
    }
    throw new Error(message)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('宿主返回了无法解析的响应')
  }
}

function post<T>(path: string, payload: unknown): Promise<T> {
  return jsonRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/** GET the library root state. */
export function apiState(): Promise<RootState> {
  return jsonRequest(`${ROUTE_PREFIX}/state`, { headers: { Accept: 'application/json' } })
}

/** Switch the library root ('' resets to the default folder). */
export function apiSetRoot(root: string): Promise<{ ok: boolean; root: string }> {
  return jsonRequest(`${ROUTE_PREFIX}/root`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root }),
  })
}

/** List every folder file. */
export function apiFolders(): Promise<{ root: string; folders: FolderSummary[] }> {
  return jsonRequest(`${ROUTE_PREFIX}/folders`, { headers: { Accept: 'application/json' } })
}

/** Read one folder file with all its link entries. */
export function apiFolder(name: string): Promise<FolderDoc> {
  return jsonRequest(`${ROUTE_PREFIX}/folder?name=${encodeURIComponent(name)}`, {
    headers: { Accept: 'application/json' },
  })
}

/** Create a folder file. */
export function apiCreateFolder(name: string, description = ''): Promise<{ ok: boolean; file: string; name: string }> {
  return post(`${ROUTE_PREFIX}/folder/create`, { name, description })
}

/** Rename a folder file. */
export function apiRenameFolder(name: string, to: string): Promise<{ ok: boolean; file: string }> {
  return post(`${ROUTE_PREFIX}/folder/rename`, { name, to })
}

/** Delete a folder file. */
export function apiDeleteFolder(name: string): Promise<{ ok: boolean; file: string }> {
  return jsonRequest(`${ROUTE_PREFIX}/folder?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
}

/** Add a link (errors with a readable message when the URL already exists). */
export function apiAddLink(payload: LinkPayload): Promise<{ ok: boolean; created: boolean; entry: LinkEntry }> {
  return post(`${ROUTE_PREFIX}/link/add`, payload)
}

/** Update a link (matched by oldUrl inside `payload.url` change tracking). */
export function apiUpdateLink(payload: LinkPayload & { oldUrl: string }): Promise<{ ok: boolean; updated: boolean; entry: LinkEntry }> {
  return post(`${ROUTE_PREFIX}/link/update`, payload)
}

/** Delete a link. */
export function apiDeleteLink(folder: string, url: string): Promise<{ ok: boolean; removed: boolean; url: string }> {
  return post(`${ROUTE_PREFIX}/link`, { folder, url })
}

/** Probe one page for its title (used to auto-fill the add dialog). */
export function apiMeta(url: string): Promise<{ url: string; title: string; icon: string; relIcons: string[] }> {
  return jsonRequest(`${ROUTE_PREFIX}/meta?url=${encodeURIComponent(url)}`, {
    headers: { Accept: 'application/json' },
  })
}

/** Search the whole library (or one folder). */
export function apiSearch(input: { q?: string; tag?: string; folder?: string; limit?: number }): Promise<SearchPayload> {
  const params = new URLSearchParams()
  if (input.q) params.set('q', input.q)
  if (input.tag) params.set('tag', input.tag)
  if (input.folder) params.set('folder', input.folder)
  if (input.limit !== undefined) params.set('limit', String(input.limit))
  return jsonRequest(`${ROUTE_PREFIX}/search?${params.toString()}`, { headers: { Accept: 'application/json' } })
}

/** Absolute fetch URL for one stored icon (relative `icons/…` path). */
export function iconUrl(icon: string): string {
  if (!icon) return ''
  const name = icon.split('/').pop() ?? icon
  return `${ROUTE_PREFIX}/icon?name=${encodeURIComponent(name)}`
}

/** First tag character chips / helpers. */
export function formatTags(tags: string[]): string {
  return tags.join(', ')
}

/** Host fallback when a link has no local icon. */
export function displayHost(entry: LinkEntry): string {
  try {
    return new URL(entry.url).hostname
  } catch {
    return entry.url
  }
}
