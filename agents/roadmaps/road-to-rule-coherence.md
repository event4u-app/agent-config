---
complexity: structural
status: ready
---

# Road to rule coherence — fix the delivery system, not the rules

> A dev reported "rules block each other; agent-config is slow and provides no
> value — but a 30-rule whitelist makes it work." Every claim verified against
> the tree. The finding is uncomfortable and it is not about rule quality: the
> rule layer is net-negative on Claude Code in its **shipped default
> configuration**, for three mechanical reasons, and the project's own benchmark
> already measured the headline one.
>
> Source (consumed inbox): [`agents/tmp.old/road-to-rule-coherence.txt`](../tmp.old/road-to-rule-coherence.txt).
> Council round 1 (2 members, blind + peer-review round, 2026-08-05):
> `anthropic/claude-sonnet-4-5` + `openai/gpt-4o`, $0.11 actual.

## Iron Law of this roadmap

```
NO RULE IS DELETED FOR BEING GOOD PROSE IN A BROKEN DELIVERY SYSTEM.
FIX TRANSPORT FIRST. THEN VALIDATE. MEASURE BEFORE ANY DEFAULT FLIP.
A DEFAULT FLIP IS A HUMAN RELEASE GATE — NEVER AN AGENT DECISION.
```

## Goal

Make the rule layer deliver what it already contains: correct hook transport,
no duplicated load, no unsatisfiable gate, and a one-time conflict report that
resolves conflicts by **exclusion or rewrite** — not by a new arbitration
subsystem. Everything that changes what a consumer receives stops at a human
gate with the evidence attached.

## 0. Defect classes (verified in-tree 2026-08-05, do not relitigate)

| # | Defect | Evidence |
|---|--------|----------|
| D1 | **Router is decorative.** `lean_projection.mode: eager-all` is the shipped DEFAULT — every rule body is inlined into every projection. `thin` is EXPERIMENTAL opt-in. So `type` / `tier` / `triggers` frontmatter does not gate anything by default. 83 of 92 rules reaching the host declare load-on-demand (78 `auto`, 5 `manual`), yet all 92 ship. | `src/config/agent-settings.template.yml:164-165` |
| D2 | **Conflict governance is structurally blind.** The matrix declares 9 rules / 14 pairs of ~6,105 possible; `lint_rule_interactions` validates only that *declared* pairs are well-formed, so it cannot find an undeclared conflict. It exits green today with at least one kernel-vs-kernel conflict live. | `docs/contracts/rule-interactions.yml`, `src/scripts/lint_rule_interactions.ts` |
| D3 | **Hook transport is inverted in BOTH directions on Claude Code.** Docs: "Claude Code treats exit code 1 as a non-blocking error and proceeds with the action… If your hook is meant to enforce a policy, use `exit 2`" and "Claude Code only processes JSON on exit 0." So `EXIT_BLOCK = 1` did **not** block — `block-no-verify` and `block-kernel-rule-writes` (both `fail_closed: true`) were inert; `EXIT_WARN = 2` **did** block, so advisory concerns hard-denied with their reason on stdout where exit 2 discards it. `_reduce()` lets one advisory concern set the whole tool-call verdict. | `src/scripts/hooks/dispatch_hook.ts` `_reduce`/`EXIT_*`, `memory/hook-warn-exits-2-reads-as-block.md` |
| D3b | **A security warning is silently dropped.** `injection-scan` emits exit 2 on `post_tool_use`, where exit 2 cannot block *and* stdout is ignored — the finding reaches nobody. | `src/scripts/injection_scan_hook.ts:208-209` |
| D5 | **Volume now breaks delegation.** Spawning a subagent FAILED: "Prompt is too long · ~207,664 tokens (limit 200,000)" with the agent's own conversation at ~361 tokens. `delegation-policy` mandates delegating; the rule layer makes delegation impossible on a 200k host. | measured 2026-08-05, this session |

