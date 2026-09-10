window.__ModuleLoader__.load({ id: "dsh-link-collect", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_dom_client = require("react-dom/client");
//#region src/client/style.ts
/**
* dsh-link-collect styles (browser half). Class prefix `lc-` (link collect).
* Kept dependency-free and scoped under one root element.
*
* The sidebar entry row (`.dsh-lc-entry-*`) deliberately mirrors the
* skill-explorer sidebar row: same DOM shape, geometry, and the shell's
* `--dsw-alias-*` design tokens, so all plugin entries look like siblings.
*/
const STYLE_CSS = `
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
`;
//#endregion
//#region src/client/api.ts
/**
* Browser half of dsh-link-collect — shared types + host route calls.
* The page talks only to the loopback-guarded host routes; all Markdown /
* icon persistence happens host-side inside the chosen library folder.
*/
/** Route prefix mirrored from the host module (index.js). */
const ROUTE_PREFIX = "/api/link-collect";
/** One JSON request to the host; throws with the host's error message. */
async function jsonRequest(path, init) {
	const response = await fetch(path, init);
	const text = await response.text();
	if (!response.ok) {
		let message = `请求失败：HTTP ${response.status}`;
		try {
			const body = JSON.parse(text);
			if (typeof body.error === "string" && body.error) message = body.error;
		} catch {}
		throw new Error(message);
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new Error("宿主返回了无法解析的响应");
	}
}
function post(path, payload) {
	return jsonRequest(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload)
	});
}
/** GET the library root state. */
function apiState() {
	return jsonRequest(`${ROUTE_PREFIX}/state`, { headers: { Accept: "application/json" } });
}
/** Switch the library root ('' resets to the default folder). */
function apiSetRoot(root) {
	return jsonRequest(`${ROUTE_PREFIX}/root`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ root })
	});
}
/** List every folder file. */
function apiFolders() {
	return jsonRequest(`${ROUTE_PREFIX}/folders`, { headers: { Accept: "application/json" } });
}
/** Read one folder file with all its link entries. */
function apiFolder(name) {
	return jsonRequest(`${ROUTE_PREFIX}/folder?name=${encodeURIComponent(name)}`, { headers: { Accept: "application/json" } });
}
/** Create a folder file. */
function apiCreateFolder(name, description = "") {
	return post(`${ROUTE_PREFIX}/folder/create`, {
		name,
		description
	});
}
/** Rename a folder file. */
function apiRenameFolder(name, to) {
	return post(`${ROUTE_PREFIX}/folder/rename`, {
		name,
		to
	});
}
/** Delete a folder file. */
function apiDeleteFolder(name) {
	return jsonRequest(`${ROUTE_PREFIX}/folder?name=${encodeURIComponent(name)}`, { method: "DELETE" });
}
/** Add a link (errors with a readable message when the URL already exists). */
function apiAddLink(payload) {
	return post(`${ROUTE_PREFIX}/link/add`, payload);
}
/** Update a link (matched by oldUrl inside `payload.url` change tracking). */
function apiUpdateLink(payload) {
	return post(`${ROUTE_PREFIX}/link/update`, payload);
}
/** Delete a link. */
function apiDeleteLink(folder, url) {
	return post(`${ROUTE_PREFIX}/link`, {
		folder,
		url
	});
}
/** Probe one page for its title (used to auto-fill the add dialog). */
function apiMeta(url) {
	return jsonRequest(`${ROUTE_PREFIX}/meta?url=${encodeURIComponent(url)}`, { headers: { Accept: "application/json" } });
}
/** Search the whole library (or one folder). */
function apiSearch(input) {
	const params = new URLSearchParams();
	if (input.q) params.set("q", input.q);
	if (input.tag) params.set("tag", input.tag);
	if (input.folder) params.set("folder", input.folder);
	if (input.limit !== void 0) params.set("limit", String(input.limit));
	return jsonRequest(`${ROUTE_PREFIX}/search?${params.toString()}`, { headers: { Accept: "application/json" } });
}
/** Absolute fetch URL for one stored icon (relative `icons/…` path). */
function iconUrl(icon) {
	if (!icon) return "";
	const name = icon.split("/").pop() ?? icon;
	return `${ROUTE_PREFIX}/icon?name=${encodeURIComponent(name)}`;
}
/** Host fallback when a link has no local icon. */
function displayHost(entry) {
	try {
		return new URL(entry.url).hostname;
	} catch {
		return entry.url;
	}
}
//#endregion
//#region src/client/panel.tsx
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
/** Small createElement alias for readability. */
const h = react.createElement;
/** Fallback link glyph shown when an entry has no local icon. */
const NOICON_SVG = "<svg viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M7.2 8.8a3.4 3.4 0 0 0 4.9.2l1.9-1.9a3.4 3.4 0 1 0-4.8-4.8L7.9 3.6\"/><path d=\"M8.8 7.2a3.4 3.4 0 0 0-4.9-.2L2 8.9a3.4 3.4 0 1 0 4.8 4.8l1.3-1.3\"/></svg>";
/** One link card. */
function Card({ entry, global, onEdit, onDelete }) {
	const favicon = entry.icon ? h("img", {
		src: iconUrl(entry.icon),
		alt: "",
		loading: "lazy"
	}) : h("span", { dangerouslySetInnerHTML: { __html: NOICON_SVG } });
	const title = h("span", { className: "lc-card-title" }, h("a", {
		href: entry.url,
		target: "_blank",
		rel: "noreferrer noopener",
		onClick: (event) => event.stopPropagation()
	}, entry.title));
	const tags = entry.tags.length > 0 ? h("div", { className: "lc-card-tags" }, entry.tags.map((tag) => h("span", {
		key: tag,
		className: "lc-tag"
	}, tag))) : void 0;
	const ops = h("div", { className: "lc-card-ops" }, h("button", {
		type: "button",
		className: "lc-btn lc-btn-xs",
		title: "打开链接",
		onClick: () => {
			window.open(entry.url, "_blank", "noreferrer");
		}
	}, "打开"), h("button", {
		type: "button",
		className: "lc-btn lc-btn-xs",
		title: "编辑",
		onClick: () => onEdit(entry)
	}, "编辑"), h("button", {
		type: "button",
		className: "lc-btn lc-btn-xs lc-btn-danger",
		title: "删除",
		onClick: () => onDelete(entry)
	}, "删除"));
	return h("div", { className: "lc-card" }, h("div", { className: "lc-favicon" }, favicon ?? void 0), h("div", { className: "lc-card-body" }, title, h("div", { className: "lc-card-host" }, displayHost(entry)), entry.desc ? h("div", { className: "lc-card-desc" }, entry.desc) : void 0, tags, global ? h("div", { className: "lc-result-folder" }, `收藏夹: ${entry.folder}`) : void 0), ops);
}
/** Favicon placeholder element inside the dialog. */
function FaviconPreview({ icon }) {
	return h("div", { className: "lc-favicon" }, icon ? h("img", {
		src: iconUrl(icon),
		alt: ""
	}) : h("span", { dangerouslySetInnerHTML: { __html: NOICON_SVG } }));
}
/** Add/edit link editor modal. */
function EditorModal({ folders, state, onClose, onToast, onSaved }) {
	const editing = state.mode === "edit" && state.entry !== void 0;
	const initial = state.entry;
	const [folder, setFolder] = (0, react.useState)(editing && initial ? initial.folder : folders[0]?.file ?? "");
	const [url, setUrl] = (0, react.useState)(initial?.url ?? "");
	const [title, setTitle] = (0, react.useState)(initial?.title ?? "");
	const [desc, setDesc] = (0, react.useState)(initial?.desc ?? "");
	const [tagsText, setTagsText] = (0, react.useState)(initial ? initial.tags.join(", ") : "");
	const [body, setBody] = (0, react.useState)(initial?.body ?? "");
	const [probing, setProbing] = (0, react.useState)(false);
	const [saving, setSaving] = (0, react.useState)(false);
	const canSave = folder.length > 0 && url.trim().length > 0;
	const probe = async () => {
		const target = url.trim();
		if (!target) {
			onToast({
				kind: "error",
				text: "请先输入 URL 再自动获取"
			});
			return;
		}
		setProbing(true);
		try {
			const meta = await apiMeta(target);
			if (meta.title) setTitle(meta.title);
			onToast({
				kind: "ok",
				text: meta.title ? `已获取标题: ${meta.title}` : "未能自动获取标题，请手动填写"
			});
		} catch (error) {
			onToast({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setProbing(false);
		}
	};
	const submit = async () => {
		if (!canSave) return;
		const payload = {
			folder,
			url: url.trim(),
			title: title.trim() || void 0,
			desc: desc.trim() || void 0,
			tags: tagsText.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
			body: body.trim() || void 0,
			fetchIcon: true
		};
		setSaving(true);
		try {
			if (state.mode === "add") try {
				await apiAddLink(payload);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (!(message.includes("已存在") && window.confirm(`${message}。改为更新这条收藏？`))) throw error;
				await apiUpdateLink({
					...payload,
					oldUrl: payload.url
				});
			}
			else if (initial !== void 0) await apiUpdateLink({
				...payload,
				oldUrl: initial.url
			});
			onToast({
				kind: "ok",
				text: editing ? "已保存修改" : "已添加收藏"
			});
			onSaved(folder);
			onClose();
		} catch (error) {
			onToast({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setSaving(false);
		}
	};
	return h("div", {
		className: "lc-modal-backdrop",
		onClick: (event) => {
			if (event.target === event.currentTarget) onClose();
		}
	}, h("div", {
		className: "lc-modal",
		role: "dialog",
		"aria-modal": "true"
	}, h("div", { className: "lc-modal-head" }, editing ? "编辑链接" : "添加链接", h("button", {
		type: "button",
		className: "lc-btn lc-btn-xs lc-btn-ghost lc-close",
		onClick: onClose
	}, "✕")), h("div", { className: "lc-modal-body" }, h("div", { className: "lc-field" }, h("label", null, "目标收藏夹"), h("select", {
		value: folder,
		onChange: (event) => setFolder(event.target.value)
	}, folders.map((item) => h("option", {
		key: item.file,
		value: item.file
	}, item.name)))), h("div", { className: "lc-field-row" }, h("div", { className: "lc-field" }, h("label", null, "链接 URL"), h("input", {
		type: "url",
		placeholder: "https://…",
		value: url,
		onChange: (event) => setUrl(event.target.value)
	})), h("div", {
		className: "lc-field",
		style: {
			justifyContent: "flex-end",
			flexDirection: "row",
			alignItems: "flex-end"
		}
	}, h("button", {
		type: "button",
		className: "lc-btn lc-btn-sm",
		disabled: probing,
		onClick: probe
	}, probing ? "获取中…" : "自动获取标题"))), h("div", { className: "lc-field" }, h("label", null, "标题"), h("input", {
		type: "text",
		placeholder: "不填则用 URL 主机名",
		value: title,
		onChange: (event) => setTitle(event.target.value)
	})), h("div", { className: "lc-field" }, h("label", null, "简介"), h("input", {
		type: "text",
		placeholder: "一句话说明这个链接是什么",
		value: desc,
		onChange: (event) => setDesc(event.target.value)
	})), h("div", { className: "lc-field" }, h("label", null, "标签"), h("input", {
		type: "text",
		placeholder: "多个标签用逗号分隔，如: 文档, 官方",
		value: tagsText,
		onChange: (event) => setTagsText(event.target.value)
	})), h("div", { className: "lc-field" }, h("label", null, "正文备注（Markdown，可留空）"), h("textarea", {
		placeholder: "自由正文，例如使用心得、摘录……",
		value: body,
		onChange: (event) => setBody(event.target.value)
	})), h("div", {
		className: "lc-field",
		style: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8
		}
	}, h(FaviconPreview, { icon: initial?.icon ?? "" }), h("span", { className: "lc-hint" }, "保存时会自动抓取并下载该站点的图标到库内 icons/ 目录（抓不到则用占位图标）"))), h("div", { className: "lc-modal-foot" }, h("button", {
		type: "button",
		className: "lc-btn",
		onClick: onClose
	}, "取消"), h("button", {
		type: "button",
		className: "lc-btn lc-btn-primary",
		disabled: !canSave || saving,
		onClick: submit
	}, saving ? "保存中…" : "保存"))));
}
/** The main collection page. */
function LinkCollectPanel({ onClose }) {
	const [root, setRoot] = (0, react.useState)(null);
	const [folders, setFolders] = (0, react.useState)([]);
	const [selectedFile, setSelectedFile] = (0, react.useState)("");
	const [doc, setDoc] = (0, react.useState)(null);
	const [loading, setLoading] = (0, react.useState)(true);
	const [busy, setBusy] = (0, react.useState)(false);
	const [filter, setFilter] = (0, react.useState)("");
	const [newName, setNewName] = (0, react.useState)("");
	const [menuFor, setMenuFor] = (0, react.useState)(null);
	const [editor, setEditor] = (0, react.useState)(null);
	const [toast, setToast] = (0, react.useState)(null);
	const [globalQ, setGlobalQ] = (0, react.useState)("");
	const [globalTag, setGlobalTag] = (0, react.useState)("");
	const [globalFolder, setGlobalFolder] = (0, react.useState)("");
	const [globalResults, setGlobalResults] = (0, react.useState)(null);
	const notify = (next) => {
		setToast(next);
	};
	(0, react.useEffect)(() => {
		if (toast === null) return void 0;
		const timer = window.setTimeout(() => setToast(null), 3600);
		return () => window.clearTimeout(timer);
	}, [toast]);
	(0, react.useEffect)(() => {
		if (menuFor === null) return void 0;
		const onDocumentMouseDown = (event) => {
			const target = event.target;
			if (target && typeof target.closest === "function" && target.closest("[data-lc-folder-menu]") !== null) return;
			setMenuFor(null);
		};
		document.addEventListener("mousedown", onDocumentMouseDown);
		return () => document.removeEventListener("mousedown", onDocumentMouseDown);
	}, [menuFor]);
	const refresh = async (keepSelection = true) => {
		const [stateNow, list] = await Promise.all([apiState(), apiFolders()]);
		setRoot(stateNow);
		setFolders(list.folders);
		if (!keepSelection) {
			setSelectedFile("");
			setDoc(null);
			return;
		}
		if (selectedFile) if (!list.folders.some((item) => item.file === selectedFile)) {
			setSelectedFile("");
			setDoc(null);
		} else setDoc(await apiFolder(selectedFile));
	};
	const loadInitial = async () => {
		setLoading(true);
		try {
			const [stateNow, list] = await Promise.all([apiState(), apiFolders()]);
			setRoot(stateNow);
			setFolders(list.folders);
			if (list.folders.length > 0) {
				const first = list.folders[0];
				setSelectedFile(first.file);
				setDoc(await apiFolder(first.file));
			}
		} catch (error) {
			notify({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setLoading(false);
		}
	};
	(0, react.useEffect)(() => {
		loadInitial();
	}, []);
	const selectFolder = async (file) => {
		if (busy) return;
		setSelectedFile(file);
		setGlobalResults(null);
		setFilter("");
		setBusy(true);
		try {
			setDoc(await apiFolder(file));
		} catch (error) {
			notify({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
			setDoc(null);
		} finally {
			setBusy(false);
		}
	};
	const runGlobalSearch = async () => {
		if (busy) return;
		setBusy(true);
		try {
			setGlobalResults(await apiSearch({
				q: globalQ,
				tag: globalTag,
				folder: globalFolder,
				limit: 100
			}));
			setDoc(null);
		} catch (error) {
			notify({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setBusy(false);
		}
	};
	const createFolder = async () => {
		const name = newName.trim();
		if (name.length === 0) return;
		setBusy(true);
		try {
			await apiCreateFolder(name);
			setNewName("");
			await refresh(false);
			setSelectedFile(name);
			setDoc(await apiFolder(name));
		} catch (error) {
			notify({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setBusy(false);
		}
	};
	const renameFolder = async (item) => {
		const next = window.prompt("新的收藏夹名（会重命名对应的 .md 文件）", item.name);
		if (next === null) return;
		const name = next.trim();
		if (name.length === 0 || name === item.file) return;
		setBusy(true);
		try {
			await apiRenameFolder(item.file, name);
			setFolders((await apiFolders()).folders);
			if (selectedFile === item.file) {
				setSelectedFile(name);
				setDoc(await apiFolder(name));
			}
		} catch (error) {
			notify({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setBusy(false);
		}
	};
	const deleteFolder = async (item) => {
		if (!window.confirm(`删除收藏夹「${item.name}」？\n磁盘文件 ${item.file}.md 会被删除，此操作不可撤销。`)) return;
		setBusy(true);
		try {
			await apiDeleteFolder(item.file);
			notify({
				kind: "ok",
				text: `已删除收藏夹 ${item.name}`
			});
			await refresh();
		} catch (error) {
			notify({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setBusy(false);
		}
	};
	const deleteLink = async (entry) => {
		if (!window.confirm(`删除链接「${entry.title}」？`)) return;
		setBusy(true);
		try {
			await apiDeleteLink(entry.folder, entry.url);
			notify({
				kind: "ok",
				text: "已删除该链接"
			});
			await refresh();
		} catch (error) {
			notify({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setBusy(false);
		}
	};
	const switchRoot = async () => {
		const current = root?.root ?? "";
		const next = window.prompt("输入新的库目录（绝对路径，支持 ~；留空恢复默认）", current);
		if (next === null) return;
		setBusy(true);
		try {
			notify({
				kind: "ok",
				text: `库目录已切换到 ${(await apiSetRoot(next.trim())).root}`
			});
			await refresh(false);
		} catch (error) {
			notify({
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			});
		} finally {
			setBusy(false);
		}
	};
	const current = folders.find((item) => item.file === selectedFile) ?? null;
	const folderEntries = doc === null ? [] : doc.entries;
	const shownEntries = filter.trim().length === 0 ? folderEntries : folderEntries.filter((entry) => {
		return [
			entry.title,
			entry.url,
			entry.desc,
			entry.body,
			entry.tags.join(" ")
		].join(" ").toLowerCase().includes(filter.trim().toLowerCase());
	});
	const toolbar = h("div", { className: "lc-toolbar" }, h("div", { className: "lc-toolbar-title" }, current ? current.name : "链接收藏", h("span", { className: "lc-sub" }, current ? `${current.linkCount} 条链接 · ${doc?.file ?? current.file}.md` : folders.length === 0 ? "收藏库还是空的" : "选择一个收藏夹，或搜索整个库")), h("div", { className: "lc-grow" }), h("input", {
		type: "text",
		className: "lc-search-main",
		placeholder: current ? "在当前收藏夹内过滤…" : "全库关键词",
		value: filter,
		onChange: (event) => setFilter(event.target.value)
	}), h("button", {
		type: "button",
		className: "lc-btn lc-btn-sm",
		disabled: busy || folders.length === 0,
		title: "搜索整个库（所有收藏夹）",
		onClick: () => {
			setGlobalQ(filter);
			runGlobalSearch();
		}
	}, "全库搜索"), h("button", {
		type: "button",
		className: "lc-btn lc-btn-sm lc-btn-primary",
		disabled: busy || folders.length === 0,
		onClick: () => setEditor({ mode: "add" })
	}, "＋ 添加链接"));
	let mainContent;
	if (loading) mainContent = h("div", { className: "lc-loading" }, "正在读取收藏库…");
	else if (globalResults !== null) {
		const results = globalResults.results;
		mainContent = h("div", { className: "lc-list" }, results.length === 0 ? h("div", { className: "lc-empty" }, "没有匹配的收藏。换个关键词或去掉标签再试。") : results.map((entry) => h(Card, {
			key: `${entry.folder}:${entry.url}`,
			entry,
			global: true,
			onEdit: (target) => {
				const container = target.folder;
				setSelectedFile(container);
				setGlobalResults(null);
				(async () => {
					setBusy(true);
					try {
						setDoc(await apiFolder(container));
						setEditor({
							mode: "edit",
							entry: target
						});
					} catch (error) {
						notify({
							kind: "error",
							text: error instanceof Error ? error.message : String(error)
						});
					} finally {
						setBusy(false);
					}
				})();
			},
			onDelete: deleteLink
		})));
	} else if (current === null || doc === null) mainContent = h("div", { className: "lc-list" }, h("div", { className: "lc-empty" }, folders.length === 0 ? h("span", null, "还没有收藏夹。先在左侧输入名字新建一个收藏夹（= 一个本地 .md 文件），或点击“＋ 添加链接”。") : h("span", null, "从左侧选择一个收藏夹查看其中的链接。")));
	else mainContent = h("div", { className: "lc-list" }, shownEntries.length === 0 ? h("div", { className: "lc-empty" }, filter.trim().length > 0 ? "没有匹配的链接。" : "这个收藏夹还没有链接，点右上角“＋ 添加链接”收藏第一条。") : shownEntries.map((entry) => h(Card, {
		key: entry.url,
		entry,
		global: false,
		onEdit: (target) => setEditor({
			mode: "edit",
			entry: target
		}),
		onDelete: deleteLink
	})));
	const rail = h("div", { className: "lc-rail" }, h("div", { className: "lc-rail-library" }, h("div", { className: "lc-rail-label" }, "库目录（本地文件夹）"), h("div", { className: "lc-rail-path" }, root ? h("code", null, root.root) : "…"), h("div", { className: "lc-root-edit" }, h("button", {
		type: "button",
		className: "lc-btn lc-btn-sm",
		disabled: busy,
		onClick: switchRoot,
		title: "切换/恢复库目录"
	}, "切换目录")), h("div", {
		className: "lc-hint",
		style: {
			fontSize: 11,
			opacity: .55
		}
	}, root && !root.exists ? "（该目录还不存在，首次写入时自动创建）" : "每个收藏夹 = 一个 .md 文件")), h("div", { className: "lc-folder-list" }, folders.map((item, index) => {
		const menuOpen = menuFor === item.file;
		const openUp = index >= folders.length - 2 && folders.length > 2;
		return h("div", {
			key: item.file,
			className: `lc-folder-row${item.file === selectedFile ? " active" : ""}`,
			onClick: () => void selectFolder(item.file),
			role: "button",
			tabIndex: 0
		}, h("span", {
			className: "lc-folder-name",
			title: `${item.file}.md`
		}, item.name), h("span", { className: "lc-folder-count" }, String(item.linkCount)), h("span", {
			className: "lc-folder-ops",
			"data-lc-folder-menu": ""
		}, h("button", {
			type: "button",
			className: "lc-folder-more",
			title: "更多操作",
			"aria-haspopup": "menu",
			"aria-expanded": menuOpen ? "true" : "false",
			onClick: (event) => {
				event.stopPropagation();
				setMenuFor(menuOpen ? null : item.file);
			}
		}, "⋯"), menuOpen && h("div", {
			className: `lc-folder-menu${openUp ? " lc-folder-menu-up" : ""}`,
			role: "menu"
		}, h("button", {
			type: "button",
			className: "lc-folder-menu-item",
			role: "menuitem",
			onClick: (event) => {
				event.stopPropagation();
				setMenuFor(null);
				renameFolder(item);
			}
		}, "改名"), h("button", {
			type: "button",
			className: "lc-folder-menu-item lc-danger",
			role: "menuitem",
			onClick: (event) => {
				event.stopPropagation();
				setMenuFor(null);
				deleteFolder(item);
			}
		}, "删除"))));
	})), h("div", { className: "lc-new-folder" }, h("input", {
		type: "text",
		placeholder: "新建收藏夹名…",
		value: newName,
		onChange: (event) => setNewName(event.target.value),
		onKeyDown: (event) => {
			if (event.key === "Enter") createFolder();
		}
	}), h("button", {
		type: "button",
		className: "lc-btn lc-btn-sm lc-btn-primary",
		disabled: busy || newName.trim().length === 0,
		onClick: () => void createFolder()
	}, "新建")));
	return h("div", {
		className: "lc-overlay",
		"data-dsh-link-collect-root": "",
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "链接收藏"
	}, h("div", {
		className: "lc-backdrop",
		onClick: onClose
	}), h("div", { className: "lc-dialog" }, h("div", { className: "lc-head" }, h("h2", null, "🔖 链接收藏"), h("span", {
		className: "lc-rootline",
		title: root?.root
	}, root ? `库: ${root.root}${root.fromConfig ? "（配置指定）" : ""}` : ""), h("div", { className: "lc-head-actions" }, h("button", {
		type: "button",
		className: "lc-btn lc-btn-sm",
		disabled: busy,
		onClick: () => void refresh()
	}, "刷新"), h("button", {
		type: "button",
		className: "lc-btn lc-btn-sm lc-btn-ghost",
		onClick: onClose
	}, "关闭"))), h("div", { className: "lc-body" }, rail, h("div", { className: "lc-main" }, toolbar, mainContent)), editor !== null && h(EditorModal, {
		folders,
		state: editor,
		onClose: () => setEditor(null),
		onToast: notify,
		onSaved: (folder) => {
			setGlobalResults(null);
			setSelectedFile(folder);
			setBusy(true);
			(async () => {
				try {
					const [list, folderDoc] = await Promise.all([apiFolders(), apiFolder(folder)]);
					setFolders(list.folders);
					setDoc(folderDoc);
				} catch (error) {
					notify({
						kind: "error",
						text: error instanceof Error ? error.message : String(error)
					});
				} finally {
					setBusy(false);
				}
			})();
		}
	}), toast !== null && h("div", { className: `lc-toast${toast.kind === "error" ? " error" : " ok"}` }, toast.text)));
}
function createPanelController() {
	let root;
	let container;
	const close = () => {
		if (root !== void 0) {
			root.unmount();
			root = void 0;
		}
		if (container !== void 0) {
			container.remove();
			container = void 0;
		}
		document.removeEventListener("keydown", handleKey);
	};
	const handleKey = (event) => {
		if (event.key === "Escape") close();
	};
	const open = () => {
		if (root !== void 0) return;
		container = document.createElement("div");
		container.dataset.dshLinkCollectOverlay = "";
		container.dataset.dshPlugin = "dsh-link-collect";
		document.body.appendChild(container);
		document.addEventListener("keydown", handleKey);
		root = (0, react_dom_client.createRoot)(container);
		root.render(h(LinkCollectPanel, { onClose: close }));
	};
	return {
		toggle: () => root !== void 0 ? close() : open(),
		open,
		close,
		dispose: close
	};
}
//#endregion
//#region src/client/sidebar-entry.ts
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
const ENTRY_SELECTOR = "[data-dsh-link-collect-entry]";
/** Row / icon / label class names (styled in style.ts). */
const ENTRY_CLASS = "dsh-lc-entry";
const ICON_CLASS = "dsh-lc-entry-icon";
const LABEL_CLASS = "dsh-lc-entry-label";
/** Inline bookmark glyph for the sidebar entry (drawn at 18×18). */
const ENTRY_ICON = "<svg viewBox=\"0 0 16 16\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3.4 2.4h9.2v11.2L8 10.9l-4.6 2.7z\"/><path d=\"M5.2 5.8h5.6\"/></svg>";
/**
* Find the sidebar shell root element, or undefined while not yet mounted.
* Mirrors the skill-explorer sidebar-entry core: the logo row's parent owns
* the nav region both plugins inject their rows into.
*/
function sidebarRoot() {
	const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
	if (column === null) return void 0;
	return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild ?? void 0;
}
/** The New Session button: nested in the logo row on current shells. */
function newSessionButton(root) {
	const nested = root.querySelector("button[class*=\"newSession\"]");
	if (nested !== null) return nested;
	for (const child of root.children) if (child.tagName === "BUTTON") return child;
}
/** Try to place the entry; returns true once it is connected. */
function tryPlace(entry) {
	if (entry.isConnected) return true;
	const root = sidebarRoot();
	if (root === void 0) return false;
	const button = newSessionButton(root);
	if (button === void 0) {
		root.prepend(entry);
		return entry.isConnected;
	}
	const row = button.closest("[class*=\"logoRow\"]");
	const base = row !== null && row.parentElement === root ? row : button;
	const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches("[data-dsh-part=\"sidebar-entry\"]"));
	const lastFamily = family.length > 0 ? family[family.length - 1] : void 0;
	root.insertBefore(entry, lastFamily?.nextElementSibling ?? base.nextElementSibling);
	return entry.isConnected;
}
/**
* Mount the sidebar entry row, waiting for the shell to render.
* @param onToggle - opens/closes the link-collect overlay.
* @returns a disposer that removes the entry and stops observers.
*/
function mountSidebarEntry(onToggle) {
	document.querySelector(ENTRY_SELECTOR)?.remove();
	const entry = document.createElement("button");
	entry.type = "button";
	entry.setAttribute(ENTRY_SELECTOR.slice(1, -1), "");
	entry.setAttribute("data-dsh-plugin", "dsh-link-collect");
	entry.setAttribute("data-dsh-part", "sidebar-entry");
	entry.setAttribute("aria-label", "链接收藏");
	entry.title = "收藏链接：以 Markdown 保存在本地文件夹";
	entry.className = ENTRY_CLASS;
	const iconSpan = document.createElement("span");
	iconSpan.className = ICON_CLASS;
	iconSpan.innerHTML = ENTRY_ICON;
	const labelSpan = document.createElement("span");
	labelSpan.className = LABEL_CLASS;
	labelSpan.textContent = "链接收藏";
	entry.append(iconSpan, labelSpan);
	entry.addEventListener("click", onToggle);
	let placed = tryPlace(entry);
	const poll = window.setInterval(() => {
		if (!placed && tryPlace(entry)) placed = true;
	}, 600);
	const observer = new MutationObserver(() => {
		if (!entry.isConnected) placed = tryPlace(entry);
	});
	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
	return () => {
		window.clearInterval(poll);
		observer.disconnect();
		entry.remove();
	};
}
//#endregion
//#region src/client/index.ts
/**
* dsh-link-collect entry (browser half). Exports the Cordis-style client
* module surface (name/inject/apply). On apply it injects the plugin
* stylesheet, mounts the collection overlay controller and the sidebar entry
* row, and wires teardown into the fiber's effect lifecycle so a
* dispose/HMR unloads the UI cleanly.
*/
/** Cordis plugin name used by loader diagnostics. */
const name = "link-collect-ui";
/** No shared service rows are required; react comes from the module table. */
const inject = [];
/** Inject one plugin-owned stylesheet tag (idempotent by data attribute). */
function mountStyles() {
	const tagId = "dsh-link-collect";
	const existing = document.querySelector(`style[data-dsh-plugin="${tagId}"]`);
	if (existing instanceof HTMLStyleElement) return existing;
	const tag = document.createElement("style");
	tag.dataset.plugin = tagId;
	tag.textContent = STYLE_CSS;
	document.head.appendChild(tag);
	return tag;
}
function apply(ctx) {
	const styleTag = mountStyles();
	const panel = createPanelController();
	const disposeEntry = mountSidebarEntry(() => panel.toggle());
	ctx.effect?.(() => () => {
		disposeEntry();
		panel.dispose();
		styleTag.remove();
	}, "link-collect:ui");
}
//#endregion
exports.apply = apply;
exports.inject = inject;
exports.name = name;

return module.exports; } });
//# sourceMappingURL=client.js.map