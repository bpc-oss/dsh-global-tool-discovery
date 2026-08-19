# Changelog

## [0.1.0] - 2026-08-19

### Added

- Global `dev_tool_search` tool registration for all DSH presets/conversations.
- Session-scoped unlock recording through `dev_tool_search({"toolNames": [...]})`.
- Reusable `lib/session-unlock.mjs` helper for preset authors.
- Configurable `maxResults`, `residentTools`, and `sessionScoped` options.
- CJK-aware search matching.
- `ctx.effect` disposal for clean hot-reload/unload.
- Privacy scanner script (`scripts/check-private.mjs`).
- Unit tests and CI workflow.
