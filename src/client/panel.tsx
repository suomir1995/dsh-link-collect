/**
 * dsh-link-collect page overlay (browser half). Rendered into its own React
 * root appended to document.body: this web shell exposes no public slot for
 * an external plugin page, so the overlay follows the dshmarket /
 * skill-explorer / steam-deals / dsh-api-client precedent (self-mounted
 * modal, removed on close and on fiber dispose).
 *
 * 链接收藏: pick a local folder (host-side path, instantly switchable) whose
 * Markdown files each hold one 收藏夹; browse/edit links with title/desc/
 * tags/free-form body and auto-downloaded favicons.
 */

import { createElement, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  apiAddLink, apiCreateFolder, apiDeleteFolder, apiDeleteLink, apiFolder, apiFolders,
  apiMeta, apiRenameFolder, apiSearch, apiSetRoot, apiState, apiUpdateLink, displayHost,
  iconUrl,
  type FolderDoc, type FolderSummary, type LinkEntry, type LinkPayload, type RootState,
  type SearchPayload,
} from './api'

/** Small createElement alias for readability. */
const h = createElement

/** Fallback link glyph shown when an entry has no local icon. */
const NOICON_SVG = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M7.2 8.8a3.4 3.4 0 0 0 4.9.2l1.9-1.9a3.4 3.4 0 1 0-4.8-4.8L7.9 3.6"/><path d="M8.8 7.2a3.4 3.4 0 0 0-4.9-.2L2 8.9a3.4 3.4 0 1 0 4.8 4.8l1.3-1.3"/></svg>'

/** Toast message state. */
interface Toast {
  kind: 'error' | 'ok'
  text: string
}

/** Editor dialog state. */
interface EditorState {
  mode: 'add' | 'edit'
  entry?: LinkEntry
}

/** One link card. */
function Card({ entry, global, onEdit, onDelete }: {
  entry: LinkEntry
  global: boolean
  onEdit: (entry: LinkEntry) => void
  onDelete: (entry: LinkEntry) => void
}) {
  const favicon = entry.icon
    ? h('img', { src: iconUrl(entry.icon), alt: '', loading: 'lazy' })
    : h('span', { dangerouslySetInnerHTML: { __html: NOICON_SVG } })
  const title = h('span', { className: 'lc-card-title' },
    h('a', { href: entry.url, target: '_blank', rel: 'noreferrer noopener', onClick: (event: { stopPropagation: () => void }) => event.stopPropagation() }, entry.title),
  )
  const tags = entry.tags.length > 0
    ? h('div', { className: 'lc-card-tags' },
        entry.tags.map((tag) => h('span', { key: tag, className: 'lc-tag' }, tag)),
      )
    : undefined
  const ops = h('div', { className: 'lc-card-ops' },
    h('button', {
      type: 'button', className: 'lc-btn lc-btn-xs', title: '打开链接',
      onClick: () => { window.open(entry.url, '_blank', 'noreferrer') },
    }, '打开'),
    h('button', {
      type: 'button', className: 'lc-btn lc-btn-xs', title: '编辑',
      onClick: () => onEdit(entry),
    }, '编辑'),
    h('button', {
      type: 'button', className: 'lc-btn lc-btn-xs lc-btn-danger', title: '删除',
      onClick: () => onDelete(entry),
    }, '删除'),
  )
  return h('div', { className: 'lc-card' },
    h('div', { className: 'lc-favicon' }, favicon ?? undefined),
    h('div', { className: 'lc-card-body' },
      title,
      h('div', { className: 'lc-card-host' }, displayHost(entry)),
      entry.desc ? h('div', { className: 'lc-card-desc' }, entry.desc) : undefined,
      tags,
      global ? h('div', { className: 'lc-result-folder' }, `收藏夹: ${entry.folder}`) : undefined,
    ),
    ops,
  )
}

/** Favicon placeholder element inside the dialog. */
function FaviconPreview({ icon }: { icon: string }) {
  const inner = icon
    ? h('img', { src: iconUrl(icon), alt: '' })
    : h('span', { dangerouslySetInnerHTML: { __html: NOICON_SVG } })
  return h('div', { className: 'lc-favicon' }, inner)
}

