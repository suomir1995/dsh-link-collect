/**
 * dsh-link-collect sidebar entry (browser half). This web shell exposes no
 * slot an external plugin can register into, so — following the dshmarket /
 * skill-explorer / dsh-steam-deals / dsh-api-client precedent — the entry
 * row is plain DOM injected beside the shell's New Session button. Placement
 * self-heals across React re-renders via a MutationObserver plus a light poll
 * until the shell exists.
 *
 * The entry's DOM shape and visual language mirror the skill-explorer
 * sidebar row (icon box + ellipsized label on the shell's --dsw-alias-*
 * design tokens) so 技能中心 / API 调试 / 链接收藏 look like siblings.
 */

/** Stable data attribute identifying the injected entry row. */
const ENTRY_SELECTOR = '[data-dsh-link-collect-entry]'

/** Row / icon / label class names (styled in style.ts). */
const ENTRY_CLASS = 'dsh-lc-entry'
const ICON_CLASS = 'dsh-lc-entry-icon'
const LABEL_CLASS = 'dsh-lc-entry-label'

/** Inline bookmark glyph for the sidebar entry (drawn at 18×18). */
export const ENTRY_ICON = '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.4 2.4h9.2v11.2L8 10.9l-4.6 2.7z"/><path d="M5.2 5.8h5.6"/></svg>'

/**
 * Find the sidebar shell root element, or undefined while not yet mounted.
 * Mirrors the skill-explorer sidebar-entry core: the logo row's parent owns
 * the nav region both plugins inject their rows into.
 */
function sidebarRoot(): Element | undefined {
  const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  const logo = column.querySelector('[class*="logoRow"]')
  return (logo?.parentElement ?? column.firstElementChild) ?? undefined
}

/** The New Session button: nested in the logo row on current shells. */
function newSessionButton(root: Element): HTMLButtonElement | undefined {
  const nested = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (nested !== null) return nested
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

/** Try to place the entry; returns true once it is connected. */
function tryPlace(entry: HTMLButtonElement): boolean {
  if (entry.isConnected) return true
  const root = sidebarRoot()
  if (root === undefined) return false
  const button = newSessionButton(root)
  if (button === undefined) {
    root.prepend(entry)
    return entry.isConnected
  }
  const row = button.closest('[class*="logoRow"]')
  const base = row !== null && row.parentElement === root ? row : button
  // Group plugin rows together: sit after any already-injected sidebar-entry
  // rows (skill-explorer, dshmarket, …), else right below the logo/New
  // Session row — the same nav region the other entries occupy.
  const family = Array.from(root.children)
    .filter((el): el is HTMLElement => el instanceof HTMLElement && el.matches('[data-dsh-part="sidebar-entry"]'))
  const lastFamily = family.length > 0 ? family[family.length - 1] : undefined
  root.insertBefore(entry, lastFamily?.nextElementSibling ?? base.nextElementSibling)
  return entry.isConnected
}

/**
 * Mount the sidebar entry row, waiting for the shell to render.
 * @param onToggle - opens/closes the link-collect overlay.
 * @returns a disposer that removes the entry and stops observers.
 */
export function mountSidebarEntry(onToggle: () => void): () => void {
  const existing = document.querySelector<HTMLButtonElement>(ENTRY_SELECTOR)
  existing?.remove()

  const entry = document.createElement('button')
  entry.type = 'button'
  entry.setAttribute(ENTRY_SELECTOR.slice(1, -1), '')
  entry.setAttribute('data-dsh-plugin', 'dsh-link-collect')
  entry.setAttribute('data-dsh-part', 'sidebar-entry')
  entry.setAttribute('aria-label', '链接收藏')
  entry.title = '收藏链接：以 Markdown 保存在本地文件夹'
  entry.className = ENTRY_CLASS

  const iconSpan = document.createElement('span')
  iconSpan.className = ICON_CLASS
  iconSpan.innerHTML = ENTRY_ICON
  const labelSpan = document.createElement('span')
  labelSpan.className = LABEL_CLASS
  labelSpan.textContent = '链接收藏'
  entry.append(iconSpan, labelSpan)
  entry.addEventListener('click', onToggle)

  let placed = tryPlace(entry)
  const poll = window.setInterval(() => {
    if (!placed && tryPlace(entry)) placed = true
  }, 600)

  const observer = new MutationObserver(() => {
    if (!entry.isConnected) {
      placed = tryPlace(entry)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    window.clearInterval(poll)
    observer.disconnect()
    entry.remove()
  }
}
