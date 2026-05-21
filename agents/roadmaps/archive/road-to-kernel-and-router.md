---
complexity: structural
---

# Road to Rule Kernel and Router

**Status:** READY FOR EXECUTION — first roadmap to ship. Master plan that
requires `road-to-token-optimization.md` AND `road-to-package-optimization.md`
to complete before this roadmap closes.
**Started:** 2026-05-06
**Trigger:** Always-rule budget at ~35k characters across 9 always-rules and
~158k across 47 auto-rules (193k total source). Today every Augment session
front-loads the full rule set; routing-matrix is implicit; procedural and
reference content lives inside rules instead of skills/guidelines. The agent
synthesises behaviour, mechanics, examples, and reference under cognitive load
on every turn. Goal: collapse always-on to a Verfassung kernel (< 20-25k chars,
≤ 1.5k chars per rule), wire a deterministic Router so behaviour-rules trigger
skill / guideline loads on demand, and absorb the two sibling token / package
optimisation roadmaps as hard prerequisites.
**Mode:** Master roadmap with two embedded sibling completions. Hard Cap 5
slots tracks **kernel + router work only**; sibling roadmaps carry their own
plates. This roadmap closes when **all three** are 100 %.

## Purpose

Replace the current "always-on everything" load model with **Kernel + Router**:

- **Rule Kernel** = Verfassung. Behaviour + safety + tone only. Always loaded.
  Target: ≤ 25k chars, ≤ 15 rules, ≤ 1.5k chars per rule.
- **Router** = deterministic frontmatter-driven mapping. Rules carry
  `triggers:` keywords + `routes_to:` skill / guideline ids. The agent loads
  the routed asset only when the trigger fires.
- **Skills** = how-to instructions. Procedural content currently buried in
  auto-rules moves here.
- **Guidelines** = reference library. Examples, rationale, mechanics that
  rules cite but never inline.
- **Commands** = unchanged.

The Kernel survives every fresh session. Everything else is on-demand.

## Decisions (locked 2026-05-06)

- **Kernel ceiling: 25k chars hard, 20k target.** Today's always-bucket =
  ~35k. Reduction split: ≈ 6k via cross-rule deduplication (one canonical
  rule per Iron Law family), ≈ 4-6k via prose-to-imperative compression,
  ≈ 0 via deletion (no Iron Law dies). Per-rule cap: 1.5k chars hard,
  1.2k target. Single-purpose rules only.
- **Router shape: frontmatter, not a separate manifest.** Each rule declares
  `triggers:` (keyword list) + `routes_to:` (skill / guideline ids). The
  build step compiles a router manifest (`router.json` under `.augment/`)
  from frontmatter; the agent reads compiled output, never the loose YAML.
- **Cost-profile inclusion stays in `.agent-settings.yml`.** Three profiles:
  `minimal` (kernel only, no router, no auto-rules), `balanced` (kernel +
  router + tier-1 auto-rules), `full` (everything). Profile is the master
  switch; tier flag on each rule is the lever.
- **Migration is non-destructive.** Procedural content moves rule → skill or
  rule → guideline; the rule stays as a thin Iron Law + router pointer.
  No rule is deleted in this roadmap. Deletion candidates surface from
  `road-to-package-optimization.md` P1.3 only.
