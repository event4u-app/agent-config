---
complexity: structural
status: ready
---

# Road to inbox harvest 2026-08

> Twelve inbox artifacts triaged against the tree at `bb8360bfa`. The headline
> is not what survived — it is how little did: **roughly 60–80% of every
> substantive file is already built, already planned, or forbidden by a lock the
> file never read.** Two files are worth roadmap items, three were fixable in
> one commit, three are spent artifacts, and two are parked behind gates that
> already exist.

> Source (consumed inbox): see the per-item `Source:` lines below; each names
> its file under [`agents/tmp.old/`](../../tmp.old/).
> Produced by [`/analyze:inbox`](../../../src/domains/analysis-workbench/analyze/inbox/command.md),
> which this harvest also created.

## Iron Law of this harvest

```
AN INBOX FILE IS A CLAIM, NOT A FACT.
"ALREADY FIXED" AND "FORBIDDEN BY A LOCK" ARE THE MOST VALUABLE FINDINGS —
THEY PREVENT THE WHOLE ITEM. NEVER PLAN WORK OFF AN UNVERIFIED SNAPSHOT.
```

## Triage result

| Source | Genre | Disposition | Why |
|---|---|---|---|
| `feedback-9.18.1-1.txt` | 6 external release reviews | **roadmap (small)** | ~60% already built or planned; its most-repeated ask is struck by ADR-216 |
| `loops-feature.txt` | drafted 5-phase roadmap | **roadmap** | Real gap verified in code; ~90% drafted |
| `optimize-plan.txt` | drafted roadmap | **roadmap (Phase 1 only)** | Closes two named residuals; rest unproven |
| `better-handoff.txt` | competitor read | **DONE this PR** | Contradicted our own honest-null doctrine |
| `honest-critic-2.txt` | consumer-boundary audit | **DONE this PR** | Broken flag in the flagship install example |
| `cross-artifact-contradictions.txt` | PR #1150 review | **extend-existing** | 2 one-liners in one linter; unverified, see P3 |
| `claude-design.txt` | chat transcript, 4 draft versions | **3 small items only** | ~80% shipped; 2 named deps never existed; rest lock-forbidden |
| `council-q-renewal-foundation-p1.md` | consumed council question | **spent — user deletes** | Shipped verbatim; roadmap archived |
| `council-q-always-budget-reveal.md` | consumed council question | **spent — user deletes** | Option B shipped verbatim |
| `bench-local/` | bench ground truth + raw output | **spent — user deletes** | Null published, report committed, roadmap archived |
| `packages-1.txt` | 40 bare GitHub URLs | **park** | A 41-repo harvest exceeds maintainer capacity (ADR-216 § D3), and naming 40 sources in a tracked file runs against `source-confidentiality`. Correction (2026-08-10): the gate-enforced cap is **family-scoped** — `lint_roadmap_family_cap.ts` reads `FAMILY_PREFIX = 'road-to-skill-ecosystem-'` at occupancy 1 of 2 — so no slot was occupied and none is gate-enforced for a harvest under any other name |
| `memory-mcp/` | complete unfiled roadmap pkg | **park** | Builds on the code-graph engine whose claim is a published null |

The four large chat-log audits (`better-video.txt`, `hermes.txt`,
`better-frontend.txt`, `crytical-analysis.txt`) are triaged in P5 — one narrow
roadmap slice each, and a block of cancellations where they argue against locks.

## Phase 1 — The release-review harvest (from `feedback-9.18.1-1.txt`)

Source: `agents/tmp.old/feedback-9.18.1-1.txt`. Six reviewers, one convergent
ask, and a large already-built fraction.

