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
> Council round 2 (same members, 2026-08-06, $0.07) settled the implementation
> decisions and **reversed two round-1 calls** — the read-loop cap direction and
> the advisory re-homing. Reversals are marked inline below rather than edited
> away, so the reasoning that changed stays visible.

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
  counter reopens the exact token sink the abort closes. ~~Cap declared
  protocols at **3 reads** — stricter than the general abort, not looser~~ —
  **REVERSED in round 2 (2026-08-06), both members.** Stricter-for-declared is
  backwards: a declared analysis protocol is exactly the case that legitimately
  needs *more* reads. Shipped as declared → **8**, undeclared unchanged at
  3-warn/5-abort, with a structured declaration (falsifiable goal + expected
  count + output shape) as the anti-gaming guard. The no-suspension half
  stands.
- **Contract tests are critical safety, not deferrable.** P0 remaps exit codes
  for two currently-broken security guards; the remap cannot ship without tests
  proving it.
- ~~**Advisory concerns should leave `pre_tool_use`**~~ — **REVERSED in round 2
  (2026-08-06)** on a criterion round 1 did not have: **ephemeral intention vs
  durable outcome**. All three candidates observe an intention that no longer
  exists after the call (`design-slop` reads the *proposed* content out of
  `tool_input`; `code-graph-nudge` observes the query-strategy choice;
  `rtk-wrap` wraps a command string), so `pre_tool_use` is correct for all
  three. The harm — an advisory concern *blocking* — was already removed by
  P0.2's severity ceiling. See P0.5, cancelled.

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
- [x] **P0.3 Honor `type: manual` in projection.** The schema is unambiguous:
  `manual` = "no auto-injection (zero workspace-budget cost); file remains as a
  reference document linkable". `compile_router` already honoured half of that
  (no `dist/router.json` entry) — the per-tool projection did not, symlinking
  manual rules into `.claude/rules/` and emitting `.mdc`/windsurf copies, so
  under `eager-all` their bodies shipped every session. Fixed in all three
  generators (`generate_rule_symlinks`, `generate_cursor_mdc_rules`,
  `generate_windsurf_modern_rules`) via one shared `_is_manual_rule` predicate;
  the files stay in `dist/agent-src/rules/` so inbound cross-references still
  resolve, and only the link text remains in the aggregates.
  **Measured: 5 rules, 5,188 chars (~1,297 GPT tok) removed per tool tree per
  session** — `analysis-skill-routing`, `brand-consistency`, `guidelines`,
  `package-ci-checks`, `size-enforcement`.
  - Acceptance: `tests/scripts/manual_rule_projection.test.ts` — 6 assertions
    across all three trees, plus the inverse (every manual rule still linkable
    in dist, so the obvious wrong repair is blocked). **Green.**
- [x] **P0.4 De-duplicate the global+project rule load — already built; the
  proposed CI gate is deliberately NOT built.** Investigation found every layer
  already present: the **mechanism** (`projection.scope_dedup`, with
  `_dedupable_rules()` wired into `generate_rule_symlinks`), the
  **measurement** (`_lib/duplicate_scope_census.censusDuplicateScope`, unit-
  tested — 4 assertions green), and **two surfaces** consuming it
  (`cache_realization_report` and the `doctor` `duplicate-scope-rules` health
  check, which emits `{status, message, remedy}`). Re-verified live on this
  machine: **109 shared basenames** between `~/.claude/rules` and
  `dist/agent-src/rules`.
  - **The acceptance criterion as written would have produced a false green.**
    A CI gate asserting `duplicate_chars == 0` cannot work: CI has no
    user-global rules directory, so the census returns `evaluable: false` and
    the gate scans nothing while exiting green. That is exactly the
    `gates-that-scan-nothing-exit-green` class this repo has been burned by
    three times, and building it would have been the fourth. The duplicate is
    a property of a *local install*, so a local diagnostic is the right
    surface — and it already exists.
  - **Human-gated:** `projection.scope_dedup` defaults to `false`. Flipping it
    changes what a consumer install projects, so it belongs with P3.1 under the
    default-flip blocker, not to an agent.
