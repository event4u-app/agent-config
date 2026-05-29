---
status: ready
complexity: structural
resolution: go-option-a
---

# Road to Linked-Projects Scope

> When a developer works in one IDE-attached repo that has a sibling repo linked beside it (PhpStorm `.idea/modules.xml` + `vcs.xml`, VS Code `*.code-workspace`), the agent **auto-detects** the sibling and — after a one-time opt-in — proactively considers cross-repo impact, so a dependency the developer didn't think to mention (an API change that breaks the frontend, a shared type that drifts) is surfaced by default instead of silently missed.

## Resolution — GO, scoped to Option A (passive awareness)

The Phase-0 spike confirmed Claude Code can already read/write a sibling unconditionally — so the feature's value is **not** capability, it is **proactivity**: the agent does not consider the sibling unless told, and the developer who most needs this is precisely the one who won't think to tell it. A manual doc note presupposes the very awareness the target user lacks. **Auto-detection is zero-knowledge** — it reads the relationship the developer already encoded by attaching the repo in their IDE.

AI Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 3 rounds + Karpathy peer-review, 2026-05-29) flipped an earlier NO-GO to **GO** on this reasoning, scoped to **Option A — passive awareness**:

- Detect the IDE-attached sibling, one-time opt-in, persist local-only.
- Inject a **behavioral-directive** awareness note for in-scope siblings: *"when a change may affect this repo (API contract, shared types), proactively check cross-repo impact and warn; do not include sibling files unless explicitly requested."*
- **Not** interpretation C (implicit inclusion of all sibling files in every query) — that risks token blowup and stays out of scope.

## Goal

Give the agent **proactive, opt-in awareness** of an IDE-attached sibling repository, persisted local-only per machine, so cross-repo dependencies are surfaced by default — without the developer needing to know the feature exists or remember to configure it.

## Prerequisites

- [x] Detection facts verified on the reference setup (`galawork-api/.idea/modules.xml` lists `../galawork-web`, `vcs.xml` maps it).
- [x] `enumerate_modules()` still rejects out-of-tree roots — the intra-repo module system is untouched.
- [x] Greenfield: no `linked_projects` / `.agent-settings.local.yml` artifact exists.
- [x] ADR-007 owns "scope"/"workspace"; ADR-029 owns package "multi-workspace" — new vocab stays `linked_projects`.

## Phase 0 — Feasibility spike (GO / NO-GO gate)

- [x] Build fixture `main-proj` + sibling `sibling-proj`; empirically probe Claude Code read (absolute + relative) and write (Edit tool) — all PASS. Others UNTESTED (no interactive IDE in shell).
- [x] Record spike report under `agents/runtime/tmp/` with per-agent results.
- [x] Decision: GO scoped to Option A. Value = proactivity, not capability. Council ratified after the proactivity-gap rebuttal.

## Phase 1 — Sibling detector with guardrails (standalone)

Goal: a pure, dependency-free function returning the absolute paths of IDE-attached sibling projects, config-driven only, with the size/path guardrails the council required.

- [x] Add `scripts/_lib/linked_projects.py::detect_linked_projects(project_root) -> list[dict]` returning `{path, detected_via, large}`.
- [x] Parse PhpStorm `.idea/modules.xml` (`<module fileurl>` outside `$PROJECT_DIR$`) and `.idea/vcs.xml` (`<mapping directory>` outside `$PROJECT_DIR$`).
- [x] Parse VS Code `*.code-workspace` (`folders[].path` resolving outside the project).
- [x] Filter: outside `project_root`, exists, contains `.git/`; de-duplicate; log-and-skip broken/symlink/missing refs.
- [x] Guardrails: a sibling whose file count exceeds the threshold (default 20000) is **flagged `large: true`, not excluded** — under Option A size is cost-irrelevant (a real frontend, e.g. galawork-web at ~38k files, must still surface); never descend into `node_modules`, `.git`, `dist`, `build`, `.venv`, `target` when counting. <!-- corrected: council's "skip >20k" contradicted Option A's no-bulk-include premise -->