/** Add/edit link editor modal. */
function EditorModal({ folders, state, onClose, onToast, onSaved }: {
  folders: FolderSummary[]
  state: EditorState
  onClose: () => void
  onToast: (toast: Toast) => void
  onSaved: (folder: string) => void
}) {
  const editing = state.mode === 'edit' && state.entry !== undefined
  const initial = state.entry
  const [folder, setFolder] = useState(editing && initial ? initial.folder : (folders[0]?.file ?? ''))
  const [url, setUrl] = useState(initial?.url ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [desc, setDesc] = useState(initial?.desc ?? '')
  const [tagsText, setTagsText] = useState(initial ? initial.tags.join(', ') : '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [probing, setProbing] = useState(false)
  const [saving, setSaving] = useState(false)

  const canSave = folder.length > 0 && url.trim().length > 0

  const probe = async () => {
    const target = url.trim()
    if (!target) {
      onToast({ kind: 'error', text: '请先输入 URL 再自动获取' })
      return
    }
    setProbing(true)
    try {
      const meta = await apiMeta(target)
      if (meta.title) setTitle(meta.title)
      onToast({ kind: 'ok', text: meta.title ? `已获取标题: ${meta.title}` : '未能自动获取标题，请手动填写' })
    } catch (error) {
      onToast({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setProbing(false)
    }
  }

  const submit = async () => {
    if (!canSave) return
    const payload: LinkPayload = {
      folder,
      url: url.trim(),
      title: title.trim() || undefined,
      desc: desc.trim() || undefined,
      tags: tagsText.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      body: body.trim() || undefined,
      fetchIcon: true,
    }
    setSaving(true)
    try {
      if (state.mode === 'add') {
        try {
          await apiAddLink(payload)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const wantsUpdate = message.includes('已存在') && window.confirm(`${message}。改为更新这条收藏？`)
          if (!wantsUpdate) throw error
          await apiUpdateLink({ ...payload, oldUrl: payload.url as string })
        }
      } else if (initial !== undefined) {
        await apiUpdateLink({ ...payload, oldUrl: initial.url })
      }
      onToast({ kind: 'ok', text: editing ? '已保存修改' : '已添加收藏' })
      onSaved(folder)
      onClose()
    } catch (error) {
      onToast({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }

  return h('div', { className: 'lc-modal-backdrop', onClick: (event: { target: unknown; currentTarget: unknown }) => {
    if (event.target === event.currentTarget) onClose()
  } },
    h('div', { className: 'lc-modal', role: 'dialog', 'aria-modal': 'true' },
      h('div', { className: 'lc-modal-head' },
        editing ? '编辑链接' : '添加链接',
        h('button', { type: 'button', className: 'lc-btn lc-btn-xs lc-btn-ghost lc-close', onClick: onClose }, '✕'),
      ),
      h('div', { className: 'lc-modal-body' },
        h('div', { className: 'lc-field' },
          h('label', null, '目标收藏夹'),
          h('select', { value: folder, onChange: (event: { target: HTMLSelectElement }) => setFolder(event.target.value) },
            folders.map((item) => h('option', { key: item.file, value: item.file }, item.name)),
          ),
        ),
        h('div', { className: 'lc-field-row' },
          h('div', { className: 'lc-field' },
            h('label', null, '链接 URL'),
            h('input', {
              type: 'url', placeholder: 'https://…', value: url,
              onChange: (event: { target: HTMLInputElement }) => setUrl(event.target.value),
            }),
          ),
          h('div', { className: 'lc-field', style: { justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end' } },
            h('button', { type: 'button', className: 'lc-btn lc-btn-sm', disabled: probing, onClick: probe },
              probing ? '获取中…' : '自动获取标题',
            ),
          ),
        ),
        h('div', { className: 'lc-field' },
          h('label', null, '标题'),
          h('input', {
            type: 'text', placeholder: '不填则用 URL 主机名', value: title,
            onChange: (event: { target: HTMLInputElement }) => setTitle(event.target.value),
          }),
        ),
        h('div', { className: 'lc-field' },
          h('label', null, '简介'),
          h('input', {
            type: 'text', placeholder: '一句话说明这个链接是什么', value: desc,
            onChange: (event: { target: HTMLInputElement }) => setDesc(event.target.value),
          }),
        ),
        h('div', { className: 'lc-field' },
          h('label', null, '标签'),
          h('input', {
            type: 'text', placeholder: '多个标签用逗号分隔，如: 文档, 官方', value: tagsText,
            onChange: (event: { target: HTMLInputElement }) => setTagsText(event.target.value),
          }),
        ),
        h('div', { className: 'lc-field' },
          h('label', null, '正文备注（Markdown，可留空）'),
          h('textarea', {
            placeholder: '自由正文，例如使用心得、摘录……', value: body,
            onChange: (event: { target: HTMLTextAreaElement }) => setBody(event.target.value),
          }),
        ),
        h('div', { className: 'lc-field', style: { flexDirection: 'row', alignItems: 'center', gap: 8 } },
          h(FaviconPreview, { icon: initial?.icon ?? '' }),
          h('span', { className: 'lc-hint' }, '保存时会自动抓取并下载该站点的图标到库内 icons/ 目录（抓不到则用占位图标）'),
        ),
      ),
      h('div', { className: 'lc-modal-foot' },
        h('button', { type: 'button', className: 'lc-btn', onClick: onClose }, '取消'),
        h('button', {
          type: 'button', className: 'lc-btn lc-btn-primary', disabled: !canSave || saving, onClick: submit,
        }, saving ? '保存中…' : '保存'),
      ),
    ),
  )
}

/** The main collection page. */
function LinkCollectPanel({ onClose }: { onClose: () => void }) {
  const [root, setRoot] = useState<RootState | null>(null)
  const [folders, setFolders] = useState<FolderSummary[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [doc, setDoc] = useState<FolderDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')
  const [newName, setNewName] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  // global search mode
  const [globalQ, setGlobalQ] = useState('')
  const [globalTag, setGlobalTag] = useState('')
  const [globalFolder, setGlobalFolder] = useState('')
  const [globalResults, setGlobalResults] = useState<SearchPayload | null>(null)

  const notify = (next: Toast) => {
    setToast(next)
  }

  useEffect(() => {
    if (toast === null) return undefined
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  // 收藏夹「⋯」菜单：点击菜单以外的任何位置（或滚动列表）即关闭。
  useEffect(() => {
    if (menuFor === null) return undefined
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target && typeof target.closest === 'function' && target.closest('[data-lc-folder-menu]') !== null) return
      setMenuFor(null)
    }
    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => document.removeEventListener('mousedown', onDocumentMouseDown)
  }, [menuFor])

  const refresh = async (keepSelection = true) => {
    const [stateNow, list] = await Promise.all([apiState(), apiFolders()])
    setRoot(stateNow)
    setFolders(list.folders)
    if (!keepSelection) {
      setSelectedFile('')
      setDoc(null)
      return
    }
    if (selectedFile) {
      const still = list.folders.some((item) => item.file === selectedFile)
      if (!still) {
        setSelectedFile('')
        setDoc(null)
      } else {
        const folderDoc = await apiFolder(selectedFile)
        setDoc(folderDoc)
      }
    }
  }

  const loadInitial = async () => {
    setLoading(true)
    try {
      const [stateNow, list] = await Promise.all([apiState(), apiFolders()])
      setRoot(stateNow)
      setFolders(list.folders)
      if (list.folders.length > 0) {
        const first = list.folders[0]
        setSelectedFile(first.file)
        setDoc(await apiFolder(first.file))
      }
    } catch (error) {
      notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectFolder = async (file: string) => {
    if (busy) return
    setSelectedFile(file)
    setGlobalResults(null)
    setFilter('')
    setBusy(true)
    try {
      setDoc(await apiFolder(file))
    } catch (error) {
      notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
      setDoc(null)
    } finally {
      setBusy(false)
    }
  }

  const runGlobalSearch = async () => {
    if (busy) return
    setBusy(true)
    try {
      const payload = await apiSearch({ q: globalQ, tag: globalTag, folder: globalFolder, limit: 100 })
      setGlobalResults(payload)
      setDoc(null)
    } catch (error) {
      notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const createFolder = async () => {
    const name = newName.trim()
    if (name.length === 0) return
    setBusy(true)
    try {
      await apiCreateFolder(name)
      setNewName('')
      await refresh(false)
      setSelectedFile(name)
      setDoc(await apiFolder(name))
    } catch (error) {
      notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const renameFolder = async (item: FolderSummary) => {
    const next = window.prompt('新的收藏夹名（会重命名对应的 .md 文件）', item.name)
    if (next === null) return
    const name = next.trim()
    if (name.length === 0 || name === item.file) return
    setBusy(true)
    try {
      await apiRenameFolder(item.file, name)
      const list = await apiFolders()
      setFolders(list.folders)
      // 若正在查看被改名的收藏夹，则跟随新文件重新加载内容
      if (selectedFile === item.file) {
        setSelectedFile(name)
        setDoc(await apiFolder(name))
      }
    } catch (error) {
      notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const deleteFolder = async (item: FolderSummary) => {
    const confirmed = window.confirm(`删除收藏夹「${item.name}」？\n磁盘文件 ${item.file}.md 会被删除，此操作不可撤销。`)
    if (!confirmed) return
    setBusy(true)
    try {
      await apiDeleteFolder(item.file)
      notify({ kind: 'ok', text: `已删除收藏夹 ${item.name}` })
      await refresh()
    } catch (error) {
      notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const deleteLink = async (entry: LinkEntry) => {
    const confirmed = window.confirm(`删除链接「${entry.title}」？`)
    if (!confirmed) return
    setBusy(true)
    try {
      await apiDeleteLink(entry.folder, entry.url)
      notify({ kind: 'ok', text: '已删除该链接' })
      await refresh()
    } catch (error) {
      notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  const switchRoot = async () => {
    // Prompt-style: reuse an inline input through window.prompt for compactness.
    const current = root?.root ?? ''
    const next = window.prompt('输入新的库目录（绝对路径，支持 ~；留空恢复默认）', current)
    if (next === null) return
    setBusy(true)
    try {
      const switched = await apiSetRoot(next.trim())
      notify({ kind: 'ok', text: `库目录已切换到 ${switched.root}` })
      await refresh(false)
    } catch (error) {
      notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  // ---- render --------------------------------------------------------------
  const current = folders.find((item) => item.file === selectedFile) ?? null
  const folderEntries = doc === null ? [] : doc.entries
  const shownEntries = filter.trim().length === 0
    ? folderEntries
    : folderEntries.filter((entry) => {
        const hay = [entry.title, entry.url, entry.desc, entry.body, entry.tags.join(' ')].join(' ').toLowerCase()
        return hay.includes(filter.trim().toLowerCase())
      })

  const toolbar =
    h('div', { className: 'lc-toolbar' },
      h('div', { className: 'lc-toolbar-title' },
        current ? current.name : '链接收藏',
        h('span', { className: 'lc-sub' }, current
          ? `${current.linkCount} 条链接 · ${doc?.file ?? current.file}.md`
          : (folders.length === 0 ? '收藏库还是空的' : '选择一个收藏夹，或搜索整个库')),
      ),
      h('div', { className: 'lc-grow' }),
      h('input', {
        type: 'text', className: 'lc-search-main', placeholder: current ? '在当前收藏夹内过滤…' : '全库关键词',
        value: filter, onChange: (event: { target: HTMLInputElement }) => setFilter(event.target.value),
      }),
      h('button', {
        type: 'button', className: 'lc-btn lc-btn-sm', disabled: busy || folders.length === 0,
        title: '搜索整个库（所有收藏夹）',
        onClick: () => {
          setGlobalQ(filter)
          void runGlobalSearch()
        },
      }, '全库搜索'),
      h('button', {
        type: 'button', className: 'lc-btn lc-btn-sm lc-btn-primary', disabled: busy || folders.length === 0,
        onClick: () => setEditor({ mode: 'add' }),
      }, '＋ 添加链接'),
    )

  let mainContent
  if (loading) {
    mainContent = h('div', { className: 'lc-loading' }, '正在读取收藏库…')
  } else if (globalResults !== null) {
    const results = globalResults.results
    mainContent = h('div', { className: 'lc-list' },
      results.length === 0
        ? h('div', { className: 'lc-empty' }, '没有匹配的收藏。换个关键词或去掉标签再试。')
        : results.map((entry) => h(Card, {
            key: `${entry.folder}:${entry.url}`,
            entry,
            global: true,
            onEdit: (target) => {
              const container = target.folder
              setSelectedFile(container)
              setGlobalResults(null)
              void (async () => {
                setBusy(true)
                try {
                  const folderDoc = await apiFolder(container)
                  setDoc(folderDoc)
                  setEditor({ mode: 'edit', entry: target })
                } catch (error) {
                  notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
                } finally {
                  setBusy(false)
                }
              })()
            },
            onDelete: deleteLink,
          })),
    )
  } else if (current === null || doc === null) {
    mainContent = h('div', { className: 'lc-list' },
      h('div', { className: 'lc-empty' },
        folders.length === 0
          ? h('span', null, '还没有收藏夹。先在左侧输入名字新建一个收藏夹（= 一个本地 .md 文件），或点击“＋ 添加链接”。')
          : h('span', null, '从左侧选择一个收藏夹查看其中的链接。'),
      ),
    )
  } else {
    mainContent = h('div', { className: 'lc-list' },
      shownEntries.length === 0
        ? h('div', { className: 'lc-empty' },
            filter.trim().length > 0 ? '没有匹配的链接。' : '这个收藏夹还没有链接，点右上角“＋ 添加链接”收藏第一条。',
          )
        : shownEntries.map((entry) => h(Card, {
            key: entry.url,
            entry,
            global: false,
            onEdit: (target) => setEditor({ mode: 'edit', entry: target }),
            onDelete: deleteLink,
          })),
    )
  }

  const rail =
    h('div', { className: 'lc-rail' },
      h('div', { className: 'lc-rail-library' },
        h('div', { className: 'lc-rail-label' }, '库目录（本地文件夹）'),
        h('div', { className: 'lc-rail-path' }, root
          ? h('code', null, root.root)
          : '…'),
        h('div', { className: 'lc-root-edit' },
          h('button', { type: 'button', className: 'lc-btn lc-btn-sm', disabled: busy, onClick: switchRoot, title: '切换/恢复库目录' }, '切换目录'),
        ),
        h('div', { className: 'lc-hint', style: { fontSize: 11, opacity: .55 } },
          root && !root.exists ? '（该目录还不存在，首次写入时自动创建）' : '每个收藏夹 = 一个 .md 文件',
        ),
      ),
      h('div', { className: 'lc-folder-list' },
        folders.map((item, index) => {
          const menuOpen = menuFor === item.file
          // 靠近底部的行向上弹出菜单，避免被列表的滚动容器裁掉
          const openUp = index >= folders.length - 2 && folders.length > 2
          return h('div', { key: item.file, className: `lc-folder-row${item.file === selectedFile ? ' active' : ''}`, onClick: () => void selectFolder(item.file), role: 'button', tabIndex: 0 },
            h('span', { className: 'lc-folder-name', title: `${item.file}.md` }, item.name),
            h('span', { className: 'lc-folder-count' }, String(item.linkCount)),
            h('span', { className: 'lc-folder-ops', 'data-lc-folder-menu': '' },
              h('button', {
                type: 'button', className: 'lc-folder-more', title: '更多操作',
                'aria-haspopup': 'menu', 'aria-expanded': menuOpen ? 'true' : 'false',
                onClick: (event: { stopPropagation: () => void }) => {
                  event.stopPropagation()
                  setMenuFor(menuOpen ? null : item.file)
                },
              }, '⋯'),
              menuOpen && h('div', { className: `lc-folder-menu${openUp ? ' lc-folder-menu-up' : ''}`, role: 'menu' },
                h('button', {
                  type: 'button', className: 'lc-folder-menu-item', role: 'menuitem',
                  onClick: (event: { stopPropagation: () => void }) => {
                    event.stopPropagation()
                    setMenuFor(null)
                    void renameFolder(item)
                  },
                }, '改名'),
                h('button', {
                  type: 'button', className: 'lc-folder-menu-item lc-danger', role: 'menuitem',
                  onClick: (event: { stopPropagation: () => void }) => {
                    event.stopPropagation()
                    setMenuFor(null)
                    void deleteFolder(item)
                  },
                }, '删除'),
              ),
            ),
          )
        }),
      ),
      h('div', { className: 'lc-new-folder' },
        h('input', {
          type: 'text', placeholder: '新建收藏夹名…', value: newName,
          onChange: (event: { target: HTMLInputElement }) => setNewName(event.target.value),
          onKeyDown: (event: { key: string }) => { if (event.key === 'Enter') void createFolder() },
        }),
        h('button', {
          type: 'button', className: 'lc-btn lc-btn-sm lc-btn-primary', disabled: busy || newName.trim().length === 0,
          onClick: () => void createFolder(),
        }, '新建'),
      ),
    )

  return h('div', { className: 'lc-overlay', 'data-dsh-link-collect-root': '', role: 'dialog', 'aria-modal': 'true', 'aria-label': '链接收藏' },
    h('div', { className: 'lc-backdrop', onClick: onClose }),
    h('div', { className: 'lc-dialog' },
      h('div', { className: 'lc-head' },
        h('h2', null, '🔖 链接收藏'),
        h('span', { className: 'lc-rootline', title: root?.root },
          root ? `库: ${root.root}${root.fromConfig ? '（配置指定）' : ''}` : ''),
        h('div', { className: 'lc-head-actions' },
          h('button', { type: 'button', className: 'lc-btn lc-btn-sm', disabled: busy, onClick: () => void refresh() }, '刷新'),
          h('button', { type: 'button', className: 'lc-btn lc-btn-sm lc-btn-ghost', onClick: onClose }, '关闭'),
        ),
      ),
      h('div', { className: 'lc-body' },
        rail,
        h('div', { className: 'lc-main' },
          toolbar,
          mainContent,
        ),
      ),
      editor !== null && h(EditorModal, {
        folders,
        state: editor,
        onClose: () => setEditor(null),
        onToast: notify,
        onSaved: (folder) => {
          // 保存后按返回的 folder 精确重载内容，避免使用过期的 selectedFile
          setGlobalResults(null)
          setSelectedFile(folder)
          setBusy(true)
          void (async () => {
            try {
              const [list, folderDoc] = await Promise.all([apiFolders(), apiFolder(folder)])
              setFolders(list.folders)
              setDoc(folderDoc)
            } catch (error) {
              notify({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
            } finally {
              setBusy(false)
            }
          })()
        },
      }),
      toast !== null && h('div', { className: `lc-toast${toast.kind === 'error' ? ' error' : ' ok'}` }, toast.text),
    ),
  )
}

/** Overlay lifecycle controller: mount/unmount the panel's own React root. */
export interface PanelController {
  toggle: () => void
  open: () => void
  close: () => void
  dispose: () => void
}

export function createPanelController(): PanelController {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  const close = () => {
    if (root !== undefined) {
      root.unmount()
      root = undefined
    }
    if (container !== undefined) {
      container.remove()
      container = undefined
    }
    document.removeEventListener('keydown', handleKey)
  }
  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  }
  const open = () => {
    if (root !== undefined) return
    container = document.createElement('div')
    container.dataset.dshLinkCollectOverlay = ''
    container.dataset.dshPlugin = 'dsh-link-collect'
    document.body.appendChild(container)
    document.addEventListener('keydown', handleKey)
    root = createRoot(container)
    root.render(h(LinkCollectPanel, { onClose: close }))
  }
  return {
    toggle: () => (root !== undefined ? close() : open()),
    open,
    close,
    dispose: close,
  }
}
