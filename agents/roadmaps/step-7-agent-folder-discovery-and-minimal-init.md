---
complexity: structural
---

# Step 7 — Agent-Folder Discovery & Minimal Init

**Status:** open · **Owner:** Matze · **Depends on:** —

## Goal

`agent-config` works **from any subdirectory** of a project and can **bootstrap a project-local settings layer** (`agents/` + `.agent-settings.yml`) **without installing any tool payload**, so the user can lean on the global agent setup but still override per project.

## Why

- Today `find_project_root()` anchors on `.git` only. Projects without `.git` (worktrees in odd places, freshly-cloned subdirs before init, scratch folders) have no anchor and the cascade silently degrades to CWD-only.
- `agent-config init` always installs the full payload. There is no lightweight bootstrap "give me only the override hooks for this project".
- The global `agent-config` binary is on `$PATH` after `npm install -g @event4u/agent-config`, but invoking it from a subdirectory does not consistently resolve up to the real project root for every command.

## Non-goals

- No changes to the global install location (`~/.event4u/agent-config/`).
- No changes to the user-global whitelist filter.
- No new tool ids.

## Acceptance criteria

- [ ] `agent-config <any-command>` invoked from `<repo-root>/path/to/deep/subdir` resolves to `<repo-root>` for project-root-aware operations. Anchors: `.git`, `agents/` (only when it contains `roadmaps/` OR `.ai-council.yml` OR `roadmaps-progress.md` — see **D1**), `.agent-settings.yml`. Closest-leaf wins; tiebreaker order per **D3**.
- [ ] New subcommand `agent-config init --minimal` (alias `--settings-only`) creates only `agents/.gitkeep` + `.agent-settings.yml` (template) + `./agent-config` wrapper. No tool payload, no AGENTS.md, no copilot-instructions, no symlinks.
- [ ] Running `agent-config init --minimal` in a folder **inside** an existing agent-config project refuses with exit 1 and points at the existing root (no silent nested install).
- [ ] `agent-config doctor` reports the resolved project root and which anchor file matched.
- [ ] `npm install -g @event4u/agent-config` documented as the canonical "make `agent-config` available everywhere" path in `docs/installation.md`.
- [ ] Tests cover: ancestor-walk for each anchor type, `--minimal` payload shape, refusal of nested init, subdirectory invocation of `doctor` / `update` / `versions`.

## Phases

### Phase 1 — Anchor extension in `find_project_root`

- [ ] Extend `scripts/_lib/agent_settings.py:find_project_root()` with the closest-leaf anchor walk per **D1** + **D3**. Anchors: `.git`, `agents/` (only when marker subpath present — D1), `.agent-settings.yml`. Tiebreaker within an ancestor: `.agent-settings.yml` > `agents/` > `.git`.
- [ ] Kill-switch (**D5**): when `AGENT_CONFIG_LEGACY_ANCHOR=1` is set, `find_project_root()` reverts to `.git`-only walk for one minor-version soak.
- [ ] Update `scripts/_lib/agents_overlay.py:99` caller — no behaviour change for `.git`-anchored projects.
- [ ] Mirror the change into the vendored copy at `.agent-src/templates/scripts/work_engine/_lib/agent_settings.py`.
- [ ] Unit tests in `tests/test_agent_settings.py` for each anchor + precedence.

### Phase 2 — `agent-config init --minimal`

- [ ] Add `--minimal` / `--settings-only` flag in `scripts/install` (bash) and `scripts/install.sh`, plumbed through to `scripts/install.py`.
- [ ] Template file: `templates/minimal/.agent-settings.yml` — empty stub with the version pin commented out, `cost_profile: balanced`, `agent_config_version: <current>`.
- [ ] Template file: `templates/minimal/agents-gitkeep` — placeholder so `agents/` is committable.
- [ ] CLI wrapper `./agent-config` is still installed (delegates to global via `templates/agent-config-wrapper.sh` — already supports this).
- [ ] Nested-install guard: walk up from CWD with the Phase-1 anchors; if a root is found above CWD, refuse with exit 1 and print the existing root path.
- [ ] `cmd_init` in `scripts/agent-config` accepts and forwards the flag.

### Phase 3 — Subdir invocation hardening

- [ ] Audit every `scripts/_cli/cmd_*.py` for `Path.cwd()` / `Path('.')` usage that should be `find_project_root(cwd=Path.cwd())`. Fix call sites.
- [ ] `cmd_doctor.py` prints the resolved root + anchor name in its output.
- [ ] `./agent-config` wrapper (`templates/agent-config-wrapper.sh`) sets `AGENT_CONFIG_PROJECT_ROOT` env var so the master CLI does not re-walk the tree.

### Phase 4 — Docs & release notes

