---
complexity: structural
status: ready
---

# Roadmap: Analysis Workbench — RCA / post-mortem / premortem as an integrated learning loop (not a skill dump)

**Trigger:** An external ideation thread (§ Provenance) proposed adding 14
post-mortem / RCA frameworks (blameless post-mortem, 5-whys, fishbone,
fault-tree, timeline, premortem, decision-review, near-miss, incident-pattern,
prompt/agent-failure RCA) plus an `/analyze:incident` auto-triage meta-command.
Audited against the codebase, most of that is partial-overlap with skills AC
already ships, and the proposed auto-triage and skill-per-framework shape would
be a dump. The real, unbuilt value is a **closed learning loop**:
`incident-learnings` is a curated, writable memory type that
`security-sensitive-stop` already *reads* — but nothing systematically
*produces* it, and the retrieval has no staleness guard. This roadmap builds the
loop, not the dump.

## Goal

Ship an opt-in **Analysis Workbench** capability where structured analysis
(post-mortem, root-cause, premortem, decision-review, near-miss) is a small set
of mostly-**internal** skills that (a) reuse the existing
incident-commander / systematic-debugging / risk-officer / decision-record
surface, (b) are orchestrated by ONE visible confidence-weighted **suggester**
(`/analyze`) that proposes frameworks and lets the user pick — never auto-triages
— and (c) every flow ends by drafting a redacted `incident-learnings` /
`historical-patterns` candidate into the existing `/memory propose` intake,
closing the produce→consume loop that `security-sensitive-stop` exposes. No new
runtime, no auto-promote to curated memory, no self-modifying agent loop in v1.

> **The one resolved tension (council).** The integration spine is the
> **memory loop**, and the loop is **MANUAL, not half-open** — producers exist
> (`/memory propose` → `/memory promote`, `memory-consolidation`,
> `/memory mine-session`); what is missing is a skill that *systematically
> drafts* a learning at the end of an analysis. We **automate the draft, keep
> the promote gate human**. Auto-promoting optimizes volume over quality and a
> stressed operator promoting a wrong learning poisons every future
> `retrieve()`. Draft-to-intake (provisional) + the existing admission gate is
> the correct default.

> **Hard dependency (deferred phase only):** the AI-specific RCA work
> (prompt-/agent-failure analysis, chat-history mining, any
> `learning-to-rule-or-skill` auto-improvement) is gated behind
> `road-to-security-hardening` completing — it touches the trust boundary and
> "self-modify before the threat model exists is malpractice" (council). The
> **core** loop (Phases 0–5) is independent of security-hardening and
> parallel-safe with `road-to-mission-mode`.

---

## Prerequisites

- [x] Confirm no slug collision for the `/analyze` cluster against the existing
      standalone `project-analyze` / `analyze-reference-repo` commands; pick the
      final namespace (`analyze` cluster vs `incident` cluster) and record it.
- [x] Confirm `domain-adoption-policy` does **not** fire: analysis is an
      already-open domain (AC ships incident-commander, risk-officer,
      decision-record, systematic-debugging) — no new toolchain, runtime, or
      language → this is a within-domain content pack, like `product-discovery`.
      State this in the Phase 0 ADR so the governance question is not relitigated.

## Context

- **Verified gap table.** GENUINE gaps: structured 5-whys + fishbone +
  contributing-factors, a full blameless-post-mortem *writer* (incident-commander
  only drafts a skeleton and explicitly does not root-cause), post-hoc
  corrective-action closure, premortem, incident-pattern correlation over memory.
  ALREADY-COVERED / partial: timeline (incident-commander append-only log),
  architecture-review (`architecture-review-lens` + `blast-radius-analyzer`
  exist — do NOT build a new one), decision *locking* (`decision-record` +
  `adr-create`), risk pre-commit (`risk-officer`), assumption-attack
  (`adversarial-review`), root-cause discovery (`systematic-debugging`,
  `bug-analyzer`).
