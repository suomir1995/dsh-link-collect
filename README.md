# dsh-link-collect — Bookmarks

English | [中文](README.zh.md)

A DeepSeek Harness plugin (bundle) that keeps your bookmarks as **local Markdown files**.

It is a DSH bundle in two halves:

- **Host half** (`index.js`, plain ESM, no build step) — a read/write service for one
  bookmark library. The library root is **a local folder you choose** (default
  `<DSH_HOME>/dsh-link-collect`; switchable inside the page and remembered, no restart
  required). Every `.md` file under the root is one collection; a bookmark is stored as a
  Markdown entry whose icon is fetched and downloaded into `icons/` inside the library.
  Loopback + same-origin guarded `GET/POST/PUT/DELETE` routes serve the Web UI and search,
  and three agent tools are registered: `link_collect_search` / `link_collect_add` /
  `link_collect_list`.
- **Client half** (`src/client/*`, built to `lib/client.js`) — the sidebar entry
  「链接收藏」 opens a page with the collection list on the left and link cards on the
  right: create / rename / delete collections, add / edit / delete links, per-collection
  filtering and library-wide search, and switching the library directory.

## Storage model (one collection = one .md file)

```
<library root>/                 ← the local folder you chose
  ├─ 前端资源.md                ← every .md file = one collection (file name = collection name)
  ├─ 工具站.md
  └─ icons/
      └─ <url hash>.<png|ico|svg> ← site icons fetched and downloaded automatically
```

Each collection file:

```markdown
---
name: 前端资源
description: 前端常用资源
created: 2025-01-01T00:00:00.000Z
updated: 2025-01-01T00:00:00.000Z
---

## [React 官方文档](https://react.dev)
<!-- @dsh-link {"icon":"icons/..png","tags":["react","官方"],"desc":"React 全家桶文档","added":"2025-01-02T00:00:00.000Z"} -->

Free-form body (any Markdown) up to the next `##` heading.
```

- **Tolerant parsing**: a `## [title](url)` heading is a link entry, so a hand-written
  Markdown file can be dropped into the library root and used as a collection as-is;
  missing icon / tags / description is not an error.
- An edit rewrites only the whole file that owns the target entry (idempotent
  serialization); paragraphs that cannot be parsed are preserved verbatim.

## Features

- Collection (group) management: create / rename (renames the `.md` file) / delete.
  Each row has a trailing「⋯」button that opens an overlay menu with "rename / delete"
  (clicking anywhere outside closes it; rows near the bottom open upwards so they are
  not clipped by the list).
- Link management: add / edit / delete, each with title, URL, one-line description,
  tags and a free-form body.
- Icons: saving a link fetches its icon and downloads it into `icons/` inside the
  library (chain: site `/favicon.ico` → page `<link rel="icon">` → DuckDuckGo fallback;
  a placeholder is used when nothing can be fetched).
- Tags + search: keyword filtering inside the current collection; library-wide search
  (keyword / tag / collection-scoped).
- Library directory: **switched inside the page, effective immediately and remembered**
  (the host stores the current library path in
  `<DSH_HOME>/dsh-link-collect/.link-collect-root`; an explicit `rootDir` in the config
  file takes precedence).
- Agent tools: `link_collect_search` (query bookmarks), `link_collect_add` (adds, or
  updates when the link already exists, and creates the collection if missing),
  `link_collect_list` (list collections / their links).
- Chinese UI; the sidebar entry DOM and visual language follow the skill center (36px
  rounded row + 24px icon box, shell `--dsw-alias-*` tokens, collapsible sidebar).

## Layout

| Path | Purpose |
| --- | --- |
| `index.js` | Host half: library/collection/link CRUD + favicon + agent tools + guarded routes |
| `cordis.patch.yml` | Bundle layer: host row `link-collect` |
| `src/client/*` | Browser half: sidebar entry + bookmarks page overlay (React) |
| `lib/client.js` | Built client artifact (`exports["./client"]`) |
| `tsdown.config.ts` | Client build (closure-factory `__ModuleLoader__` format) |
| `scripts/smoke-host.mjs` | Host-half smoke (md parsing/CRUD/tools, isolated DSH_HOME) |
| `scripts/loader-boot.mjs` | Real Loader + webServer HTTP route smoke |
| `scripts/smoke-client.mjs` | Client artifact smoke (executes the closure in a stub browser) |

## Build

The client half needs a build; the host half ships as plain ESM:

```sh
npm run build:client   # tsdown → lib/client.js (+ map)
```