- [ ] `docs/installation.md` — add a "Global CLI + per-project settings" section explaining the minimal flow.
- [ ] `README.md` — one-liner under the npx block: `npm install -g @event4u/agent-config && agent-config init --minimal`.
- [ ] `CHANGELOG.md` — entry under the 2.13.x current era.
- [ ] ADR or short note under `docs/decisions/` if the anchor-precedence rule needs a permanent home.

### Phase 5 — Tests + CI

- [ ] `tests/test_minimal_init.py` — covers payload shape (only 3 files written), wrapper present, refusal of nested init.
- [ ] `tests/test_project_root_anchors.py` — covers `.git`, `agents/`, `.agent-settings.yml` anchors and precedence.
- [ ] `tests/test_subdir_invocation.py` — runs `agent-config doctor` from `<repo>/deep/nested/path/`, asserts resolved root.
- [ ] CI job `python-tests` already covers these — no new workflow needed.

## Decisions (resolved via AI Council, design + analysis lens)

Council artefacts: three rounds (one design, one design re-run, one analysis lens) under `agents/council-sessions/` (gitignored). Anthropic was overloaded (529) across all three runs; OpenAI returned consistent feedback in all three.

**D1 — `agents/` anchor requires a marker.** Bare existence is not enough (false-positive risk in unrelated projects with a coincidental `agents/` folder). Anchor matches when `agents/` contains **any** of: `roadmaps/`, `.ai-council.yml`, `roadmaps-progress.md`. Bare `agents/` is **not** an anchor.

**D2 — `--minimal` stays hands-off on `.gitignore`.** The user owns `.gitignore` shape; the wrapper does not write to it. README documents the recommended ignore line.

**D3 — Anchor precedence is closest-leaf wins, then ordered tiebreaker.** Walk up from CWD. The first ancestor containing **any** of the three anchors is the root. If a single ancestor contains multiple anchor types, order is `.agent-settings.yml` > `agents/` > `.git`. Rationale: explicit project-config files outrank implicit (git presence). Edge case test required.

**D4 — `init --minimal` does NOT pin `agent_config_version`.** Leaves it unset → consumer follows the globally installed `agent-config` version. Pinning is an opt-in user step documented in `docs/installation.md`.

**D5 — Kill-switch.** Environment variable `AGENT_CONFIG_LEGACY_ANCHOR=1` reverts `find_project_root()` to `.git`-only walk (Phase-1 behaviour). Documented in `docs/installation.md`. Removed in a future major if no issues surface after one minor-version soak.

**D6 — Performance budget.** Anchor walk is O(depth) with at most 3 `Path.exists()` calls per level. Soft budget: < 5 ms at depth 20. Test asserts upper bound.

## Phase-dependency map (per Council R2 sequencing review)

```
Phase 1 (anchor extension) ──┐
                             ├──> Phase 3 (subdir hardening) ──┐
                             │                                  │
Phase 2 (--minimal init) ────┘                                  ├──> Phase 4 (docs) ──> Phase 5 (tests + CI)
                                                                │
Phase 5 covers all phases ──────────────────────────────────────┘
```

Phase 3 **must not** ship before Phase 1 lands (subdir resolution depends on the new anchor set). Phase 2 can land in parallel with Phase 1 but its nested-install guard requires Phase 1 to be merged first.

## Additional acceptance criteria (Council follow-ups)

- [ ] `tests/test_project_root_anchors.py` covers the mixed-anchor edge case from D3: ancestor with both `.git` and `.agent-settings.yml` resolves to that ancestor; `.agent-settings.yml` wins for downstream cascade order, but the **root path** is the same.
- [ ] `tests/test_project_root_anchors.py` covers the `agents/`-without-markers case from D1 (must **not** anchor).
- [ ] `tests/test_kill_switch.py` covers `AGENT_CONFIG_LEGACY_ANCHOR=1` reverting to `.git`-only behaviour.
- [ ] `tests/test_anchor_perf.py` asserts the < 5 ms walk budget at depth 20.
- [ ] `docs/installation.md` "Migration" section explains transition for projects on the pre-Step-7 (`.git`-only) anchor logic; includes the kill-switch escape hatch.
- [ ] `docs/installation.md` clarifies `--minimal` vs full `init` decision table (when to pick which).

## Council brief

Token usage OK. Polled lens: design + analysis. Goal: gap audit, sequencing review, missing failure modes. Two providers configured; Anthropic returned `OverloadedError 529` on three consecutive attempts (design, design retry, analysis). OpenAI feedback was consistent across all three runs and produced the decisions above. A future re-run when Anthropic recovers may surface additional points; if so, they land as a follow-up roadmap, not as a Step-7 blocker.