**D4 in the source draft is FALSIFIED.** It claimed "council fail-closed, no
`ai_council` section, no keys". The council resolves 2 members and prices
correctly; the observed failure was an output-path convention error
(`--output` must live under `agents/runtime/council/responses/`). The
review-workflow aborts are therefore **not** overdetermined by a missing
council. Recorded because the draft's other conclusions were built on a
foundation that contained one false critical claim.

### Secondary confirmed defects

- `ui-audit-gate` is **unsatisfiable outside the work-engine dispatcher**: it
  requires `state.ui_audit` and its only escape is
  `directive_set == "ui-trivial"` — both dispatcher-only. In a plain chat
  session it can be neither satisfied nor skipped, so the only rule-conform
  action is "write no UI". Council reframed this correctly: it is not a
  conflict to arbitrate, it is a **scoping error** — a context-specific rule
  mislabelled as general.
- `brand-consistency` is `type: manual` and its own body says "no router
  emission" — it ships anyway. Projection contract violated under eager-all.
- Undeclared kernel-vs-kernel conflict: `ask-when-uncertain` ("ONE QUESTION PER
  TURN, ALWAYS / when in doubt, ask") vs `no-cheap-questions` ("NEVER ASK WHAT
  CONTEXT ANSWERS" + a 14-point suppression checklist).
- `context-hygiene` read-loop aborts after 5 read-only turns, "Non-bypassable:
  an autonomous mandate does not lift the abort" — it fires during any mandated
  analysis/audit/review protocol, including this repo's own review workflows.
- `token-efficiency` ">2 same tool in a row" vs `downstream-changes` "find ALL
  callers, tests, imports".
- **The measurement already exists.** The shipped template documents
  `essential` = significant discipline lift (+0.458, p=0.0135) and `full`
  residual over `essential` **not** significant (p=0.37). The default ships
  `full`. The 30-rule whitelist is 28% of prose and a hand-built approximation
  of `essential` — the "missing added value" is the project's own number.

## Council verdict (2026-08-05) — what NOT to build

Both members converged. Recorded here because these are cuts, and cuts rot
back in if the reasoning is not written down.

- **KILLED: the 4-class precedence lattice.** Precedence is the wrong
  instrument. An *unsatisfiable* constraint cannot be ranked (`ui-audit-gate`
  fails regardless of rank); two *terminal* modalities cannot be ranked
  (ranking `ask-when-uncertain` over `no-cheap-questions` just makes the loser
  dead weight). The whitelist works by **exclusion, not arbitration** — note it
  drops `agent-authority`, so it never tested arbitration at all. Also: a
  per-trigger-value `precedence` key **already exists** in `rule.schema.json`
  for collision disposition; a second, differently-shaped precedence concept
  would collide with it.
- **KILLED: expanding the interaction matrix.** Declaring more pairs documents
  conflicts instead of removing them, at O(n²) declaration debt. Keep the
  *candidate generator* as a one-time report; drop the matrix growth.
- **KILLED: the `essential` vs `full` benchmark.** Already measured, p=0.37, and
  `full` will never ship. The valuable comparison is **zero vs essential-plus**
  (does governance beat no governance?).
- **KILLED: any lift language on a 10-scenario LLM-judged probe.** No
  statistical power against a human-judged production measurement. Permitted
  claim: "detects gross regressions". Forbidden: "demonstrates improvement".
- **REJECTED SEQUENCING: P1 default flip before validation.** Flipping to an
  unvalidated preset ships broken governance to every consumer and then patches
  it post-release. Validate first, flip last, human-gated.
- **Read-loop: no suspension.** A "declared read protocol" that suspends the
  counter reopens the exact token sink the abort closes. Cap declared protocols
  at **3 reads** — stricter than the general abort, not looser — with an
  explicit escape (summarize → ask).
- **Contract tests are critical safety, not deferrable.** P0 remaps exit codes
  for two currently-broken security guards; the remap cannot ship without tests
  proving it.
- **Advisory concerns should leave `pre_tool_use`** (council preference: move to
  `post_tool_use`, exit 0). Scoped as its own step below rather than folded into
  the transport fix, because re-homing a concern changes when it observes.

## Reuse inventory — build almost nothing new

| Need | Reuse (do not rebuild) |
|---|---|
| Ratchet ("count may only shrink") | `src/scripts/_lib/gate_baseline.ts` → `checkRatchet()`, baseline `src/config/gate-violation-baselines.json`, `STALE_AFTER_DAYS = 56` |
| Dead-scope protection + `scanned: N` contract | `src/scripts/_lib/scan_scope.ts` → `reportScanned()` (one call satisfies both), `DeadScopeError` |
| Duplicate global+project rule load | **already exists**: `src/scripts/_lib/duplicate_scope_census.ts` → `censusDuplicateScope()` returns `shared_filenames[]` + `duplicate_chars` |
| Rule frontmatter parsing | `src/scripts/validate_frontmatter.ts` → `parse_frontmatter()`; roots via `_lib/agent_src.ts` → `SRC_RULES()` |
| Rule↔rule trigger overlap | **already exists**: `src/scripts/lint_trigger_collisions.ts` → `load_rules()`, `find_collisions()` |
| Gate template in house style | `src/scripts/lint_artefact_frontmatter.ts` (frontmatter + `assertScanned` + `checkRatchet` in one) |
| Token census | `src/scripts/preamble_byte_census.ts` → `censusRuleDir`, `censusClaudeMdHierarchy`; `_lib/token_count.ts` → `measure()` |
| Claims | `docs/CLAIMS.md` `### claim: <kebab-id>` + `<!-- claim:id -->` marker. **Note:** the draft's "CL:" convention does not exist in this repo. |

Constraints that bite: a new gate must be named `lint_*`/`check_*`/`audit_*`/
`skill_*`/`verify_*` or the meta-gates cannot see it; registering it is a
four-file change (`taskfiles/ci-fast.yml`, `ci:` in `Taskfile.yml`,
`src/config/ci-local-parity.yml`, `src/config/gate-coverage.yml`); and any gate
emitting `scanned:` **must** be registered in `gate-coverage.yml` or a test
fails the build.

## Phase 0 — Transport: make verdicts mean what they say

Mechanical bugs with one correct behaviour, so no deliberation. Ships with its
contract tests per council.

- [x] **P0.1 Per-host emission adapter.** New `src/scripts/hooks/host_semantics.ts`:
  the internal ladder (`0 allow · 1 block · 2 warn`) is translated to the host's
  native contract at the emission boundary. Claude: BLOCK → exit 2 + reason on
  **stderr** (block-capable events only); WARN → exit 0 +
  `hookSpecificOutput.additionalContext` on stdout; ALLOW → exit 0 silent. On
  events where exit 2 cannot block (`post_tool_use`, `session_start`), a block
  degrades to visible context instead of a silent no-op — this is the D3b fix.
  `_reduce()` is untouched and concerns need no rewrite. Platforms whose native
  contract is not documentation-verified keep the legacy pass-through
  byte-for-byte (`VERIFIED_PLATFORMS`), so this cannot change behaviour on an
  unmeasured host.
  - Acceptance: `tests/hooks/host_semantics.test.ts` — 21 assertions pinning
    both inversion directions, named after
    `memory/hook-warn-exits-2-reads-as-block.md`. **Green.**
- [x] **P0.2 Severity is declared, not inferred from prose.** Every one of the
  23 concerns in `hook_manifest.yaml` now carries `severity: advisory|blocking`;
  the dispatcher enforces a ceiling (`_is_advisory` + downgrade in the concern
  loop) so an advisory concern can never produce BLOCK on any host — including
  via the `fail_closed` crash-promotion path. Closes the gap where
  `design_slop_hook` said "FLAGS, NEVER A BLOCK" three times in prose while the
  transport denied the write.
  - Acceptance: `tests/hooks/concern_severity.test.ts` — every concern declares
    a severity; only the three real policy guards may be `blocking`;
    `fail_closed: true` implies `blocking`. **Green.**
- [ ] **P0.3 Honor `type: manual` in projection.** A `manual` rule is excluded
  from every projection regardless of projection mode. `brand-consistency` is
  the live violation.
  - Acceptance: projection census test — no `type: manual` slug in an emitted
    tree.
- [ ] **P0.4 De-duplicate the global+project rule load.** Same slug present in
  both scopes → load once. Wrap the existing `censusDuplicateScope()` in a
  `check_*` gate; do not write a new census.
  - Acceptance: gate reports `duplicate_chars == 0` for a single host;
    registered in `gate-coverage.yml` with a `min_scanned` floor.
- [ ] **P0.5 Re-home advisory concerns off `pre_tool_use`** (council Q1).
  `design-slop`, `code-graph-nudge`, `rtk-wrap` observe outcomes, not
  intentions; `post_tool_use` at exit 0 is the right slot and removes advisory
  latency from the critical path. Requires per-concern review — a concern that
  genuinely needs to see the *proposed* content may have to stay.
  - Acceptance: no `severity: advisory` concern wired to `pre_tool_use`, or a
    written per-concern exemption reason.

Exit criterion P0: a review/roadmap session including config diffs completes
with zero silent mechanical aborts, and both security guards demonstrably
refuse.

## Phase 1 — Scoping errors: make the good rules reachable

Not arbitration. Each item removes an *unsatisfiable* or *mis-scoped*
condition, per the council's reframe.

- [ ] **P1.1 `ui-audit-gate` becomes satisfiable or pack-scoped.** Two parts:
  (a) where no dispatcher state exists, the gate is satisfied by the observable
  action of running `skill:existing-ui-audit` first, and `ui-trivial` is
  decidable from the diff alone (≤1 file, ≤5 lines, no new component/state)
  without `directive_set`; (b) it ships only with the `frontend-design` pack.
  - Acceptance: scenario test — a UI write in a plain chat session has a
    reachable compliant path; default install (`rule_packs: []`) census shows
    no `ui-audit-gate`.
- [ ] **P1.2 `context-hygiene` read-loop gets a declared-protocol cap of 3**
  (not a suspension). "Non-bypassable" narrows to "no *silent* bypass".
  - Acceptance: scenario test reproducing this session's 8+ read turns.
- [ ] **P1.3 `token-efficiency` exempts enumerated file sets.** Reading N
  declared files (an override chain, a downstream-caller sweep) is one logical
  operation, not N repetitions.
  - Acceptance: scenario test — a 4-file override read is compliant.
- [ ] **P1.4 `ask-when-uncertain` × `no-cheap-questions` declared pair,**
  relation `narrows`: ask only when context does not answer **and** proceeding
  wrong is destructive or expensive. One question per turn stands.
- [ ] **P1.5 `no-cheap-questions` IL4 × `user-interrupt-priority` declared
  pair** — a second undocumented **kernel-level** contradiction, found by the
  P2.2 generator: `no-cheap-questions.md:27` says "STANDING AUTONOMOUS MANDATE
  ACTIVE → NEVER ASK 'WEITER? / SHALL I CONTINUE?'", while
  `user-interrupt-priority.md:32` mandates "THEN ASK BEFORE RESUMING THE OLD
  TASK" and states it "Holds regardless of `personal.autonomy`". Verified: the
  halt list in `cheap-question-mechanics.md:33-41` does **not** carve out
  resume-after-interrupt, and the two rules contain **zero** cross-references to
  each other. Under an autonomous mandate the agent is simultaneously required
  and forbidden to ask before resuming.
  - Acceptance: declared pair with a relation; the resume-after-interrupt ask is
    added to the halt list or explicitly excluded in one of the two rules.
- [ ] **P1.6 Mis-scoping sweep.** The council's open question: how many other
  rules are labelled general but are context-specific? Enumerate; do not fix
  in this phase.

## Phase 2 — One-time conflict audit (measured: audit, NOT a CI gate)

Feasibility was measured before design (2026-08-05, scripts re-runnable). The
measurement changed this phase substantially — record it so the gate idea does
not rot back in.

- [x] **P2.1 Absoluta census — done, and it refutes the input number.** Lexicon
  extractor over all 111 rule bodies (frontmatter excluded): **97 rules (87.4%)
  carry ≥1 absolute**, not 17. 592 occurrences — `NEVER` 289 (86 rules), `STOP`
  81, `MUST` 69, `refuse*` 50, `ALWAYS` 49, `FORBIDDEN` 23, `Hard Floor` 17,
  `no exceptions` 6, `abort*` 6, `non-bypassable` 2. 76 rules carry an ALL-CAPS
  absolute; 59 have one inside a fenced Iron-Law block. The 14 rules with zero
  absolutes are **all** migrated pointer stubs, so the real figure is 97/97
  non-stub rules. **The "17" in the source draft was wrong by 5.7×** — it came
  from a narrow lexicon (STOP/abort/non-bypassable only). Any gate sized for 17
  was sized for the wrong corpus.
- [x] **P2.2 Candidate generator — built, measured, and it needs a 5th axis.**
  The 4 proposed classes cannot detect the `token-efficiency` ↔
  `downstream-changes` conflict at all: ">2 same tool in a row" is an *effort
  cap* and "find ALL callers" is *coverage*, so a fifth **EFFORT** axis
  (BUDGET 9 / EXHAUST 7) was required. Pole census: act↔read (ACT 3 / READ 9),
  ask↔don't-ask (ASK 18 / NOASK 6), broaden↔narrow (BROAD 8 / NARROW 7),
  absolute↔absolute (FINAL 20).
- [-] **P2.3 Coverage ratchet as a CI gate — CANCELLED on measurement.** Its
  own precondition ("only if precision justifies a gate") was tested and
  **failed**:
  - Trigger overlap cannot serve as the co-fire predicate: 627 distinct trigger
    keys, only 33 shared by ≥2 rules, so just **65 of 6,105 pairs (1.06%)**
    share a key. The 9 kernel rules declare no triggers and load every turn,
    contributing 954 pairs by construction.
  - **The ranking signal is anti-correlated with truth.** Of 4 confirmed real
    conflicts, 0/4 share a trigger and 0/4 are cross-referenced; among false
    positives 4/10 *are* cross-referenced. In this corpus a cross-reference
    means the interaction is already documented, i.e. resolved — so every
    filter that tightens on co-fire strength removes true positives faster than
    false ones. `co-fire = shared trigger` gives 4 candidates at **0/4 recall**.
  - The only 4/4-recall operating point yields **227 candidates at 67% false
    positives**, stable across two independent hand-labelled samples (5/15 and
    5/15). Three precision rescues were attempted (object-overlap, synonym map,
    specific-object veto); the best killed 59% of candidates but dropped recall
    to 3/4.
  - The noise is **structural, not tuning**: 19% of Iron Laws carry no subject
    token, and `preservation-guard` *mandates* that style ("Telegraph style is
    encouraged … terse cave-speak"). It cannot be linted away.
  - Shipping it would mean ~150 suppressions on a 227-finding gate — the
    "allowlist > 20 entries = the linter is wrong" shape from
    `autonomous-execution`, and a third instance of
    `memory/gates-that-scan-nothing-exit-green` /
    `shape-gates-over-frozen-corpora-only-block`.
- [ ] **P2.4 Run the generator ONCE as an offline audit.** 227 pairs ≈ 2–3 h of
  human adjudication. Every candidate gets a disposition: rewrite, exclude,
  pack-scope, or `no-conflict` with a reason. Not wired to CI.
  - Acceptance: every one of the 227 carries a written disposition.
- [ ] **P2.5 The one defensible mechanical gate — authority, not opposition.**
  Assert that every pair of rules *both* claiming non-bypassable authority over
  a shared trigger surface has an entry in `agent-authority`'s precedence
  table. Deterministic, no object-resolution problem, **3 candidates** at the
  measured operating point. This is the narrow half worth automating.
  - Acceptance: gate named `check_*`, uses `reportScanned()`, registered in all
    four CI surfaces; 3 candidates triaged.

## Phase 3 — Human-gated: selection and measurement

Nothing here is an agent decision. Each item is prepared with evidence and
stops.

- [~] **P3.1 Default `discipline_profile` flip.** Deferred: a default flip
  changes what every consumer receives and is an explicit human release gate in
  this repo (the `rule_workspaces` precedent, maintainer-approved and
  evidence-gated). Council additionally requires P0+P1+P2 green first. Prepare
  the diff and the evidence; do not merge the flip.
- [~] **P3.2 `essential-plus` preset.** Deferred with P3.1. If it lands it MUST
  include `agent-authority` — the current whitelist excludes the only arbiter
  while loading conflicting absolutes.
- [~] **P3.3 A/B bench: zero vs essential-plus.** Deferred: needs the bench
  harness and spend authorization. Pre-registered before any run —
  non-inferiority Δ ≥ −0.05 at ≤ 1.4× tokens. Explicitly **not** `full` vs
  `essential` (already measured, p=0.37).
- [~] **P3.4 `thin` projection viability.** Deferred to the existing
  `road-to-thin-flip-under-anchor-scoring.md`; do not fork it here. Council
  flagged it as the only plausible path to restoring delegation (D5) — if thin
  cannot restore subagent spawning for a validated set, the rule-count ceiling
  is a hard architectural cap and that decision needs a real multi-provider
  council, not subagents.

## Blockers

### blocker: default-flip-release-gate
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3
- **What to do:** P3.1/P3.2 change what every consumer install receives.
  This repo already treats a projection-default flip as a human release gate
  (the `rule_workspaces` precedent: maintainer-approved, evidence-gated,
  "do not set this from automation"). The agent prepares the diff, the census
  numbers, and the delta-to-`essential`; a human decides whether it ships.
- **Resolved when:** the maintainer either merges the flip with the census
  evidence attached, or records a decision to keep the current default and
  ship `essential-plus` as opt-in only.

### blocker: bench-spend-and-methodology
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3
- **What to do:** P3.3 (zero vs essential-plus) needs an A/B run on the
  existing harness. Both cost and methodology are a maintainer call — the
  council was explicit that an LLM-judged 10-scenario probe has no power
  against the original human-judged production measurement, so a real claim
  needs human judging at adequate N.
- **Resolved when:** thresholds are pre-registered in this file and the run is
  authorized, or P3.3 is cancelled and the preset ships documentation-only with
  no lift language.

### blocker: design-slop-enabled-on-reporting-install
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 0
- **What to do:** check whether the reporting dev has
  `hooks.design_slop.enabled: true` in their `.agent-settings.yml`. The hook is
  default-OFF, so it is inert in this repo — but if they enabled it, their
  "UI rules get discarded" was primarily the D3 transport inversion (every UI
  write to `.tsx/.vue/.css/.scss/.astro` silently denied with no stderr) rather
  than prose conflict. One-line check; it re-prioritizes their report, not this
  roadmap.
- **Resolved when:** the setting is confirmed either way and the finding is
  recorded against D3 or against the prose-conflict class.

## Explicitly parked

- Full 6,105-pair matrix — rejected, O(n²) declaration debt with no detection
  power over the candidate generator.
- Rule deletion by taste — pruning only via measured degradation or a named
  terminal-modality conflict.
- A second precedence concept — `rule.schema.json` already has one.

## Claims to open (only once backed)

- `advisory-hook-cannot-block` — no advisory concern can produce BLOCK on any
  host (P0.2, test-gated).
- `manual-rule-not-projected` — no `type: manual` rule reaches a projection
  (P0.3).
- `no-duplicate-rule-load` — no rule body loaded twice for one host (P0.4).
