/**
 * dsh-link-collect styles (browser half). Class prefix `lc-` (link collect).
 * Kept dependency-free and scoped under one root element.
 *
 * The sidebar entry row (`.dsh-lc-entry-*`) deliberately mirrors the
 * skill-explorer sidebar row: same DOM shape, geometry, and the shell's
 * `--dsw-alias-*` design tokens, so all plugin entries look like siblings.
 */

export const STYLE_CSS = `
/* ---- Sidebar entry row (mirrors skill-explorer's entry) ---- */
.dsh-lc-entry {
  box-sizing: border-box; width: 100%; height: 36px;
  color: var(--dsw-alias-label-secondary, var(--dsh-fg-muted, #6b7280));
  cursor: pointer; white-space: nowrap; background: transparent; border: none;
  border-radius: 8px; align-items: center; gap: 8px; padding: 0 10px;
  font-size: 13px; display: flex;
}
.dsh-lc-entry:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgb(127 127 127 / 12%));
  color: var(--dsw-alias-label-primary, var(--dsh-fg, #1f2328));
}
.dsh-lc-entry-icon {
  flex: none; justify-content: center; align-items: center;
  width: 24px; height: 24px; display: inline-flex;
}
.dsh-lc-entry-icon svg { width: 18px; height: 18px; display: block; }
.dsh-lc-entry-label { text-overflow: ellipsis; overflow: hidden; }
[data-dsh-frame][data-sidebar-collapsed] .dsh-lc-entry,
[data-sidebar-collapsed] .dsh-lc-entry {
  border-radius: 50%; justify-content: center;
  width: 36px; height: 36px; margin: 0 auto 12px; padding: 0;
}
[data-dsh-frame][data-sidebar-collapsed] .dsh-lc-entry-label,
[data-sidebar-collapsed] .dsh-lc-entry-label { display: none; }

/* ---- Overlay ---- */
.lc-overlay {
  position: fixed; inset: 0; z-index: 2147483000;
  display: flex; align-items: stretch; justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  color: var(--dsh-fg, #1f2328);
  font-size: 13px;
}
.lc-backdrop {
  position: absolute; inset: 0; background: rgba(8, 10, 14, 0.55);
  backdrop-filter: blur(2px);
}
.lc-dialog {
  position: relative; display: flex; flex-direction: column;
  width: min(1280px, 96vw); height: min(860px, 94vh); margin: auto;
  background: var(--dsh-panel-bg, #ffffff);
  border: 1px solid var(--dsh-border, rgba(31,35,40,.12));
  border-radius: 14px; box-shadow: 0 18px 60px rgba(0,0,0,.35);
  overflow: hidden;
}
.lc-head {
  display: flex; align-items: center; gap: 12px; flex: none;
  padding: 12px 16px; border-bottom: 1px solid var(--dsh-border, rgba(31,35,40,.1));
  background: var(--dsh-head-bg, transparent);
}
.lc-head h2 { margin: 0; font-size: 16px; font-weight: 650; display: flex; align-items: center; gap: 8px; }
.lc-head .lc-rootline { font-size: 12px; opacity: .62; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 46vw; }
.lc-head-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.lc-btn {
  border: 1px solid var(--dsh-border, rgba(31,35,40,.18));
  background: var(--dsh-btn-bg, #f6f7f9); color: inherit;
  border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px; line-height: 1.3;
}
.lc-btn:hover:not(:disabled) { background: var(--dsh-btn-hover, #eceef1); }
.lc-btn:disabled { opacity: .5; cursor: not-allowed; }
.lc-btn-primary {
  background: var(--dsh-accent, #2563eb); border-color: transparent; color: #fff; font-weight: 600;
}
.lc-btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--dsh-accent, #2563eb) 88%, #000); }
.lc-btn-danger { color: #d64545; }
.lc-btn-xs { padding: 2px 7px; font-size: 12px; border-radius: 6px; }
.lc-btn-sm { padding: 3px 9px; font-size: 12px; border-radius: 7px; }
.lc-btn-ghost { border-color: transparent; background: transparent; }
.lc-btn-ghost:hover:not(:disabled) { background: var(--dsh-btn-hover, #eceef1); }

.lc-body { display: flex; flex: 1; min-height: 0; }

/* ---- Left rail: folders + library controls ---- */
.lc-rail {
  width: 250px; flex: none; display: flex; flex-direction: column; min-height: 0;
  border-right: 1px solid var(--dsh-border, rgba(31,35,40,.1));
  background: var(--dsh-panel-bg, #fbfbfc);
}
.lc-rail-library {
  padding: 10px 12px; border-bottom: 1px solid var(--dsh-border, rgba(31,35,40,.08));
  display: flex; flex-direction: column; gap: 6px;
}
.lc-rail-label { font-size: 11px; font-weight: 700; opacity: .55; letter-spacing: .04em; text-transform: uppercase; }
.lc-rail-path { font-size: 12px; opacity: .8; word-break: break-all; line-height: 1.35; }
.lc-rail-path code { background: var(--dsh-code-bg, rgba(127,127,127,.1)); padding: 0 4px; border-radius: 4px; }
.lc-root-edit { display: flex; gap: 6px; }
.lc-root-edit input {
  flex: 1; min-width: 0; box-sizing: border-box;
  border: 1px solid var(--dsh-border, rgba(31,35,40,.2)); border-radius: 7px;
  padding: 5px 8px; font-size: 12px; background: var(--dsh-input-bg, #fff); color: inherit;
  outline: none;
}
.lc-root-edit input:focus { border-color: var(--dsh-accent, #2563eb); }
.lc-folder-list { flex: 1; overflow-y: auto; padding: 6px; min-height: 0; }
.lc-folder-row {
  display: flex; align-items: center; gap: 6px; width: 100%;
  border-radius: 8px; padding: 6px 8px; cursor: pointer;
  background: transparent; border: none; color: inherit; text-align: left; font-size: 13px;
}
.lc-folder-row:hover { background: var(--dsh-btn-hover, #eceef1); }
.lc-folder-row.active {
  background: color-mix(in srgb, var(--dsh-accent, #2563eb) 12%, transparent);
  color: var(--dsh-accent, #2563eb);
}
.lc-folder-name { flex: 1; min-width: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.lc-folder-count {
  flex: none; font-size: 11px; opacity: .6;
  background: var(--dsh-code-bg, rgba(127,127,127,.14)); border-radius: 9px; padding: 1px 7px;
}
/* 收藏夹行尾的「⋯」菜单:按钮常驻但低调,悬停/展开时高亮;菜单浮层用绝对定位 */
.lc-folder-ops { position: relative; display: inline-flex; align-items: center; flex: none; }
.lc-folder-more {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; padding: 0; border: none; border-radius: 6px;
  background: transparent; color: inherit; font-size: 15px; line-height: 1;
  cursor: pointer; opacity: .45; transition: opacity .12s ease, background .12s ease;
}
.lc-folder-row:hover .lc-folder-more,
.lc-folder-more:focus-visible,
.lc-folder-more[aria-expanded="true"] { opacity: 1; }
.lc-folder-more:hover { background: var(--dsh-code-bg, rgba(127,127,127,.18)); }
.lc-folder-menu {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 3;
  display: flex; flex-direction: column; gap: 2px; min-width: 104px; padding: 4px;
  background: var(--dsh-panel-bg, #fff);
  border: 1px solid var(--dsh-border, rgba(31,35,40,.16));
  border-radius: 9px; box-shadow: 0 8px 24px rgba(0,0,0,.18);
}
.lc-folder-menu-up { top: auto; bottom: calc(100% + 4px); }
.lc-folder-menu-item {
  border: none; border-radius: 6px; padding: 6px 10px; background: transparent;
  color: inherit; text-align: left; white-space: nowrap; font-size: 12.5px; cursor: pointer;
}
.lc-folder-menu-item:hover { background: var(--dsh-btn-hover, #eceef1); }
.lc-folder-menu-item.lc-danger { color: var(--dsh-danger, #dc2626); }
.lc-folder-menu-item.lc-danger:hover { background: color-mix(in srgb, var(--dsh-danger, #dc2626) 12%, transparent); }
.lc-new-folder { padding: 8px 10px; border-top: 1px solid var(--dsh-border, rgba(31,35,40,.08)); display: flex; gap: 6px; }
.lc-new-folder input {
  flex: 1; min-width: 0; box-sizing: border-box;
  border: 1px solid var(--dsh-border, rgba(31,35,40,.2)); border-radius: 7px;
  padding: 5px 8px; font-size: 12px; background: var(--dsh-input-bg, #fff); color: inherit; outline: none;
}
.lc-new-folder input:focus { border-color: var(--dsh-accent, #2563eb); }

/* ---- Main pane ---- */
.lc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.lc-toolbar {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  border-bottom: 1px solid var(--dsh-border, rgba(31,35,40,.08)); flex-wrap: wrap;
}
.lc-toolbar input[type="text"], .lc-toolbar select {
  box-sizing: border-box; border: 1px solid var(--dsh-border, rgba(31,35,40,.2));
  border-radius: 7px; padding: 5px 8px; font-size: 12px;
  background: var(--dsh-input-bg, #fff); color: inherit; outline: none;
}
.lc-toolbar input:focus, .lc-toolbar select:focus { border-color: var(--dsh-accent, #2563eb); }
.lc-toolbar .lc-toolbar-title { font-weight: 650; font-size: 14px; display: flex; align-items: center; gap: 8px; min-width: 0; }
.lc-toolbar .lc-toolbar-title .lc-sub { font-weight: 400; font-size: 12px; opacity: .55; }
.lc-toolbar .lc-grow { flex: 1; }
.lc-search-main { width: 200px; }
.lc-list { flex: 1; overflow-y: auto; padding: 10px 14px; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.lc-empty {
  color: var(--dsh-fg-muted, #6b7280); text-align: center; padding: 42px 16px; font-size: 13px;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
}
.lc-card {
  display: flex; gap: 10px; align-items: flex-start;
  border: 1px solid var(--dsh-border, rgba(31,35,40,.1)); border-radius: 10px;
  padding: 9px 11px; background: var(--dsh-card-bg, #fff);
}
.lc-card:hover { border-color: var(--dsh-border, rgba(31,35,40,.26)); }
.lc-favicon {
  width: 28px; height: 28px; flex: none; border-radius: 7px;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: var(--dsh-code-bg, rgba(127,127,127,.12)); color: var(--dsh-fg-muted, #6b7280);
}
.lc-favicon img { width: 28px; height: 28px; object-fit: contain; display: block; }
.lc-favicon svg { width: 16px; height: 16px; }
.lc-card-body { flex: 1; min-width: 0; }
.lc-card-title { font-weight: 600; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-card-title a { color: inherit; text-decoration: none; }
.lc-card-title a:hover { text-decoration: underline; color: var(--dsh-accent, #2563eb); }
.lc-card-host { font-size: 11.5px; opacity: .55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
.lc-card-desc { font-size: 12.5px; opacity: .85; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.lc-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.lc-tag {
  font-size: 11px; line-height: 1; padding: 3px 7px; border-radius: 9px;
  background: color-mix(in srgb, var(--dsh-accent, #2563eb) 10%, transparent);
  color: var(--dsh-accent, #2563eb);
}
.lc-card-ops { display: flex; gap: 4px; flex: none; align-items: center; opacity: 0; transition: opacity .12s; }
.lc-card:hover .lc-card-ops { opacity: 1; }
.lc-result-folder { font-size: 11px; opacity: .6; margin-top: 5px; }

/* ---- Editor modal ---- */
.lc-modal-backdrop {
  position: absolute; inset: 0; z-index: 2; background: rgba(8,10,14,.35);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.lc-modal {
  width: min(640px, 92%); max-height: 100%; overflow-y: auto;
  background: var(--dsh-panel-bg, #fff);
  border: 1px solid var(--dsh-border, rgba(31,35,40,.14));
  border-radius: 12px; box-shadow: 0 16px 44px rgba(0,0,0,.3);
  display: flex; flex-direction: column;
}
.lc-modal-head { padding: 12px 16px; border-bottom: 1px solid var(--dsh-border, rgba(31,35,40,.1)); font-weight: 650; font-size: 14px; display: flex; align-items: center; }
.lc-modal-head .lc-close { margin-left: auto; }
.lc-modal-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.lc-field { display: flex; flex-direction: column; gap: 4px; }
.lc-field label { font-size: 12px; font-weight: 600; opacity: .8; }
.lc-field .lc-hint { font-size: 11px; opacity: .55; }
.lc-field input[type="text"], .lc-field input[type="url"], .lc-field textarea, .lc-field select {
  box-sizing: border-box; width: 100%;
  border: 1px solid var(--dsh-border, rgba(31,35,40,.2)); border-radius: 8px;
  padding: 7px 9px; font-size: 13px; background: var(--dsh-input-bg, #fff); color: inherit; outline: none;
  font-family: inherit;
}
.lc-field input:focus, .lc-field textarea:focus, .lc-field select:focus { border-color: var(--dsh-accent, #2563eb); }
.lc-field textarea { min-height: 92px; resize: vertical; line-height: 1.5; }
.lc-field-row { display: flex; gap: 10px; }
.lc-field-row > .lc-field { flex: 1; }
.lc-modal-foot { padding: 10px 16px; border-top: 1px solid var(--dsh-border, rgba(31,35,40,.1)); display: flex; justify-content: flex-end; gap: 8px; }

/* ---- Toast ---- */
.lc-toast {
  position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 5;
  max-width: 70vw; padding: 7px 14px; border-radius: 9px; font-size: 12.5px;
  background: #1f2328; color: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.25);
}
.lc-toast.error { background: #b42318; }
.lc-toast.ok { background: #177245; }
.lc-loading { padding: 26px; text-align: center; opacity: .6; }
`
