# research_orchestrator 接口冻结规范

> Phase 1 冻结接口，Phase 2 必须遵循。

## 单条统一结果

```ts
interface UnifiedResult {
  title: string
  url: string
  snippet: string
  publishedAt: string
  dedupKey: string // "sha256:" + sha256(title|url)
}
```

## 返回体

```ts
interface ResearchResponse {
  query: string
  sources: SourceGroup[]
  errors: SourceError[]
  knowledgeGaps: string[]
}

interface SourceGroup {
  source: string
  active: boolean
  results: UnifiedResult[]
}

interface SourceError {
  source: string
  active: false
  status: 'unavailable' | 'timeout' | 'auth_error' | 'rate_limit'
  error: string
  retryCount: number
  lastAttempt: string // ISO
}
```

## sourceAdapter 接口

```ts
interface SourceAdapter {
  name: string
  init(config: any): Promise<{ available: boolean; error?: string }>
  health(): Promise<{ available: boolean; latency?: number }>
  search(query: string, limit: number, timeout: number): Promise<UnifiedResult[]>
  normalize(rawResult: any): UnifiedResult | null
  dispose(): Promise<void>
}
```

## 重试规则

- 可重试错误：timeout、ETIMEDOUT、ECONNRESET、ECONNREFUSED、HTTP 5xx。
- 不可重试：401、429、认证错误。
- 默认重试 1 次，间隔 2s。
