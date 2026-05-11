---
complexity: lightweight
---

# Road to Portable Dev Preferences

**Status:** READY FOR EXECUTION — refined via AI council 2026-05-11 (claude-sonnet-4-5 + gpt-4o, 2 rounds).
**Started:** 2026-05-11.
**Trigger:** Developers working across multiple consumer projects rewrite the same DX-comfort settings (`name`, `ide`, autonomy, cost profile, communication style) in every repo. Drift is the default state.
**Mode:** Three sequential phases. P1 ships the loader, P2 wires the onboard write path, P3 atomically migrates all existing per-script loaders.

## Purpose

Introduce a user-global fallback for a small whitelist of DX-comfort keys in `.agent-settings.yml`, with project-local settings always winning. Loader is pure, read-only, tolerant of missing files, and forward-compatible by silent ignore of non-whitelisted keys.

Council convergence on three design decisions, baked into the phases:

- **Path:** `~/.config/agent-config/agent-settings.yml` (XDG-style; matches existing `anthropic.key`, `openai.key`, `council-spend.jsonl` location).
- **Migration shape:** atomic — all loaders move to the centralized helper in one PR, no opportunistic drift window.
- **Whitelist:** six exact paths, not namespace patterns — non-whitelisted keys in user-global are silently ignored.

## Out of scope (this roadmap)

- **MCP `settings://current` resource.** Council convergence: defer until a concrete consumer exists. Adding it now is YAGNI and risks invariant coupling on the local stdio MCP. New mini-roadmap if/when a consumer surfaces.
- **`/sync-agent-settings` writing user-global.** Stays project-scoped. User-global normalization would be a separate command if ever needed.
- **Per-setting MCP filtering** (e.g. `cost_profile=lean` returning a compact catalogue). Separate decision, not coupled to this work.
- **Remote Cloudflare Worker MCP.** Untouched — stateless, identity-stable, read-only invariants are non-negotiable.

## Whitelist (locked, exact paths)

```
name
ide
cost_profile
personal.bot_icon
personal.autonomy
caveman.speak_scope
```

Six keys, three namespaces. Documented as exact paths in the loader — a developer adding `personal.theme` to user-global will see silent ignore (verbose flag surfaces the ignored keys for debugging).

## Phase 1: Loader (`scripts/_lib/agent_settings.py`)

**Goal:** Pure, read-only, well-tested centralized loader with whitelist-driven merge. Shippable standalone — no other code depends on it yet at end of P1.

**Pre-conditions:** None.

- [ ] **P1.1** — `scripts/_lib/agent_settings.py` with `load_agent_settings(project_path=None, user_global_path=None, verbose=False)`. Merge order: project → user-global (whitelisted keys only) → built-in defaults. Lazy PyYAML import (matches existing pattern in `work_engine/hooks/settings.py`).
- [ ] **P1.2** — `MERGEABLE_KEYS` as explicit list of dotted paths. Non-whitelisted keys in user-global silently ignored; `verbose=True` logs ignored keys via `logging.info`.
- [ ] **P1.3** — Tolerance contract: missing project file → user-global + defaults; missing user-global file → project + defaults; both missing → defaults; malformed YAML → defaults, log warning. **No file creation, no writes**, ever.
- [ ] **P1.4** — Test suite covering all five tolerance branches, whitelist filtering, dotted-path merge depth, type coercion (booleans, strings, ints). Golden fixtures for project-only, user-global-only, both-present, both-missing, malformed.

## Phase 2: Onboarding writes user-global

**Goal:** `/onboard` learns the user-global file path. Existing project-scoped behavior unchanged for re-onboarding.

**Pre-conditions:** Phase 1 shipped.

- [ ] **P2.1** — `/onboard` detects whether `~/.config/agent-config/agent-settings.yml` exists. If absent **and** the user is doing first-time setup on this machine (heuristic: no `.agent-settings.yml` in any sibling project), offer to create user-global with the six whitelisted keys. User confirms explicitly; never auto-create.
- [ ] **P2.2** — Document the user-global path in `docs/customization.md` and the onboarding completion message. Cross-link from `.agent-src.uncompressed/templates/agents/agent-project-settings.example.yml`.

## Phase 3: Atomic loader migration

**Goal:** Every script currently reading `.agent-settings.yml` directly migrates to `scripts/_lib/agent_settings.py` in **one** PR. Eliminates the drift window where some scripts respect user-global and others don't.

**Pre-conditions:** Phase 1 shipped and merged. Phase 2 not required (loader works without `/onboard` changes).

- [ ] **P3.1** — Inventory all current direct readers (≈15 scripts surfaced by `grep -rln "agent-settings.yml\|agent_settings" scripts/ .agent-src.uncompressed/templates/`). Tag each as `keep` (pure project-scoped, no DX-comfort keys) or `migrate` (touches at least one whitelisted key).
- [ ] **P3.2** — Migrate every `migrate`-tagged loader to the centralized helper in a single PR. Existing per-script settings dataclasses can wrap the merged dict — no API breakage required.
- [ ] **P3.3** — Regression test pass: golden replays for `work_engine`, telemetry recorder, chat-history hook, onboarding gate, council CLI, sync-agent-settings.

## Risk register

| Risk | Mitigation |
|---|---|
| Loader hides bugs because user-global merge is silent | `verbose=True` flag surfaces ignored keys; documented in `docs/customization.md` |
| P3 atomic migration breaks one of the 15 loaders | Regression-test suite in P1.4 + P3.3; per-script tests stay green before merge |
| Whitelist creeps over time as keys feel "comfort-shaped" | Adding a key to `MERGEABLE_KEYS` requires an ADR — locked in P1.2 docstring |
| `/onboard` writes user-global without explicit consent | P2.1 hard-codes the confirmation prompt; no autonomy-bypass path |
| Loader gains write capability "for convenience" | P1.3 contract is read-only; CI greps for `open(..., 'w')` patterns in `scripts/_lib/agent_settings.py` |

## Reference

- Council session: `agents/council-responses/portable-dev-preferences.json` (gitignored, retention 7d).
- Existing pattern: `.agent-src.uncompressed/templates/scripts/work_engine/hooks/settings.py`.
- Settings template: `.agent-src.uncompressed/templates/agents/agent-project-settings.example.yml`.

## Next step

Start P1.1 — single-file PR that ships `scripts/_lib/agent_settings.py` plus its test suite. No other code touches it. Merge gate: lint-skills clean, pytest green, no callers yet.
