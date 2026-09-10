/**
 * Host half smoke test (non-destructive, local only, no real network):
 *  - exercises the md parse/render round trip and entry block rewriting;
 *  - drives folder + link CRUD and root switching against temp directories;
 *  - runs the agent tools' execute() with favicon fetching disabled;
 *  - verifies favicon probes against an unroutable loopback port fail fast.
 * Run: node scripts/smoke-host.mjs
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  activeRoot, buildTools, createFolder, deleteFolder, fetchFaviconForUrl, listFolders,
  parseFolderText, readFolder, removeLink, renameFolder, renderEntryBlock, renderFolderText,
  resolveConfig, sanitizeStem, searchLibrary, setRoot, splitFrontMatter, upsertLink,
} from '../index.js'

const failures = []
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
  if (!cond) failures.push(name)
}

// ---- isolate DSH_HOME so the smoke never touches the real profile home ----
const dshHomeTmp = mkdtempSync(join(tmpdir(), 'dsh-lc-home-'))
process.env.DSH_HOME = dshHomeTmp

// ---- pure md helpers -------------------------------------------------------
{
  const sample = [
    '---',
    'name: 前端资源',
    'description: 前端常用',
    'created: 2025-01-01T00:00:00.000Z',
    'updated: 2025-01-01T00:00:00.000Z',
    '---',
    '',
    '## [React 官方文档](https://react.dev)',
    '<!-- @dsh-link {"icon":"icons/abc.png","tags":["react","官方"],"desc":"React 全家桶","added":"2025-01-02T00:00:00.000Z"} -->',
    '',
    '第一段正文。',
    '',
    '第二段正文。',
    '',
    '## [Vue 3](https://cn.vuejs.org)',
    '<!-- @dsh-link {"icon":"icons/def.png","tags":["vue"],"desc":"中文文档","added":"2025-01-03T00:00:00.000Z"} -->',
    '',
    '## 无链接的小标题(不属于链接条目)',
    '它下面的文字会并入上一条？不——它自身是一个 raw 块。',
    '',
  ].join('\n')
  const doc = parseFolderText(sample, '前端资源')
  check('front matter parsed', doc.meta.name === '前端资源' && doc.meta.description === '前端常用', JSON.stringify(doc.meta))
  const entries = doc.blocks.filter((block) => block.type === 'entry')
  check('two link entries parsed', entries.length === 2, `entries=${entries.length}`)
  check('entry fields parsed', entries[0].title === 'React 官方文档' && entries[0].url === 'https://react.dev'
    && entries[0].meta.tags.join(',') === 'react,官方' && entries[0].meta.desc === 'React 全家桶')
  check('body preserved incl blank line', entries[0].body.includes('第一段正文') && entries[0].body.includes('第二段正文')
    && entries[0].body.includes('\n\n'))
  const rawBlocks = doc.blocks.filter((block) => block.type === 'raw')
  check('plain heading kept as raw', rawBlocks.length === 1 && rawBlocks[0].raw.includes('无链接的小标题'))

  // round trip is stable (idempotent re-parse)
  const text1 = renderFolderText(doc)
  const doc2 = parseFolderText(text1, '前端资源')
  const entries2 = doc2.blocks.filter((block) => block.type === 'entry')
  check('render/parse round trip', entries2.length === 2
    && entries2[0].title === entries[0].title && entries2[0].meta.tags.join(',') === 'react,官方'
    && entries2[0].body === entries[0].body)
  check('round trip keeps raw block', renderFolderText(doc2).includes('无链接的小标题'))

  // splitFrontMatter on a file without front matter
  const plain = splitFrontMatter('## [A](https://a.example)\n')
  check('no front matter detected', plain.meta === null && plain.rest.startsWith('## [A]'))
  check('sanitize stem', sanitizeStem(' 我的 收藏夹/名字:*? ' ) === '我的 收藏夹名字')
  let nameError = false
  try { sanitizeStem('  //// ') } catch { nameError = true }
  check('sanitize rejects empty/invalid', nameError)
  check('renderEntryBlock round trip', parseFolderText(renderEntryBlock({ title: 'T', url: 'https://t.example', meta: { tags: ['a'] }, body: 'b' }), 'x')
    .blocks.some((block) => block.type === 'entry' && block.title === 'T'))
}

// ---- temp library CRUD -----------------------------------------------------
const cfg = resolveConfig({ faviconTimeoutMs: 500, metaTimeoutMs: 500 })
const tmp = mkdtempSync(join(tmpdir(), 'dsh-link-collect-'))

try {
  const base = await activeRoot(resolveConfig({}))
  check('default root under DSH home', base.path === join(dshHomeTmp, 'dsh-link-collect') && base.fromConfig === false, base.path)

  const switched = await setRoot(resolveConfig({}), tmp)
  check('setRoot switches + creates dirs', switched.root === tmp)
  const viaPointer = await activeRoot(resolveConfig({}))
  check('pointer remembers the switch', viaPointer.path === tmp && viaPointer.viaPointer === true, viaPointer.path)

  const created = await createFolder(cfg, { name: '工具站', description: '常用工具' })
  check('folder created', created.file === '工具站', created.file)
  let dupError = false
  try { await createFolder(cfg, { name: '工具站' }) } catch (error) { dupError = error && error.code === 'E_FOLDER_EXISTS' }
  check('duplicate folder rejected', dupError)

  const added = await upsertLink(cfg, {
    folder: '工具站', url: 'https://www.rust-lang.org/', title: 'Rust 官网', desc: 'Rust 语言官网',
    tags: ['rust', '语言'], body: '内存安全。', fetchIcon: false,
  })
  check('link added', added.created === true && added.entry.title === 'Rust 官网' && added.entry.icon === '')

  const added2 = await upsertLink(cfg, {
    folder: '工具站', url: 'https://example.com', title: 'Example', fetchIcon: false,
  })
  check('second link added', added2.created === true)

  const docA = await readFolder(cfg, '工具站')
  check('folder doc has two entries', docA.blocks.filter((b) => b.type === 'entry').length === 2)
  check('folder meta updated', typeof docA.meta.updated === 'string' && docA.meta.updated.length > 0)

  let conflictError = null
  try { await upsertLink(cfg, { folder: '工具站', url: 'https://example.com', fetchIcon: false }) } catch (error) { conflictError = error }
  check('duplicate link conflicts on add', conflictError !== null && conflictError.code === 'E_LINK_EXISTS')

  const updated = await upsertLink(cfg, {
    folder: '工具站', url: 'https://example.com', title: 'Example 改名', desc: '更新简介', tags: ['x'], body: '新正文', update: true, fetchIcon: false,
  })
  check('link updated in place', updated.updated === true && updated.entry.title === 'Example 改名' && updated.entry.desc === '更新简介')
  const docB = await readFolder(cfg, '工具站')
  const target = docB.blocks.find((b) => b.type === 'entry' && b.url === 'https://example.com')
  check('update persisted (tags/body)', target !== undefined && target.meta.tags.join(',') === 'x' && target.body === '新正文')

  const removed = await removeLink(cfg, { folder: '工具站', url: 'https://example.com' })
  check('link removed', removed.removed === true)
  const docC = await readFolder(cfg, '工具站')
  check('removal persisted', docC.blocks.filter((b) => b.type === 'entry').length === 1)

  const renamed = await renameFolder(cfg, { name: '工具站', to: '开发工具' })
  check('folder renamed', renamed.file === '开发工具')
  const docD = await readFolder(cfg, '开发工具')
  check('renamed file keeps entries + new name', docD.blocks.filter((b) => b.type === 'entry').length === 1 && docD.meta.name === '开发工具')

  const summary = await listFolders(cfg)
  check('listFolders sees one folder w/ 1 link', summary.folders.length === 1 && summary.folders[0].file === '开发工具' && summary.folders[0].linkCount === 1)

  const searched = await searchLibrary(cfg, { query: 'rust', tag: '' })
  check('search finds rust link', searched.count === 1 && searched.results[0].url === 'https://www.rust-lang.org/')
  const tagSearch = await searchLibrary(cfg, { query: '', tag: '语言' })
  check('tag search finds rust link', tagSearch.count === 1 && tagSearch.results[0].folder === '开发工具')

  await deleteFolder(cfg, '开发工具')
  const summary2 = await listFolders(cfg)
  check('folder deleted', summary2.folders.length === 0)

  // agent tools run against the temp library
  const tools = buildTools(cfg)
  const addResult = await tools.add.execute({ folder: '自动化', url: 'https://www.example.org/a', title: 'A 站', tags: 'a, b', fetchIcon: false }, {})
  check('agent add auto-creates folder', addResult.created === true && addResult.folder === '自动化')
  const listResult = await tools.list.execute({ folder: '自动化' }, {})
  check('agent list folder', listResult.folder === '自动化' && listResult.entries.length === 1)
  const searchResult = await tools.search.execute({ query: 'a 站', folder: '自动化' }, {})
  check('agent search folder', searchResult.count === 1 && searchResult.results[0].title === 'A 站')
  const overview = await tools.list.execute({}, {})
  check('agent list overview', Array.isArray(overview.folders) && overview.folders.length === 1 && overview.folders[0].file === '自动化')

  // favicon / probe fail fast against an unroutable local port (no network)
  const iconResult = await fetchFaviconForUrl(cfg, 'http://127.0.0.1:9/no-favicon')
  check('favicon fetch fails cleanly offline', iconResult === null)
  const tools2 = buildTools(cfg)
  const offlineAdd = await tools2.add.execute({ folder: '自动化', url: 'http://127.0.0.1:9/page', title: '离线站', fetchIcon: true }, {})
  check('agent add with failing favicon still saves', offlineAdd.created === true && offlineAdd.icon === '')
} finally {
  rmSync(tmp, { recursive: true, force: true })
  rmSync(dshHomeTmp, { recursive: true, force: true })
}

console.log(failures.length === 0 ? '\nALL HOST SMOKE CHECKS PASSED' : `\n${failures.length} FAILURE(S): ${failures.join(', ')}`)
process.exit(failures.length === 0 ? 0 : 1)