- **The loop today.** `incident-learnings.example.yml` names "Writer: incident
  commander after resolution" but no skill performs that write as a flow step;
  `security-sensitive-stop` reads via
  `retrieve(types=["incident-learnings","historical-patterns"], keys=<files>)`
  with no staleness/supersession guard.
- **Pack mechanics.** Packs live in `src/config/discovery/packs.yml` (registry)
  → generated `src/packs/<id>/pack.yaml`; the real budget is **visible-command
  count by `size_class`** (medium ≤5), internal commands UNCAPPED, no
  skill/persona cap. The `ops` workspace today is `ops-people` (HR) — there is
  no incident/ops-engineering pack, so this is a cross-workspace opt-in pack.
- **Orchestration patterns.** Prose dispatcher clusters (`council:*`,
  `feature:*`, `roadmap:*`); the work-engine is a fixed 8-step *code-task*
  dispatcher and `/orchestrate` is a linear gated DSL — neither is a generic
  branching investigator, and a new state-machine runtime would violate the
  no-runtime boundary. The `/analyze` suggester achieves branching via
  human-gated re-invocation, not a daemon.

---

## Phase 0 — Contracts + integration boundary (authoring-only)

The policy layer the skills depend on. No code, no runtime.

- [x] Write `docs/contracts/analysis-memory-loop.md` — the produce→propose→
      promote→retrieve contract every analysis skill references:
      (a) analysis flows draft a **redacted** `incident-learnings` /
      `historical-patterns` / decision candidate to `/memory propose` intake
      (provisional), **never** auto-promote to curated; (b) `/memory promote`'s
      existing admission gate (`check_memory_proposal.py`: ≥2 paths OR ≥3
      decisions) is the quality gate; (c) **dedup**: before drafting, the skill
      `retrieve()`s the same key-space and, on a match, proposes a
      `frequency`/`supersedes` update to the existing entry rather than a new one;
      (d) **time-decay**: every candidate carries `last_validated` +
      `review_after_days` + `applicable_scope` (already in the schema).
- [x] Define the **incident-commander → blameless-post-mortem handoff** in the
      same contract: the skeleton may carry an EMPTY/`TBD` root cause; the
      post-mortem skill ACCEPTS the incomplete skeleton, invokes
      `root-cause-frameworks` to fill the gap, and marks the post-mortem `draft`
      if root cause stays unresolved (no rejection of incomplete skeletons).
- [x] Record the **framework-neutrality clarification** as a one-line note in
      the contract + the new skills' frontmatter rationale: `framework-neutrality`
      governs *tech stacks* (Laravel/React), not *management frameworks*
      (5-whys/fishbone are method names, allowed). Name the SKILL generically
      (`root-cause-frameworks`) and reference the methods inside.
- [x] Capture the home/scope/orchestration decisions as an ADR (`adr-create`):
      one cross-workspace opt-in pack; suggester not auto-triage; internal-skill-
      heavy (no persona, no visible-command cost); not a new domain.

## Phase 1 — Memory-loop hardening (the spine — build before the skills)

Make the loop sound first, so every skill writes into a loop that won't poison
retrieval. Touches the memory retrieval contract + one rule.

- [x] Add **supersession** to `incident-learnings` (and the curated-memory
      check): a `supersedes: <id>` field + a `status: superseded` value that
      `retrieve()` skips while git history retains the audit trail. Append-only
      audit + correction-via-supersession (council N — append-only ≠ no
      correction). Update `scripts/check_memory.py` / the schema accordingly.
- [x] Add a **staleness guard** to `security-sensitive-stop`'s retrieve guidance:
      when a hit's `last_validated` is older than `review_after_days`, surface it
      as `stale — validate before applying`; when `applicable_scope` no longer
      matches the current system, skip it. (Schema already has the fields; this
      wires enforcement.) Edit follows the kernel-rule-edit slow-rollout rule if
      `security-sensitive-stop` is kernel.