Acceptance criteria:

- `python3 -m pytest tests/test_linked_projects_detector.py` passes: PhpStorm pair, VS Code workspace, malformed XML, missing/non-git target, oversized sibling skipped.
- Manual run against `galawork-api` returns exactly the absolute path to `galawork-web` with `detected_via` set.

## Phase 2 — Local-only settings layer

Goal: a gitignored `.agent-settings.local.yml` slotted into the existing cascade as the deepest per-directory layer, reusing `_deep_merge`.

- [x] Extend `_resolve_cascade_paths` so each directory yields `.agent-settings.local.yml` after its `.agent-settings.yml` (deepest-wins, existing `_deep_merge`).
- [x] Add `.agent-settings.local.yml` to the package `.gitignore`. <!-- corrected: install.py:4251 "Does NOT touch .gitignore (D2 — user owns the ignore file)"; consumer gitignores it themselves, documented in the guide -->
- [x] Add `scripts/check_no_local_settings_committed.py` and wire it into the `ci-fast` lint aggregation.
- [x] Document `linked_projects` + `linked_projects_max_files` in `templates/agent-settings.md` (template block + reference table), noting it belongs in `.agent-settings.local.yml`.

Acceptance criteria:

- `python3 -m pytest tests/test_agent_settings_local_layer.py` passes: `.local.yml` overrides root `.yml`; nested overrides root; absence unchanged.
- The committed-local-file lint fails on a planted tracked fixture, passes when removed.

## Phase 3 — Onboarding-gate rule + behavioral-directive awareness note

Goal: on first use with a detected sibling, prompt once to opt in, persist the choice, and thereafter carry the behavioral-directive awareness note for in-scope siblings.

- [ ] Author `linked-projects-onboarding-gate` rule (auto-tier, mirroring `onboarding-gate`): fires when a detected sibling is not yet in `linked_projects`.
- [ ] One-time numbered opt-in per sibling (yes / no / always / never-ask); persist to `.agent-settings.local.yml` (declined → `include: false`, never re-prompt).
- [ ] For each `include: true` sibling, the rule surfaces the **behavioral directive**: consider cross-repo impact on relevant changes (API contract / shared types) and warn; never auto-include sibling files; out-of-root writes still pass the host permission gate.
- [ ] Condense via `/condense`; pass `skill_linter` + frontmatter validation.

Acceptance criteria:

- Rule fires once per detected-but-unconfigured sibling; declined siblings never re-prompt.
- `python3 scripts/validate_frontmatter.py` and `python3 scripts/skill_linter.py` pass.

## Phase 4 — Docs + ADR (GO)

- [x] Revise `docs/guides/cross-repo-linked-projects.md` to lead with the auto-detect path (opt-in flow) and keep the manual snippet as the fallback for unsupported agents.
- [x] Rewrite ADR-032 to the **GO / Option A** decision (renamed file to `ADR-032-linked-projects-scope.md`): proactivity-gap rationale, spike result, A/B/C scoping (A chosen, C rejected), fork resolutions, kill-switch.
- [x] Cross-reference sync (`augment-edit-discipline`); regenerate ADR index — `check_references` clean.

Acceptance criteria:

- `python3 scripts/check_references.py` clean; ADR index `--check` exit 0.

## Phase 5 — Kill-switch + verification gate

- [ ] Document the kill-switch in the guide/ADR: if opt-in acceptance is near-zero or siblings are never cited, remove the rule. Metrics stay local, no telemetry.
- [ ] Run the full local gate (`task ci`) and fix to green.

Acceptance criteria:

- `task ci` green.

## Acceptance criteria (roadmap)

- A developer in `galawork-api` with `galawork-web` attached gets a one-time opt-in; once accepted, the agent proactively flags cross-repo impact, persisted local-only and never committed.
- Detector, settings layer, rule, docs, and ADR ship; all tests + `task ci` green.
