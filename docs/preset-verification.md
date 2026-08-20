# 多 Preset 验证清单

> 目标：确认 `research_orchestrator` / `research_job_get` / `research_memory_query` / `knowledge_ingest` 在目标 preset 中可用。

## 待验证 Preset

- research
- dev
- verifier-standard
- anchored-standard
- dev-reviewer
- employee-ops

## 验证项

对每个 preset 检查：

- [ ] `dev_tool_search` 可搜索到 `research_orchestrator`
- [ ] `research_orchestrator` 可启动 job
- [ ] `research_job_get` 可查询结果
- [ ] `research_memory_query` 可查询记忆
- [ ] `knowledge_ingest` 可执行
- [ ] `employee-ops`（若禁用）按预期不可用或明确返回禁用信息

## 验证结果

### 重启后（当前真实会话，anchored-standard 系）

| 工具 | 可搜索 | 备注 |
|---|---|---|
| research_orchestrator | ✅ | 已解锁并触发内部能力检测 |
| research_job_get | ✅ | 已解锁 |
| research_memory_query | ✅ | 已解锁并查询到 3 条记忆 |
| knowledge_ingest | ✅ | 已解锁，plugin dry-run 正常 |

### 重启前（dev / anchored-standard / verifier-standard 子代理）

| Preset | research_orchestrator | research_job_get | research_memory_query | knowledge_ingest |
|---|---|---|---|---|
| dev | ✅ | ✅ | ❌（当时未加载最新代码） | ✅ |
| anchored-standard | ✅ | ✅ | ❌（当时未加载最新代码） | ✅ |
| verifier-standard | ✅ | ✅ | ❌（当时未加载最新代码） | ✅ |

> 重启后 `research_memory_query` 已在当前会话验证通过；由于全局插件由同一 profile 加载，理论上 dev / verifier-standard 等 preset 同样可用，待后续用子代理会话补录。

## 说明

- 全局工具由 `index.apply` 统一挂载，理论上所有未禁用 preset 均可使用。
- `employee-ops` 等 worker/minimal preset 可能按策略禁用部分能力，需在验证中记录实际行为。
- 验证结果应记录到本文件（勾选 + 备注）。
