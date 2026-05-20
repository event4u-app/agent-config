---
complexity: tactical
status: proposed
---

# Roadmap: `/onboard` skill — wizard convergence

> Carve-out from `unified-setup-and-settings-gui.md` (external AI Council
> HARD-BLOCKER, 2026-05-18). Rewrite the chat-driven `/onboard` Python
> skill as a thin client against the wizard's HTTP API so the two
> onboarding surfaces share one canonical write path. Until this lands,
> the wizard (GUI) and `/onboard` (chat) remain coequal write paths and
> drift is an accepted known risk.

## Prerequisites

- [ ] `unified-setup-and-settings-gui.md` is **status: completed** and merged.
  Without the wizard API routes (`POST /api/v1/wizard/finish`, the atomic-
  multi-write helper, the `substituteTemplate` shared logic) there is no
  target for `/onboard` to converge against.
- [ ] Read [`docs/contracts/settings-api.md`](../../docs/contracts/settings-api.md) (created by the GUI roadmap).
- [ ] Read `scripts/_cli/cmd_onboard.py` (or current equivalent) — the chat-driven flow that today writes `.agent-settings.yml` and `.agent-user.md` directly.

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

- [ ] `/onboard` no longer writes `.agent-settings.yml` or `.agent-user.md` directly. All writes go through `POST /api/v1/wizard/finish`.
- [ ] `/onboard` boots a short-lived local server (same `agent-config ui:serve` mechanism) for the duration of the skill turn, captures the per-process token, and tears down on exit.
- [ ] If the skill cannot bind a port or the server fails to boot, `/onboard` falls back to the legacy direct-write path with a one-line notice (so air-gapped or sandboxed environments keep working).
- [ ] A new contract `docs/contracts/onboard-skill-wizard-bridge.md` documents the IPC handshake (port file, token capture, lifecycle).
- [ ] Parity test: a fixture session for `/onboard` and an equivalent fixture wizard run produce byte-identical `.agent-settings.yml` and `.agent-user.md`.

## Non-goals

- Not a rewrite of the chat UI of `/onboard`. Question wording, ordering, and skip semantics stay as today.
- Not a removal of the `/onboard` skill. It remains the chat-side entry point; only the write path changes.
- Not a port of the wizard to Python. The skill stays Python; the API call is just an HTTP request.

## Phase 0: contract handshake

- [ ] **Create `docs/contracts/onboard-skill-wizard-bridge.md`** documenting:
  - How the skill spawns `agent-config ui:serve --headless` (NEW flag — bind, mint token, write port file, do **not** open browser).
  - How the skill reads `<projectRoot>/.agent-config/skill-bridge.port` + `skill-bridge.token`.
  - The skill's POST body shape (already covered by `settings-api.md` — this contract just references it).
  - Teardown: SIGTERM on skill exit, port file deleted.
- [ ] Lint: `python3 scripts/check_refs.py` exits 0.

## Phase 1: skill rewrite

- [ ] **Edit `scripts/_cli/cmd_onboard.py`** — replace direct YAML writes with `requests.post(...)` calls against the local API.
- [ ] **Add `--headless` flag** to `agent-config ui:serve` (TS side) — bind, mint token, write port + token files under `<projectRoot>/.agent-config/`, do not open browser.
- [ ] **Add fallback path** — when the HTTP bridge cannot start (no node, no port, …) the skill prints a one-line notice and reverts to the legacy direct-write flow. Surfaced as a warning in the skill output.

## Phase 2: parity tests

- [ ] **Create `tests/skills/onboard_wizard_parity.py`** — drives both the skill (with mocked stdin) and the wizard API (with the same fixture answers); asserts the resulting YAML + markdown files are byte-identical.
- [ ] **Document the known divergences** (timestamps, comment ordering) and the canonicalisation step used by the parity test in the contract.

## Phase 3: acceptance + flip

- [ ] All parity tests pass against a representative fixture matrix (3+ profiles × user_name presence × ide presence).
- [ ] `docs/customization.md` "Editing settings" section updated to note that `/onboard` and the wizard now share one write path.
- [ ] Roadmap status flips to `completed`.

## Open questions

- [ ] Should `--headless` use a Unix domain socket on POSIX systems to avoid port contention entirely? Decide before Phase 1.
- [ ] How does the fallback path interact with the wizard's 2PC intent marker — does a legacy write need to set an equivalent marker? Decide in Phase 1.