- [-] **P0.5 Re-home advisory concerns off `pre_tool_use` — CANCELLED on the
  council's own criterion (round 2, Q1).** The step's premise was backwards:
  it asserted these concerns "observe outcomes, not intentions". The reverse is
  true, and that is the criterion — **ephemeral intention vs durable outcome**:
  - `design-slop` scans the **proposed** UI content out of `tool_input`. After
    the write that payload is gone; a post-hook would have to re-read the file,
    which is a different artefact.
  - `code-graph-nudge` observes the **query-strategy choice** — once the grep
    has run the intention no longer exists to redirect.
  - `rtk-wrap` wraps a **command string** — wrapping it after execution is
    meaningless.
  All three observe intentions, so `pre_tool_use` is the correct slot for all
  three. The harm this step existed to remove — an advisory concern *blocking* —
  was already removed by P0.2's severity ceiling, which is why the remaining
  latency argument (the one member who favoured moving two of them) does not
  carry: an advisory concern now exits 0. Both members agreed `code-graph-nudge`
  stays; the split on the other two is resolved by the criterion above.
  - Verified: the three concerns are `severity: advisory`, so
    `tests/hooks/concern_severity.test.ts` already guarantees none can block
    from `pre_tool_use`. No wiring change ships.

Exit criterion P0: a review/roadmap session including config diffs completes
with zero silent mechanical aborts, and both security guards demonstrably
refuse.

## Phase 1 — Scoping errors: make the good rules reachable

Not arbitration. Each item removes an *unsatisfiable* or *mis-scoped*
condition, per the council's reframe.

- [x] **P1.1 `ui-audit-gate` becomes satisfiable — half (a) dropped on council
  advice, half (b) is human-gated.** Shipped: `ui-trivial` is now decidable
  **from the diff alone** (≤1 file, ≤5 lines, no new component/state);
  `directive_set` is reframed as the dispatcher's way of *stating* those same
  facts rather than an extra requirement, which is what made the escape hatch
  dispatcher-only. A gate whose only compliant path is inaction is not a gate.
  - **Dropped, per council round 2 Q2 (both members):** "satisfy it by having
    run `skill:existing-ui-audit`" — that is self-report, and self-report is
    not enforcement. Shipping it would have made the gate theatre. Instead the
    rule now states its honest scope: outside the work engine the audit
    obligation is model-carried (`enforced_by: none`), same stance as
    `security-sensitive-stop` and `untrusted-input-defense`.
  - **Human-gated:** pack-scoping (ship only with `frontend-design`) needs
    `projection.rule_packs: auto`, and the template says of that key **"Do not
    set this from automation."** Recorded under the default-flip blocker.
- [x] **P1.2 `context-hygiene` declared-protocol cap — INVERTED after round 2.**
  Round 1 said cap declared protocols at **3**, stricter than the undeclared
  5-abort. Round 2 (both members) called that backwards and they are right: a
  declared analysis protocol is precisely the case that legitimately needs
  *more* reads — this roadmap's own evidence sweep ran 8+ read turns and was
  the protocol working, not a loop. Shipped: undeclared keeps 3-warn/5-abort; a
  **declared protocol raises the abort to 8** and never suspends the counter.
  - Anti-gaming, per both members: a declaration is valid only if it states, up
    front, a falsifiable goal + an expected read count + the output shape.
    Free-text intent buys nothing, and exceeding the declared count by more
    than 2 is itself the violation.
  - "Non-bypassable" narrows to **no *silent* bypass** — a declared protocol is
    not silent.
