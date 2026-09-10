/**
 * dsh-link-collect entry (browser half). Exports the Cordis-style client
 * module surface (name/inject/apply). On apply it injects the plugin
 * stylesheet, mounts the collection overlay controller and the sidebar entry
 * row, and wires teardown into the fiber's effect lifecycle so a
 * dispose/HMR unloads the UI cleanly.
 */

import { STYLE_CSS } from './style'
import { createPanelController } from './panel'
import { mountSidebarEntry } from './sidebar-entry'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'link-collect-ui'

/** No shared service rows are required; react comes from the module table. */
export const inject: readonly string[] = []

interface ClientContext {
  effect?: (callback: () => (() => void) | void, label?: string) => unknown
}

/** Inject one plugin-owned stylesheet tag (idempotent by data attribute). */
function mountStyles(): HTMLStyleElement {
  const tagId = 'dsh-link-collect'
  const existing = document.querySelector(`style[data-dsh-plugin="${tagId}"]`)
  if (existing instanceof HTMLStyleElement) return existing
  const tag = document.createElement('style')
  tag.dataset.plugin = tagId
  tag.textContent = STYLE_CSS
  document.head.appendChild(tag)
  return tag
}

export function apply(ctx: ClientContext): void {
  const styleTag = mountStyles()
  const panel = createPanelController()
  const disposeEntry = mountSidebarEntry(() => panel.toggle())
  ctx.effect?.(() => () => {
    disposeEntry()
    panel.dispose()
    styleTag.remove()
  }, 'link-collect:ui')
}
