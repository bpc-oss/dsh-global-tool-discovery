# dsh-global-tool-discovery

Global, session-scoped tool discovery and unlock for [DSH](https://github.com/deepseek-ai/deepseek-harness).

> **English** | [涓枃](#涓枃璇存槑)

---

## English

### Overview

`dsh-global-tool-discovery` gives **every preset / every conversation** a unified `dev_tool_search` tool.

It lets any conversation:

- Search all globally registered profile tools, including MCP tools.
- Unlock hidden tools **for the current conversation only**.
- Use tools injected by `dsh-super-injector` immediately.
- Start fresh in a new conversation 鈥?unlocked tools are **not inherited**.

### Why this plugin exists

Different DSH presets expose different tool catalogs. Some presets hide globally-registered tools behind a bootstrap filter, while others show everything. This plugin provides a single global discovery layer without changing any preset's catalog policy.

### Features

- Global `dev_tool_search` available in every preset/conversation.
- Session-scoped unlock: new conversations do not inherit unlocked tools.
- Works with MCP tools and `dsh-super-injector` injected plugins.
- Registers a non-destructive system-prompt/assemble transform that only augments resident tool descriptions; it never removes/adds tools and never touches preset catalog filters.
- CJK-aware search.
- Clean hot-reload/unload via `ctx.effect`.
- Global `skill_search` / `skill_load` for all enabled presets/conversations.
- Async `research_orchestrator` + `research_job_get` for background multi-source research.
- `knowledge_ingest` to turn findings into reusable SKILL.md.

### Installation

```bash
dsh plugin --profile web add <repo-or-tarball>
```

Or manually add to your profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-global-tool-discovery
      name: dsh-global-tool-discovery
      config:
        residentTools:
          - pwsh
          - str_replace_editor
          - dev_tool_search
          - skill_search
          - skill_load
        sessionScoped: true
        maxResults: 25
```

> If you mount a local file by absolute path instead of a package name, the `name` must be a `file://` URL (e.g. `file:///C:/path/to/lib/index.mjs`). A bare Windows path like `C:/...` is rejected by the ESM loader and can crash DSH startup.

### Usage

Search for tools:

```text
dev_tool_search({"query": "chrome"})
```

Unlock a tool for the current session:

```text
dev_tool_search({"toolNames": ["mcp__server__tool_name"]})
```

The unlock is recorded in the current session's `tool/call` events. A new conversation has no such events, so it starts clean.

### Relationship with presets

This plugin registers dev_tool_search and adds a non-destructive discovery hint to resident tool descriptions. It does not control which tools are visible by default and never removes/adds tools.

- **Bootstrap presets** (e.g. `anchored-standard`): `dev_tool_search` records unlock requests, and the preset's `tool-bootstrap` exposes the tool from the next request.
- **Full-catalog presets** (e.g. `dev`): all tools are already visible; `dev_tool_search` acts as a catalog search tool.
- **`dsh-super-injector`**: injected plugins register into the global tool registry, so they are automatically searchable and can be unlocked where the preset supports it.

### Configuration

| Option | Default | Description |
|---|---|---|
| `residentTools` | `["pwsh","str_replace_editor","dev_tool_search","skill_search","skill_load"]` | Used for description text only; does not filter tools. |
| `sessionScoped` | `true` | Whether to use session-scoped unlock wording. |
| `maxResults` | `25` | Maximum number of search results. |

### Development

```bash
npm run check
npm test
npm run check:private
npm run pack:check
```

### Bundle Configuration / Bundle 配置

`dsh-global-tool-discovery` 是一个可裁剪 Bundle：

- core：`dev_tool_search`（必选）
- research：`research_orchestrator` / `research_job_get` / `research_memory_query`（可选）
- knowledge：`knowledge_ingest`（可选）

```yaml
- id: dsh-global-tool-discovery
  name: dsh-global-tool-discovery
  config:
    enableResearch: true
    enableKnowledge: true
    adapterWhitelist: ["rss", "hackernews"]
```

| 配置 | 默认 | 说明 |
|---|---|---|
| `enableResearch` | `true` | 是否挂载 research 工具 |
| `enableKnowledge` | `true` | 是否挂载 knowledge_ingest |
| `adapterWhitelist` | `["rss","hackernews"]` | 启用的外部来源适配器白名单 |

轻量模式（只保留 core）：

```yaml
config:
  enableResearch: false
  enableKnowledge: false
  adapterWhitelist: []
```

## Source Adapters / 来源适配器


`research_orchestrator` 支持通过注册表扩展来源：

```js
import { registerSourceAdapter } from 'dsh-global-tool-discovery'
registerSourceAdapter('rss', rssAdapter)
registerSourceAdapter('hackernews', hackernewsAdapter)
```

内置示例：

```text
adapters/rss.mjs
adapters/hackernews.mjs
examples/source-adapter.mjs
```

自定义适配器只需实现 `search(query, limit, timeout)`；`normalize` 为可选。

## License

MIT

---

## 涓枃璇存槑

### 绠€浠?

`dsh-global-tool-discovery` 涓?**鎵€鏈?preset / 鎵€鏈夊璇?* 鎻愪緵涓€涓粺涓€鐨?`dev_tool_search` 宸ュ叿銆?

姣忎釜瀵硅瘽閮藉彲浠ワ細

- 鎼滅储鍏ㄥ眬 profile 涓凡娉ㄥ唽鐨勫伐鍏凤紝鍖呮嫭 MCP 宸ュ叿銆?
- **浠呴拡瀵瑰綋鍓嶅璇?*瑙ｉ攣闅愯棌宸ュ叿銆?
- 绔嬪嵆浣跨敤 `dsh-super-injector` 鏂版敞鍏ョ殑鎻掍欢銆?
- 鏂板璇濅笉缁ф壙鏃у璇濈殑瑙ｉ攣鐘舵€併€?

### 涓轰粈涔堥渶瑕佸畠

涓嶅悓 DSH preset 鐨勫伐鍏风洰褰曚笉鍚屻€傛湁浜?preset 浼氭妸鍏ㄥ眬宸ュ叿钘忚捣鏉ワ紝鏈変簺鍒欏叏閮ㄥ彲瑙併€傝繖涓彃浠舵彁渚涗竴涓叏灞€缁熶竴鐨勫彂鐜板眰锛屽悓鏃朵笉鏀瑰彉浠讳綍 preset 鑷繁鐨勭洰褰曠瓥鐣ャ€?

### 鐗规€?

- 鎵€鏈?preset / 瀵硅瘽閮芥湁鍏ㄥ眬 `dev_tool_search`銆?
- 瑙ｉ攣浠呴檺褰撳墠浼氳瘽锛屾柊瀵硅瘽涓嶇户鎵裤€?
- 鍏煎 MCP 宸ュ叿鍜?`dsh-super-injector` 娉ㄥ叆鐨勬彃浠躲€?
- 鎸傛帴 system-prompt/assemble 鍙仛闈炵牬鍧忔€ф弿杩板寮猴紝涓嶅鍒犲伐鍏凤紝涓嶄慨鏀?preset 鐨勭洰褰曡繃婊ょ瓥鐣ャ€?
- 鏀寔涓枃鎼滅储銆?
- 閫氳繃 `ctx.effect` 娉ㄥ唽锛岀儹閲嶈浇/鍗歌浇涓嶆畫鐣欍€?
- 鍏ㄥ眬 `skill_search` / `skill_load`锛屽惎鐢?preset / 瀵硅瘽鍙敤銆?
- 寮傛 `research_orchestrator` / `research_job_get`锛屽悗鍙板婧愮爺绌躲€?
- `knowledge_ingest`锛屾妸鐮旂┒缁撴灉娌夋穩涓?SKILL.md銆?

### 瀹夎

```bash
dsh plugin --profile web add <浠撳簱鎴栧帇缂╁寘>
```

鎴栨墜鍔ㄥ湪 profile 鐨?`cordis.patch.yml` 涓寕杞斤細

```yaml
- insert:
    - id: dsh-global-tool-discovery
      name: dsh-global-tool-discovery
      config:
        residentTools:
          - pwsh
          - str_replace_editor
          - dev_tool_search
          - skill_search
          - skill_load
        sessionScoped: true
        maxResults: 25
```

> 濡傛灉涓嶇敤鍖呭悕锛岃€屾槸鐢ㄧ粷瀵硅矾寰勬寕杞芥湰鍦版枃浠讹紝`name` 蹇呴』鏄?`file://` URL锛堜緥濡?`file:///C:/path/to/lib/index.mjs`锛夈€傝８ Windows 璺緞 `C:/...` 浼氳 ESM loader 鎷掔粷锛屽彲鑳藉鑷?DSH 鍚姩宕╂簝銆?

### 浣跨敤

鎼滅储宸ュ叿锛?

```text
dev_tool_search({"query": "chrome"})
```

瑙ｉ攣宸ュ叿锛堜粎褰撳墠浼氳瘽锛夛細

```text
dev_tool_search({"toolNames": ["mcp__server__tool_name"]})
```

瑙ｉ攣璁板綍鍐欏叆褰撳墠 session 鐨?`tool/call` 浜嬩欢銆傛柊瀵硅瘽娌℃湁杩欎簺浜嬩欢锛屾墍浠ヤ笉浼氱户鎵裤€?

### 涓?preset 鐨勫叧绯?

鏈彃浠舵敞鍐?dev_tool_search锛屽苟缁?resident 宸ュ叿鎻忚堪杩藉姞闈炵牬鍧忔€у彂鐜版彁绀恒€傚畠涓嶆帶鍒堕粯璁ゅ彲瑙佸伐鍏凤紝涔熶笉澧炲垹宸ュ叿銆?

- **bootstrap 绫?preset**锛堝 `anchored-standard`锛夛細`dev_tool_search` 璁板綍瑙ｉ攣锛宲reset 鐨?`tool-bootstrap` 浼氬湪涓嬩竴璇锋眰鏄剧ず璇ュ伐鍏枫€?
- **鍏ㄩ噺鐩綍 preset**锛堝 `dev`锛夛細鎵€鏈夊伐鍏烽粯璁ゅ彲瑙侊紝`dev_tool_search` 浣滀负鐩綍鎼滅储宸ュ叿銆?
- **`dsh-super-injector`**锛氭敞鍏ョ殑鎻掍欢鑷姩杩涘叆鍏ㄥ眬宸ュ叿娉ㄥ唽琛紝鍥犳鍙鎼滅储锛涘湪鏀寔瑙ｉ攣鐨?preset 涓彲瑙ｉ攣銆?

### 閰嶇疆

| 閰嶇疆椤?| 榛樿鍊?| 璇存槑 |
|---|---|---|
| `residentTools` | `["pwsh","str_replace_editor","dev_tool_search","skill_search","skill_load"]` | 浠呯敤浜庢弿杩版枃妗堬紝涓嶅弬涓庤繃婊?|
| `sessionScoped` | `true` | 鏄惁浣跨敤浼氳瘽绾цВ閿佹弿杩?|
| `maxResults` | `25` | 鎼滅储缁撴灉涓婇檺 |

### 寮€鍙?

```bash
npm run check
npm test
npm run check:private
npm run pack:check
```

### Source Adapters / 来源适配器

`research_orchestrator` 支持通过注册表扩展来源：

```js
import { registerSourceAdapter } from 'dsh-global-tool-discovery'
registerSourceAdapter('rss', rssAdapter)
registerSourceAdapter('hackernews', hackernewsAdapter)
```

内置示例：

```text
adapters/rss.mjs
adapters/hackernews.mjs
examples/source-adapter.mjs
```

自定义适配器只需实现 `search(query, limit, timeout)`；`normalize` 为可选。

## License

MIT





