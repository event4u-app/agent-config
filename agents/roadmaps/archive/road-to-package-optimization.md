---
complexity: structural
---

# Road to Package Optimization

**Status:** CLOSED WITH NULL RESULT — 2026-05-06.
P1.1 prototype gate ran deterministically (317 artefacts scanned in
0.034 s, well under the 5 s budget) and flagged **zero**
cross-artefact contradictions. Per the binary acceptance bullet on
P1.1 ("on failure, this entire roadmap is closed with the null
result documented; no Phase 2 work begins") and the matching risk-
register entry ("null result closes roadmap honestly — that's a
*feature*, not a failure mode"), P1.2 / P1.3 / Phase 2 / Phase 3 are
cancelled. The artefact surface is empirically already well-governed
on the heuristics this prototype tested (frontmatter routing, shared
trigger imperative conflict). This roadmap will not be reopened
without a fresh evidence trigger (e.g., a real contradiction caught
manually that the prototype missed → broader heuristic → re-run).
**Started:** 2026-05-06
**Closed:** 2026-05-06
**Trigger:** User ask — a planned package-optimizer skill / command to audit
rules+skills+commands+contexts cross-artifact-type, classify deletion
candidates with explicit user gate, integrate AI council opt-in. Today's
optimization surface is siloed by artifact type.
**Mode:** Phased rollout. Phase 1 ships **deterministic primitives only**
(prototype gate + production linter + deletion-candidate scorer) — no
skill, no command, no AI, no council. Hard Cap 5 per 6-week plate; this
plate uses **3 of 5 slots** — leaves headroom for parallel plates already
queued. Phase 2 (consult surface) reopens only after Phase 1 proves the
gap is real and classification heuristics are stable.

## Purpose

Close the cross-artifact-contradiction gap (rule X says A, skill Y
dispatches B — invisible today) and the deletion-candidate gap (no
ranked list of low-utility assets). Honor `verify-before-complete` by
producing evidence (real contradictions found, real candidates ranked)
**before** any consult surface gets built. Sonnet's prototype-gate is
the same evidence floor — if the deterministic linter cannot flag ≥3
real contradictions in this repo within 5 s and < $0.01 cost, the
unified design is premature and ships nothing.

## Decisions (synthesized 2026-05-06 from council)

- **Architecture: phased — primitives first, consult surface deferred.**
  Sonnet's refusal-to-pick on Q1 wins on weight. GPT-4o's (b)
  `/optimize package` sub-command is correct *eventually* but premature
  before the linter proves out. Phase 2 ships (b)+(c) shape only after
  Phase 1 evidence.
- **Deletion gate: hybrid (a)+(b).** Phase 1 produces deterministic
  JSON report (no prompt — script output). Phase 2's `/optimize package`
  front-ends with GPT-4o's up-front "hunt for deletion candidates? [y/n]"
  prompt. Bulk-delete forbidden by construction; per-file confirm only.
- **Council integration: (c) — only at flagged surfaces, only when
  prompted.** Council fires when Phase 1 linter produces flagged-for-
  judgment list AND user approves cost estimate. Audit trail to
  `agents/council-questions/` per existing pattern. Default OFF unless
  `ai_council.enabled: true` in `.agent-settings.yml`.
- **Net-new: prototype gate as P1.1.** Sonnet's Tier-S move accepted —
  prove the contradiction detector works deterministically before any
  production code. GPT-4o's stale-context detector accepted as P3.2
  (governance cross-cut, deferred).

## Phase 1 — Prove the gap with deterministic primitives (READY)

- [x] **P1.1 — Prototype gate: `scripts/prototype_lint_contradictions.py`.**
  *Shipped 2026-05-06. Ran in 0.034 s, scanned 317 artefacts, flagged
  0 contradictions. Null result documented above; closes roadmap.*
  ≤200 LOC Python. Reads `.agent-src.uncondensed/{rules,skills,commands}/`
  + `agents/settings/contexts/`. For each artifact, extracts `description`
  frontmatter + section headings (`## When to use`, `## Procedure`,
  `## Steps`, `## Iron Law`). Builds an artifact-pair index keyed by
  shared trigger keywords. Flags pairs where one artifact prescribes
  action A and another dispatches action B on the same trigger. Hard
  acceptance: must flag **≥3 real cross-artifact contradictions** in
  this repo within **5 s wall-clock** and **< $0.01** total cost
  (deterministic — no LLM calls). On failure, this entire roadmap is
  closed with the null result documented; no Phase 2 work begins.
  Output: stdout JSON `[{artifact_a, artifact_b, conflict_type, evidence}]`.

- [-] **P1.2 — Production linter: `scripts/lint_contradictions.py`.**
  *Cancelled per P1.1 binary acceptance gate (null result).*
  Promote prototype after P1.1 acceptance. Lock the heuristic set, add
  `--ignore-pair RULE+SKILL` allowlist (false positives surfaced during
  P1.1 land here, justified inline), wire into `task ci` after
  `lint-rule-interactions`. Exit non-zero on new contradictions; exit
  zero on allowlisted ones. Lines budget: ≤250 (50 over P1.1 to absorb
  allowlist + CI integration). Companion: `docs/contracts/contradictions-
  ignore.yml` for the allowlist with `evidence:` field per entry.

- [-] **P1.3 — Deterministic deletion-candidate scorer:
  *Cancelled per P1.1 binary acceptance gate (entire roadmap closed
  on null result).*
  `scripts/audit_deletion_candidates.py`.** Read every artifact across
  the four types. For each, compute (a) inbound `[link](path)` reference
  count from other artifacts, (b) days since last `git log -1`, (c)
  `skill_linter` / `lint-rule-tiers` PASS/FAIL count over last N=5
  commits. Tier-S = 0 inbound refs AND > 90 days stale AND lint-FAIL
  ≥3 commits. Tier-A = same but failing 2 of 3 conditions. Tier-B =
  failing 1 of 3, surface only on `--include-borderline`. Output: JSON
  `[{path, tier, inbound, age_days, lint_status, recommendation}]`.
  **No deletions, no prompts, no AI, no council.** Read-only audit
  artifact; maintainer pipes to whatever review workflow they want.
  Lines budget: ≤200.

## Phase 2 — Build the consult surface (deferred-with-trigger)

- [-] **P2.1 — `/optimize package` sub-command.** Reopen only when
  P1.2 has caught **≥1 real contradiction** that a maintainer actioned
  AND P1.3 has produced a deletion-candidate list that resulted in **≥1
  artifact pruned**. Adoption shape: the planned optimize/package command,
  routes through `/optimize` orchestrator, dispatches to P1.2 + P1.3
  scripts, surfaces a unified report, gates deletion via GPT-4o's
  up-front prompt + per-file confirmation. Hard floor: bulk delete
  rejected by construction; the command emits per-file `git rm` lines
  for the maintainer to copy/paste, never executes. Lines budget: ≤180.

- [-] **P2.2 — package-optimizer skill (proposed name).** Reopen only when P2.1
  invocations show maintainers asking the same procedural questions
  (decision tree for "what does Tier-A mean?", ICE rubric for
  prioritization, council-prompt template). Adoption shape: skill body
  with handbook material + decision tree + deletion-gate flow. Skill
  cites P2.1 command for execution; no overlap. Lines budget: ≤300.

- [-] **P2.3 — AI Council integration at tier-B surfaces only.** Reopen
  only when P2.1 logs **≥3 deterministic ambiguous cases** (cases the
  linter flags but cannot resolve from `rule-interactions.yml`).
  Adoption shape: the planned optimize/package command adds `--council` flag,
  cost estimate printed before any API call, hard-stop if estimate
  exceeds `cost_profile` budget. Council Q + responses land in
  `agents/council-questions/` with `package-optimizer-` prefix per
  existing audit-trail pattern. Default OFF unless
  `ai_council.enabled: true`. Hard floor: council vote NEVER decides
  deletion; council only ranks ambiguity. Maintainer keeps decision.

## Phase 3 — Governance cross-cut

- [-] **P3.1 — Sunset audit.** After Phase 1 has been live one full
  cycle (4 weeks): count contradictions caught by P1.2 in production
  CI runs. **Zero hits → sunset both scripts**, document null result so
  nobody reproposes them; do not advance Phase 2. **≥1 hit → keep**,
  audit allowlist for drift, verify Phase 2 triggers. If Phase 2 ships
  but `/optimize package` invocation rate < 2/month sustained → demote
  command to skill-only (P2.2 standalone, P2.1 retired).

- [-] **P3.2 — Stale-context detector** (GPT-4o's Q4 net-new). Reopen
  on its own trigger (independent of P1/P2 outcomes): when
  `agents/settings/contexts/` has > 20 files AND ≥3 are last-touched > 90 d AND
  zero inbound refs. Adoption shape: `scripts/audit_stale_contexts.py`
  ≤80 LOC, JSON output, no deletions, no AI. Lightweight bolt-on,
  re-uses P1.3's reference-counting logic.

## Risk register

- **Prototype-gate optimism risk:** `lint_contradictions` heuristic
  flags 0 contradictions because the rules-skill-command surface in
  this repo is already well-governed. Mitigated: P1.1 acceptance is
  binary, null result closes roadmap honestly — that's a *feature*,
  not a failure mode.
- **False-positive flood:** heuristic flags 50 noise pairs and the
  signal is buried. Mitigated: P1.2 allowlist with mandatory `evidence:`
  field; if allowlist grows > 30 entries, heuristic is wrong, revisit.
- **Deletion gate erosion:** future PR adds bulk-delete shortcut to
  `/optimize package`. Mitigated: P2.1 acceptance bullet "bulk delete
  rejected by construction" makes this a contract violation, not a
  refactor.
- **Council scope creep:** P2.3 council fires on every ambiguity, not
  just tier-B. Mitigated: cost estimate gate + `cost_profile` budget
  hard-stop forces explicit user opt-in per call.
- **Hard-Cap pressure if Phase 2 reopens early:** if all 3 P2.x
  triggers fire simultaneously, plate jumps from 3/5 to 6/5. Mitigated:
  triggers are independent; each P2.x only consumes a slot when it
  actually moves to ready, plate-counter check at trigger-fire time
  rejects > 5/5. Defer one if conflict.