- [x] **P1.3 `token-efficiency` exempts enumerated file sets.** The same-tool
  ceiling now counts *repetition without new information*, which is what it was
  always for. Reading N **enumerated** files — an override chain, a
  downstream-caller sweep, the members of a grep result, a declared read
  protocol — is one logical operation: the set was known before the first call
  and every read returns different content. Counting it as N repetitions put
  the rule in direct conflict with `downstream-changes` ("find **ALL**
  callers"), which cannot be satisfied in two calls.
  - The discriminator shipped as **"did the previous call change what I know"**,
    not the tool name. Still caught: re-reading the same file hoping for a
    different answer, re-running a failing command unchanged, widening a grep
    one word at a time.
  - The Iron Law fenced block is untouched (per `preservation-guard`); the
    carve-out is a sibling section.
- [x] **P1.4 `ask-when-uncertain` × `no-cheap-questions` declared pair.**
  Landed as `ask-x-no-cheap-questions`, relation `narrows`, in
  `docs/contracts/rule-interactions.yml` — **no kernel rule body was touched**,
  so the one-kernel-rule-per-PR soak gate never fires. Composed test: ask iff
  context does not answer it **and** proceeding on the wrong branch is
  destructive or expensive; on genuine disagreement `ask-when-uncertain` wins,
  because a suppressed real question costs more than one extra turn. One
  question per turn stands.
- [x] **P1.5 `no-cheap-questions` IL4 × `user-interrupt-priority` declared
  pair** — a second undocumented **kernel-level** contradiction, found by the
  P2.2 generator: `no-cheap-questions.md:27` says "STANDING AUTONOMOUS MANDATE
  ACTIVE → NEVER ASK 'WEITER? / SHALL I CONTINUE?'", while
  `user-interrupt-priority.md:32` mandates "THEN ASK BEFORE RESUMING THE OLD
  TASK" and states it "Holds regardless of `personal.autonomy`". Verified: the
  halt list in `cheap-question-mechanics.md:33-41` does **not** carve out
  resume-after-interrupt, and the two rules contain **zero** cross-references to
  each other. Under an autonomous mandate the agent is simultaneously required
  and forbidden to ask before resuming.
  - **Both** halves shipped: the pair `interrupt-x-no-cheap-questions`
    (relation `overrides` — the resume ask survives the mandate) **and** the
    halt-list fix, adding resume-after-interrupt as Iron Law 4's sixth halt
    condition in `contexts/execution/cheap-question-mechanics.md`. The
    distinction that resolves it: IL 4 suppresses a *continuation prompt*
    (asking permission to keep doing already-authorized work); the resume ask
    is a *task-boundary decision the user created by interrupting*, and the
    agent cannot answer it from context because the interrupt is the only
    evidence of their current priority.
- [x] **P1.6 Mis-scoping sweep — enumerated, with a falsifiable test.** The
  council (round 2, Q5) refused to accept this step without a discriminator, so
  one was derived first. A rule is **mis-scoped-as-general** iff all four hold:
  (1) broad activation — its triggers fire in an ordinary chat session;
  (2) narrow-only satisfaction — its obligation names a field whose *producer*
  exists in exactly one pipeline; (3) no general fallback branch; (4) it
  therefore forces a degenerate universal action rather than merely staying
  silent.
  **Result: `ui-audit-gate` is the only true hit** — already fixed by P1.1.
  Not padded: every other rule either self-gates on a generally-readable
  settings key with an explicit inert path, or stays behaviourally harmless
  outside its domain. Two of the four candidate signals were discarded as
  non-discriminating — notably "declares `packs:`", since **111 of 111 rules
  do**.
  Secondary class (self-claimed pack activation contradicted by the shipped
  `rule_packs: []` default): `finance-safety-floor`, `legal-safety-floor`,
  `strategy-safety-floor` — 3 rules, fix class `pack-scope`, therefore
  human-gated with P3.1. `history-discipline` / `scale-discipline` match the
  pattern but are correct as-shipped (their packs are engineering-workspace
  packs; the settings template defends this).
  Bonus verification: `rule_packs: auto` drops **exactly the 8 rules** the
  template names — claim exact. Its token figure measures 8,308 today vs the
  archived 8,110 (~3% drift, directionally verified, not stale).

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
- [x] **P2.4 Offline audit run once — every candidate dispositioned.** Report
  committed at
  [`agents/evidence/analysis/rule-conflict-audit-2026-08-06.md`](../evidence/analysis/rule-conflict-audit-2026-08-06.md).
  **192 unique candidates** (from 211 raw axis hits across the 5 axes, deduped
  — fewer than the 227 estimate because the generator deduped pairs nominated
  by more than one axis):
  `real-conflict` **12** · `already-declared` **43** ·
  `no-conflict-different-object` **89** (46%, the predicted dominant false
  positive) · `no-conflict-other` **48**.
  All three known conflicts were detected. Two are `real-conflict`; the third
  (`ask-when-uncertain` × `no-cheap-questions`) came back **already-declared**
  because `no-cheap-questions` self-resolves in its own body — a useful
  correction to this roadmap's own framing, which had called it flatly
  contradictory. It is now declared explicitly anyway (P1.4).
  **Acted on in this run — 3 of the 12:**
  - #1 `commit-policy` × `secret-vcs-guard` — independently confirmed the pair
    P2.5 derived from the authority census; declared.
  - #3 `context-hygiene` × `downstream-changes` — the audit caught that P1.3
    was **incomplete**: `context-hygiene`'s Tool Loop Detection carries the
    same ">2 same tool" ceiling as `token-efficiency`, and only the latter got
    the enumerated-set carve-out. Same defect, second location; now fixed in
    both.
  - #8/#10 the **reply-position class** the roadmap had missed entirely — four
    rules contesting the reply's literal first or last line. Two declared:
    `fast-path-marker-x-session-canary` (first line) and
    `direct-answers-x-role-mode-adherence` (last line).
  **Remaining 9 real-conflicts are follow-up**, not silently dropped: #2/#12
  are the same reply-position root cause as #8/#10, and #4–#7 are all
  `context-hygiene`'s read-loop against a mandated multi-read protocol —
  materially reduced by P1.2's declared-protocol cap of 8, so they should be
  re-adjudicated against the new text before any further rewrite.
  - Matrix across this roadmap: 9 rules / 14 pairs → **17 / 21**.
- [x] **P2.5 Authority conflicts — the 3 candidates fixed; the gate deliberately
  NOT built.** Council round 2 (Q4, both members) rejected a permanent CI gate
  for a 3-finding corpus: it would be a frozen-corpus gate that can only ever
  block, in a repo already burned by that shape. One member proposed a
  PR-only variant, which this repo has no mechanism for — everything runs in
  CI — so building one would be the sprawl both warned against.
  **Measured:** 11 rules claim non-bypassable authority; `agent-authority`
  arbitrates 6. Of the unarbitrated claimants, `delegation-policy` and
  `low-impact-corpus-privacy-floor` already defer explicitly in prose, leaving
  exactly 3 genuine collisions — all now declared:
  - `ndd-x-engineering-safety-floor` (`restates`) — two rules opened with the
    identical sentence "HARD FLOOR OVERRIDES EVERYTHING" over the same
    deploy/prod-trunk surface, with no stated order.
  - `context-hygiene-x-autonomous-execution` (`gates`) — the read-loop abort
    declares itself unliftable by a mandate; the mandate says keep going.
  - `secret-guard-x-commit-policy` (`gates`) — one rule forbids the commit
    question, the other mandates one on a credential match.
  - Matrix: 9 rules / 14 pairs → **14 / 19** across this roadmap.
  - **Revisit-if:** a new rule PR introduces a fourth unarbitrated authority
    claimant. That is the trigger to reconsider automation — not a count.

## Phase 3 — Human-gated: selection and measurement

Nothing here is an agent decision. Each item is prepared with evidence and
stops.

- [-] **CARRIED to `road-to-rule-coherence-followup.md`** (Iron Law 3 resolution, option 2 — spawn follow-up as ready with a blocked-until note). Not dropped: the plan moves whole, with its blockers and owner intact.
- [-] **P3.1 Default `discipline_profile` flip.** Deferred: a default flip
  changes what every consumer receives and is an explicit human release gate in
  this repo (the `rule_workspaces` precedent, maintainer-approved and
  evidence-gated). Council additionally requires P0+P1+P2 green first. Prepare
  the diff and the evidence; do not merge the flip.
- [-] **P3.2 `essential-plus` preset.** Deferred with P3.1. If it lands it MUST
  include `agent-authority` — the current whitelist excludes the only arbiter
  while loading conflicting absolutes.
- [-] **P3.3 A/B bench: zero vs essential-plus.** Deferred: needs the bench
  harness and spend authorization. Pre-registered before any run —
  non-inferiority Δ ≥ −0.05 at ≤ 1.4× tokens. Explicitly **not** `full` vs
  `essential` (already measured, p=0.37).
- [-] **P3.4 `thin` projection viability.** Deferred to the existing
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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Dormant guards wake up | implementation | `block-no-verify` and `block-kernel-rule-writes` were INERT on Claude Code (exit 1 = non-blocking). P0.1 makes them actually refuse, so work that silently passed for the whole life of the Claude integration now gets blocked — a behaviour change that will read as a new bug | The two guards enforce documented policy that was always meant to hold, so waking them is the fix, not a regression; both print their reason on stderr now, so a refusal is legible instead of silent. Call it out in the PR body and watch the first sessions after merge | Phase 0 — Transport: make verdicts mean what they say |
| 2 | A blocking concern mis-declared advisory | implementation | The P0.2 ceiling silently downgrades BLOCK→WARN for anything marked `advisory`. One wrong manifest entry turns a real guard into a no-op — the same silent-inert failure this roadmap exists to remove, just relocated | `concern_severity.test.ts` pins the blocking set to an explicit three-name allowlist and asserts `fail_closed: true` implies `blocking`, so a downgrade cannot land unnoticed; the downgrade also writes to stderr | Phase 0 — Transport: make verdicts mean what they say |
| 3 | Measured evidence used to skip the human gate | product | The p=0.37 finding and the census numbers make the default flip look obvious, which is exactly the pressure that turns a maintainer release gate into an agent decision | P3.1/P3.2 are `[~]` deferred with a named blocker and owner; the roadmap's Iron Law states the flip is never an agent decision; agent prepares evidence only | Phase 3 — Human-gated: selection and measurement |
| 4 | The 227-pair audit never happens | product | P2.4 is 2–3 h of human adjudication with no CI backstop by design. Unowned manual work rots, and the conflicts stay live while the roadmap reads as progressing | Two of the four known conflicts are already promoted to their own Phase-1 items (P1.4, P1.5) so the highest-value findings do not depend on the audit completing; P2.5 automates the one narrow half that is deterministic | Phase 2 — One-time conflict audit (measured: audit, NOT a CI gate) |
| 5 | Host contract drifts underneath the mapping | implementation | The Claude Code exit-code contract is an external dependency read from docs on 2026-08-05; a host change silently re-inverts the mapping | `host_semantics.ts` isolates the whole mapping in one module with the doc quotes inline, and 21 assertions fail loudly if behaviour is changed; unverified hosts pass through rather than guessing | Phase 0 — Transport: make verdicts mean what they say |
| 6 | Re-homing advisory concerns changes what they can see | implementation | P0.5 moves advisory concerns to `post_tool_use`, where they observe the result instead of the proposal — a concern that genuinely needs the pre-write content would be quietly weakened | P0.5 requires a per-concern review and permits a written exemption to stay on `pre_tool_use`; the severity ceiling already removed the harm that motivated the move | Phase 0 — Transport: make verdicts mean what they say |

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
