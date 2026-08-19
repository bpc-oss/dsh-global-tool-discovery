# dsh-global-tool-discovery

Global, session-scoped tool discovery and unlock for [DSH](https://github.com/deepseek-ai/deepseek-harness).

> **English** | [中文](#中文说明)

---

## English

### Overview

`dsh-global-tool-discovery` gives **every preset / every conversation** a unified `dev_tool_search` tool.

It lets any conversation:

- Search all globally registered profile tools, including MCP tools.
- Unlock hidden tools **for the current conversation only**.
- Use tools injected by `dsh-super-injector` immediately.
- Start fresh in a new conversation — unlocked tools are **not inherited**.

### Why this plugin exists

Different DSH presets expose different tool catalogs. Some presets hide globally-registered tools behind a bootstrap filter, while others show everything. This plugin provides a single global discovery layer without changing any preset's catalog policy.

### Features

- Global `dev_tool_search` available in every preset/conversation.
- Session-scoped unlock: new conversations do not inherit unlocked tools.
- Works with MCP tools and `dsh-super-injector` injected plugins.
- Does **not** filter `system-prompt/assemble`, so it stays compatible with preset-level bootstrap filters.
- CJK-aware search.
- Clean hot-reload/unload via `ctx.effect`.

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

This plugin **only registers `dev_tool_search`**. It does not control which tools are visible by default.

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

### License

MIT

---

## 中文说明

### 简介

`dsh-global-tool-discovery` 为 **所有 preset / 所有对话** 提供一个统一的 `dev_tool_search` 工具。

每个对话都可以：

- 搜索全局 profile 中已注册的工具，包括 MCP 工具。
- **仅针对当前对话**解锁隐藏工具。
- 立即使用 `dsh-super-injector` 新注入的插件。
- 新对话不继承旧对话的解锁状态。

### 为什么需要它

不同 DSH preset 的工具目录不同。有些 preset 会把全局工具藏起来，有些则全部可见。这个插件提供一个全局统一的发现层，同时不改变任何 preset 自己的目录策略。

### 特性

- 所有 preset / 对话都有全局 `dev_tool_search`。
- 解锁仅限当前会话，新对话不继承。
- 兼容 MCP 工具和 `dsh-super-injector` 注入的插件。
- 不做 `system-prompt/assemble` 过滤，因此不会与 preset 的 tool-bootstrap 冲突。
- 支持中文搜索。
- 通过 `ctx.effect` 注册，热重载/卸载不残留。

### 安装

```bash
dsh plugin --profile web add <仓库或压缩包>
```

或手动在 profile 的 `cordis.patch.yml` 中挂载：

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

> 如果不用包名，而是用绝对路径挂载本地文件，`name` 必须是 `file://` URL（例如 `file:///C:/path/to/lib/index.mjs`）。裸 Windows 路径 `C:/...` 会被 ESM loader 拒绝，可能导致 DSH 启动崩溃。

### 使用

搜索工具：

```text
dev_tool_search({"query": "chrome"})
```

解锁工具（仅当前会话）：

```text
dev_tool_search({"toolNames": ["mcp__server__tool_name"]})
```

解锁记录写入当前 session 的 `tool/call` 事件。新对话没有这些事件，所以不会继承。

### 与 preset 的关系

本插件只负责注册 `dev_tool_search`，不控制默认可见工具。

- **bootstrap 类 preset**（如 `anchored-standard`）：`dev_tool_search` 记录解锁，preset 的 `tool-bootstrap` 会在下一请求显示该工具。
- **全量目录 preset**（如 `dev`）：所有工具默认可见，`dev_tool_search` 作为目录搜索工具。
- **`dsh-super-injector`**：注入的插件自动进入全局工具注册表，因此可被搜索；在支持解锁的 preset 中可解锁。

### 配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `residentTools` | `["pwsh","str_replace_editor","dev_tool_search","skill_search","skill_load"]` | 仅用于描述文案，不参与过滤 |
| `sessionScoped` | `true` | 是否使用会话级解锁描述 |
| `maxResults` | `25` | 搜索结果上限 |

### 开发

```bash
npm run check
npm test
npm run check:private
npm run pack:check
```

### License

MIT