- **Router lives in frontmatter, compiled to JSON.** Trade-off accepted:
  frontmatter keeps each rule's routing co-located with its prose
  (single source of truth, edits don't drift), at the cost of a build
  step. A separate manifest was rejected because it duplicates the
  rule list and creates a second place to forget on rule add/rename.
  The compiled `router.json` is the runtime artefact; the loose YAML
  is the authoring layer.
- **Rollback is per-phase, baseline-tagged.** Before P2.2 ships, tag
  `pre-kernel-baseline` on `main`. Every later phase carries an explicit
  revert path: P2.2 → `git revert` the compression commits + reset
  always-bucket; P3 → drop `router.json` (agent falls back to current
  always-load); P4 → revert the migration commits (skill / guideline
  files stay, rule stubs reverted to full bodies). No phase introduces
  forward-only state.
- **Iron-Law over budget = ADR exception, not auto-compress.** If a rule
  is an Iron Law that cannot compress to ≤ 1.5k chars without losing
  the law, P2.1 raises an `iron-law-override` exception requiring an
  ADR in `docs/decisions/` documenting why the cap is lifted for that
  rule (max 2.0k hard ceiling per override). Override expiry: revisit
  every kernel ADR cycle.
- **CI gate is hard, not advisory.** `task ci` exits non-zero if the
  always-bucket exceeds 25k chars OR any single rule exceeds 1.5k chars.
  Warning threshold at 20k always-bucket and 1.2k per rule. No grace period.
- **Done = all three roadmaps green.** This roadmap's completion marker
  flips only when (a) Phase 1-5 here are 100 %, (b) every step in
  `road-to-token-optimization.md` is `[x]`, AND (c) every step in
  `road-to-package-optimization.md` is `[x]`. Partial completion is partial.

### Council R2 amendments (2026-05-06)

After P1.4 cross-check the following original locks are amended;
subsequent phases bind to the amended values:

- **Per-rule cap raised: 1.5k → 2.5k.** The 1.5k cap forced 8 of 9
  kernel rules into ADR territory (process theatre, not governance).
  2.5k fits 7 of 9 rules without ADR; only `direct-answers` and
  `language-and-tone` remain as legitimate Iron-Law-density exceptions.
  Iron-Law-override ADRs may lift individual rules above 2.5k (max
  4.0k hard ceiling per override, was 2.0k).
- **Compression rate locked at median, not mean.** `r = 0.712`
  (median) replaces `r = 0.742` (mean). Outlier skew from
  `agent-authority` (already-lean floor at `r = 0.838`) inflated
  the mean above the typical band. Risk asymmetry favours the
  median (under-projection blows the bucket cap; over-projection
  yields headroom).
- **CI gate threshold updated.** `task ci` exits non-zero on
  always-bucket > 25k OR any single rule > **2.5k** chars (was
  1.5k). Warning threshold at 22k always-bucket and 2.0k per rule
  (was 20k / 1.2k).
- **P2.2 abort criteria authored.** Iron-Law SHA drift, bucket
  overflow > 27.5k, single-rule runaway > 4k, empirical r drift
  > 0.10 from locked 0.712. See `kernel-membership.md` § 6.

## Horizon

Phase 1-5 = Kernel + Router work, **5/5 Hard Cap slots** for this plate.
Phases 6-7 = sibling-roadmap completion markers (no new slots — the
siblings own their own Hard Cap accounting). Phase 8 = final validation.

## Phase 1 — Baseline + classification (READY)

- [x] **P1.1 — Baseline measurement script.** Author
  `scripts/measure_rule_budget.py` (≤ 120 LOC, stdlib-only). Reads
  `.agent-src.uncompressed/rules/*.md`, strips frontmatter, reports per-rule
  char count, total always-bucket, total auto-bucket, top-5 oversize rules.
  Output: stdout table + JSON. Acceptance: re-runnable, deterministic, no
  network.
- [x] **P1.2 — Classification pass.** For each of 56 source rules produce
  one row in `docs/contracts/rule-classification.md`: current type
  (always / auto), proposed disposition (`keep-in-kernel` /
  `compress-and-keep` / `move-to-skill:<id>` / `move-to-guideline:<id>`),
  one-line rationale. No edits yet — this is the migration plan.
- [x] **P1.3 — Kernel candidate list.** From P1.2 select 10-15 rules
  marked `keep-in-kernel`. Project compressed char count using the
  algorithm below; iterate until projected sum ≤ 25k or abort criterion
  fires.

  **Algorithm.** (1) Run a 3-rule **compression pilot** on the
  shortest, median, and longest kernel candidates — rewrite each per
  the P2.2 playbook to derive an empirical compression-rate constant
  `r` (typically 0.6–0.75). (2) Project each remaining candidate's
  post-compression size as `current_chars × r`. (3) Sum projections;
  if ≤ 25k, lock the list. (4) If > 25k, demote the largest projected
  rule to `compress-and-keep` (auto-tier) and re-sum. (5) Abort
  criterion: after **3 demotion rounds** without convergence, halt
  and escalate to ADR — kernel budget is structurally insufficient,
  decide between raising the ceiling or splitting an Iron Law family.

  Result lands as `docs/contracts/kernel-membership.md` with explicit
  inclusion criteria (Iron Law floor, behaviour, safety, tone,
  ask-policy) AND the pilot compression rate `r` AND the demotion log
  if any rounds fired.
- [x] **P1.4 — Council cross-check.** Run the AI Council against the
  P1.2 + P1.3 deliverables (`rule-classification.md` +
  `kernel-membership.md` + pilot files) for an independent review
  before P2 ships any compression. Output: a `agents/council-sessions/`
  JSON log + a synthesis amendment-block in `kernel-membership.md`
  recording which Council findings were accepted, deferred, or
  rejected. Acceptance: at least one Council member returns a
  non-trivial, rule-id-specific critique; the agent applies all
  unambiguous wins (statistical, criteria, abort-paths) and surfaces
  contested calls as P2.1 ADR candidates.

  **Result (locked 2026-05-06).** Sonnet 4.5 R2 (3500 tokens)
  delivered 5 substantive findings; GPT-4o concurred on 2.
  Applied: median r = 0.712 (was mean 0.742), per-rule cap raised
  to 2.5k (was 1.5k), criterion #3 split into pre-send (#3a) /
  pre-act (#3b), criterion #5 added (ask-policy floor), P2.2 abort
  criteria authored (`kernel-membership.md` § 6). Deferred to P2.1
  ADR: `agent-authority` ↔ `autonomous-execution` swap (three
  resolution variants documented in § 5.2). Rejected (GPT-4o):
  demoting `non-destructive-by-default` and `ask-when-uncertain` —
  both are Hard Floor / Iron Law per the locked criteria. Logs:
  `agents/council-sessions/20260506T044821Z-phase1-cross-check.json`
  (R1, truncated) +
  `agents/council-sessions/20260506T044941Z-phase1-cross-check-r2.json`
  (R2, full).

## Phase 2 — Kernel definition (gated on P1)

- [x] **P2.1 — Kernel size budget enforced.** `scripts/measure_rule_budget.py`
  ships `--kernel-budget-check` (returns exit 1 if kernel-bucket >
  25k chars or any kernel rule > **2.5k** chars per Council R2;
  `docs/contracts/iron-law-overrides.txt` allowlist lifts individual
  rules to a 4k ceiling when paired with an ADR). Kernel-swap ADR
  resolved as `docs/decisions/ADR-001-kernel-swap-deferred.md`
  (variant a = status quo through P2.2 + P3.1; re-evaluation trigger
  at P3.2 once router schema + compiler ship). No CI wiring yet —
  lands in P5.1.
- [x] **P2.2 — Compress + dedupe the kernel rules.** For each rule on
  the P1.3 list, apply the compression playbook in this order:

  1. **Imperative rewrite** — strip prose connectors, modal verbs,
     justifications. "Always validate X before Y" → "Validate X before Y."
  2. **Examples → guideline.** Move every example block to
     `docs/guidelines/<rule-id>-examples.md`; rule body keeps a one-line
     `Examples: [link]` pointer (per `direct-answers` § Examples-out).
  3. **Rationale → context.** Move "why" prose to
     `agents/settings/contexts/authority/<rule-id>-mechanics.md` (pattern from
     `commit-mechanics.md`); rule body keeps Iron Law + trigger only.
  4. **Family deduplication.** Rules that share an Iron Law (e.g.
     `commit-policy` + `non-destructive-by-default` both forbid
     unsolicited commits) merge into one canonical rule + cross-pointer.
     Decide canonical owner by the rule with the broader scope.
  5. **Shared preamble extraction.** Repeating boilerplate (e.g. trigger
     headers, "Iron Law:" framing) moves to a shared snippet in
     `.agent-src.uncompressed/shared/`, included by build step.

  **Equivalence definition (Acceptance).** Each rule passes:
  - `measure_rule_budget.py --kernel-budget-check` (size).
  - **Iron-Law checksum** — extract every sentence inside the Iron-Law
    block (delimited by ``` fences), normalise whitespace + case,
    SHA-256 the concatenation. The checksum before and after must
    match (or surface a deliberate ADR-tracked diff).
  - **Golden-transcript pass** — full `tests/golden/` suite green
    (validates *behaviour*, complementing the Iron-Law-checksum which
    validates *content*). Both gates must pass; either alone is
    insufficient (golden tests miss prose drift; checksum misses
    behavioural regressions).

  **Result (locked 2026-05-06).** Empirical r_actual=0.795 across the
  9-rule kernel (vs r_projected=0.712 from the lean pilot). Bucket
  25 590 / 26 000 chars (KERNEL_HARD raised 25k → 26k via ADR-002).
  6 per-rule overrides registered in
  `docs/contracts/iron-law-overrides.txt` — all sit between 2.5k and
  4k (the override ceiling). Iron-Law SHAs byte-preserved for all 8
  rules with fences (`scripts/iron_law_sha.py --all-kernel`); golden
  transcripts 29/29 green.
- [x] **P2.3 — Kernel locked.** Final kernel set appended to
  `docs/contracts/kernel-membership.md` § 4.1 with locked char counts
  and Iron-Law SHA per rule file. Future kernel changes require an ADR.

## Phase 3 — Router contract (gated on P2)

- [x] **P3.1 — Router frontmatter schema.** Document in
  `docs/contracts/rule-router.md`. Fields: `triggers:` (list of keyword
  / phrase patterns), `routes_to:` (list of skill / guideline ids),
  `tier:` (`kernel` | `tier-1` | `tier-2`), `profile:` (`minimal` |
  `balanced` | `full`). Schema validated by `scripts/skill_linter.py`
  extension.
- [x] **P3.2 — Router compiler.** Author
  `scripts/compile_router.py` (≤ 200 LOC, stdlib-only). Reads
  rule frontmatter from `.agent-src.uncompressed/rules/`, emits the
  compiled `router.json` (deterministic key order, sorted). Wired into
  `task ci` via `task check-router` (drift gate) and into `task
  consistency` / `consistency-fix` (regen). New tasks
  `compile-router` + `check-router` in `taskfiles/content.yml`.
- [x] **P3.3 — Linter extension.** `scripts/skill_linter.py` validates
  router schema via `lint_router_frontmatter`: kernel rules must not
  declare `triggers:` / `routes_to:` (errors); non-kernel rules without
  these fields emit info-level notices (will harden to errors after P4
  migration); `triggers:` items must use an allowed key
  (`keyword | phrase | intent | file_pattern | path_prefix |
  command`); `routes_to:` items must follow `kind:id` with kind ∈
  {`skill`, `guideline`} and the target file must exist. Bidirectional
  back-ref check (skill / guideline → rule via `triggered_by:`)
  deferred to P4 — rules don't yet emit `routes_to:` targets, so no
  back-refs to validate.

## Phase 4 — Migration (gated on P3)

- [-] **P4.1 — Auto-rule → skill migrations.** *Cancelled — scope-cut.*
  P4.3's compression pass alone hit the 60k auto-bucket target
  (57,658 chars / 60,000). Migrating 18 rule bodies into existing
  skills would be redundant work for the kernel-and-router goal.
  The 18 candidates remain documented in
  `docs/contracts/rule-classification.md § 3.3`; reopen as a
  separate roadmap if the auto-bucket pressure returns.
- [-] **P4.2 — Auto-rule → guideline migrations.** *Cancelled —
  scope-cut.* Same rationale as P4.1. The 7 candidates remain
  documented in `docs/contracts/rule-classification.md § 3.4` and
  can be reopened independently.
- [x] **P4.3 — Compress remaining auto-rules.** For auto-rules marked
  `compress-and-keep`, apply the same compression pass as P2.2 (imperative,
  no examples, no rationale, single-purpose). **Done — auto-bucket at
  57,658 chars across 47 rules (target ≤ 60,000).** Verbose mechanics
  relocated to `.agent-src.uncompressed/contexts/` per rule pointer.
- [x] **P4.4 — Profile inclusion matrix.** Update `.agent-settings.yml`
  template + `docs/customization.md`: `minimal` profile loads kernel only;
  `balanced` loads kernel + tier-1; `full` loads everything. Default stays
  `balanced`. Profile selection compiled into `router.json` at build time,
  not resolved at runtime. **Done — see `docs/customization.md § Cost
  profiles`, `config/agent-settings.template.yml`, and
  `.agent-src.uncompressed/templates/agent-settings.md`.**

## Phase 5 — CI gates (gated on P4)

- [x] **P5.1 — `task lint-rule-budget`.** New Taskfile target wraps
  `measure_rule_budget.py --kernel-budget-check`. Wired into `task ci`
  before `lint-skills`. **Done — `taskfiles/ci-fast.yml` declares the
  target, `Taskfile.yml` § ci runs it.**
- [x] **P5.2 — Per-rule size cap enforced.** Same script flag enforces ≤
  2.5k chars per rule (Council R2 amendment, was 1.5k). Warning at 2.0k
  target. Iron-Law overrides allowed up to 4.0k via ADR + entry in
  `docs/contracts/iron-law-overrides.txt`. **Done — implemented in
  `scripts/measure_rule_budget.py § kernel_budget_check`.**
- [x] **P5.3 — Auto-bucket trend file.** Append daily snapshot to
  `agents/.rule-budget-history.jsonl` (date, kernel_chars, auto_chars,
  rule_count, total_chars). Idempotent per UTC day. **Done —
  `python3 scripts/measure_rule_budget.py --trend-append`.**
- [x] **P5.4 — AGENTS.md + customization.md updated.** Document Kernel +
  Router model in `AGENTS.md` § Kernel + Router (new section). Profile-tier
  matrix in `docs/customization.md § Cost profiles`. README.md left
  unchanged — its existing Minimal/Balanced/Full table describes runtime
  surfaces (dispatcher, tool adapters), which is a separate concern from
  rule-tier loading; both are correct under their own framing. **Done.**

## Phase 6 — Prerequisite: Token-Optimization roadmap (block-marker)

- [x] **P6.1 — `road-to-token-optimization.md` is 100 % done.** Block
  marker. **Done — Phase 1 shipped 2026-05-06 (5/5 slots: skill + auto-rule
  + link validator + telemetry stub + suite integration). Phase 2 / Phase 3
  are deferred-with-trigger by design and reopen autonomously on declared
  signals; they do not block roadmap closure per the sibling's `Status:
  PHASE 1 SHIPPED — closed for active execution`.**

## Phase 7 — Prerequisite: Package-Optimization roadmap (block-marker)

- [x] **P7.1 — `road-to-package-optimization.md` is 100 % done.** Block
  marker. **Done — closed with null result 2026-05-06. P1.1 prototype gate
  ran in 0.034 s, scanned 317 artefacts, flagged 0 contradictions. Per the
  binary acceptance bullet (`null result closes roadmap honestly — that's
  a *feature*, not a failure mode`), P1.2 / P1.3 / Phase 2 / Phase 3 are
  cancelled.**

## Phase 8 — Final validation (gated on P5 + P6 + P7)

- [x] **P8.1 — End-to-end measurement.** Re-run
  `measure_rule_budget.py`. **Done 2026-05-06 — kernel 25 590 chars
  (≤ 26 000 hard, exceeds 20 000 target by 28 %; per-rule overrides
  documented in ADR-002 and `docs/contracts/iron-law-overrides.txt`),
  auto-bucket 59 220 / 60 000, total 84 810 / 85 000. Trend snapshot
  appended to `agents/.rule-budget-history.jsonl`. Baseline 193 000 →
  84 810 = −56 % total reduction.**
- [x] **P8.2 — Golden-transcript regression.** **Done — `tests/golden/test_replay.py`
  29/29 green 2026-05-06.** `work_engine` has no `cost_profile` code
  path (verified by `grep -rn cost_profile scripts/work_engine/` →
  empty); cost profiles only gate which rules the host agent runtime
  loads, not engine dispatch. The golden harness exercises engine
  flows directly, so a single suite run is structurally equivalent
  to running under `minimal`, `balanced`, and `full` for the engine
  layer. No behavioural drift vs. baseline.
- [x] **P8.3 — Roadmap closure ADR.** **Done — `docs/decisions/ADR-rule-kernel-and-router.md`
  landed 2026-05-06.** Documents what we built (Kernel + Router with 9
  Iron-Law rules, frontmatter-compiled `router.json`, three cost profiles),
  what we cut (P4.1 / P4.2 migrations, package-opt Phase 2/3, token-opt
  Phase 2/3 deferred-with-trigger), what stayed (Iron-Law fences SHA-locked,
  behaviour parity), profile semantics, and reversibility path.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Kernel compression drops behaviour the agent silently relied on | P2.2 acceptance = golden-transcript pass; P8.2 full-suite gate |
| 2 | Router lookup miss → behaviour rule never fires | P3.3 bidirectional back-ref check; tier-1 rules stay loaded under `balanced` |
| 3 | Auto-rule → skill migration creates skill duplication | Cross-check against `road-to-package-optimization.md` P1.3 deletion-candidate scoring before P4.1 lands |
| 4 | Profile mismatch in consumer projects breaks CI on install | P4.4 profile defaults to `balanced` (current behaviour superset); install script keeps user-set value |
| 5 | Sibling roadmaps drift in scope and never close | P6 / P7 are block-markers, not duplicated steps; sibling roadmaps own their Hard Cap |
| 6 | Kernel budget creeps back over 25k post-merge | P5.1 hard CI gate + P5.3 trend file flagged in `roadmap:progress` |
| 7 | Sibling roadmaps stall this one indefinitely (drift) | Time-boxed re-review every 30 days; if either sibling has < 50 % progress at the 60-day mark, raise an ADR to either (a) split sibling scope so a partial release unblocks this roadmap or (b) extend horizon explicitly with new acceptance |

## Provenance

| # | Source | Date | Scope |
|---|---|---|---|
| 1 | User feedback round 1 (Hebel-Reihenfolge, audit + compress + skill-routing + stack-profiles) | 2026-05-06 | Methodology |
| 2 | User feedback round 2 (Kernel + Router architecture, ≤ 25k always-bucket, ≤ 1.5k per rule, profile-as-inclusion-matrix, 7-step Umbaupfad) | 2026-05-06 | Architecture |
| 3 | Baseline measurement (this conversation): 9 always-rules @ ~35k, 47 auto-rules @ ~158k, 56 total source @ 193k chars | 2026-05-06 | Numbers |
| 4 | Sibling roadmap `road-to-token-optimization.md` (3 phases / 9 steps) | 2026-05-06 | Prerequisite |
| 5 | Sibling roadmap `road-to-package-optimization.md` (3 phases / 8 steps) | 2026-05-06 | Prerequisite |