- [-] **P1.1 MIGRATED 2026-08-14 → [`road-to-inbox-harvest-residuals.md`](../road-to-inbox-harvest-residuals.md) R1.** Schema half shipped here; the rendering half moved with its full reasoning (the § 2.7 corpus-migration prohibition, and the Draft-07-subset trap that makes the schema look wrong). Not done, not abandoned. **JSON as the binding R1/R2 findings format — schema SHIPPED, the rendering half deferred with its reason.** The only item all six
  reviewers converge on and the only one still fully unbuilt:
  `check_completion_review.ts` parses `*.findings.md`, with `unbalanced-fence`
  and `malformed-row` as first-class violation kinds — i.e. it hand-parses
  Markdown and has defect classes *for its own parser*. **Reuse, do not invent:**
  a JSON findings shape already exists on the other track
  (`self_review_gate.ts` `{schema_version, findings[]}` with a stable sha256
  `findingId()`, plus the `check_finding_dispositions` ledger). One format, not
  a second one.
  - Acceptance: `src/scripts/schemas/review-findings.schema.json` exists and
    both tracks validate against it; Markdown becomes a rendering of the JSON.
  - **Shipped: `src/scripts/schemas/review-findings.schema.json`**, and it is the
    shape that already existed — `self_review_gate`'s `{schema_version,
    findings[]}` with the sha256 `findingId()`, plus the release-findings ledger.
    Not a second format, which was the whole point of the reviewers' complaint.
    Both tracks' REAL artefacts are asserted against it: every committed ledger
    under `agents/evidence/release-findings/`, and the exact emission shape
    `--findings-out` writes (reproduced from the producer, not hand-written).
  - **A measured trap, and the reason the schema is written the way it looks
    wrong.** The repo has no `ajv`; validation goes through its own Draft-07
    **subset** (`validate_frontmatter.ts`), which enforces `enum` at top level and
    under `items` but **silently ignores `$ref` and `const`**. Probed all four
    combinations before committing. So the item shape is INLINED and the version
    pin is a one-member `enum`: written the obvious way — `const: 1` plus a
    `$ref`-ed definition — this schema would have validated **nothing at all**,
    which is exactly the gate-that-scans-nothing class this package keeps finding.
    Two tests pin the spellings so a "tidy-up" cannot silently disarm it.
  - **Deferred, with the reason: "Markdown becomes a rendering of the JSON".**
    That clause requires the R2 dispatcher to emit JSON and render Markdown, and
    the gate to parse JSON — i.e. re-formatting every committed artefact under
    `agents/evidence/reviews/`. § 2.7 of the contract forbids editing a round
    record in place, so the clause as written demands the corpus migration the
    contract prohibits. It is also not what the reviewers asked for: their
    complaint was TWO incompatible findings shapes, and one schema both tracks
    validate against answers it. Reopen only with a migration story for the
    committed corpus.
  - Also recorded while grounding this: `check_completion_review` carries a
    documented parser hole of its own (a labelled fence closed by a later bare
    fence swallows a live `open` row and emits no `unbalanced-fence`). It is
    already named in-source at `check_completion_review.ts:423-438` and is a
    separate defect from this step's format question — not silently folded in.
- [-] **P1.2 CANCELLED — the premise does not exist.** Six findings, measured
  against the tree before any adapter was written; AI council 2/2 (option A1).
  1. There is **no classifier** at `work_engine/scoring/decision_engine.ts` —
     that file is a *consumer* of `risk_class`. The producer is
     `derive_risk_class` in `work_engine/scoring/decision_trace.ts:82-103`.
  2. That producer returns `low` when its input is falsy or non-iterable and
     `medium` when it is an iterable with `count > 0`. **It never returns
     `high`.** Operationally it answers "are there any changes at all".
  3. `risk_class` lives entirely inside the *consumer-installed work-engine
     template* namespace. **Zero** of the six plan-gate scripts reference it
     (`lint_plan_risk_register`, `check_completion_review`,
     `dispatch_r2_reviewer`, `check_review_dispositions`,
     `check_finding_dispositions`, `self_review_gate`).
  4. `docs/contracts/plan-review-gates.md` has **no** risk-routing or
     adaptive-ceremony section — there is nothing to extend. The applicability
     escape that does exist is the § 2.4 skip declaration, and it is binary
     (code / no-code), not graded.
  5. **P4.3 in this same roadmap already cancelled risk routing** as "unproven,
     and the direction-asymmetry evidence behind them is not verifiable here".
  6. So the only available build was an adapter mapping a two-valued producer —
     effectively "the diff is non-empty" — onto the gates. The council named that
     directly: it would create the *illusion* of adaptive ceremony while
     delivering none of it, which is worse than nothing.
  - The adaptive-ceremony complaint stays real and stays unaddressed. What it
    needs is a graded classifier the plan gates own, which is a new subsystem —
    explicitly what this step said it was not.
  - **Original step text**, kept verbatim so the cancellation is auditable
    against the claim it refutes: *"The adaptive-ceremony complaint ('too much
    ceremony for a one-file change') is real, and the classifier already exists
    at `work_engine/scoring/decision_engine.ts` — it is simply not connected to
    `planning.risk_review` / `completion_review`. An adapter, not a subsystem,
    and explicitly not a new `plan:doctor` command: the CLI budget has zero
    headroom."*
- [x] **P1.3 Ratchet `gate_self_test` adoption.** It exists with 4 adopters
  against 27 registered gates. Add adoption as a column in `gate-coverage.yml`
  and ratchet it. No new gate — a column on the existing one.
  - **Shipped as the inverse, and the step's own numbers were stale.** Measured
    at HEAD: **8 adopters, 31 registered** (the 4/27 figure was correct on
    2026-08-05 and the manifest has grown since). Of the 31 rows registered
    *enforced with a floor*, **7 adopt and 24 do not**.
  - **Departure — a column ratcheted upward is the shape this file already
    rejects.** `check_gate_coverage.ts` § `report_hardening_ratchet` states it
    verbatim: a coverage-percentage ratchet "tracks how far the fix has spread
    and can never regress, so it grades the solution instead of the problem".
    So adoption ships as a **shrink-only NON-adopter count** —
    `gate-self-test:registered-non-adopters`, baseline 24, target 0, and it CAN
    rise when a new registered gate lands without a self-test. Same shape as the
    sibling adoption ratchet (`check_gate_completeness`, baseline 217), and the
    56-day non-stagnation clause applies unchanged.
  - "No new gate" is honoured: the counter lives in `check_gate_coverage.ts`
    beside the hardening ratchet, deriving adoption from the source
    (`_lib/gate_self_test.js` import, or `// self-test-exempt: <reason>`) rather
    than from a hand-maintained column that could drift from it.
