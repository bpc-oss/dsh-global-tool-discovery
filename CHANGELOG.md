# Changelog

## [0.2.1] - 2026-08-21

### Added

- Host smoke script (scripts/host-smoke.ps1).
- VPS SearXNG instance as default high-priority source.

### Fixed

- Local profile now includes egistry.mjs for the refactored bundle.
- Host smoke items 1-2 verified on homepc (broken research / missing adapters).

## [0.2.0] - 2026-08-20

### Added

- Bundle architecture: core/research/knowledge modules with dynamic loading.
- enableResearch / enableKnowledge / dapterWhitelist config switches.
- lib/registry.mjs side-effect-free source adapter registry.
- lib/core.mjs / lib/research.mjs / lib/knowledge.mjs modules.
- RSS and Hacker News source adapters (dapters/).
- esearch_memory_query tool for local research memory.
- ASI loop demo script (examples/asi-loop.mjs).
- New tests: bundle config, registry, adapters (57 tests total).

### Changed

- lib/index.mjs is now aggregate entry; core static, research/knowledge dynamically imported.
- lib/research-orchestrator.mjs and lib/knowledge-ingest.mjs are backward-compatible shims.
- package.json exports updated with ./core, ./research, ./knowledge, ./registry.

### Fixed

- Startup safety: sub-module import failure does not block core.
- Exa/SearXNG error classification (timeout/auth_error/rate_limit).
- dedupKey uses real SHA-256.

## [0.1.0] - 2026-08-19

### Added

- Global `dev_tool_search` tool registration for all DSH presets/conversations.
- Session-scoped unlock recording through `dev_tool_search({"toolNames": [...]})`.
- Reusable `lib/session-unlock.mjs` helper for preset authors.
- Configurable `maxResults`, `residentTools`, and `sessionScoped` options.
- CJK-aware search matching.
- Proactive discovery hint appended to first-round resident tool descriptions (pwsh/ash, str_replace_editor) 鈥?non-destructive, no catalog filtering, no preset changes.
- Global skill_search / skill_load for enabled presets/conversations with isModelInvocable filtering, body size limits, and per-preset opt-out (mployee-ops disabled by default).
- Async esearch_orchestrator / esearch_job_get for background multi-source research (litkit, Exa, agent-reach).
- knowledge_ingest to turn research findings into reusable SKILL.md files.
- `ctx.effect` disposal for clean hot-reload/unload.
- Privacy scanner script (`scripts/check-private.mjs`).
- Unit tests and CI workflow.