The `tsdown` binary comes from the DeepSeek Harness checkout (the repo preset resolves
workspace manifests only, so it is not usable from an out-of-tree bundle). React is
resolved through the shell's module table (`react`, `react-dom/client`) and is never
bundled. The smoke scripts need `@deepseek-ai/*` to be resolvable locally (a temporary
`ln -s ~/.dsh/profiles/node_modules node_modules`, removed afterwards, is enough).

## Install

```sh
dsh plugin --profile web add ./dsh-link-collect
```

This appends a `dsh-link-collect` layer; restart the profile afterwards (both host and
client changes require a restart):

```sh
pnpm dsh web
```

After the restart a「链接收藏」entry appears in the left sidebar. The default library
directory is `<DSH_HOME>/dsh-link-collect` (created automatically); use "switch
directory" in the page to point it at any absolute local path (`~` is supported; leave
it empty to restore the default).

## Plugin config

All optional (defaults shown); override in the profile's own `cordis.patch.yml`:

```yaml
- id: link-collect
  config:
    rootDir: ''          # explicit library dir (absolute path / ~/…); empty = use the remembered one
    metaTimeoutMs: 10000 # page-title probe timeout
    faviconTimeoutMs: 6000  # single icon download timeout
    maxMetaBytes: 524288     # HTML read limit while probing
    maxFaviconBytes: 2097152 # icon byte limit
```

## Host routes (all loopback + same-origin guarded)

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/link-collect/state` | GET | Library root state (current path / config-pinned / exists) |
| `/api/link-collect/root` | PUT | Switch the library root (empty = restore default) |
| `/api/link-collect/folders` | GET | Collection summary list |
| `/api/link-collect/folder?name=` | GET / DELETE | Read a collection (with entries) / delete it |
| `/api/link-collect/folder/create` | POST | Create a collection |
| `/api/link-collect/folder/rename` | POST | Rename a collection (renames the file) |
| `/api/link-collect/link/add` | POST | Add a link (409 when the URL already exists) |
| `/api/link-collect/link/update` | POST | Update a link (located by oldUrl; the URL may change) |
| `/api/link-collect/link` | DELETE | Delete a link |
| `/api/link-collect/meta?url=` | GET | Probe the page title / existing icon |
| `/api/link-collect/search?q=&tag=&folder=` | GET | Library-wide (or single-collection) search |
| `/api/link-collect/icon?name=` | GET | Read an icon file from the library |

## Security boundaries

The browser reaches data only through the guarded routes above and never touches the
disk directly; icon reads reject path traversal; switching the root writes a dedicated
pointer file; every Markdown write goes through a temp file + atomic rename with a
single-writer queue against concurrent corruption. A missing directory is created
automatically.

## Remove

```sh
dsh plugin --profile web remove dsh-link-collect
```

## Verification record

- `scripts/smoke-host.mjs` (isolated DSH_HOME + temp library, no network) — all passed:
  front matter / entry parsing and idempotent round-trips, headings without links
  preserved verbatim, file-name sanitizing, root switching and pointer persistence,
  collection CRUD (duplicate name 409, rename keeps content), link
  add/read/duplicate 409/in-place update (title, description, tags, body)/delete,
  library-wide and tag search, `link_collect_add` auto-creating and updating,
  `link_collect_search` / `link_collect_list`, and a clean failure for offline favicon
  fetching (icon left empty, no error).
- `scripts/loader-boot.mjs` (real Cordis Loader + `dsh-host-webserver`, isolated
  DSH_HOME) — all passed: row loading, webServer binding, state/root switching, HTTP
  CRUD for collections and links, search, offline meta probing, icon path traversal 400
  / missing 404, foreign-host 403, wrong method 405, unknown route 404, malformed JSON
  400.
- `scripts/smoke-client.mjs` — all passed: `lib/client.js` registers
  `dsh-link-collect` as a `__ModuleLoader__` closure and exports
  `name: link-collect-ui / inject / apply`; no machine paths leak; only module-table
  externals (the react family) are resolved. Rebuilt and re-run after the collection
  actions moved to the trailing「⋯」overlay menu — still fully passing.
- Real-network probing (local machine, `faviconTimeoutMs/metaTimeoutMs=5000`):
  `rust-lang.org` → title OK + `icons/….png` (through the HTML `<link rel=icon>` chain);
  `cn.vuejs.org` → `icons/….svg`; `github.com` → `icons/….ico` (direct `/favicon.ico`);
  repeated calls hit the cache instead of re-downloading. v0.1.0 fixes a favicon
  byte-counting bug (multi-chunk downloads were wrongly treated as over the limit).
- Static preflight: `node …/dsh-plugin-development/scripts/check-artifact.mjs bundle .`
  → PASS, 0 warnings.
