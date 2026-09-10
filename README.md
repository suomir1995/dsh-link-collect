# dsh-link-collect — 链接收藏(本地 Markdown 收藏夹)

DSH bundle,分两半:

- **Host 半区**(`index.js`,纯 ESM,无需构建)—— 一个「收藏库」的读写服务:
  库根是一个**你选择的本地文件夹**(默认 `<DSH_HOME>/dsh-link-collect`,可在页面
  内切换并记住,无需重启);库根下每个 `.md` 文件 = 一个收藏夹;链接保存成
  Markdown 条目,图标自动抓取并下载到库内 `icons/`。loopback + same-origin
  守卫的 `GET/POST/PUT/DELETE` 路由供 Web UI 与检索使用;另注册
  `link_collect_search` / `link_collect_add` / `link_collect_list` 三个 agent 工具。
- **客户端半区**(`src/client/*`,构建到 `lib/client.js`)—— 左侧栏「链接收藏」
  入口打开页面:左侧收藏夹列表 + 右侧链接卡片,支持新建/改名/删除收藏夹、
  添加/编辑/删除链接、当前夹内过滤与全库搜索、切换库目录。

## 存储模型(一个收藏夹 = 一个 .md 文件)

```
<库根目录>/                     ← 你选的本地文件夹
  ├─ 前端资源.md                ← 每个 .md 文件 = 一个收藏夹(文件名 = 收藏夹名)
  ├─ 工具站.md
  └─ icons/
      └─ <url哈希>.<png|ico|svg> ← 自动抓取下载的站点图标
```

每个收藏夹文件:

```markdown
---
name: 前端资源
description: 前端常用资源
created: 2025-01-01T00:00:00.000Z
updated: 2025-01-01T00:00:00.000Z
---

## [React 官方文档](https://react.dev)
<!-- @dsh-link {"icon":"icons/..png","tags":["react","官方"],"desc":"React 全家桶文档","added":"2025-01-02T00:00:00.000Z"} -->

这里是自由正文(任意 Markdown),直到下一个 `##` 标题为止。
```

- **宽容解析**:`## [标题](链接)` 就是一个链接条目;手写普通 Markdown 文件也能
  直接放进库根当收藏夹,缺图标/标签/简介不报错。
- 修改只重写目标条目所在的整个文件(幂等序列化),解析不了的原始段落原样保留。

## 功能

- 收藏夹(分组)管理:新建 / 重命名(重命名对应 .md 文件)/ 删除;每个收藏夹行尾
  有「⋯」按钮,点击后在浮层菜单里选「改名 / 删除」(点击菜单外任意位置即关闭,
  靠近底部的行向上弹出,避免被列表裁掉)。
- 链接管理:添加 / 编辑 / 删除;每条含标题、URL、一句话简介、标签、自由正文。
- 图标:保存链接时自动抓取图标并下载到库内 `icons/`(链:站点 `/favicon.ico` →
  页面 `<link rel="icon">` → DuckDuckGo 兜底;抓不到则用占位图标)。
- 标签 + 搜索:当前收藏夹内关键词过滤;全库搜索(关键词/标签/限定收藏夹)。
- 库目录:**页面内切换、即时生效并记住**(host 把当前库路径记在
  `<DSH_HOME>/dsh-link-collect/.link-collect-root`;配置文件里显式写
  `rootDir` 时优先于它)。
- agent 工具:`link_collect_search`(检索收藏)、`link_collect_add`(新增,已存在则
  更新,收藏夹不存在自动创建)、`link_collect_list`(列收藏夹/夹内链接)。
- 中文界面;侧栏入口 DOM 与视觉语言对齐技能中心(36px 圆角行 + 24px 图标盒,
  使用 shell 的 `--dsw-alias-*` 令牌,支持侧栏折叠)。

## 布局

| 路径 | 作用 |
| --- | --- |
| `index.js` | Host 半区:库/收藏夹/链接 CRUD + favicon + agent 工具 + guard 路由 |
| `cordis.patch.yml` | Bundle layer:host 行 `link-collect` |
| `src/client/*` | 浏览器半区:侧栏入口 + 收藏页面覆盖层(React) |
| `lib/client.js` | 构建出的客户端产物(`exports["./client"]`) |
| `tsdown.config.ts` | 客户端构建(closure-factory `__ModuleLoader__` 格式) |
| `scripts/smoke-host.mjs` | Host 半区冒烟(md 解析/CRUD/工具,隔离 DSH_HOME) |
| `scripts/loader-boot.mjs` | 真实 Loader + webServer 的 HTTP 路由冒烟 |
| `scripts/smoke-client.mjs` | 客户端产物冒烟(stub 浏览器执行 closure) |

## Build

客户端半区需要构建;host 半区直接以 ESM 交付:

```sh
npm run build:client   # tsdown → lib/client.js (+ map)
```

