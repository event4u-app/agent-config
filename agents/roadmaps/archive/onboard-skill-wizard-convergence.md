---
complexity: lightweight
status: completed
---

# Roadmap: `/onboard` skill — wizard convergence

> Carve-out from `unified-setup-and-settings-gui.md` (external AI Council
> HARD-BLOCKER, 2026-05-18). Converge the chat-driven `/onboard` skill
> and the wizard onto **one canonical write path** so the two onboarding
> surfaces cannot drift. Until this lands, the wizard (GUI) and
> `/onboard` (chat) remain coequal write paths and drift is an accepted
> known risk.
>
> **2026-05-20 pivot — TS-first.** Phase 1 was originally specced as a
> Python skill → HTTP IPC → TS server bridge. Per
> [`engineering/typescript-first`](../../policies/engineering/typescript-first.md)
> we replaced the IPC bridge with a native TS subcommand
> (`agent-config onboard:finish`) that runs the **same** `commitMulti`
> 2PC code path the wizard's `POST /api/v1/wizard/finish` route uses,
> in-process. No spawned server, no port file, no token discovery — one
> canonical write surface, less moving infrastructure.

## Prerequisites

- [x] `unified-setup-and-settings-gui.md` Phase 1 server-API merged on `feat/unified-setup-and-settings-gui` (PR #194). Provides `commitMulti`, `mergeIntoTemplate`, `settingsSchema`, `userMdSchema` — the shared substrate `onboard:finish` reuses in-process.
- [x] Read [`docs/contracts/settings-api.md`](../../../docs/contracts/settings-api.md).
- [x] Read `.agent-src.uncompressed/commands/onboard.md` — the chat-driven flow that today writes `.agent-settings.yml` and `.agent-user.md` directly.

## Context

The external AI-Council pass on the GUI roadmap flagged the "two coequal
write paths" design as a drift-risk hard-blocker: parity tests on
fixtures cannot prove convergence between a form-driven wizard and a
chat-driven skill that have different input modalities. The chosen
resolution is to make the wizard the canonical write surface and rewrite
`/onboard` as a thin HTTP client that POSTs to the same routes.

This roadmap is the carve-out for that convergence. It is sequenced
**after** the GUI ships so the API contract is stable before the skill
rewrite begins.

## Acceptance criteria

- [x] `/onboard` no longer writes `.agent-settings.yml` or `.agent-user.md` directly. All writes go through `agent-config onboard:finish`, which calls the same `commitMulti` path as `POST /api/v1/wizard/finish`.
- [x] **TS-first.** The commit logic is a native TS subcommand (`src/cli/commands/onboardFinish.ts`); no Python IPC client, no spawned HTTP bridge for the chat path.
- [x] Contract `docs/contracts/onboard-skill-wizard-bridge.md` documents the in-process handshake (stdin JSON shape, response envelope, exit codes).
- [x] Parity test: a fixture session for `/onboard` and an equivalent fixture wizard run produce byte-identical `.agent-settings.yml` and `.agent-user.md` — locked in [`tests/server/onboardFinish_parity.test.ts`](../../../tests/server/onboardFinish_parity.test.ts) (3/3 passing).

## Non-goals

- Not a rewrite of the chat UI of `/onboard`. Question wording, ordering, and skip semantics stay as today.
- Not a removal of the `/onboard` skill. It remains the chat-side entry point; only the write path changes.
- Not a port of the wizard to Python. The wizard stays TS; the skill now also commits via TS (`agent-config onboard:finish`).
- Not user-global file writes (`~/.event4u/agent-config/`). Step 9 of the skill stays in-skill — `onboard:finish` handles project-local files only.

## Phase 0: contract handshake

- [x] **Create `docs/contracts/onboard-skill-wizard-bridge.md`** documenting:
  - How the skill spawns `agent-config ui:serve --headless` (NEW flag — bind, mint token, write port file, do **not** open browser).
  - How the skill reads `<projectRoot>/.agent-config/skill-bridge.port` + `skill-bridge.token`.
  - The skill's POST body shape (already covered by `settings-api.md` — this contract just references it).
  - Teardown: SIGTERM on skill exit, port file deleted.
- [x] Lint: `python3 scripts/check_references.py` exits 0.

## Phase 1: skill rewrite (TS-first)

- [x] **Create `src/cli/commands/onboardFinish.ts`** — reads JSON from stdin (`{ settings, userMd }`), merges into existing `.agent-settings.yml` via `mergeIntoTemplate`, validates `.agent-user.md` via `userMdSchema`, commits atomically via `commitMulti`.
- [x] **Register `onboard:finish`** in `src/cli/registry.ts` + wire into `src/cli/agent-config.ts`.
- [x] **Rewrite `.agent-src.uncompressed/commands/onboard.md` step 8** — accumulate answers in working memory across steps 3–7c, hand the assembled payload to `agent-config onboard:finish` on stdin in step 8.
- [x] **Delete `scripts/_cli/cmd_onboard.py`** — never shipped in this form; replaced by the TS subcommand before merge.

## Phase 2: parity tests

- [x] **Create [`tests/server/onboardFinish_parity.test.ts`](../../../tests/server/onboardFinish_parity.test.ts)** — drives both the chat subcommand core (`commitOnboardPayload`, in-process) and the wizard API (`app.inject` against `/api/v1/wizard/finish`) with the same fixture payload; asserts the resulting YAML + markdown files are byte-identical. TS-first; lives next to the wizard route tests, not under `tests/skills/`.
- [x] **Document the canonicalisation strategy** (none today — both surfaces share `commitMulti`/`mergeIntoTemplate` and produce byte-identical output) and the wizard `userMd`-wrap fix in [`docs/contracts/onboard-skill-wizard-bridge.md`](../../../docs/contracts/onboard-skill-wizard-bridge.md) § 6a.

## Phase 3: acceptance + flip

- [x] Parity tests pass (3/3) against a representative fixture: full-defaults settings × chat-captured subset × `userMd` present / absent / invalid-oversize.
- [x] [`docs/customization.md`](../../../docs/customization.md) "Editing settings" section added — notes that `/onboard` and the wizard now share one write path through `commitMulti`.
- [x] Roadmap status flipped to `completed`.

## Open questions

- [x] ~~Should `--headless` use a Unix domain socket on POSIX systems to avoid port contention entirely?~~ Obsolete after the TS-first pivot — no IPC layer at all on the chat path.
- [x] ~~How does the fallback path interact with the wizard's 2PC intent marker?~~ Obsolete — the chat path is now `commitMulti` itself, not a fallback around it.
