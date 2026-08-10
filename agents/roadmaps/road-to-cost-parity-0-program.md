---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---

# Road to cost parity — 0: the median session gets a measured target and the family gets its order

> The typical session ends at 519k tokens of context and runs its second half
> at ~2× per-call cost. This roadmap fixes the target, records what the
> per-host rule payload actually is, and orders the family — two parts active,
> two parked in `later/` on the council's convergence — after cutting the ~60 %
> of the source drafts that was already built, already owned, or forbidden by a
> standing lock.

## Goal

One committed target table for session cost with a measured baseline per
host, and one execution order across the `road-to-cost-parity-*` family such
that a later reader can pick the next unit of work without re-deriving which
roadmap owns what.

## Prerequisites

- [x] `archive/road-to-token-economy-recycling.md` on main (PR #1242) — the
      `session_eol` scanner and `session_eol_report` are this family's
      ongoing measurement instrument.
- [x] `archive/road-to-token-economy-dispatch.md` on main (PR #1237) and
      `archive/road-to-token-economy-cache.md` — the two closed programmes
      whose remainders live in `later/`.

## Context — the triage that produced this family

Four roadmap drafts arrived in one inbox batch. Each was verified
claim-by-claim against the tree on 2026-08-10 before any of it was planned.
The headline is how little survived.

| Draft | Verified disposition | Became |
| --- | --- | --- |
| dispatch economy | **87 % already shipped** — 27 of 31 steps are `[x]` on `archive/road-to-token-economy-dispatch.md` (PR #1237) or already parked in `later/road-to-token-economy-dispatch-followup.md` | `archive/road-to-cost-parity-3-handoff-envelope.md` (4 surviving steps — **done**) |
| cost-quality parity | **Premise refuted.** It sequenced four "open" roadmaps: three are archived and two of the three names never existed. Its WIP cap, metric-expiry mechanic and release dimension are each separately blocked (below) | this file — target table + ordering only |
| estate maintenance | **~40 % already covered or done, ~25 % collides with maintainer-blocked work.** Its only hard prerequisite is `never-true` *and* relitigates a standing refusal | `later/road-to-cost-parity-1-rule-payload-diet.md` (the unowned residue, parked) |
| state-aware dispatch | **Heavy overlap.** Its central premise ("the ladder is shape-only") is false, and 3 of its 5 components are lock-conflicted | `later/road-to-cost-parity-2-state-aware-dispatch.md` (the resolver only, parked) |

### CUT — verified already-built, already-parked, or lock-forbidden

Recorded so no successor re-plans them:

- **`type: always` is not the payload.** Only 9 of 116 rules are
  `type: always` (~29 KB). The drafts' "419 KB always-loaded layer" is the
  whole rule tree. Both framings are wrong — see the measured table below.
- **A standing WIP cap was rejected.**
  [`ADR-133`](../../docs/decisions/ADR-133-subsystem-freeze-unblock-list.md)
  records the council choosing an unblock list, *"not a standing WIP cap
  (accounting theater for a solo maintainer)"*. Not re-proposed here.
- **Metric-expiry machinery is deliberately parked.**
  `later/road-to-benchmark-obsolescence-lifecycle.md` — both council members
  agreed it must not be built at N=1. Not re-proposed here.
- **"Release-review dimension 13" plans against an artefact that does not
  exist.** `archive/road-to-judgment-and-forensic-evidence.md` already
  recorded that no 12-dimension matrix could be located. Dropped.
- **`dist/router.json` is not a zombie.** It has no *runtime host* consumer
  but ≥ 7 build/CI consumers, including `check_static_layer_stability.ts`,
  which derives the kernel set from it. Deleting it reds a shipped gate.
  The real finding is the inverse and is carried by part 1: because no host
  consumes the router at runtime, `type: auto` does not gate delivery.
- **The `109 divergent duplicate deliveries` prerequisite cannot be a
  prerequisite — and the reason is a third thing, neither "the count is wrong"
  nor "the measurement was contaminated".** `report_carrier_divergence`
  compares a *globally installed* carrier against the *project projection on
  disk*. Both can be stale, independently, so it measures the relative
  staleness of two caches rather than any property of the source. Measured at
  the same commit (`3deb55443`), same day, both trees freshly regenerated
  where regeneration applies: the primary checkout reports **91 shared / 90
  stamp-only / 1 body**, a second checkout reports **109 shared / 0 stamp-only
  / 109 body**. The discriminator is the projection's own freshness — the
  primary carries 92 projected rule files, the freshly generated tree carries
  110 — so "109 differ in body" is a statement that the *global install* is
  behind, not that the source diverged. This was itself verified the hard way:
  the first explanation attempted here (seeded projection) survived exactly
  until the tree was rebuilt from scratch and returned the same 109.
  Consequence for this family: the figure may diagnose a stale install; it may
  never gate a phase, and any before/after must name its checkout. The earlier
  draft's error was upstream of the count — it amplified an adjacent
  "0 byte-identical" line into a defect claim without asking *why* the bytes
  differed, and for the stamp-only pairs the tool's own answer is
  *"NOT a defect"*. It also relitigates
  `agents/settings/contexts/dedup-reachability-refusal.md`, whose five reopen
  conditions are unmet — which stands independently of any count.
- **The 201 KB ownership matrix is already generated.**
  `agents/settings/contexts/structural/file-ownership-matrix.md` carries a
  *"Do not edit — regenerated"* header and `generate_ownership_matrix.ts`
  exists.
- **Subscription quota-weight pricing stays refused.**
  `cache-economy-refusals.md` — *"has no primary source … do not
  reintroduce it without one."*

### The measured baseline (re-derived 2026-08-10, replacing the drafts' figures)

The rule payload is **per host**, and no single number describes it. This is
the correction that matters most, because every diet target in the drafts
was set against one:

| Surface | Measured | Draft claimed |
| --- | --- | --- |
| `src/rules/` (maintained) | 116 files / 413 KB / 171 MUST-NEVER-ALWAYS | 116 / 424 KB / 160 |
| `dist/agent-src/rules/` (projection source) | 115 files / 409 KB | 419 KB |
| `.augment/rules/` payload | 115 files / 409 KB | — |
| `.claude/rules/` payload | **110 files / 330 KB** | — |
| `.clinerules` / `.windsurfrules` payload | ~3 KB / ~0 KB | — |
| rules by type | 9 `always` · 102 `auto` · 5 `manual` | "419 KB always-loaded" |
| skills | 289 / 3.85 MB (112 KB frontmatter) | 289 / 3.85 MB (113 KB) |
| shipped contexts (`src/agent-src/contexts/`) | 57 files / 381 KB | never measured |
| project-local contexts (`agents/settings/contexts/`) | 78 files / 725 KB | 77 / 743 KB |
| CLI verbs | 97 | 96 |
| `user_prompt_submit` concerns (claude) | 9 (7–8 on other hosts) | 9, stated suite-wide |

Session-cost figures carry their provenance to the line, because a median is
the one number in this table that no later reader can re-derive without the
same corpus: **median 519,349 · p90 807,937 · p95 902,355 · max 986,876** at
`agents/evidence/analysis/token-economy-recycling-phase1.md:45`, over **201**
sessions with parseable final usage (`:44`) out of 205 non-empty (`:10`; four
unparseable, `:81`). Late/early per-call cost 2.1× median / 3.3× p90 over the
145 sessions with ≥ 200 calls, `:69–75`. Auto-compact incidence 23 of 205 =
11.2 % (`:59`), 31 compaction events across them (`:60`), ~98 % of context
dumped (`:66`). Two corrections to the drafts: the denominator is 201, not
205; and the **123 s is a single observed event** (`:25`), not a distribution
statistic — the drafts presented all five figures as if they were one.

**Two measurement rules the Phase-1 registration inherits, both learned the
hard way while producing this table.**

Both are **schema fields on the baseline row**, not prose a reader may skip:
`measurement_date`, `commit`, `projection_regenerated: true` (the validator
rejects `false`), and no `carrier_divergence` row admitted into the baseline at
all. A rule that lives only in a paragraph is a rule the next author does not
inherit.

1. **A projection count is only valid after a regeneration.** `.claude/rules/`
   reads 92 files on a checkout whose projection is stale on disk and 110 after
   a fresh `task generate-tools` at the same commit. The tracked
   `dist/agent-src/rules/` figure (115 files / 409 KB) is the stable one
   because it is committed; every per-host row must state that it was taken
   post-regeneration, or it is measuring when someone last ran a generator.
2. **A figure that compares two carrier trees measures their relative
   staleness, not the source.** `report_carrier_divergence` returns
   91/90-stamp/1-body against a checkout with a stale 92-file projection and
   109/0-stamp/109-body against a freshly generated 110-file one, at the same
   commit. Such figures may diagnose a behind-the-times install; they may
   never gate a phase.

Baseline caveat: the table's figures were taken 2026-08-10 across `fea32452b`
and `3deb55443`. `main` moves faster than a review cycle — during this branch's
own review two PRs landed — so Phase 1 re-measures and pins whatever it finds
under the two rules above. The table is the triage evidence; the registered
file is the baseline.

## Phase 1 — the target table, committed before any sibling lands

- [ ] 1.1 Register the family's target table in one budget file with full
      budget-file discipline (`schema_version`, `registered_at`, owner,
      review date), the baseline column exactly as measured above:
      median final context 519,349 → interim ≤ 300k → target ≤ 200k;
      p90 807,937 → ≤ 550k → ≤ 400k; auto-compact incidence 11.2 % → ≤ 5 %
      → ~0 %; late/early per-call cost ratio 2.1× → ≤ 1.6× → ≤ 1.3×.
      <!-- verify: task test -- --filter=budget -->
- [ ] 1.2 The payload rows are registered **per host**, not as one number —
      `.claude/rules` 330 KB and `.augment/rules` 409 KB are separate rows with
      separate targets, and the ~3 KB hosts are recorded as already lean so
      no target implies work there.
- [ ] 1.2b The registration is **validated, not just written.** The budget file
      joins the existing budget-file schema check: every row carries
      `schema_version`, `registered_at`, owner, `review_by`, a `source`
      pointer for its baseline value, and the three honest-null fields from
      1.3 — and the validator fails on a missing `source`, so a baseline
      figure without a traceable origin cannot enter the file. This is the
      gate that makes the rest of Phase 1 more than prose.
      **The fixture is named, not implied**, because a schema whose enforcement
      is only asserted ships unenforced: the negative fixture asserting a
      `revised_from` without `revision_evidence` is rejected, and the test that
      consumes it, are both deliverables of this step and are cited by path in
      the implementing PR.
      <!-- verify: task test -- --filter=budget -->
- [ ] 1.3 The honest-null clause is **schema, not prose.** A sentence in a
      config file is a comment no reader is obliged to honour, and this
      programme's whole claim is that numbers bend to measurements — so the
      bending is expressed as fields the gate can read. Each target row
      carries `revisable: true`, a `revision_evidence` pointer (empty until a
      revision happens, then a path to the evidence note that forced it), and
      a `revised_from` value once revised, so a target's history is machine
      -visible. The budget-file validator requires the three fields to be
      present and requires `revision_evidence` to be non-empty whenever
      `revised_from` is set — a revision without published evidence fails the
      file, which is the only form of the clause that actually binds.
      <!-- verify: task test -- --filter=budget -->
- [ ] 1.4 The 200k premium-band anchor is recorded with its rationale **and
      its known noise problem**: 187 of 205 observed sessions end ≥ 200k, so
      a session-end hint at that threshold would fire on ~91 % of sessions.
      No advisory ships in this roadmap — the threshold is a target, and any
      carrier for it is a separate, separately-argued change.

**Exit:** the budget file exists, validates, and its baseline column matches the evidence note; no behaviour changed.
**Rollback:** delete one config file.

## Phase 2 — the execution order across the family

- [ ] 2.1 Record the committed order. Only two members of this family are
      **active**; the council converged on that split and the maintainer
      applied it:
      **(a)** part 3 (handoff envelope) Phase 1 first — a located one-module
      defect with fixtures, the cheapest real win in the family;
      **(b)** this roadmap's Phase 1 (the target registration) and Phase 3
      (the three triage corrections), both unblocked;
      **(c)** parts 1 and 2 are parked in
      `agents/roadmaps/later/` with explicit resume conditions — part 1 on the
      utilization sweep, the live trigger eval, or a standalone-pilot
      authorization; part 2 on the orchestration claim queue or a Phase-1-only
      authorization. Neither is backlog the dashboard will try to execute, and
      neither rots: each names when it comes back.
- [ ] 2.2 Record what this family does **not** own, with the owner named:
      command-surface consolidation → `road-to-surface-consolidation.md`
      (active, 1 open step, time-gated); `tier:` field removal →
      `road-to-tier-removal.md` (active, 2 open steps, blocked on
      `trigger-set-amendment`); rule cut-line from the `rules_used` window →
      `later/road-to-token-economy-dispatch-followup.md`; injection dedup →
      `later/road-to-token-economy-cache-followup.md`. None of these is
      absorbed, closed, or re-planned by this family.
- [ ] 2.3 One shared evidence ledger at
      `agents/evidence/analysis/cost-parity-ledger.md`: each landed phase in
      any family member appends its measured delta against the Phase-1
      baseline table. One running ledger instead of per-roadmap scatter.
- [ ] 2.4 A council pass on part 1's lock conflicts is the recommended first
      action before part 1 Phase 2 executes — the diet's three collisions
      (preservation-guard vs. norm rewriting, kernel write-deny, the
      spend-blocked adherence bench) are decisions, not measurements.

**Exit:** the order and the non-ownership list are recorded; the ledger file exists with its baseline row.
**Rollback:** prose and one empty ledger.

## Phase 3 — the small corrections this triage surfaced

Each is a verified defect or drift found while checking the drafts. They are
listed here rather than in a sibling because none belongs to a programme.

- [ ] 3.1 `archive/road-to-conformance-round5.md` (around line 192) records
      "nothing loads `dist/router.json` at runtime" — and that roadmap is now
      closed with zero open steps, so the finding is recorded nowhere that
      owns it. Move it to a recorded decision: the router is build-time
      infrastructure with ≥ 7 consumers, and the runtime-consumer question
      belongs to `later/road-to-deferred-rule-retriever.md`. One pointer
      line, so the finding stops reading as pending deletion.
- [ ] 3.2 Correct the `#1235` mislabel, with the scope stated so the sweep is
      decidable rather than open-ended. The judgment ladder landed in PR
      **#1233**; `#1235` is the acceptance-verification commit.
      **In scope:** live artefacts under `src/`, `docs/` and non-archived
      `agents/roadmaps/`, where the wrong number would mislead a reader
      following it. **Out of scope:** anything under
      `agents/roadmaps/archive/`, `later/` or `skipped/` — including
      `archive/road-to-token-economy-dispatch.md`, which carries the same
      mislabel and is the copy others cite. An archived roadmap is a record of
      what was planned and is not rewritten; instead the correction lands once
      in this roadmap's own Context and in
      `road-to-cost-parity-2-state-aware-dispatch.md`'s prerequisites, which
      is where a future reader arrives from. **Not in scope either:** commit
      messages and merged PR bodies, which cannot be corrected.
      <!-- verify: rg -n '#1235' src docs agents/roadmaps --glob '!archive/**' --glob '!later/**' --glob '!skipped/**' | head -20 -->
- [ ] 3.3 Record the per-host payload table (Context above) into
      `agents/evidence/analysis/` so the next diet proposal starts from
      measured per-host numbers instead of one aggregate.

**Exit:** the three corrections are landed and the router finding has a named owner.
**Rollback:** per item; all three are documentation edits.

## Phase 4 — what this roadmap will not do

- [ ] 4.1 No WIP cap and no roadmap-slot accounting — `ADR-133` rejected it
      and this roadmap does not relitigate that.
- [ ] 4.2 No `expires` field, no auto-demotion cycle — parked at N=1 by
      council decision.
- [ ] 4.3 No release-review dimension — the matrix it would extend does not
      exist, as a prior roadmap already recorded.
- [ ] 4.4 No new always-loaded prose from this family's own governance. A
      diet programme that fattens the layer refutes itself.
- [ ] 4.5 No session-end advisory at 200k — see 1.4; the ~91 % firing rate
      makes it a constant line, not an advisory, and `session-eol` sits in
      the `worker.drop` set with a ~24-test downstream surface.

## Blockers

### blocker: adherence-bench-spend

- **Status:** open
- **Owner:** user
- **Blocks:** part 1's adherence-eval phase
- **What to do:** two existing roadmaps already own an A/B bench of this
  shape (`road-to-solution-minimalism.md` Phase 3, blocked on a
  $150–250 floor; `road-to-rule-coherence-followup.md` F2.1, blocked on
  `bench-spend-and-methodology`). The size-vs-adherence question is theirs;
  part 1 must consume their result, not open a third bench.
- **Resolved when:** one of the two benches is authorized and run, or the
  question is recorded as a null.

### blocker: background-continuation-probe

- **Status:** open
- **Owner:** maintainer
- **Blocks:** any continuation-offload step (none planned in this program)
- **Inherited from:** `archive/road-to-cost-parity-3-handoff-envelope.md`,
  which closed with this blocker still open. Carried here rather than
  archived with it: part 3 blocked no step on it, so it could not hold that
  roadmap open — but archiving is the only moment the question could have
  silently left the tracked surface, and an open question that no artefact
  names again is one nobody will ever answer.
- **What to do:** past the recycle threshold, the flow MAY hand remaining
  work to a fresh background session seeded with the envelope instead of
  asking the user to clear in place. Whether a background spawn reliably
  receives and acts on a seeded envelope is host semantics and unverified.
  Run a bounded two-arm probe on a live host before any step is written.
- **Resolved when:** a probe note records the observed seeding behaviour per
  host, and either a step is added citing it or the idea is recorded as a
  null.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The family adds four open roadmaps to a backlog of 21 | product | Concurrency is the failure mode this repo has repeatedly recorded; four new files could stall rather than deliver | Three of the four are deliberately small (the largest surviving scope is part 1); the triage CUT list above removed more work than the family adds; ordering (2.1) makes the next unit unambiguous, and 2.2 names four existing owners so nothing is duplicated | Phase 2 |
| 2 | The target table Goodharts into premature session cuts | product | Recycling mid-thought to hit a median number trades context quality for a metric | No carrier ships for the target in this roadmap (4.5); the existing 800k warn stays the only strong line; adoption and verify metrics from the recycling programme watch this exact failure | Phase 1 |
| 3 | Per-host payload rows are read as per-host work | product | Four rows invite four diets; the ~3 KB hosts need none | 1.2 records the lean hosts as already-lean with no target, so the row exists as evidence rather than as a task | Phase 1 |
| 4 | The CUT list is read as permanent | product | A verified lock today is a decision under past conditions; treating the list as closed forever is the failure `decision-revisit-gate` names | Each CUT entry cites its lock by path so a successor can argue against the actual recorded conditions; 2.4 routes the live conflicts to a council pass rather than to silence | Context |
| 5 | The baseline is re-measured differently later and the deltas are meaningless | implementation | Byte counts drift with every merge; a ledger comparing against a moving baseline measures drift | 1.1 pins the baseline in a registered file with a date; 2.3's ledger appends deltas against that pinned column, never against a fresh measurement | Phase 1 |

## Acceptance criteria

- [ ] The budget file exists with the measured baseline column, per-host
      payload rows and the 200k noise note, and its honest-null clause is
      schema — `revisable` / `revision_evidence` / `revised_from` present on
      every row, with the validator provably red on a fixture that sets
      `revised_from` without evidence.
- [ ] The execution order and the four named non-owners are recorded, and a
      spot-check confirms none of the four is edited by any family member.
- [ ] The ledger file exists and its first row is the pinned baseline.
- [ ] All three Phase-3 corrections landed; a grep for `#1235` in tracked
      files returns only intentional historical references.
- [ ] Every CUT entry in the Context section cites the lock or evidence file
      that justifies it — verifiable by following each path.
- [ ] The family's three siblings exist and each carries its own blockers; the
      two parked ones live under `later/` with `status: later` and a resume
      condition, and no sibling plans a step this file lists under Phase 4.

## Provenance

<!-- Source-derived per templates/roadmaps.md rule 19. -->

- Source: maintainer analysis thread, 2026-08-10 (external LLM ideation),
  consumed inbox `agents/tmp.old/median-tokenusage.txt` and
  `agents/tmp.old/better-subagent-orchestration.txt`; anonymized per
  [`source-confidentiality`](../../src/rules/source-confidentiality.md).
  Link via `src/scripts/_lib/link_crypto.ts decrypt`:
  ENC1:Lbi3WHnpd3ev5lRuiUUn+k5gOvOKcewkScdjaTgsn73kA1j8QvnyXDJH2Is2M7smNnrhHAAAYHy+FO3kpJcOaQ==
- Gap-table: the Context section above is the `KEEP` / `FOLD` / `CUT` audit
  for all four source drafts — `KEEP` became the three siblings, `FOLD`
  became this file's Phase 2 pointers, `CUT` is enumerated with a citation
  per entry.
- Council: **anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-08-10, 2 rounds,
  blind-chairman, `--prompt-mode pr`** (parts 0 and 2 attached verbatim; parts 1
  and 3 summarized — a bundle-size ceiling forbade all four). Adjudication of
  the drafts themselves was four independent tree-verification passes, one per
  draft, each citing `file:line`. Council convergence, inlined:
  - **Family scope — both members: open parts 0 and 3 now, defer parts 1 and 2**
    until one blocked roadmap clears. Rationale: a backlog that is ~60 % blocked
    is a diagnosis rather than a number, and shipping the two unblocked parts
    proves the queue moves before blocked scope is added. **Applied** — the
    maintainer took this option, so parts 1 and 2 ship parked in `later/` with
    resume conditions and only parts 0 and 3 are active.
  - **Lock deferrals — both: grounded, obey them**, with one live exception both
    raised independently: a *brake* and a *dispatch-probability weight* may not
    be the same shape, since the contract forbids blocking work to save money
    and arguably not making a spawn less likely while the user can still force
    it. Carried as the reopen condition in part 2's Phase 4 table.
  - **Strongest single point, both: part 2's soak must log counterfactual
    verdicts**, not only state — otherwise "no verdict modified" is
    unfalsifiable and the phase is theater. Applied as part 2 § 3.1b/3.1c.
  - **Part 1's bundling is a choice, not a structural necessity** —
    consolidation and norm-lines have independent rollback paths and success
    criteria, so consolidation could ship alone. Recorded; the split rides with
    the scope decision above.
  - Applied verbatim from the pass: name the validator fixture instead of
    asserting enforcement (§ 1.2b), make both measurement rules schema fields
    (§ Context), surface the floor's `scope: worker` at the API boundary
    (part 2 § 1.3), replace the ambiguous no-new-prose promise with a byte
    ceiling (part 1 § 6.8), and measure the norm-line payload delta before
    Phase 3 continues (part 1 § 3.5c).
  - One member's summary verdict was `REQUEST_CHANGES` on opening all four.
    Both the technical changes and the scope verdict are applied, so the
    condition that verdict named is met.