- [x] Add a **dedup pre-check** helper the analysis skills call before drafting a
      candidate (`retrieve()` same key-space → propose update vs new). Cover with
      a unit test (new-gate verification, run once locally).

## Phase 2 — Core analysis skills (internal, minimal cut)

Mostly `user_invokable:` internal skills — no persona, no visible-command budget
cost. Each ends by drafting a memory candidate per the Phase 0 contract.

- [x] `blameless-post-mortem` (internal skill): completes the incident-commander
      skeleton — blame-free facilitation, what-went-well/wrong, action items —
      consumes the skeleton per the handoff contract, calls `root-cause-frameworks`
      for the root cause, ends with an `incident-learnings` candidate. Reuses
      incident-commander's timeline; does NOT re-implement it.
- [x] `root-cause-frameworks` (internal skill): ONE skill, internal multi-method
      (5-whys → if stalled, fishbone categories → contributing-factors split:
      root / contributing / amplifying / coincidence), returns the best result;
      **no `--method` flag in v1** (add only if telemetry shows the default
      stalls). Complements (does not duplicate) `systematic-debugging` /
      `bug-analyzer`, which it may invoke for evidence.
- [x] `corrective-action-design` <!-- folded: delivered as the corrective-action phase INSIDE blameless-post-mortem per council D5; no standalone skill --> turns root cause into sized
      action items (immediate / preventive / detection / process), each with
      owner + closure criterion + regression-test signal; reuses `risk-officer`
      mitigation framing.
- [x] **Fold near-miss into the pipeline** <!-- delivered: near-miss is a MODE of blameless-post-mortem (council D5 refined from an incident-commander tag); no standalone --> (council — near-miss is a
      detector, not a parallel system): extend `incident-commander` to tag
      `incident_type: near-miss` into its existing timeline schema, and let
      `corrective-action-design` + `blameless-post-mortem` consume it. No
      standalone near-miss skill.

## Phase 3 — Forward-looking + decision skills, integrated into planning surfaces

- [x] `premortem` (internal skill): <!-- skill + /analyze premortem surface delivered; feature:plan/roadmap-create optional-step is a low-risk follow-up (cross-pack command-skill-ref churn avoided) --> "imagine this failed in 6 months — why?";
      reuses `risk-officer` (L×I) + `adversarial-review` (assumption attack).
      **Integrate, don't bolt on**: surface it as an optional step inside
      `feature:plan` and `roadmap-create`, and as a `/analyze` pick — not a
      standalone visible command.
- [x] `decision-review` (internal skill): the *post-hoc* "did the chosen ADR
      option hold up? what changed? was it superseded?" loop that
      `decision-record` (which only *locks* choices) lacks; reads the ADR index,
      ends with a `historical-patterns` candidate. Reuses `decision-record` /
      `adr-create`; does not duplicate the locking flow.

## Phase 4 — Orchestration: the `/analyze` confidence-weighted suggester

One visible command. A prose dispatcher cluster (like `council:*`), NOT
auto-triage, NOT a new runtime.

- [x] `/analyze` (visible orchestrator): classifies the input by keywords, then
      **proposes** a weighted framework path with numbered options and lets the
      user pick — e.g. "70% outage → post-mortem + timeline + RCA; 30% security →
      fault-tree + threat-model; [1] outage [2] security [3] both [4] custom".
      Never silently auto-selects (council: taxonomy ≠ methodology; complex
      incidents span types). Logs the user's selection for later calibration.
- [x] Internal sub-commands routed by `/analyze` (uncapped):
      `analyze:postmortem`, `analyze:premortem`, `analyze:decision`,
      `analyze:near-miss`, `analyze:incident` (the full outage flow:
      incident-commander → timeline → `root-cause-frameworks` →
      `corrective-action-design` → memory candidate). Branching/backtracking is
      the agent re-invoking a sub-command at a human gate — no state-machine
      daemon.
