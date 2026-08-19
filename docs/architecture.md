# Architecture

## Problem

Different DSH presets expose different tool catalogs. Some presets hide
globally-registered tools (MCP, super-injector plugins) behind a bootstrap
filter, while other presets show everything. Users want a uniform way to:

1. Search every globally-registered tool from any conversation.
2. Unlock a hidden tool for the current conversation only.
3. Use newly injected super-injector plugins immediately.

## Model

```text
Global capability pool (profile plugins + super-injector)
        │
        ▼
Global dev_tool_search (this plugin)
  - search full assembled catalog
  - record unlock into current session
        │
        ▼
Preset catalog policy
  - bootstrap presets: default hidden + unlock via session events
  - full presets: everything visible, search only
```

## Why no assemble filter here

The first implementation filtered `system-prompt/assemble` globally. That
conflicts with preset-level bootstrap filters (anchored-standard,
verifier-standard, router-standard) because the final catalog becomes the
intersection of both keep-sets, dropping tools such as `verifier_doctor` or
compaction work sets.

This plugin therefore **only** registers `dev_tool_search` and leaves catalog
policy to presets.

## Session-scoped unlock

`dev_tool_search({"toolNames": ["tool_a"]})` produces a durable `tool/call`
event with `arguments.toolNames`. Preset filters can read those events with
the helper in `lib/session-unlock.mjs`.

A new session has no such events, so it does not inherit unlocks.

## super-injector compatibility

`dsh-super-injector` injects plugins at the host loader level. Injected tools
are registered in the global tool registry, so `ctx.tools.schemas(agent)`
includes them and `dev_tool_search` can search/unlock them without extra work.

## Verification

- Every preset/conversation has `dev_tool_search`.
- CJK queries match Chinese tool descriptions.
- Bootstrap presets show unlocked tools from the next request.
- New conversations do not inherit unlocks.
- Hot reload/unload leaves no tool registration behind.