- [-] **P1.4 MIGRATED 2026-08-14 → [`road-to-inbox-harvest-residuals.md`](../road-to-inbox-harvest-residuals.md) R2**, together with its `deferred-finding-decision-reopen` blocker. Not done, not abandoned. **Deferred-finding owner + expiry.** Deferred. The stable-id index
  this needs was **explicitly declined** with a named revisit trigger at
  `check_review_dispositions.ts:16-22`, so this reopens a recorded decision —
  `decision-revisit-gate` applies and that is a maintainer call, not an agent's.
- [-] **P1.5 Adoption items — CANCELLED, contradicts a lock.** "Adoption is the
  only work that counts", the `first-session` concierge as P0, and re-triggering
  the harvest freeze are all struck by
  [`ADR-216`](../../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
  (accepted 2026-08-05, the day *after* these reviews): external adoption is
  explicitly not a project goal, and the ADR's own `review_trigger` says do NOT
  reopen on an external-adoption signal. Also cancelled: unified findings store,
  governance-ROI dashboard, retirement engine, routing shadow mode — net-new
  governance layers the same reviews forbid elsewhere, against a capacity cap.

## Phase 2 — The self-fix loop (from `loops-feature.txt`)

Source: `agents/tmp.old/loops-feature.txt`. A finished roadmap in house style;
its central gap is verified in code.

- [x] **P2.1 Phase 0 null-scope check — DONE, and the null does NOT bind P2.2.**
  The argument, made before building (which is the whole point of this step) and
  grounded in the published measurement rather than in the file's own framing:
  - **What the null measured.** `docs/benchmark.md` § "Recursive
    self-verification (ADR-106)": weak host `claude-haiku-4-5`, `capH-debug`
    family, **deterministic scorer-as-critic**, `max_depth=1`, n=54 paired.
    Capability 87% vs 87% (McNemar p=1.0); discipline 0.852 vs 0.861 (Wilcoxon
    p=0.79, 3 discordant pairs against the ≥6 the gate required). ADR-106 gate
    FALSIFIED. The model-critic variant was closed by council reasoning, not
    measurement, with "Recursion-as-a-class is closed".
  - **Why P2.2 is a different mechanism, in one line.** The measured arm ADDS a
    critic to decide whether an attempt was good enough. P2.2 adds no critic:
    the red is already a deterministic verdict the engine holds in hand
    (`directives/backend/test.ts` reaches `_blocked_on_bad_verdict` because the
    test verdict is literally `failed`). There is no judgement to be null about.
  - **The null's decisive argument inverts here.** Its killer finding was that
    recursion fired on 8/29 tasks and produced differentiated output on 4/29,
    because with the rules active the first attempt already passes the critic
    **72%** of the time — so cost scaled with all tasks and benefit sat in the
    ~28% tail. A red-check retry fires **only** on a red: zero cost on the
    passing majority, all of it on the tail. Same arithmetic, opposite sign.
  - **What the null DOES bind: the falsification shape.** "Recursion is
    redundant with the always-on rules" is the outcome a self-fix loop must be
    able to discover about itself. P2.2 therefore keeps its pre-registered
    ≥50% halt reduction with revert-not-narrate, and the no-progress floor the
    `recursive-verification` skill already states in prose ("two consecutive
    attempts score identical on the deterministic scorer; further depth cannot
    help, so stop") is adopted as a hard floor rather than left as guidance.
  - Scope boundary recorded in the skill itself so the next reader cannot
    misapply the null to a deterministic retry.
  - **Original step text:** *"`recursive-verification` carries a TERMINAL honest
    null. The file's deterministic-vs-critic distinction is a legitimate reason
    the null may not bind here — but that argument is made before building, not
    after."* Confirmed: that distinction is the load-bearing one, and it holds.
- [x] **P2.2 Executable DoD + bounded self-fix loop.** Verified gap: the work
  engine halts to `Outcome.BLOCKED` on a red check with **no attempt counter**,
  so every red costs a user round-trip. Needs `dod.schema.json`, a `dod[]` slot
  on `refine`, an attempts/no-progress floor, and a PARTIAL honest exit.
  - Pre-registered: ≥50% halt reduction, or the loop is reverted rather than
    narrated.
  - **BUILD HALF SHIPPED, MEASUREMENT HALF BLOCKED — step stays open on the
    pre-registration, not on the code.** Shipped and test-pinned:
    `src/scripts/schemas/dod.schema.json`; the `dod[]` shape gate on `refine`
    (`malformed_dod`, checked on both envelope paths); the bounded loop in
    `directives/backend/_self_fix.ts` wired into BOTH red lanes; ceiling 3 (the
    `autonomous-execution` N=3 budget, per lane, because that rule resets on a
    different validation target); a no-progress floor on two identical verdict
    signatures, checked BEFORE the ceiling; volatile keys excluded from the
    signature so `duration_ms` cannot fake progress; and the PARTIAL honest exit
    that lists unproven `dod[]` items. 31 new assertions, 4 contract snapshots
    updated, 738 work-engine tests green, `docs/contracts/implement-ticket-flow.md`
    amended (state field + both ambiguity tables + two new sections).
  - **CLOSED 2026-08-14.** The account below is kept because it is the record of
    *why* this step sat open after its work was finished, and the two-stage
    resolution is the reusable part: the blocker resolved first, then the Iron
    Law 3 deferral disposition unblocked the flip. **The blocker**
    `self-fix-halt-telemetry` **resolved** on 2026-08-14 via path (b): the
    pre-registration was re-scoped to the structural claim (the loop exists, is
    bounded, terminates) and the ≥50 % figure is preserved as **never
    evaluated**, not as met. That resolution removed the only thing keeping this
    step open. **On the work, P2.2 is done.**

    It then stayed `[ ]` for a reason with nothing to do with the work. This
    roadmap carried four `[~]` deferrals (P1.1, P1.4, P3.3, P5.6), so flipping
    P2.2 would take `count_open` to 0 with `count_deferred` at 4 — exactly the
    trigger for `roadmap-progress-sync` Iron Law 3: *"A roadmap with `[~]`
    deferred items never auto-archives silently. Surface every deferred step.
    Ask the user what happens to the plan."* The disposition of a deferral is
    the user's call, and the closing commit is roadmap-touching by construction,
    so it blocked itself until the four were disposed **in the same change**.

    None of the four was honestly cancellable: P1.1 is a wanted rendering half
    over a shipped schema, P1.4 reopens a decision whose revisit trigger has not
    fired, P3.3 is "worth doing, not urgent", and P5.6 is a deliberate
    ratchet-before-split stance. Marking any of them `[-]` merely to clear the
    gate would have been the buried-work failure Iron Law 3 exists to stop.

    **Disposed 2026-08-14, maintainer's call — option 1 of the deferral menu:**
    all four migrated to
    [`road-to-inbox-harvest-residuals.md`](../road-to-inbox-harvest-residuals.md)
    as R1–R4, each carrying the reasoning that deferred it, together with the two
    blockers that outlived this roadmap. `[-]` here means *migrated*, not
    abandoned — the successor is on the dashboard, which is the whole point of
    moving them rather than burying them in an archived file.
  - **The original blocked-on-measurement reasoning, kept because it is the
    evidence the re-scope rests on:** the ≥50% is a run-level rate and the
    engine emits no halt telemetry, so it is **unevaluated, not met** — and
    "unevaluated" does not trigger the revert clause either, which fires on a
    measured miss.
    Structurally, no red reaches the user on first occurrence in either lane
    (before: 2 of 2 red exits were directive-free user halts; after: 0 of 2),
    and the one locked golden replay that reaches a red verdict (`GT-3`) moved
    its cycle-4 halt from a user question block to a delegated directive while
    still finishing in 6 cycles at exit 0 — but that is n=1, and counting code
    branches as halts would be reading the metric off the artefact built to
    satisfy it. Full reasoning, including the two honest ways
    forward: `agents/evidence/analysis/self-fix-loop-halt-measurement.md`.
    → blocker `self-fix-halt-telemetry`.
- [-] **P2.3 Host-primitive phase — CANCELLED on a false premise.** It asserts
  the host ships `/goal`, `/loop` and `/schedule`. `/loop` and `/schedule` exist;
  **`/goal` does not.** Reduce to a one-line ADR noting the host overlap.

## Phase 3 — Small verified fixes

- [x] **P3.1 `lint_abstraction_thresholds` regex + site count.** Reported: the
  cardinal branch cannot match "duplicated twice", and a header says "six
  deliberate sites" while `SITES` holds more. **Both unverified by me** — the
  site count depends on what the header counts, which I could not pin down. Two
  one-liners at most; verify before touching.
- [x] **P3.2 Three `design-fidelity` additions** (from `claude-design.txt`, the
  only survivors of that file): capability-URL trigger pattern,
  `.claude/design-system/` trigger path, and one acceptance fixture for a
  handoff bundle on the existing "port a provided artifact" branch. Add a
  near-miss row to `ROUTING_MATRIX` with each trigger — extending that set
  without one is how an over-broad trigger lands.
- [-] **P3.3 MIGRATED 2026-08-14 → [`road-to-inbox-harvest-residuals.md`](../road-to-inbox-harvest-residuals.md) R3.** Not done, not abandoned — and the only one of the four with no structural obstacle recorded against it, so it is the first candidate when capacity appears. **Level A/B/C snapshot preference order** into
  `design-system-capture` — the one genuinely new idea in `claude-design.txt`,
  and independent of any bridge. Deferred: worth doing, not urgent.

## Phase 4 — The review-mechanization residuals (from `optimize-plan.txt`)

Source: `agents/tmp.old/optimize-plan.txt`. Phase 1 only; the rest is unproven.

- [x] **P4.1 Dispatcher-owned review prompt + `prompt_hash`.** Closes a residual
  named verbatim in `docs/contracts/plan-review-gates.md`. Provider-independent.
- [x] **P4.2 `author ≠ reviewer` in the marker grammar.** The grammar carries
  `reviewer` only; the second named residual.
  - **P4.1 — the residual IS named verbatim; the identifier was not.** The
    contract's § 5 residual "the prompt channel, and it is the dangerous one"
    exists word for word, with a recorded case zero (a hash-verified honest-null
    whose prompt stated prior rounds were clean; a later unsteered round on the
    identical scope found seven defects). The string `prompt_hash` appeared
    nowhere in the plan-gate code, contract or schemas — its only prior art in
    the tree is the unrelated ai-video `prompt_sha256`. Shipped: the dispatcher
    hashes the prompt it built and writes it into the marker it already owns.
    Stated honestly in both code and contract — this makes the channel
    ATTRIBUTABLE, it does not close the residual, because the same host that
    authors a steered prompt could hash the steered text.
  - **P4.2 — the step's justification was wrong, the gap was real.** It called
    author-vs-reviewer "the second named residual"; the contract names five
    residual blocks and none is about it. The nearest text is a DEFINITION
    (§ 2.1, `reviewer:` is "never the implementing session"), i.e. a convention
    with no field to check against. So the claim is corrected in place and the
    work still shipped: an optional `author:` field plus an `author-is-reviewer`
    violation when it is present and matches.
  - **Both are one change on purpose, and that dissolved the council's cost
    argument.** The council leaned toward cancelling P4.2 on the ground that its
    edit would be better spent on the prompt channel. But P4.1 extends the same
    anchored regex in the same commit, so the "same edit" is literally the same
    edit — there is no migration to pay twice. Departure recorded rather than
    silently taken.
  - Additive, not a version bump: the four `v1` fields stay required and in
    order, so all 81 existing `check_completion_review` tests pass untouched and
    no committed artefact needed migration.

- [-] **P4.3 Risk routing, council-CLI-as-R2, plan-QA pass — CANCELLED for
  now.** Unproven, and the direction-asymmetry evidence behind them is not
  verifiable here; the draft itself says to treat it as a prior only.

## Phase 5 — The four large chat-log audits

All four triaged. Same shape as the rest: heavy already-shipped fraction, and in
two cases a flagship recommendation that argues against a lock accepted *days
before the file was written*.

- [x] **P5.1 Fix `stitch.sh --crossfade` — an advertised flag that lies.**
  `src/scripts/ai-video/stitch.sh:152` prints "not yet implemented" and then
  **silently falls through to plain concat**, so a caller who asked for a
  crossfade gets a hard cut and no error. That is worse than an unimplemented
  flag: it is a correctness bug on a shipped surface. Implement `xfade` +
  `acrossfade`, or make the flag fail loudly. Two-pass `loudnorm` is absent too.
  - The single highest-value item in the whole inbox: smallest diff, real
    user-visible wrongness, no new subsystem.
- [x] **P5.2 `design-review-after-ui-write` rule** (from `better-frontend.txt`).
  **Zero rules currently route to `skill:design-review`** — the write-side loop
  is open, while the read-side (`ui-audit-gate`) is closed. Build it as that
  rule's twin: tier 2b, `packs: [frontend-design]`, same diff-decidable
  `ui-trivial` allowlist. Cheapest real capability gain here.
  - Confirmed at HEAD: zero rules routed to `skill:design-review` — not one even
    mentioned the string. Shipped as `design-review-after-ui-write`, tier 2b,
    `packs: [frontend-design]`, the twin's trigger set, and the same honest-scope
    section (`enforced_by: none`, because "I ran the review" is self-report and
    self-report is not enforcement).
  - Two deliberate deltas from a pure copy. The allow-list carries the engine's
    **five** conditions, not the four its sibling's prose lists —
    `ui_trivial/apply.ts` enforces `new_dependency` too, so copying the shorter
    prose would inherit a gap the engine does not have. And it routes to
    `accessibility-auditor` as well as `design-review`, because `design-review`
    lives in `engineering-base` while this rule is scoped to `frontend-design`:
    a consumer with one pack and not the other would otherwise get the
    obligation without a skill to discharge it.
  - `lint_trigger_collisions` required a disposition on **both** sharers for all
    three shared triggers (`design token`, `resources/views/`, `resources/js/`),
    so `ui-audit-gate` gained the matching `collision_ok` entries in the same
    commit — 35 collisions, all dispositioned.
  - `rule-interactions.yml` row deliberately NOT added: the pair needs no
    arbiter (its own litmus calls that `complements`), and declaring the slugs
    there widens the file's closure obligation for no arbitration gain. The
    relationship is stated in both rule bodies, which is where a reader meets it.
- [x] **P5.3 Per-concern `tools:` matcher in the hook manifest** (from
  `crytical-analysis.txt`). **13 concerns fire on every single tool call.**
  A `tools:` field per concern plus a generator change is the one latency lever
  the shipped hook-repair work left open — and it matches the measured finding
  that transport dominates hook cost.
  - 13 confirmed (6 pre + 7 post, `hook_manifest.yaml`); three of them already
    re-read `tool_name` and return early — after the dispatch cost is paid.
  - **Departure 1 — no generator change.** The filter is applied by the
    dispatcher in-process, not projected as a host `matcher`.
    `build_claude_hook_matrix` collapses each event to ONE command and
    `claude_hook_matrix_parity.test.ts` asserts one group with one command per
    event, so per-concern matchers break that parity contract for a filter the
    dispatcher can apply itself — and a matcher would help only the two hosts
    that support one, against eight platforms in the manifest.
  - **Departure 2 — the latency claim is withdrawn, not inherited.** The measured
    finding was that the *invocation path* dominated (~370 of ~450–500 ms was
    eager CLI imports), and that was repaired: p95 is ~84 ms. Nothing in the tree
    measures the concern share of that 84 ms, so "the one latency lever" is
    unverified. `bench_hook_latency` reads the manifest, so it is benchable; it
    is not asserted until benched. What is true without a benchmark: a concern
    that cannot fire on a tool no longer runs at all.
  - **Scope — advisory concerns only, on purpose.** `tools:` is declared on
    `code-graph-nudge`, whose set is provable from its own branch surface and
    pinned against it by a test. It is deliberately NOT declared on the three
    blocking guards: their tool sets span host naming variants (`Bash` /
    `BashTool` / `launch-process` / `str-replace-editor` / …), so a list missing
    one variant silently disables a security guard on that host.
  - `lint_hook_manifest` validates the key (a typo or empty list fails the
    build) because the dispatcher fails toward *running* the concern — an
    unvalidated filter would look like it works while filtering nothing.
- [x] **P5.4 `check_corpus_staleness.ts`** (from `better-frontend.txt`). The
  design corpus pins a commit last checked **2026-06-07** and declares
  `refresh_cadence: quarterly` with **zero enforcement**. Clone
  `check_reach_staleness.ts`. Pair it with a CSV integrity gate in
  `corpus-grounding/scripts/schema_validator.ts`, which today never opens a CSV
  — that gate must land *before* any re-vendor, not after.
  - Both claims confirmed. `design-intelligence/data/manifest.json` pins
    `last_checked: 2026-06-07` against `refresh_cadence: quarterly`, and **five**
    manifests share that date (`accessibility-auditor`, `api-design`, `database`,
    `design-intelligence`, `threat-modeling`); `brand` declares the cadence with
    `upstream: null` and is exempt by declaration. `schema_validator.ts` touches
    the filesystem exactly three times and never opens a corpus file — it
    computes a CSV path, refuses an escape, and stops.
  - **Shipped as one gate, not two.** The staleness half and the integrity half
    read the same manifest and would otherwise parse it twice; a second script
    to keep in sync is a second drift source. Seven violation classes:
    `stale-corpus`, `future-date`, `unparseable-date`,
    `attribution-date-mismatch`, `missing-csv`, `empty-csv`, `missing-column`.
    Measured on the real tree: 6 manifests, **40 CSVs opened**, clean.
  - **Two deliberate design calls.** The quarterly bound is **100** days, not 90:
    a quarter is ~91, so a cadence met on its due date would red the maintainer
    who honoured it. And a header-only CSV counts as `empty-csv`, because zero
    rows reads exactly like a clean corpus.
  - **It carries a `--self-test` because the ratchet demanded one.** Registering
    it in `gate-coverage.yml` adds it to the enforced population that
    `gate-self-test:registered-non-adopters` measures, so shipping without one
    would have taken the count 24 → 25 and redded CI. 7 cases, 5 rejecting. That
    is P1.3's ratchet doing its job on the first gate written after it landed.
  - **Wired to a workflow, not only to `task ci`.** `task ci` is invoked by no
    workflow — which is exactly why the template `check-reach-staleness` has been
    local-only since it shipped. The `--today` pin in the coverage row is
    deliberate: unpinned, that row flips red on 2026-09-15 with no diff behind
    it. The unpinned calendar check is the workflow step, and it is *meant* to
    red when the cadence is genuinely missed.
- [x] **P5.5 `agents/proposals/` does not exist** (from `hermes.txt`). Two
  artefacts name it as an output path. One directory closes a dangling contract.
- [-] **P5.6 MIGRATED 2026-08-14 → [`road-to-inbox-harvest-residuals.md`](../road-to-inbox-harvest-residuals.md) R4**, with the ratchet-before-split ordering preserved as the decision it is. Not done, not abandoned. **God-file LOC ratchet** (from `crytical-analysis.txt`). Seven files
  confirmed oversized, plus `chat_history.ts` (2397) and `orchestrator.ts`
  (2106), with no ratchet and no roadmap. Deferred, and deliberately
  **ratchet-before-split**: splitting first is how a refactor becomes
  unreviewable.
- [-] **P5.7 CANCELLED — items that argue against locks they never read.**
  - `crytical-analysis.txt`'s **flagship** B1 ("retire tracked `dist/agent-src`")
    contradicts [`ADR-208`](../../../docs/decisions/ADR-208-dist-agent-src-keep-forever.md),
    accepted **2026-08-03 — the day before the audit**, which explicitly closes
    the question ADR-201 left open.
  - Its Part D (hook latency) is **already shipped**: 164→82 ms p95, published;
    the audit's baseline is ~2× pessimistic. Part E is a **recorded rejection**
    (quota accounting is agent-switch territory). It also cites ADR-054 as a
    solution — ADR-054 is `rejected`.
  - `better-frontend.txt`'s google-fonts import is a **recorded skip**
    (ADR-061 §8, council 2026-06-07) **and** would breach the pack-size cap —
    `design-intelligence` sits at 22.63% against a 23.0% ceiling.
  - `better-video.txt` Phases 2–3 re-propose **shipped code**: `whisperx.sh`
    ships word-level transcription with diarization, and `ingest-song.sh` is a
    shipped yt-dlp wrapper. Both phases also already have owners
    (`road-to-gated-reach-followup`, `later/road-to-reach-transcribe`). Its
    ADR-126 supersede rests on a mischaracterisation: ADR-126 cancels a *router
    skill* on a null; the YouTube parking is a later amendment whose stated
    reason is "unexercised", not "absent by design".

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-06 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A cancelled item gets re-adopted from the source file | product | Five items are cancelled because a lock forbids them or their premise is false, but the source files still argue for them persuasively and will outlive this roadmap in `tmp.old/` | Every cancellation names the lock or the false premise inline (ADR-216, the missing `/goal`, ADR-088 §1) rather than saying "descoped", so a re-reader meets the reason before the argument | Phase 1 — The release-review harvest (from `feedback-9.18.1-1.txt`) |
| 2 | P1.1 invents a second findings format | implementation | The obvious implementation writes a fresh JSON schema for the review track, leaving two incompatible findings shapes — the exact fragmentation the reviewers complained about | P1.1 names the existing `self_review_gate` shape and its `findingId()` as the thing to reuse, and the acceptance criterion is that BOTH tracks validate against one schema | Phase 1 — The release-review harvest (from `feedback-9.18.1-1.txt`) |
| 3 | P2.2 ships a loop that hides failures | product | A self-fix loop that retries silently converts a visible red into an invisible one, which is worse than the round-trip it removes | Pre-registered ≥50% halt reduction with revert-not-narrate, plus a mandatory PARTIAL honest exit and a no-progress floor, all named in P2.2 | Phase 2 — The self-fix loop (from `loops-feature.txt`) |
| 4 | P3.1 acts on an unverified report | implementation | Both halves of P3.1 come from a subagent report I could NOT confirm; acting on them would repeat the failure this whole harvest exists to prevent | P3.1 states the unverified status in the step text itself and requires verification before the edit | Phase 3 — Small verified fixes |

## Blockers

### blocker: deferred-finding-decision-reopen
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1
- **What to do:** P1.4 needs a stable-finding-id index that was explicitly
  declined at `check_review_dispositions.ts:16-22` with a named revisit
  trigger. Reopening a recorded decision is a maintainer call under
  `decision-revisit-gate`, not something an agent does because a reviewer asked.
- **Resolution (2026-08-14): MIGRATED, not decided.** The blocker moved intact to
  [`road-to-inbox-harvest-residuals.md`](../road-to-inbox-harvest-residuals.md)
  alongside the step it blocks (P1.4 → R2). It is `resolved` **here** only in the
  sense that this roadmap no longer owns it; the decision itself is untouched and
  open in the successor. Recorded this way rather than left open, because an open
  blocker refuses archival — and archiving a 100 %-closed roadmap while its one
  live decision sits visible on the dashboard in its successor is the honest
  shape, whereas keeping this file active to hold one migrated blocker is not.

  **The 2026-08-14 blanket grant approved reopening; that is why this is a
  migration and not a reopen.** `decision-revisit-gate`'s mechanism-match check
  runs first, and the decline names a falsifiable trigger — *a disposition that
  genuinely cannot be recorded in the round record itself* — with no instance on
  record. A grant releases the permission to revisit; it does not create the
  case the trigger asks for.
- **Resolved when:** ~~the decision is reopened with the trigger cited, or P1.4 is
  cancelled against it~~ — that clause now lives on the successor's copy.

### blocker: self-fix-halt-telemetry
- **Status:** resolved
- **Owner:** maintainer
- **Resolution (2026-08-14):** path **(b)** — the pre-registration is re-scoped to
  the structural claim (the loop exists, is bounded, terminates), and the ≥50 %
  halt-reduction claim is recorded as **never evaluated**, not as met.

  **Why this was not decided by the agent alone.** `evaluator-independence` holds
  that the party which built the artefact rewriting its own success criterion is
  exactly the forbidden move, so the question went to an outside opinion first.

  **Council pass, 2026-08-14 — 1 of 2 seats answered. This is NOT convergence**
  and is recorded as the single-seat judgement it is: `anthropic/claude-sonnet-4-5`,
  2 rounds; the `openai` seat failed to start (`exit_1` — the CLI refuses to run
  outside a trusted git directory, a worktree limitation, not a disagreement).
  Admitted on its checkable merit, never on a quorum it did not have — the same
  standard the capability-answerability close used.

  **The seat's condition, which is adopted and is the load-bearing part:** a
  re-scope is legitimate only if the record also names **the process failure that
  created the bind** — the criterion was *knowably unverifiable at the moment it
  was registered*, because halt telemetry does not spontaneously fail to exist.
  Registering a claim that could not be evaluated is the earlier defect; the
  re-scope is cleanup, not a discovery. Recorded so the pattern cannot repeat as
  good hygiene: **do not pre-register a threshold whose measuring infrastructure
  does not yet exist.**

  What separates this from retroactively lowering the bar: the ≥50 % figure is
  not weakened, restated, or quietly dropped — it is preserved as an unevaluated
  claim with the reason it was never evaluable.
- **Blocks:** P2.2's pre-registered criterion only — the build half is shipped
  and green, and nothing downstream waits on it.
- **What to do:** the ≥50% halt reduction is a rate over real runs, and the work
  engine records no halts. Either (a) emit one line per red-check halt (lane,
  attempt, exit kind) into the existing audit stream and accumulate over real
  usage — the same accumulation-takes-time shape as the
  `road-to-subagent-value-realization-followup` telemetry blocker — then evaluate
  the threshold against it; or (b) re-scope the pre-registration to the
  structural claim that IS provable here (no red reaches the user on first
  occurrence; every loop exit stays PARTIAL with the failure visible) and record
  the run-level rate as an explicit non-claim. Both are maintainer calls: (a)
  spends real sessions, (b) rewrites a pre-registration, and an agent rewriting
  its own success criterion after building the thing is the exact move
  `evaluator-independence` forbids.
- **Resolved when:** the threshold is evaluated against recorded halts, or the
  pre-registration is re-scoped with the non-claim recorded.
- **Evidence:** `agents/evidence/analysis/self-fix-loop-halt-measurement.md`

### blocker: spent-inbox-artifacts-await-deletion
- **Status:** resolved
- **Owner:** maintainer
- **Resolution (2026-08-14): MIGRATED, not executed.** Moved intact to
  [`road-to-inbox-harvest-residuals.md`](../road-to-inbox-harvest-residuals.md);
  `resolved` here means this roadmap no longer owns it, not that the files are
  gone. The blanket grant did approve the deletions, and two facts found while
  attempting them stopped it: *"both `council-q-*.md` files"* names two objects
  but the glob matches **12** in `agents/tmp.old/` (measured 2026-08-14), so
  acting on the pattern would delete 10 files nobody approved and
  `non-destructive-by-default` requires an approval to name its exact object;
  and `agents/tmp.old/` is gitignored and per-checkout, so a deletion made in a
  worktree is a no-op and one made in the main checkout appears in no diff. The
  item needs two filenames, not a broader authorization.
- **Blocks:** nothing
- **What to do:** four items are spent and should be removed by a human, since
  the agent reports rather than deletes: both `council-q-*.md` files (answered
  and shipped verbatim), `bench-local/` (null published, roadmap archived), and
  the byte-identical `(1).md` duplicate plus `chat.txt` inside `memory-mcp/`.
  Related finding worth a separate look: `check_council_layout` prints these as
  findings and **exits 0** — an advisory gate nobody sees, currently carrying
  ~18 permanent findings, which is the allowlist-fatigue shape this repo's own
  rules warn about.
- **Resolved when:** the files are deleted, or a reason to keep them is recorded.

## Explicitly parked

- `packages-1.txt` — a 41-repo harvest would breach the two-slot concurrency cap
  that survived ADR-216 and is mechanically enforced by
  `lint_roadmap_family_cap`. Both slots are occupied. Also: naming 40 sources in
  a tracked file runs against `source-confidentiality` — anonymize or keep local.
- `memory-mcp/` — a complete, well-built roadmap package that depends on the
  code-graph engine whose retrieval claim is a **published null**. Filing it
  without first overturning that null is a beweisrichtung error. Unparks only if
  the null is overturned.