- [-] `incident-pattern-analysis` (internal skill): <!-- deferred→closed: council D5 — scope-creep / cohort-analysis reliant; re-open via harvest once incident-learnings has volume --> cohort / correlation /
      trigger-event mapping over the now-populated `incident-learnings` memory
      (dedup-aware); separates correlation from causation; surfaces recurring
      classes. Reuses `memory-consolidation` retrieval, adds the analysis lens.

## Phase 5 — Pack assembly + discovery wiring

- [x] Register `analysis-workbench` in `src/config/discovery/packs.yml`
      (cross-workspace opt-in; `size_class: medium` → ≤5 visible commands; not
      `always_on`); add the discovery frontmatter (`workspaces`, `packs`,
      `lifecycle`, `trust`, `install`) to every new skill + the `/analyze`
      command; write `FIRST_WIN.md`.
- [x] **Lean-subset** <!-- council D4: decision-review is the universal entry, documented in FIRST_WIN.md; no extra per-skill auto-include machinery built (avoids new surface). Rest opt-in via the pack. --> the lean subset (not auto-include): which 3–4
      skills (`blameless-post-mortem`, `root-cause-frameworks`,
      `corrective-action-design`, memory write-back) are `suggests:` for the
      engineering workspace, with the rest opt-in via the pack. No global
      auto-include (developer flow stays light).
- [x] Regenerate the manifest (`generate_pack_manifests.py`) + cookbook entry +
      a verification test asserting every `/analyze` sub-command's skill refs
      resolve (reuse the `generate_cookbook` validation pattern). Run
      `lint-skills` + frontmatter + discovery linters once locally.

---

## Deferred (trigger-gated)

> Closed with the roadmap (maintainer 2026-06-15): these trigger-gated
> candidates are marked `[-]` so the roadmap archives complete, but the trigger
> + scope text below stays searchable in the archive. A future harvest re-opens
> any item as fresh work once its trigger fires — dropped from *this* plan, not
> abandoned as an idea.

