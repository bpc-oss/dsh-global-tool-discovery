# Changelog

## [0.1.0] - 2026-08-19

### Added

- Global `dev_tool_search` tool registration for all DSH presets/conversations.
- Session-scoped unlock recording through `dev_tool_search({"toolNames": [...]})`.
- Reusable `lib/session-unlock.mjs` helper for preset authors.
- Configurable `maxResults`, `residentTools`, and `sessionScoped` options.
- CJK-aware search matching.
- Proactive discovery hint appended to first-round resident tool descriptions (pwsh/ash, str_replace_editor) — non-destructive, no catalog filtering, no preset changes.
- Global skill_search / skill_load for enabled presets/conversations with isModelInvocable filtering, body size limits, and per-preset opt-out (mployee-ops disabled by default).
- Async esearch_orchestrator / esearch_job_get for background multi-source research (litkit, Exa, agent-reach).
- knowledge_ingest to turn research findings into reusable SKILL.md files.
- `ctx.effect` disposal for clean hot-reload/unload.
- Privacy scanner script (`scripts/check-private.mjs`).
- Unit tests and CI workflow.



