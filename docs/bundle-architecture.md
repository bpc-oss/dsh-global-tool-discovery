# Bundle 架构

## 模块

```text
lib/index.mjs      聚合入口（core 静态，research/knowledge 动态）
lib/core.mjs       dev_tool_search + resident 提示（必选）
lib/research.mjs   research_orchestrator / research_job_get / research_memory_query
lib/knowledge.mjs  knowledge_ingest
lib/registry.mjs   来源适配器注册表（无副作用）
```

## 启动安全

- core 静态 import，保证 `dev_tool_search` 一定可用
- research/knowledge 动态 import + try/catch
- 子模块加载失败只记录警告，不阻断 core

## 配置

```yaml
enableResearch: true
enableKnowledge: true
adapterWhitelist: ["rss", "hackernews"]
```

## 待验证：真实 host 冒烟

发布前必须完成以下真实 DSH host 验证：

- [ ] 故意破坏 `research.mjs`（语法错误/改名），确认 core 仍能 boot
- [ ] 故意缺失 adapters 文件，确认 research 仍可用（少适配器）
- [ ] 异步 apply 被 DSH loader 接受，热重载/卸载干净
- [ ] dev / anchored-standard / verifier-standard 的 `research_memory_query` 补录

## 兼容


- 旧子路径 `./research-orchestrator` / `./knowledge-ingest` 保留 shim
- 新增 `./core` / `./research` / `./knowledge` / `./registry`