`tsdown` 二进制来自 DeepSeek Harness checkout(仓库 preset 只解析 workspace
manifest,out-of-tree bundle 用不了);React 通过 shell 的模块表解析
(`react`、`react-dom/client`),绝不打包。冒烟脚本需要本机可解析
`@deepseek-ai/*`(临时 `ln -s ~/.dsh/profiles/node_modules node_modules`
即可,跑完删除)。

## Install

```sh
dsh plugin --profile web add ./dsh-link-collect
```

追加 `dsh-link-collect` layer 后重启 profile(host 与 client 变更都需重启):

```sh
pnpm dsh web
```

重启后左侧栏出现「链接收藏」入口。首次使用默认为库目录
`<DSH_HOME>/dsh-link-collect`(自动创建);可在页面内「切换目录」填任意本地
绝对路径(支持 `~`,留空恢复默认)。

## Plugin config

全部可选(默认值如下);可在 profile 自己的 `cordis.patch.yml` 里覆盖:

```yaml
- id: link-collect
  config:
    rootDir: ''          # 显式指定库目录(绝对路径/~/…);空 = 用页面记住的目录
    metaTimeoutMs: 10000 # 页面标题探测超时
    faviconTimeoutMs: 6000  # 单次图标下载超时
    maxMetaBytes: 524288     # 探测时 HTML 读取上限
    maxFaviconBytes: 2097152 # 图标字节上限
```

## Host routes(全部 loopback + 同源守卫)

| 路由 | 方法 | 作用 |
| --- | --- | --- |
| `/api/link-collect/state` | GET | 库根状态(当前路径/是否配置指定/是否已存在) |
| `/api/link-collect/root` | PUT | 切换库根目录(空 = 恢复默认) |
| `/api/link-collect/folders` | GET | 收藏夹概览列表 |
| `/api/link-collect/folder?name=` | GET / DELETE | 读取收藏夹(含条目) / 删除 |
| `/api/link-collect/folder/create` | POST | 新建收藏夹 |
| `/api/link-collect/folder/rename` | POST | 重命名收藏夹(重命名文件) |
| `/api/link-collect/link/add` | POST | 添加链接(URL 已存在返回 409) |
| `/api/link-collect/link/update` | POST | 更新链接(按 oldUrl 定位,可改 URL) |
| `/api/link-collect/link` | DELETE | 删除链接 |
| `/api/link-collect/meta?url=` | GET | 页面标题/已有图标探测 |
| `/api/link-collect/search?q=&tag=&folder=` | GET | 全库(或单夹)搜索 |
| `/api/link-collect/icon?name=` | GET | 读取库内图标文件 |

## 安全边界

浏览器只通过上述 guard 路由访问数据,不直接碰磁盘;图标读取拒绝路径穿越;
根目录切换写入独立指针文件;写 md 全部临时文件 + 原子 rename,单写入队列防并发
写坏。目录缺省自动创建。

## Remove

```sh
dsh plugin --profile web remove dsh-link-collect
```

## Verification record

- `scripts/smoke-host.mjs`(隔离 DSH_HOME + 临时库,无网络依赖)—— 全部通过:
  front matter/条目解析与幂等往返、无链接小标题原样保留、文件名清洗、
  根目录切换与指针持久化、收藏夹 CRUD(重名 409、改名保内容)、链接
  增/查/重复 409/原地更新(标题/简介/标签/正文)/删除、全库与标签检索、
  `link_collect_add` 自动建夹与更新、`link_collect_search` / `link_collect_list`、
  离线 favicon 抓取干净失败(icon 留空不报错)。
- `scripts/loader-boot.mjs`(真实 Cordis Loader + `dsh-host-webserver`,隔离
  DSH_HOME)—— 全部通过:行加载、webServer 绑定、state/root 切换、收藏夹
  与链接的 HTTP CRUD、搜索、meta 离线探测、图标路径穿越 400/缺失 404、
  foreign-host 403、错误方法 405、未知路由 404、坏 JSON 400。
- `scripts/smoke-client.mjs`—— 全部通过:`lib/client.js` 以
  `__ModuleLoader__` closure 注册 `dsh-link-collect`,导出
  `name: link-collect-ui / inject / apply`,无机器路径泄漏,仅解析模块表外链
  (react 家族)。收藏夹操作改为行尾「⋯」浮层菜单后重新构建并复跑,仍然全通过。
- 真实网络探测(本机,`faviconTimeoutMs/metaTimeoutMs=5000`):`rust-lang.org`
  → 标题成功 + `icons/….png`(走 HTML `<link rel=icon>` 链);`cn.vuejs.org` →
  `icons/….svg`;`github.com` → `icons/….ico`(直接 `/favicon.ico`);重复调用
  命中缓存不重复下载。v0.1.0 修复 favicon 读取字节计数 bug(多 chunk 下载被
  误判超限)。
- 静态预检:`node …/dsh-plugin-development/scripts/check-artifact.mjs bundle .` → PASS,0 warning。
