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

## 兼容

- 旧子路径 `./research-orchestrator` / `./knowledge-ingest` 保留 shim
- 新增 `./core` / `./research` / `./knowledge` / `./registry`
