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
- [ ] **Step 2:** Build `scripts/build_linear_digest.py` — concatenates included rules with section headers; strips file references that won't resolve outside the repo (replace with footnote pointers); emits `dist/linear/{workspace,team,personal}.md`
- [ ] **Step 3:** Decide the three-layer split — workspace = universal coding posture, team = framework-specific (Laravel, etc.), personal = empty by default. Document in `agents/contexts/linear-ai-three-layers.md`.
- [ ] **Step 4:** Pytest: round-trip a fixture rule set, verify no broken `[link](path)` survives, verify the digest stays under Linear's per-field char limit (research the actual cap and write it into the test as a constant)
- [ ] **Step 5:** Manual smoke — paste the workspace digest into a Linear workspace, ask the linked agent (Codegen or Charlie) to do something the rules govern (e.g. "fix this bug — must run quality checks first"), capture whether the rule fired
- [ ] **Step 6:** Document the install path in `README.md` (Linear AI section): "Copy `dist/linear/workspace.md`, paste into Settings → Agents → Additional guidance (workspace)"

## Phase 4: Cloud-Aware Documentation Pass

> Many T2 skills and rules have prose that assumes filesystem access. The substance is fine, but the verbs are wrong on cloud. One pass to rewrite these in cloud-portable language: "the agent reads the file" stays as is; "the agent edits the file" becomes "the agent emits the new file contents; the user copies them into place".

- [ ] **Step 1:** Tag all 108 T2 artefacts with cloud-action category (`reads-only` / `edits` / `runs-task` / `mixed`) using a mini-extension to the audit script
- [ ] **Step 2:** For `edits` and `runs-task` categories, rewrite the procedure section so the cloud-degraded variant is implicit. Goal: same prose works on local and cloud — no fork.
- [ ] **Step 3:** Add a one-line `> Cloud note:` callout at the top of each affected SKILL/rule, generated automatically by the bundle builder if needed
- [ ] **Step 4:** Re-run linter + portability + reply-consistency checks; nothing should break
- [ ] **Step 5:** Spot-check 10 random T2 skills on Claude.ai Web — does the cloud-degraded reading still produce the right behavior?

## Phase 5: Distribution Channels & Install Paths

> Make the cloud bundle reachable. Three concrete channels: Claude Code Plugin Marketplace (already noted in `agents/analysis/compare-anthropics-skills.md`), direct Claude.ai upload, Linear paste.

- [ ] **Step 1:** Add `.claude-plugin/marketplace.json` per the prior reference analysis. Pin `name`, `description`, `repository`, `skills` (point at `dist/cloud/`), `categories`. Validate against Anthropic's schema.
- [ ] **Step 2:** Document the four install paths in `README.md` — local (existing `scripts/install.sh`), Claude Code plugin (`/plugin marketplace add event4u/agent-config`), Claude.ai Web (manual ZIP upload), Linear AI (paste digest). One section per path with screenshots in `agents/reports/`.
- [ ] **Step 3:** GitHub Actions workflow `cloud-release.yml` — on tag push (or manual dispatch; no automatic tagging from this roadmap), build all bundles, build Linear digest, publish as a GitHub Release artifact set
- [ ] **Step 4:** Confirm the Claude Code plugin path works end-to-end on a clean test repo
- [ ] **Step 5:** Wire `task ci` to also run the cloud-bundle build and the Linear digest build in dry-run mode, so source-breaking changes fail PR checks

## Phase 6: Telemetry & Validation

> Empirical confirmation that cloud-distributed artefacts actually trigger and help. Without measurement, we'll never know which skill descriptions undertrigger on cloud (the description-budget cap is a known risk).

- [ ] **Step 1:** Pick five representative skills (T1, T2, T3-S after Phase 2 reclassification) and design 5–10 trigger-prompts per skill. Store in `agents/contexts/cloud-trigger-fixtures.md`.
- [ ] **Step 2:** Manual run on Claude.ai Web — for each fixture prompt, record whether the right skill loaded. Log in `agents/reports/cloud-trigger-results-<date>.md`.
- [ ] **Step 3:** Compare cloud trigger rate vs. local trigger rate. Where cloud is materially worse (e.g. ≥30 percentage points), file a follow-up to refine the description (existing `description-assist` skill, cloud-aware variant).
- [ ] **Step 4:** Same exercise for Linear AI — pick three guidance scenarios, record whether the linked agent honors the rules.
- [ ] **Step 5:** Document the methodology so the next round can be repeated; this becomes the trigger-quality baseline for cloud distribution.

## Acceptance Criteria

- [x] Audit shows **0 T3-H artefacts** after Phase 2 (or every remaining T3-H has an explicit `cloud_safe: noop` declaration)
- [ ] `task build-cloud-bundles-all` produces a complete `dist/cloud/` set on a clean checkout
- [ ] `task build-linear-digest` produces a `dist/linear/workspace.md` that fits Linear's per-field char limit
- [ ] At least one bundle and the Linear digest verified manually on the live platform (screenshots in `agents/reports/`)
- [ ] `README.md` documents all four install paths
- [ ] `task ci` enforces the cloud invariants (description budget, T3-H gating, broken-link absence in the Linear digest)
- [ ] All package quality gates still pass: `task sync-check`, `task check-refs`, `task check-portability`, `task lint-skills`, `task check-reply-consistency`, `task test`

## Open Questions / Decisions Required

1. **Linear AI char limits per field — researched value or known constant?** Phase 3 step 4 needs a hard number to test against. If unknown, fall back to a conservative cap (e.g. 30 KB) and document the assumption.
2. **Description budget — strict 200 or pragmatic 250?** Anthropic Skills API spec says 1024; Claude.ai Web UI is observed to truncate ~200. If our T1/T2 skills frequently exceed 200, we either tighten en-masse (Phase 4 work) or accept truncation on the cloud bundle path.
3. **Authoring-skill cloud variant — degrade-to-prose vs. ship the linter inside the bundle.** Step 3–5 in Phase 2 picks degrade-to-prose. If linter portability turns out cheap (single Python file, stdlib-only), shipping the linter is strictly better. Decide after a 30-min spike on the linter's dependencies.
4. **Plugin Marketplace JSON schema** — Anthropic's marketplace.json schema isn't fully documented yet; Phase 5 step 1 needs a real fetch + dry-validate before we ship.

## Notes

- This roadmap describes work, not releases. No version numbers, no tags. Per [`scope-control`](../../.agent-src.uncompressed/rules/scope-control.md#git-operations--permission-gated).
- The audit script (`scripts/audit_cloud_compatibility.py`) is permanent — re-run before every cloud-bundle release to catch regressions.
- chat-history's "noop on cloud" is the cleanest hard-dep resolution we have. Other potential hard deps in future skills should aim for the same shape: declare cloud-inertness, don't ship a half-broken variant.
- All work runs on the current branch (`feat/intent-based-development-thinking`) unless the user explicitly requests a separate branch. No mid-roadmap branch switches.
