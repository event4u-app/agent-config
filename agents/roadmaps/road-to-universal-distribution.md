# Roadmap: Universal Distribution (Cloud + Local Fallbacks)

> Make `event4u/agent-config` usable on platforms where the package's scripts cannot run — Claude.ai Web Skills, the Anthropic Skills API, and Linear's "Additional guidance" text fields — by tiering every artefact for cloud compatibility, shipping cloud-degraded variants where the script is the only blocker, and offering text-only distribution paths for platforms that cannot ingest a ZIP at all. Local execution stays the gold path; cloud is "good-enough, gracefully degraded".

## Prerequisites

- [ ] Read [`AGENTS.md`](../../AGENTS.md) (this repo's package-author entry point)
- [ ] Read [`docs/architecture.md`](../../docs/architecture.md) — distribution model
- [ ] Read [`agents/analysis/compare-anthropics-skills.md`](../analysis/compare-anthropics-skills.md) — prior reference analysis (mentions Plugin Marketplace as adoption candidate)
- [ ] Read [`scripts/audit_cloud_compatibility.py`](../../scripts/audit_cloud_compatibility.py) — the tier-classification tool that produced the Phase 0 numbers below
- [ ] Re-read [`.agent-src.uncompressed/templates/roadmaps.md`](../../.agent-src.uncompressed/templates/roadmaps.md)
- [ ] Skim [`.agent-src.uncompressed/skills/agent-docs-writing/SKILL.md`](../../.agent-src.uncompressed/skills/agent-docs-writing/SKILL.md) — how docs propagate across `.augment/`, `.claude/`, `.cursor/`, etc.
- [ ] Inventory current consumer-facing tools: `scripts/install.sh`, `scripts/install.py`, `Taskfile.yml` (especially `generate-tools`, `ci`)

## Context

**Question that triggered this roadmap.** "Can we use this package on Claude.ai Web today? On Linear AI? Does, say, a refactor-style rule even fire on Linear AI? If not — what do we have to change? Do we need fallbacks for Python scripts? Even local: if scripts can't run, can we degrade?"

**Short answer.** Locally — yes, fully. Claude.ai Web — partially, with a missing bundle builder and ~8 hard-blockers. Linear AI — no, the package is structurally incompatible with how Linear stores guidance (workspace/team/personal text only, third-party agent receives the bytes verbatim). All three gaps are addressable; this roadmap sequences the work.

### Phase 0 — Tier audit (DONE)

Output of `python3 scripts/audit_cloud_compatibility.py` (292 artefacts in scope: skills + rules + commands + guidelines):

| Tier | Definition | Count | % |
|---|---|---:|---:|
| **T1** | Universal — no script, no FS | **139** | 47.6 % |
| **T2** | Local-Agent — references repo paths or FS, no script | **108** | 37.0 % |
| **T3-S** | Script-soft — script mentioned, manual fallback exists | **37** | 12.7 % |
| **T3-H** | Script-hard — core procedure REQUIRES a script | **8** | 2.7 % |

**The eight hard blockers** (T3-H):

| Path | Reason |
|---|---|
| `rules/chat-history.md` | Persistence contract is `scripts/chat_history.py`-only |
| `commands/chat-history.md`, `chat-history-clear.md`, `chat-history-resume.md` | Front ends for the same script |
| `skills/command-writing/SKILL.md` | Calls compress + skill-linter at the end |
| `skills/rule-writing/SKILL.md` | Same |
| `skills/guideline-writing/SKILL.md` | Same |
| `skills/description-assist/SKILL.md` | `scripts/skill_trigger_eval.py` is the gate |

**Top scripts by reach** (number of artefacts citing them):

| Script | Artefacts |
|---|---:|
| `scripts/skill_linter.py` | 5 |
| `scripts/chat_history.py` | 4 |
| `scripts/check_portability.py` | 3 |
| `scripts/update_roadmap_progress.py` | 2 |
| `scripts/check_proposal.py` | 2 |
| `scripts/check_memory.py` | 2 |
| `scripts/memory_signal.py` | 2 |
| `scripts/install.py` | 2 |

T3-S is the **manageable** tier — 37 files mention scripts, but the underlying procedure already has a manual path described in prose. They degrade automatically; we just need to verify the prose is still actionable when the script call is removed.

### Tier definitions (used throughout)

- **T1 (Universal)** — pure guidance. No filesystem assumptions, no script calls. Works on Claude.ai, the Skills API, in a Linear "Additional guidance" textbox, in any local agent.
- **T2 (Local-Agent)** — references files inside `.agent-src/`, `.augment/`, `agents/`, `.agent-settings.yml`, etc. The agent must be running on the user's machine with file access. Cloud variant: agent emits content for the user to save manually (one extra step, no functional loss).
- **T3-S (Script-soft)** — mentions a script as one option ("you can verify by running `scripts/check_X.py`, or read the file and inspect manually"). Cloud-fine; the script call is a convenience, not a contract.
- **T3-H (Script-hard)** — the artefact's **procedure** is the script. Without it the skill/rule cannot do its job. Eight files. Each needs an explicit cloud-aware variant.

### Platform compatibility matrix

| Platform | Mechanism | Scripts | FS | User repo | Persistence | Today's status |
|---|---|---|---|---|---|---|
| Augment / Claude Code / Cursor / Cline / Windsurf (local) | What `task generate-tools` produces | ✅ | ✅ | ✅ | ✅ | **Fully supported** |
| Anthropic Skills API | `POST /v1/skills` (ZIP per skill) | ✅ (sandbox) | sandbox only | ❌ | ❌ per session | Bundle builder missing |
| Claude.ai Web (Pro/Max/Team) | Settings → Customize → Skills (ZIP upload) | ✅ (sandbox, with code-execution toggle) | sandbox only | ❌ | ❌ per session | Bundle builder missing; description ≤200 chars constraint |
| Linear AI ("Additional guidance" workspace/team/personal) | Markdown text passed verbatim to third-party agent (Codegen, Charlie, Cursor's Linear app, etc.) | ❌ | n/a | depends on third-party | ❌ | Concatenated text bundle missing |

### Gap analysis per platform

**Local (5 supported tools).** Already working. No changes required for T1–T3.

**Anthropic Skills API & Claude.ai Web** (treat as one — same skill format).

- ✅ T1: ships as-is in a per-skill ZIP.
- ✅ T2: the sandbox provides a writable filesystem; the agent can scaffold under `/mnt/skill_output/`. Where today's prose says "edit `.agent-src.uncompressed/...`", we need a header that swaps to "in this session's sandbox, work under `/mnt/...`".
- ✅ T3-S: degrades automatically once the optional script call is gated by an "if available" wrapper.
- ❌ **T3-H (8 files):** must either (a) ship a cloud-degraded variant, (b) declare the skill local-only with a clear pointer, or (c) bundle a sandbox-runnable copy of the script. chat-history specifically is moot on cloud — no persistence — so **(b) noop on cloud** is the right answer. Authoring skills (4) can ship **(a) "agent does the linter check by reading the rules instead"**.
- ❌ Description budget: Claude.ai Web caps frontmatter `description` at 200 characters; the spec allows 1024. Several of our skill descriptions are >200 chars. Linter must enforce a tighter cap when building the cloud bundle.
- ❌ No bundle builder yet. `task generate-tools` writes per-tool projections, not Anthropic Skills API ZIPs.

**Linear AI ("Additional guidance").**

- ❌ Linear stores three layers of plain-text guidance (workspace, team, personal). The third-party agent (Codegen, Charlie, etc.) reads them verbatim — no skill-trigger semantics, no on-demand expertise loading.
- ✅ T1 rules can ship as a curated concatenation. The auto-trigger machinery is gone, but the constraint text still works as background guidance.
- ⚠️ T2 / T3 are useless here: the third-party agent is the one with file access, and it has no contract that says "follow `agents/overrides/` or `.agent-src/skills/skill-X` for skill X". We can't pretend otherwise.
- The right deliverable is a **rules-only digest** (the 47 rules, possibly minus the local-agent-specific ones like `chat-history`, `roadmap-progress-sync`, `cli-output-handling`), concatenated into one markdown blob the user pastes into Linear.

## Phase 1: Cloud Bundle Builder

> Generate a per-skill ZIP set ready for Anthropic Skills API / Claude.ai upload from `.agent-src/`, with per-platform tweaks (description budget, sandbox path swap, T3-H gating). New script: `scripts/build_cloud_bundle.py`. Wired into Taskfile as `task build-cloud-bundle`.

- [x] **Step 1:** Spec `scripts/build_cloud_bundle.py` — inputs (`.agent-src/skills/`), outputs (`dist/cloud/<skill-name>.zip` per skill), shape (`SKILL.md` + optional `scripts/`, `references/`, `assets/`)
- [x] **Step 2:** Implement description-budget enforcer (truncate / refuse if frontmatter `description` > 200 chars on cloud bundle path; raise lint error on the source if > 1024 chars)
- [x] **Step 3:** Implement T3-H gating — read tier from `audit_cloud_compatibility.py`, **skip** T3-H skills with an explicit log line; emit them only when Phase 2's cloud-degraded variants exist
- [x] **Step 4:** Implement sandbox path-swap — replace literal `.agent-src.uncompressed/`, `.agent-src/`, `agents/` mentions with sandbox equivalents only inside generated bundles, not in source
- [x] **Step 5:** Add `task build-cloud-bundle` (single skill) and `task build-cloud-bundles-all` (full set), plus `task ci-cloud-bundle` to fail when source breaks the cloud invariants
- [x] **Step 6:** Pytest suite: `tests/test_build_cloud_bundle.py` — fixture skill round-trips, description-budget enforcement, T3-H exclusion, sandbox path-swap correctness
- [~] **Step 7:** Manual smoke — protocol drafted at [`agents/reports/cloud-bundle-smoke.md`](../reports/cloud-bundle-smoke.md); awaiting real upload to Claude.ai Web + screenshots
- [x] **Step 8:** Document the path in [`docs/architecture.md`](../../docs/architecture.md) and link from `AGENTS.md`

## Phase 2: T3-H Cloud-Aware Variants

> Resolve the 8 hard-blockers. Two strategies depending on the artefact: **noop-on-cloud** (chat-history) or **degrade-to-prose** (authoring skills).

- [x] **Step 1:** `chat-history` — add a `Cloud Behavior` section to `rules/chat-history.md`: "On platforms without persistent filesystem, this rule is fully inert. Iron Law turn-check / append / heartbeat are skipped. Settings.enabled is treated as false." Mirror it in the three commands.
- [x] **Step 2:** Wire a runtime detection hint — add a `cloud_safe: noop` frontmatter field (or equivalent comment in the body, since `agent-skills.io` frontmatter is fixed) so `build_cloud_bundle.py` knows to ship a stripped variant
- [x] **Step 3:** `command-writing` — replace the closing "run `bash scripts/compress.sh` + `python3 scripts/skill_linter.py`" block with a cloud-aware fallback: "On cloud, the agent verifies the new command by **re-reading** the relevant rules (frontmatter shape, size budget, numbered-options compliance) and emits a self-review block instead of running the linter."
- [x] **Step 4:** Same change for `rule-writing/SKILL.md`, `guideline-writing/SKILL.md`
- [x] **Step 5:** `description-assist` — the trigger-eval loop is genuinely script-only (it samples user prompts and measures activation); cloud variant: skill emits its **prompts list and rubric** so the user can run the eval manually or off-platform, and the skill collects the user-pasted results
- [x] **Step 6:** Re-run audit — `python3 scripts/audit_cloud_compatibility.py` should now show **0** T3-H artefacts after Phase 2 (variants make them T3-S or T2)
- [x] **Step 7:** Add a regression test asserting T3-H count is 0 going forward (similar to `test_agent_src_uncompressed_clean` for legacy tags)

## Phase 3: Linear AI — Rules Digest Distribution

> Linear's guidance fields take Markdown only. Build a curated concatenation of cloud-safe rules into a single file the user pastes into Workspace / Team / Personal guidance.

- [x] **Step 1:** Define the inclusion list — every T1 rule + every T2 rule whose substance survives without filesystem (e.g. `scope-control` ✅, `language-and-tone` ✅, `chat-history` ❌, `cli-output-handling` ⚠️ partial). Capture the decision per rule in [`agents/contexts/linear-ai-rules-inclusion.md`](../contexts/linear-ai-rules-inclusion.md).
- [x] **Step 2:** Build `scripts/build_linear_digest.py` — concatenates included rules with section headers; strips file references that won't resolve outside the repo (replace with footnote pointers); emits `dist/linear/{workspace,team,personal}.md`
- [x] **Step 3:** Decide the three-layer split — workspace = universal coding posture, team = framework-specific (Laravel, etc.), personal = empty by default. Document in [`agents/contexts/linear-ai-three-layers.md`](../contexts/linear-ai-three-layers.md).
- [x] **Step 4:** Pytest: round-trip a fixture rule set, verify no broken `[link](path)` survives, verify the digest stays under Linear's per-field char limit (research the actual cap and write it into the test as a constant). Implemented as `tests/test_build_linear_digest.py` (12 tests). Linear's hard cap is unpublished; the test pins a 100 KB conservative ceiling — see Open Question #1.
- [~] **Step 5:** Manual smoke — paste the workspace digest into a Linear workspace, ask the linked agent (Codegen or Charlie) to do something the rules govern (e.g. "fix this bug — must run quality checks first"), capture whether the rule fired
- [x] **Step 6:** Document the install path in `README.md` (Linear AI section): "Copy `dist/linear/workspace.md`, paste into Settings → Agents → Additional guidance (workspace)"

## Phase 4: Cloud-Aware Documentation Pass

> Many T2 skills and rules have prose that assumes filesystem access. The substance is fine, but the verbs are wrong on cloud. One pass to rewrite these in cloud-portable language: "the agent reads the file" stays as is; "the agent edits the file" becomes "the agent emits the new file contents; the user copies them into place".

- [x] **Step 1:** Tag all T2 artefacts with cloud-action category (`reads-only` / `edits` / `runs-task` / `mixed`) using a mini-extension to the audit script — implemented in `scripts/audit_cloud_compatibility.py` as `cloud_action` per row + `by_cloud_action` aggregate. Narrowed in a second pass (Phase-4 Step-1 second pass) to match only agent-directed imperatives, dropping false positives from inline backtick CLI and ```bash example blocks
- [x] **Step 2:** For `edits` and `runs-task` categories, rewrite the procedure section so the cloud-degraded variant is implicit. Goal: same prose works on local and cloud — no fork. Narrow rewrite landed: 5 filesystem-bound artefacts marked `cloud_safe: noop` with a `## Cloud Behavior` section (`skills/file-editor`, `commands/onboard`, `commands/set-cost-profile`, `commands/sync-agent-settings`, `commands/optimize-augmentignore`); 3 wording fixes neutralised tool-specific verbs in `commands/bug-fix`, `rules/cli-output-handling`, `rules/role-mode-adherence`. Audit shows 0 unmarked flagged artefacts
- [x] **Step 3:** Add a one-line `> Cloud note:` callout at the top of each affected SKILL/rule, generated automatically by the bundle builder if needed — `scripts/build_cloud_bundle.py` injects `SANDBOX_NOTE` block-quote at bundle build time and uses `NOOP_BODY_FALLBACK` for `cloud_safe: noop` artefacts. Source files stay clean
- [x] **Step 4:** Re-run linter + portability + reply-consistency checks; nothing should break — `task sync` ✅ · `python3 scripts/check_references.py` ✅ · `python3 scripts/check_portability.py` ✅ · `python3 scripts/skill_linter.py --all` 185 pass, 117 warn, 0 fail
- [~] **Step 5:** Spot-check 10 random T2 skills on Claude.ai Web — does the cloud-degraded reading still produce the right behavior? Deferred to manual smoke (same shape as Phase 2 Step 7); the final acceptance check in this roadmap re-runs the audit after sibling roadmaps archive, then schedules the spot-check together with the other deferred manual smokes

## Phase 5: Distribution Channels & Install Paths

> Make the cloud bundle reachable. Three concrete channels: Claude Code Plugin Marketplace (already noted in `agents/analysis/compare-anthropics-skills.md`), direct Claude.ai upload, Linear paste.

- [x] **Step 1:** Add `.claude-plugin/marketplace.json` per the prior reference analysis — done in `road-to-anthropic-skills`, hardened here. Schema verification against [`anthropics/skills` reference](https://github.com/anthropics/skills/blob/main/.claude-plugin/marketplace.json) shows the official format has `name`, `owner`, `metadata.description`, `metadata.version`, `plugins[].{name, description, source, strict, skills}` — `repository` and `categories` from the original plan-sketch are NOT in Anthropic's schema (see Open Question #4 resolution). Required fields all present. `skills[]` points at `./.claude/skills/<name>` (git-clone-based plugin marketplace), not `dist/cloud/` (which is the orthogonal Claude.ai Web ZIP-upload channel — see Phase 1). Drift fix landed: 27 skills missing from manifest discovered, manifest regenerated from filesystem (98 → 196 entries), `scripts/lint_marketplace.py` got a reverse-completeness check, three new pytest cases added (10 → 13). `task lint-marketplace` ✅ · `task test-marketplace-linter` 13/13 ✅.
- [x] **Step 2:** Document the four install paths — local, Claude Code plugin, Claude.ai Web, Linear AI. Landed in `docs/installation.md` (canonical install reference) with one section per path; README's compact at-a-glance tables (`Project-installed`, `Plugin-installed`, `Cloud / Hosted-agent surfaces`) link into them. Claude Code subsection now shows both CLI (`claude plugin install …`) and in-Agent slash-command (`/plugin marketplace add event4u-app/agent-config` → `/plugin install …`) per the plan-sketch's literal wording. New cloud section covers Claude.ai Web (`task build-cloud-bundles-all` → upload ZIP via Skills UI) and Linear AI (`task build-linear-digest` → paste three layers into Linear's Agents settings) with concrete steps and per-layer rationale links. Screenshots deferred — `agents/reports/` capture requires manual UI walkthrough; the prose steps are self-sufficient. `check-refs` ✅ · `check-portability` ✅ · `lint-readme` ✅.
- [x] **Step 3:** GitHub Actions workflow `cloud-release.yml` — on tag push (`[0-9]+.[0-9]+.[0-9]+` + pre-release suffix, mirrors `publish-npm.yml` / `release-guard.yml`) or `workflow_dispatch` with explicit `tag` input. Builds all cloud bundles via `python3 scripts/build_cloud_bundle.py --all --clean` (asserts ≥ 1 ZIP produced; locally 125 bundles built · 0 skipped) and the Linear digest via `python3 scripts/build_linear_digest.py --strict-missing` (asserts all three layers present: workspace · team · personal; locally 18 + 4 + 0 rules). Stages per-skill ZIPs alongside two combined tarballs (`cloud-bundles-<tag>.tar.gz`, `linear-digest-<tag>.tar.gz`) plus the three Linear layer `.md` files; uploads via `actions/upload-artifact@v4` (30-day retention, debug fallback) and attaches to the GitHub Release via `softprops/action-gh-release@v2` with `fail_on_unmatched_files: true`. Purely additive — does not tag, bump, or publish to package registries; companion to `publish-npm.yml` on the same tag triggers. `permissions: contents: write` only on the release-attach step. YAML syntax ✅ · local dry-runs ✅ · `check-refs` ✅ · `check-portability` ✅. End-to-end verification deferred to first real tag push (next release run).
- [~] **Step 4:** Confirm the Claude Code plugin path works end-to-end on a clean test repo. Mechanical simulation landed (fresh-clone resolve of all 196 manifest paths ✅ · all 196 SKILL.md files have valid frontmatter with `name` + `description` ✅ · marketplace.json schema matches Anthropic shape: `name` / `owner.{name,email}` / `plugins[].{name,source,strict,description,skills}` / `metadata.{description,version}` ✅ · `task lint-marketplace` ✅). Deferred to manual UI walkthrough — same hold pattern as Phase 1 Step 7 / Phase 4 Step 5: `/plugin marketplace add event4u-app/agent-config` → `/plugin install agent-config@event4u-agent-config` → trigger-smoke (e.g. "write a Pest test" → `pest-testing` activates) inside a real Claude Code session. Re-check together with the other deferred manual smokes after sibling roadmaps archive.
- [x] **Step 5:** Wire `task ci` to also run the cloud-bundle build and the Linear digest build in dry-run mode, so source-breaking changes fail PR checks. Local `task ci` already chained both (`ci-cloud-bundle` → `python3 scripts/build_cloud_bundle.py --check`, `ci-linear-digest` → `python3 scripts/build_linear_digest.py --strict-missing`); the gap was that no PR-time GitHub Actions workflow ran them. Extended `.github/workflows/consistency.yml` to add three steps after the compression check: `task lint-marketplace`, `task ci-cloud-bundle`, `task ci-linear-digest`. Also widened the workflow's path triggers to include `scripts/build_cloud_bundle.py`, `scripts/build_linear_digest.py`, `scripts/lint_marketplace.py`, and `.claude-plugin/marketplace.json` so changes to those source files actually trigger the gates. Local smoke: `task lint-marketplace` ✅ (196 skills, no issues) · `task ci-cloud-bundle` ✅ (125 built, 0 skipped) · `task ci-linear-digest` ✅ (workspace 18 rules · team 4 · personal 0, all under budget). YAML syntax valid · `check-refs` ✅ · `check-portability` ✅.

## Phase 6: Telemetry & Validation

> Empirical confirmation that cloud-distributed artefacts actually trigger and help. Without measurement, we'll never know which skill descriptions undertrigger on cloud (the description-budget cap is a known risk).

> **v0 baseline now, re-run after sibling-roadmap drain.** Per user direction, Phase 6 runs **twice**: once now with the current skill+rule surface (mechanical steps below land; manual-smoke steps stay `[~]`), and once again after `road-to-context-aware-command-suggestion` and `road-to-product-ui-track` archive — those reshape the surface this phase measures. Final acceptance re-runs the audit and the fixture set, then closes.

- [x] **Step 1:** Pick five representative skills (T1, T2, T3-S after Phase 2 reclassification) and design 5–10 trigger-prompts per skill. **v0 done** in [`agents/contexts/cloud-trigger-fixtures.md`](../contexts/cloud-trigger-fixtures.md): `pest-testing` (T1, framework name) · `authz-review` (T1, narrow concept) · `api-design` (T2, common verb) · `rule-writing` (T3-S, `cloud_safe: degrade`) · `skill-reviewer` (T3-S, no marker) — picks span the tier × trigger-shape grid that matters for cloud distribution. 8 prompts per skill (DE/EN, easy/medium/hard/narrow/negative/multi-step) = 40 fixture prompts total. Re-run after sibling-roadmap drain to validate picks against the surface at that moment.
- [~] **Step 2:** Manual run on Claude.ai Web — for each fixture prompt, record whether the right skill loaded. Log in `agents/reports/cloud-trigger-results-<date>.md` per the template in [`cloud-trigger-fixtures.md § Results template`](../contexts/cloud-trigger-fixtures.md#results-template-phase-6-step-3). Deferred — manual UI walkthrough; same hold pattern as Phase 1 Step 7 / Phase 4 Step 5 / Phase 5 Step 4. Re-check together with sibling-roadmap drain.
- [~] **Step 3:** Compare cloud trigger rate vs. local trigger rate. Where cloud is materially worse (≥ 30 pp on a 10-prompt sample, tightened to ≥ 20 pp once v1 doubles the sample), file a follow-up to refine the description via the existing [`description-assist`](../../.agent-src/skills/description-assist/SKILL.md) skill. Threshold + workflow documented in [`cloud-trigger-fixtures.md § Methodology`](../contexts/cloud-trigger-fixtures.md#methodology-phase-6-step-5). Mechanical comparison can only run after Step 2 produces data; deferred until then.
- [~] **Step 4:** Same exercise for Linear AI — five guidance scenarios designed in [`cloud-trigger-fixtures.md § Linear AI scenarios`](../contexts/cloud-trigger-fixtures.md#linear-ai-scenarios-phase-6-step-4) (covering `verify-before-complete`, `ask-when-uncertain`, `commit-policy`, `language-and-tone`, `direct-answers`). Execution deferred — requires a Linear workspace with `dist/linear/workspace.md` pasted into Settings → Agents → Additional guidance. Re-check together with Step 2.
- [x] **Step 5:** Document the methodology so the next round can be repeated. **v0 done** as the [§ Methodology section in `cloud-trigger-fixtures.md`](../contexts/cloud-trigger-fixtures.md#methodology-phase-6-step-5) — covers procedure per skill (Steps 2 + 3), procedure per Linear scenario (Step 4), the ≥ 30 pp follow-up threshold, the recording shape (`agents/reports/cloud-trigger-results-<YYYY-MM-DD>.md`), and the [Results template](../contexts/cloud-trigger-fixtures.md#results-template-phase-6-step-3). v0 is the harness; v1 (post-drain) inherits it unchanged.

## Acceptance Criteria

- [x] Audit shows **0 T3-H artefacts** after Phase 2 (or every remaining T3-H has an explicit `cloud_safe: noop` declaration)
- [x] `task build-cloud-bundles-all` produces a complete `dist/cloud/` set on a clean checkout — verified `2026-04-30` via fresh `git clone` into `/tmp`: `task build-cloud-bundles-all` → 125 ZIPs built · 0 skipped, `dist/cloud/*.zip` count = 125.
- [x] `task build-linear-digest` produces a `dist/linear/workspace.md` that fits Linear's per-field char limit — verified `2026-04-30`: `workspace.md` = 59,855 bytes, `team.md` = 8,453 bytes, `personal.md` = 464 bytes; `build_linear_digest.py` enforces a `--max-bytes` budget (default 100,000 bytes — conservative cap per Open Question #1) and exits 2 if exceeded. workspace fits well under budget.
- [ ] At least one bundle and the Linear digest verified manually on the live platform (screenshots in `agents/reports/`)
- [x] `README.md` documents all four install paths — landed in Phase 5 Step 2 with `Project-installed` / `Plugin-installed` / `Cloud / Hosted-agent surfaces` tables linking into [`docs/installation.md`](../../docs/installation.md).
- [x] `task ci` enforces the cloud invariants (description budget, T3-H gating, broken-link absence in the Linear digest) — verified `2026-04-30`: `task ci` chain calls `lint-marketplace` → `ci-cloud-bundle` (`build_cloud_bundle.py --check` runs `enforce_description_budget` 200-char cap + T3-H skip-with-reason gate) → `ci-linear-digest` (`build_linear_digest.py --strict-missing` exits non-zero on unmatched `strip_sections` = broken-link drift signal). Wired into PR pipeline via `.github/workflows/consistency.yml` (Phase 5 Step 5).
- [x] All package quality gates still pass: `task sync-check`, `task check-refs`, `task check-portability`, `task lint-skills`, `task check-reply-consistency`, `task test` — verified `2026-05-01`: all six gates green; `task test` = 1637 passed (12.95s); `task lint-skills` = 186 pass / 125 warn / 0 fail / 311 total.
- [ ] **Final re-check after sibling roadmaps archived** — re-run `python3 scripts/audit_cloud_compatibility.py` once `road-to-context-aware-command-suggestion`, `road-to-product-ui-track`, `road-to-artifact-engagement-telemetry`, and `road-to-visual-review-loop` are all archived; if new/changed skills introduced cloud-unfriendly prose, fix before closing this roadmap

## Open Questions / Decisions Required

1. **Linear AI char limits per field — researched value or known constant?** Phase 3 step 4 needs a hard number to test against. If unknown, fall back to a conservative cap (e.g. 30 KB) and document the assumption.
2. **Description budget — strict 200 or pragmatic 250?** Anthropic Skills API spec says 1024; Claude.ai Web UI is observed to truncate ~200. If our T1/T2 skills frequently exceed 200, we either tighten en-masse (Phase 4 work) or accept truncation on the cloud bundle path.
3. **Authoring-skill cloud variant — degrade-to-prose vs. ship the linter inside the bundle.** Step 3–5 in Phase 2 picks degrade-to-prose. If linter portability turns out cheap (single Python file, stdlib-only), shipping the linter is strictly better. Decide after a 30-min spike on the linter's dependencies.
4. **Plugin Marketplace JSON schema** — ✅ resolved (Phase 5 Step 1). Verified against [`anthropics/skills/.claude-plugin/marketplace.json`](https://github.com/anthropics/skills/blob/main/.claude-plugin/marketplace.json) and [Claude Code Plugin Marketplace docs](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces). Required fields: `name` (kebab-case), `plugins[].name`, `plugins[].source`. Optional but conventional: `owner.{name,email}`, `metadata.{description,version}`, `plugins[].{description,strict,skills[]}`. `repository` and `categories` from the original plan-sketch are NOT in the schema — dropped. Validation runs via `task lint-marketplace` (custom linter) and the upstream `claude plugin validate .` CLI (when installed).

## Notes

- This roadmap describes work, not releases. No version numbers, no tags. Per [`scope-control`](../../.agent-src.uncompressed/rules/scope-control.md#git-operations--permission-gated).
- The audit script (`scripts/audit_cloud_compatibility.py`) is permanent — re-run before every cloud-bundle release to catch regressions.
- chat-history's "noop on cloud" is the cleanest hard-dep resolution we have. Other potential hard deps in future skills should aim for the same shape: declare cloud-inertness, don't ship a half-broken variant.
- All work runs on the current branch (`feat/intent-based-development-thinking`) unless the user explicitly requests a separate branch. No mid-roadmap branch switches.
- **Hold-open until sibling roadmaps drain.** This roadmap stays *not archived* even after all phases here are checked off. Reason: phases 4 and 6 audit/validate the *final* skill+rule set; sibling roadmaps that touch skills/rules (`road-to-context-aware-command-suggestion`, `road-to-product-ui-track`) will reshape the surface that phase 4 sanitises and phase 6 measures. The final acceptance check above re-runs the cloud-action audit after they archive — if new or changed artefacts introduced cloud-unfriendly prose since this roadmap's phase 4 ran, fix-then-close. Only after that re-check passes does this roadmap move to `agents/roadmaps/archive/`.
