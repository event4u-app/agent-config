---
complexity: structural
---

# Step 8 — Discovery Polish (Override, Trace, Minimal-UX)

**Status:** done · **Owner:** Matze · **Depends on:** Step 7 (PR #157)
**Council:** [decision](../council-sessions/step-8-discovery-polish-decision.md) · 2 rounds + peer-review (Sonnet 4.5 + GPT-4o)

## Goal

Make the Step-7 discovery layer **debuggable, overridable, and predictable** without re-architecting it. Address the operational gaps surfaced by external reviews of PR #157 (GPT, Claude) — explainability, explicit override, minimal-init UX.

## Why

- Step 7 introduced 3 anchors (`.git`, `agents/` with markers, `.agent-settings.yml`) and `--minimal` install. Reviewers identified follow-up debt: no way to debug *why* a root was picked, no explicit override for CI/monorepo, minimal-init can leave users unclear about state.
- Two cuts the council made: automated template generation (no evidence of pain — parity test works) and a formal anchor-freeze policy as AC (belongs in `CONTRIBUTING.md`, not here).

## Non-goals

- Install profiles beyond `--minimal` (separate, larger initiative).
- Changing the anchor set or D3 tiebreaker (Step-7 is locked).
- Automated template-generation pipeline for the vendored `agent_settings.py` (council cut: parity test is sufficient).
- Formal anchor-scope-policy AC (governance norm, not a roadmap deliverable).

## Acceptance criteria

- [x] **A1** — `agent-config doctor --trace-root` prints every ancestor checked, every anchor hit/miss with reason, and the final resolved root + winning anchor. JSON-shaped under `--json`.
- [x] **A2** — `agent-config doctor --context` prints effective project root, anchor used, env-pin (if any), `.agent-settings.yml` layer chain (global + project), active wrapper path, and detected install-mode (full / minimal — heuristic: presence of `AGENTS.md` ∧ copilot bridges = full; otherwise minimal).
- [x] **A3** — Global `--root <path>` flag on the master CLI short-circuits discovery. Precedence: `--root` > `AGENT_CONFIG_PROJECT_ROOT` > anchor walk > CWD-fallback. Fall-through only when higher-precedence option is **unset**; invalid path (non-existent or non-directory) fails loudly with exit 2 — no silent CWD fallback. Documented in `docs/installation.md`.
- [~] **A3-coupling** — Partial: dispatcher emits stderr warning when `--root` differs from wrapper-pinned `AGENT_CONFIG_PROJECT_ROOT`. Regenerate-by-default + `--no-regenerate-wrapper` flag deferred to follow-up roadmap (warning alone is sufficient for current monorepo flows; regenerate flow needs separate council pass on side-effect surprise).
- [x] **A5** — `agent-config init --minimal` post-install: prints the upgrade hint to **stderr** AND writes `agents/.agent-state/install-mode.txt` (one line: `minimal` or `full`) so `doctor --context` can surface state on later invocations.
- [x] **A6-docs** — `docs/installation.md` gains "Project-root override", "Monorepo semantics", and "Diagnostics" sections under the discovery chapter.
- [x] Tests cover: `--root` precedence + invalid-path fail-loud, `--trace-root` JSON shape, `--context` install-mode detection (marker + heuristic), minimal-state-file write. Wrapper-coupling regenerate test deferred with A3-coupling regenerate flow.

## Phases

### Phase 1 — Explicit `--root` override (A3, A3-coupling)

- [x] Add global `--root <path>` to `scripts/agent-config` dispatcher; propagate via `AGENT_CONFIG_ROOT_OVERRIDE=1` + `AGENT_CONFIG_PROJECT_ROOT` so `cmd_*.py` resolve through `resolve_project_root()`.
- [x] Extend `scripts/_lib/agent_settings.py:resolve_project_root()` precedence chain: `--root` > `--project` > `AGENT_CONFIG_PROJECT_ROOT` > anchor walk > CWD. Invalid `--root` / invalid env-pin / invalid `--project` → raise `ProjectRootError` mapped to exit 2; no fall-through.
- [~] Wrapper-coupling guard: dispatcher emits stderr warning on `--root` ↔ wrapper-pin mismatch. Regenerate flow + `--no-regenerate-wrapper` deferred (see A3-coupling).
- [x] Mirror into `.agent-src.uncondensed/templates/scripts/work_engine/_lib/agent_settings.py`. Parity test green.
- [x] Tests: `tests/test_root_override.py` (precedence + invalid-path + end-to-end CLI exit-2).

### Phase 2 — Diagnostic surface (A1, A2)

- [x] Add `find_project_root_with_trace()` in `scripts/_lib/agent_settings.py` returning `(root, anchor, [{ancestor, pass, hit, reason}…])`.
- [x] Wire `cmd_doctor.py --trace-root` (text default + `--json`).
- [x] Wire `cmd_doctor.py --context`: project root, origin, install-mode + source, settings-layer chain, wrapper state, env-pin/override flags.
- [x] Tests: `tests/test_doctor_trace.py` covers text + JSON for both flags, marker-vs-heuristic install-mode detection, origin propagation.

### Phase 3 — Minimal-init UX + docs (A5, A6-docs)

- [x] `scripts/install.py` writes `agents/.agent-state/install-mode.txt` (`minimal\n` or `full\n`) and prints the upgrade hint to stderr after `--minimal` installs.
- [x] `cmd_doctor.py --context` prefers `.agent-state/install-mode.txt` (source=`marker-file`) with filesystem heuristic fallback (source=`heuristic`) for back-compat.
- [x] `docs/installation.md` — "Project-root override", "Monorepo semantics", "Diagnostics" sections appended to the Step-7 chapter.
- [x] `CHANGELOG.md` — `Unreleased` entry under `step-8-discovery-polish` covering `--root`, doctor diagnostics, install-mode marker, upgrade hint, and council artefacts.

## Resolved design questions

- **Q1 (trace-root over-engineered?)** — No. Keep as named flag; GPT review specifically requested `--trace-root`.
- **Q2 (`--root` vs `--project`?)** — `--root` (consistent with `git -C`, `docker --context`; conveys "execution context root").
- **Q3 (template-gen task target?)** — Moot; A4 cut by council.
- **Q4 (anchor-freeze ADR vs roadmap?)** — Neither; one-paragraph note in `CONTRIBUTING.md` follow-up (out of scope here).
- **Q5 (install-mode persist vs detect?)** — Hybrid: write a marker file at install time (cheap, authoritative for new installs); fall back to filesystem heuristic for back-compat. Avoids coupling discovery to `.agent-settings.yml`.

## Risks

- **Wrapper-coupling regression** — Regenerate-by-default could surprise users with mutating side-effects. Mitigation: warn first, only regenerate if mismatch is non-trivial (different absolute path, not just symlink resolution).
- **Install-mode heuristic fragility** — A user who deletes `AGENTS.md` but keeps copilot bridges gets misreported. Mitigation: marker file is authoritative; heuristic is back-compat fallback only.
- **`--root` + env-pin precedence confusion** — Mitigation: `doctor --context` always shows which layer won.

## Follow-ups (out of scope)

- `CONTRIBUTING.md` note: "Anchor set is intentionally small (3). New anchors require an ADR demonstrating non-ambiguity, a use case not served by `--root`, and council approval."
- Install profiles beyond `--minimal` / `--standard` / `--team` / `--full` — separate roadmap if demand surfaces.
- **A3-coupling regenerate flow** — extend the dispatcher warning into a proper `init`/`update`/`sync` regenerate-by-default path with `--no-regenerate-wrapper` opt-out. Needs separate council pass on side-effect surprise (regenerate-by-default mutates the wrapper file).