- [-] **AI-specific RCA — `prompt-failure-rca` + `agent-failure-rca`.**
      **Trigger:** `road-to-security-hardening` lands (threat model + git-discipline
      hook). Read-only first: source from `/memory mine-session` over chat
      history, produce a human-readable RCA + a memory candidate. The
      `learning-to-rule-or-skill` **auto-improvement / self-modify** path stays
      deferred behind that even then (council: "self-modify before the threat
      model is malpractice"; never auto-apply).
- [-] **`fault-tree-analysis` (AND/OR-gate decomposition).** **Trigger:** ≥ 2
      consumer requests for probabilistic failure-chain decomposition beyond what
      `root-cause-frameworks` produces. Until then, contributing-factors covers it.
- [-] **`--method` flag on `root-cause-frameworks`.** **Trigger:** selection
      telemetry shows the default multi-method sequence stalls and users re-run.
- [-] **State-machine orchestrator for non-linear flows.** **Trigger:** the
      `/analyze` human-gated re-invocation proves insufficient AND ≥ 3 flows need
      branching a prose dispatcher cannot express. Until then, no new runtime
      (no-runtime boundary holds).

---

## Acceptance criteria

- [x] Phase 0 contract (`analysis-memory-loop.md`) + ADR landed; the
      handoff, dedup, time-decay, supersession, and framework-neutrality
      decisions are written down before any skill is built.
- [x] Memory loop is sound: supersession + staleness guard + dedup pre-check
      ship with tests green; `security-sensitive-stop` skips/flags stale hits.
- [x] Every analysis flow ends by drafting a **redacted** candidate to
      `/memory propose` intake; **none** auto-promote to curated memory
      (`check_memory.py` redaction stays green).
- [x] "Rounded workflow" is met, testably (council N6): ≤ 5 visible commands in
      the pack; every visible command calls ≥ 2 existing skills (proves reuse);
      no new command duplicates > 30% of an existing one (proves not-a-dump).
- [x] `persona-governance` + `framework-neutrality` + `minimal-safe-diff` +
      `size-enforcement` hold: new capabilities are internal skills (no new
      personas), no stack named in a generic skill, incident-commander /
      risk-officer / decision-record extended rather than duplicated.
- [x] `/analyze` proposes + lets the user pick (no silent auto-triage); a
      verification test confirms its sub-command skill refs resolve; cookbook +
      generated manifest regenerated.
- [x] No new runtime, no cross-session persistent state, no self-modifying agent
      loop introduced in the core phases.

- [x] **Merge gate:** PR CI green end-to-end + roadmap archived on merge. <!-- merge-gated: pr=558 merged (a918f38b); archiving now -->

## Council notes (2026-06-15, deep + peer-review)

Live council (claude-sonnet-4-5 + gpt-4o, deep, design lens, peer-review)
converged: **build the loop, not the dump.** Sharpest catches folded into the
roadmap: (1) **kill auto-triage** — incident *taxonomy* is not incident
*methodology*, complex incidents span types, and there is no conflict-resolution
strategy → a **confidence-weighted suggester** that proposes and lets the user
pick, logging selections (D3). (2) **Collapse the skill set hard** — ONE
`root-cause-frameworks` with internal multi-method and no `--method` flag in v1;
**fold near-miss** into incident-commander's existing timeline
(`incident_type: near-miss`) rather than a parallel detector; do NOT build a new
architecture-review (`architecture-review-lens`/`blast-radius` exist) (D1).
(3) The memory loop is the spine but is **MANUAL, not half-open** — automate the
*draft*, keep the *promote* gate human; auto-promote optimizes volume over
quality and a wrong promoted learning poisons every future `retrieve()` (D4,
the hardest pushback). (4) The loop needs **time-decay** (stale learnings
recommend obsolete fixes — N1), **supersession** (append-only ≠ no correction),
and **dedup** (one entry with frequency, not N) before it is safe — Phase 1
builds these first. (5) **Defer AI-specific RCA** behind security-hardening;
self-modify before the threat model is malpractice — read-only first, never
auto-apply (D5). (6) Most capabilities are **internal skills** → no persona-
governance breach, no visible-command-budget cost; the pack is a cross-workspace
opt-in, not a new domain and not a new ops-engineering workspace (D2).
Peer-review flagged the "skill dump vs integration" litmus must be *testable* →
the rounded-workflow acceptance criteria (≤5 visible, ≥2-skill reuse,
<30% duplication) encode it. Independent of mission-mode; sequence the deferred
AI-RCA phase after security-hardening.

## Provenance

- Source: an external LLM-chat ideation thread (post-mortem / RCA framework
  brainstorm), captured in `agents/tmp/post-mortem-analysis.txt` (gitignored
  scratch). Maintainer-recoverable link via
  `src/scripts/_lib/link_crypto.py decrypt`:
  `ENC1:ccpY6LYzhjnkD+VitkMugVIqi6H/AwNhPqyowXL7dD4NMsKE1go8NvocxWmKsipTxmm1xwlFO+8TZmlB0pud96k9M4IlK7RK4RFxJNtJw590ouvU0vxP48QrP5l2fZHI+PWYvjitCbY6jRXUn3MbSfDT6VNX6G44jqA=`
- Codebase audit (2026-06-15): gap table vs. incident-commander /
  systematic-debugging / bug-analyzer / risk-officer / adversarial-review /
  decision-record / adr-create / blast-radius-analyzer / architecture-review-lens
  / memory-consolidation; memory-type + retrieve() contract in
  `src/scripts/memory_lookup.py`; pack/discovery mechanics in
  `src/config/discovery/packs.yml`.
- Council: one live two-member run (claude-sonnet-4-5 + gpt-4o, deep, design
  lens, peer-review, 2026-06-15; actual spend $0.20); convergence inlined above.
